import { NextRequest, NextResponse } from "next/server";
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";
import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "@/lib/ai/models";

// ─────────────────────────────────────────────────────────────────
// AI Field Suggestion — generates 3 text suggestions for a
// specific lesson field (hook, focus, protocol, prompt, etc.)
// Uses Haiku 4.5 for speed and cost efficiency.
// ─────────────────────────────────────────────────────────────────

const FIELD_PROMPTS: Record<string, string> = {
  hook: `Generate 3 engaging lesson hooks/openers. Each should grab student attention in under 60 seconds.
Types: provocative question, surprising fact, quick physical activity, visual stimulus, real-world scenario, "what if" challenge.
Hooks should be age-appropriate for secondary students (ages 11-18).`,

  focus: `Generate 3 mini-lesson focus descriptions. Each should clearly state what students will learn in direct instruction.
Keep each under 2 sentences. Be specific about skills, concepts, or techniques.
Format for a teacher audience — these are planning notes, not student-facing.`,

  protocol: `Generate 3 debrief protocols suitable for the lesson. Choose from:
Think-Pair-Share, Gallery Walk, Exit Ticket, 3-2-1 (3 things learned, 2 connections, 1 question),
Whip Around (quick verbal check), Muddiest Point, One-Word Summary, Fist-to-Five, Two Stars and a Wish.
For each, include the protocol name and a one-line description of how to run it.`,

  prompt: `Generate 3 reflective debrief questions for students. Each should:
- Be open-ended (not yes/no)
- Connect to the lesson's learning goal
- Push metacognition ("How did you..." not "What did you...")
- Be answerable in 2-3 sentences
One should be about process, one about content, one about connections.`,
};

export async function POST(req: NextRequest) {
  const auth = await requireTeacherAuth(req);
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json();
    const { field, phase, lessonTitle, learningGoal, currentValue, extra, unitType } = body;

    const fieldPrompt = FIELD_PROMPTS[field] || FIELD_PROMPTS.focus;

    const anthropic = new Anthropic();

    // Type-aware system prompt
    const roleMap: Record<string, string> = {
      design: "design & technology teachers",
      service: "service learning coordinators",
      personal_project: "MYP Personal Project supervisors",
      inquiry: "inquiry-based learning facilitators",
    };
    const role = roleMap[unitType] || "design & technology teachers";

    const response = await anthropic.messages.create({
      model: MODELS.HAIKU,
      max_tokens: 500,
      system: `You are a lesson planning assistant for ${role}. You generate practical, specific suggestions for lesson planning fields. Always return valid JSON.`,
      messages: [
        {
          role: "user",
          content: `I'm planning a lesson called "${lessonTitle || "Untitled"}"${
            learningGoal ? ` with learning goal: "${learningGoal}"` : ""
          }. I need suggestions for the ${phase} phase.

${currentValue ? `Current content (to improve on or offer alternatives to): "${currentValue}"` : "The field is currently empty."}

${extra ? `Additional context: ${extra}` : ""}

${fieldPrompt}

Return a JSON array of exactly 3 strings. Each string is one complete suggestion.
Example: ["suggestion 1", "suggestion 2", "suggestion 3"]
Return ONLY the JSON array, nothing else.`,
        },
      ],
    });

    // Parse the response
    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    let suggestions: string[] = [];
    try {
      // Try to parse as JSON array
      const parsed = JSON.parse(text.trim());
      if (Array.isArray(parsed)) {
        suggestions = parsed.filter((s): s is string => typeof s === "string").slice(0, 3);
      }
    } catch {
      // Fallback: try to extract JSON array from text
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        try {
          const parsed = JSON.parse(match[0]);
          if (Array.isArray(parsed)) {
            suggestions = parsed.filter((s): s is string => typeof s === "string").slice(0, 3);
          }
        } catch {
          // Split by numbered lines as last resort
          suggestions = text
            .split(/\n/)
            .map((l) => l.replace(/^\d+[\.\)]\s*/, "").trim())
            .filter((l) => l.length > 10)
            .slice(0, 3);
        }
      }
    }

    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error("[ai-field] Error:", err);
    return NextResponse.json(
      { error: "Failed to generate suggestions" },
      { status: 500 }
    );
  }
}
