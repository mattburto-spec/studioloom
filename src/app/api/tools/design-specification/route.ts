// audit-skip: public anonymous free-tool, no actor identity
/**
 * Design Specification Toolkit AI API
 *
 * 5-section form: Requirements, Constraints, User Needs, Success Criteria, Specifications
 *
 * Actions:
 *   1. "analyze" — AI analyzes completeness, flags gaps, checks for measurability
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

function buildAnalysisSystemPrompt(): string {
  return `You are a design engineering mentor evaluating a student's Design Specification.

A well-formed spec has five sections:
1. REQUIREMENTS: Measurable functional requirements (must do X)
2. CONSTRAINTS: Cost, time, materials, tools, physical/safety limits
3. USER NEEDS: Comfort, usability, aesthetics, emotional response
4. SUCCESS CRITERIA: How you'll TEST and measure if it works
5. SPECIFICATIONS: Precise measurements, materials, dimensions, finishes

YOUR ROLE: Read the student's specification and provide constructive feedback.

EVALUATION CRITERIA:
- Are the requirements measurable? ("Must support 5kg" yes, "Must be strong" no)
- Are constraints specific? (Budget $X, not "not too expensive")
- Do success criteria map to tests? (If you can't test it, it's not a criterion)
- Are specifications precise? (Dimensions in mm, weights in g, not "about that big")

FEEDBACK STYLE:
- Celebrate what's present and specific
- Flag ONE missing area if applicable
- Suggest ONE concrete refinement

RESPONSE FORMAT: Return a JSON object:
{
  "analysis": "Your feedback here (2-3 sentences max)"
}`;
}

// ─── POST handler ───

export async function POST(request: NextRequest) {
  const validated = await validateToolkitRequest(request, "design-specification", ["analyze"]);
  if (validated.error) return validated.error;
  const { body } = validated;
  const { action, sessionId } = body;

  try {
    /* ─── Action: Analyze specification ─── */
    if (action === "analyze") {
      const { designTopic = "", sections = {} } = body;
      if (!designTopic || !(sections as Record<string, string>).requirements) {
        return Response.json({ error: "Missing required fields" }, { status: 400 });
      }

      const userPrompt = `Design Topic: ${designTopic}

REQUIREMENTS:
${(sections as Record<string, string>).requirements || "(not filled)"}

CONSTRAINTS:
${(sections as Record<string, string>).constraints || "(not filled)"}

USER NEEDS:
${(sections as Record<string, string>).userNeeds || "(not filled)"}

SUCCESS CRITERIA:
${(sections as Record<string, string>).successCriteria || "(not filled)"}

SPECIFICATIONS:
${(sections as Record<string, string>).specifications || "(not filled)"}

Evaluate this design specification. Is it specific? Is it measurable? What needs improvement?`;

      const result = await callHaiku(buildAnalysisSystemPrompt(), userPrompt, 200);
      const parsed = parseToolkitJSON(result.text, { analysis: result.text.trim() });

      logToolkitUsage("tools/design-specification/analyze", result, {
        sessionId,
        action: "analyze",
      });

      return Response.json({
        analysis: parsed.analysis || result.text.trim(),
      });
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return toolkitErrorResponse("design-specification", err);
  }
}
