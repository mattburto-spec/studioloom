/**
 * Student Toolkit Tool Session Detail API
 *
 * GET /api/student/tool-sessions/[id]
 *   Retrieve a specific session (for resuming work).
 *   Returns: {
 *     id: string;
 *     state: Record<string, unknown>;
 *     status: "in_progress" | "completed";
 *     version: number;
 *     started_at: string;
 *     completed_at: string | null;
 *   }
 *
 * PATCH /api/student/tool-sessions/[id]
 *   Update session state (auto-save, or mark complete).
 *   Body: { state?, status?, summary? }
 *   Returns: same as GET
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import * as Sentry from "@sentry/nextjs";
import { SESSION_COOKIE_NAME } from "@/lib/constants";

/**
 * Extract and validate student ID from session cookie.
 */
async function getStudentId(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const supabase = createAdminClient();
  const { data: session } = await supabase
    .from("student_sessions")
    .select("student_id")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .single();

  return session?.student_id || null;
}

/**
 * GET: Retrieve a specific session by ID.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const studentId = await getStudentId(request);
  if (!studentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const { data: session, error } = await supabase
      .from("student_tool_sessions")
      .select(
        "id, state, status, version, started_at, completed_at"
      )
      .eq("id", id)
      .eq("student_id", studentId)
      .single();

    if (error || !session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(session);
  } catch (err) {
    Sentry.captureException(err);
    console.error("[tool-sessions GET id] Error:", err);
    return NextResponse.json(
      { error: "Failed to retrieve session" },
      { status: 500 }
    );
  }
}

/**
 * PATCH: Update session state (auto-save or completion).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const studentId = await getStudentId(request);
  if (!studentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { state, status, summary } = body as {
      state?: Record<string, unknown>;
      status?: "in_progress" | "completed";
      summary?: Record<string, unknown>;
    };

    // Verify ownership first
    const supabase = createAdminClient();
    const { data: session, error: fetchError } = await supabase
      .from("student_tool_sessions")
      .select("id")
      .eq("id", id)
      .eq("student_id", studentId)
      .single();

    if (fetchError || !session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};
    if (state !== undefined) updateData.state = state;
    if (summary !== undefined) updateData.summary = summary;
    if (status !== undefined) {
      updateData.status = status;
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

    const { data: updated, error: updateError } = await supabase
      .from("student_tool_sessions")
      .update(updateData)
      .eq("id", id)
      .eq("student_id", studentId)
      .select(
        "id, state, status, version, started_at, completed_at"
      )
      .single();

    if (updateError) {
      console.error("[tool-sessions PATCH] Update error:", updateError);
      Sentry.captureException(updateError);
      return NextResponse.json(
        { error: "Failed to update session" },
        { status: 500 }
      );
    }

    return NextResponse.json(updated);
  } catch (err) {
    Sentry.captureException(err);
    console.error("[tool-sessions PATCH] Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to update session: ${errorMessage}` },
      { status: 500 }
    );
  }
}
