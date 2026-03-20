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
 * Uses Haiku 4.5 for speed. Short responses only.
 */

import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { logUsage } from "@/lib/usage-tracking";

const TOOLKIT_LIMITS = [
  { maxRequests: 50, windowMs: 60 * 1000 },
  { maxRequests: 500, windowMs: 60 * 60 * 1000 },
];

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

type ActionType = "nudge" | "insights";

interface RequestBody {
  action: ActionType;
  challenge: string;
  sessionId: string;
  category?: string;
  cause?: string;
  existingCauses?: string[];
  effortLevel?: "low" | "medium" | "high";
  allCauses?: Record<string, string[]>;
}

// ─── Nudge Generation ───

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

// ─── Root Cause Insights ───

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

// ─── AI Call ───

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

// ─── Route Handler ───

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody;
    const { action, challenge, sessionId } = body;

    if (!action || !challenge?.trim() || !sessionId) {
      return NextResponse.json(
        { error: "Missing required fields: action, challenge, sessionId" },
        { status: 400 }
      );
    }

    const { allowed, retryAfterMs } = rateLimit(
      `fishbone:${sessionId}`,
      TOOLKIT_LIMITS
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Take a moment to think, then try again." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((retryAfterMs || 1000) / 1000)) } }
      );
    }

    // ─── NUDGE ───
    if (action === "nudge") {
      const { category, cause, existingCauses = [], effortLevel = "medium" } = body;
      if (!cause?.trim() || !category) {
        return NextResponse.json({ error: "Missing cause or category" }, { status: 400 });
      }

      const systemPrompt = buildNudgeSystemPrompt(category, effortLevel);
      const userPrompt = `Problem: "${challenge}"
Category: ${category}
New cause identified: "${cause}"
${existingCauses.length > 0 ? `Other causes in this category:\n${existingCauses.map((c, i) => `${i + 1}. ${c}`).join("\n")}` : "This is their first cause in this category."}

Respond with JSON feedback.`;

      const result = await callHaiku(systemPrompt, userPrompt, 120);

      logUsage({
        endpoint: "tools/fishbone/nudge",
        model: "claude-haiku-4-5-20251001",
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        metadata: { sessionId, category, effortLevel, action: "nudge" },
      });

      try {
        const parsed = JSON.parse(result.text);
        return NextResponse.json({
          nudge: parsed.nudge || result.text,
          acknowledgment: parsed.acknowledgment || "",
          effortLevel,
        });
      } catch {
        const nudgeMatch = result.text.match(/"nudge"\s*:\s*"([^"]+)"/);
        const ackMatch = result.text.match(/"acknowledgment"\s*:\s*"([^"]*)"/);
        return NextResponse.json({
          nudge: nudgeMatch?.[1] || result.text.replace(/[{}"\n]/g, "").trim(),
          acknowledgment: ackMatch?.[1] || "",
          effortLevel,
        });
      }
    }

    // ─── INSIGHTS ───
    if (action === "insights") {
      const { allCauses = {} } = body;
      const hasCauses = Object.values(allCauses).some((arr: unknown) => Array.isArray(arr) && arr.length > 0);
      if (!hasCauses) {
        return NextResponse.json({ insights: "" });
      }

      const systemPrompt = buildInsightsSystemPrompt();
      const causeSummary = CATEGORIES.map((cat) => {
        const causes = (allCauses[cat.name] || []) as string[];
        return `${cat.name}: ${causes.length > 0 ? causes.map((c, i) => `${i + 1}. ${c}`).join(", ") : "(no causes)"}`;
      }).join("\n");

      const userPrompt = `Problem: "${challenge}"

Fishbone analysis by category:
${causeSummary}

Analyze the student's fishbone diagram to identify the root cause cluster.`;

      const result = await callHaiku(systemPrompt, userPrompt, 350);

      logUsage({
        endpoint: "tools/fishbone/insights",
        model: "claude-haiku-4-5-20251001",
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        metadata: { sessionId, action: "insights" },
      });

      return NextResponse.json({ insights: result.text });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[fishbone] API error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
