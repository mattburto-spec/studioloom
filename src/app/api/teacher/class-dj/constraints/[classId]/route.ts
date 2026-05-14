/**
 * GET /api/teacher/class-dj/constraints/[classId]
 *
 * Returns persistent vetoes (≥2 echoes in last 30 days for this class,
 * excluding teacher-overrides) + a fairness-ledger summary. Drives the
 * constraints panel UI at /teacher/classes/[classId]/dj-constraints.
 *
 * Brief: docs/projects/class-dj-block-brief.md §5 + §7 (constraints
 * panel section).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTeacher } from "@/lib/auth/require-teacher";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTeacherInClass } from "@/lib/class-dj/auth-helpers";

interface VoteState {
  veto?: string | null;
  veto_flagged?: boolean;
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ classId: string }> },
) {
  const auth = await requireTeacher(request);
  if (auth.error) return auth.error;
  const { teacherId } = auth;

  const { classId } = await ctx.params;
  const db = createAdminClient();

  const isTeacher = await verifyTeacherInClass(db, classId, teacherId);
  if (!isTeacher) {
    return NextResponse.json({ error: "Forbidden — not a teacher of this class" }, { status: 403 });
  }

  // Persistent vetoes — same §3.3 query A as /suggest.
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: priorRounds } = await db
    .from("class_dj_rounds")
    .select("id, version, unit_id, page_id, closed_at")
    .eq("class_id", classId)
    .not("closed_at", "is", null)
    .gt("closed_at", thirtyDaysAgo);

  const persistentVetoes: { veto: string; occurrences: number; last_seen: string }[] = [];

  if (priorRounds && priorRounds.length > 0) {
    const tuples = priorRounds.map((r) => ({
      unit_id: r.unit_id,
      page_id: r.page_id,
      version: r.version,
      closed_at: r.closed_at as string,
    }));
    const { data: pastVotes } = await db
      .from("student_tool_sessions")
      .select("state, unit_id, page_id, version")
      .eq("tool_id", "class-dj")
      .eq("status", "completed")
      .in("unit_id", tuples.map((t) => t.unit_id));

    type AggregateEntry = { occurrences: number; last_seen: string };
    const counts = new Map<string, AggregateEntry>();
    for (const pv of pastVotes ?? []) {
      const tuple = tuples.find(
        (t) => t.unit_id === pv.unit_id && t.page_id === pv.page_id && t.version === pv.version,
      );
      if (!tuple) continue;
      const state = pv.state as VoteState;
      if (!state?.veto || state.veto_flagged) continue;
      const key = state.veto.toLowerCase().trim();
      const existing = counts.get(key);
      if (existing) {
        existing.occurrences += 1;
        if (tuple.closed_at > existing.last_seen) existing.last_seen = tuple.closed_at;
      } else {
        counts.set(key, { occurrences: 1, last_seen: tuple.closed_at });
      }
    }

    const { data: overrides } = await db
      .from("class_dj_veto_overrides")
      .select("veto_text")
      .eq("class_id", classId);
    const overrideSet = new Set((overrides ?? []).map((o) => (o.veto_text as string).toLowerCase().trim()));

    for (const [veto, agg] of counts) {
      if (agg.occurrences < 2) continue;
      if (overrideSet.has(veto)) continue;
      persistentVetoes.push({ veto, occurrences: agg.occurrences, last_seen: agg.last_seen });
    }
    persistentVetoes.sort((a, b) => b.occurrences - a.occurrences);
  }

  // Ledger summary — count of unserved + most-served students.
  const { data: ledgerRows } = await db
    .from("class_dj_fairness_ledger")
    .select("student_id, served_score, seed_pickup_count, voice_weight, rounds_participated")
    .eq("class_id", classId);
  const ledger = (ledgerRows ?? []).map((r) => ({
    student_id: r.student_id as string,
    served_score: r.served_score as number,
    seed_pickup_count: r.seed_pickup_count as number,
    voice_weight: r.voice_weight as number,
    rounds_participated: r.rounds_participated as number,
  }));

  const unservedCount = ledger.filter((e) => e.served_score < 0.4).length;
  const totalParticipants = ledger.length;

  // Last reset (audit log).
  const { data: lastReset } = await db
    .from("class_dj_ledger_resets")
    .select("reset_at, reset_by, rounds_since_last_reset, rows_cleared")
    .eq("class_id", classId)
    .order("reset_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    persistent_vetoes: persistentVetoes,
    ledger_summary: {
      total_participants: totalParticipants,
      unserved_count: unservedCount,
    },
    last_reset: lastReset,
  });
}
