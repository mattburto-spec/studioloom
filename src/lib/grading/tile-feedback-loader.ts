/**
 * tile-feedback-loader — server-side helper for loading multi-turn
 * feedback threads for a student's lesson page.
 *
 * TFL.2 Pass B sub-phase B.2. Reads from the `tile_feedback_turns`
 * table created in B.1, keyed by grade_id. Joins to
 * `student_tile_grades` to scope by (student_id, unit_id, page_id),
 * then groups by tile_id so the lesson page can render `<TeacherFeedback
 * turns={threads[tileId] ?? []} />` per activity tile.
 *
 * Output shape matches the `Turn` discriminated union from
 * `src/components/lesson/TeacherFeedback/types.ts` so the caller can
 * pass the result straight through to the component without massaging.
 *
 * Read-receipt bump is NOT done here — the route handler calls the
 * existing TFL.1 `bump_student_seen_comment_at` RPC alongside this
 * loader. Keeping the loader pure makes it reusable from server
 * components or any future read context where receipts shouldn't fire.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Sentiment,
  TeacherTurn,
  StudentTurn,
  Turn,
} from "@/components/lesson/TeacherFeedback/types";

/** Grouped output: tileId → ordered turns. Empty arrays not included
 *  (a tile with no feedback gets no key — caller checks for absence). */
export type ThreadsByTileId = Record<string, Turn[]>;

/** Map from tile_id to the corresponding student_tile_grades.id.
 *  Needed by B.3 so the reply POST endpoint can route to the right
 *  grade row without a second DB lookup. Every tile that has a row
 *  in student_tile_grades for this (student, unit, page) appears
 *  here, even if it has no feedback turns yet. */
export type GradeIdByTileId = Record<string, string>;

export interface TileFeedbackResult {
  threadsByTileId: ThreadsByTileId;
  gradeIdByTileId: GradeIdByTileId;
}

interface RawTurnRow {
  id: string;
  role: "teacher" | "student";
  author_id: string | null;
  body_html: string | null;
  edited_at: string | null;
  sentiment: Sentiment | null;
  reply_text: string | null;
  sent_at: string;
  // Joined from student_tile_grades:
  grade_id: string;
  tile_id: string;
}

interface TeacherProfileRow {
  id: string;
  // teachers table columns per docs/schema-registry.yaml — `name` is
  // the legacy required column, `display_name` is the optional override.
  name?: string | null;
  display_name?: string | null;
  email?: string | null;
}

/**
 * Load all teacher + student turns for the (student, unit, page),
 * grouped by tile_id and ordered by sent_at ASC.
 *
 * Author resolution: teacher turns carry `author_id` (auth.users.id).
 * We resolve those to display names via a single batched lookup
 * against `teachers` (or fall back to "Teacher" if missing). Caller
 * doesn't need to plumb names through.
 */
export async function loadTileFeedbackThreads(
  client: SupabaseClient,
  studentId: string,
  unitId: string,
  pageId: string,
  /** Optional whitelist of tile IDs that currently exist on the
   *  rendered page. Used to drop ORPHAN grades for tiles a teacher
   *  has since deleted from the page. If omitted, all grades are
   *  returned (legacy behaviour — kept for callers that haven't
   *  resolved page content yet). Matt smoke 14 May 2026 — the
   *  student banner was reading "feedback on 3 tiles" on a page that
   *  no longer had any tiles. */
  validTileIds?: Set<string> | null,
): Promise<TileFeedbackResult> {
  // Two-step query:
  //   1. Find grade_ids for this student × unit × page.
  //   2. Pull all turns under those grade_ids, ordered by sent_at.
  // (Single-query JOIN is possible but PostgREST embeds get awkward
  // when the FK target is auth.users; explicit two-step is clearer.)
  const { data: grades, error: gErr } = await client
    .from("student_tile_grades")
    .select("id, tile_id")
    .eq("student_id", studentId)
    .eq("unit_id", unitId)
    .eq("page_id", pageId);

  if (gErr) {
    throw new Error(
      `loadTileFeedbackThreads — student_tile_grades fetch failed: ${gErr.message}`,
    );
  }
  if (!grades || grades.length === 0) {
    return { threadsByTileId: {}, gradeIdByTileId: {} };
  }

  // Drop orphan grades whose tile_id is no longer in the rendered
  // page content (caller-supplied whitelist; if not supplied we keep
  // all grades for backwards compatibility). This prevents the
  // student-side banner from reading "feedback on N tiles" when those
  // tiles were deleted by the teacher.
  const filteredGrades = (grades as { id: string; tile_id: string }[]).filter(
    (g) => !validTileIds || validTileIds.has(g.tile_id),
  );
  if (filteredGrades.length === 0) {
    return { threadsByTileId: {}, gradeIdByTileId: {} };
  }

  const gradeIds = filteredGrades.map((g) => g.id);
  const tileByGradeId = new Map<string, string>();
  // Build the inverse map (tile → grade) at the same time. Both maps
  // are derived from the same source query so they're guaranteed
  // consistent with each other.
  const gradeIdByTileId: GradeIdByTileId = {};
  for (const g of filteredGrades) {
    tileByGradeId.set(g.id, g.tile_id);
    gradeIdByTileId[g.tile_id] = g.id;
  }

  const { data: turns, error: tErr } = await client
    .from("tile_feedback_turns")
    .select(
      "id, grade_id, role, author_id, body_html, edited_at, sentiment, reply_text, sent_at",
    )
    .in("grade_id", gradeIds)
    .order("sent_at", { ascending: true });

  if (tErr) {
    throw new Error(
      `loadTileFeedbackThreads — tile_feedback_turns fetch failed: ${tErr.message}`,
    );
  }
  if (!turns || turns.length === 0) {
    // gradeIdByTileId still populated — a tile may have a grade row
    // but no turns yet (the reply endpoint needs to know the
    // grade_id to insert the first turn).
    return { threadsByTileId: {}, gradeIdByTileId };
  }

  // Resolve teacher names in a single batched lookup.
  const teacherIds = Array.from(
    new Set(
      (turns as RawTurnRow[])
        .filter((t) => t.role === "teacher" && t.author_id)
        .map((t) => t.author_id as string),
    ),
  );

  const teacherNamesById = new Map<string, string>();
  if (teacherIds.length > 0) {
    const { data: teachers } = await client
      .from("teachers")
      .select("id, name, display_name, email")
      .in("id", teacherIds);
    for (const t of (teachers ?? []) as TeacherProfileRow[]) {
      // Prefer display_name (teacher's chosen public alias) over name
      // (typically the legal/full name from initial signup). Fall back
      // to email-prefix or generic "Teacher" if neither is set.
      const name =
        (t.display_name && t.display_name.trim()) ||
        (t.name && t.name.trim()) ||
        (t.email && t.email.split("@")[0]) ||
        "Teacher";
      teacherNamesById.set(t.id, name);
    }
  }

  // Group turns by tile_id (resolved via grade_id).
  const threadsByTileId: ThreadsByTileId = {};
  for (const raw of turns as RawTurnRow[]) {
    const tileId = tileByGradeId.get(raw.grade_id);
    if (!tileId) continue; // grade row was deleted between queries — skip
    const turn = mapRawToTurn(raw, teacherNamesById);
    if (!turn) continue;
    if (!threadsByTileId[tileId]) threadsByTileId[tileId] = [];
    threadsByTileId[tileId].push(turn);
  }

  return { threadsByTileId, gradeIdByTileId };
}

/** Convert a raw DB row into the discriminated `Turn` shape the
 *  client component expects. Returns null if the row violates the
 *  CHECK constraint somehow (defensive — should be impossible
 *  given B.1's discriminated-union check). */
function mapRawToTurn(
  raw: RawTurnRow,
  teacherNames: Map<string, string>,
): Turn | null {
  if (raw.role === "teacher") {
    if (!raw.author_id || !raw.body_html) return null;
    const teacher: TeacherTurn = {
      role: "teacher",
      id: raw.id,
      authorId: raw.author_id,
      authorName: teacherNames.get(raw.author_id) ?? "Teacher",
      bodyHTML: raw.body_html,
      sentAt: raw.sent_at,
      ...(raw.edited_at ? { editedAt: raw.edited_at } : {}),
    };
    return teacher;
  }

  // role === "student"
  if (!raw.sentiment) return null;
  const student: StudentTurn = {
    role: "student",
    id: raw.id,
    sentiment: raw.sentiment,
    text: raw.reply_text ?? "",
    sentAt: raw.sent_at,
  };
  return student;
}
