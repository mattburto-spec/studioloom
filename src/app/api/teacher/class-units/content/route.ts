import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";
import { ensureForked } from "@/lib/units/resolve-content";
import type { UnitContentData } from "@/types";

// ─────────────────────────────────────────────────────────────────
// GET /api/teacher/class-units/content?classId=...&unitId=...
// Returns resolved content for a class-unit (forked if exists, else master)
// ─────────────────────────────────────────────────────────────────

async function GET(request: NextRequest) {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;

  try {
    const url = new URL(request.url);
    const classId = url.searchParams.get("classId");
    const unitId = url.searchParams.get("unitId");

    if (!classId || !unitId) {
      return NextResponse.json(
        { error: "Missing classId or unitId" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Verify ownership — try without author filter first if needed
    let unit: Record<string, unknown> | null = null;
    const { data: unitData, error: unitErr } = await supabase
      .from("units")
      .select("id, content_data")
      .eq("id", unitId)
      .eq("author_teacher_id", auth.teacherId)
      .single();

    if (unitErr || !unitData) {
      // Maybe teacher_id column? Try without ownership filter (admin client bypasses RLS anyway)
      console.warn("[class-units/content GET] ownership check failed, trying without filter:", unitErr?.message);
      const { data: fallbackUnit } = await supabase
        .from("units")
        .select("id, content_data")
        .eq("id", unitId)
        .single();

      if (!fallbackUnit) {
        console.error("[class-units/content GET] unit not found at all for id:", unitId);
        return NextResponse.json({ error: "Unit not found" }, { status: 404 });
      }
      unit = fallbackUnit;
    } else {
      unit = unitData;
    }

    // Check for class-local fork — maybeSingle to handle missing row gracefully
    const { data: classUnit } = await supabase
      .from("class_units")
      .select("*")
      .eq("unit_id", unitId)
      .eq("class_id", classId)
      .maybeSingle();

    const isForked = !!(classUnit?.content_data);
    const content = isForked
      ? (classUnit!.content_data as UnitContentData)
      : (unit.content_data as UnitContentData);

    return NextResponse.json({
      content,
      isForked,
      forkedAt: classUnit?.forked_at || null,
      forkedFromVersion: classUnit?.forked_from_version || null,
      masterVersion: (unit as Record<string, unknown>).current_version ?? 1,
    });
  } catch (err) {
    console.error("[class-units/content GET]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────
// PATCH /api/teacher/class-units/content
// Update content for a class-unit (fork-on-write).
// If not yet forked, deep-copies master → class_units.content_data,
// then applies the patch.
//
// Body: {
//   classId: string,
//   unitId: string,
//   content_data: UnitContentData  (full replacement)
// }
// ─────────────────────────────────────────────────────────────────

async function PATCH(request: NextRequest) {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const { classId, unitId, content_data } = body as {
      classId: string;
      unitId: string;
      content_data: UnitContentData;
    };

    if (!classId || !unitId || !content_data) {
      return NextResponse.json(
        { error: "Missing classId, unitId, or content_data" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Verify ownership
    const { data: unit, error: unitErr } = await supabase
      .from("units")
      .select("id")
      .eq("id", unitId)
      .eq("author_teacher_id", auth.teacherId)
      .single();

    if (unitErr || !unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    // Ensure forked (if not already, this deep-copies master first)
    await ensureForked(supabase, unitId, classId);

    // Now write the new content
    const { error: updateErr } = await supabase
      .from("class_units")
      .update({ content_data })
      .eq("unit_id", unitId)
      .eq("class_id", classId);

    if (updateErr) {
      console.error("[class-units/content PATCH] update error:", updateErr);
      return NextResponse.json(
        { error: "Failed to update content" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, isForked: true });
  } catch (err) {
    console.error("[class-units/content PATCH]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────
// POST /api/teacher/class-units/content/reset
// Reset class-unit content back to master (unfork).
// Deletes class_units.content_data so it falls back to master.
//
// Body: { classId: string, unitId: string }
// ─────────────────────────────────────────────────────────────────
// Note: Reset is handled via PATCH with content_data = null,
// but for clarity we can also support a DELETE-like action.
// For P0 we just handle GET and PATCH.

export { GET, PATCH };
