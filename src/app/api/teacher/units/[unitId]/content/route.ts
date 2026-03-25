import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";
import type { UnitContentData } from "@/types";

// ─────────────────────────────────────────────────────────────────
// PATCH /api/teacher/units/[unitId]/content
// Direct master content update — for "All classes" edit mode.
// Writes to units.content_data (the master template).
// All non-forked class-units immediately see the update.
// Forked class-units are NOT affected.
//
// Body: { content_data: UnitContentData }
// ─────────────────────────────────────────────────────────────────

async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ unitId: string }> }
) {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;

  try {
    const { unitId } = await params;
    const body = await request.json();
    const { content_data } = body as { content_data: UnitContentData };

    if (!content_data) {
      return NextResponse.json(
        { error: "Missing content_data" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Verify teacher owns this unit
    const { data: unit, error: unitErr } = await supabase
      .from("units")
      .select("id, author_teacher_id")
      .eq("id", unitId)
      .eq("author_teacher_id", auth.teacherId)
      .single();

    if (unitErr || !unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    // Update master content directly
    const { error: updateErr } = await supabase
      .from("units")
      .update({ content_data })
      .eq("id", unitId);

    if (updateErr) {
      console.error("[units/[unitId]/content PATCH] update error:", updateErr);
      return NextResponse.json(
        { error: "Failed to update master content" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[units/[unitId]/content PATCH]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export { PATCH };
