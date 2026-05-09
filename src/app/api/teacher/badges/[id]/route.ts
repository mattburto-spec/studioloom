// audit-skip: routine teacher pedagogy ops, low audit value
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUILT_IN_BADGES } from "@/lib/safety/badge-definitions";
import { requireTeacher } from "@/lib/auth/require-teacher";

/**
 * GET /api/teacher/badges/[id]
 *
 * Get a single badge by id with full details.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireTeacher(request);
    if (auth.error) return auth.error;

    const { id } = await params;

    // Use admin client for read access
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("badges")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (data) {
      // Normalize JSONB fields — ensure arrays
      if (typeof data.question_pool === "string") {
        try { data.question_pool = JSON.parse(data.question_pool); } catch { data.question_pool = []; }
      }
      if (!Array.isArray(data.question_pool)) data.question_pool = [];
      if (typeof data.learn_content === "string") {
        try { data.learn_content = JSON.parse(data.learn_content); } catch { data.learn_content = []; }
      }
      if (!Array.isArray(data.learn_content)) data.learn_content = [];
      return NextResponse.json({ badge: data });
    }

    // Fallback: try BUILT_IN_BADGES constant (badge may not be seeded to DB yet)
    const builtIn = BUILT_IN_BADGES.find(b => b.id === id || b.slug === id);
    if (builtIn) {
      return NextResponse.json({
        badge: {
          id: builtIn.id,
          slug: builtIn.slug,
          name: builtIn.name,
          description: builtIn.description,
          category: builtIn.category || "safety",
          tier: builtIn.tier,
          icon_name: builtIn.icon_name,
          color: builtIn.color,
          is_built_in: true,
          pass_threshold: builtIn.pass_threshold,
          expiry_months: builtIn.expiry_months || null,
          retake_cooldown_minutes: builtIn.retake_cooldown_minutes,
          question_count: builtIn.question_count,
          question_pool: builtIn.question_pool,
          learn_content: builtIn.learn_content,
        },
      });
    }

    if (error) {
      console.error("[badges/[id]/GET] Query error:", error);
      return NextResponse.json({ error: "Failed to fetch badge" }, { status: 500 });
    }

    return NextResponse.json({ error: "Badge not found" }, { status: 404 });
  } catch (error) {
    console.error("[badges/[id]/GET] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/teacher/badges/[id]
 *
 * Update a badge (only if teacher owns it or via service role).
 * Accepts partial updates to any fields.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireTeacher(request);
    if (auth.error) return auth.error;
    const { teacherId } = auth;

    const { id } = await params;

    const body = await request.json();

    // Use admin client for write access
    const admin = createAdminClient();

    // First, check if badge exists and if teacher owns it
    const { data: existingBadge, error: fetchError } = await admin
      .from("badges")
      .select("created_by_teacher_id, is_built_in")
      .eq("id", id)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        return NextResponse.json({ error: "Badge not found" }, { status: 404 });
      }
      console.error("[badges/[id]/PATCH] Fetch error:", fetchError);
      return NextResponse.json({ error: "Failed to fetch badge" }, { status: 500 });
    }

    // Verify ownership (teacher must own the badge, or it's a service-role operation)
    if (existingBadge.created_by_teacher_id && existingBadge.created_by_teacher_id !== teacherId) {
      return NextResponse.json(
        { error: "Forbidden: You do not own this badge" },
        { status: 403 }
      );
    }

    // Update the badge
    const { data, error } = await admin
      .from("badges")
      .update(body)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[badges/[id]/PATCH] Update error:", error);
      return NextResponse.json({ error: "Failed to update badge" }, { status: 500 });
    }

    return NextResponse.json({ badge: data });
  } catch (error) {
    console.error("[badges/[id]/PATCH] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/teacher/badges/[id]
 *
 * Delete a badge (only if teacher owns it and it's not built-in).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireTeacher(request);
    if (auth.error) return auth.error;
    const { teacherId } = auth;

    const { id } = await params;

    // Use admin client for write access
    const admin = createAdminClient();

    // First, check if badge exists and if teacher owns it
    const { data: existingBadge, error: fetchError } = await admin
      .from("badges")
      .select("created_by_teacher_id, is_built_in")
      .eq("id", id)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        return NextResponse.json({ error: "Badge not found" }, { status: 404 });
      }
      console.error("[badges/[id]/DELETE] Fetch error:", fetchError);
      return NextResponse.json({ error: "Failed to fetch badge" }, { status: 500 });
    }

    // Verify ownership
    if (existingBadge.created_by_teacher_id !== teacherId) {
      return NextResponse.json(
        { error: "Forbidden: You do not own this badge" },
        { status: 403 }
      );
    }

    // Verify it's not a built-in badge
    if (existingBadge.is_built_in) {
      return NextResponse.json(
        { error: "Cannot delete built-in badges" },
        { status: 400 }
      );
    }

    // Delete the badge
    const { error } = await admin
      .from("badges")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[badges/[id]/DELETE] Delete error:", error);
      return NextResponse.json({ error: "Failed to delete badge" }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[badges/[id]/DELETE] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
