/**
 * GET /api/school/[id]
 *
 * Phase 4.4a — same-school teacher reads the school's settings + recent
 * governance activity. Powers the /school/[id]/settings page.
 *
 * Response shape:
 *   {
 *     school: {
 *       id, name, city, country, region, timezone, default_locale,
 *       status, subscription_tier, allowed_auth_modes,
 *       bootstrap_expires_at, parent_school_id, merged_into_id,
 *       // Phase 4.8 columns may be NULL until applied:
 *       academic_calendar_jsonb, timetable_skeleton_jsonb,
 *       frameworks_in_use_jsonb, default_grading_scale,
 *       notification_branding_jsonb, safeguarding_contacts_jsonb,
 *       content_sharing_default, default_student_ai_budget
 *     },
 *     teacherCount: number,
 *     pendingProposals: SchoolSettingChange[],
 *     recentChanges: SchoolSettingChange[]   // last 30 days, applied/reverted
 *   }
 *
 * Cross-school requests return 404 (don't leak existence).
 * Archived schools return read_only: true in the response so the page
 * can render a banner — does NOT 403 (we want historical access, per
 * §3.9 item 16).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { enforceArchivedReadOnly } from "@/lib/access-v2/school/archived-guard";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteContext = { params: Promise<{ id: string }> };

async function authenticateTeacher(
  request: NextRequest
): Promise<
  | { teacherId: string; schoolId: string | null; isPlatformAdmin: boolean }
  | { error: NextResponse }
> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {},
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const admin = createAdminClient();
  const [{ data: teacher }, { data: profile }] = await Promise.all([
    admin
      .from("teachers")
      .select("school_id")
      .eq("id", user.id)
      .maybeSingle(),
    admin
      .from("user_profiles")
      .select("is_platform_admin")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  return {
    teacherId: user.id,
    schoolId: teacher?.school_id ?? null,
    isPlatformAdmin: profile?.is_platform_admin === true,
  };
}

export async function GET(request: NextRequest, ctx: RouteContext) {
  try {
    const auth = await authenticateTeacher(request);
    if ("error" in auth) return auth.error;

    const { id: schoolId } = await ctx.params;

    if (!UUID_RE.test(schoolId)) {
      return NextResponse.json({ error: "Invalid school id" }, { status: 400 });
    }

    // Cross-school read returns 404 (don't leak existence). Platform admins
    // bypass — they can view any school via this endpoint (the dedicated
    // /admin/school/[id] view in §4.7 will be the canonical super-admin
    // surface, but this route honors the flag too).
    if (auth.schoolId !== schoolId && !auth.isPlatformAdmin) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const admin = createAdminClient();

    // Archived guard — preserves access for archived schools, surfaces
    // read_only flag so the page renders a banner.
    const guard = await enforceArchivedReadOnly(schoolId, admin);
    if (guard.readOnly && guard.reason === "school_not_found") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Pull the school row + counts + recent governance activity in parallel.
    // We select all columns explicitly so future Phase 4.8 additions land
    // here intentionally (avoid SELECT * for forward-compat surprises).
    const [
      schoolResult,
      teacherCountResult,
      pendingResult,
      recentResult,
    ] = await Promise.all([
      admin
        .from("schools")
        .select(
          [
            "id",
            "name",
            "city",
            "country",
            "region",
            "timezone",
            "default_locale",
            "status",
            "subscription_tier",
            "allowed_auth_modes",
            "bootstrap_expires_at",
            "parent_school_id",
          ].join(", ")
        )
        .eq("id", schoolId)
        .maybeSingle(),

      admin
        .from("teachers")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .is("deleted_at", null),

      // Pending high-stakes proposals — ordered oldest first so the
      // urgency banner can prioritize the closest-to-expiring.
      admin
        .from("school_setting_changes")
        .select(
          "id, change_type, tier, payload_jsonb, status, expires_at, actor_user_id, created_at"
        )
        .eq("school_id", schoolId)
        .eq("status", "pending")
        .order("expires_at", { ascending: true })
        .limit(20),

      // Recent applied / reverted changes (30-day window) — ordered
      // most-recent first for the activity feed.
      admin
        .from("school_setting_changes")
        .select(
          "id, change_type, tier, payload_jsonb, status, applied_at, reverted_at, actor_user_id, confirmed_by_user_id, reverted_by_user_id, created_at"
        )
        .eq("school_id", schoolId)
        .in("status", ["applied", "reverted", "expired"])
        .gte(
          "created_at",
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        )
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    if (schoolResult.error || !schoolResult.data) {
      return NextResponse.json(
        { error: "School not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        school: schoolResult.data,
        teacherCount: teacherCountResult.count ?? 0,
        pendingProposals: pendingResult.data ?? [],
        recentChanges: recentResult.data ?? [],
        readOnly: guard.readOnly,
        readOnlyReason: guard.readOnly ? guard.reason : undefined,
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (err) {
    console.error("[school/:id GET] unexpected error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
