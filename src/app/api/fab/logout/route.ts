/**
 * POST /api/fab/logout
 *
 * Clears the Fabricator session cookie and deletes the backing row.
 * Idempotent — unknown tokens are no-ops.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { FAB_SESSION_COOKIE_NAME } from "@/lib/constants";
import {
  destroyFabricatorSession,
  FAB_PRIVATE_CACHE_HEADERS,
} from "@/lib/fab/auth";

export async function POST(request: NextRequest) {
  const rawToken = request.cookies.get(FAB_SESSION_COOKIE_NAME)?.value;
  if (rawToken) {
    const supabase = createAdminClient();
    await destroyFabricatorSession(rawToken, supabase);
  }

  const response = NextResponse.json(
    { ok: true },
    { status: 200, headers: FAB_PRIVATE_CACHE_HEADERS }
  );

  // Clear the cookie (browser-side).
  response.cookies.set(FAB_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
