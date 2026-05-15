// audit-skip: routine learner action (request 3 music suggestions); full pipeline + picks + drops are persisted to class_dj_suggestions row for replay/debug
/**
 * POST /api/student/class-dj/suggest
 *
 * Runs the full Class DJ 5-stage pipeline end-to-end for an open round
 * and returns 3 picked suggestions with album art + why-lines.
 *
 * Brief: docs/projects/class-dj-block-brief.md §3.5 (algorithm) + §5
 * (API table) + §6 (prompts).
 *
 * Auth: requireStudentSession — any student can punch the suggest
 * button once the gate is met. (Teachers can also trigger via the
 * cockpit in Phase 6.)
 *
 * Flow:
 *   1. Resolve student → enrollment check.
 *   2. Look up round, validate (open, gate_min_votes met).
 *   3. Race-safe increment of class_dj_rounds.suggest_count.
 *   4. Load votes from student_tool_sessions.
 *   5. Load fairness ledger + persistent vetoes (last 30d, ≥2 echoes) +
 *      recent suggestions (last 5 rounds).
 *   6. Stage 2: detectConflict.
 *   7. Stage 3: callStage3Candidates → Spotify enrich → drop on
 *      explicit / no-match / blocklist → silent retry once if <8 survive.
 *   8. Stage 1: aggregate over the enriched pool.
 *   9. Stage 4: select → 3 picks.
 *  10. Stage 5: callStage5Narrate → 3 why-lines (with fallback on fail).
 *  11. INSERT class_dj_suggestions row.
 *  12. Return { items, conflict_mode, vote_count }.
 */

import { NextRequest, NextResponse } from "next/server";
import { getActorSession } from "@/lib/access-v2/actor-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTeacherInClass } from "@/lib/class-dj/auth-helpers";
import {
  aggregate,
  analyseConsensusSeeds,
  detectConflict,
  sanitiseInput,
  seedPRNG,
  select,
} from "@/lib/class-dj/algorithm";
import { callStage3Candidates } from "@/lib/class-dj/stage3-candidates";
import { callStage5Narrate, fallbackWhyLines } from "@/lib/class-dj/stage5-narrate";
import { enrichCandidatePool } from "@/lib/class-dj/art-enrich";
import type {
  Candidate,
  ConflictMode,
  FairnessLedgerEntry,
  Mood,
  Vote,
} from "@/lib/class-dj/types";

const MOODS: Mood[] = ["focus", "build", "vibe", "crit", "fun"];
const RETRY_THRESHOLD = 8; // re-run Stage 3 if enrich-survivors < this

interface SuggestBody {
  roundId: string;
  /** Per-instance teacher-configured gate. Falls back to 3 if missing.
   *  Clamped server-side to [1, 10] per ClassDjConfigPanel range. */
  gateMinVotes?: number;
  /** Per-instance teacher-configured suggestion cap. Falls back to 3.
   *  Clamped server-side to [1, 3]. */
  maxSuggestions?: number;
}

interface RoundRow {
  id: string;
  unit_id: string;
  page_id: string;
  activity_id: string;
  class_id: string;
  class_round_index: number;
  started_by: string;
  closed_at: string | null;
  ends_at: string;
  suggest_count: number;
  version: number;
  duration_seconds: number;
}

interface VoteState {
  round_id: string;
  mood: Mood;
  energy: number;
  veto: string | null;
  veto_flagged?: boolean;
  seed: string | null;
  seed_flagged?: boolean;
}

interface StoredVoteRow {
  student_id: string;
  state: VoteState;
}

/** Parse `teacher:<uuid>` from class_dj_rounds.started_by. */
function parseTeacherId(startedBy: string): string | null {
  const m = startedBy.match(/^teacher:(.+)$/);
  return m ? m[1] : null;
}

export async function POST(request: NextRequest) {
  // Accept EITHER a student OR a teacher session. The endpoint started
  // student-only in Phase 5; relaxed 14 May 2026 so the teacher cockpit's
  // auto-fire on round close also works when no students are still on
  // the page (Matt's classroom smoke caught this — round closed with 8
  // votes but no suggestion because all 12 students had moved on and
  // only the teacher was still polling, and teacher polling couldn't
  // fire /suggest). Per-role authorisation:
  //   - student → must be enrolled in round.class_id
  //   - teacher → must have a class_members row for round.class_id
  const actor = await getActorSession(request);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const requesterId =
    actor.type === "student" ? actor.studentId : actor.teacherId;

  let body: SuggestBody;
  try {
    body = (await request.json()) as SuggestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.roundId) {
    return NextResponse.json({ error: "Missing roundId" }, { status: 400 });
  }

  const db = createAdminClient();

  // 1. Load round + validate.
  const { data: round, error: roundErr } = await db
    .from("class_dj_rounds")
    .select("*")
    .eq("id", body.roundId)
    .maybeSingle<RoundRow>();
  if (roundErr) {
    console.error("[class-dj/suggest] round lookup failed", roundErr);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
  if (!round) return NextResponse.json({ error: "Round not found" }, { status: 404 });

  // 2. Authorisation — role-aware. Students need enrollment; teachers need
  // class_members. Both gate on round.class_id (server-side, not trustable
  // from the body).
  if (actor.type === "student") {
    const { data: enrollment } = await db
      .from("class_students")
      .select("student_id")
      .eq("class_id", round.class_id)
      .eq("student_id", requesterId)
      .maybeSingle();
    if (!enrollment) {
      return NextResponse.json(
        { error: "Forbidden — not enrolled in this class" },
        { status: 403 },
      );
    }
  } else {
    const ok = await verifyTeacherInClass(db, round.class_id, requesterId);
    if (!ok) {
      return NextResponse.json(
        { error: "Forbidden — not a member of this class" },
        { status: 403 },
      );
    }
  }

  // 3. Load votes + check gate.
  const { data: voteRows } = (await db
    .from("student_tool_sessions")
    .select("student_id, state")
    .eq("tool_id", "class-dj")
    .eq("unit_id", round.unit_id)
    .eq("page_id", round.page_id)
    .eq("version", round.version)
    .eq("status", "completed")) as unknown as { data: StoredVoteRow[] | null };
  const storedVotes = voteRows ?? [];
  const voteCount = storedVotes.length;

  // Per-instance gate from the body, clamped to the brief's range.
  // Defaults to 3 (brief default) if not provided. Client (ClassDjBlock
  // + ClassDjTeacherControls) reads it from activity.classDjConfig and
  // passes through. Clamp prevents a malicious client from bypassing
  // with gateMinVotes:0 — the floor of 1 means at least one vote must
  // be in even if the teacher set it lower.
  const gateMinVotes = Math.max(
    1,
    Math.min(10, Number.isFinite(body.gateMinVotes) ? Number(body.gateMinVotes) : 3),
  );
  if (voteCount < gateMinVotes) {
    return NextResponse.json(
      { error: `Need at least ${gateMinVotes} vote(s) (currently ${voteCount})` },
      { status: 412 },
    );
  }

  // 4. Race-safe suggest_count increment. maxSuggestions also per-instance
  //    from the body, clamped to [1, 3] per ClassDjConfigPanel range.
  const maxSuggestions = Math.max(
    1,
    Math.min(3, Number.isFinite(body.maxSuggestions) ? Number(body.maxSuggestions) : 3),
  );
  const { data: updatedRound, error: incrErr } = await db
    .from("class_dj_rounds")
    .update({ suggest_count: round.suggest_count + 1 })
    .eq("id", round.id)
    .lt("suggest_count", maxSuggestions)
    .select("suggest_count")
    .maybeSingle<{ suggest_count: number }>();
  if (incrErr) {
    console.error("[class-dj/suggest] increment failed", incrErr);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
  if (!updatedRound) {
    return NextResponse.json(
      { error: "max_suggestions reached for this round" },
      { status: 429 },
    );
  }
  const newSuggestCount = updatedRound.suggest_count;

  // Revert helper for failure paths AFTER the atomic increment. Without
  // this, every Stage 3 / Spotify-drop / Stage 5 failure permanently
  // consumes a slot toward max_suggestions — three consecutive failures
  // would hit the cap and lock the round out from ever generating a
  // suggestion, even though no suggestion row was ever inserted. Caught
  // 14 May 2026 when Matt's classroom round 5 hit max with 8 votes but
  // zero suggestions visible.
  //
  // Race-note: this is a relative decrement done via re-read + write,
  // so there's a tiny window where two concurrent reverts could
  // overlap. Worst case: one extra slot consumed transiently. Way
  // better than the current behaviour (slot consumed forever).
  async function revertIncrement() {
    try {
      const { data: cur } = await db
        .from("class_dj_rounds")
        .select("suggest_count")
        .eq("id", round!.id)
        .maybeSingle<{ suggest_count: number }>();
      if (cur && cur.suggest_count > 0) {
        await db
          .from("class_dj_rounds")
          .update({ suggest_count: cur.suggest_count - 1 })
          .eq("id", round!.id);
      }
    } catch (e) {
      console.error("[class-dj/suggest] revertIncrement failed (non-fatal)", e);
    }
  }

  const teacherId = parseTeacherId(round.started_by);
  if (!teacherId) {
    await revertIncrement();
    return NextResponse.json(
      { error: "Round has no teacher attribution (started_by malformed)" },
      { status: 500 },
    );
  }

  // 5. Re-sanitise votes for the pipeline (Stage 0 — defence-in-depth).
  const votes: Vote[] = storedVotes.map((v) =>
    sanitiseInput({
      studentId: v.student_id,
      mood: v.state.mood,
      energy: v.state.energy,
      veto: v.state.veto,
      seed: v.state.seed,
    }),
  );

  // 6. Load fairness ledger + persistent vetoes + recent suggestions.
  const { data: fairnessRows } = await db
    .from("class_dj_fairness_ledger")
    .select("class_id, student_id, served_score, seed_pickup_count, voice_weight, rounds_participated")
    .eq("class_id", round.class_id);
  const fairness: FairnessLedgerEntry[] = (fairnessRows ?? []).map((r) => ({
    classId: r.class_id as string,
    studentId: r.student_id as string,
    servedScore: r.served_score as number,
    seedPickupCount: r.seed_pickup_count as number,
    voiceWeight: r.voice_weight as number,
    roundsParticipated: r.rounds_participated as number,
  }));

  // Persistent vetoes — §3.3 query A (≥2 echoes in last 30 days, excluding
  // teacher-expired). Implemented in JS for Phase 5; could move to a
  // Postgres view in Phase 7 if performance bites.
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: priorRounds } = await db
    .from("class_dj_rounds")
    .select("id, version, unit_id, page_id")
    .eq("class_id", round.class_id)
    .not("closed_at", "is", null)
    .gt("closed_at", thirtyDaysAgo);

  let persistentVetoes: string[] = [];
  if (priorRounds && priorRounds.length > 0) {
    // Collect veto strings from past completed rounds.
    const tuples = priorRounds.map((r) => ({ unit_id: r.unit_id, page_id: r.page_id, version: r.version }));
    // Heuristic batch lookup — at modest scale this is fine.
    const { data: pastVotes } = await db
      .from("student_tool_sessions")
      .select("state, unit_id, page_id, version")
      .eq("tool_id", "class-dj")
      .eq("status", "completed")
      .in("unit_id", tuples.map((t) => t.unit_id));
    const counts = new Map<string, number>();
    for (const pv of pastVotes ?? []) {
      const matchesAnyTuple = tuples.some(
        (t) => t.unit_id === pv.unit_id && t.page_id === pv.page_id && t.version === pv.version,
      );
      if (!matchesAnyTuple) continue;
      const state = pv.state as VoteState;
      if (!state?.veto || state.veto_flagged) continue;
      const key = state.veto.toLowerCase().trim();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const candidates = Array.from(counts.entries()).filter(([, c]) => c >= 2).map(([v]) => v);

    // Filter out teacher-overridden vetoes.
    const { data: overrides } = await db
      .from("class_dj_veto_overrides")
      .select("veto_text")
      .eq("class_id", round.class_id);
    const overrideSet = new Set((overrides ?? []).map((o) => (o.veto_text as string).toLowerCase().trim()));
    persistentVetoes = candidates.filter((v) => !overrideSet.has(v)).slice(0, 20);
  }

  // Recent suggestions — last 5 rounds for this class.
  const { data: recentRows } = await db
    .from("class_dj_suggestions")
    .select("items, round_id, generated_at, class_dj_rounds!inner(class_id)")
    .eq("class_dj_rounds.class_id", round.class_id)
    .order("generated_at", { ascending: false })
    .limit(15);
  const recentSuggestionNames: string[] = [];
  for (const r of recentRows ?? []) {
    const items = r.items as Array<{ name: string }> | null;
    if (!items) continue;
    for (const it of items) {
      if (it.name && !recentSuggestionNames.includes(it.name)) recentSuggestionNames.push(it.name);
    }
  }

  // 7. Build histograms (used by Stage 3 prompt + Stage 4).
  const moodHistogram: Record<Mood, number> = { focus: 0, build: 0, vibe: 0, crit: 0, fun: 0 };
  const energyHistogram: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const v of votes) {
    if (MOODS.includes(v.mood)) moodHistogram[v.mood]++;
    const e = Math.round(v.energy) as 1 | 2 | 3 | 4 | 5;
    if (e >= 1 && e <= 5) energyHistogram[e]++;
  }

  // 8. Stage 2 conflict detection.
  const conflict = detectConflict(votes);
  const conflictMode: ConflictMode = conflict.mode;

  // 9. Consensus seed + fairness story (input to Stage 3).
  const consensusSeed = analyseConsensusSeeds(votes);
  const fairnessNote = (() => {
    if (fairness.length === 0) return undefined;
    const unserved = fairness.filter((f) => f.servedScore < 0.4);
    if (unserved.length > 0) return `${unserved.length} student(s) haven't been served recently — slight bias toward their seeds if any fit.`;
    return undefined;
  })();

  const seedsThisRound = votes
    .filter((v) => v.seed && !v.seedFlagged)
    .map((v) => ({ studentId: v.studentId, seed: v.seed! }));
  const vetoesThisRound = votes
    .filter((v) => v.veto && !v.vetoFlagged)
    .map((v) => v.veto!);

  // 10. Stage 3 — LLM candidate pool.
  let stage3 = await callStage3Candidates(
    {
      classSize: 0, // populated below if needed; not required by prompt
      voteCount,
      votes,
      moodHistogram,
      energyHistogram,
      conflictMode,
      vetoesThisRound,
      seedsThisRound,
      consensusSeedName: consensusSeed.hasConsensus ? consensusSeed.consensusName : undefined,
      persistentVetoes,
      recentSuggestions: recentSuggestionNames,
      fairnessNote,
      classRoundIndex: round.class_round_index,
    },
    teacherId,
    { roundId: round.id, suggestCount: newSuggestCount },
  );

  if (!stage3.ok) {
    await revertIncrement();
    return NextResponse.json(
      { error: `Stage 3 failed: ${stage3.reason}`, detail: stage3.detail },
      { status: stage3.reason === "truncated" ? 502 : 502 },
    );
  }

  // 11. Spotify enrich + drop hallucinations / explicit / blocklist.
  //
  // Spotify-degraded mode: if SPOTIFY_CLIENT_ID/SECRET aren't set or the
  // token endpoint is down, enrichCandidatePool passes non-blocklisted
  // candidates through with imageUrl/spotifyUrl undefined. Suggestion
  // still appears on screen (UI renders 🎵 placeholder for missing art).
  // Caught 14 May 2026 — Matt's smoke had unset Vercel env vars, every
  // round closed with "All candidates dropped by Spotify enrichment."
  const candidatePoolSize = stage3.candidates.length;
  let { enriched, drops, spotifyDegraded } = await enrichCandidatePool(
    stage3.candidates,
  );

  // Silent Stage 3 retry once if too many drops.
  if (enriched.length < RETRY_THRESHOLD) {
    const droppedNames = drops.map((d) => d.name);
    const retry = await callStage3Candidates(
      {
        classSize: 0,
        voteCount,
        votes,
        moodHistogram,
        energyHistogram,
        conflictMode,
        vetoesThisRound,
        seedsThisRound,
        consensusSeedName: consensusSeed.hasConsensus ? consensusSeed.consensusName : undefined,
        persistentVetoes,
        recentSuggestions: recentSuggestionNames,
        fairnessNote,
        classRoundIndex: round.class_round_index,
        excludeNames: droppedNames,
      },
      teacherId,
      { roundId: round.id, suggestCount: newSuggestCount, retry: 1 },
    );
    if (retry.ok) {
      const retryEnriched = await enrichCandidatePool(retry.candidates);
      enriched = [...enriched, ...retryEnriched.enriched];
      drops = [...drops, ...retryEnriched.drops];
      // If either pass degraded, treat the round as degraded.
      spotifyDegraded = spotifyDegraded || retryEnriched.spotifyDegraded;
    }
  }

  if (enriched.length === 0) {
    await revertIncrement();
    // When degraded, the only way enriched can be empty is if EVERY
    // candidate was blocklisted. In normal mode, this branch fires when
    // every candidate failed Spotify match / explicit / blocklist.
    const reason = spotifyDegraded
      ? "All candidates blocklisted — no safe options for this room"
      : "All candidates dropped by Spotify enrichment after retry";
    // Surface the drops detail so DevTools shows exactly which names
    // failed and why. Without this, "All candidates dropped" is a
    // black box — could be all hallucinations, all explicit, all
    // blocklisted, or Spotify silently rate-limiting search calls.
    return NextResponse.json(
      {
        error: reason,
        diagnostics: {
          spotifyDegraded,
          candidatePoolSize,
          totalDropped: drops.length,
          drops: drops.slice(0, 30),
          dropReasonCounts: {
            no_spotify_match: drops.filter((d) => d.reason === "no_spotify_match").length,
            explicit: drops.filter((d) => d.reason === "explicit").length,
            blocklist: drops.filter((d) => d.reason === "blocklist").length,
          },
        },
      },
      { status: 502 },
    );
  }

  // 12. Stage 1 aggregate over the enriched pool.
  const agg = aggregate({
    votes,
    candidates: enriched,
    fairness,
    persistentVetoes,
  });

  // 13. PRNG seed + Stage 4 selection.
  const prngSeed = seedPRNG(round.class_id, round.class_round_index, newSuggestCount);
  const selection = select(
    {
      scored: agg.scored,
      mode: conflictMode,
      clusters: conflict.clusters,
      votes,
      fairness,
      recentSuggestions: enriched.filter((c) => recentSuggestionNames.includes(c.name)),
      classRoundIndex: round.class_round_index,
    },
    prngSeed,
  );

  const picks: Candidate[] = selection.picks.map((p) => p.candidate);

  // 14. Stage 5 narration (with fallback).
  let whyLines: string[];
  const stage5 = await callStage5Narrate(
    {
      picks,
      conflictMode,
      dominantMoodSummary: `mood top: ${Object.entries(moodHistogram).sort(([, a], [, b]) => b - a)[0]?.[0] ?? "n/a"}`,
      seedsThatContributed: seedsThisRound.map((s) => s.seed),
      fairnessStory: fairnessNote,
      voteCount,
      classSize: voteCount, // class_size if known; voteCount as floor
    },
    teacherId,
    { roundId: round.id, suggestCount: newSuggestCount },
  );
  if (stage5.ok) {
    whyLines = stage5.whyLines;
  } else {
    console.warn("[class-dj/suggest] Stage 5 failed — using fallback whylines", stage5.reason);
    whyLines = fallbackWhyLines(picks);
  }

  // 15. Persist class_dj_suggestions row + update class_dj_rounds.conflict_mode.
  const items = picks.map((p, i) => ({
    name: p.name,
    kind: p.kind,
    why: whyLines[i],
    image_url: p.imageUrl ?? null,
    spotify_url: p.spotifyUrl ?? null,
    explicit: p.explicit ?? false,
    mood_tags: p.moodTags,
    energy_estimate: p.energyEstimate,
    content_tags: p.contentTags,
    seed_origin: p.seedOrigin ?? null,
    is_bridge: selection.bridgeIndex === i,
  }));

  await db
    .from("class_dj_rounds")
    .update({ conflict_mode: conflictMode })
    .eq("id", round.id);

  const { data: insertedRow, error: insertErr } = await db
    .from("class_dj_suggestions")
    .insert({
      round_id: round.id,
      requested_by: `${actor.type}:${requesterId}`,
      vote_count: voteCount,
      items,
      candidate_pool_size: candidatePoolSize,
      spotify_drops: drops.length,
      prng_seed_hash: prngSeed.slice(0, 32),
    })
    .select("id, generated_at")
    .single();

  if (insertErr) {
    console.error("[class-dj/suggest] suggestions insert failed", insertErr);
    await revertIncrement();
    return NextResponse.json({ error: "Failed to record suggestion" }, { status: 500 });
  }

  return NextResponse.json({
    suggestion_id: insertedRow.id,
    generated_at: insertedRow.generated_at,
    items,
    conflict_mode: conflictMode,
    vote_count: voteCount,
    suggest_count: newSuggestCount,
    candidate_pool_size: candidatePoolSize,
    spotify_drops: drops.length,
  });
}
