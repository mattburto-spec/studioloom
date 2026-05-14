// audit-skip: AI draft generation only — no DB mutations. The draft is returned to the inbox UI for the teacher to review; the eventual approve/discard happens via PUT /api/teacher/grading/tile-grades (which carries its own audit).
/**
 * POST /api/teacher/grading/draft-followup
 *
 * TFL.3 C.3. Given a grade_id whose latest turn is a student reply,
 * loads the thread context + calls the ai-followup helper to draft a
 * pedagogically-grounded teacher follow-up.
 *
 * Auth: requireTeacher (security-overview.md hard rule). Verifies
 * teacher owns the class containing the grade row before reading any
 * thread data — prevents drafting a follow-up against another
 * teacher's thread.
 *
 * PII: the helper builds prompts with STUDENT_NAME_PLACEHOLDER. The
 * route resolves the student's real name AFTER the Haiku response
 * via restoreStudentName() — same pattern as the G3.1 ai-prescore
 * route. The route file is added to the REDACTION_ALLOWLIST in
 * src/lib/security/__tests__/no-pii-in-ai-prompts.test.ts.
 *
 * Returns:
 *   { draftBody, promptVariant, modelVersion, promptVersion }
 *
 * The inbox client uses the draftBody as the textarea content; on
 * approve the existing PUT /api/teacher/grading/tile-grades writes
 * it through as student_facing_comment + the B.4 sync trigger
 * INSERTs a new teacher turn into tile_feedback_turns.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTeacher } from "@/lib/auth/require-teacher";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  generateAiFollowup,
  type AiFollowupInput,
  NO_FOLLOWUP_SENTINEL,
} from "@/lib/grading/ai-followup";
import { restoreStudentName } from "@/lib/security/student-name-placeholder";
import { summariseInspirationBoardForAI } from "@/lib/integrity/parse-inspiration-board";
import { extractTilesFromPage } from "@/lib/grading/lesson-tiles";
import { getPageList } from "@/lib/unit-adapter";
import { resolveClassUnitContent } from "@/lib/units/resolve-content";
import type { UnitContentData } from "@/types";
import type { Sentiment } from "@/components/lesson/TeacherFeedback/types";

interface PostBody {
  grade_id?: string;
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

  const db = createAdminClient();

  // 1. Load grade + verify teacher ownership in one query.
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

  // 2. Load thread turns; need latest student turn (reply) + latest
  // teacher turn (original feedback the student is replying to).
  const { data: turns, error: tErr } = await db
    .from("tile_feedback_turns")
    .select("id, role, body_html, sentiment, reply_text, sent_at")
    .eq("grade_id", gradeId)
    .order("sent_at", { ascending: false });
  if (tErr) {
    return NextResponse.json(
      { error: `Failed to load turns: ${tErr.message}` },
      { status: 500 },
    );
  }
  type TurnRow = {
    id: string;
    role: "teacher" | "student";
    body_html: string | null;
    sentiment: Sentiment | null;
    reply_text: string | null;
    sent_at: string;
  };
  const turnRows = (turns ?? []) as TurnRow[];
  const latestTurn = turnRows[0];
  if (!latestTurn || latestTurn.role !== "student" || !latestTurn.sentiment) {
    // Not actually a reply-waiting thread — the inbox shouldn't
    // have called us. Return 400 so the bug surfaces.
    return NextResponse.json(
      {
        error:
          "Latest turn is not a student reply — draft-followup only applies to reply_waiting threads.",
      },
      { status: 400 },
    );
  }
  const latestTeacherTurn = turnRows.find((t) => t.role === "teacher");
  const originalTeacherBody = latestTeacherTurn?.body_html
    // Strip the <p>...</p> wrapper the B.1 backfill + sync trigger
    // add — the helper wants plain text reasoning, not HTML.
    ? latestTeacherTurn.body_html.replace(/^<p>/, "").replace(/<\/p>$/, "")
    : "";

  // 3. Load student response (the work the conversation is about).
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

  // 4. Load student display name for post-LLM restoreStudentName.
  // The display name is NEVER passed to Haiku — see helper file
  // header. Loaded here only for the response.
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

  // 5. Load tile prompt + criterion label from unit content.
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

  // 6. Call Haiku via the helper. PII contract: helper builds
  // prompts with STUDENT_NAME_PLACEHOLDER; we restore the real
  // name on the returned draftBody.
  const input: AiFollowupInput = {
    sentiment: latestTurn.sentiment,
    replyText: latestTurn.reply_text ?? "",
    originalTeacherBody,
    studentResponse,
    tilePrompt,
    criterionLabel,
  };

  try {
    const result = await generateAiFollowup(input);
    // Sentinel pass-through — the inbox renders "(no follow-up needed)"
    // explicitly to the teacher; don't restoreStudentName on it.
    const draftBody =
      result.draftBody === NO_FOLLOWUP_SENTINEL
        ? NO_FOLLOWUP_SENTINEL
        : restoreStudentName(result.draftBody, realName);
    return NextResponse.json({
      draftBody,
      promptVariant: result.promptVariant,
      modelVersion: result.modelVersion,
      promptVersion: result.promptVersion,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to draft follow-up",
      },
      { status: 502 },
    );
  }
}
