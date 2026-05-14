// audit-skip: AI draft regeneration only — no DB mutations. The regenerated draft is returned to the inbox for review; eventual approve/discard writes through PUT /api/teacher/grading/tile-grades (which carries its own audit).
/**
 * POST /api/teacher/grading/regenerate-draft
 *
 * TFL.3 C.4. Tweak-button regeneration. Given a grade_id + a current
 * draft + a directive (shorter / warmer / sharper / ask), re-runs
 * the AI helper applying the adjustment. Doesn't touch score,
 * evidence, or confidence — pure body rewrite.
 *
 * Auth: requireTeacher + ownership check (same pattern as
 * draft-followup + resolve-thread).
 *
 * Body:
 *   {
 *     grade_id: string,
 *     current_draft: string,          // what the teacher sees in the textarea
 *     directive: "shorter" | "warmer" | "sharper" | "ask",
 *     ask_text?: string               // required when directive === "ask"
 *   }
 *
 * Response:
 *   { draftBody, directive, modelVersion, promptVersion }
 *
 * PII handling (security-overview.md §1.3): the inbound current_draft
 * has the REAL student name in it (it was restored at draft-time before
 * being sent to the inbox). We swap real → placeholder before calling
 * the helper, and restore real → placeholder back on the response.
 * Same pattern as the G3.1 prescore + C.3 follow-up paths.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTeacher } from "@/lib/auth/require-teacher";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  regenerateDraft,
  type RegenerateDraftInput,
  type RegenerateDirective,
} from "@/lib/grading/regenerate-draft";
import {
  STUDENT_NAME_PLACEHOLDER,
  restoreStudentName,
} from "@/lib/security/student-name-placeholder";
import { summariseInspirationBoardForAI } from "@/lib/integrity/parse-inspiration-board";
import { extractTilesFromPage } from "@/lib/grading/lesson-tiles";
import { getPageList } from "@/lib/unit-adapter";
import { resolveClassUnitContent } from "@/lib/units/resolve-content";
import type { UnitContentData } from "@/types";

const VALID_DIRECTIVES: RegenerateDirective[] = [
  "shorter",
  "warmer",
  "sharper",
  "ask",
];

interface PostBody {
  grade_id?: string;
  current_draft?: string;
  directive?: string;
  ask_text?: string;
}

export async function POST(request: NextRequest) {
  const auth = await requireTeacher(request);
  if (auth.error) return auth.error;
  const teacherId = auth.teacherId;

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const gradeId = body.grade_id;
  if (!gradeId) {
    return NextResponse.json(
      { error: "grade_id required" },
      { status: 400 },
    );
  }

  const currentDraft = (body.current_draft ?? "").trim();
  if (!currentDraft) {
    return NextResponse.json(
      { error: "current_draft required (nothing to tweak)" },
      { status: 400 },
    );
  }

  const directive = body.directive as RegenerateDirective;
  if (!VALID_DIRECTIVES.includes(directive)) {
    return NextResponse.json(
      {
        error: `directive must be one of ${VALID_DIRECTIVES.join(", ")}`,
      },
      { status: 400 },
    );
  }

  const askText = (body.ask_text ?? "").trim();
  if (directive === "ask" && !askText) {
    return NextResponse.json(
      { error: "ask_text required when directive === 'ask'" },
      { status: 400 },
    );
  }

  const db = createAdminClient();

  // 1. Load grade + verify teacher ownership.
  const { data: gradeRow, error: gErr } = await db
    .from("student_tile_grades")
    .select(
      "id, student_id, class_id, unit_id, page_id, tile_id, classes(teacher_id)",
    )
    .eq("id", gradeId)
    .maybeSingle();
  if (gErr || !gradeRow) {
    return NextResponse.json(
      { error: gErr?.message ?? "Grade not found" },
      { status: 404 },
    );
  }
  const grade = gradeRow as unknown as {
    id: string;
    student_id: string;
    class_id: string;
    unit_id: string;
    page_id: string;
    tile_id: string;
    classes: { teacher_id: string } | { teacher_id: string }[] | null;
  };
  const klass = Array.isArray(grade.classes) ? grade.classes[0] : grade.classes;
  if (!klass || klass.teacher_id !== teacherId) {
    return NextResponse.json(
      { error: "Forbidden — grade belongs to another teacher" },
      { status: 403 },
    );
  }

  // 2. Load student response (anchors the regeneration).
  const { data: progressRow } = await db
    .from("student_progress")
    .select("responses")
    .eq("student_id", grade.student_id)
    .eq("unit_id", grade.unit_id)
    .eq("page_id", grade.page_id)
    .maybeSingle();
  const responses =
    (progressRow as { responses: Record<string, unknown> | null } | null)
      ?.responses ?? null;
  const rawResponse =
    responses && typeof responses === "object"
      ? typeof responses[grade.tile_id] === "string"
        ? (responses[grade.tile_id] as string)
        : ""
      : "";
  // Rich-shape normalisation — Inspiration Board JSON → readable text
  // for the AI. Same fix as the prescore route. Matt smoke 13 May 2026.
  const inspirationSummary = summariseInspirationBoardForAI(rawResponse);
  const studentResponse = inspirationSummary ?? rawResponse;

  // 3. Load student display name — used ONLY for the real→placeholder
  // swap before calling Haiku + the placeholder→real restore after.
  // Never reaches the LLM. Same pattern as the prescore + follow-up
  // paths. Allowlisted in no-pii-in-ai-prompts.test.ts.
  const { data: studentRow } = await db
    .from("students")
    .select("display_name, username")
    .eq("id", grade.student_id)
    .maybeSingle();
  const realName =
    (studentRow as { display_name: string | null; username: string | null } | null)
      ?.display_name?.trim() ||
    (studentRow as { display_name: string | null; username: string | null } | null)
      ?.username?.trim() ||
    "Student";

  // 4. Load tile prompt + criterion.
  const { data: cuRow } = await db
    .from("class_units")
    .select("content_data, units(content_data)")
    .eq("class_id", grade.class_id)
    .eq("unit_id", grade.unit_id)
    .maybeSingle();
  let tilePrompt = "";
  let criterionLabel = "";
  if (cuRow) {
    const cu = cuRow as {
      content_data: UnitContentData | null;
      units:
        | { content_data: UnitContentData | null }
        | { content_data: UnitContentData | null }[]
        | null;
    };
    const unitRow = Array.isArray(cu.units) ? cu.units[0] : cu.units;
    const master = unitRow?.content_data ?? ({ version: 2, pages: [] } as UnitContentData);
    const resolved = resolveClassUnitContent(master, cu.content_data);
    const page = getPageList(resolved).find((p) => p.id === grade.page_id);
    if (page) {
      const tiles = extractTilesFromPage(page, {});
      const tile = tiles.find((t) => t.tileId === grade.tile_id);
      if (tile) {
        tilePrompt = tile.title;
        criterionLabel = tile.criterionLabel;
      }
    }
  }

  // 5. Real-name → placeholder swap on the inbound draft.
  // Case-insensitive global replace, escaping regex specials in the
  // name (e.g. "O'Brien"). The helper's prompt also instructs the
  // model to keep using the placeholder so we don't leak names back.
  const escapedName = realName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const placeholderDraft =
    realName.length > 0 && realName !== "Student"
      ? currentDraft.replace(
          new RegExp(escapedName, "gi"),
          STUDENT_NAME_PLACEHOLDER,
        )
      : currentDraft;

  // 6. Call the helper.
  const input: RegenerateDraftInput = {
    currentDraft: placeholderDraft,
    tilePrompt,
    criterionLabel,
    studentResponse,
    directive,
    askText: directive === "ask" ? askText : undefined,
  };

  try {
    const result = await regenerateDraft(input);
    const draftBody = restoreStudentName(result.draftBody, realName);
    return NextResponse.json({
      draftBody,
      directive: result.directive,
      modelVersion: result.modelVersion,
      promptVersion: result.promptVersion,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to regenerate draft",
      },
      { status: 502 },
    );
  }
}
