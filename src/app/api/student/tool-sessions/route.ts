/**
 * Student Toolkit Tool Sessions API
 *
 * POST /api/student/tool-sessions
 *   Create a new tool session.
 *   Body: {
 *     toolId: string;
 *     studentId: string;  (from auth token)
 *     mode: "embedded" | "standalone";
 *     challenge?: string;
 *     unitId?: string;
 *     pageId?: string;
 *     sectionIndex?: number;
 *     state?: Record<string, unknown>;
 *   }
 *   Returns: { sessionId: string }
 *
 * GET /api/student/tool-sessions
 *   Find an existing in_progress session.
 *   Query: ?toolId=X[&unitId=Y&pageId=Z&sectionIndex=N]
 *   Returns: { sessionId: string; status: string } or 404
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
 * POST: Create a new tool session (lazy creation).
 */
export async function POST(request: NextRequest) {
  const studentId = await getStudentId(request);
  if (!studentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      toolId,
      mode,
      challenge,
      unitId,
      pageId,
      sectionIndex,
      state,
    } = body as {
      toolId: string;
      mode: "embedded" | "standalone";
      challenge?: string;
      unitId?: string;
      pageId?: string;
      sectionIndex?: number;
      state?: Record<string, unknown>;
    };

    // Validate required fields
    if (!toolId) {
      return NextResponse.json(
        { error: "toolId is required" },
        { status: 400 }
      );
    }

    if (!mode || !["embedded", "standalone"].includes(mode)) {
      return NextResponse.json(
        { error: "mode must be 'embedded' or 'standalone'" },
        { status: 400 }
      );
    }

    // Validate embedded mode
    if (mode === "embedded" && (!unitId || !pageId)) {
      return NextResponse.json(
        { error: "unitId and pageId are required for embedded mode" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // For embedded mode, compute next version number
    let nextVersion = 1;
    if (mode === "embedded" && unitId && pageId) {
      const { data: existingVersions } = await supabase
        .from("student_tool_sessions")
        .select("version")
        .eq("student_id", studentId)
        .eq("tool_id", toolId)
        .eq("unit_id", unitId)
        .eq("page_id", pageId)
        .order("version", { ascending: false })
        .limit(1);

      if (existingVersions && existingVersions.length > 0) {
        nextVersion = (existingVersions[0].version || 1) + 1;
      }
    }

    // Create the session
    const { data: newSession, error: insertError } = await supabase
      .from("student_tool_sessions")
      .insert({
        student_id: studentId,
        tool_id: toolId,
        mode,
        challenge: challenge || "",
        unit_id: unitId || null,
        page_id: pageId || null,
        section_index: sectionIndex ?? null,
        version: nextVersion,
        state: state || {},
        status: "in_progress",
      })
      .select()
      .single();

    if (insertError) {
      console.error("[tool-sessions POST] Insert error:", insertError);
      Sentry.captureException(insertError);
      return NextResponse.json(
        { error: "Failed to create session" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      sessionId: newSession.id,
    });
  } catch (err) {
    Sentry.captureException(err);
    console.error("[tool-sessions POST] Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to create session: ${errorMessage}` },
      { status: 500 }
    );
  }
}

/**
 * GET: Find an existing in_progress session for this tool+student+page.
 */
export async function GET(request: NextRequest) {
  const studentId = await getStudentId(request);
  if (!studentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const toolId = searchParams.get("toolId");
    const unitId = searchParams.get("unitId");
    const pageId = searchParams.get("pageId");
    const sectionIndex = searchParams.get("sectionIndex");

    if (!toolId) {
      return NextResponse.json(
        { error: "toolId query param is required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Build query for embedded or standalone session
    let query = supabase
      .from("student_tool_sessions")
      .select("id, status")
      .eq("student_id", studentId)
      .eq("tool_id", toolId)
      .eq("status", "in_progress")
      .order("updated_at", { ascending: false })
      .limit(1);

    if (unitId && pageId) {
      // Embedded mode lookup
      query = query.eq("unit_id", unitId).eq("page_id", pageId);

      if (sectionIndex) {
        query = query.eq("section_index", parseInt(sectionIndex, 10));
      }
    } else {
      // Standalone mode: just find most recent in_progress session for this tool
      query = query.eq("mode", "standalone");
    }

    const { data: sessions, error: queryError } = await query;

    if (queryError) {
      console.error("[tool-sessions GET] Query error:", queryError);
      Sentry.captureException(queryError);
      return NextResponse.json(
        { error: "Failed to query sessions" },
        { status: 500 }
      );
    }

    if (!sessions || sessions.length === 0) {
      return NextResponse.json(
        { error: "No session found" },
        { status: 404 }
      );
    }

    const foundSession = sessions[0];
    return NextResponse.json({
      sessionId: foundSession.id,
      status: foundSession.status,
    });
  } catch (err) {
    Sentry.captureException(err);
    console.error("[tool-sessions GET] Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to fetch session: ${errorMessage}` },
      { status: 500 }
    );
  }
}
