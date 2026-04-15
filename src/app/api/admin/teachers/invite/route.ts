/**
 * POST /api/admin/teachers/invite
 *
 * Admin-only endpoint to invite a new teacher by email.
 * Uses Supabase Auth admin API (inviteUserByEmail) which emails the teacher
 * a magic link to set their password and complete signup.
 *
 * The existing `handle_new_teacher` trigger (migration 002) auto-creates
 * the `teachers` row when the auth.users row lands, so no manual insert here.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  let body: { email?: string; name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const name = body.name?.trim() || null;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email address required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Guard: is this email already a teacher?
  const { data: existing } = await supabase
    .from("teachers")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "A teacher with this email already exists." },
      { status: 409 }
    );
  }

  // Determine redirect target — the link in the invite email will bring
  // the teacher to this URL after they set their password.
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    request.headers.get("origin") ||
    "https://studioloom.org";
  const redirectTo = `${siteUrl.replace(/\/$/, "")}/teacher/dashboard`;

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: name ? { name } : undefined,
    redirectTo,
  });

  if (error) {
    // Common cases: "User already registered" when auth.users exists but teachers row doesn't
    const status = /already/i.test(error.message) ? 409 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({
    ok: true,
    invited: {
      id: data.user?.id,
      email: data.user?.email,
    },
  });
}
