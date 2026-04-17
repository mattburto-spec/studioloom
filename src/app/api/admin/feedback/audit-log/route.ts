/**
 * Admin Feedback Audit Log API
 * GET — List audit log entries (most recent first)
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const admin = createAdminClient();

  try {
    const { data, error } = await admin
      .from("feedback_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("[audit-log API GET]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ entries: data ?? [] });
  } catch (e) {
    console.error("[audit-log API GET]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
