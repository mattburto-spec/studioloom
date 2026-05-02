/**
 * POST /api/school/[id]/invitations/[inviteId]/revoke
 *
 * Phase 4.7b-2 — school_admin (or platform admin) revokes a pending
 * invitation. Terminal state. Audit-logged.
 *
 * Auth: school_admin of [id] OR platform_admin.
 *
 * Status mapping:
 *   200 — revoked
 *   400 — invalid id
 *   401 — unauthenticated
 *   403 — not authorized
 *   404 — invitation not found OR not in this school
 *   409 — already accepted / already revoked
 *   500 — db_error
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { revokeInvitation } from "@/lib/access-v2/school/invitations";
import { isPlatformAdmin } from "@/lib/auth/require-platform-admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteContext = {
  params: Promise<{ id: string; inviteId: string }>;
};

export async function POST(request: NextRequest, ctx: RouteContext) {
  try {
    const { id: schoolId, inviteId } = await ctx.params;
    if (!UUID_RE.test(schoolId) || !UUID_RE.test(inviteId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    // Auth: platform admin OR school_admin of this school
    const platformAdmin = await isPlatformAdmin(user.id);
    let allowed = platformAdmin;
    if (!allowed) {
      const { data } = await admin.rpc("is_school_admin", {
        p_user_id: user.id,
        p_school_id: schoolId,
      });
      allowed = data === true;
    }
    if (!allowed) {
      return NextResponse.json(
        { error: "Forbidden — school_admin or platform admin required" },
        { status: 403 }
      );
    }

    // Verify invitation belongs to this school (don't leak existence
    // across schools)
    const { data: existing } = await admin
      .from("school_invitations")
      .select("id")
      .eq("id", inviteId)
      .eq("school_id", schoolId)
      .maybeSingle();
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const result = await revokeInvitation({
      invitationId: inviteId,
      revokedByTeacherId: user.id,
    });

    if (!result.ok) {
      const statusMap: Record<typeof result.reason, number> = {
        not_found: 404,
        already_terminal: 409,
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

    // Audit row
    await admin.from("audit_events").insert({
      actor_id: user.id,
      actor_type: "teacher",
      action: "school_invitation.revoked",
      target_table: "school_invitations",
      target_id: inviteId,
      school_id: schoolId,
      severity: "info",
      payload_jsonb: {
        invitation_id: inviteId,
        revoked_by: user.id,
        revoke_via: platformAdmin ? "platform_admin" : "school_admin",
      },
    });

    return NextResponse.json(
      { ok: true, invitation_id: inviteId },
      {
        status: 200,
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  } catch (err) {
    console.error("[invitations/revoke POST] unexpected error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
