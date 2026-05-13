// audit-skip: routine teacher close action (round timer override); state preserved on class_dj_rounds.closed_at
/**
 * POST /api/teacher/class-dj/[roundId]/close
 *
 * Teacher closes the round immediately (without picking).
 * Idempotent: re-closing an already-closed round is a no-op.
 *
 * Brief: docs/projects/class-dj-block-brief.md §5 (API).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTeacher } from "@/lib/auth/require-teacher";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ roundId: string }> },
) {
  const auth = await requireTeacher(request);
  if (auth.error) return auth.error;

  const { roundId } = await ctx.params;
  const db = createAdminClient();

  const { data: round } = await db
    .from("class_dj_rounds")
    .select("class_id, closed_at")
    .eq("id", roundId)
    .maybeSingle();
  if (!round) return NextResponse.json({ error: "Round not found" }, { status: 404 });

  const { data: isTeacher } = await db.rpc("has_class_role", { _class_id: round.class_id });
  if (!isTeacher) {
    return NextResponse.json({ error: "Forbidden — not a teacher of this class" }, { status: 403 });
  }

  // Idempotent close.
  if (round.closed_at !== null) {
    return NextResponse.json({ ok: true, already_closed: true });
  }

  const { error: updateErr } = await db
    .from("class_dj_rounds")
    .update({ closed_at: new Date().toISOString() })
    .eq("id", roundId)
    .is("closed_at", null);

  if (updateErr) {
    console.error("[class-dj/close] update failed", updateErr);
    return NextResponse.json({ error: "Failed to close round" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, already_closed: false });
}
