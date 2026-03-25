/**
 * Design Assistant — Conversation Management (Layer 3)
 *
 * Manages conversation lifecycle: create, load, append turns,
 * track Bloom's level and effort score, generate AI responses.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { DesignConversation, ConversationTurn } from "@/types";
import {
  buildDesignAssistantSystemPrompt,
  suggestQuestionType,
  assessEffort,
} from "@/lib/ai/design-assistant-prompt";
import { buildOpenStudioSystemPrompt } from "@/lib/ai/open-studio-prompt";
import { getTeachingContext, getFrameworkFromContext } from "@/lib/ai/teacher-context";
import { getFramework } from "@/lib/frameworks";
import { logUsage } from "@/lib/usage-tracking";

// =========================================================================
// CONVERSATION CRUD
// =========================================================================

/**
 * Create a new design assistant conversation.
 */
export async function createConversation(
  studentId: string,
  unitId: string,
  pageId?: string
): Promise<DesignConversation> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("design_conversations")
    .insert({
      student_id: studentId,
      unit_id: unitId,
      page_id: pageId || null,
      bloom_level: 1,
      effort_score: 5,
      turn_count: 0,
    })
    .select("*")
    .single();

  if (error) throw new Error(`Failed to create conversation: ${error.message}`);

  return mapConversation(data);
}

/**
 * Load an existing conversation with all its turns.
 */
export async function loadConversation(
  conversationId: string
): Promise<{ conversation: DesignConversation; turns: ConversationTurn[] }> {
  const supabase = createAdminClient();

  const [convResult, turnsResult] = await Promise.all([
    supabase
      .from("design_conversations")
      .select("*")
      .eq("id", conversationId)
      .single(),
    supabase
      .from("design_conversation_turns")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("turn_number", { ascending: true }),
  ]);

  if (convResult.error) throw new Error(`Conversation not found: ${convResult.error.message}`);

  return {
    conversation: mapConversation(convResult.data),
    turns: (turnsResult.data || []).map(mapTurn),
  };
}

/**
 * Append a turn to an existing conversation.
 */
export async function appendTurn(
  conversationId: string,
  role: "student" | "assistant",
  content: string,
  questionType?: string,
  bloomLevel?: number
): Promise<ConversationTurn> {
  const supabase = createAdminClient();

  // Get current turn count
  const { data: conv } = await supabase
    .from("design_conversations")
    .select("turn_count")
    .eq("id", conversationId)
    .single();

  const turnNumber = (conv?.turn_count || 0) + 1;

  // Insert turn
  const { data: turn, error: turnError } = await supabase
    .from("design_conversation_turns")
    .insert({
      conversation_id: conversationId,
      turn_number: turnNumber,
      role,
      content,
      question_type: questionType || null,
      bloom_level: bloomLevel || null,
    })
    .select("*")
    .single();

  if (turnError) throw new Error(`Failed to append turn: ${turnError.message}`);

  // Update conversation turn count
  await supabase
    .from("design_conversations")
    .update({ turn_count: turnNumber })
    .eq("id", conversationId);

  return mapTurn(turn);
}

/**
 * Update effort score on a conversation.
 * Clamps between 0 and 10.
 */
export async function updateEffortScore(
  conversationId: string,
  delta: number
): Promise<number> {
  const supabase = createAdminClient();

  const { data: conv } = await supabase
    .from("design_conversations")
    .select("effort_score")
    .eq("id", conversationId)
    .single();

  const currentScore = conv?.effort_score ?? 5;
  const newScore = Math.max(0, Math.min(10, currentScore + delta));

  await supabase
    .from("design_conversations")
    .update({ effort_score: newScore })
    .eq("id", conversationId);

  return newScore;
}

/**
 * Adapt Bloom's level based on conversation progress.
 * Simple heuristic: increase every 4 turns if student shows effort.
 */
export async function adaptBloomLevel(
  conversationId: string
): Promise<number> {
  const supabase = createAdminClient();

  const { data: conv } = await supabase
    .from("design_conversations")
    .select("bloom_level, effort_score, turn_count")
    .eq("id", conversationId)
    .single();

  if (!conv) return 1;

  let bloomLevel = conv.bloom_level || 1;

  // Increase Bloom's level every 4 student turns if effort is decent
  if (conv.turn_count > 0 && conv.turn_count % 4 === 0 && conv.effort_score >= 4) {
    bloomLevel = Math.min(6, bloomLevel + 1);
    await supabase
      .from("design_conversations")
      .update({ bloom_level: bloomLevel })
      .eq("id", conversationId);
  }

  return bloomLevel;
}

/**
 * End a conversation (set ended_at timestamp).
 */
export async function endConversation(
  conversationId: string,
  summary?: string
): Promise<void> {
  const supabase = createAdminClient();

  await supabase
    .from("design_conversations")
    .update({
      ended_at: new Date().toISOString(),
      summary: summary || null,
    })
    .eq("id", conversationId);
}

// =========================================================================
// AI RESPONSE GENERATION
// =========================================================================

/**
 * Generate a Socratic mentor response to a student message.
 *
 * Flow:
 * 1. Assess student effort (word count heuristic)
 * 2. Update effort score
 * 3. Adapt Bloom's level if appropriate
 * 4. Build system prompt with current context
 * 5. Call AI with conversation history
 * 6. Store both student turn and assistant turn
 * 7. Return the assistant's response
 */
export async function generateResponse(
  conversationId: string,
  studentMessage: string,
  apiKey: string
): Promise<{
  response: string;
  questionType: string;
  bloomLevel: number;
  effortScore: number;
}> {
  // 1. Load conversation + turns
  const { conversation, turns } = await loadConversation(conversationId);

  // 2. Assess effort from student message
  const effortDelta = assessEffort(studentMessage);
  const effortScore = await updateEffortScore(conversationId, effortDelta);

  // 3. Adapt Bloom's level
  const bloomLevel = await adaptBloomLevel(conversationId);

  // 4. Store student turn
  await appendTurn(conversationId, "student", studentMessage, undefined, bloomLevel);

  // 5. Get activity context
  const activityContext = await getActivityContext(conversation.unitId, conversation.pageId);

  // 6. Get class framework (Service Learning, PYP Exhibition, etc.)
  // Falls back to teacher's curriculum framework for vocabulary if no class framework
  const classFramework = await getClassFrameworkForStudent(conversation.studentId, conversation.unitId);
  const teachingContext = classFramework
    ? null
    : await getTeacherFrameworkForStudent(conversation.unitId);
  const effectiveFramework = classFramework || teachingContext?.framework;

  // 7. Check Open Studio status — switches entire prompt mode
  const openStudioMode = await checkOpenStudioStatus(
    conversation.studentId,
    conversation.unitId
  );

  // 8. Build system prompt (guided vs Open Studio)
  let systemPrompt: string;
  if (openStudioMode) {
    systemPrompt = buildOpenStudioSystemPrompt({
      focusArea: openStudioMode.focusArea || undefined,
      unitTopic: activityContext?.unitTopic,
      gradeLevel: activityContext?.gradeLevel,
      framework: effectiveFramework,
      criterionTags: activityContext?.criterionTags,
      previousTurns: turns.length,
      interactionType: "student_message",
    });
  } else {
    systemPrompt = buildDesignAssistantSystemPrompt({
      bloomLevel,
      effortScore,
      framework: effectiveFramework,
      activityTitle: activityContext?.title,
      activityPrompt: activityContext?.prompt,
      unitTopic: activityContext?.unitTopic,
      gradeLevel: activityContext?.gradeLevel,
      criterionTags: activityContext?.criterionTags,
      previousTurns: turns.length,
    });
  }

  // 8. Build conversation messages for AI
  const messages = turns.map((t) => ({
    role: t.role === "student" ? "user" as const : "assistant" as const,
    content: t.content,
  }));
  messages.push({ role: "user", content: studentMessage });

  // 9. Call AI
  const response = await callDesignAssistantAI(systemPrompt, messages, apiKey);

  // 10. Determine question type
  const questionType = suggestQuestionType(
    Math.floor(turns.length / 2) + 1, // approximate student turn number
    bloomLevel
  );

  // 11. Store assistant turn
  await appendTurn(conversationId, "assistant", response, questionType, bloomLevel);

  return {
    response,
    questionType,
    bloomLevel,
    effortScore,
  };
}

// =========================================================================
// HELPERS
// =========================================================================

interface ActivityContext {
  title?: string;
  prompt?: string;
  unitTopic?: string;
  gradeLevel?: string;
  criterionTags?: string[];
}

/**
 * Fetch activity context for the student's current page.
 */
async function getActivityContext(
  unitId: string,
  pageId?: string | null
): Promise<ActivityContext | null> {
  if (!pageId) return null;

  const supabase = createAdminClient();

  // Get unit info for topic/grade
  const { data: unit } = await supabase
    .from("units")
    .select("title, topic, grade_level, journey_data")
    .eq("id", unitId)
    .single();

  if (!unit) return null;

  const result: ActivityContext = {
    unitTopic: unit.topic || unit.title,
    gradeLevel: unit.grade_level,
  };

  // Try to find page/activity context from journey_data
  if (unit.journey_data) {
    try {
      const journeyData = typeof unit.journey_data === "string"
        ? JSON.parse(unit.journey_data)
        : unit.journey_data;

      // journey_data contains activities; find one matching pageId
      if (Array.isArray(journeyData.activities)) {
        const activity = journeyData.activities.find(
          (a: { id?: string; pageId?: string }) =>
            a.id === pageId || a.pageId === pageId
        );
        if (activity) {
          result.title = activity.title;
          result.prompt = activity.prompt;
          result.criterionTags = activity.criterionTags;
        }
      }
    } catch {
      // Non-critical
    }
  }

  return result;
}

/**
 * Get the teacher's curriculum framework for a student's unit.
 * Looks up the unit creator's teaching context.
 */
async function getTeacherFrameworkForStudent(
  unitId: string
): Promise<{ framework?: string } | null> {
  const supabase = createAdminClient();

  // Find the teacher who created this unit
  const { data: unit } = await supabase
    .from("units")
    .select("teacher_id")
    .eq("id", unitId)
    .single();

  if (!unit?.teacher_id) return null;

  const teachingContext = await getTeachingContext(unit.teacher_id);
  if (!teachingContext) return null;

  return { framework: getFrameworkFromContext(teachingContext) };
}

/**
 * Get the class-level framework for a student's unit.
 * Looks up: student → class_students → classes.framework
 * Returns the framework ID (e.g., "service_learning") or null if not found/default.
 */
async function getClassFrameworkForStudent(
  studentId: string,
  unitId: string
): Promise<string | null> {
  const supabase = createAdminClient();

  // Find which class this student is in for this unit
  // class_students → class_units → classes.framework
  const { data: classStudents } = await supabase
    .from("class_students")
    .select("class_id")
    .eq("student_id", studentId);

  if (!classStudents || classStudents.length === 0) {
    // Fallback: check legacy students.class_id
    const { data: student } = await supabase
      .from("students")
      .select("class_id")
      .eq("id", studentId)
      .maybeSingle();

    if (!student?.class_id) return null;

    // Check if this class has the unit assigned
    const { data: classUnit } = await supabase
      .from("class_units")
      .select("class_id")
      .eq("class_id", student.class_id)
      .eq("unit_id", unitId)
      .maybeSingle();

    if (!classUnit) return null;

    const { data: cls } = await supabase
      .from("classes")
      .select("framework")
      .eq("id", student.class_id)
      .maybeSingle();

    const fw = cls?.framework;
    return fw && fw !== "myp_design" ? fw : null;
  }

  // Find the class that has this unit assigned
  const classIds = classStudents.map((cs: { class_id: string }) => cs.class_id);

  const { data: classUnit } = await supabase
    .from("class_units")
    .select("class_id")
    .eq("unit_id", unitId)
    .in("class_id", classIds)
    .maybeSingle();

  if (!classUnit) return null;

  const { data: cls } = await supabase
    .from("classes")
    .select("framework")
    .eq("id", classUnit.class_id)
    .maybeSingle();

  const fw = cls?.framework;
  // Only return non-default frameworks — null means "use teacher context as before"
  return fw && fw !== "myp_design" ? fw : null;
}

/**
 * Call the AI with the design assistant system prompt and conversation history.
 * Uses Claude Haiku for fast, cheap responses (~1-2s).
 */
async function callDesignAssistantAI(
  systemPrompt: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  apiKey: string
): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300, // Short responses — mentor asks ONE question
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI call failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();

  // Extract text from response
  const fallback = "I'm having trouble thinking of a question right now. Can you tell me more about what you're working on?";
  let text = fallback;
  if (data.content && Array.isArray(data.content)) {
    const textBlock = data.content.find(
      (block: { type: string; text?: string }) => block.type === "text"
    );
    text = textBlock?.text || fallback;
  }

  // Log usage (fire-and-forget)
  logUsage({
    endpoint: "design-assistant",
    model: "claude-haiku-4-5-20251001",
    inputTokens: data.usage?.input_tokens,
    outputTokens: data.usage?.output_tokens,
    metadata: {
      response_length: text.length,
      ...(text.length > 1200 ? { oversized: true } : {}),
    },
  });

  // Response length heuristic — warn on oversized responses
  if (text.length > 1200) {
    console.warn(
      `[design-assistant] Oversized response: ${text.length} chars (expected <1200)`
    );
  }

  return text;
}

// =========================================================================
// OPEN STUDIO MODE CHECK
// =========================================================================

/**
 * Check if a student has Open Studio unlocked for this unit.
 * If so, return the active session's focus area (if any).
 * Returns null if not in Open Studio mode.
 */
async function checkOpenStudioStatus(
  studentId: string,
  unitId: string
): Promise<{ focusArea: string | null } | null> {
  const supabase = createAdminClient();

  const { data: status } = await supabase
    .from("open_studio_status")
    .select("id, status")
    .eq("student_id", studentId)
    .eq("unit_id", unitId)
    .eq("status", "unlocked")
    .single();

  if (!status) return null;

  // Try to get active session's focus area
  const { data: session } = await supabase
    .from("open_studio_sessions")
    .select("focus_area")
    .eq("student_id", studentId)
    .eq("unit_id", unitId)
    .eq("status_id", status.id)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .single();

  return { focusArea: session?.focus_area || null };
}

// =========================================================================
// DATA MAPPERS
// =========================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapConversation(row: any): DesignConversation {
  return {
    id: row.id,
    studentId: row.student_id,
    unitId: row.unit_id,
    pageId: row.page_id || undefined,
    startedAt: row.started_at || row.created_at,
    endedAt: row.ended_at || undefined,
    turnCount: row.turn_count || 0,
    bloomLevel: row.bloom_level || 1,
    effortScore: row.effort_score ?? 5,
    summary: row.summary || undefined,
  };
}

function mapTurn(row: any): ConversationTurn {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    turnNumber: row.turn_number,
    role: row.role,
    content: row.content,
    questionType: row.question_type || undefined,
    bloomLevel: row.bloom_level || undefined,
    createdAt: row.created_at,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
