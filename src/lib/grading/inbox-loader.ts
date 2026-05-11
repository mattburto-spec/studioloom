/**
 * Teacher Inbox loader — TFL.3 / Pass C sub-phase C.1.
 *
 * Returns the prioritised list of (student × tile × lesson) items
 * needing teacher action for `auth.uid()`'s classes. The brief
 * decision matrix:
 *
 *   reply_waiting — latest turn in tile_feedback_turns is a student
 *     reply. Highest priority. Student is waiting on the teacher.
 *   drafted       — student submitted, AI drafted a comment via the
 *     existing G3.1 prescore flow (ai_comment_draft populated), but
 *     teacher hasn't approved yet (confirmed=false). Mid priority.
 *   no_draft      — student submitted but AI hasn't drafted yet
 *     (ai_comment_draft IS NULL). Lowest priority; the page kicks
 *     off the existing /api/teacher/grading/tile-grades/ai-prescore
 *     batch to warm these.
 *
 * `got_it` threads where teacher is up-to-date are NOT surfaced as
 * individual items — they roll up at the lesson level (C.2 polish).
 *
 * 90-day window on `updated_at` to keep payload bounded. Inbox is
 * for current work, not archaeology — teachers reviewing older items
 * deep-dive via /teacher/marking.
 *
 * Pure read-derived view. No new tables, no schema changes — every
 * field is already in student_tile_grades + tile_feedback_turns +
 * student_progress + classes + units + students.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { extractTilesFromPage } from "@/lib/grading/lesson-tiles";
import { getPageList } from "@/lib/unit-adapter";
import { resolveClassUnitContent } from "@/lib/units/resolve-content";
import type { UnitContentData } from "@/types";
import type { Sentiment } from "@/components/lesson/TeacherFeedback/types";

export type InboxItemState = "reply_waiting" | "drafted" | "no_draft";

export interface InboxItem {
  // Identity / routing
  itemKey: string; // `${grade_id}::${tile_id}` — stable React key
  gradeId: string;
  studentId: string;
  studentName: string; // first name; not in any LLM prompt
  classId: string;
  className: string;
  unitId: string;
  unitTitle: string;
  pageId: string;
  pageTitle: string;
  tileId: string;
  tilePrompt: string;
  criterionLabel: string;

  // State
  state: InboxItemState;
  studentResponse: string | null;
  aiScore: number | null;
  aiCommentDraft: string | null;
  aiReasoning: string | null;
  aiQuote: string | null;
  aiConfidence: number | null;

  // For state === "reply_waiting":
  latestStudentReply: {
    sentiment: Sentiment;
    text: string;
    sentAt: string;
  } | null;
  latestTeacherTurnBody: string | null;

  // Sorting
  submittedAt: string | null;
  lastActivityAt: string;
}

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const HARD_CAP = 200; // pre-filter ceiling; JS filter trims to UI cap (50)

interface GradeRow {
  id: string;
  student_id: string;
  class_id: string;
  unit_id: string;
  page_id: string;
  tile_id: string;
  score: number | null;
  confirmed: boolean;
  ai_pre_score: number | null;
  ai_comment_draft: string | null;
  ai_reasoning: string | null;
  ai_quote: string | null;
  ai_confidence: number | null;
  student_facing_comment: string | null;
  updated_at: string;
  created_at: string;
}

interface ClassRow {
  id: string;
  name: string;
  framework: string | null;
  subject: string | null;
}

interface StudentRow {
  id: string;
  display_name: string | null;
  username: string | null;
}

interface ClassUnitRow {
  class_id: string;
  unit_id: string;
  content_data: UnitContentData | null;
  units: {
    id: string;
    title: string;
    content_data: UnitContentData | null;
  } | { id: string; title: string; content_data: UnitContentData | null }[] | null;
}

interface TurnRow {
  id: string;
  grade_id: string;
  role: "teacher" | "student";
  body_html: string | null;
  sentiment: Sentiment | null;
  reply_text: string | null;
  sent_at: string;
}

interface ProgressRow {
  student_id: string;
  unit_id: string;
  page_id: string;
  responses: Record<string, unknown> | null;
}

/**
 * Load inbox items for the requesting teacher.
 *
 * @param client service-role admin client (route gates ownership)
 * @param teacherId auth.users.id of the teacher whose classes to scope
 */
export async function loadInboxItems(
  client: SupabaseClient,
  teacherId: string,
): Promise<InboxItem[]> {
  // 1. Teacher's classes.
  const { data: classes } = await client
    .from("classes")
    .select("id, name, framework, subject")
    .eq("teacher_id", teacherId);
  const classRows = (classes ?? []) as ClassRow[];
  if (classRows.length === 0) return [];
  const classIds = classRows.map((c) => c.id);
  const classById = new Map(classRows.map((c) => [c.id, c]));

  // 2. Recent grades for those classes. We pre-filter to the 90-day
  // window + drop already-confirmed-AND-no-active-reply rows later
  // in JS once we have the turn data.
  const since = new Date(Date.now() - NINETY_DAYS_MS).toISOString();
  const { data: grades } = await client
    .from("student_tile_grades")
    .select(
      "id, student_id, class_id, unit_id, page_id, tile_id, score, confirmed, ai_pre_score, ai_comment_draft, ai_reasoning, ai_quote, ai_confidence, student_facing_comment, updated_at, created_at",
    )
    .in("class_id", classIds)
    .gte("updated_at", since)
    .order("updated_at", { ascending: false })
    .limit(HARD_CAP);
  const gradeRows = (grades ?? []) as GradeRow[];
  if (gradeRows.length === 0) return [];

  const gradeIds = gradeRows.map((g) => g.id);

  // 3. Turns for those grades. We derive (latest turn role) per grade
  // to spot reply_waiting state, AND (latest student turn) per grade
  // to surface sentiment + reply_text for the inbox card. One query;
  // two derived maps — same pattern as the marking page.
  const { data: turns } = await client
    .from("tile_feedback_turns")
    .select("id, grade_id, role, body_html, sentiment, reply_text, sent_at")
    .in("grade_id", gradeIds)
    .order("sent_at", { ascending: false });
  const turnRows = (turns ?? []) as TurnRow[];
  const latestTurnByGradeId = new Map<
    string,
    { role: "teacher" | "student"; body_html: string | null; sent_at: string }
  >();
  const latestStudentReplyByGradeId = new Map<
    string,
    { sentiment: Sentiment; text: string; sentAt: string }
  >();
  const latestTeacherBodyByGradeId = new Map<string, string>();
  for (const t of turnRows) {
    if (!latestTurnByGradeId.has(t.grade_id)) {
      latestTurnByGradeId.set(t.grade_id, {
        role: t.role,
        body_html: t.body_html,
        sent_at: t.sent_at,
      });
    }
    if (
      t.role === "student" &&
      t.sentiment &&
      !latestStudentReplyByGradeId.has(t.grade_id)
    ) {
      latestStudentReplyByGradeId.set(t.grade_id, {
        sentiment: t.sentiment,
        text: t.reply_text ?? "",
        sentAt: t.sent_at,
      });
    }
    if (
      t.role === "teacher" &&
      t.body_html &&
      !latestTeacherBodyByGradeId.has(t.grade_id)
    ) {
      latestTeacherBodyByGradeId.set(t.grade_id, t.body_html);
    }
  }

  // 4. Student responses for the (student, unit, page) tuples we
  // care about. Batch by unit (one query per unit cheaper than per
  // student) — typical teacher has 1-3 active units.
  const unitIds = Array.from(new Set(gradeRows.map((g) => g.unit_id)));
  const studentIdsSet = new Set(gradeRows.map((g) => g.student_id));
  const { data: progress } = await client
    .from("student_progress")
    .select("student_id, unit_id, page_id, responses")
    .in("unit_id", unitIds)
    .in("student_id", Array.from(studentIdsSet));
  const progressRows = (progress ?? []) as ProgressRow[];
  const responseByKey = new Map<string, string>();
  for (const p of progressRows) {
    if (!p.responses || typeof p.responses !== "object") continue;
    for (const [tileId, value] of Object.entries(p.responses)) {
      if (typeof value !== "string" || value.trim().length === 0) continue;
      const key = `${p.student_id}::${p.unit_id}::${p.page_id}::${tileId}`;
      responseByKey.set(key, value);
    }
  }

  // 5. Student names (display names) for the cohort.
  const { data: students } = await client
    .from("students")
    .select("id, display_name, username")
    .in("id", Array.from(studentIdsSet));
  const studentById = new Map(
    ((students ?? []) as StudentRow[]).map((s) => [s.id, s]),
  );

  // 6. Class-unit content (tile prompt + criterion lookup). One
  // class_unit row per (class, unit); the row + the joined units.
  // content_data gives the unit content with class overrides
  // applied via resolveClassUnitContent.
  const classUnitPairs = Array.from(
    new Set(gradeRows.map((g) => `${g.class_id}::${g.unit_id}`)),
  ).map((pair) => {
    const [classId, unitId] = pair.split("::");
    return { classId, unitId };
  });
  const tileLookup = new Map<
    string,
    {
      pageTitle: string;
      tilePrompt: string;
      criterionLabel: string;
    }
  >(); // key: `${unit_id}::${page_id}::${tile_id}`

  for (const { classId, unitId } of classUnitPairs) {
    const { data: cu } = await client
      .from("class_units")
      .select("class_id, unit_id, content_data, units(id, title, content_data)")
      .eq("class_id", classId)
      .eq("unit_id", unitId)
      .maybeSingle();
    if (!cu) continue;
    const cuRow = cu as ClassUnitRow;
    const unitRow = Array.isArray(cuRow.units) ? cuRow.units[0] ?? null : cuRow.units;
    if (!unitRow) continue;
    const klass = classById.get(classId);
    const masterContent =
      unitRow.content_data ?? ({ version: 2, pages: [] } as UnitContentData);
    const resolved = resolveClassUnitContent(masterContent, cuRow.content_data);
    const pages = getPageList(resolved);
    for (const page of pages) {
      const tiles = extractTilesFromPage(page, {
        framework: klass?.framework ?? undefined,
        unitType: klass?.subject ?? undefined,
      });
      for (const tile of tiles) {
        tileLookup.set(`${unitId}::${page.id}::${tile.tileId}`, {
          pageTitle: page.title ?? page.id,
          tilePrompt: tile.title,
          criterionLabel: tile.criterionLabel,
        });
      }
    }
  }
  const unitTitleById = new Map<string, string>();
  for (const { classId, unitId } of classUnitPairs) {
    const { data: cu } = await client
      .from("class_units")
      .select("units(id, title)")
      .eq("class_id", classId)
      .eq("unit_id", unitId)
      .maybeSingle();
    if (!cu) continue;
    const u = (cu as { units: { title: string } | { title: string }[] | null }).units;
    const title = Array.isArray(u) ? u[0]?.title ?? null : u?.title ?? null;
    if (title) unitTitleById.set(unitId, title);
  }

  // 7. Derive state per grade + filter to interesting items.
  const items: InboxItem[] = [];
  for (const g of gradeRows) {
    const klass = classById.get(g.class_id);
    if (!klass) continue;
    const student = studentById.get(g.student_id);
    const tileMeta = tileLookup.get(`${g.unit_id}::${g.page_id}::${g.tile_id}`);
    if (!tileMeta) continue; // tile no longer exists in unit content; skip
    const responseKey = `${g.student_id}::${g.unit_id}::${g.page_id}::${g.tile_id}`;
    const studentResponse = responseByKey.get(responseKey) ?? null;
    const latestTurn = latestTurnByGradeId.get(g.id);
    const latestStudentReply = latestStudentReplyByGradeId.get(g.id) ?? null;
    const latestTeacherTurnBody =
      latestTeacherBodyByGradeId.get(g.id) ?? g.student_facing_comment ?? null;

    let state: InboxItemState | null = null;
    if (latestTurn?.role === "student" && latestStudentReply) {
      state = "reply_waiting";
    } else if (g.ai_comment_draft && !g.confirmed) {
      // Either no thread yet OR latest is teacher AND draft hasn't been
      // sent. Promote to drafted-state only if the draft is meaningfully
      // different from what's already sent.
      const cleanDraft = g.ai_comment_draft.trim();
      const cleanSent = (g.student_facing_comment ?? "").trim();
      if (cleanDraft && cleanDraft !== cleanSent) {
        state = "drafted";
      }
    } else if (!g.ai_comment_draft && !g.confirmed && studentResponse) {
      state = "no_draft";
    }
    if (!state) continue;

    items.push({
      itemKey: `${g.id}::${g.tile_id}`,
      gradeId: g.id,
      studentId: g.student_id,
      studentName:
        student?.display_name?.split(" ")[0] || student?.username || "Student",
      classId: g.class_id,
      className: klass.name,
      unitId: g.unit_id,
      unitTitle: unitTitleById.get(g.unit_id) ?? "Unit",
      pageId: g.page_id,
      pageTitle: tileMeta.pageTitle,
      tileId: g.tile_id,
      tilePrompt: tileMeta.tilePrompt,
      criterionLabel: tileMeta.criterionLabel,
      state,
      studentResponse,
      aiScore: g.ai_pre_score,
      aiCommentDraft: g.ai_comment_draft,
      aiReasoning: g.ai_reasoning,
      aiQuote: g.ai_quote,
      aiConfidence: g.ai_confidence,
      latestStudentReply,
      latestTeacherTurnBody,
      submittedAt: null, // populated post-pilot if student_progress.updated_at gets surfaced
      lastActivityAt:
        latestStudentReply?.sentAt ??
        latestTurn?.sent_at ??
        g.updated_at ??
        g.created_at,
    });
  }

  // 8. Sort per the brief's locked order: reply-waiting first (DESC
  // by lastActivityAt — newest reply most urgent), then drafted
  // (oldest submission first — clear the backlog), then no-draft
  // (oldest first).
  const stateOrder: Record<InboxItemState, number> = {
    reply_waiting: 0,
    drafted: 1,
    no_draft: 2,
  };
  items.sort((a, b) => {
    if (stateOrder[a.state] !== stateOrder[b.state]) {
      return stateOrder[a.state] - stateOrder[b.state];
    }
    if (a.state === "reply_waiting") {
      // newest replies first
      return b.lastActivityAt.localeCompare(a.lastActivityAt);
    }
    // oldest first for drafted + no_draft
    return a.lastActivityAt.localeCompare(b.lastActivityAt);
  });

  return items;
}
