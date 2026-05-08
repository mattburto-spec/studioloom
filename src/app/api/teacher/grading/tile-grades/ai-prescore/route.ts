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
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveTileGrade } from "@/lib/grading/save-tile-grade";
import { generateAiPrescore } from "@/lib/grading/ai-prescore";
import { extractTilesFromPage } from "@/lib/grading/lesson-tiles";
import { getPageList } from "@/lib/unit-adapter";
import { resolveClassUnitContent } from "@/lib/units/resolve-content";
import { getGradingScale } from "@/lib/constants";
import type { UnitContentData } from "@/types";

async function getTeacherId(request: NextRequest): Promise<string | null> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {},
      },
    },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id || null;
}

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
  const teacherId = await getTeacherId(request);
  if (!teacherId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  // Load responses + display names for every requested student in one round-trip.
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

  // Run pre-score per student. Catch errors per-row so the batch survives.
  const results: PerStudentResult[] = [];
  for (const studentId of student_ids) {
    try {
      const studentResponse = responseByStudent[studentId] ?? "";
      const ai = await generateAiPrescore({
        tilePrompt: tile.title,
        criterionLabel: tile.criterionLabel,
        studentResponse,
        scaleMin: scale.min,
        scaleMax: scale.max,
        scaleLabel,
        studentDisplayName: studentNames[studentId],
      });

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
        ai_comment_draft: ai.feedbackDraft ?? null,
        ai_model_version: ai.modelVersion,
        prompt_version: ai.promptVersion,
      });

      results.push({
        student_id: studentId,
        ok: true,
        ai_score: ai.score,
        ai_quote: ai.evidenceQuote,
        ai_confidence: ai.confidence,
        ai_comment_draft: ai.feedbackDraft,
      });
    } catch (err) {
      results.push({
        student_id: studentId,
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({ results });
}
