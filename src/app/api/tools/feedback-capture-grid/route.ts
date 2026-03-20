/**
 * Feedback Capture Grid Toolkit AI API
 *
 * 4-quadrant form: Likes, Wishes, Questions, Ideas
 *
 * Actions:
 *   1. "synthesize" — AI synthesizes feedback into top 3 action items
 *
 * Uses shared toolkit helpers — see src/lib/toolkit/shared-api.ts
 */

import { NextRequest } from "next/server";
import {
  callHaiku,
  validateToolkitRequest,
  parseToolkitJSON,
  logToolkitUsage,
  toolkitErrorResponse,
} from "@/lib/toolkit";

// ─── Tool-specific prompt builders ───

function buildSynthesisSystemPrompt(): string {
  return `You are a design feedback facilitator. You've just collected feedback using the Feedback Capture Grid method.

The four quadrants are:
1. LIKES: What works well
2. WISHES: What could be better (constructive improvements)
3. QUESTIONS: What's unclear or missing information
4. IDEAS: New possibilities and suggestions

YOUR ROLE: Read the feedback across all quadrants and synthesize into TOP 3 ACTION ITEMS.

ACTION ITEMS should be:
- Specific (not vague)
- Achievable (not pie-in-the-sky)
- Prioritized by frequency and impact (if multiple people said the same thing, it's important)
- Balanced between quick wins and deeper improvements

RESPONSE FORMAT: Return a JSON object:
{
  "synthesis": "1. [First priority action with specific outcome]\n2. [Second priority action]\n3. [Third priority action]"
}`;
}

// ─── POST handler ───

export async function POST(request: NextRequest) {
  const validated = await validateToolkitRequest(request, "feedback-capture-grid", ["synthesize"]);
  if (validated.error) return validated.error;
  const { body } = validated;
  const { action, sessionId } = body;

  try {
    /* ─── Action: Synthesize feedback ─── */
    if (action === "synthesize") {
      const { prototypeDescription = "", feedback = {} } = body;
      if (!prototypeDescription || !(feedback as Record<string, string>).likes) {
        return Response.json({ error: "Missing required fields" }, { status: 400 });
      }

      const userPrompt = `Prototype: ${prototypeDescription}

LIKES (What works well):
${(feedback as Record<string, string>).likes || "(none provided)"}

WISHES (What could be better):
${(feedback as Record<string, string>).wishes || "(none provided)"}

QUESTIONS (What's unclear):
${(feedback as Record<string, string>).questions || "(none provided)"}

IDEAS (New possibilities):
${(feedback as Record<string, string>).ideas || "(none provided)"}

Synthesize this feedback into top 3 action items for improvement.`;

      const result = await callHaiku(buildSynthesisSystemPrompt(), userPrompt, 250);
      const parsed = parseToolkitJSON(result.text, { synthesis: result.text.trim() });

      logToolkitUsage("tools/feedback-capture-grid/synthesize", result, {
        sessionId,
        action: "synthesize",
      });

      return Response.json({
        synthesis: parsed.synthesis || result.text.trim(),
      });
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return toolkitErrorResponse("feedback-capture-grid", err);
  }
}
