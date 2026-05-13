// audit-skip: routine teacher ledger reset; full audit row written to class_dj_ledger_resets per Lesson #83 family
/**
 * POST /api/teacher/class-dj/constraints/[classId]/reset-ledger
 *
 * Wipes class_dj_fairness_ledger rows for the class. Logs the reset
 * event to class_dj_ledger_resets per brief §3.6.
 *
 * Triggered by teacher button OR by the 30-round auto safety net
 * (the latter has reset_by = 'auto:30-round-safety-net').
 *
 * Brief: docs/projects/class-dj-block-brief.md §3.6 + §5.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTeacher } from "@/lib/auth/require-teacher";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ classId: string }> },
) {
  const auth = await requireTeacher(request);
  if (auth.error) return auth.error;
  const { teacherId } = auth;

  const { classId } = await ctx.params;
  const db = createAdminClient();

  const { data: isTeacher } = await db.rpc("has_class_role", { _class_id: classId });
  if (!isTeacher) {
    return NextResponse.json({ error: "Forbidden — not a teacher of this class" }, { status: 403 });
  }

  // Count rows before delete (for audit + the rounds_since_last_reset metric).
  const { count: rowCount } = await db
    .from("class_dj_fairness_ledger")
    .select("student_id", { count: "exact", head: true })
    .eq("class_id", classId);

  // Compute rounds_since_last_reset for the audit log.
  const { data: lastReset } = await db
    .from("class_dj_ledger_resets")
    .select("reset_at")
    .eq("class_id", classId)
    .order("reset_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sinceTs = (lastReset?.reset_at as string | undefined) ?? "1970-01-01T00:00:00Z";
  const { count: roundsSince } = await db
    .from("class_dj_rounds")
    .select("id", { count: "exact", head: true })
    .eq("class_id", classId)
    .gt("started_at", sinceTs);

  // Wipe the ledger.
  const { error: deleteErr } = await db
    .from("class_dj_fairness_ledger")
    .delete()
    .eq("class_id", classId);
  if (deleteErr) {
    console.error("[class-dj/reset-ledger] delete failed", deleteErr);
    return NextResponse.json({ error: "Failed to wipe ledger" }, { status: 500 });
  }

  // Log the reset (audit).
  const { error: auditErr } = await db.from("class_dj_ledger_resets").insert({
    class_id: classId,
    reset_by: `teacher:${teacherId}`,
    rounds_since_last_reset: roundsSince ?? 0,
    rows_cleared: rowCount ?? 0,
  });
  if (auditErr) {
    console.error("[class-dj/reset-ledger] audit insert failed", auditErr);
    // Audit failure is NOT fatal — we'd rather the reset took effect
    // than retry it. Surface the audit drift for follow-up.
    return NextResponse.json({
      ok: true,
      rows_cleared: rowCount ?? 0,
      warning: "ledger reset succeeded but audit log insert failed — flag for follow-up",
    });
  }

  return NextResponse.json({
    ok: true,
    rows_cleared: rowCount ?? 0,
    rounds_since_last_reset: roundsSince ?? 0,
  });
}
