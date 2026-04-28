/**
 * Single write site for student_tile_grades + companion student_tile_grade_events.
 *
 * Every grade INSERT/UPDATE flows through saveTileGrade(), which:
 *   1. reads the existing row (if any)
 *   2. classifies the change to pick the audit source enum
 *   3. upserts the grade row
 *   4. inserts the audit event row
 *
 * The two writes are SEQUENTIAL, not atomic. Postgres rarely fails an INSERT
 * after a successful UPSERT, but a connection drop between the two would
 * leave a grade with no audit row. For pre-customer state (no real students
 * yet) this is acceptable; once the audit table has consumers (G4 consistency
 * checker, parent-dispute viewer) we should migrate this to a Supabase RPC
 * that wraps both writes in a single transaction.
 *
 * Tracked: GRADING-FU-RPC-ATOMICITY (P3, file when starting G4).
 *
 * The classifyEventSource() helper is exported as a pure function so tests
 * can verify the source-enum mapping exhaustively without touching Supabase.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** Source enum on student_tile_grade_events — must match migration CHECK. */
export type GradeEventSource =
  | "ai_pre_score"
  | "teacher_confirm"
  | "teacher_override"
  | "teacher_revise"
  | "rollup_release"
  | "system_correction";

/**
 * The 8-key neutral criterion taxonomy. Matches the DB CHECK constraint on
 * student_tile_grades.criterion_keys + student_tile_grades.released_criterion_keys.
 * See docs/specs/neutral-criterion-taxonomy.md.
 */
export const NEUTRAL_CRITERION_KEYS = [
  "researching",
  "analysing",
  "designing",
  "creating",
  "evaluating",
  "reflecting",
  "communicating",
  "planning",
] as const;

export type NeutralCriterionKey = (typeof NEUTRAL_CRITERION_KEYS)[number];

const NEUTRAL_KEY_SET: ReadonlySet<string> = new Set(NEUTRAL_CRITERION_KEYS);

/** Subset of the live grade row used for source classification. */
export interface GradeStateSnapshot {
  score: number | null;
  confirmed: boolean;
  ai_pre_score: number | null;
}

/**
 * Pick the audit-event source for a (prev → next) transition. Only handles
 * teacher-driven and AI-driven edits — rollup_release and system_correction
 * are written by their own code paths (G1.4 release writer, admin tooling).
 *
 * Truth table:
 *   prev=null                   + next.confirmed=false + ai set        → ai_pre_score
 *   prev=null                   + next.confirmed=false + ai null       → ai_pre_score (treats as initial AI write — guard at caller if not desired)
 *   prev=null                   + next.confirmed=true  + score=ai      → teacher_confirm
 *   prev=null                   + next.confirmed=true  + score≠ai      → teacher_override
 *   prev.confirmed=false        + next.confirmed=true  + score=ai      → teacher_confirm
 *   prev.confirmed=false        + next.confirmed=true  + score≠ai      → teacher_override
 *   prev.confirmed=true         + change                               → teacher_revise
 *   prev.score≠next.score, both unconfirmed                            → ai_pre_score (treat AI re-run as new suggestion)
 */
export function classifyEventSource(
  prev: GradeStateSnapshot | null,
  next: GradeStateSnapshot,
): GradeEventSource {
  // Once a row is confirmed, every subsequent change is a revision.
  if (prev?.confirmed) return "teacher_revise";

  // Teacher action: confirming the row.
  if (next.confirmed) {
    const baseline = next.ai_pre_score ?? prev?.ai_pre_score ?? null;
    if (baseline !== null && next.score === baseline) return "teacher_confirm";
    return "teacher_override";
  }

  // Not confirmed — must be the AI populating or re-populating a suggestion.
  return "ai_pre_score";
}

export interface SaveTileGradeInput {
  student_id: string;
  unit_id: string;
  page_id: string;       // TEXT — nanoid(8) or letter-prefixed slug
  tile_id: string;       // "activity_<id>" or "section_<idx>"
  class_id: string;
  teacher_id: string;    // auth.uid() of the class's primary teacher (for RLS)
  graded_by?: string;    // auth.uid() of who actually scored — defaults to teacher_id
  score: number | null;
  confirmed: boolean;
  criterion_keys: string[];
  override_note?: string;
  marking_session_id?: string;
  // AI fields (optional — populated by G1.3 wiring):
  ai_pre_score?: number | null;
  ai_quote?: string;
  ai_confidence?: number | null;  // 0.00–1.00
  ai_reasoning?: string;
  ai_model_version?: string;
  prompt_version?: string;
}

export interface SaveTileGradeResult {
  grade: Record<string, unknown>;
  event: Record<string, unknown>;
}

/** Validation surface — caller can reject early before hitting the DB CHECK. */
export class SaveTileGradeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SaveTileGradeValidationError";
  }
}

export function validateCriterionKeys(keys: string[]): void {
  for (const k of keys) {
    if (!NEUTRAL_KEY_SET.has(k)) {
      throw new SaveTileGradeValidationError(
        `Invalid criterion key '${k}'. Allowed: ${NEUTRAL_CRITERION_KEYS.join(", ")}`,
      );
    }
  }
}

/**
 * Write a tile grade + the audit event in two sequential calls.
 *
 * `client` must be a service-role Supabase client (createAdminClient from
 * src/lib/supabase/admin) — the route layer enforces RLS by verifying class
 * ownership before calling this function.
 */
export async function saveTileGrade(
  client: SupabaseClient,
  input: SaveTileGradeInput,
): Promise<SaveTileGradeResult> {
  validateCriterionKeys(input.criterion_keys);

  const gradedBy = input.graded_by ?? input.teacher_id;

  // 1. Read prior row (if any) for source classification.
  const { data: prevRow } = await client
    .from("student_tile_grades")
    .select("id, score, confirmed, ai_pre_score")
    .eq("student_id", input.student_id)
    .eq("unit_id", input.unit_id)
    .eq("page_id", input.page_id)
    .eq("tile_id", input.tile_id)
    .eq("class_id", input.class_id)
    .maybeSingle();

  const prev: GradeStateSnapshot | null = prevRow
    ? {
        score: (prevRow as { score: number | null }).score,
        confirmed: (prevRow as { confirmed: boolean }).confirmed,
        ai_pre_score: (prevRow as { ai_pre_score: number | null }).ai_pre_score,
      }
    : null;

  // Effective AI baseline for next snapshot — incoming wins, else prev.
  const nextAiPreScore =
    input.ai_pre_score !== undefined
      ? input.ai_pre_score
      : (prev?.ai_pre_score ?? null);

  const next: GradeStateSnapshot = {
    score: input.score,
    confirmed: input.confirmed,
    ai_pre_score: nextAiPreScore,
  };

  const source = classifyEventSource(prev, next);
  const now = new Date().toISOString();

  // 2. Upsert the grade row.
  const upsertPayload: Record<string, unknown> = {
    student_id: input.student_id,
    unit_id: input.unit_id,
    page_id: input.page_id,
    tile_id: input.tile_id,
    class_id: input.class_id,
    teacher_id: input.teacher_id,
    graded_by: gradedBy,
    score: input.score,
    confirmed: input.confirmed,
    criterion_keys: input.criterion_keys,
    override_note: input.override_note ?? null,
    marking_session_id: input.marking_session_id ?? null,
    graded_at: input.confirmed ? now : null,
    updated_at: now,
  };

  // Only forward AI fields if the caller is wiring them (G1.3+).
  if (input.ai_pre_score !== undefined) upsertPayload.ai_pre_score = input.ai_pre_score;
  if (input.ai_quote !== undefined) upsertPayload.ai_quote = input.ai_quote;
  if (input.ai_confidence !== undefined) upsertPayload.ai_confidence = input.ai_confidence;
  if (input.ai_reasoning !== undefined) upsertPayload.ai_reasoning = input.ai_reasoning;
  if (input.ai_model_version !== undefined) upsertPayload.ai_model_version = input.ai_model_version;
  if (input.prompt_version !== undefined) upsertPayload.prompt_version = input.prompt_version;

  const { data: gradeRow, error: gradeErr } = await client
    .from("student_tile_grades")
    .upsert(upsertPayload, {
      onConflict: "student_id,unit_id,page_id,tile_id,class_id",
    })
    .select("*")
    .single();

  if (gradeErr || !gradeRow) {
    throw new Error(
      `saveTileGrade upsert failed: ${gradeErr?.message ?? "no row returned"}`,
    );
  }

  // 3. Insert the audit event. Failure here surfaces but the grade row
  //    above already landed — see RPC-atomicity follow-up note at top of file.
  const grade = gradeRow as Record<string, unknown>;
  const eventPayload = {
    grade_id: grade.id as string,
    student_id: input.student_id,
    class_id: input.class_id,
    teacher_id: input.teacher_id,
    source,
    changed_by: gradedBy,
    prev_score: prev?.score ?? null,
    new_score: input.score,
    prev_confirmed: prev?.confirmed ?? null,
    new_confirmed: input.confirmed,
    ai_confidence: input.ai_confidence ?? null,
    ai_model_version: input.ai_model_version ?? null,
    prompt_version: input.prompt_version ?? null,
    note: input.override_note ?? null,
  };

  const { data: eventRow, error: eventErr } = await client
    .from("student_tile_grade_events")
    .insert(eventPayload)
    .select("*")
    .single();

  if (eventErr || !eventRow) {
    throw new Error(
      `saveTileGrade event insert failed: ${eventErr?.message ?? "no row returned"} ` +
        `(grade row id=${String(grade.id)} already saved — investigate)`,
    );
  }

  return {
    grade,
    event: eventRow as Record<string, unknown>,
  };
}
