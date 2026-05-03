// audit-skip: school-scoped operation; audit covered by school_settings_history (mig 087)
/**
 * POST /api/school/[id]/merge-requests
 *
 * Phase 4.5 — same-school teacher (or platform admin) proposes a school
 * merge. Lifecycle: pending → approved → completed (cascade ran) OR
 * rejected. Approval and rejection happen on the admin-side routes.
 *
 * Request body:
 *   {
 *     into_school_id: string;  // UUID of the surviving school
 *     reason: string;          // free-text rationale (required, non-empty)
 *   }
 *
 * Auth:
 *   - Authenticated teacher whose school_id matches [id] OR into_school_id
 *   - OR platform admin (is_platform_admin = true)
 *
 * Status mapping:
 *   201 — created (returns merge_id)
 *   400 — invalid payload
 *   401 — unauthenticated
 *   403 — not authorized (cross-school teacher without admin)
 *   404 — school not found
 *   409 — duplicate pending request OR same-school
 *   422 — archived school (read-only)
 *   500 — db_error
 *
 * Spec: docs/projects/access-model-v2-phase-4-brief.md §4.5.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { proposeMergeRequest } from "@/lib/access-v2/governance/school-merge";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_REASON_LENGTH = 1000;

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

export async function POST(request: NextRequest, ctx: RouteContext) {
  try {
    const auth = await authenticateTeacher(request);
    if ("error" in auth) return auth.error;

    const { id: fromSchoolId } = await ctx.params;
    if (!UUID_RE.test(fromSchoolId)) {
      return NextResponse.json({ error: "Invalid school id" }, { status: 400 });
    }

    let body: { into_school_id?: unknown; reason?: unknown } = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const intoSchoolId = body.into_school_id;
    const reason = body.reason;
    if (typeof intoSchoolId !== "string" || !UUID_RE.test(intoSchoolId)) {
      return NextResponse.json(
        { error: "into_school_id must be a UUID" },
        { status: 400 }
      );
    }
    if (typeof reason !== "string" || reason.trim().length === 0) {
      return NextResponse.json(
        { error: "reason is required" },
        { status: 400 }
      );
    }
    if (reason.length > MAX_REASON_LENGTH) {
      return NextResponse.json(
        { error: `reason must be ${MAX_REASON_LENGTH} chars or less` },
        { status: 400 }
      );
    }

    // Authorization check: teacher must be in fromSchool OR intoSchool, OR platform admin
    if (
      !auth.isPlatformAdmin &&
      auth.schoolId !== fromSchoolId &&
      auth.schoolId !== intoSchoolId
    ) {
      return NextResponse.json(
        { error: "Not authorized to propose this merge" },
        { status: 403 }
      );
    }

    const result = await proposeMergeRequest({
      fromSchoolId,
      intoSchoolId,
      requesterId: auth.teacherId,
      reason: reason.trim(),
    });

    if (!result.ok) {
      const statusMap: Record<typeof result.reason, number> = {
        same_school: 409,
        archived: 422,
        duplicate_pending: 409,
        not_authorized: 403,
        school_not_found: 404,
        db_error: 500,
      };
      return NextResponse.json(
        {
          ok: false,
          reason: result.reason,
          message: result.message,
        },
        {
          status: statusMap[result.reason] ?? 500,
          headers: { "Cache-Control": "private, no-store" },
        }
      );
    }

    return NextResponse.json(
      { ok: true, merge_id: result.mergeId },
      {
        status: 201,
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  } catch (err) {
    console.error("[merge-requests POST] unexpected error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
