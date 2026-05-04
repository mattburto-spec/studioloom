// audit-skip: auth-establishment endpoint; no actor identity until session minted
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/auth/lti/launch — TEMPORARILY DISABLED (Phase 6.1, 4 May 2026)
 *
 * The legacy LTI launch flow created a `student_sessions` row + custom
 * `questerra_student_session` cookie. Phase 6.1 dropped that table.
 *
 * To reinstate LTI 1.1 launch, this route must be rewritten to mint a
 * Supabase Auth session for the student — same pattern as
 * /api/auth/student-classcode-login (verify LTI signature → ensure
 * auth.users + students rows via provisionStudentAuthUser → call
 * supabaseAdmin.auth.admin.generateLink({type:'magiclink'}) →
 * exchangeCodeForSession on the SSR client to set sb-* cookies →
 * redirect to /dashboard).
 *
 * Tracked: FU-AV2-LTI-PHASE-6-REWORK P2.
 *
 * Returning 410 Gone (not 503) signals the route is intentionally
 * unavailable and the caller (LMS) should not retry. NIS pilot does not
 * use LTI; reinstating before the next school adopts.
 */
export async function POST(_request: NextRequest) {
  return NextResponse.json(
    {
      error: "LTI launch temporarily unavailable",
      detail:
        "Pending rewrite to Supabase Auth (Phase 6.1 deprecated the legacy student session table). See FU-AV2-LTI-PHASE-6-REWORK.",
    },
    {
      status: 410,
      headers: { "Cache-Control": "no-store, private" },
    }
  );
}
