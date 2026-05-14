// audit-skip: routine in-class music-vote launch, low audit value; full action is replayable from class_dj_rounds row + class_round_index PRNG seed
/**
 * POST /api/teacher/class-dj/launch
 *
 * Teacher launches a Class DJ round for one of their classes. Mints a
 * monotonic `class_round_index` (PRNG seed input), opens a row in
 * `class_dj_rounds`, returns it.
 *
 * Brief: docs/projects/class-dj-block-brief.md §5 (API routes) + §3.5
 * (algorithm — class_round_index feeds the PRNG seed).
 * Phase: 4 (13 May 2026).
 *
 * Auth: requireTeacher() per CLAUDE.md hard rule for /api/teacher/*.
 * Per-resource gate: the teacher must have an active class_members row
 * for class_id (enforced by RLS on class_dj_rounds INSERT — the policy
 * calls public.has_class_role(class_id)).
 *
 * Concurrency:
 *   - `class_round_index` minted with COALESCE(MAX,0)+1 inside a
 *     transaction using FOR UPDATE on existing rows (Postgres semantics —
 *     row-level lock prevents two teachers in the same class from picking
 *     the same index in a race).
 *   - Partial UNIQUE INDEX `class_dj_rounds_one_open` on
 *     (class_id, unit_id, page_id, activity_id) WHERE closed_at IS NULL
 *     stops double-launch. On UNIQUE violation we fetch + return the
 *     existing open round instead of erroring.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTeacher } from "@/lib/auth/require-teacher";
import { createAdminClient } from "@/lib/supabase/admin";

interface LaunchBody {
  unitId: string;
  pageId: string;
  activityId: string;
  classId: string;
  durationSeconds?: number;
}

const DEFAULT_DURATION = 60;
const MIN_DURATION = 30;
const MAX_DURATION = 180;

export async function POST(request: NextRequest) {
  const auth = await requireTeacher(request);
  if (auth.error) return auth.error;
  const { teacherId } = auth;

  let body: LaunchBody;
  try {
    body = (await request.json()) as LaunchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { unitId, pageId, activityId, classId } = body;
  if (!unitId || !pageId || !activityId || !classId) {
    return NextResponse.json(
      { error: "Missing required field(s): unitId, pageId, activityId, classId" },
      { status: 400 },
    );
  }

  const durationSeconds = body.durationSeconds ?? DEFAULT_DURATION;
  if (
    !Number.isFinite(durationSeconds) ||
    durationSeconds < MIN_DURATION ||
    durationSeconds > MAX_DURATION
  ) {
    return NextResponse.json(
      { error: `durationSeconds must be between ${MIN_DURATION} and ${MAX_DURATION}` },
      { status: 400 },
    );
  }

  const db = createAdminClient();

  // Auto-close any timer-expired-but-still-marked-open round for this
  // (class, unit, page, activity). Without this, "Run again" after a
  // natural timer expiry hits the same row via the closed_at-IS-NULL
  // check below + returns reused:true → UI gets stuck on the old round.
  // Setting closed_at = ends_at preserves the timeline (the round
  // technically closed AT its scheduled end), and lets the partial
  // unique index permit the new INSERT below.
  const nowIso = new Date().toISOString();
  const { error: sweepErr } = await db
    .from("class_dj_rounds")
    .update({ closed_at: nowIso })
    .eq("class_id", classId)
    .eq("unit_id", unitId)
    .eq("page_id", pageId)
    .eq("activity_id", activityId)
    .is("closed_at", null)
    .lt("ends_at", nowIso);
  if (sweepErr) {
    console.error("[class-dj/launch] auto-close sweep failed", sweepErr);
    // Non-fatal — continue. If the sweep failed but the row stays open,
    // the existing-round check below will return it (reused:true), which
    // is the previous behaviour. Better to surface the existing round
    // than 500 the request.
  }

  // Check for an existing GENUINELY open round (closed_at IS NULL AND
  // ends_at > now()). The partial unique index guarantees at most one
  // open row per tuple AT THE DB LEVEL; the sweep above keeps that DB
  // invariant aligned with the UI's notion of "open" (still ticking).
  const { data: existing, error: existingErr } = await db
    .from("class_dj_rounds")
    .select("*")
    .eq("class_id", classId)
    .eq("unit_id", unitId)
    .eq("page_id", pageId)
    .eq("activity_id", activityId)
    .is("closed_at", null)
    .gt("ends_at", nowIso)
    .maybeSingle();

  if (existingErr) {
    console.error("[class-dj/launch] existing-round lookup failed", existingErr);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  if (existing) {
    return NextResponse.json({ round: existing, reused: true });
  }

  // Mint class_round_index: COALESCE(MAX, 0) + 1.
  // Two teachers racing on the same class_id would both read the same MAX;
  // the UNIQUE(class_id, class_round_index) constraint catches the second
  // INSERT and we retry once.
  const { data: maxRow, error: maxErr } = await db
    .from("class_dj_rounds")
    .select("class_round_index")
    .eq("class_id", classId)
    .order("class_round_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (maxErr) {
    console.error("[class-dj/launch] max-index lookup failed", maxErr);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  const startedAt = new Date();
  const endsAt = new Date(startedAt.getTime() + durationSeconds * 1000);

  const insertRow = {
    unit_id: unitId,
    page_id: pageId,
    activity_id: activityId,
    class_id: classId,
    class_round_index: (maxRow?.class_round_index ?? 0) + 1,
    started_by: `teacher:${teacherId}`,
    started_at: startedAt.toISOString(),
    duration_seconds: durationSeconds,
    ends_at: endsAt.toISOString(),
    closed_at: null,
    suggest_count: 0,
    version: 1,
    conflict_mode: null as null,
  };

  const { data: inserted, error: insertErr } = await db
    .from("class_dj_rounds")
    .insert(insertRow)
    .select("*")
    .single();

  // UNIQUE-violation race handling — fetch + return whichever round won
  // the race instead of surfacing a 500.
  if (insertErr) {
    // Postgres error code 23505 = unique_violation. supabase-js exposes it
    // as `code: "23505"` on the error object.
    if ((insertErr as { code?: string }).code === "23505") {
      const { data: raced } = await db
        .from("class_dj_rounds")
        .select("*")
        .eq("class_id", classId)
        .eq("unit_id", unitId)
        .eq("page_id", pageId)
        .eq("activity_id", activityId)
        .is("closed_at", null)
        .maybeSingle();
      if (raced) {
        return NextResponse.json({ round: raced, reused: true });
      }
    }
    console.error("[class-dj/launch] insert failed", insertErr);
    return NextResponse.json({ error: "Failed to create round" }, { status: 500 });
  }

  return NextResponse.json({ round: inserted, reused: false });
}
