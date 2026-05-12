// audit-skip: AG.2.3a — student Kanban CRUD via token session. Storage in
// student_unit_kanban (per-student, per-unit). Whole-state upsert pattern
// (single POST replaces the row's cards + counts atomically). Service-role
// API + studentId from token session — no RLS path needed for student writes.
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { requireStudentSession } from "@/lib/access-v2/actor-session";
import {
  recomputeCounts,
  validateKanbanState,
} from "@/lib/unit-tools/kanban/server-validators";
import {
  emptyKanbanState,
  type KanbanCard,
  type KanbanState,
} from "@/lib/unit-tools/kanban/types";
import {
  resolveChoiceCardPickForUnit,
  extractSeedKanban,
} from "@/lib/choice-cards/resolve-for-unit";
import { randomUUID } from "crypto";

/**
 * GET /api/student/kanban?unitId=<uuid>
 *
 * Returns the student's Kanban state for a unit. If no row exists yet,
 * returns an empty initial state (UI initializes from this rather than
 * showing an empty error).
 */
export const GET = withErrorHandler(
  "student/kanban:GET",
  async (request: NextRequest) => {
    const session = await requireStudentSession(request);
    if (session instanceof NextResponse) return session;
    const studentId = session.studentId;

    const unitId = request.nextUrl.searchParams.get("unitId");
    if (!unitId) {
      return NextResponse.json(
        { error: "unitId query parameter required" },
        { status: 400 }
      );
    }

    const db = createAdminClient();
    const { data, error } = await db
      .from("student_unit_kanban")
      .select(
        "cards, wip_limit_doing, last_move_at, backlog_count, this_class_count, doing_count, done_count"
      )
      .eq("student_id", studentId)
      .eq("unit_id", unitId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      // No row yet — return empty initial state. UI doesn't need to
      // distinguish "never created" from "explicitly empty"; both
      // treat the same (zero cards, default WIP, null lastMoveAt).
      const initial = emptyKanbanState();

      // Choice Cards lazy seed — if the student has picked a card with a
      // seedKanban payload for this unit, seed the backlog with those
      // tasks. Ephemeral on GET (not persisted yet); the next POST that
      // includes the cards array will write them. Skipped silently if
      // no pick exists, no seedKanban payload, or zero valid tasks.
      const pick = await resolveChoiceCardPickForUnit(db, studentId, unitId);
      const seed = extractSeedKanban(pick);
      if (seed) {
        const now = new Date().toISOString();
        const seedCards: KanbanCard[] = seed.map((t) => ({
          id: randomUUID(),
          title: t.title,
          status: "backlog" as const,
          dod: null,
          estimateMinutes: null,
          actualMinutes: null,
          blockType: null,
          blockedAt: null,
          becauseClause: null,
          lessonLink: null,
          source: "manual" as const,
          createdAt: now,
          movedAt: null,
          doneAt: null,
        }));
        initial.cards = seedCards;
      }

      return NextResponse.json({
        kanban: initial,
        counts: {
          backlog_count: initial.cards.length,
          this_class_count: 0,
          doing_count: 0,
          done_count: 0,
        },
        from_choice_card: pick ? { cardId: pick.cardId, label: pick.label } : null,
      });
    }

    const kanban: KanbanState = {
      cards: data.cards as KanbanState["cards"],
      wipLimitDoing: data.wip_limit_doing,
      lastMoveAt: data.last_move_at,
    };

    return NextResponse.json({
      kanban,
      counts: {
        backlog_count: data.backlog_count,
        this_class_count: data.this_class_count,
        doing_count: data.doing_count,
        done_count: data.done_count,
      },
    });
  }
);

/**
 * POST /api/student/kanban
 *
 * Body: { unitId: string, state: KanbanState }
 *
 * Whole-state upsert. Server validates the state shape (defense-in-depth
 * against malicious or buggy clients), recomputes denormalized counts
 * from the cards array (so they can never drift), and writes the row.
 *
 * Concurrency note: for a class of 9 with single-student workflows, no
 * concurrent edits are expected. If we ever scale beyond that, switch to
 * per-card actions with row-level locking.
 */
export const POST = withErrorHandler(
  "student/kanban:POST",
  async (request: NextRequest) => {
    const session = await requireStudentSession(request);
    if (session instanceof NextResponse) return session;
    const studentId = session.studentId;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "body must be an object" }, { status: 400 });
    }
    const b = body as { unitId?: unknown; state?: unknown };

    if (typeof b.unitId !== "string" || b.unitId.length === 0) {
      return NextResponse.json(
        { error: "unitId required (string)" },
        { status: 400 }
      );
    }

    const validation = validateKanbanState(b.state);
    if (!validation.ok) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.errors },
        { status: 400 }
      );
    }
    const state = validation.value;

    // Server recomputes counts from cards — denormalized columns can never
    // drift from the JSONB source of truth this way.
    const counts = recomputeCounts(state);

    const db = createAdminClient();
    const { data, error } = await db
      .from("student_unit_kanban")
      .upsert(
        {
          student_id: studentId,
          unit_id: b.unitId,
          cards: state.cards,
          wip_limit_doing: state.wipLimitDoing,
          last_move_at: state.lastMoveAt,
          backlog_count: counts.backlog_count,
          this_class_count: counts.this_class_count,
          doing_count: counts.doing_count,
          done_count: counts.done_count,
        },
        { onConflict: "student_id,unit_id" }
      )
      .select(
        "cards, wip_limit_doing, last_move_at, backlog_count, this_class_count, doing_count, done_count"
      )
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to save kanban state" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      kanban: {
        cards: data.cards,
        wipLimitDoing: data.wip_limit_doing,
        lastMoveAt: data.last_move_at,
      },
      counts: {
        backlog_count: data.backlog_count,
        this_class_count: data.this_class_count,
        doing_count: data.doing_count,
        done_count: data.done_count,
      },
    });
  }
);
