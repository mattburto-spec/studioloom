// audit-skip: routine teacher pedagogy ops, low audit value
/**
 * POST /api/teacher/grading/tile-grades/ai-prescore
 *
 * Batch-runs the AI pre-score for one tile across the cohort. Per student:
 *   1. Reads student_progress.responses[tile_id] for the unit/page.
 *   2. Calls Haiku 4.5 with the tile prompt + criterion + response.
 *   3. Persists the AI fields via saveTileGrade (source='ai_pre_score',
 *      written by classifyEventSource).
 *
 * Auth: teacher Supabase session. Verifies class ownership server-side.
 * Per-student errors are caught + reported inside `results[]` so a single
 * Haiku failure (rate-limit, malformed response) doesn't roll back the
 * whole batch.
 *
 * Cost: ~$0.0017 per (student × tile). For a 24-student class on one tile,
 * ~$0.04 per click.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveTileGrade } from "@/lib/grading/save-tile-grade";
import { generateAiPrescore } from "@/lib/grading/ai-prescore";
import { summariseInspirationBoardForAI } from "@/lib/integrity/parse-inspiration-board";
import { restoreStudentName } from "@/lib/security/student-name-placeholder";
import { extractTilesFromPage } from "@/lib/grading/lesson-tiles";
import { getPageList } from "@/lib/unit-adapter";
import { resolveClassUnitContent } from "@/lib/units/resolve-content";
import { getGradingScale } from "@/lib/constants";
import type { UnitContentData } from "@/types";
import { requireTeacher } from "@/lib/auth/require-teacher";

interface PostBody {
  class_id?: string;
  unit_id?: string;
  page_id?: string;
  tile_id?: string;
  student_ids?: string[];
}

interface PerStudentResult {
  student_id: string;
  ok: boolean;
  error?: string;
  ai_score?: number | null;
  ai_quote?: string | null;
  ai_confidence?: number | null;
  ai_comment_draft?: string | null;
}

const MAX_BATCH = 50; // safety cap so a 200-student typo doesn't auto-burn $0.40

export async function POST(request: NextRequest) {
  const auth = await requireTeacher(request);
  if (auth.error) return auth.error;
  const { teacherId } = auth;

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { class_id, unit_id, page_id, tile_id, student_ids } = body;
  if (!class_id || !unit_id || !page_id || !tile_id || !Array.isArray(student_ids)) {
    return NextResponse.json(
      { error: "class_id, unit_id, page_id, tile_id, student_ids[] are required" },
      { status: 400 },
    );
  }
  if (student_ids.length === 0) {
    return NextResponse.json({ results: [] });
  }
  if (student_ids.length > MAX_BATCH) {
    return NextResponse.json(
      { error: `Batch capped at ${MAX_BATCH} students per call (got ${student_ids.length}).` },
      { status: 400 },
    );
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "AI is not configured on this deployment (ANTHROPIC_API_KEY missing)." },
      { status: 503 },
    );
  }

  const supabaseAdmin = createAdminClient();

  // Verify teacher owns this class.
  const { data: cls } = await supabaseAdmin
    .from("classes")
    .select("id, framework, subject")
    .eq("id", class_id)
    .eq("teacher_id", teacherId)
    .single();
  if (!cls) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }
  const klass = cls as { id: string; framework: string | null; subject: string | null };

  // Resolve the tile within the class's unit content.
  const { data: classUnit } = await supabaseAdmin
    .from("class_units")
    .select("content_data, units(id, content_data)")
    .eq("class_id", class_id)
    .eq("unit_id", unit_id)
    .maybeSingle();
  if (!classUnit) {
    return NextResponse.json({ error: "Class-unit assignment not found" }, { status: 404 });
  }
  // Supabase JS types the joined `units` as `unknown[]` even when the
  // foreign-key cardinality is many-to-one. Cast through unknown so the
  // narrowing below stays explicit instead of fighting the inferred shape.
  type Joined = {
    content_data: UnitContentData | null;
    units: { id: string; content_data: UnitContentData | null } | { id: string; content_data: UnitContentData | null }[] | null;
  };
  const cu = classUnit as unknown as Joined;
  const unitRow = Array.isArray(cu.units) ? cu.units[0] ?? null : cu.units;
  const masterContent = unitRow?.content_data ?? ({ version: 2, pages: [] } as UnitContentData);
  const resolvedContent = resolveClassUnitContent(masterContent, cu.content_data);

  const page = getPageList(resolvedContent).find((p) => p.id === page_id);
  if (!page) {
    return NextResponse.json({ error: "Page not found in unit" }, { status: 404 });
  }

  const tiles = extractTilesFromPage(page, {
    framework: klass.framework ?? undefined,
    unitType: klass.subject ?? undefined,
  });
  const tile = tiles.find((t) => t.tileId === tile_id);
  if (!tile) {
    return NextResponse.json({ error: "Tile not found in page" }, { status: 404 });
  }

  const scale = getGradingScale(klass.framework ?? "IB_MYP");
  const scaleLabel =
    scale.type === "percentage"
      ? "percentage"
      : scale.type === "letter"
        ? `letter (${scale.labels?.join("–") ?? ""})`
        : `numeric ${scale.min}–${scale.max}`;

  // Load responses + display names for every requested student.
  // Names are NEVER passed to Anthropic — generateAiPrescore uses
  // STUDENT_NAME_PLACEHOLDER throughout. We load names here so the route
  // can RESTORE the placeholder on the returned feedback_draft via
  // restoreStudentName() before persisting (security-overview.md §1.3).
  const [progressRes, studentsRes] = await Promise.all([
    supabaseAdmin
      .from("student_progress")
      .select("student_id, responses")
      .eq("unit_id", unit_id)
      .eq("page_id", page_id)
      .in("student_id", student_ids),
    supabaseAdmin
      .from("students")
      .select("id, display_name, username")
      .in("id", student_ids),
  ]);

  type ProgressRow = { student_id: string; responses: Record<string, unknown> | null };
  type StudentRow = { id: string; display_name: string | null; username: string | null };

  const responseByStudent: Record<string, string> = {};
  for (const p of (progressRes.data ?? []) as ProgressRow[]) {
    const tileText = p.responses && typeof p.responses === "object" ? p.responses[tile_id] : null;
    if (typeof tileText === "string") responseByStudent[p.student_id] = tileText;
  }
  // Display names — used ONLY for client-side restoreStudentName() on the
  // returned feedback_draft. Never passed to generateAiPrescore.
  const studentNames: Record<string, string> = {};
  for (const s of (studentsRes.data ?? []) as StudentRow[]) {
    studentNames[s.id] = s.display_name?.trim() || s.username?.trim() || "Student";
  }

  // Resolve neutral criterion keys from the tile (mirrors page-side resolver).
  // For G1.3 v1 we accept the same MYP-A/B/C/D hint mapping; G1.4 will
  // replace this with the full FrameworkAdapter.fromLabel() chain.
  const NEUTRAL = new Set([
    "researching", "analysing", "designing", "creating",
    "evaluating", "reflecting", "communicating", "planning",
  ]);
  const HINT: Record<string, string[]> = {
    A: ["researching", "analysing"],
    B: ["designing"],
    C: ["creating"],
    D: ["evaluating"],
  };
  const criterionKeys: string[] = (() => {
    const out = new Set<string>();
    for (const t of tile.criterionTags) {
      if (NEUTRAL.has(t)) {
        out.add(t);
        continue;
      }
      const hint = HINT[t];
      if (hint) hint.forEach((h) => out.add(h));
    }
    return Array.from(out);
  })();

  // Run pre-score per student. Parallelised in chunks of 6 — Matt
  // smoke 13 May 2026 caught 24-student batches taking ~60s on the
  // old serial loop (Haiku ~2-3s × 24 = ~60s). Chunking to 6
  // concurrent puts 24 through in ~4 chunks × ~3s ≈ 12-15s. Catch
  // errors per-row so a single failure doesn't poison the batch;
  // result order is preserved by the index map. The CHUNK_SIZE
  // matches the inbox warm-up loop's concurrency for consistency.
  const CHUNK_SIZE = 6;
  const processOne = async (studentId: string): Promise<PerStudentResult> => {
    try {
      const rawResponse = responseByStudent[studentId] ?? "";
      // Rich-shape detection (Inspiration Board etc.) — the AI helper
      // takes plain string. Passing raw JSON makes it grade the JSON,
      // not the student's thinking. Flatten to a readable summary if
      // we recognise the shape; else use the raw string.
      const inspirationSummary = summariseInspirationBoardForAI(rawResponse);
      const studentResponse = inspirationSummary ?? rawResponse;
      const ai = await generateAiPrescore({
        tilePrompt: tile.title,
        criterionLabel: tile.criterionLabel,
        studentResponse,
        scaleMin: scale.min,
        scaleMax: scale.max,
        scaleLabel,
      });

      // PII restore (security-overview.md §1.3): the helper returns
      // feedback_draft with STUDENT_NAME_PLACEHOLDER ("Student") wherever it
      // addresses the student. Swap to the real name BEFORE persisting +
      // returning to the client.
      const realName = studentNames[studentId] ?? "Student";
      const feedbackDraftRestored = ai.feedbackDraft
        ? restoreStudentName(ai.feedbackDraft, realName)
        : null;

      await saveTileGrade(supabaseAdmin, {
        student_id: studentId,
        unit_id,
        page_id,
        tile_id,
        class_id,
        teacher_id: teacherId,
        score: ai.score,
        confirmed: false,
        criterion_keys: criterionKeys,
        ai_pre_score: ai.score,
        ai_quote: ai.evidenceQuote ?? undefined,
        ai_confidence: ai.confidence,
        ai_reasoning: ai.reasoning ?? undefined,
        ai_comment_draft: feedbackDraftRestored ?? null,
        ai_model_version: ai.modelVersion,
        prompt_version: ai.promptVersion,
      });

      return {
        student_id: studentId,
        ok: true,
        ai_score: ai.score,
        ai_quote: ai.evidenceQuote,
        ai_confidence: ai.confidence,
        ai_comment_draft: feedbackDraftRestored,
      };
    } catch (err) {
      return {
        student_id: studentId,
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  };

  const results: PerStudentResult[] = [];
  for (let i = 0; i < student_ids.length; i += CHUNK_SIZE) {
    const slice = student_ids.slice(i, i + CHUNK_SIZE);
    // eslint-disable-next-line no-await-in-loop
    const sliceResults = await Promise.all(slice.map(processOne));
    results.push(...sliceResults);
  }

  return NextResponse.json({ results });
}
