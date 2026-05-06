// audit-skip: AG.3.3 — student Timeline CRUD via token session. Storage in
// student_unit_timeline (per-student, per-unit). Whole-state upsert pattern.
// Mirrors /api/student/kanban for consistency.
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { requireStudentSession } from "@/lib/access-v2/actor-session";
import {
  recomputeSummary,
  validateTimelineState,
} from "@/lib/unit-tools/timeline/server-validators";
import {
  emptyTimelineState,
  type TimelineState,
} from "@/lib/unit-tools/timeline/types";

/**
 * GET /api/student/timeline?unitId=<uuid>
 *
 * Returns the student's Timeline state for a unit. Empty initial state
 * if no row exists yet.
 */
export const GET = withErrorHandler(
  "student/timeline:GET",
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
      .from("student_unit_timeline")
      .select(
        "milestones, race_date, last_updated_at, next_milestone_label, next_milestone_target_date, pending_count, done_count"
      )
      .eq("student_id", studentId)
      .eq("unit_id", unitId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      const initial = emptyTimelineState();
      return NextResponse.json({
        timeline: initial,
        summary: {
          next_milestone_label: null,
          next_milestone_target_date: null,
          pending_count: 0,
          done_count: 0,
        },
      });
    }

    const timeline: TimelineState = {
      milestones: data.milestones as TimelineState["milestones"],
      raceDate: data.race_date,
      lastUpdatedAt: data.last_updated_at,
    };

    return NextResponse.json({
      timeline,
      summary: {
        next_milestone_label: data.next_milestone_label,
        next_milestone_target_date: data.next_milestone_target_date,
        pending_count: data.pending_count,
        done_count: data.done_count,
      },
    });
  }
);

/**
 * POST /api/student/timeline
 *
 * Body: { unitId: string, state: TimelineState }
 *
 * Whole-state upsert. Server validates wire shape, recomputes summary
 * from milestones (so denormalized columns can never drift), upserts.
 */
export const POST = withErrorHandler(
  "student/timeline:POST",
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
      return NextResponse.json(
        { error: "body must be an object" },
        { status: 400 }
      );
    }
    const b = body as { unitId?: unknown; state?: unknown };

    if (typeof b.unitId !== "string" || b.unitId.length === 0) {
      return NextResponse.json(
        { error: "unitId required (string)" },
        { status: 400 }
      );
    }

    const validation = validateTimelineState(b.state);
    if (!validation.ok) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.errors },
        { status: 400 }
      );
    }
    const state = validation.value;

    const summary = recomputeSummary(state);

    const db = createAdminClient();
    const { data, error } = await db
      .from("student_unit_timeline")
      .upsert(
        {
          student_id: studentId,
          unit_id: b.unitId,
          milestones: state.milestones,
          race_date: state.raceDate,
          last_updated_at: state.lastUpdatedAt,
          next_milestone_label: summary.next_milestone_label,
          next_milestone_target_date: summary.next_milestone_target_date,
          pending_count: summary.pending_count,
          done_count: summary.done_count,
        },
        { onConflict: "student_id,unit_id" }
      )
      .select(
        "milestones, race_date, last_updated_at, next_milestone_label, next_milestone_target_date, pending_count, done_count"
      )
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to save timeline state" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      timeline: {
        milestones: data.milestones,
        raceDate: data.race_date,
        lastUpdatedAt: data.last_updated_at,
      },
      summary: {
        next_milestone_label: data.next_milestone_label,
        next_milestone_target_date: data.next_milestone_target_date,
        pending_count: data.pending_count,
        done_count: data.done_count,
      },
    });
  }
);
