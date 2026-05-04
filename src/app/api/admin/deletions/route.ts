/**
 * GET /api/admin/deletions
 *
 * Scheduled deletions queue for the admin Deletions tab. Lists all rows
 * in scheduled_deletions grouped by status (pending / completed / held)
 * so the admin can see what's queued, what's been processed, and what's
 * on legal hold.
 *
 * Phase 5.4 schema. Phase 6.7+ admin UI.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const supabase = createAdminClient();

  try {
    const { data, error } = await supabase
      .from("scheduled_deletions")
      .select(
        "id, target_type, target_id, scheduled_for, status, scheduled_by, hold_reason, created_at, completed_at",
      )
      .order("scheduled_for", { ascending: true })
      .limit(200);

    if (error) throw error;

    const rows = (data ?? []) as Array<{
      id: string;
      target_type: string;
      target_id: string;
      scheduled_for: string;
      status: string;
      scheduled_by: string | null;
      hold_reason: string | null;
      created_at: string;
      completed_at: string | null;
    }>;

    const summary = {
      total: rows.length,
      pending: rows.filter((r) => r.status === "pending").length,
      completed: rows.filter((r) => r.status === "completed").length,
      held: rows.filter((r) => r.status === "held").length,
    };

    return NextResponse.json({ summary, rows });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load deletions" },
      { status: 500 },
    );
  }
}
