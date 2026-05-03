import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireTeacherAuth,
  verifyTeacherHasUnit,
} from "@/lib/auth/verify-teacher-unit";
import { ensureForked, hasContent } from "@/lib/units/resolve-content";
import { trackEdits } from "@/lib/feedback/edit-tracker";
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

    // Phase 6.2 — gate via can()-backed shim. Replaces the
    // try-with-author-then-fallback dance (which silently leaked any
    // unit to any teacher when author_teacher_id check failed).
    const access = await verifyTeacherHasUnit(auth.teacherId, unitId);
    if (!access.hasAccess) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    const { data: unit } = await supabase
      .from("units")
      .select("id, content_data, thumbnail_url, title, current_version")
      .eq("id", unitId)
      .single();

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    // Fetch class framework (separate resilient query)
    let classFramework: string | null = null;
    const { data: classData } = await supabase
      .from("classes")
      .select("framework")
      .eq("id", classId)
      .maybeSingle();
    if (classData?.framework) {
      classFramework = classData.framework as string;
    }

    // Check for class-local fork — maybeSingle to handle missing row gracefully
    const { data: classUnit } = await supabase
      .from("class_units")
      .select("*")
      .eq("unit_id", unitId)
      .eq("class_id", classId)
      .maybeSingle();

    const isForked = hasContent(classUnit?.content_data);
    const content = isForked
      ? (classUnit!.content_data as UnitContentData)
      : (unit.content_data as UnitContentData);

    return NextResponse.json({
      content,
      isForked,
      forkedAt: classUnit?.forked_at || null,
      forkedFromVersion: classUnit?.forked_from_version || null,
      masterVersion: (unit as Record<string, unknown>).current_version ?? 1,
      thumbnailUrl: (unit as Record<string, unknown>).thumbnail_url || null,
      unitTitle: (unit as Record<string, unknown>).title || null,
      framework: classFramework || "IB_MYP",
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

    // Phase 6.2 — gate via can()-backed shim (replaces the silent
    // author_teacher_id leak path).
    const access = await verifyTeacherHasUnit(auth.teacherId, unitId);
    if (!access.hasAccess) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    // Ensure forked (if not already, this deep-copies master first)
    await ensureForked(supabase, unitId, classId);

    // Snapshot previous content for edit tracking
    let previousContent: UnitContentData | null = null;
    try {
      const { data: prev } = await supabase
        .from("class_units")
        .select("content_data")
        .eq("unit_id", unitId)
        .eq("class_id", classId)
        .maybeSingle();
      if (prev?.content_data) {
        previousContent = prev.content_data as UnitContentData;
      }
    } catch {
      // Non-critical — skip edit tracking if snapshot fails
    }

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

    // Fire-and-forget: track teacher edits for feedback loop
    if (previousContent) {
      trackEdits(supabase, unitId, unitId, previousContent as unknown as Record<string, unknown>, content_data as unknown as Record<string, unknown>).catch(
        (err) => console.error("[class-units/content PATCH] edit tracking error:", err)
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
// POST /api/teacher/class-units/content
// Reset class-unit content back to master (unfork).
// Sets content_data, forked_at, forked_from_version to NULL.
//
// Body: { classId: string, unitId: string }
// ─────────────────────────────────────────────────────────────────

async function POST(request: NextRequest) {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const { classId, unitId } = body as {
      classId: string;
      unitId: string;
    };

    if (!classId || !unitId) {
      return NextResponse.json(
        { error: "Missing classId or unitId" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Verify unit exists
    const { data: unit } = await supabase
      .from("units")
      .select("id")
      .eq("id", unitId)
      .single();

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    // Reset: set content_data, forked_at, forked_from_version to null
    const { error: updateErr } = await supabase
      .from("class_units")
      .update({
        content_data: null,
        forked_at: null,
        forked_from_version: null,
      })
      .eq("unit_id", unitId)
      .eq("class_id", classId);

    if (updateErr) {
      console.error("[class-units/content POST reset] error:", updateErr);
      return NextResponse.json(
        { error: "Failed to reset content" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, isForked: false });
  } catch (err) {
    console.error("[class-units/content POST reset]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export { GET, PATCH, POST };
