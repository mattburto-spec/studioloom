/**
 * GET /api/admin/teacher-requests — list access requests for the admin queue.
 * PATCH /api/admin/teacher-requests — update a request's status (invited / rejected).
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { logAuditEvent } from "@/lib/access-v2/audit-log";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "pending";

  try {
    let query = supabase
      .from("teacher_access_requests")
      .select("id, email, name, school, role, message, status, reviewed_at, rejection_reason, created_at")
      .order("created_at", { ascending: false });

    if (status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ requests: data || [] });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load requests" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  try {
    const body = await request.json();
    const { id, status, rejection_reason } = body as {
      id?: string;
      status?: "pending" | "invited" | "rejected";
      rejection_reason?: string;
    };

    if (!id || !status) {
      return NextResponse.json(
        { error: "id and status are required" },
        { status: 400 }
      );
    }

    if (!["pending", "invited", "rejected"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("teacher_access_requests")
      .update({
        status,
        rejection_reason: status === "rejected" ? rejection_reason || null : null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) throw error;

    // Phase 6.4 — high-value admin action: status transitions on
    // teacher_access_requests are gatekeeping decisions. soft-warn so the
    // admin UI doesn't 500 if audit insert blips; Sentry catches the gap.
    await logAuditEvent(supabase, {
      actorId: auth.teacherId,
      actorType: "platform_admin",
      action: `admin.teacher_request.${status}`,
      targetTable: "teacher_access_requests",
      targetId: id,
      severity: status === "rejected" ? "warn" : "info",
      payload: {
        newStatus: status,
        ...(status === "rejected" && rejection_reason ? { rejectionReason: rejection_reason } : {}),
      },
      ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: request.headers.get("user-agent"),
      failureMode: "soft-sentry",
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to update request" },
      { status: 500 }
    );
  }
}
