// audit-skip: routine learner activity (music vote), low audit value; full action is replayable from student_tool_sessions row keyed by (student_id, unit_id, page_id, tool_id, version). Free-text seed/veto already go through moderateAndLog for safety logging.
/**
 * POST /api/student/class-dj/vote
 *
 * Student casts (or updates) their vote in an open Class DJ round.
 *
 * Brief: docs/projects/class-dj-block-brief.md §5 (API) + §3.2 (vote
 * storage on student_tool_sessions) + §3.5 Stage 0 (sanitisation).
 * Phase: 4 (13 May 2026).
 *
 * Auth: requireStudentSession() — student token cookie set by
 * classcode-login.
 *
 * Flow:
 *   1. Resolve student from session.
 *   2. Look up round, verify open (closed_at IS NULL AND now < ends_at).
 *   3. Verify student is enrolled in round.class_id.
 *   4. Stage 0: sanitiseInput() strips injection vectors + truncates.
 *   5. moderateAndLog on seed + veto (existing primitive).
 *   6. UPSERT into student_tool_sessions (tool_id='class-dj',
 *      keyed by (student_id, unit_id, page_id, tool_id, version)).
 *   7. Return { vote, vote_count } so the UI can update its face-grid count.
 *
 * Idempotent: re-voting for the same (student, round) updates the
 * existing row via ON CONFLICT — students can change their mind until
 * the round closes.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireStudentSession } from "@/lib/access-v2/actor-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitiseInput } from "@/lib/class-dj/algorithm";
import { moderateAndLog } from "@/lib/content-safety/moderate-and-log";
import type { Mood } from "@/lib/class-dj/types";

const MOODS: Mood[] = ["focus", "build", "vibe", "crit", "fun"];

interface VoteBody {
  roundId: string;
  mood: Mood;
  energy: number;
  veto?: string | null;
  seed?: string | null;
}

export async function POST(request: NextRequest) {
  const session = await requireStudentSession(request);
  if (session instanceof NextResponse) return session;
  const { studentId } = session;

  let body: VoteBody;
  try {
    body = (await request.json()) as VoteBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.roundId || !body.mood || !MOODS.includes(body.mood)) {
    return NextResponse.json(
      { error: "Missing or invalid required field(s): roundId, mood" },
      { status: 400 },
    );
  }
  if (!Number.isFinite(body.energy) || body.energy < 1 || body.energy > 5) {
    return NextResponse.json(
      { error: "energy must be a number between 1 and 5" },
      { status: 400 },
    );
  }

  const db = createAdminClient();

  // Look up the round + verify open + verify student is enrolled in the class.
  const { data: round, error: roundErr } = await db
    .from("class_dj_rounds")
    .select("id, class_id, unit_id, page_id, activity_id, version, closed_at, ends_at")
    .eq("id", body.roundId)
    .maybeSingle();

  if (roundErr) {
    console.error("[class-dj/vote] round lookup failed", roundErr);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
  if (!round) {
    return NextResponse.json({ error: "Round not found" }, { status: 404 });
  }
  if (round.closed_at !== null) {
    return NextResponse.json({ error: "Round closed" }, { status: 409 });
  }
  if (new Date(round.ends_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: "Round timer expired" }, { status: 409 });
  }

  // Verify enrollment: student must have an active class_students row for
  // round.class_id. (RLS would block reads otherwise, but we use the admin
  // client to skip RLS — so we check here explicitly.)
  const { data: enrollment, error: enrollmentErr } = await db
    .from("class_students")
    .select("student_id")
    .eq("class_id", round.class_id)
    .eq("student_id", studentId)
    .maybeSingle();
  if (enrollmentErr) {
    console.error("[class-dj/vote] enrollment lookup failed", enrollmentErr);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
  if (!enrollment) {
    return NextResponse.json(
      { error: "Forbidden — not enrolled in this class" },
      { status: 403 },
    );
  }

  // Stage 0 sanitisation (deterministic string-shaping).
  const sanitised = sanitiseInput({
    studentId,
    mood: body.mood,
    energy: body.energy,
    veto: body.veto ?? null,
    seed: body.seed ?? null,
  });

  // Run moderateAndLog on the FREE-TEXT fields (seed + veto). Empty
  // strings are skipped — no payload to score.
  let vetoFlagged = false;
  let seedFlagged = false;

  if (sanitised.veto) {
    const { result } = await moderateAndLog(sanitised.veto, {
      studentId,
      classId: round.class_id,
      source: "tool_session",
    });
    vetoFlagged = result.moderation.status !== "clean";
  }

  if (sanitised.seed) {
    const { result } = await moderateAndLog(sanitised.seed, {
      studentId,
      classId: round.class_id,
      source: "tool_session",
    });
    seedFlagged = result.moderation.status !== "clean";
  }

  const state = {
    round_id: round.id,
    mood: sanitised.mood,
    energy: sanitised.energy,
    veto: sanitised.veto,
    veto_flagged: vetoFlagged,
    seed: sanitised.seed,
    seed_flagged: seedFlagged,
    voted_at: new Date().toISOString(),
  };

  // UPSERT on (student_id, unit_id, page_id, tool_id, version) —
  // matches the `unique_embedded_version` constraint in
  // supabase/migrations/026_student_tool_sessions.sql.
  const upsertRow = {
    student_id: studentId,
    tool_id: "class-dj",
    challenge: "", // not used for class-dj; required NOT NULL on the table
    mode: "embedded",
    unit_id: round.unit_id,
    page_id: round.page_id,
    section_index: null as null,
    state,
    version: round.version,
    status: "completed",
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  };

  const { data: vote, error: upsertErr } = await db
    .from("student_tool_sessions")
    .upsert(upsertRow, { onConflict: "student_id,unit_id,page_id,tool_id,version" })
    .select("id, state, status")
    .single();

  if (upsertErr) {
    console.error("[class-dj/vote] upsert failed", upsertErr);
    return NextResponse.json({ error: "Failed to record vote" }, { status: 500 });
  }

  // Get current vote count for this round (for the face-grid).
  const { count: voteCount, error: countErr } = await db
    .from("student_tool_sessions")
    .select("id", { count: "exact", head: true })
    .eq("tool_id", "class-dj")
    .eq("unit_id", round.unit_id)
    .eq("page_id", round.page_id)
    .eq("version", round.version)
    .eq("status", "completed");

  if (countErr) {
    console.error("[class-dj/vote] count failed", countErr);
    // Not fatal — return the vote without count.
    return NextResponse.json({ vote });
  }

  return NextResponse.json({ vote, vote_count: voteCount ?? 0 });
}
