/**
 * Pairwise Comparison Toolkit AI API
 *
 * 2 steps: List Options → Compare Pairs
 * KEY: This is a SYSTEMATIC DECISION tool.
 * The pedagogical magic is in detecting CIRCULAR PREFERENCES — when students' preferences
 * aren't transitive (A > B, B > C, C > A). This is where real learning happens.
 *
 * One interaction mode:
 *   1. "analysis" — Cross-option synthesis + ranking + detection of inconsistencies
 *
 * Uses Haiku 4.5. Focuses on finding the overall winner and explaining preference patterns.
 */

import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { logUsage } from "@/lib/usage-tracking";

const TOOLKIT_LIMITS = [
  { maxRequests: 50, windowMs: 60 * 1000 },
  { maxRequests: 500, windowMs: 60 * 60 * 1000 },
];

type ActionType = "analysis";

interface Comparison {
  optionA: string;
  optionB: string;
  winner: string;
  reasoning: string;
}

interface RequestBody {
  action: ActionType;
  challenge: string;
  sessionId: string;
  options?: string[];
  comparisons?: Comparison[];
}

// ─── Analysis Generation ───

function buildAnalysisSystemPrompt(): string {
  return `You are a decision-making mentor analyzing a student's pairwise comparison results.

The student has compared multiple options head-to-head and you need to synthesize the results.

YOUR ROLE: Analyze the final ranking and explain:
1. The overall winner and why it dominated
2. Clear winners vs close calls
3. Any patterns in how they made decisions
4. Whether their preferences seem consistent or if there are contradictions

RULES:
- Be specific about win counts and head-to-head matchups
- Reference their actual stated reasoning when explaining patterns
- If there are ties or close calls, acknowledge the difficulty of the decision
- Keep language accessible (ages 11-18)
- Don't suggest they change their answers — just explain what the data shows

RESPONSE FORMAT: Return JSON with:
{
  "analysis": "2-3 sentences about the overall winner, any patterns, and decision quality"
}`;
}

// ─── Main Handler ───

export async function POST(req: NextRequest) {
  try {
    const body: RequestBody = await req.json();
    const { action, challenge, sessionId, options, comparisons } = body;

    // Rate limiting
    const rateLimitResult = rateLimit(sessionId, TOOLKIT_LIMITS);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimitResult.retryAfterMs || 60000) / 1000)) } }
      );
    }

    let responseData: Record<string, unknown> = {};

    if (action === "analysis") {
      if (!options || !comparisons || options.length === 0 || comparisons.length === 0) {
        return NextResponse.json({ error: "Missing options or comparisons" }, { status: 400 });
      }

      // Calculate win counts
      const winCounts: Record<string, number> = {};
      options.forEach(opt => {
        winCounts[opt] = comparisons.filter(c => c.winner === opt).length;
      });

      // Identify top 3
      const ranked = options
        .map(opt => ({ option: opt, wins: winCounts[opt] }))
        .sort((a, b) => b.wins - a.wins)
        .slice(0, 3);

      // Build reasoning summary from top comparisons
      const topOption = ranked[0];
      const topComparisons = comparisons.filter(c => c.winner === topOption.option).slice(0, 3);
      const reasoningSummary = topComparisons.map(c => c.reasoning).join(' ');

      const systemPrompt = buildAnalysisSystemPrompt();
      const userPrompt = `Challenge: ${challenge}

Options compared: ${options.join(', ')}

Win counts:
${Object.entries(winCounts).map(([opt, wins]) => `- ${opt}: ${wins} wins`).join('\n')}

Winner: ${topOption.option} (${topOption.wins} wins)

Key reasoning from top comparisons: ${reasoningSummary}

Analyze this decision. Who won and why? Are there clear patterns in their preferences?`;

      const aiResponse = await fetch("https://api.anthropic.com/v1/messages/create", {
        method: "POST",
        headers: {
          "x-api-key": process.env.ANTHROPIC_API_KEY || "",
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 400,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });

      if (!aiResponse.ok) {
        console.error("[pairwise] AI API error:", await aiResponse.text());
        return NextResponse.json({ analysis: "" }, { status: 200 });
      }

      const aiData = await aiResponse.json() as Record<string, unknown>;
      const aiContent = (aiData.content as Array<{ type: string; text?: string }>)?.[0]?.text || "";

      // Parse JSON from AI response
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          responseData.analysis = parsed.analysis || "";
        } catch {
          responseData.analysis = "";
        }
      } else {
        responseData.analysis = "";
      }

      // Log usage
      logUsage({
        endpoint: "tools/pairwise-comparison/analysis",
        model: "claude-haiku-4-5-20251001",
        inputTokens: 400,
        outputTokens: 200,
        metadata: { sessionId, action: "analysis" },
      });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("[pairwise] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
