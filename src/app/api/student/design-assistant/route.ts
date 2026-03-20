import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import * as Sentry from "@sentry/nextjs";
import {
  createConversation,
  loadConversation,
  generateResponse,
} from "@/lib/design-assistant/conversation";
import { rateLimit, DESIGN_ASSISTANT_LIMITS } from "@/lib/rate-limit";
import { SESSION_COOKIE_NAME } from "@/lib/constants";

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
export async function POST(request: NextRequest) {
  // Student auth via session token cookie (not Supabase Auth)
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: session } = await supabase
    .from("student_sessions")
    .select("student_id")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (!session) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const studentId = session.student_id;

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
}

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
export async function GET(request: NextRequest) {
  // Student auth via session token cookie
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: session } = await supabase
    .from("student_sessions")
    .select("student_id")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (!session) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const getStudentId = session.student_id;

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
      let query = supabase
        .from("design_conversations")
        .select("*")
        .eq("student_id", getStudentId)
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
}
