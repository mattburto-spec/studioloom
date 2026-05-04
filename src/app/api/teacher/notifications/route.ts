// audit-skip: read-only list of recipient's own notifications. No mutation,
// no audit emit needed. Per the audit-coverage scanner allowlist convention.

/**
 * GET /api/teacher/notifications — list current teacher's notifications.
 *
 * Phase 3C of Notifications. Read-only list endpoint backing the inbox at
 * /teacher/notifications and the bell-icon unread badge in TopNav.
 *
 * Auth: requireTeacherAuth (Supabase session). Uses RLS-respecting client
 * so the recipient_self_read policy enforces "you only see your own
 * notifications" — no app-layer recipient filter needed beyond the auth gate.
 *
 * Query params:
 *   unread=true   — only items with read_at IS NULL (default: all)
 *   limit         — page size, max 100, default 50
 *   offset        — pagination offset, default 0
 *
 * Response:
 *   { notifications: Notification[], unread_count: number, total: number }
 *
 * The unread_count is computed on every call (small enough — bell shows
 * one badge). For schools with thousands of pending notifications this
 * would need denormalisation; not a Phase 3C concern.
 */

import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api/error-handler";
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Notification } from "@/types/notifications";

export const GET = withErrorHandler(
  "teacher/notifications:GET",
  async (request: NextRequest) => {
    const auth = await requireTeacherAuth(request);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unread") === "true";
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);
    const offset = parseInt(searchParams.get("offset") ?? "0");

    const db = await createServerSupabaseClient();

    let listQuery = db
      .from("notifications")
      .select("*", { count: "exact" })
      .is("dismissed_at", null)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (unreadOnly) {
      listQuery = listQuery.is("read_at", null);
    }

    const { data, error, count } = await listQuery;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Separate count for the bell badge — undismissed AND unread.
    const { count: unreadCount } = await db
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("dismissed_at", null)
      .is("read_at", null);

    return NextResponse.json({
      notifications: (data ?? []) as Notification[],
      unread_count: unreadCount ?? 0,
      total: count ?? 0,
    });
  },
);
