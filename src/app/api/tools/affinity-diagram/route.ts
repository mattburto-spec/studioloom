/**
 * Affinity Diagram Toolkit AI API
 *
 * Three interaction modes:
 *   1. "nudge"    — Effort-gated feedback on observations (research phase)
 *   2. "clusters" — Suggest natural groupings from observations
 *   3. "insights" — Synthesize patterns and themes across clusters
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

type ActionType = "nudge" | "clusters" | "insights";

interface RequestBody {
  action: ActionType;
  context: string;
  sessionId: string;
  observation?: string;
  allObservations?: string[];
  effortLevel?: "low" | "medium" | "high";
  observations?: string[];
  clusters?: Array<{ name: string; items: string[] }>;
}

function buildNudgeSystemPrompt(effortLevel: "low" | "medium" | "high"): string {
  const effortStrategy: Record<string, string> = {
    low: `EFFORT LEVEL: LOW — The observation is brief or surface-level.
- Do NOT praise a vague observation
- Push for specifics: what exactly did you observe? what details support this?
- The "acknowledgment" MUST be an empty string for low effort`,
    medium: `EFFORT LEVEL: MEDIUM — The observation shows decent effort.
- The "acknowledgment" should note ONE specific detail (3-8 words)
- Push them deeper: what does this observation tell you? what's the underlying cause?
- Ask "what else did you notice about this?"`,
    high: `EFFORT LEVEL: HIGH — The observation is detailed and insightful.
- The "acknowledgment" should celebrate their insight (3-8 words)
- Push for implications: what does this observation mean for your design?
- Ask about edge cases or exceptions to their observation`,
  };

  return `You are a research mentor helping a student collect observations during affinity diagramming.

THIS IS RESEARCH — your job is to encourage depth and specificity.
Push students to notice details, contradictions, and implications.

${effortStrategy[effortLevel]}

YOUR ROLE: Return a JSON object with your feedback.

RULES:
- "acknowledgment": 3-8 word note referencing their specific observation (empty string for low effort)
- "nudge": ONE follow-up question, maximum 25 words
- The question should encourage deeper observation or specificity
- Never suggest groupings yet
- Reference their specific observation

RESPONSE FORMAT: Return ONLY a JSON object:
{"acknowledgment": "Interesting observation about the interface!", "nudge": "What specifically made it confusing — was it the labels, colors, or layout?"}`;
}

function buildClustersSystemPrompt(): string {
  return `You are a design research mentor helping a student find natural clusters in observations.

THE GOAL: Identify 3-5 natural groupings where observations belong together.

YOUR ROLE: Suggest cluster groupings with clear reasoning.

RULES:
- Look for observations that share a common theme, cause, or implication
- Each cluster should have 2+ observations (no singletons)
- The reason should be INSIGHTFUL, not just "they're similar"
- Don't force groupings — if 1-2 observations don't fit, leave them out
- Reasons should reference what the observations reveal (e.g., "all relate to accessibility barriers")

RESPONSE FORMAT: Return a JSON array of cluster objects. Example:
[
  { "items": [0, 2, 5], "reason": "All relate to users struggling with the onboarding flow" },
  { "items": [1, 3, 4], "reason": "Observations about pricing confusion and value perception" }
]

Only include cluster objects. No explanatory text.`;
}

function buildInsightsSystemPrompt(): string {
  return `You are a design research mentor reviewing an affinity diagram. The student has collected observations, grouped them into clusters, and named each cluster.

YOUR ROLE: Help the student see PATTERNS across clusters and what the clusters reveal about their research question.

RULES:
- Identify 2-3 cross-cutting themes that appear in multiple clusters
- Point out surprising connections or contradictions between clusters
- Ask 1 question about what these patterns mean for their design direction
- Be encouraging — affinity diagramming is cognitively demanding
- Keep the whole response under 150 words
- Use simple, clear language for ages 11-18
- Reference SPECIFIC cluster names and observations

RESPONSE FORMAT: 2-3 short paragraphs of plain text. No headers, no bullets, no markdown.`;
}

async function callHaiku(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("AI service not configured");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      temperature: 0.8,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI call failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const textBlock = data.content?.find((b: { type: string }) => b.type === "text");

  return {
    text: textBlock?.text || "",
    inputTokens: data.usage?.input_tokens || 0,
    outputTokens: data.usage?.output_tokens || 0,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody;
    const { action, context, sessionId } = body;

    if (!action || !context?.trim() || !sessionId) {
      return NextResponse.json(
        { error: "Missing required fields: action, context, sessionId" },
        { status: 400 }
      );
    }

    const { allowed, retryAfterMs } = rateLimit(
      `affinity-diagram:${sessionId}`,
      TOOLKIT_LIMITS
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Take a moment to think, then try again." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((retryAfterMs || 1000) / 1000)) } }
      );
    }

    /* ─── NUDGE ─── */
    if (action === "nudge") {
      const { observation, allObservations = [], effortLevel = "medium" } = body;
      if (!observation?.trim()) {
        return NextResponse.json({ error: "Missing observation" }, { status: 400 });
      }

      const systemPrompt = buildNudgeSystemPrompt(effortLevel);
      const userPrompt = `Research context: "${context.trim()}"
Observation just added: "${observation.trim()}"
${allObservations.length > 1 ? `Other observations so far:\n${allObservations.filter(o => o !== observation.trim()).slice(0, 5).map((o, i) => `${i + 1}. ${o}`).join("\n")}` : ""}

Respond with JSON feedback.`;

      const result = await callHaiku(systemPrompt, userPrompt, 120);

      let nudgeText = result.text.trim();
      let acknowledgment = "";

      try {
        const jsonMatch = nudgeText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          nudgeText = parsed.nudge || nudgeText;
          acknowledgment = parsed.acknowledgment || "";
        }
      } catch {
        const nudgeMatch = nudgeText.match(/"nudge"\s*:\s*"([^"]+)"/);
        const ackMatch = nudgeText.match(/"acknowledgment"\s*:\s*"([^"]+)"/);
        if (nudgeMatch) nudgeText = nudgeMatch[1];
        if (ackMatch) acknowledgment = ackMatch[1];
      }

      logUsage({
        endpoint: "tools/affinity-diagram/nudge",
        model: "claude-haiku-4-5-20251001",
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        metadata: { sessionId, effortLevel, action: "nudge" },
      });

      return NextResponse.json({
        nudge: nudgeText,
        acknowledgment,
        effortLevel,
      });
    }

    /* ─── CLUSTERS ─── */
    if (action === "clusters") {
      const { observations = [] } = body;
      if (!Array.isArray(observations) || observations.length < 2) {
        return NextResponse.json({ error: "Need at least 2 observations" }, { status: 400 });
      }

      const systemPrompt = buildClustersSystemPrompt();
      const userPrompt = `Research context: "${context.trim()}"

Observations:
${observations.map((obs, i) => `${i}. ${obs}`).join("\n")}

Suggest natural cluster groupings with reasoning.`;

      const result = await callHaiku(systemPrompt, userPrompt, 500);

      let clusters: Array<{ items: number[]; reason: string }> = [];
      try {
        const jsonMatch = result.text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          clusters = JSON.parse(jsonMatch[0]);
        }
      } catch (err) {
        console.warn("[affinity] Failed to parse clusters:", err);
      }

      logUsage({
        endpoint: "tools/affinity-diagram/clusters",
        model: "claude-haiku-4-5-20251001",
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        metadata: { sessionId, clusterCount: clusters.length, action: "clusters" },
      });

      return NextResponse.json({ clusters });
    }

    /* ─── INSIGHTS ─── */
    if (action === "insights") {
      const { clusters: clusterData = [] } = body;
      if (!Array.isArray(clusterData) || clusterData.length === 0) {
        return NextResponse.json({ insights: "" });
      }

      const systemPrompt = buildInsightsSystemPrompt();
      const clustersSummary = (clusterData as Array<{ name: string; items: string[] }>)
        .map((c, i) => {
          return `${c.name}:\n${c.items.map((item, j) => `  ${j + 1}. ${item}`).join("\n")}`;
        })
        .join("\n\n");

      const userPrompt = `Research context: "${context.trim()}"

Your clusters:
${clustersSummary}

What patterns and insights emerge from these clusters?`;

      const result = await callHaiku(systemPrompt, userPrompt, 350);

      logUsage({
        endpoint: "tools/affinity-diagram/insights",
        model: "claude-haiku-4-5-20251001",
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        metadata: { sessionId, clusterCount: clusterData.length, action: "insights" },
      });

      return NextResponse.json({ insights: result.text.trim() });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("[affinity-diagram] Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Affinity Diagram tool error: ${errorMessage}` },
      { status: 500 }
    );
  }
}
