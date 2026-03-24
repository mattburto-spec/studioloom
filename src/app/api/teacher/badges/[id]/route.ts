import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUILT_IN_BADGES } from "@/lib/safety/badge-definitions";

function createSupabaseServer(request: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {},
      },
    }
  );
}

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
    const { id } = await params;
    const supabase = createSupabaseServer(request);

    // Verify teacher is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use admin client for read access
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("badges")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (data) {
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
    const { id } = await params;
    const supabase = createSupabaseServer(request);

    // Verify teacher is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
      console.error("[badges/[id]/PATCH] Fetch error:", error);
      return NextResponse.json({ error: "Failed to fetch badge" }, { status: 500 });
    }

    // Verify ownership (teacher must own the badge, or it's a service-role operation)
    if (existingBadge.created_by_teacher_id && existingBadge.created_by_teacher_id !== user.id) {
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
    const { id } = await params;
    const supabase = createSupabaseServer(request);

    // Verify teacher is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
      console.error("[badges/[id]/DELETE] Fetch error:", error);
      return NextResponse.json({ error: "Failed to fetch badge" }, { status: 500 });
    }

    // Verify ownership
    if (existingBadge.created_by_teacher_id !== user.id) {
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
