// audit-skip: notification read/dismiss is recipient-side state, not an
// audit-worthy mutation. The underlying classification (e.g.,
// integrity.flag_auto_created) was already audited at fire-time by the
// dispatcher (Phase 3B). Marking your own notification as read or
// dismissed has the same audit value as opening an unread email.

/**
 * PATCH /api/teacher/notifications/[id] — mark read or dismiss.
 *
 * Phase 3C of Notifications. Only mutation operations are read/dismiss —
 * payload + content are immutable from the recipient's side (server-only).
 *
 * Auth: requireTeacherAuth + RLS notifications_recipient_update_own_state
 * policy enforces "you can only update your own row's timestamps."
 *
 * Body:
 *   { action: "mark_read" | "dismiss" }
 *
 * Response: { notification: Notification } (post-update row).
 *
 * No DELETE — dismissal is soft (sets dismissed_at). Phase 3D's retention
 * cron will hard-delete past expires_at.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const VALID_ACTIONS = ["mark_read", "dismiss"] as const;
type Action = (typeof VALID_ACTIONS)[number];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireTeacherAuth(request);
    if (auth.error) return auth.error;

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
    };
    if (
      !body.action ||
      !(VALID_ACTIONS as readonly string[]).includes(body.action)
    ) {
      return NextResponse.json(
        { error: `action must be one of: ${VALID_ACTIONS.join(", ")}` },
        { status: 400 },
      );
    }
    const action = body.action as Action;

    const db = await createServerSupabaseClient();
    const now = new Date().toISOString();

    const update =
      action === "mark_read" ? { read_at: now } : { dismissed_at: now };

    const { data, error } = await db
      .from("notifications")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      // RLS denial returns PGRST116 (no rows) — surface as 404 not 500.
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "not found or not yours" },
          { status: 404 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ notification: data });
  } catch (err) {
    console.error("[teacher/notifications/[id]:PATCH]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
