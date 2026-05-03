// audit-skip: public anonymous free-tool, no actor identity
/**
 * Fishbone Diagram Toolkit AI API
 *
 * 6 categories (People, Methods, Materials, Machines, Measurements, Environment)
 * identify root causes using Ishikawa analysis.
 *
 * Two interaction modes:
 *   1. "nudge"    — Per-category effort-gated feedback
 *   2. "insights" — Root cause synthesis across all categories
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

// ─── Tool-specific config ───

const CATEGORIES = [
  {
    name: "People",
    rules: "human factors, skills, training, communication, team dynamics, leadership",
  },
  {
    name: "Methods",
    rules: "processes, procedures, techniques, workflow, standards, best practices",
  },
  {
    name: "Materials",
    rules: "raw materials, supplies, components, quality, specifications",
  },
  {
    name: "Machines",
    rules: "equipment, tools, technology, machinery, maintenance, calibration",
  },
  {
    name: "Measurements",
    rules: "data, metrics, standards, monitoring, inspection, accuracy",
  },
  {
    name: "Environment",
    rules: "workspace, culture, external factors, temperature, noise, conditions",
  },
];

// ─── Tool-specific prompt builders (unique pedagogical rules) ───

function buildNudgeSystemPrompt(
  categoryName: string,
  effortLevel: "low" | "medium" | "high"
): string {
  const category = CATEGORIES.find((c) => c.name === categoryName);
  if (!category) return "";

  const effortStrategy: Record<string, string> = {
    low: `EFFORT LEVEL: LOW — The student's response is brief or vague.
- Do NOT praise a vague answer — but stay warm
- Push for specifics: what exactly in ${categoryName.toLowerCase()} causes this?
- Reference the category theme: ${category.rules}
- The "nudge" should ask them to be more specific`,
    medium: `EFFORT LEVEL: MEDIUM — The student shows decent effort.
- The "acknowledgment" should note ONE specific cause detail (3-8 words)
- Push deeper: is there a more fundamental ${categoryName.toLowerCase()} issue?
- Ask them to think beyond the obvious`,
    high: `EFFORT LEVEL: HIGH — The student's response is specific and thoughtful.
- The "acknowledgment" should celebrate their specific thinking (3-8 words)
- Push for alternative causes they might be overlooking in ${categoryName.toLowerCase()}
- They're thinking well — help them see hidden connections`,
  };

  return `You are a design thinking mentor guiding a student through Ishikawa (fishbone) analysis.

The student just identified a cause under the ${categoryName} category.

${effortStrategy[effortLevel]}

THIS IS ROOT CAUSE ANALYSIS. Your job is to help them identify SPECIFIC, ACTIONABLE causes.

CATEGORY FOCUS: For ${categoryName}, consider: ${category.rules}

YOUR ROLE: Return a JSON object with your feedback.

RULES:
- "acknowledgment": 3-8 word note referencing their cause (empty string for low effort)
- "nudge": ONE follow-up question, maximum 20 words
- The nudge should push them to think MORE DEEPLY about this category
- Never suggest the answer — only ask questions that deepen thinking

RESPONSE FORMAT: Return ONLY a JSON object:
{"acknowledgment": "Process gap identified!", "nudge": "What's preventing this process from working reliably?"}

For low effort:
{"acknowledgment": "", "nudge": "What specifically in ${categoryName.toLowerCase()} causes this problem?"}`;
}

function buildInsightsSystemPrompt(): string {
  return `You are a design thinking mentor analyzing a student's completed Fishbone (Ishikawa) diagram.

The student identified causes across 6 categories: People, Methods, Materials, Machines, Measurements, and Environment.

YOUR ROLE: Help them see the ROOT CAUSE CLUSTER and identify the strongest connection.

RULES:
- Which category has the most causes? That's likely the primary problem area.
- Look for PATTERNS across categories — are multiple categories pointing to the same underlying issue?
- Identify the ROOT CAUSE CLUSTER (the 2-3 causes that are most fundamental)
- Ask ONE question about what action they could take to address the root cause
- Be encouraging — fishbone analysis is complex and they did good thinking
- Keep the whole response under 130 words
- Use simple, clear language for ages 11-18
- Reference SPECIFIC causes from their analysis

RESPONSE FORMAT: 2-3 short paragraphs of plain text. No headers, no bullets, no markdown.`;
}

// ─── POST handler ───

export async function POST(request: NextRequest) {
  const validated = await validateToolkitRequest(request, "fishbone", ["nudge", "insights"]);
  if (validated.error) return validated.error;
  const { body } = validated;
  const { action, challenge, sessionId } = body;

  try {
    /* ─── Action: Nudge feedback ─── */
    if (action === "nudge") {
      const category = (body.category as string) ?? "";
      const cause = (body.cause as string) ?? "";
      const existingCauses = (body.existingCauses || []) as string[];
      const effortLevel = (body.effortLevel as "low" | "medium" | "high") || "medium";
      const challenge = (body.challenge as string) ?? "";

      if (!cause.trim() || !category) {
        return Response.json({ error: "Missing cause or category" }, { status: 400 });
      }

      const userPrompt = `Problem: "${challenge}"
Category: ${category}
New cause identified: "${cause}"
${existingCauses.length > 0 ? `Other causes in this category:\n${existingCauses.map((c: string, i: number) => `${i + 1}. ${c}`).join("\n")}` : "This is their first cause in this category."}

Respond with JSON feedback.`;

      const result = await callHaiku(buildNudgeSystemPrompt(category, effortLevel), userPrompt, 120);
      const parsed = parseToolkitJSON(result.text, { acknowledgment: "", nudge: result.text.trim() });

      logToolkitUsage("tools/fishbone/nudge", result, { sessionId, category, effortLevel, action: "nudge" });

      return Response.json({
        nudge: parsed.nudge || result.text,
        acknowledgment: parsed.acknowledgment || "",
        effortLevel,
      });
    }

    /* ─── Action: Root cause insights ─── */
    if (action === "insights") {
      const allCauses = (body.allCauses || {}) as Record<string, string[]>;
      const challenge = (body.challenge as string) ?? "";
      const hasCauses = Object.values(allCauses).some((arr: unknown) => Array.isArray(arr) && arr.length > 0);
      if (!hasCauses) {
        return Response.json({ insights: "" });
      }

      const causeSummary = CATEGORIES.map((cat) => {
        const causes = (allCauses[cat.name] || []) as string[];
        return `${cat.name}: ${causes.length > 0 ? causes.map((c: string, i: number) => `${i + 1}. ${c}`).join(", ") : "(no causes)"}`;
      }).join("\n");

      const userPrompt = `Problem: "${challenge}"

Fishbone analysis by category:
${causeSummary}

Analyze the student's fishbone diagram to identify the root cause cluster.`;

      const result = await callHaiku(buildInsightsSystemPrompt(), userPrompt, 350);

      logToolkitUsage("tools/fishbone/insights", result, { sessionId, action: "insights" });

      return Response.json({ insights: result.text });
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return toolkitErrorResponse("fishbone", err);
  }
}
