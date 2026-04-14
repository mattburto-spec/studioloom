/**
 * GET /api/admin/audit-log
 * Returns combined audit log from multiple sources.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "100");
  const source = request.nextUrl.searchParams.get("source"); // admin|feedback|moderation|removal

  try {
    const entries: Array<{
      id: string;
      source: string;
      action: string;
      actor: string | null;
      target: string | null;
      details: string | null;
      created_at: string;
    }> = [];

    // Admin audit log
    if (!source || source === "admin") {
      const { data } = await supabase
        .from("admin_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      for (const row of data || []) {
        entries.push({
          id: row.id,
          source: "admin",
          action: row.action || "unknown",
          actor: row.actor_id,
          target: `${row.target_table}.${row.target_key}`,
          details: row.new_value ? JSON.stringify(row.new_value).slice(0, 200) : null,
          created_at: row.created_at,
        });
      }
    }

    // Feedback audit log
    if (!source || source === "feedback") {
      const { data } = await supabase
        .from("feedback_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      for (const row of data || []) {
        entries.push({
          id: row.id,
          source: "feedback",
          action: row.action || "unknown",
          actor: row.reviewed_by || null,
          target: row.block_id ? `block:${row.block_id}` : null,
          details: row.reason || null,
          created_at: row.created_at,
        });
      }
    }

    // Content moderation log (teacher actions only)
    if (!source || source === "moderation") {
      const { data } = await supabase
        .from("student_content_moderation_log")
        .select("*")
        .not("teacher_acknowledged_at", "is", null)
        .order("created_at", { ascending: false })
        .limit(limit);

      for (const row of data || []) {
        entries.push({
          id: row.id,
          source: "moderation",
          action: row.resolution || "acknowledged",
          actor: row.teacher_id,
          target: row.student_id ? `student:${row.student_id}` : null,
          details: `${row.flag_type} (${row.severity})`,
          created_at: row.teacher_acknowledged_at || row.created_at,
        });
      }
    }

    // Data removal log
    if (!source || source === "removal") {
      const { data } = await supabase
        .from("data_removal_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      for (const row of data || []) {
        entries.push({
          id: row.id,
          source: "removal",
          action: row.dry_run ? "dry_run" : "removed",
          actor: row.removed_by,
          target: `student:${row.removed_student_ref}`,
          details: `${row.reason} — ${JSON.stringify(row.row_counts)}`,
          created_at: row.created_at,
        });
      }
    }

    // Sort by date descending and limit
    entries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({ entries: entries.slice(0, limit) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load audit log" },
      { status: 500 }
    );
  }
}
