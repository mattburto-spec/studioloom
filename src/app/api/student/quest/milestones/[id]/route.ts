// audit-skip: routine learner activity, low audit value
/**
 * Student Quest Journey Milestone Detail API
 *
 * PATCH /api/student/quest/milestones/[id]
 *   Update a single milestone's properties.
 *   Body: {
 *     title?: string;
 *     description?: string;
 *     specific?: string;
 *     measurable?: string;
 *     target_date?: string;
 *     status?: "upcoming" | "active" | "completed" | "skipped" | "overdue";
 *     completion_note?: string;
 *   }
 *   - For status='completed': auto-sets completed_at to now
 *   - For status='skipped': just updates status
 *   Returns: updated Milestone
 *
 * DELETE /api/student/quest/milestones/[id]
 *   Delete a student-created milestone.
 *   - Only allows deletion if source='student' (template/teacher milestones can't be deleted, only skipped)
 *   - Verifies milestone's journey belongs to this student
 *   - Returns: 204 No Content on success
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudentSession } from "@/lib/access-v2/actor-session";
import { rateLimit } from "@/lib/rate-limit";
import * as Sentry from "@sentry/nextjs";

/**
 * PATCH: Update a single milestone.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await requireStudentSession(request);
  if (session instanceof NextResponse) return session;
  const studentId = session.studentId;

  // Rate limit: 30 updates per minute per student
  const rl = rateLimit(`quest-milestone-detail:${studentId}`, [{ maxRequests: 30, windowMs: 60_000 }]);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again in a moment." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.retryAfterMs || 0) / 1000)) } }
    );
  }

  try {
    const body = await request.json();
    const {
      title,
      description,
      specific,
      measurable,
      target_date,
      status,
      completion_note,
    } = body as {
      title?: string;
      description?: string;
      specific?: string;
      measurable?: string;
      target_date?: string;
      status?: "upcoming" | "active" | "completed" | "skipped" | "overdue";
      completion_note?: string;
    };

    const supabase = createAdminClient();

    // Fetch the milestone and verify journey ownership
    const { data: milestone, error: fetchError } = await supabase
      .from("quest_milestones")
      .select("id, journey_id")
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !milestone) {
      return NextResponse.json(
        { error: "Milestone not found" },
        { status: 404 }
      );
    }

    // Verify the milestone's journey belongs to this student
    const { data: journey, error: journeyError } = await supabase
      .from("quest_journeys")
      .select("id, student_id")
      .eq("id", milestone.journey_id)
      .eq("student_id", studentId)
      .maybeSingle();

    if (journeyError || !journey) {
      return NextResponse.json(
        { error: "Journey not found or access denied" },
        { status: 403 }
      );
    }

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (specific !== undefined) updateData.specific = specific;
    if (measurable !== undefined) updateData.measurable = measurable;
    if (target_date !== undefined) updateData.target_date = target_date;
    if (completion_note !== undefined) updateData.completion_note = completion_note;

    if (status !== undefined) {
      updateData.status = status;
      // Auto-set completed_at when marking as completed
      if (status === "completed") {
        updateData.completed_at = new Date().toISOString();
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    // Perform update
    const { data: updated, error: updateError } = await supabase
      .from("quest_milestones")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("[quest/milestones/[id] PATCH] Update error:", updateError);
      Sentry.captureException(updateError);
      return NextResponse.json(
        { error: "Failed to update milestone" },
        { status: 500 }
      );
    }

    return NextResponse.json(updated);
  } catch (err) {
    Sentry.captureException(err);
    console.error("[quest/milestones/[id] PATCH] Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to update milestone: ${errorMessage}` },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Delete a student-created milestone.
 * Only allows deletion if source='student' (can't delete template/teacher milestones).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await requireStudentSession(request);
  if (session instanceof NextResponse) return session;
  const studentId = session.studentId;

  // Rate limit: 20 deletes per minute per student
  const rl = rateLimit(`quest-milestone-delete:${studentId}`, [{ maxRequests: 20, windowMs: 60_000 }]);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again in a moment." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.retryAfterMs || 0) / 1000)) } }
    );
  }

  try {
    const supabase = createAdminClient();

    // Fetch the milestone and verify source
    const { data: milestone, error: fetchError } = await supabase
      .from("quest_milestones")
      .select("id, journey_id, source")
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !milestone) {
      return NextResponse.json(
        { error: "Milestone not found" },
        { status: 404 }
      );
    }

    // Only allow deletion of student-created milestones
    if (milestone.source !== "student") {
      return NextResponse.json(
        { error: `Cannot delete ${milestone.source}-created milestone. Use 'skipped' status instead.` },
        { status: 400 }
      );
    }

    // Verify the milestone's journey belongs to this student
    const { data: journey, error: journeyError } = await supabase
      .from("quest_journeys")
      .select("id, student_id")
      .eq("id", milestone.journey_id)
      .eq("student_id", studentId)
      .maybeSingle();

    if (journeyError || !journey) {
      return NextResponse.json(
        { error: "Journey not found or access denied" },
        { status: 403 }
      );
    }

    // Perform deletion
    const { error: deleteError } = await supabase
      .from("quest_milestones")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("[quest/milestones/[id] DELETE] Delete error:", deleteError);
      Sentry.captureException(deleteError);
      return NextResponse.json(
        { error: "Failed to delete milestone" },
        { status: 500 }
      );
    }

    // Return 204 No Content
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    Sentry.captureException(err);
    console.error("[quest/milestones/[id] DELETE] Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to delete milestone: ${errorMessage}` },
      { status: 500 }
    );
  }
}
