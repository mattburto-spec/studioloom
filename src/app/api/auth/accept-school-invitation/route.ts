/**
 * POST /api/auth/accept-school-invitation
 *
 * Phase 4.7b-2 — invitee accepts a tokenized invitation. Authenticated
 * user only (the invitee must already be signed in to /teacher/login
 * with the same email as invited_email).
 *
 * Request body:
 *   { token: string }
 *
 * Response (200):
 *   {
 *     ok: true,
 *     school_id: string,
 *     role: 'lead_teacher' | 'co_teacher' | 'dept_head' | 'school_admin',
 *     previous_school_id: string | null   // their personal school's id, if any
 *   }
 *
 * Errors:
 *   400 — missing/invalid token
 *   401 — unauthenticated
 *   403 — email mismatch (token meant for someone else)
 *   404 — token not recognised
 *   409 — already accepted / revoked
 *   410 — expired
 *   500 — db_error
 *
 * Side effects:
 *   - Sets school_invitations.accepted_at + accepted_by_user_id
 *   - Updates teachers.school_id to the invited school
 *   - If invited_role is school_admin, inserts school_responsibilities row
 *   - Inserts audit_events row of type school_invitation.accepted
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { acceptInvitation } from "@/lib/access-v2/school/invitations";

export async function POST(request: NextRequest) {
  try {
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

    if (!user || !user.email) {
      return NextResponse.json(
        { error: "Unauthorized — sign in first" },
        {
          status: 401,
          headers: { "Cache-Control": "private, no-store" },
        }
      );
    }

    let body: { token?: unknown } = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token || token.length < 32 || token.length > 128) {
      return NextResponse.json(
        { error: "token must be a non-empty string between 32 and 128 chars" },
        { status: 400 }
      );
    }

    const result = await acceptInvitation({
      token,
      acceptingUserId: user.id,
      acceptingEmail: user.email,
    });

    if (!result.ok) {
      const statusMap: Record<typeof result.reason, number> = {
        token_not_found: 404,
        expired: 410,
        revoked: 409,
        already_accepted: 409,
        email_mismatch: 403,
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

    return NextResponse.json(
      {
        ok: true,
        school_id: result.schoolId,
        role: result.role,
        previous_school_id: result.previousSchoolId,
      },
      {
        status: 200,
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  } catch (err) {
    console.error("[accept-school-invitation POST] unexpected error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
