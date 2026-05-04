// audit-skip: public anonymous free-tool, no actor identity
/**
 * Point of View Statement Toolkit AI API
 *
 * 3-step flow: User + Need + Insight → formatted POV statement
 *
 * Actions:
 *   1. "evaluate" — AI evaluates quality of the POV statement and suggests refinements
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

function buildEvaluationSystemPrompt(): string {
  return `You are a design thinking mentor evaluating a student's Point of View (POV) statement.

A well-formed POV statement has three parts:
1. USER: Specific, named, with context (not "people" — a particular person)
2. NEED: A verb-based need (to DO, FEEL, LEARN — not a product/thing)
3. INSIGHT: A surprising, non-obvious reason that reframes the problem

YOUR ROLE: Read the student's three-part statement and provide constructive feedback.

EVALUATION CRITERIA:
- User: Is this a specific person with context? (Not "users" — a name, age, background detail.)
- Need: Is this a need (verb-based) or a want/product? Does it answer "what do they need to DO or FEEL?"
- Insight: Is the insight surprising? Does it reframe the problem in a non-obvious way? Or is it a cliché reason?

FEEDBACK STYLE:
- Celebrate what's strong first
- Identify one area for improvement
- Suggest ONE specific refinement

RESPONSE FORMAT: Return a JSON object:
{
  "evaluation": "Your feedback here (2-3 sentences max)"
}`;
}

// ─── POST handler ───

export async function POST(request: NextRequest) {
  const validated = await validateToolkitRequest(request, "pov-statement", ["evaluate"]);
  if (validated.error) return validated.error;
  const { body } = validated;
  const { action, sessionId } = body;

  try {
    /* ─── Action: Evaluate POV statement ─── */
    if (action === "evaluate") {
      const { userDescription = "", needDescription = "", insightDescription = "" } = body;
      if (!userDescription || !needDescription || !insightDescription) {
        return Response.json({ error: "Missing required fields" }, { status: 400 });
      }

      const userPrompt = `Here's the student's POV statement:

USER: ${userDescription}

NEED: ${needDescription}

INSIGHT: ${insightDescription}

Evaluate this statement. Is it specific? Is the need verb-based? Is the insight surprising?`;

      const result = await callHaiku(buildEvaluationSystemPrompt(), userPrompt, 200);
      const parsed = parseToolkitJSON(result.text, { evaluation: result.text.trim() });

      logToolkitUsage("tools/pov-statement/evaluate", result, {
        sessionId,
        action: "evaluate",
      });

      return Response.json({
        evaluation: parsed.evaluation || result.text.trim(),
      });
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return toolkitErrorResponse("pov-statement", err);
  }
}
