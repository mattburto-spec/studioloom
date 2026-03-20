import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { requireTeacherAuth, verifyTeacherOwnsClass } from "@/lib/auth/verify-teacher-unit";

/**
 * POST /api/teacher/teach/on-the-fly
 *
 * Creates an on-the-fly activity that gets pushed to students during live teaching.
 * Activities: Quick Poll, Exit Ticket, Show Me, Think-Pair-Share, Collaborate Board, Quick Reflection.
 *
 * Body: {
 *   classId: string,
 *   unitId: string,
 *   pageId?: string,
 *   activityType: "quick-poll" | "exit-ticket" | "show-me" | "think-pair-share" | "collaborate-board" | "quick-reflection",
 *   config: {
 *     question?: string,
 *     options?: string[],  // for quick-poll
 *     prompt?: string,     // for exit-ticket, show-me, quick-reflection
 *     topic?: string,      // for think-pair-share, collaborate-board
 *     timeLimit?: number,  // seconds
 *   }
 * }
 */

const VALID_ACTIVITY_TYPES = [
  "quick-poll",
  "exit-ticket",
  "show-me",
  "think-pair-share",
  "collaborate-board",
  "quick-reflection",
] as const;

type ActivityType = (typeof VALID_ACTIVITY_TYPES)[number];

export const POST = withErrorHandler("teacher/teach/on-the-fly:POST", async (request: NextRequest) => {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;
  const teacherId = auth.teacherId;

  const body = await request.json();
  const { classId, unitId, pageId, activityType, config } = body;

  if (!classId || !unitId || !activityType) {
    return NextResponse.json(
      { error: "classId, unitId, and activityType required" },
      { status: 400 }
    );
  }

  if (!VALID_ACTIVITY_TYPES.includes(activityType)) {
    return NextResponse.json(
      { error: `Invalid activityType. Must be one of: ${VALID_ACTIVITY_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  // Verify teacher owns this class
  const classCheck = await verifyTeacherOwnsClass(teacherId, classId);
  if (classCheck.error) {
    return NextResponse.json({ error: "Not authorized for this class" }, { status: 403 });
  }

  const supabase = createAdminClient();

  // Store the activity in the database
  // Using a generic activities table pattern — if the table doesn't exist yet,
  // we store in a lightweight JSONB log on the class_units junction or a dedicated table.
  // For MVP, we'll store in a simple on_the_fly_activities table.

  // Check if table exists; if not, store as a transient activity (in-memory for polling)
  const activityId = `otf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const activity = {
    id: activityId,
    teacher_id: teacherId,
    class_id: classId,
    unit_id: unitId,
    page_id: pageId || null,
    activity_type: activityType as ActivityType,
    config: config || {},
    status: "active",
    created_at: new Date().toISOString(),
    responses: [],
  };

  // Try to insert into on_the_fly_activities table
  const { error: insertError } = await supabase
    .from("on_the_fly_activities")
    .insert(activity);

  if (insertError) {
    // Table might not exist yet — that's OK for MVP.
    // Return the activity anyway so the frontend can track it locally.
    console.log("[on-the-fly] Table insert failed (table may not exist yet):", insertError.message);
    return NextResponse.json({
      success: true,
      activity: {
        id: activityId,
        activityType,
        config,
        status: "active",
        createdAt: activity.created_at,
        note: "Activity created locally — database persistence requires migration",
      },
    });
  }

  return NextResponse.json({
    success: true,
    activity: {
      id: activityId,
      activityType,
      config,
      status: "active",
      createdAt: activity.created_at,
    },
  });
});

/**
 * GET /api/teacher/teach/on-the-fly?classId=X&activityId=Y
 *
 * Poll for activity responses (teacher side).
 */
export const GET = withErrorHandler("teacher/teach/on-the-fly:GET", async (request: NextRequest) => {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const activityId = searchParams.get("activityId");

  if (!activityId) {
    return NextResponse.json({ error: "activityId required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: activity, error } = await supabase
    .from("on_the_fly_activities")
    .select("*")
    .eq("id", activityId)
    .single();

  if (error || !activity) {
    // Table may not exist yet
    return NextResponse.json({
      activity: null,
      note: "Activity not found or table not yet created",
    });
  }

  return NextResponse.json({ activity });
});
