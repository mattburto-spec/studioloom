// audit-skip: routine teacher pedagogy ops, low audit value
/**
 * POST /api/teacher/fabricators/[id]/reset-password
 *
 * Teacher-triggered password reset. Creates a new is_setup=true session,
 * deletes any prior setup sessions (one live invite per fabricator),
 * and emails a fresh set-password link.
 *
 * Distinct from the invite POST in that this assumes the fabricator row
 * already exists and is active — we only issue a new reset session.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createFabricatorSession,
  FAB_PRIVATE_CACHE_HEADERS,
} from "@/lib/fab/auth";
import { sendFabricationEmail } from "@/lib/preflight/email";
import { renderResetPasswordEmail } from "@/lib/preflight/email-templates";

async function getTeacherUser(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {},
      },
    }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: FAB_PRIVATE_CACHE_HEADERS });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getTeacherUser(request);
  if (!user) return privateJson({ error: "Unauthorized" }, 401);

  const admin = createAdminClient();

  const { data: fabricator } = await admin
    .from("fabricators")
    .select("id, email, display_name, is_active, invited_by_teacher_id")
    .eq("id", id)
    .maybeSingle();

  if (!fabricator || fabricator.invited_by_teacher_id !== user.id) {
    return privateJson({ error: "Not found" }, 404);
  }

  if (!fabricator.is_active) {
    return privateJson(
      { error: "Reactivate the fabricator before resetting their password." },
      400
    );
  }

  // Clear any existing setup sessions — one live invite at a time.
  await admin
    .from("fabricator_sessions")
    .delete()
    .eq("fabricator_id", id)
    .eq("is_setup", true);

  const session = await createFabricatorSession({
    fabricatorId: id,
    isSetup: true,
    supabase: admin,
  });

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    request.headers.get("origin") ||
    "https://studioloom.org";
  const setPasswordUrl = `${siteUrl.replace(/\/$/, "")}/fab/set-password?token=${encodeURIComponent(session.rawToken)}`;

  const emailResult = await sendFabricationEmail({
    jobId: null,
    kind: "set_password_reset",
    to: fabricator.email,
    subject: "Reset your Preflight password",
    html: renderResetPasswordEmail({
      setPasswordUrl,
      displayName: fabricator.display_name,
    }),
    supabase: admin,
  });

  return privateJson({ ok: true, email: emailResult });
}
