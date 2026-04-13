import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import * as Sentry from "@sentry/nextjs";
import { withErrorHandler } from "@/lib/api/error-handler";
import {
  createConversation,
  loadConversation,
  generateResponse,
} from "@/lib/design-assistant/conversation";
import { rateLimit, DESIGN_ASSISTANT_LIMITS } from "@/lib/rate-limit";
import { requireStudentAuth } from "@/lib/auth/student";
import { moderateAndLog } from "@/lib/content-safety/moderate-and-log";

/**
 * POST /api/student/design-assistant
 * Send a message to the Socratic design mentor.
 *
 * Body: {
 *   conversationId?: string;  // existing conversation, or null to start new
 *   unitId: string;
 *   pageId?: string;
 *   message: string;
 * }
 *
 * Returns: {
 *   conversationId: string;
 *   response: string;
 *   questionType: string;
 *   bloomLevel: number;
 *   effortScore: number;
 * }
 */
export const POST = withErrorHandler("student/design-assistant:POST", async (request: NextRequest) => {
  // Student auth via session token cookie (not Supabase Auth)
  const auth = await requireStudentAuth(request);
  if (auth.error) return auth.error;
  const studentId = auth.studentId;

  const body = await request.json();
  const { conversationId, unitId, pageId, message } = body as {
    conversationId?: string;
    unitId: string;
    pageId?: string;
    message: string;
  };

  // Validate inputs
  if (!unitId) {
    return NextResponse.json({ error: "unitId is required" }, { status: 400 });
  }

  if (!message || message.trim().length === 0) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  // Rate limit check
  const { allowed, retryAfterMs } = rateLimit(
    `da:${studentId}`,
    DESIGN_ASSISTANT_LIMITS
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((retryAfterMs || 60000) / 1000)),
        },
      }
    );
  }

  // Verify student is still enrolled in a class that has this unit
  if (unitId) {
    const supabase = createAdminClient();
    // Get all active class enrollments for this student
    const { data: enrollments } = await supabase
      .from("class_students")
      .select("class_id")
      .eq("student_id", studentId)
      .eq("is_active", true);

    const activeClassIds = (enrollments || []).map((e: { class_id: string }) => e.class_id);

    // Also check legacy class_id
    const { data: student } = await supabase
      .from("students")
      .select("class_id")
      .eq("id", studentId)
      .single();
    if (student?.class_id) activeClassIds.push(student.class_id);

    if (activeClassIds.length > 0) {
      // Check if any of these classes have this unit assigned
      const { data: classUnits } = await supabase
        .from("class_units")
        .select("class_id")
        .in("class_id", activeClassIds)
        .eq("unit_id", unitId)
        .eq("is_active", true)
        .limit(1);

      if (!classUnits || classUnits.length === 0) {
        return NextResponse.json(
          { error: "You no longer have access to this unit." },
          { status: 403 }
        );
      }
    } else {
      // No active enrollments at all
      return NextResponse.json(
        { error: "You are not enrolled in any active classes." },
        { status: 403 }
      );
    }
  }

  // Check for API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Design Assistant is not configured. API key missing." },
      { status: 503 }
    );
  }

  try {
    // Create or use existing conversation
    let activeConversationId = conversationId;

    if (!activeConversationId) {
      const conversation = await createConversation(studentId, unitId, pageId);
      activeConversationId = conversation.id;
    }

    // Phase 5F: Fire-and-forget moderation — private AI conversation
    moderateAndLog(message.trim(), {
      classId: '',
      studentId,
      source: 'tool_session' as const,
    }).catch((err: unknown) => console.error('[design-assistant] moderation error:', err));

    // Generate Socratic response
    const result = await generateResponse(
      activeConversationId,
      message.trim(),
      apiKey
    );

    return NextResponse.json({
      conversationId: activeConversationId,
      response: result.response,
      questionType: result.questionType,
      bloomLevel: result.bloomLevel,
      effortScore: result.effortScore,
    });
  } catch (err) {
    Sentry.captureException(err);
    console.error("[design-assistant] Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Design Assistant error: ${errorMessage}` },
      { status: 500 }
    );
  }
});

/**
 * GET /api/student/design-assistant?conversationId={id}
 * Retrieve conversation history.
 *
 * Also supports: ?unitId={id}&pageId={id} to find existing conversation
 *
 * Returns: {
 *   conversation: DesignConversation;
 *   turns: ConversationTurn[];
 * }
 */
export const GET = withErrorHandler("student/design-assistant:GET", async (request: NextRequest) => {
  // Student auth via session token cookie
  const auth = await requireStudentAuth(request);
  if (auth.error) return auth.error;
  const studentId = auth.studentId;

  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get("conversationId");
  const unitId = searchParams.get("unitId");
  const pageId = searchParams.get("pageId");

  try {
    if (conversationId) {
      const result = await loadConversation(conversationId);
      return NextResponse.json(result);
    }

    if (unitId) {
      const supabase = createAdminClient();
      let query = supabase
        .from("design_conversations")
        .select("*")
        .eq("student_id", studentId)
        .eq("unit_id", unitId)
        .is("ended_at", null) // only active conversations
        .order("created_at", { ascending: false })
        .limit(1);

      if (pageId) {
        query = query.eq("page_id", pageId);
      }

      const { data: conversations } = await query;

      if (conversations && conversations.length > 0) {
        const result = await loadConversation(conversations[0].id);
        return NextResponse.json(result);
      }

      // No active conversation found
      return NextResponse.json({
        conversation: null,
        turns: [],
      });
    }

    return NextResponse.json(
      { error: "conversationId or unitId query param required" },
      { status: 400 }
    );
  } catch (err) {
    Sentry.captureException(err);
    console.error("[design-assistant] GET error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to load conversation: ${errorMessage}` },
      { status: 500 }
    );
  }
});
