// audit-skip: routine learner activity, low audit value
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudentSession } from "@/lib/access-v2/actor-session";
import { buildOpenStudioSystemPrompt } from "@/lib/ai/open-studio-prompt";
import type { OpenStudioInteraction } from "@/lib/ai/open-studio-prompt";
import { logUsage } from "@/lib/usage-tracking";
import { rateLimit } from "@/lib/rate-limit";
import { MODELS } from "@/lib/ai/models";

/**
 * POST /api/student/open-studio/check-in
 *
 * Triggered client-side on a timer (configurable interval).
 * Handles: periodic check-ins, drift detection, documentation nudges, MYP alignment checks.
 *
 * Body: {
 *   sessionId: string;
 *   unitId: string;
 *   interactionType: "check_in" | "drift_check" | "documentation_nudge" | "alignment_check" | "student_message";
 *   message?: string;                // only for student_message type
 *   minutesSinceActivity?: number;   // for drift detection
 * }
 *
 * Returns: {
 *   response: string;
 *   interactionType: string;
 *   driftFlag?: { level: string; message: string };  // if drift detected
 *   silentFlag?: boolean;            // if drift escalated to silent (don't show to student)
 * }
 */

const CHECK_IN_LIMITS = [
  { maxRequests: 10, windowMs: 60_000 },      // 10/min
  { maxRequests: 60, windowMs: 3_600_000 },    // 60/hour
];

export async function POST(request: NextRequest) {
  const session = await requireStudentSession(request);
  if (session instanceof NextResponse) return session;
  const studentId = session.studentId;

  const supabase = createAdminClient();

  // Rate limit
  const { allowed } = rateLimit(`os-checkin:${studentId}`, CHECK_IN_LIMITS);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many check-ins" },
      { status: 429 }
    );
  }

  const body = await request.json();
  const {
    sessionId,
    unitId,
    interactionType,
    message,
    minutesSinceActivity,
  } = body as {
    sessionId: string;
    unitId: string;
    interactionType: OpenStudioInteraction;
    message?: string;
    minutesSinceActivity?: number;
  };

  if (!sessionId || !unitId || !interactionType) {
    return NextResponse.json(
      { error: "sessionId, unitId, and interactionType are required" },
      { status: 400 }
    );
  }

  // Check API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI not configured" },
      { status: 503 }
    );
  }

  // Load session data
  const { data: osSession } = await supabase
    .from("open_studio_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("student_id", studentId)
    .single();

  if (!osSession) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Load unit context
  const { data: unit } = await supabase
    .from("units")
    .select("title, topic, grade_level")
    .eq("id", unitId)
    .single();

  // Look up the class framework for this student+unit
  let classFramework: string | undefined;
  const { data: classStudents } = await supabase
    .from("class_students")
    .select("class_id")
    .eq("student_id", studentId);

  if (classStudents?.length) {
    const classIds = classStudents.map((cs: { class_id: string }) => cs.class_id);
    const { data: classUnit } = await supabase
      .from("class_units")
      .select("class_id")
      .eq("unit_id", unitId)
      .in("class_id", classIds)
      .maybeSingle();
    if (classUnit) {
      const { data: cls } = await supabase
        .from("classes")
        .select("framework")
        .eq("id", classUnit.class_id)
        .maybeSingle();
      if (cls?.framework) classFramework = cls.framework;
    }
  }

  // Count existing drift flags
  const driftFlags = (osSession.drift_flags as Array<{ level: string }>) || [];
  const driftFlagCount = driftFlags.length;

  // Build system prompt
  let systemPrompt = buildOpenStudioSystemPrompt({
    focusArea: osSession.focus_area || undefined,
    unitTopic: unit?.topic || unit?.title || undefined,
    gradeLevel: unit?.grade_level || undefined,
    framework: classFramework,
    previousTurns: osSession.ai_interactions || 0,
    minutesSinceActivity,
    checkInCount: osSession.check_in_count || 0,
    driftFlagCount,
    interactionType,
  });

  // Append student learning profile hints (non-critical — wrapped in try/catch)
  try {
    const { data: student } = await supabase
      .from("students")
      .select("learning_profile")
      .eq("id", studentId)
      .maybeSingle();

    if (student?.learning_profile) {
      const p = student.learning_profile as {
        design_confidence?: number;
        languages_at_home?: string[];
        working_style?: string;
        learning_differences?: string[];
      };
      const hints: string[] = [];

      // Multilingual awareness
      if (p.languages_at_home && p.languages_at_home.length > 1) {
        hints.push("This student is multilingual — keep language clear and simple.");
      }

      // Design confidence
      if (p.design_confidence && p.design_confidence <= 2) {
        hints.push("Low design confidence — be extra encouraging, celebrate small progress.");
      } else if (p.design_confidence && p.design_confidence >= 4) {
        hints.push("High design confidence — challenge them, push for deeper thinking.");
      }

      // Learning accommodations
      if (p.learning_differences?.includes("adhd")) {
        hints.push("ADHD self-disclosed — keep responses very short, one action at a time.");
      }
      if (p.learning_differences?.includes("anxiety")) {
        hints.push("Anxiety self-disclosed — use calm, reassuring language. Normalize uncertainty.");
      }
      if (p.learning_differences?.includes("dyslexia")) {
        hints.push("Dyslexia self-disclosed — use simple sentence structure, never comment on spelling.");
      }
      if (p.learning_differences?.includes("autism")) {
        hints.push("Autism self-disclosed — be explicit and literal. Respect detail-orientation.");
      }

      if (hints.length > 0) {
        systemPrompt += `\n\n[STUDENT PROFILE — private, never mention directly]\n${hints.join("\n")}`;
      }
    }
  } catch (profileErr) {
    console.error("[open-studio] Profile load non-critical:", profileErr);
  }

  // Build messages
  const messages: Array<{ role: "user" | "assistant"; content: string }> = [];

  if (interactionType === "student_message" && message) {
    messages.push({ role: "user", content: message });
  } else {
    // For system-initiated interactions, we send a synthetic user message
    // that the AI interprets based on the system prompt's interaction instructions
    const syntheticMessage = buildSyntheticMessage(interactionType, minutesSinceActivity);
    messages.push({ role: "user", content: syntheticMessage });
  }

  try {
    // Call AI
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODELS.HAIKU,
        max_tokens: 200, // Check-ins should be very brief
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI call failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    // Extract response text
    let text = "How's it going?";
    if (data.content && Array.isArray(data.content)) {
      const textBlock = data.content.find(
        (block: { type: string; text?: string }) => block.type === "text"
      );
      text = textBlock?.text || text;
    }

    // Log usage (fire-and-forget)
    logUsage({
      studentId,
      endpoint: "open-studio-check-in",
      model: MODELS.HAIKU,
      inputTokens: data.usage?.input_tokens,
      outputTokens: data.usage?.output_tokens,
      metadata: { interactionType },
    });

    // Handle drift detection — check if this was a silent flag
    let silentFlag = false;
    let driftFlag: { level: string; message: string } | undefined;

    if (interactionType === "drift_check") {
      if (driftFlagCount >= 2) {
        // Third drift = silent flag to teacher, don't show to student
        silentFlag = true;
        driftFlag = {
          level: "silent",
          message: text,
        };
      } else {
        driftFlag = {
          level: driftFlagCount === 0 ? "gentle" : "direct",
          message: text,
        };
      }

      // Store drift flag in session
      const updatedFlags = [
        ...driftFlags,
        {
          level: driftFlag.level,
          message: text,
          timestamp: new Date().toISOString(),
        },
      ];

      await supabase
        .from("open_studio_sessions")
        .update({ drift_flags: updatedFlags })
        .eq("id", sessionId);

      // If this is the third drift flag, also trigger revocation check
      if (driftFlagCount >= 2) {
        // Check if student has had drift flags in the PREVIOUS session too
        const { data: previousSessions } = await supabase
          .from("open_studio_sessions")
          .select("drift_flags")
          .eq("student_id", studentId)
          .eq("unit_id", unitId)
          .neq("id", sessionId)
          .order("started_at", { ascending: false })
          .limit(1);

        const previousDrifts = previousSessions?.[0]?.drift_flags as Array<{ level: string }> | undefined;
        const previousHadSilent = previousDrifts?.some((f) => f.level === "silent");

        if (previousHadSilent) {
          // Two consecutive sessions with silent drift flags → auto-revoke
          await supabase
            .from("open_studio_status")
            .update({
              status: "revoked",
              revoked_at: new Date().toISOString(),
              revoked_reason: "drift_detected",
            })
            .eq("student_id", studentId)
            .eq("unit_id", unitId)
            .eq("status", "unlocked");
        }
      }
    }

    // Update check-in count
    if (interactionType === "check_in") {
      await supabase
        .from("open_studio_sessions")
        .update({
          check_in_count: (osSession.check_in_count || 0) + 1,
        })
        .eq("id", sessionId);
    }

    return NextResponse.json({
      response: silentFlag ? null : text, // Don't send text to student if silent flag
      interactionType,
      driftFlag: driftFlag || undefined,
      silentFlag,
    });
  } catch (err) {
    console.error("[open-studio] Check-in error:", err);
    return NextResponse.json(
      { error: "Check-in failed" },
      { status: 500 }
    );
  }
}

/**
 * Build a synthetic "user" message for system-initiated interactions.
 * The AI uses its system prompt to determine how to respond.
 */
function buildSyntheticMessage(
  type: OpenStudioInteraction,
  minutesSinceActivity?: number
): string {
  switch (type) {
    case "check_in":
      return "[SYSTEM: Periodic check-in triggered. Respond with a brief, non-intrusive nudge.]";
    case "drift_check":
      return `[SYSTEM: Drift detection triggered. ${minutesSinceActivity ? `No meaningful activity for ~${minutesSinceActivity} minutes.` : "Signs of stalling detected."} Respond according to the escalation level in your instructions.]`;
    case "documentation_nudge":
      return "[SYSTEM: Documentation nudge triggered. Gently remind the student to capture their process.]";
    case "alignment_check":
      return "[SYSTEM: MYP alignment check triggered. Make a gentle connection between their work and assessment criteria.]";
    default:
      return "[SYSTEM: Check-in triggered.]";
  }
}
