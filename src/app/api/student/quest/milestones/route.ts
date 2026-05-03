/**
 * Student Quest Journey Milestones API
 *
 * GET /api/student/quest/milestones
 *   List milestones for a journey.
 *   Query: journeyId (required)
 *   Returns: Milestone[] ordered by sort_order
 *
 * POST /api/student/quest/milestones
 *   Create a new milestone for planning/working phase.
 *   Body: {
 *     journeyId: string;
 *     title: string;
 *     description?: string;
 *     phase: "discover" | "define" | "ideate" | "prototype" | "test";
 *     framework_phase_id?: string;
 *     sort_order?: number;
 *   }
 *   Returns: created Milestone with auto-assigned sort_order if not provided
 *
 * PATCH /api/student/quest/milestones
 *   Bulk update milestones (reordering, date setting, etc.).
 *   Body: {
 *     journeyId: string;
 *     updates: Array<{
 *       id: string;
 *       sort_order?: number;
 *       target_date?: string;
 *     }>;
 *   }
 *   Returns: updated Milestone[]
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudentSession } from "@/lib/access-v2/actor-session";
import { rateLimit } from "@/lib/rate-limit";
import * as Sentry from "@sentry/nextjs";
import { moderateAndLog } from "@/lib/content-safety/moderate-and-log";

export interface Milestone {
  id: string;
  journey_id: string;
  title: string;
  description: string | null;
  phase: "not_started" | "discovery" | "planning" | "working" | "sharing" | "completed";
  framework_phase_id: string | null;
  sort_order: number;
  target_date: string | null;
  status: "upcoming" | "active" | "completed" | "skipped" | "overdue";
  source: "student" | "ai_suggested" | "template" | "teacher";
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * GET: List milestones for a journey.
 */
export async function GET(request: NextRequest) {
  const session = await requireStudentSession(request);
  if (session instanceof NextResponse) return session;
  const studentId = session.studentId;

  try {
    const { searchParams } = new URL(request.url);
    const journeyId = searchParams.get("journeyId");

    if (!journeyId) {
      return NextResponse.json(
        { error: "journeyId query parameter is required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Verify journey ownership
    const { data: journey, error: journeyError } = await supabase
      .from("quest_journeys")
      .select("id, student_id")
      .eq("id", journeyId)
      .eq("student_id", studentId)
      .maybeSingle();

    if (journeyError || !journey) {
      return NextResponse.json(
        { error: "Journey not found or access denied" },
        { status: 404 }
      );
    }

    // Fetch milestones ordered by sort_order
    const { data: milestones, error: milestonesError } = await supabase
      .from("quest_milestones")
      .select("*")
      .eq("journey_id", journeyId)
      .order("sort_order", { ascending: true });

    if (milestonesError) {
      console.error("[quest/milestones GET] Query error:", milestonesError);
      Sentry.captureException(milestonesError);
      return NextResponse.json(
        { error: "Failed to fetch milestones" },
        { status: 500 }
      );
    }

    return NextResponse.json({ milestones: milestones || [] });
  } catch (err) {
    Sentry.captureException(err);
    console.error("[quest/milestones GET] Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to fetch milestones: ${errorMessage}` },
      { status: 500 }
    );
  }
}

/**
 * POST: Create a new milestone.
 */
export async function POST(request: NextRequest) {
  const session = await requireStudentSession(request);
  if (session instanceof NextResponse) return session;
  const studentId = session.studentId;

  // Rate limit: 20 creates per minute per student
  const rl = rateLimit(`quest-milestones:${studentId}`, [{ maxRequests: 20, windowMs: 60_000 }]);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again in a moment." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.retryAfterMs || 0) / 1000)) } }
    );
  }

  try {
    const body = await request.json();
    const {
      journeyId,
      title,
      description,
      phase,
      framework_phase_id,
      sort_order,
    } = body as {
      journeyId: string;
      title: string;
      description?: string;
      phase: string;
      framework_phase_id?: string;
      sort_order?: number;
    };

    if (!journeyId || !title || !phase) {
      return NextResponse.json(
        { error: "journeyId, title, and phase are required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Verify journey ownership and phase
    const { data: journey, error: journeyError } = await supabase
      .from("quest_journeys")
      .select("id, student_id, phase")
      .eq("id", journeyId)
      .eq("student_id", studentId)
      .maybeSingle();

    if (journeyError || !journey) {
      return NextResponse.json(
        { error: "Journey not found or access denied" },
        { status: 404 }
      );
    }

    // Only allow milestone creation in planning or working phase
    if (journey.phase !== "planning" && journey.phase !== "working") {
      return NextResponse.json(
        { error: `Cannot add milestones in ${journey.phase} phase` },
        { status: 400 }
      );
    }

    // Compute next sort_order if not provided
    let nextSortOrder = sort_order;
    if (nextSortOrder === undefined) {
      const { data: existingMilestones, error: countError } = await supabase
        .from("quest_milestones")
        .select("sort_order")
        .eq("journey_id", journeyId)
        .order("sort_order", { ascending: false })
        .limit(1);

      if (!countError && existingMilestones && existingMilestones.length > 0) {
        nextSortOrder = (existingMilestones[0].sort_order || 0) + 1;
      } else {
        nextSortOrder = 1;
      }
    }

    // Insert milestone
    const { data: newMilestone, error: insertError } = await supabase
      .from("quest_milestones")
      .insert({
        journey_id: journeyId,
        title,
        description: description || null,
        phase,
        framework_phase_id: framework_phase_id || null,
        sort_order: nextSortOrder,
        status: "upcoming",
        source: "student",
        target_date: null,
        completed_at: null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[quest/milestones POST] Insert error:", insertError);
      Sentry.captureException(insertError);
      return NextResponse.json(
        { error: "Failed to create milestone" },
        { status: 500 }
      );
    }

    // Phase 5F: Fire-and-forget moderation — private milestone content
    const textToModerate = [title, description].filter(Boolean).join(' ');
    if (textToModerate.length > 0) {
      moderateAndLog(textToModerate, {
        classId: '',
        studentId,
        source: 'quest_evidence' as const,
      }).catch((err: unknown) => console.error('[quest/milestones] moderation error:', err));
    }

    return NextResponse.json(newMilestone, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    console.error("[quest/milestones POST] Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to create milestone: ${errorMessage}` },
      { status: 500 }
    );
  }
}

/**
 * PATCH: Bulk update milestones (reordering, date setting, etc.).
 */
export async function PATCH(request: NextRequest) {
  const session = await requireStudentSession(request);
  if (session instanceof NextResponse) return session;
  const studentId = session.studentId;

  // Rate limit: 30 updates per minute per student
  const rl = rateLimit(studentId, [{ maxRequests: 30, windowMs: 60 * 1000 }]);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again in a moment." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.retryAfterMs || 0) / 1000)) } }
    );
  }

  try {
    const body = await request.json();
    const { journeyId, updates } = body as {
      journeyId: string;
      updates: Array<{
        id: string;
        sort_order?: number;
        target_date?: string;
      }>;
    };

    if (!journeyId || !updates || !Array.isArray(updates)) {
      return NextResponse.json(
        { error: "journeyId and updates array are required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Verify journey ownership
    const { data: journey, error: journeyError } = await supabase
      .from("quest_journeys")
      .select("id, student_id")
      .eq("id", journeyId)
      .eq("student_id", studentId)
      .maybeSingle();

    if (journeyError || !journey) {
      return NextResponse.json(
        { error: "Journey not found or access denied" },
        { status: 404 }
      );
    }

    // Process each update
    const updatedMilestones: Milestone[] = [];

    for (const update of updates) {
      const updateData: Record<string, unknown> = {};
      if (update.sort_order !== undefined) updateData.sort_order = update.sort_order;
      if (update.target_date !== undefined) updateData.target_date = update.target_date;

      if (Object.keys(updateData).length === 0) continue;

      const { data: updatedMilestone, error: updateError } = await supabase
        .from("quest_milestones")
        .update(updateData)
        .eq("id", update.id)
        .eq("journey_id", journeyId)
        .select()
        .single();

      if (updateError) {
        console.error("[quest/milestones PATCH] Update error:", updateError);
        Sentry.captureException(updateError);
        continue;
      }

      if (updatedMilestone) {
        updatedMilestones.push(updatedMilestone);
      }
    }

    return NextResponse.json({ milestones: updatedMilestones });
  } catch (err) {
    Sentry.captureException(err);
    console.error("[quest/milestones PATCH] Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to update milestones: ${errorMessage}` },
      { status: 500 }
    );
  }
}
