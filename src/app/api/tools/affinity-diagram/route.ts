/**
 * Affinity Diagram Toolkit AI API
 *
 * Three interaction modes:
 *   1. "nudge"    — Effort-gated feedback on observations (research phase)
 *   2. "clusters" — Suggest natural groupings from observations
 *   3. "insights" — Synthesize patterns and themes across clusters
 *
 * Uses shared toolkit helpers — see src/lib/toolkit/shared-api.ts
 */

import { NextRequest } from "next/server";
import {
  callHaiku,
  validateToolkitRequest,
  parseToolkitJSON,
  parseToolkitJSONArray,
  logToolkitUsage,
  toolkitErrorResponse,
} from "@/lib/toolkit";

// ─── Tool-specific prompt builders ───

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

// ─── POST handler ───

export async function POST(request: NextRequest) {
  const validated = await validateToolkitRequest(request, "affinity-diagram", ["nudge", "clusters", "insights"]);
  if (validated.error) return validated.error;
  const { body } = validated;
  const { action, context, sessionId } = body;

  try {
    /* ─── Action: Effort-gated nudge ─── */
    if (action === "nudge") {
      const observation = (body.observation as string) ?? "";
      const allObservations = (body.allObservations || []) as string[];
      const effortLevel = (body.effortLevel as "low" | "medium" | "high") || "medium";
      const context = (body.context as string) ?? "";

      if (!observation.trim()) {
        return Response.json({ error: "Missing observation" }, { status: 400 });
      }

      const systemPrompt = buildNudgeSystemPrompt(effortLevel);
      const userPrompt = `Research context: "${context.trim()}"
Observation just added: "${observation.trim()}"
${allObservations.length > 1 ? `Other observations so far:\n${allObservations.filter(o => o !== observation.trim()).slice(0, 5).map((o, i) => `${i + 1}. ${o}`).join("\n")}` : ""}

Respond with JSON feedback.`;

      const result = await callHaiku(systemPrompt, userPrompt, 120);
      const parsed = parseToolkitJSON(result.text, { acknowledgment: "", nudge: result.text.trim() });

      logToolkitUsage("tools/affinity-diagram/nudge", result, { sessionId, effortLevel, action: "nudge" });

      return Response.json({
        nudge: parsed.nudge || result.text.trim(),
        acknowledgment: parsed.acknowledgment || "",
        effortLevel,
      });
    }

    /* ─── Action: Suggest clusters ─── */
    if (action === "clusters") {
      const observations = (body.observations || []) as string[];
      const context = (body.context as string) ?? "";

      if (!Array.isArray(observations) || observations.length < 2) {
        return Response.json({ error: "Need at least 2 observations" }, { status: 400 });
      }

      const systemPrompt = buildClustersSystemPrompt();
      const userPrompt = `Research context: "${context.trim()}"

Observations:
${observations.map((obs, i) => `${i}. ${obs}`).join("\n")}

Suggest natural cluster groupings with reasoning.`;

      const result = await callHaiku(systemPrompt, userPrompt, 500);
      const clusters = parseToolkitJSONArray(result.text) || [];

      logToolkitUsage("tools/affinity-diagram/clusters", result, {
        sessionId,
        clusterCount: clusters.length,
        action: "clusters",
      });

      return Response.json({ clusters });
    }

    /* ─── Action: Summary insights ─── */
    if (action === "insights") {
      const clusterData = (body.clusters || []) as Array<{ name: string; items: string[] }>;
      const context = (body.context as string) ?? "";

      if (!Array.isArray(clusterData) || clusterData.length === 0) {
        return Response.json({ insights: "" });
      }

      const systemPrompt = buildInsightsSystemPrompt();
      const clustersSummary = clusterData
        .map((c, i) => {
          return `${c.name}:\n${c.items.map((item, j) => `  ${j + 1}. ${item}`).join("\n")}`;
        })
        .join("\n\n");

      const userPrompt = `Research context: "${context.trim()}"

Your clusters:
${clustersSummary}

What patterns and insights emerge from these clusters?`;

      const result = await callHaiku(systemPrompt, userPrompt, 350);

      logToolkitUsage("tools/affinity-diagram/insights", result, {
        sessionId,
        clusterCount: clusterData.length,
        action: "insights",
      });

      return Response.json({ insights: result.text.trim() });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return toolkitErrorResponse("affinity-diagram", err);
  }
}
