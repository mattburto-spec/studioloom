import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireTeacherAuth,
  verifyTeacherHasUnit,
} from "@/lib/auth/verify-teacher-unit";
import { trackEdits } from "@/lib/feedback/edit-tracker";
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

    // Phase 3.4d — replace the inline `.eq("author_teacher_id", auth.teacherId)`
    // gate with verifyTeacherHasUnit which (post Phase 3.4a) delegates to
    // can(actor, 'unit.edit', ...). Author still passes; class_members
    // co_teacher / dept_head of any class with this unit assigned now also
    // passes. Closes the co-teacher capability gap on master content edits.
    const access = await verifyTeacherHasUnit(auth.teacherId, unitId);
    if (!access.hasAccess) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    const { data: unit, error: unitErr } = await supabase
      .from("units")
      .select("id, author_teacher_id, content_data")
      .eq("id", unitId)
      .single();

    if (unitErr || !unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    // Snapshot previous content for edit tracking (before overwrite)
    const previousContent = unit.content_data as UnitContentData | null;

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

    // Fire-and-forget: track teacher edits for feedback loop
    // Diffs old vs new content_data, writes per-activity edit events
    // to generation_feedback (kept/deleted/rewritten/reordered/scaffolding_changed)
    if (previousContent) {
      trackEdits(supabase, unitId, unitId, previousContent as unknown as Record<string, unknown>, content_data as unknown as Record<string, unknown>).catch(
        (err) => console.error("[units/[unitId]/content PATCH] edit tracking error:", err)
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
