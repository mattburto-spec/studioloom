/**
 * Teacher authorization helper for `/api/teacher/*` routes.
 *
 * Closes P-1 of docs/security/security-plan.md. Pre-fix, ~50+ teacher routes
 * called `auth.getUser()` directly with only `if (!user) 401` and no role
 * check. Middleware Phase 6.3b only matches PAGE routes (`/teacher/*`) — its
 * config matcher does not cover `/api/*`. So a logged-in *student* JWT
 * (acquired via classcode-login) could call e.g. `POST /api/teacher/ai-settings`
 * and read the teacher's BYOK Anthropic key.
 *
 * This helper is the canonical authorization gate for any route that
 * requires the caller be a teacher. It checks both the Supabase session AND
 * `app_metadata.user_type === "teacher"` — the same field the middleware
 * uses for page-level enforcement.
 *
 * Usage:
 *   export async function POST(request: NextRequest) {
 *     const auth = await requireTeacher(request);
 *     if (auth.error) return auth.error;
 *     const { teacherId, email } = auth;
 *     ...
 *   }
 *
 * Compatibility: drop-in replacement for the bare-`auth.getUser()` pattern.
 * Returns 401 for unauthenticated, 403 for wrong role.
 *
 * NOTE: this is the AUTHENTICATION + ROLE gate. For per-resource
 * authorization (does this teacher own this class? this unit?), use the
 * `verifyTeacherCanManageStudent` / `verifyTeacherOwnsClass` /
 * `verifyTeacherHasUnit` helpers, OR the `can()` permission helper from
 * `@/lib/access-v2/can`. They run AFTER this gate — order matters.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

const UNAUTH = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const FORBIDDEN_WRONG_ROLE = NextResponse.json(
  { error: "Forbidden — teacher session required" },
  { status: 403 },
);

export type RequireTeacherResult =
  | { teacherId: string; email: string; error?: never }
  | { teacherId?: never; email?: never; error: NextResponse };

/**
 * API-route helper. Returns either `{ teacherId, email }` or
 * `{ error: NextResponse }`.
 */
export async function requireTeacher(
  request: NextRequest,
): Promise<RequireTeacherResult> {
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
          // API route — no-op. Cookies can't be set here anyway.
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
  // The middleware Phase-6.3b convention: user_type ∈ {"teacher", "student"}.
  // Anything else (undefined, "anon", future-added roles) is rejected.
  if (userType !== "teacher") return { error: FORBIDDEN_WRONG_ROLE };

  return { teacherId: user.id, email: user.email || "" };
}
