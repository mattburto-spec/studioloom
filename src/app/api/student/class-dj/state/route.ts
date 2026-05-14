/**
 * GET /api/student/class-dj/state
 *
 * Role-aware polling endpoint for Class DJ. Students get participation
 * count only (anti-strategic-voting per brief §11 Q9 hybrid decision);
 * teachers get the full live tally (mood + energy histograms).
 *
 * Brief: docs/projects/class-dj-block-brief.md §5 (API) + §7 (UI surface
 * — face-grid for students, full tally for teacher).
 * Phase: 4 (13 May 2026).
 *
 * Auth: accepts EITHER student session OR teacher session. The student
 * is identified by their token cookie; the teacher by Supabase Auth.
 * The role is detected by attempting student session first, then teacher.
 *
 * Query params:
 *   - unitId
 *   - pageId
 *   - activityId
 *   - classId
 *
 * Response shape:
 *   {
 *     status: "armed" | "live" | "closed",
 *     round: { id, started_at, ends_at, class_round_index, ... } | null,
 *     my_vote: { mood, energy, ... } | null,
 *     participation_count: number,           // total voters in this round
 *     class_size: number,                    // enrolled students count
 *     tally?: { mood_histogram, energy_histogram }, // teachers ONLY
 *     suggestion?: { items, generated_at }     // present once Stage 5 lands (Phase 5)
 *   }
 *
 * Polling cadence (frontend, not enforced here):
 *   - student session: 2s while status='live', pauses on tab-hidden
 *   - teacher session: 1s while status='live', pauses on tab-hidden
 *   - both: 5min hard cap (defensive against zombie tabs)
 */

import { NextRequest, NextResponse } from "next/server";
import { getStudentSession } from "@/lib/access-v2/actor-session";
import { requireTeacher } from "@/lib/auth/require-teacher";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTeacherInClass } from "@/lib/class-dj/auth-helpers";
import type { Mood } from "@/lib/class-dj/types";

const MOODS: Mood[] = ["focus", "build", "vibe", "crit", "fun"];

interface VoteState {
  round_id: string;
  mood: Mood;
  energy: number;
  veto: string | null;
  veto_flagged?: boolean;
  seed: string | null;
  seed_flagged?: boolean;
  voted_at: string;
}

interface StoredVote {
  student_id: string;
  state: VoteState;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const unitId = searchParams.get("unitId");
  const pageId = searchParams.get("pageId");
  const activityId = searchParams.get("activityId");
  const classId = searchParams.get("classId");

  if (!unitId || !pageId || !activityId || !classId) {
    return NextResponse.json(
      { error: "Missing required query param(s): unitId, pageId, activityId, classId" },
      { status: 400 },
    );
  }

  // Role detection: try student session first, then teacher.
  const studentSession = await getStudentSession(request);
  let role: "student" | "teacher" | null = null;
  let studentId: string | null = null;
  let teacherId: string | null = null;
  if (studentSession) {
    role = "student";
    studentId = studentSession.studentId;
  } else {
    const teacherAuth = await requireTeacher(request);
    if (!teacherAuth.error) {
      role = "teacher";
      teacherId = teacherAuth.teacherId;
    }
  }

  if (role === null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();

  // For students, double-check enrollment in classId. The admin client
  // bypasses RLS so we authorise here explicitly.
  if (role === "student" && studentId) {
    const { data: enrollment } = await db
      .from("class_students")
      .select("student_id")
      .eq("class_id", classId)
      .eq("student_id", studentId)
      .maybeSingle();
    if (!enrollment) {
      return NextResponse.json(
        { error: "Forbidden — not enrolled in this class" },
        { status: 403 },
      );
    }
  }

  // For teachers, verify they teach this class. The admin client bypasses
  // RLS so we authorise here explicitly with the teacher id from the
  // session (NOT auth.uid() — that's NULL on the service-role client).
  if (role === "teacher" && teacherId) {
    const isTeacher = await verifyTeacherInClass(db, classId, teacherId);
    if (!isTeacher) {
      return NextResponse.json(
        { error: "Forbidden — not a teacher of this class" },
        { status: 403 },
      );
    }
  }

  // Find the most recent round for this (class, unit, page, activity).
  // Either the open one (closed_at IS NULL) or the most recent closed one
  // (so students still see the suggestions after timer expiry).
  const { data: round, error: roundErr } = await db
    .from("class_dj_rounds")
    .select("*")
    .eq("class_id", classId)
    .eq("unit_id", unitId)
    .eq("page_id", pageId)
    .eq("activity_id", activityId)
    .order("class_round_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (roundErr) {
    console.error("[class-dj/state] round lookup failed", roundErr);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  if (!round) {
    return NextResponse.json({
      status: "armed" as const,
      round: null,
      my_vote: null,
      participation_count: 0,
      class_size: 0,
    });
  }

  // Status: armed (never happens at this point — we have a round),
  // live (closed_at IS NULL AND now < ends_at), or closed.
  const now = Date.now();
  const endsAtMs = new Date(round.ends_at).getTime();
  const isOpen = round.closed_at === null && now < endsAtMs;
  const status: "live" | "closed" = isOpen ? "live" : "closed";

  // Class size — enrolled students in classId.
  const { count: classSize } = await db
    .from("class_students")
    .select("student_id", { count: "exact", head: true })
    .eq("class_id", classId);

  // All votes for this round (one row per voter via tool_sessions
  // unique_embedded_version constraint).
  const { data: votes } = (await db
    .from("student_tool_sessions")
    .select("student_id, state")
    .eq("tool_id", "class-dj")
    .eq("unit_id", round.unit_id)
    .eq("page_id", round.page_id)
    .eq("version", round.version)
    .eq("status", "completed")) as unknown as { data: StoredVote[] | null };

  const allVotes = votes ?? [];
  const participationCount = allVotes.length;

  // The current student's own vote (if any).
  let myVote: VoteState | null = null;
  if (role === "student" && studentId) {
    const mine = allVotes.find((v) => v.student_id === studentId);
    if (mine) myVote = mine.state;
  }

  // Latest suggestion for this round (present from Phase 5 onward).
  const { data: suggestion } = await db
    .from("class_dj_suggestions")
    .select("items, generated_at, vote_count")
    .eq("round_id", round.id)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Build response. Tally is teacher-only.
  const base = {
    status,
    round,
    my_vote: myVote,
    participation_count: participationCount,
    class_size: classSize ?? 0,
    suggestion: suggestion ?? undefined,
  };

  if (role === "teacher") {
    // Full mood + energy histograms.
    const moodHistogram: Record<Mood, number> = {
      focus: 0,
      build: 0,
      vibe: 0,
      crit: 0,
      fun: 0,
    };
    const energyHistogram: Record<1 | 2 | 3 | 4 | 5, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };
    for (const v of allVotes) {
      if (MOODS.includes(v.state.mood)) moodHistogram[v.state.mood]++;
      const e = Math.round(v.state.energy) as 1 | 2 | 3 | 4 | 5;
      if (e >= 1 && e <= 5) energyHistogram[e]++;
    }
    return NextResponse.json({
      ...base,
      tally: { mood_histogram: moodHistogram, energy_histogram: energyHistogram },
    });
  }

  // Student response — no tally, no distribution.
  return NextResponse.json(base);
}
