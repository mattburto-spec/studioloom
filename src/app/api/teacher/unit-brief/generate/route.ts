// audit-skip: AI brief-assist for the teacher unit-brief editor. Same
// audit class as the rest of the briefs build (teacher-authored
// pedagogical content; only the unit AUTHOR can invoke). Output gets
// validated via the shared validateConstraints before returning —
// students never see the raw model output. FU-BRIEFS-AUDIT-COVERAGE
// retrofit will sweep all the audit-skipped POSTs together.
//
// Unit Briefs Foundation — AI brief-assist generator.
//
// POST /api/teacher/unit-brief/generate
// Body: { unitId: string, prompt: string }
//   → { suggestion: {
//         brief_text: string | null,
//         constraints: UnitBriefConstraints
//     } }
//
// Reads unit metadata + the current draft brief, then prompts Haiku via
// tool-use to return a structured `propose_brief` payload. The
// suggestion is sanitised + validated via the shared validators so
// the editor can apply it (or any subset of fields) without further
// checks. Teacher's choice whether to apply.
//
// One-shot generation — no multi-turn chat in v1. Teacher can
// regenerate with a refined prompt.

import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { requireTeacher } from "@/lib/auth/require-teacher";
import { verifyTeacherHasUnit } from "@/lib/auth/verify-teacher-unit";
import { callAnthropicMessages } from "@/lib/ai/call";
import { MODELS } from "@/lib/ai/models";
import {
  coerceConstraints,
  validateConstraints,
} from "@/lib/unit-brief/validators";
import type { UnitBriefConstraints } from "@/types/unit-brief";

const MODEL = MODELS.HAIKU;
const MAX_TOKENS = 1500;
const TOOL_NAME = "propose_brief";

const SYSTEM_PROMPT = `You help secondary design teachers author project briefs. The brief is what students read at the start + throughout a multi-week project. It must be specific enough to anchor decisions but open enough to leave creative space for students.

A brief has two parts:
1. brief_text — 2-4 sentences describing the scenario / problem / client. Concrete and grounded. Write in second-person ("Design a...") or third-person scenario framing. Avoid jargon.
2. constraints (all optional) — only set fields appropriate for the unit:
   - dimensions: structured H×W×D limit. Use only when physical scale matters.
   - materials_whitelist: prefer the catalogue ids (cardboard, foamboard, balsa, pine, ply-3mm, laser-mdf, laser-acrylic, 3d-print, resin, wire-metal, clay, mixed). Custom materials allowed as free text.
   - budget: free text, e.g. "≤ AUD $20" or "free".
   - audience: free text — who the design serves.
   - must_include: array of required elements (short phrases).
   - must_avoid: array of banned elements (short phrases).

Rules:
- Be concise. Don't pad with filler.
- Omit constraint fields that aren't appropriate (e.g. don't set materials_whitelist if any material works).
- Honour the teacher's request precisely. If they ask for one change, keep the rest as-is.
- Don't invent constraints the teacher didn't hint at.`;

const TOOL: Anthropic.Tool = {
  name: TOOL_NAME,
  description:
    "Propose a Design unit brief. Set only the fields appropriate for this unit; omit the rest.",
  input_schema: {
    type: "object" as const,
    properties: {
      brief_text: {
        type: "string",
        description:
          "2-4 sentence scenario/problem/client description students will read. Omit if you have nothing concrete to add (don't make it up).",
      },
      constraints: {
        type: "object",
        properties: {
          dimensions: {
            type: "object",
            description:
              "Max physical dimensions. Omit unless scale matters for this project.",
            properties: {
              h: { type: "number", description: "max height" },
              w: { type: "number", description: "max width" },
              d: { type: "number", description: "max depth" },
              unit: { type: "string", enum: ["mm", "cm", "in"] },
            },
          },
          materials_whitelist: {
            type: "array",
            items: { type: "string" },
            description:
              "Material chip ids OR custom material names. Prefer catalogue ids when possible.",
          },
          budget: {
            type: "string",
            description: "Free text — e.g. '≤ AUD $20'.",
          },
          audience: {
            type: "string",
            description: "Free text — who the design serves.",
          },
          must_include: {
            type: "array",
            items: { type: "string" },
          },
          must_avoid: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
    },
  },
};

interface ProposedBrief {
  brief_text: string | null;
  constraints: UnitBriefConstraints;
}

export const POST = withErrorHandler(
  "teacher/unit-brief-generate:POST",
  async (request: NextRequest) => {
    const teacher = await requireTeacher(request);
    if (teacher.error) return teacher.error;
    const teacherId = teacher.teacherId;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "body must be an object" },
        { status: 400 },
      );
    }
    const b = body as Record<string, unknown>;

    if (typeof b.unitId !== "string" || b.unitId.length === 0) {
      return NextResponse.json(
        { error: "unitId required (string)" },
        { status: 400 },
      );
    }
    const unitId = b.unitId;

    const promptRaw = typeof b.prompt === "string" ? b.prompt.trim() : "";
    if (promptRaw.length === 0) {
      return NextResponse.json(
        { error: "prompt required (non-empty string)" },
        { status: 400 },
      );
    }
    if (promptRaw.length > 2000) {
      return NextResponse.json(
        { error: "prompt must be 2000 characters or fewer" },
        { status: 400 },
      );
    }

    const access = await verifyTeacherHasUnit(teacherId, unitId);
    if (!access.isAuthor) {
      return NextResponse.json(
        { error: "Only the unit author can use AI assist" },
        { status: 403 },
      );
    }

    const db = createAdminClient();

    // ─── Fetch unit + current draft brief (context for the prompt) ────
    // select("*") because units may have drifted columns vs the registry
    // (Lesson #83 — units.unit_type is the famous case). The renderer
    // only reads known fields, missing ones default sensibly.
    const { data: unit } = await db
      .from("units")
      .select("*")
      .eq("id", unitId)
      .maybeSingle();
    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    const { data: brief } = await db
      .from("unit_briefs")
      .select("brief_text, constraints")
      .eq("unit_id", unitId)
      .maybeSingle();

    const currentBriefText =
      (brief?.brief_text as string | null) ?? null;
    const currentConstraints = coerceConstraints(brief?.constraints);

    const userPrompt = buildUserPrompt({
      unit,
      currentBriefText,
      currentConstraints,
      teacherPrompt: promptRaw,
    });

    // ─── Call Haiku via callAnthropicMessages (single chokepoint) ─────
    const callResult = await callAnthropicMessages({
      supabase: db,
      teacherId, // attribution + BYOK chain
      endpoint: "teacher/unit-brief-generate",
      model: MODEL,
      maxTokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      tools: [TOOL],
      toolChoice: { type: "tool", name: TOOL_NAME },
      messages: [{ role: "user", content: userPrompt }],
      metadata: { unitId },
    });

    if (!callResult.ok) {
      if (callResult.reason === "no_credentials") {
        return NextResponse.json(
          { error: "AI provider credentials not configured" },
          { status: 500 },
        );
      }
      if (callResult.reason === "truncated") {
        return NextResponse.json(
          { error: "AI response was truncated — try a shorter prompt" },
          { status: 502 },
        );
      }
      if (callResult.reason === "over_cap") {
        return NextResponse.json(
          { error: "AI budget cap reached for this period" },
          { status: 429 },
        );
      }
      return NextResponse.json(
        { error: "AI provider error" },
        { status: 502 },
      );
    }

    const response = callResult.response;
    const toolBlock = response.content.find((b) => b.type === "tool_use");
    if (!toolBlock || toolBlock.type !== "tool_use") {
      return NextResponse.json(
        { error: "Model did not return a structured proposal" },
        { status: 502 },
      );
    }

    // ─── Sanitise + validate the proposal ─────────────────────────────
    // The schema is enforced training-time, not runtime — defensive
    // narrowing per Lesson #39 + #42.
    const input = toolBlock.input as Record<string, unknown> | null;
    const proposedText =
      typeof input?.brief_text === "string" ? input.brief_text : null;

    const proposedConstraintsRaw = input?.constraints;
    const proposedConstraints: UnitBriefConstraints =
      proposedConstraintsRaw &&
      typeof proposedConstraintsRaw === "object" &&
      !Array.isArray(proposedConstraintsRaw)
        ? {
            archetype: "design",
            data: proposedConstraintsRaw as UnitBriefConstraints["data"],
          }
        : { archetype: "design", data: {} };

    // Validate to catch any wrong-shape garbage (e.g. dimensions as a
    // string the model hallucinated). validateConstraints rejects;
    // we coerce instead so the suggestion is always renderable.
    const validated = validateConstraints(proposedConstraints);
    const safeConstraints: UnitBriefConstraints = validated.ok
      ? validated.value
      : coerceConstraints(proposedConstraints);

    const suggestion: ProposedBrief = {
      brief_text: proposedText,
      constraints: safeConstraints,
    };

    return NextResponse.json({ suggestion });
  },
);

function buildUserPrompt(args: {
  unit: Record<string, unknown>;
  currentBriefText: string | null;
  currentConstraints: UnitBriefConstraints;
  teacherPrompt: string;
}): string {
  const u = args.unit;
  const title = typeof u.title === "string" ? u.title : "(no title)";
  const description = typeof u.description === "string" ? u.description : "";
  const topic = typeof u.topic === "string" ? u.topic : "";
  const grade = typeof u.grade_level === "string" ? u.grade_level : "";
  const duration =
    typeof u.duration_weeks === "number" ? `${u.duration_weeks} weeks` : "";
  const keyConcept =
    typeof u.key_concept === "string" ? u.key_concept : "";
  const globalContext =
    typeof u.global_context === "string" ? u.global_context : "";

  const constraintsSummary =
    args.currentConstraints.archetype === "design" &&
    Object.keys(args.currentConstraints.data).length > 0
      ? JSON.stringify(args.currentConstraints.data, null, 2)
      : "(none yet)";

  const lines: string[] = [
    "UNIT CONTEXT",
    `Title: ${title}`,
  ];
  if (description) lines.push(`Description: ${description}`);
  if (topic) lines.push(`Topic: ${topic}`);
  if (grade) lines.push(`Grade level: ${grade}`);
  if (duration) lines.push(`Duration: ${duration}`);
  if (keyConcept) lines.push(`Key concept (MYP): ${keyConcept}`);
  if (globalContext) lines.push(`Global context (MYP): ${globalContext}`);
  lines.push("");
  lines.push("CURRENT DRAFT");
  lines.push(`brief_text: ${args.currentBriefText ?? "(empty)"}`);
  lines.push(`constraints: ${constraintsSummary}`);
  lines.push("");
  lines.push("TEACHER REQUEST");
  lines.push(args.teacherPrompt);
  lines.push("");
  lines.push(
    "Call the propose_brief tool. If the teacher's request only asks for changes to one part, keep other fields the same as the draft.",
  );

  return lines.join("\n");
}
