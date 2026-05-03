// audit-skip: routine teacher pedagogy ops, low audit value
/**
 * Teacher Badge Requirements Management
 *
 * GET /api/teacher/badges/unit-requirements?unitId=xxx
 *   Returns all badge requirements for a unit.
 *
 * POST /api/teacher/badges/unit-requirements
 *   Add a badge requirement to a unit.
 *   Body: { unitId, badgeId, isRequired }
 *
 * DELETE /api/teacher/badges/unit-requirements
 *   Remove a badge requirement from a unit.
 *   Body: { requirementId }
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import * as Sentry from "@sentry/nextjs";

async function getTeacherAuth(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return { user: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { user, error: null };
}

export async function GET(request: NextRequest) {
  const auth = await getTeacherAuth(request);
  if (auth.error) return auth.error;
  const user = auth.user!;

  try {
    const unitId = request.nextUrl.searchParams.get("unitId");
    if (!unitId) {
      return NextResponse.json(
        { error: "unitId query parameter required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Verify teacher owns the unit
    const { data: unit, error: unitError } = await supabase
      .from("units")
      .select("id, author_teacher_id")
      .eq("id", unitId)
      .single();

    if (unitError || !unit || unit.author_teacher_id !== user.id) {
      return NextResponse.json(
        { error: "Not found or unauthorized" },
        { status: 404 }
      );
    }

    // Fetch requirements
    const { data: requirements, error: reqError } = await supabase
      .from("unit_badge_requirements")
      .select(
        `
        id,
        is_required,
        badges (
          id,
          name,
          slug
        )
      `
      )
      .eq("unit_id", unitId);

    if (reqError) {
      Sentry.captureException(reqError);
      return NextResponse.json(
        { error: "Failed to fetch requirements" },
        { status: 500 }
      );
    }

    return NextResponse.json({ requirements: requirements || [] });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await getTeacherAuth(request);
  if (auth.error) return auth.error;
  const user = auth.user!;

  try {
    const { unitId, badgeId, isRequired } = await request.json();

    if (!unitId || !badgeId) {
      return NextResponse.json(
        { error: "unitId and badgeId required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Verify teacher owns the unit
    const { data: unit, error: unitError } = await supabase
      .from("units")
      .select("id, author_teacher_id")
      .eq("id", unitId)
      .single();

    if (unitError || !unit || unit.author_teacher_id !== user.id) {
      return NextResponse.json(
        { error: "Not found or unauthorized" },
        { status: 404 }
      );
    }

    // Add requirement
    const { data, error } = await supabase
      .from("unit_badge_requirements")
      .insert({
        unit_id: unitId,
        badge_id: badgeId,
        is_required: isRequired ?? true,
      })
      .select();

    if (error) {
      Sentry.captureException(error);
      return NextResponse.json(
        { error: "Failed to create requirement" },
        { status: 500 }
      );
    }

    return NextResponse.json({ requirement: data?.[0] }, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await getTeacherAuth(request);
  if (auth.error) return auth.error;
  const user = auth.user!;

  try {
    const { requirementId } = await request.json();

    if (!requirementId) {
      return NextResponse.json(
        { error: "requirementId required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Get the requirement to verify ownership
    const { data: requirement, error: reqError } = await supabase
      .from("unit_badge_requirements")
      .select("id, unit_id, units(id, author_teacher_id)")
      .eq("id", requirementId)
      .single();

    if (reqError || !requirement) {
      return NextResponse.json(
        { error: "Requirement not found" },
        { status: 404 }
      );
    }

    const unitAuthor = (requirement.units as any)?.author_teacher_id;
    if (unitAuthor !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Delete requirement
    const { error } = await supabase
      .from("unit_badge_requirements")
      .delete()
      .eq("id", requirementId);

    if (error) {
      Sentry.captureException(error);
      return NextResponse.json(
        { error: "Failed to delete requirement" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
