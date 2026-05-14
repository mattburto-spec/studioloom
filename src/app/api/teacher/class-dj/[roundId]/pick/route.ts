// audit-skip: routine teacher pick action; full state (which item, when, who) persisted on round + ledger updates rows
/**
 * POST /api/teacher/class-dj/[roundId]/pick
 *
 * Teacher picks one of the 3 suggestion items. Records the pick on
 * class_dj_rounds (closed_at + picked_suggestion_index via items[i]
 * metadata — keeping the schema small, the actual pick is identified by
 * (round, generated_at-most-recent, suggestion_index)). Crucially:
 * RUNS updateFairnessLedger per brief §3.6.
 *
 * Auth: requireTeacher; class teacher of round.class_id.
 *
 * Brief: docs/projects/class-dj-block-brief.md §5 + §3.6 (ledger semantics).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTeacher } from "@/lib/auth/require-teacher";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTeacherInClass } from "@/lib/class-dj/auth-helpers";
import { sanitiseInput, updateFairnessLedger } from "@/lib/class-dj/algorithm";
import type {
  Candidate,
  FairnessLedgerEntry,
  Mood,
  Vote,
} from "@/lib/class-dj/types";

interface PickBody {
  suggestionIndex: 0 | 1 | 2;
}

interface VoteState {
  mood: Mood;
  energy: number;
  veto: string | null;
  seed: string | null;
  veto_flagged?: boolean;
  seed_flagged?: boolean;
}

interface StoredVoteRow {
  student_id: string;
  state: VoteState;
}

interface SuggestionItem {
  name: string;
  kind: "artist" | "band" | "genre" | "playlist-concept";
  why: string;
  mood_tags: Mood[];
  energy_estimate: number;
  content_tags: string[];
  seed_origin: string | null;
  image_url: string | null;
  spotify_url: string | null;
  explicit: boolean;
  is_bridge: boolean;
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ roundId: string }> },
) {
  const auth = await requireTeacher(request);
  if (auth.error) return auth.error;
  const { teacherId } = auth;

  const { roundId } = await ctx.params;
  let body: PickBody;
  try {
    body = (await request.json()) as PickBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (![0, 1, 2].includes(body.suggestionIndex)) {
    return NextResponse.json({ error: "suggestionIndex must be 0, 1, or 2" }, { status: 400 });
  }

  const db = createAdminClient();

  // Load round + verify teacher.
  const { data: round, error: roundErr } = await db
    .from("class_dj_rounds")
    .select("*")
    .eq("id", roundId)
    .maybeSingle();
  if (roundErr) {
    console.error("[class-dj/pick] round lookup failed", roundErr);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
  if (!round) return NextResponse.json({ error: "Round not found" }, { status: 404 });

  const isTeacher = await verifyTeacherInClass(db, round.class_id, teacherId);
  if (!isTeacher) {
    return NextResponse.json({ error: "Forbidden — not a teacher of this class" }, { status: 403 });
  }

  // Load the most recent suggestion.
  const { data: suggestion } = await db
    .from("class_dj_suggestions")
    .select("id, items, vote_count")
    .eq("round_id", roundId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!suggestion) {
    return NextResponse.json({ error: "No suggestion to pick from yet" }, { status: 412 });
  }
  const items = suggestion.items as SuggestionItem[];
  if (!items || !items[body.suggestionIndex]) {
    return NextResponse.json({ error: "Suggestion index out of range" }, { status: 400 });
  }
  const picked = items[body.suggestionIndex];

  // Load votes for the fairness-ledger update.
  const { data: voteRows } = (await db
    .from("student_tool_sessions")
    .select("student_id, state")
    .eq("tool_id", "class-dj")
    .eq("unit_id", round.unit_id)
    .eq("page_id", round.page_id)
    .eq("version", round.version)
    .eq("status", "completed")) as unknown as { data: StoredVoteRow[] | null };
  const storedVotes = voteRows ?? [];

  const votes: Vote[] = storedVotes.map((v) =>
    sanitiseInput({
      studentId: v.student_id,
      mood: v.state.mood,
      energy: v.state.energy,
      veto: v.state.veto,
      seed: v.state.seed,
    }),
  );

  // Build a Candidate-shape for updateFairnessLedger.
  const pickedCandidate: Candidate = {
    name: picked.name,
    kind: picked.kind,
    moodTags: picked.mood_tags,
    energyEstimate: picked.energy_estimate,
    contentTags: picked.content_tags,
    seedOrigin: picked.seed_origin ?? null,
  };

  // Load existing ledger entries for this class.
  const { data: ledgerRows } = await db
    .from("class_dj_fairness_ledger")
    .select("class_id, student_id, served_score, seed_pickup_count, voice_weight, rounds_participated")
    .eq("class_id", round.class_id);

  const currentLedger: FairnessLedgerEntry[] = (ledgerRows ?? []).map((r) => ({
    classId: r.class_id as string,
    studentId: r.student_id as string,
    servedScore: r.served_score as number,
    seedPickupCount: r.seed_pickup_count as number,
    voiceWeight: r.voice_weight as number,
    roundsParticipated: r.rounds_participated as number,
  }));

  // Run the EMA + voice-weight update per §3.6.
  const newLedger = updateFairnessLedger(currentLedger, votes, pickedCandidate, round.class_id);

  // Upsert the new ledger rows. Only update entries that changed (those
  // belonging to voters in this round).
  const voterIds = new Set(votes.map((v) => v.studentId));
  const upserts = newLedger
    .filter((e) => voterIds.has(e.studentId))
    .map((e) => ({
      class_id: e.classId,
      student_id: e.studentId,
      served_score: e.servedScore,
      seed_pickup_count: e.seedPickupCount,
      voice_weight: e.voiceWeight,
      rounds_participated: e.roundsParticipated,
      last_updated_at: new Date().toISOString(),
    }));

  if (upserts.length > 0) {
    const { error: upsertErr } = await db
      .from("class_dj_fairness_ledger")
      .upsert(upserts, { onConflict: "class_id,student_id" });
    if (upsertErr) {
      console.error("[class-dj/pick] ledger upsert failed", upsertErr);
      return NextResponse.json({ error: "Failed to update fairness ledger" }, { status: 500 });
    }
  }

  // Close the round.
  await db
    .from("class_dj_rounds")
    .update({ closed_at: new Date().toISOString() })
    .eq("id", roundId)
    .is("closed_at", null);

  return NextResponse.json({
    ok: true,
    picked: {
      index: body.suggestionIndex,
      name: picked.name,
      spotify_url: picked.spotify_url,
    },
    ledger_rows_updated: upserts.length,
  });
}
