/**
 * GET /api/admin/whoami
 *
 * Lightweight admin-gated endpoint used by /admin/login to verify a user
 * is actually admin BEFORE navigating to /admin. Prevents the "admin
 * dashboard flashes then bounces to login" UX when a non-admin teacher
 * signs in — we detect the non-admin state client-side and show an
 * inline error instead of doing a round-trip through /admin.
 *
 * Returns:
 *   200 { ok: true, email, teacherId }  — user is admin
 *   401                                  — no session
 *   403                                  — signed in but not admin
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  return NextResponse.json(
    { ok: true, email: auth.email, teacherId: auth.teacherId },
    { headers: { "Cache-Control": "no-store, private" } }
  );
}
