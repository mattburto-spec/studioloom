// audit-skip: routine teacher pedagogy ops, low audit value
/**
 * PUT /api/teacher/grading/tile-grades
 *
 * Single endpoint for teacher-driven tile-grade writes (G1.1.2). Upserts
 * student_tile_grades + inserts companion student_tile_grade_events audit
 * row via the saveTileGrade service.
 *
 * Auth: teacher Supabase session. Verifies class ownership server-side.
 * teacher_id is derived from auth.uid() — request body's teacher_id is
 * ignored (security).
 *
 * Mirrors the auth pattern from src/app/api/teacher/assessments/route.ts.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  SaveTileGradeValidationError,
  saveTileGrade,
  type SaveTileGradeInput,
} from "@/lib/grading/save-tile-grade";

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

interface PutBody {
  student_id?: string;
  unit_id?: string;
  page_id?: string;
  tile_id?: string;
  class_id?: string;
  score?: number | null;
  confirmed?: boolean;
  criterion_keys?: string[];
  override_note?: string;
  student_facing_comment?: string | null;
  marking_session_id?: string;
  // AI fields are accepted but ignored in G1.1 (no AI wiring yet); G1.3
  // will start populating these.
  ai_pre_score?: number | null;
  ai_quote?: string;
  ai_confidence?: number | null;
  ai_reasoning?: string;
  ai_model_version?: string;
  prompt_version?: string;
}

export async function PUT(request: NextRequest) {
  const teacherId = await getTeacherId(request);
  if (!teacherId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: PutBody;
  try {
    body = (await request.json()) as PutBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const required = [
    "student_id",
    "unit_id",
    "page_id",
    "tile_id",
    "class_id",
    "criterion_keys",
  ] as const;
  for (const k of required) {
    if (body[k] === undefined || body[k] === null) {
      return NextResponse.json({ error: `${k} is required` }, { status: 400 });
    }
  }
  if (!Array.isArray(body.criterion_keys)) {
    return NextResponse.json(
      { error: "criterion_keys must be an array" },
      { status: 400 },
    );
  }
  if (typeof body.confirmed !== "boolean") {
    return NextResponse.json(
      { error: "confirmed must be a boolean" },
      { status: 400 },
    );
  }

  const supabaseAdmin = createAdminClient();

  // Verify teacher owns this class (RLS replacement at the API boundary).
  const { data: cls } = await supabaseAdmin
    .from("classes")
    .select("id")
    .eq("id", body.class_id!)
    .eq("teacher_id", teacherId)
    .single();

  if (!cls) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  const input: SaveTileGradeInput = {
    student_id: body.student_id!,
    unit_id: body.unit_id!,
    page_id: body.page_id!,
    tile_id: body.tile_id!,
    class_id: body.class_id!,
    teacher_id: teacherId,
    score: body.score ?? null,
    confirmed: body.confirmed,
    criterion_keys: body.criterion_keys!,
    override_note: body.override_note,
    student_facing_comment: body.student_facing_comment,
    marking_session_id: body.marking_session_id,
    ai_pre_score: body.ai_pre_score,
    ai_quote: body.ai_quote,
    ai_confidence: body.ai_confidence,
    ai_reasoning: body.ai_reasoning,
    ai_model_version: body.ai_model_version,
    prompt_version: body.prompt_version,
  };

  try {
    const result = await saveTileGrade(supabaseAdmin, input);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof SaveTileGradeValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to save tile grade: ${message}` },
      { status: 500 },
    );
  }
}
