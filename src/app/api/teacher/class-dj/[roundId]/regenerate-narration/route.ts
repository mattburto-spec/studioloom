// audit-skip: routine teacher regenerate-narration action (Stage 5 only re-run); state preserved on new class_dj_suggestions row
/**
 * POST /api/teacher/class-dj/[roundId]/regenerate-narration
 *
 * Re-runs Stage 5 (narration) only — picks are unchanged. Used when the
 * original Stage 5 failed (truncated, parse error) and the suggestion
 * view rendered the fallback "the room voted for X" placeholder.
 *
 * Brief: docs/projects/class-dj-block-brief.md §5 (API) + §3.5 Stage 5
 * (fallback semantics).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTeacher } from "@/lib/auth/require-teacher";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTeacherInClass } from "@/lib/class-dj/auth-helpers";
import { callStage5Narrate, fallbackWhyLines } from "@/lib/class-dj/stage5-narrate";
import type { Candidate, ConflictMode, Mood } from "@/lib/class-dj/types";

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

function parseTeacherId(startedBy: string): string | null {
  const m = startedBy.match(/^teacher:(.+)$/);
  return m ? m[1] : null;
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ roundId: string }> },
) {
  const auth = await requireTeacher(request);
  if (auth.error) return auth.error;
  const { teacherId: actorId } = auth;

  const { roundId } = await ctx.params;
  const db = createAdminClient();

  const { data: round } = await db
    .from("class_dj_rounds")
    .select("class_id, started_by, conflict_mode")
    .eq("id", roundId)
    .maybeSingle();
  if (!round) return NextResponse.json({ error: "Round not found" }, { status: 404 });

  const isTeacher = await verifyTeacherInClass(db, round.class_id, actorId);
  if (!isTeacher) {
    return NextResponse.json({ error: "Forbidden — not a teacher of this class" }, { status: 403 });
  }

  const teacherId = parseTeacherId(round.started_by);
  if (!teacherId) {
    return NextResponse.json({ error: "Round has no teacher attribution" }, { status: 500 });
  }

  // Load most recent suggestion.
  const { data: suggestion } = await db
    .from("class_dj_suggestions")
    .select("id, items, vote_count")
    .eq("round_id", roundId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!suggestion) {
    return NextResponse.json({ error: "No suggestion to regenerate" }, { status: 412 });
  }

  const items = suggestion.items as SuggestionItem[];
  if (!items || items.length !== 3) {
    return NextResponse.json({ error: "Suggestion has wrong shape" }, { status: 500 });
  }

  const picks: Candidate[] = items.map((it) => ({
    name: it.name,
    kind: it.kind,
    moodTags: it.mood_tags,
    energyEstimate: it.energy_estimate,
    contentTags: it.content_tags,
    seedOrigin: it.seed_origin ?? null,
    imageUrl: it.image_url ?? undefined,
    spotifyUrl: it.spotify_url ?? undefined,
    explicit: it.explicit,
  }));

  const stage5 = await callStage5Narrate(
    {
      picks,
      conflictMode: (round.conflict_mode as ConflictMode) ?? "consensus",
      dominantMoodSummary: "regenerated",
      seedsThatContributed: picks.map((p) => p.seedOrigin).filter((s): s is string => !!s),
      voteCount: suggestion.vote_count,
      classSize: suggestion.vote_count,
    },
    teacherId,
    { roundId, regenerate: true },
  );

  let whyLines: string[];
  if (stage5.ok) {
    whyLines = stage5.whyLines;
  } else {
    console.warn("[class-dj/regenerate-narration] Stage 5 failed again — using fallback", stage5.reason);
    whyLines = fallbackWhyLines(picks);
  }

  // Update the items in place (same row).
  const newItems: SuggestionItem[] = items.map((it, i) => ({ ...it, why: whyLines[i] }));
  const { error: updateErr } = await db
    .from("class_dj_suggestions")
    .update({ items: newItems, generated_at: new Date().toISOString() })
    .eq("id", suggestion.id);

  if (updateErr) {
    console.error("[class-dj/regenerate-narration] update failed", updateErr);
    return NextResponse.json({ error: "Failed to persist regenerated narration" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, items: newItems, stage5_ok: stage5.ok });
}
