/**
 * Platform-admin authorization helper — Phase 4.7.
 *
 * Gates the super-admin surface (`/admin/school/[id]` + view-as URL) to
 * users flagged `is_platform_admin = true` on `user_profiles`. Distinct
 * from `requireAdmin()` (which gates general admin via `teachers.is_admin`):
 *
 *   - `requireAdmin`  → /admin/teachers, /admin/library, etc. (general)
 *   - `requirePlatformAdmin` → /admin/school/[id], view-as (Matt only today)
 *
 * Per Decision 8 (master spec line 336) + Three-Matts consolidation
 * (Phase 4.3.z, 2 May 2026): `is_platform_admin = true` lives on
 * `mattburto@gmail.com` (Gmail-Matt), NOT on `mattburton@nanjing-school.com`
 * (NIS-Matt). This separation keeps the platform-admin view fully decoupled
 * from any teaching account.
 *
 * Pattern matches `requireAdmin` exactly (return-shape, error-shape) so
 * routes can swap one for the other without re-wiring.
 *
 * Usage (API route):
 *
 *   export async function GET(request: NextRequest) {
 *     const auth = await requirePlatformAdmin(request);
 *     if (auth.error) return auth.error;
 *     // auth.userId, auth.email are now trusted as platform admin
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";

export async function isPlatformAdmin(userId: string): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("user_profiles")
      .select("is_platform_admin")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      console.warn("[require-platform-admin] DB lookup failed:", error.message);
      return false;
    }
    return data?.is_platform_admin === true;
  } catch (err) {
    console.warn("[require-platform-admin] unexpected error:", err);
    return false;
  }
}

export type RequirePlatformAdminResult =
  | { userId: string; email: string; error?: never }
  | { userId?: never; email?: never; error: NextResponse };

export async function requirePlatformAdmin(
  request: NextRequest
): Promise<RequirePlatformAdminResult> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          _cookies: { name: string; value: string; options?: CookieOptions }[]
        ) {
          // No-op for API routes
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json(
        { error: "Unauthorized" },
        {
          status: 401,
          headers: { "Cache-Control": "private, no-store" },
        }
      ),
    };
  }

  const allowed = await isPlatformAdmin(user.id);
  if (!allowed) {
    return {
      error: NextResponse.json(
        { error: "Forbidden — platform admin only" },
        {
          status: 403,
          headers: { "Cache-Control": "private, no-store" },
        }
      ),
    };
  }

  return { userId: user.id, email: user.email || "" };
}
