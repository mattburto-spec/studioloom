import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { requireStudentAuth } from "@/lib/auth/student";

/**
 * Open Studio Session API
 *
 * POST /api/student/open-studio/session
 *   → Start a new Open Studio working session.
 *   Body: { unitId, focusArea? }
 *
 * PATCH /api/student/open-studio/session
 *   → Update an active session (focus area, activity log, reflection, end).
 *   Body: { sessionId, focusArea?, activityEntry?, reflection?, end? }
 */

export const POST = withErrorHandler("student/open-studio/session:POST", async (request: NextRequest) => {
  const auth = await requireStudentAuth(request);
  if (auth.error) return auth.error;
  const studentId = auth.studentId;

  const supabase = createAdminClient();
  const body = await request.json();
  const { unitId, focusArea } = body as {
    unitId: string;
    focusArea?: string;
  };

  if (!unitId) {
    return NextResponse.json({ error: "unitId is required" }, { status: 400 });
  }

  // Verify student has Open Studio unlocked for this unit
  const { data: status } = await supabase
    .from("open_studio_status")
    .select("id")
    .eq("student_id", studentId)
    .eq("unit_id", unitId)
    .eq("status", "unlocked")
    .single();

  if (!status) {
    return NextResponse.json(
      { error: "Open Studio not unlocked for this unit" },
      { status: 403 }
    );
  }

  // End any existing active session for this unit
  await supabase
    .from("open_studio_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("student_id", studentId)
    .eq("unit_id", unitId)
    .is("ended_at", null);

  // Get next session number
  const { count } = await supabase
    .from("open_studio_sessions")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentId)
    .eq("unit_id", unitId);

  const sessionNumber = (count || 0) + 1;

  // Create new session
  const { data: session, error } = await supabase
    .from("open_studio_sessions")
    .insert({
      student_id: studentId,
      unit_id: unitId,
      status_id: status.id,
      session_number: sessionNumber,
      focus_area: focusArea || null,
      activity_log: [],
      drift_flags: [],
    })
    .select("*")
    .single();

  if (error) {
    console.error("[open-studio] Session create error:", error);
    return NextResponse.json(
      { error: "Failed to start session" },
      { status: 500 }
    );
  }

  return NextResponse.json({ session });
});

export const PATCH = withErrorHandler("student/open-studio/session:PATCH", async (request: NextRequest) => {
  const auth = await requireStudentAuth(request);
  if (auth.error) return auth.error;
  const studentId = auth.studentId;

  const supabase = createAdminClient();
  const body = await request.json();
  const {
    sessionId,
    focusArea,
    activityEntry,
    reflection,
    end,
  } = body as {
    sessionId: string;
    focusArea?: string;
    activityEntry?: { type: string; description: string };
    reflection?: string;
    end?: boolean;
  };

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  // Verify ownership
  const { data: existing } = await supabase
    .from("open_studio_sessions")
    .select("id, activity_log, ai_interactions")
    .eq("id", sessionId)
    .eq("student_id", studentId)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};

  if (focusArea !== undefined) {
    updates.focus_area = focusArea;
  }

  if (activityEntry) {
    const currentLog = (existing.activity_log as unknown[]) || [];
    updates.activity_log = [
      ...currentLog,
      {
        ...activityEntry,
        timestamp: new Date().toISOString(),
      },
    ];

    // Increment ai_interactions count if this was an AI chat
    if (activityEntry.type === "ai_chat") {
      updates.ai_interactions = (existing.ai_interactions || 0) + 1;
    }
  }

  if (reflection !== undefined) {
    updates.reflection = reflection;
  }

  if (end) {
    updates.ended_at = new Date().toISOString();
  }

  const { data: updated, error } = await supabase
    .from("open_studio_sessions")
    .update(updates)
    .eq("id", sessionId)
    .select("*")
    .single();

  if (error) {
    console.error("[open-studio] Session update error:", error);
    return NextResponse.json(
      { error: "Failed to update session" },
      { status: 500 }
    );
  }

  return NextResponse.json({ session: updated });
});
