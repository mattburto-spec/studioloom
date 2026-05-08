// audit-skip: routine teacher pedagogy ops, low audit value
/**
 * POST /api/teacher/grading/release
 *
 * Releases a student's per-tile grades into the canonical
 * `assessment_records` row for (student_id, unit_id, class_id).
 *
 * Steps:
 *   1. Read all confirmed tile grades for the student in this unit/class.
 *   2. Compute per-criterion rollup (neutral keys, average mode).
 *   3. Map neutral keys → framework-specific labels via FrameworkAdapter.
 *   4. Upsert assessment_records.data.criterion_scores[] with the labelled
 *      rows. Set is_draft=false so the student/parent can see it.
 *   5. Snapshot released_at + released_score + released_criterion_keys onto
 *      each tile grade row that fed the rollup (frozen value the student
 *      saw, even if the live tile grade is later edited).
 *
 * Auth: teacher Supabase session. Verifies class ownership.
 *
 * Note: G1.4 v1 commits the existing AssessmentRecord shape — strand_scores
 * + evidence_page_ids are not populated. Those become richer in G2 when the
 * tile→criterion evidence trail goes deeper.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeStudentRollup, type TileGradeForRollup } from "@/lib/grading/rollup";
import { toLabel, type FrameworkId, type NeutralCriterionKey } from "@/lib/frameworks/adapter";

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
  student_id?: string;
  /** Free-form teacher comment that lands on assessment_records.data.overall_comment. */
  comment?: string;
}

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

  const { class_id, unit_id, student_id, comment } = body;
  if (!class_id || !unit_id || !student_id) {
    return NextResponse.json(
      { error: "class_id, unit_id, student_id are required" },
      { status: 400 },
    );
  }

  const supabaseAdmin = createAdminClient();

  // Verify teacher owns this class.
  const { data: cls } = await supabaseAdmin
    .from("classes")
    .select("id, framework")
    .eq("id", class_id)
    .eq("teacher_id", teacherId)
    .single();
  if (!cls) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }
  const framework = ((cls as { framework: string | null }).framework ?? "IB_MYP") as FrameworkId;

  // Pull all confirmed tile grades for this student in this class+unit.
  const { data: gradeRows } = await supabaseAdmin
    .from("student_tile_grades")
    .select("id, tile_id, page_id, score, confirmed, criterion_keys, graded_at, score_na")
    .eq("class_id", class_id)
    .eq("unit_id", unit_id)
    .eq("student_id", student_id);

  type RollupRow = TileGradeForRollup & { id: string };
  const rows = (gradeRows ?? []) as RollupRow[];

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "No tile grades found for this student in this unit." },
      { status: 400 },
    );
  }

  // NA rows are confirmed but contribute no score — exclude from the
  // "is there anything to release?" gate AND from snapshot writes below.
  const confirmedRows = rows.filter(
    (r) => r.confirmed && r.score !== null && !r.score_na,
  );
  if (confirmedRows.length === 0) {
    return NextResponse.json(
      { error: "No confirmed tile grades to release. Confirm at least one tile first." },
      { status: 400 },
    );
  }

  const rollup = computeStudentRollup(confirmedRows);

  // Map neutral keys → framework-specific labels for assessment_records.
  // FrameworkAdapter.toLabel returns the canonical short label per framework.
  const criterionScores = rollup.map((r) => {
    const labelResult = toLabel(r.neutral_key as NeutralCriterionKey, framework, {
      format: "short",
    });
    const labelStr =
      labelResult.kind === "label"
        ? labelResult.short
        : labelResult.kind === "implicit"
          ? labelResult.short
          : r.neutral_key;
    return {
      criterion_key: labelStr,
      level: r.score,
      evidence_page_ids: Array.from(new Set(rows.filter((row) => r.sources.includes(row.tile_id)).map((row) => row.page_id))),
      _neutral_key: r.neutral_key,
      _source_tiles: r.sources,
    };
  });

  // Compute overall grade as a simple unweighted average of per-criterion
  // levels. v1 — frameworks with grade boundaries (MYP 1–7) do their own
  // computation when reading. We just denormalise the average.
  const overallGrade = Math.round(
    criterionScores.reduce((s, c) => s + c.level, 0) / criterionScores.length,
  );

  // Upsert assessment_records (canonical released-grade record).
  const now = new Date().toISOString();
  const assessmentData = {
    student_id,
    unit_id,
    class_id,
    teacher_id: teacherId,
    criterion_scores: criterionScores,
    overall_grade: overallGrade,
    overall_comment: comment ?? null,
    is_draft: false,
    released_at: now,
    released_via: "grading_g1.4",
  };

  const { data: ar, error: arErr } = await supabaseAdmin
    .from("assessment_records")
    .upsert(
      {
        student_id,
        unit_id,
        class_id,
        teacher_id: teacherId,
        data: assessmentData,
        overall_grade: overallGrade,
        is_draft: false,
        assessed_at: now,
      },
      { onConflict: "student_id,unit_id,class_id" },
    )
    .select("*")
    .single();

  if (arErr || !ar) {
    return NextResponse.json(
      { error: `Failed to write assessment record: ${arErr?.message ?? "unknown"}` },
      { status: 500 },
    );
  }

  // Snapshot released_* fields onto each contributing tile grade row.
  // Rollup.sources gives us the tile_ids per criterion. A single tile may
  // contribute to multiple criteria (e.g. MYP A → researching + analysing).
  // We snapshot the full neutral-keys array onto the row.
  const tileToRelease: Record<string, { score: number; keys: string[] }> = {};
  for (const r of rollup) {
    for (const tileId of r.sources) {
      const existing = tileToRelease[tileId];
      if (existing) {
        existing.keys.push(r.neutral_key);
      } else {
        tileToRelease[tileId] = { score: r.score, keys: [r.neutral_key] };
      }
    }
  }

  // Bulk update — one PATCH per row keyed by primary key. Could be a single
  // CASE/WHEN UPDATE, but we're talking <=100 rows per release; readability
  // wins.
  const releasePromises = confirmedRows.map((row) => {
    const r = tileToRelease[row.tile_id];
    if (!r) return Promise.resolve({ ok: true });
    return supabaseAdmin
      .from("student_tile_grades")
      .update({
        released_at: now,
        released_score: row.score, // snapshot the actual tile score, not the rollup avg
        released_criterion_keys: r.keys,
      })
      .eq("id", row.id);
  });
  await Promise.all(releasePromises);

  return NextResponse.json({
    assessment: ar,
    released_at: now,
    rollup,
    overall_grade: overallGrade,
  });
}
