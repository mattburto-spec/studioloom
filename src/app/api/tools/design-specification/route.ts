/**
 * Design Specification Toolkit AI API
 *
 * 5-section form: Requirements, Constraints, User Needs, Success Criteria, Specifications
 *
 * Actions:
 *   1. "analyze" — AI analyzes completeness, flags gaps, checks for measurability
 *
 * Uses Haiku 4.5 for speed.
 */

import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { logUsage } from "@/lib/usage-tracking";

const TOOLKIT_LIMITS = [
  { maxRequests: 50, windowMs: 60 * 1000 },
  { maxRequests: 500, windowMs: 60 * 60 * 1000 },
];

type ActionType = "analyze";

interface RequestBody {
  action: ActionType;
  sessionId: string;
  designTopic: string;
  sections: {
    requirements: string;
    constraints: string;
    userNeeds: string;
    successCriteria: string;
    specifications: string;
  };
}

// ─── Analysis System Prompt ───

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

// ─── Handler ───

export async function POST(request: NextRequest) {
  try {
    const clientId = request.headers.get("x-forwarded-for") || "unknown";
    const rateLimitResult = rateLimit(clientId, TOOLKIT_LIMITS);

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 }
      );
    }

    const body: RequestBody = await request.json();
    const { action, sessionId, designTopic, sections } = body;

    if (action !== "analyze") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    if (!designTopic || !sections.requirements) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Build prompt
    const systemPrompt = buildAnalysisSystemPrompt();
    const userPrompt = `Design Topic: ${designTopic}

REQUIREMENTS:
${sections.requirements || "(not filled)"}

CONSTRAINTS:
${sections.constraints || "(not filled)"}

USER NEEDS:
${sections.userNeeds || "(not filled)"}

SUCCESS CRITERIA:
${sections.successCriteria || "(not filled)"}

SPECIFICATIONS:
${sections.specifications || "(not filled)"}

Analyze this specification. Is it complete? Are requirements and criteria measurable? Are specifications precise? What's missing?`;

    // Call Claude Haiku
    const response = await fetch("https://api.anthropic.com/v1/messages/create", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 250,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: userPrompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Claude API error:", error);
      return NextResponse.json(
        { error: "Claude API error" },
        { status: response.status }
      );
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || "";

    // Parse JSON response
    let analysis = content;
    try {
      const parsed = JSON.parse(content);
      analysis = parsed.analysis || content;
    } catch {
      // If not valid JSON, use raw text
    }

    // Log usage
    logUsage({
      userId: sessionId,
      toolId: "design-specification",
      model: "claude-haiku-4-5-20251001",
      action: "analyze",
      inputTokens: data.usage?.input_tokens || 0,
      outputTokens: data.usage?.output_tokens || 0,
    }).catch(console.error);

    return NextResponse.json({
      analysis,
      usage: {
        inputTokens: data.usage?.input_tokens || 0,
        outputTokens: data.usage?.output_tokens || 0,
      },
    });
  } catch (error) {
    console.error("Design Specification API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
