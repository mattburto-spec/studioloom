/**
 * Student authorization helper for `/api/student/*` mutation routes.
 *
 * Companion to `requireTeacher` (security-plan.md P-1). Resolves the
 * Supabase Auth user, verifies `user_type === "student"`, and returns the
 * canonical `students.id` (NOT `auth.uid()`) — most student tables FK to
 * `students.id`, not to `auth.users.id`.
 *
 * Usage:
 *   export async function POST(request: NextRequest) {
 *     const auth = await requireStudent(request);
 *     if (auth.error) return auth.error;
 *     const { studentId, userId } = auth;
 *     ...
 *   }
 *
 * NOTE: post-Phase-6.1 (4 May 2026) students lazy-provision a `students`
 * row with `students.user_id = auth.uid()` on first classcode-login.
 * If the row is missing (a student that signed up before lazy-provision
 * shipped) the helper returns 401 — they need to log in again to trigger
 * lazy-provision.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";

const UNAUTH = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const FORBIDDEN_WRONG_ROLE = NextResponse.json(
  { error: "Forbidden — student session required" },
  { status: 403 },
);

export type RequireStudentResult =
  | { studentId: string; userId: string; error?: never }
  | { studentId?: never; userId?: never; error: NextResponse };

export async function requireStudent(
  request: NextRequest,
): Promise<RequireStudentResult> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          _cookies: { name: string; value: string; options?: CookieOptions }[],
        ) {
          // API route — no-op.
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: UNAUTH };

  const userType = (user.app_metadata as Record<string, unknown> | undefined)
    ?.user_type;
  if (userType !== "student") return { error: FORBIDDEN_WRONG_ROLE };

  // Resolve students.id from auth.uid via admin client (RLS-bypass needed
  // because the requesting JWT can't read its own students row before this
  // helper has confirmed the role).
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("students")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) {
    // No lazy-provisioned row — treat as unauthenticated; they need to
    // re-login via classcode to trigger lazy-provision.
    return { error: UNAUTH };
  }

  return { studentId: (data as { id: string }).id, userId: user.id };
}
