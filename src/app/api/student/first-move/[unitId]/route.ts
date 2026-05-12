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
import {
  STRATEGY_CANVAS_PROMPTS,
  JOURNAL_PROMPTS,
} from "@/lib/structured-prompts/presets";
import { parseComposedContent } from "@/lib/structured-prompts/payload";
import type { KanbanCard, KanbanState } from "@/lib/unit-tools/kanban/types";

interface FirstMovePayload {
  designPhilosophy: string | null;
  lastJournalNext: string | null;
  lastJournalUpdatedAt: string | null;
  thisClassCards: KanbanCard[];
  lastDoneCard: { id: string; title: string; doneAt: string | null } | null;
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

  // Strategy Canvas philosophy — scan all responses; latest non-empty wins.
  // The response value is a composed-markdown string (## Design philosophy\n<answer>).
  // parseComposedContent returns a map keyed by prompt id; we want id "philosophy".
  let designPhilosophy: string | null = null;
  let designPhilosophyAt = 0;

  // Last journal Next — same pattern, prompt id "next" from JOURNAL_PROMPTS.
  let lastJournalNext: string | null = null;
  let lastJournalUpdatedAt: string | null = null;
  let lastJournalAt = 0;

  for (const row of progressRows ?? []) {
    const updatedTs = row.updated_at ? Date.parse(row.updated_at) : 0;
    const responses = (row.responses ?? {}) as Record<string, unknown>;
    for (const value of Object.values(responses)) {
      if (typeof value !== "string" || value.length === 0) continue;

      // Try Strategy Canvas parse — keys: philosophy, biggest_risk, fallback_plan
      const sc = parseComposedContent(STRATEGY_CANVAS_PROMPTS, value);
      if (sc.philosophy && sc.philosophy.trim().length > 0 && updatedTs > designPhilosophyAt) {
        designPhilosophy = sc.philosophy.trim();
        designPhilosophyAt = updatedTs;
      }

      // Try Journal parse — keys: did, noticed, decided, next
      const jr = parseComposedContent(JOURNAL_PROMPTS, value);
      if (jr.next && jr.next.trim().length > 0 && updatedTs > lastJournalAt) {
        lastJournalNext = jr.next.trim();
        lastJournalUpdatedAt = row.updated_at ?? null;
        lastJournalAt = updatedTs;
      }
    }
  }

  // Kanban — pull this_class + last done card.
  const { data: kanbanRow } = await db
    .from("student_unit_kanban")
    .select("cards")
    .eq("student_id", studentId)
    .eq("unit_id", unitId)
    .maybeSingle();

  const cards: KanbanCard[] = (kanbanRow?.cards as KanbanState["cards"]) ?? [];
  const thisClassCards = cards.filter((c) => c.status === "this_class");

  // Most-recently completed card — by doneAt desc, fallback to movedAt.
  const doneCards = cards
    .filter((c) => c.status === "done")
    .sort((a, b) => {
      const aT = a.doneAt ? Date.parse(a.doneAt) : 0;
      const bT = b.doneAt ? Date.parse(b.doneAt) : 0;
      return bT - aT;
    });
  const lastDoneCard = doneCards[0]
    ? {
        id: doneCards[0].id,
        title: doneCards[0].title,
        doneAt: doneCards[0].doneAt,
      }
    : null;

  const payload: FirstMovePayload = {
    designPhilosophy,
    lastJournalNext,
    lastJournalUpdatedAt,
    thisClassCards,
    lastDoneCard,
  };

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "private, max-age=10" },
  });
}
