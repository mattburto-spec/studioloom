/**
 * GET /api/student/recent-feedback
 *
 * Returns the student's recently received teacher feedback (within the last
 * 14 days), grouped one row per (unit, page). Surfaced on the dashboard's
 * notification bell so a student doesn't have to stumble back into the
 * specific lesson to discover their teacher commented.
 *
 * Visibility rule: a row counts as "feedback" when
 *   student_facing_comment IS NOT NULL AND non-empty
 *   updated_at >= now() - 14 days
 *
 * Future iteration (post-pilot): per-comment seen tracking via a
 * student_seen_feedback_at column. For now we just surface "recent" — if
 * the student has revisited the lesson and absorbed the feedback, the row
 * still shows but the student can ignore it.
 *
 * Auth: student session token (custom — students don't use Supabase Auth).
 * Sorted newest first; capped at 10 rows.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireStudentSession } from "@/lib/access-v2/actor-session";
import { createAdminClient } from "@/lib/supabase/admin";

interface FeedbackGroup {
  unit_id: string;
  unit_title: string | null;
  page_id: string;
  /** First ~80 chars of the comment, useful for the popover sub-line. */
  comment_preview: string;
  /** Newest comment timestamp across the (unit, page). Drives the dueText. */
  latest_at: string;
  /** Number of distinct tile comments inside this lesson. */
  count: number;
}

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_GROUPS = 10;

export async function GET(request: NextRequest) {
  const session = await requireStudentSession(request);
  if (session instanceof NextResponse) {
    return session;
  }

  const since = new Date(Date.now() - FOURTEEN_DAYS_MS).toISOString();
  const db = createAdminClient();

  const { data, error } = await db
    .from("student_tile_grades")
    .select(
      "unit_id, page_id, student_facing_comment, updated_at, units(title)",
    )
    .eq("student_id", session.studentId)
    .not("student_facing_comment", "is", null)
    .gte("updated_at", since)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: `Failed to fetch recent feedback: ${error.message}` },
      { status: 500 },
    );
  }

  // Supabase types the joined `units` as an array even when the FK is
  // many-to-one; normalise to a single row in the loop below.
  type Row = {
    unit_id: string;
    page_id: string;
    student_facing_comment: string | null;
    updated_at: string;
    units: { title: string | null } | { title: string | null }[] | null;
  };

  // Group by (unit_id, page_id). Keep newest comment timestamp + a preview
  // pulled from the newest comment in the group.
  const groups = new Map<string, FeedbackGroup>();
  for (const r of (data ?? []) as unknown as Row[]) {
    const unitTitle = Array.isArray(r.units)
      ? r.units[0]?.title ?? null
      : r.units?.title ?? null;
    const comment = (r.student_facing_comment ?? "").trim();
    if (!comment) continue;
    const key = `${r.unit_id}::${r.page_id}`;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        unit_id: r.unit_id,
        unit_title: unitTitle,
        page_id: r.page_id,
        comment_preview:
          comment.length > 80 ? `${comment.slice(0, 80)}…` : comment,
        latest_at: r.updated_at,
        count: 1,
      });
    } else {
      existing.count += 1;
      // First row was newest (sorted desc); keep its preview + latest_at.
    }
  }

  const out = Array.from(groups.values())
    .sort((a, b) => b.latest_at.localeCompare(a.latest_at))
    .slice(0, MAX_GROUPS);

  return NextResponse.json({ groups: out });
}
