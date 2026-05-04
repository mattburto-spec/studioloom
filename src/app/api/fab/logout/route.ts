// audit-skip: routine fab-tech operational endpoint, audit lives in fabrication pipeline state machine
/**
 * POST /api/fab/logout
 *
 * Clears the Fabricator session cookie + deletes the backing row,
 * then 303-redirects to /fab/login. Idempotent — unknown tokens
 * are no-ops.
 *
 * 4 May 2026: previously returned `{ok:true}` JSON. The fab queue's
 * logout button uses a native <form action="..." method="post">
 * (zero-JS path), so the browser navigated to the API URL on
 * submit and rendered the raw JSON. 303 See Other after a POST is
 * the standard PRG pattern — browser follows the redirect with
 * GET, lands on /fab/login, no raw JSON visible.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { FAB_SESSION_COOKIE_NAME } from "@/lib/constants";
import { destroyFabricatorSession } from "@/lib/fab/auth";

export async function POST(request: NextRequest) {
  const rawToken = request.cookies.get(FAB_SESSION_COOKIE_NAME)?.value;
  if (rawToken) {
    const supabase = createAdminClient();
    await destroyFabricatorSession(rawToken, supabase);
  }

  // 303 See Other = "POST succeeded, follow with GET to this URL".
  // Browser auto-follows; native form POST lands on /fab/login.
  const loginUrl = new URL("/fab/login", request.url);
  const response = NextResponse.redirect(loginUrl, { status: 303 });

  // Clear the cookie (browser-side). Match the same private-cache
  // headers as before so intermediaries don't cache the redirect.
  response.headers.set(
    "Cache-Control",
    "private, no-store, no-cache, must-revalidate"
  );
  response.cookies.set(FAB_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
