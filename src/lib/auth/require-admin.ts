/**
 * Admin authorization helper.
 *
 * Gates /admin pages and /api/admin/* routes to users flagged is_admin=true
 * on the teachers table. Falls back to the ADMIN_EMAILS env var so we can't
 * lock ourselves out during rollout or if the DB column is missing (e.g.
 * migration 091 not yet applied).
 *
 * Usage (API route):
 *   export async function GET(request: NextRequest) {
 *     const auth = await requireAdmin(request);
 *     if (auth.error) return auth.error;
 *     // auth.teacherId, auth.email are now trusted
 *     ...
 *   }
 *
 * Usage (middleware): use the lower-level isAdminUser() since middleware
 * already has a Supabase client.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// Bootstrap fallback — ADMIN_EMAILS env var
// ---------------------------------------------------------------------------

const ADMIN_EMAILS_FALLBACK = (process.env.ADMIN_EMAILS || "mattburto@gmail.com")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function isAllowlistedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS_FALLBACK.includes(email.toLowerCase());
}

// ---------------------------------------------------------------------------
// DB check — is the given teacher flagged as admin?
// ---------------------------------------------------------------------------

/**
 * Returns true if the teacher row has is_admin=true, OR if the user's email
 * is in the ADMIN_EMAILS allowlist. Handles the case where the is_admin
 * column doesn't exist yet (migration 091 not applied) by falling back to
 * the email allowlist.
 */
export async function isAdminUser(
  userId: string,
  email: string | null | undefined
): Promise<boolean> {
  // Fast path: email allowlist (works even if migration 091 isn't applied)
  if (isAllowlistedEmail(email)) return true;

  // DB check: teachers.is_admin
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("teachers")
      .select("is_admin")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      // Column doesn't exist (migration 091 not applied) — fail closed unless
      // email allowlist already matched above.
      if (
        error.code === "42703" ||
        error.code === "PGRST204" ||
        error.message?.includes("is_admin")
      ) {
        return false;
      }
      console.warn("[require-admin] DB lookup failed:", error.message);
      return false;
    }

    return !!(data as { is_admin?: boolean } | null)?.is_admin;
  } catch (err) {
    console.warn("[require-admin] unexpected error:", err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// API route helper — requireAdmin()
// ---------------------------------------------------------------------------

export type RequireAdminResult =
  | { teacherId: string; email: string; error?: never }
  | { teacherId?: never; email?: never; error: NextResponse };

/**
 * Use at the top of any /api/admin/* route handler.
 * Returns an error response if the caller isn't an admin.
 */
export async function requireAdmin(
  request: NextRequest
): Promise<RequireAdminResult> {
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
          // API route — no-op. Cookies can't be set here anyway.
        },
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

  const isAdmin = await isAdminUser(user.id, user.email);
  if (!isAdmin) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { teacherId: user.id, email: user.email || "" };
}
