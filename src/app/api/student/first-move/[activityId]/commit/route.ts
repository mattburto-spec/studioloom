// audit-skip: routine learner commitment write, self-auditing via
// learning_events row.
//
// First Move — POST commit endpoint.
//
// Body: { unitId: string, commitment: string, chosenCardId?: string }
//
// Behaviour:
//   1. Validate commitment (5–200 chars after trim).
//   2. If chosenCardId is present, move that kanban card to "doing".
//      Any cards currently in "doing" are demoted to "this_class" so
//      the WIP=1 limit is preserved (gentle swap UX).
//   3. Write a `first-move.committed` row to learning_events with the
//      commitment text + chosenCardId in payload — feeds teacher
//      dashboard "did this student pause to orient before diving in?"
//   4. Return { ok, kanbanMoved: { from, to } | null, selectionId } so
//      the client can show "swapped Card A for Card B in Doing".
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudentSession } from "@/lib/access-v2/actor-session";
import {
  recomputeCounts,
  validateKanbanState,
} from "@/lib/unit-tools/kanban/server-validators";
import type { KanbanCard, KanbanState } from "@/lib/unit-tools/kanban/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface KanbanMoveResult {
  movedToDoing: { id: string; title: string };
  demotedFromDoing: { id: string; title: string }[];
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ activityId: string }> },
) {
  const session = await requireStudentSession(request);
  if (session instanceof NextResponse) return session;
  const studentId = session.studentId;

  const { activityId } = await params;
  if (!activityId) {
    return NextResponse.json({ error: "activityId required" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "body must be an object" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  if (typeof b.unitId !== "string" || !UUID_RE.test(b.unitId)) {
    return NextResponse.json({ error: "unitId required (uuid)" }, { status: 400 });
  }
  const unitId = b.unitId;

  if (typeof b.commitment !== "string") {
    return NextResponse.json({ error: "commitment required (string)" }, { status: 400 });
  }
  const commitment = b.commitment.trim();
  if (commitment.length < 5 || commitment.length > 200) {
    return NextResponse.json(
      { error: "commitment must be 5-200 characters" },
      { status: 400 },
    );
  }

  const chosenCardId =
    typeof b.chosenCardId === "string" && b.chosenCardId.length > 0
      ? b.chosenCardId
      : null;

  const db = createAdminClient();

  // ─── Kanban move (optional) ───────────────────────────────────────
  let kanbanMove: KanbanMoveResult | null = null;
  if (chosenCardId) {
    const { data: kanbanRow } = await db
      .from("student_unit_kanban")
      .select("cards, wip_limit_doing, last_move_at")
      .eq("student_id", studentId)
      .eq("unit_id", unitId)
      .maybeSingle();

    if (kanbanRow) {
      const cards = (kanbanRow.cards as KanbanCard[]) ?? [];
      const chosen = cards.find((c) => c.id === chosenCardId);
      if (chosen && chosen.status !== "doing") {
        const now = new Date().toISOString();
        const demoted: { id: string; title: string }[] = [];
        const newCards: KanbanCard[] = cards.map((c) => {
          if (c.id === chosen.id) {
            return { ...c, status: "doing" as const, movedAt: now };
          }
          if (c.status === "doing") {
            demoted.push({ id: c.id, title: c.title });
            return { ...c, status: "this_class" as const, movedAt: now };
          }
          return c;
        });

        const newState: KanbanState = {
          cards: newCards,
          wipLimitDoing: (kanbanRow.wip_limit_doing as number) ?? 1,
          lastMoveAt: now,
        };

        // Defence in depth — validate before write so a malformed
        // mutation can't poison the row.
        const validation = validateKanbanState(newState);
        if (!validation.ok) {
          return NextResponse.json(
            { error: "Kanban state would be invalid", details: validation.errors },
            { status: 500 },
          );
        }

        const counts = recomputeCounts(validation.value);
        await db
          .from("student_unit_kanban")
          .upsert(
            {
              student_id: studentId,
              unit_id: unitId,
              cards: validation.value.cards,
              wip_limit_doing: validation.value.wipLimitDoing,
              last_move_at: validation.value.lastMoveAt,
              backlog_count: counts.backlog_count,
              this_class_count: counts.this_class_count,
              doing_count: counts.doing_count,
              done_count: counts.done_count,
            },
            { onConflict: "student_id,unit_id" },
          );

        kanbanMove = {
          movedToDoing: { id: chosen.id, title: chosen.title },
          demotedFromDoing: demoted,
        };
      }
    }
  }

  // ─── learning_events emission ─────────────────────────────────────
  try {
    await db.from("learning_events").insert({
      student_id: studentId,
      event_type: "first-move.committed",
      subject_type: "first_move_block",
      // subject_id needs to be a UUID — synthesize from activityId hash for
      // stability. activityId is a nanoid8 string, not a UUID. We use
      // gen_random_uuid() server-side instead and stash activityId in payload.
      subject_id: crypto.randomUUID(),
      payload: {
        activityId,
        unitId,
        commitment,
        chosenCardId,
        kanbanMove,
      },
    });
  } catch (err) {
    // Non-fatal — commitment is the user-visible value, not the log.
    console.error("[first-move] failed to log learning_event:", err);
  }

  return NextResponse.json({ ok: true, kanbanMove });
}
