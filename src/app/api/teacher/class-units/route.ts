import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";

// ─────────────────────────────────────────────────────────────────
// PATCH /api/teacher/class-units
// Update a class-unit record (term_id, etc.)
//
// Body: {
//   classId: string,
//   unitId: string,
//   term_id?: string (null to clear)
// }
// ─────────────────────────────────────────────────────────────────

interface UpdateRequest {
  classId: string;
  unitId: string;
  term_id?: string | null;
}

async function PATCH(request: NextRequest) {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = (await request.json()) as UpdateRequest;

    if (!body.classId || !body.unitId) {
      return NextResponse.json(
        { error: "Missing classId or unitId" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Verify teacher owns both unit and class
    const [unitRes, classRes] = await Promise.all([
      supabase
        .from("units")
        .select("id")
        .eq("id", body.unitId)
        .eq("author_teacher_id", auth.teacherId)
        .single(),
      supabase
        .from("classes")
        .select("id")
        .eq("id", body.classId)
        .eq("teacher_id", auth.teacherId)
        .single(),
    ]);

    if (unitRes.error || classRes.error) {
      return NextResponse.json(
        { error: "Unit or class not found" },
        { status: 404 }
      );
    }

    // Update class_units record
    const updateData: any = {};
    if (body.term_id !== undefined) {
      updateData.term_id = body.term_id;
    }

    const { data, error } = await supabase
      .from("class_units")
      .update(updateData)
      .eq("class_id", body.classId)
      .eq("unit_id", body.unitId)
      .select()
      .single();

    if (error) {
      console.error("[class-units PATCH]", error);
      return NextResponse.json(
        { error: "Failed to update class-unit" },
        { status: 500 }
      );
    }

    return NextResponse.json({ classUnit: data });
  } catch (err) {
    console.error("[class-units PATCH]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export { PATCH };
