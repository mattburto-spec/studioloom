// audit-skip: school-scoped operation; audit covered by school_settings_history (mig 087)
/**
 * POST /api/school/[id]/invitations  — create an invitation
 * GET  /api/school/[id]/invitations  — list invitations for the school
 *
 * Phase 4.7b-2 — school_admin (or platform admin) creates an invite for
 * a teacher to join the school. Tokenized; 14-day default expiry.
 *
 * Auth: school_admin of [id] OR platform_admin.
 *
 * POST body:
 *   {
 *     invited_email: string,         // required, syntactically valid email
 *     invited_role?: 'lead_teacher' | 'co_teacher' | 'dept_head' | 'school_admin',
 *                                     // default 'lead_teacher'
 *     expires_at_ms?: number          // override default 14d expiry
 *   }
 *
 * POST response (201):
 *   {
 *     invitation_id: string,
 *     accept_url: string,             // /accept-invite?token=...
 *     expires_at_ms: number
 *   }
 *
 * GET response:
 *   { invitations: [...] }   // ordered created_at DESC
 *
 * Spec: docs/projects/access-model-v2-phase-4-brief.md §4.7b-2.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createInvitation,
  isValidInvitedRole,
  type InvitedRole,
} from "@/lib/access-v2/school/invitations";
import { isPlatformAdmin } from "@/lib/auth/require-platform-admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteContext = { params: Promise<{ id: string }> };

async function authenticateAdminFor(
  request: NextRequest,
  schoolId: string
): Promise<
  | { teacherId: string; isPlatform: boolean }
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

  // Platform admin always allowed
  if (await isPlatformAdmin(user.id)) {
    return { teacherId: user.id, isPlatform: true };
  }

  // school_admin check
  const admin = createAdminClient();
  const { data: isAdmin } = await admin.rpc("is_school_admin", {
    p_user_id: user.id,
    p_school_id: schoolId,
  });
  if (isAdmin === true) {
    return { teacherId: user.id, isPlatform: false };
  }

  return {
    error: NextResponse.json(
      { error: "Forbidden — school_admin or platform admin required" },
      { status: 403 }
    ),
  };
}

export async function POST(request: NextRequest, ctx: RouteContext) {
  try {
    const { id: schoolId } = await ctx.params;
    if (!UUID_RE.test(schoolId)) {
      return NextResponse.json({ error: "Invalid school id" }, { status: 400 });
    }

    const auth = await authenticateAdminFor(request, schoolId);
    if ("error" in auth) return auth.error;

    let body: {
      invited_email?: unknown;
      invited_role?: unknown;
      expires_at_ms?: unknown;
    } = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (typeof body.invited_email !== "string") {
      return NextResponse.json(
        { error: "invited_email is required" },
        { status: 400 }
      );
    }
    const invitedRole: InvitedRole = isValidInvitedRole(body.invited_role)
      ? body.invited_role
      : "lead_teacher";

    let expiresAt: Date | undefined;
    if (typeof body.expires_at_ms === "number") {
      const ms = body.expires_at_ms;
      if (ms < Date.now() || ms > Date.now() + 90 * 24 * 60 * 60 * 1000) {
        return NextResponse.json(
          { error: "expires_at_ms must be in the future, max 90 days out" },
          { status: 400 }
        );
      }
      expiresAt = new Date(ms);
    }

    const result = await createInvitation({
      schoolId,
      invitedEmail: body.invited_email,
      invitedRole,
      invitedByTeacherId: auth.teacherId,
      expiresAt,
    });

    if (!result.ok) {
      const statusMap: Record<typeof result.reason, number> = {
        invalid_email: 400,
        invalid_role: 400,
        duplicate_active: 409,
        school_not_found: 404,
        school_not_invitable: 422,
        db_error: 500,
      };
      return NextResponse.json(
        { ok: false, reason: result.reason, message: result.message },
        {
          status: statusMap[result.reason] ?? 500,
          headers: { "Cache-Control": "private, no-store" },
        }
      );
    }

    const acceptUrl = `/accept-invite?token=${encodeURIComponent(result.token)}`;

    return NextResponse.json(
      {
        ok: true,
        invitation_id: result.invitationId,
        accept_url: acceptUrl,
        expires_at_ms: result.expiresAt.getTime(),
      },
      {
        status: 201,
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  } catch (err) {
    console.error("[invitations POST] unexpected error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest, ctx: RouteContext) {
  try {
    const { id: schoolId } = await ctx.params;
    if (!UUID_RE.test(schoolId)) {
      return NextResponse.json({ error: "Invalid school id" }, { status: 400 });
    }

    const auth = await authenticateAdminFor(request, schoolId);
    if ("error" in auth) return auth.error;

    const supabase = createAdminClient();
    const { data: rows, error } = await supabase
      .from("school_invitations")
      .select(
        "id, school_id, invited_email, invited_role, invited_by, created_at, expires_at, accepted_at, accepted_by_user_id, revoked_at, revoked_by"
      )
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[invitations GET] db error:", error);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    return NextResponse.json(
      { invitations: rows ?? [] },
      {
        status: 200,
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  } catch (err) {
    console.error("[invitations GET] unexpected error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
