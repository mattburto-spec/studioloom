// audit-skip: routine learner orientation read, no audit value.
//
// First Move — consolidated GET endpoint.
//
// Returns everything the FirstMoveBlock needs in one call:
//   - designPhilosophy: the "philosophy" field from any Strategy Canvas
//     response in the unit (latest non-empty wins).
//   - lastJournalNext: the "next" field from the most recent Process
//     Journal entry in the unit.
//   - lastJournalUpdatedAt: ISO timestamp of that journal entry.
//   - thisClassCards: kanban cards currently in `this_class` lane.
//   - lastDoneCard: most-recent card moved to Done (for "where you
//     left off" continuity).
//
// All four sources are optional — block renders gracefully when any
// are missing (e.g. brand-new student who hasn't done Class 1 yet).
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudentSession } from "@/lib/access-v2/actor-session";
import type { KanbanCard, KanbanState } from "@/lib/unit-tools/kanban/types";
import type { TimelineMilestone } from "@/lib/unit-tools/timeline/types";
import {
  extractDesignPhilosophy,
  extractLastJournalNext,
  extractKanbanSummary,
  extractUpcomingMilestones,
  type ProgressRowLike,
  type TimelineMilestoneLike,
  type UpcomingMilestone,
} from "@/lib/first-move/payload-builder";

interface FirstMovePayload {
  designPhilosophy: string | null;
  lastJournalNext: string | null;
  lastJournalUpdatedAt: string | null;
  thisClassCards: KanbanCard[];
  lastDoneCard: { id: string; title: string; doneAt: string | null } | null;
  upcomingMilestones: UpcomingMilestone[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ unitId: string }> },
) {
  const session = await requireStudentSession(request);
  if (session instanceof NextResponse) return session;
  const studentId = session.studentId;

  const { unitId } = await params;
  if (!unitId) {
    return NextResponse.json({ error: "unitId required" }, { status: 400 });
  }

  const db = createAdminClient();

  // Pull all student_progress rows for this student+unit in one query.
  // For a single student in one unit this is ≤16 rows in practice.
  const { data: progressRows, error: progErr } = await db
    .from("student_progress")
    .select("responses, updated_at")
    .eq("student_id", studentId)
    .eq("unit_id", unitId);

  if (progErr) {
    return NextResponse.json({ error: progErr.message }, { status: 500 });
  }

  // Coerce progress rows into the shape the pure helper expects.
  const rows: ProgressRowLike[] = (progressRows ?? []).map((r) => ({
    responses: (r.responses ?? {}) as Record<string, unknown>,
    updated_at: r.updated_at ?? null,
  }));

  const philosophy = extractDesignPhilosophy(rows);
  const journalNext = extractLastJournalNext(rows);

  // Kanban — read raw cards then summarise via the helper.
  const { data: kanbanRow } = await db
    .from("student_unit_kanban")
    .select("cards")
    .eq("student_id", studentId)
    .eq("unit_id", unitId)
    .maybeSingle();

  const cards: KanbanCard[] = (kanbanRow?.cards as KanbanState["cards"]) ?? [];
  const { thisClassCards, lastDoneCard } = extractKanbanSummary(cards);

  // Timeline milestones — student_unit_timeline.milestones is the
  // canonical AG.3 store (set via the Timeline tool's backward-mapping
  // UI). One row per (student, unit); the helper trims to the next N
  // pending milestones with a target date and computes daysFromNow.
  // Overdue milestones still appear (negative daysFromNow) so students
  // see what they missed.
  const { data: timelineRow } = await db
    .from("student_unit_timeline")
    .select("milestones")
    .eq("student_id", studentId)
    .eq("unit_id", unitId)
    .maybeSingle();

  const timelineMilestones: TimelineMilestoneLike[] = (
    (timelineRow?.milestones as TimelineMilestone[] | null) ?? []
  ).map((m) => ({
    id: m.id,
    label: m.label,
    targetDate: m.targetDate,
    status: m.status,
  }));

  const upcomingMilestones = extractUpcomingMilestones(timelineMilestones);

  const payload: FirstMovePayload = {
    designPhilosophy: philosophy.value,
    lastJournalNext: journalNext.value,
    lastJournalUpdatedAt: journalNext.updatedAt,
    thisClassCards,
    lastDoneCard,
    upcomingMilestones,
  };

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "private, max-age=10" },
  });
}
