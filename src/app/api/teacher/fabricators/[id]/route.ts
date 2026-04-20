/**
 * PATCH /api/teacher/fabricators/[id]
 *
 * Currently supports one operation: toggle is_active.
 * Hard-delete is NOT exposed (D-INVITE-3 — deactivate only, preserves audit trail).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { FAB_PRIVATE_CACHE_HEADERS } from "@/lib/fab/auth";

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getTeacherUser(request);
  if (!user) return privateJson({ error: "Unauthorized" }, 401);

  let body: { is_active?: unknown };
  try {
    body = await request.json();
  } catch {
    return privateJson({ error: "Invalid JSON body" }, 400);
  }

  const admin = createAdminClient();

  // Ownership check — teacher can only modify fabricators they invited.
  const { data: fabricator } = await admin
    .from("fabricators")
    .select("id, invited_by_teacher_id")
    .eq("id", id)
    .maybeSingle();

  if (!fabricator || fabricator.invited_by_teacher_id !== user.id) {
    return privateJson({ error: "Not found" }, 404);
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.is_active === "boolean") {
    updates.is_active = body.is_active;
  }

  if (Object.keys(updates).length === 0) {
    return privateJson({ error: "No valid fields to update" }, 400);
  }

  const { error: updateError } = await admin
    .from("fabricators")
    .update(updates)
    .eq("id", id);

  if (updateError) {
    return privateJson({ error: `Update failed: ${updateError.message}` }, 500);
  }

  // On deactivation, also kill all active sessions so the Fabricator is
  // booted immediately, not on next expiry.
  if (updates.is_active === false) {
    await admin.from("fabricator_sessions").delete().eq("fabricator_id", id);
  }

  return privateJson({ ok: true });
}

export async function DELETE() {
  return privateJson(
    { error: "Hard-delete not supported. PATCH with is_active:false to deactivate." },
    405
  );
}
