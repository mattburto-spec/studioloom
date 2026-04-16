/**
 * Pass B — Analyse + Enrich (medium model, ~2000-4000 tokens)
 *
 * Takes classified sections from Pass A, enriches each with: bloom_level,
 * time_weight, grouping, phase, activity_category, materials, scaffolding_notes,
 * udl_hints, teaching_approach.
 *
 * Maps to what old Passes 2+2b did together.
 *
 * OS Seam 1: Pure function — receives config, no HTTP/request dependencies.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { CostBreakdown } from "@/types/activity-blocks";
import type {
  IngestionPass,
  IngestionClassification,
  IngestionAnalysis,
  EnrichedSection,
  PassConfig,
} from "./types";

import { MODELS } from "@/lib/ai/models";

const DEFAULT_MODEL = MODELS.SONNET;

// Cost per token (Sonnet pricing, approximate)
const INPUT_COST_PER_TOKEN = 0.003 / 1000;
const OUTPUT_COST_PER_TOKEN = 0.015 / 1000;

const ENRICHMENT_TOOL = {
  name: "enrich_sections",
  description: "Enrich each document section with pedagogical metadata",
  input_schema: {
    type: "object" as const,
    properties: {
      enrichedSections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            index: { type: "number" },
            heading: { type: "string" },
            content: { type: "string" },
            sectionType: { type: "string" },
            estimatedDuration: { type: "string" },
            bloom_level: {
              type: "string",
              enum: ["remember", "understand", "apply", "analyze", "evaluate", "create"],
            },
            time_weight: {
              type: "string",
              enum: ["quick", "moderate", "extended", "flexible"],
            },
            grouping: {
              type: "string",
              enum: ["individual", "pair", "small_group", "whole_class", "flexible"],
            },
            phase: {
              type: "string",
              description: "Format-neutral phase: investigate, develop, create, evaluate, plan, reflect",
            },
            activity_category: {
              type: "string",
              enum: [
                "ideation", "research", "analysis", "making", "critique",
                "reflection", "planning", "presentation", "warmup",
                "collaboration", "skill-building", "documentation", "assessment", "journey",
              ],
            },
            materials: {
              type: "array",
              items: { type: "string" },
              description: "Materials/resources needed for this section",
            },
            scaffolding_notes: {
              type: "string",
              description: "Scaffolding approach for diverse learners",
            },
            udl_hints: {
              type: "array",
              items: { type: "string" },
              description: "Approximate UDL checkpoint IDs (e.g., '5.1', '8.2')",
            },
            teaching_approach: {
              type: "string",
              description: "Brief teaching approach descriptor (e.g., 'direct instruction', 'inquiry-based', 'collaborative')",
            },
          },
          required: [
            "index", "heading", "content", "sectionType",
            "bloom_level", "time_weight", "grouping", "phase",
            "activity_category", "materials",
          ],
        },
      },
    },
    required: ["enrichedSections"],
  },
};

function buildEnrichmentPrompt(classification: IngestionClassification, correctionContext?: string): string {
  const sectionDetails = classification.sections
    .map(
      (s) =>
        `[Section ${s.index}: "${s.heading}" — type: ${s.sectionType}${s.estimatedDuration ? `, ~${s.estimatedDuration}` : ""}]
${s.content}`
    )
    .join("\n\n---\n\n");

  // Detect whether sections are already at lesson-level granularity.
  // If headings match "Week X - Lesson Y" or "Lesson N" patterns, the
  // extraction layer already split them — Pass B should NOT sub-split.
  const LESSON_HEADING_RE = /^(?:Week\s+\d+\s*[-–—]\s*)?Lesson\s+\d/i;
  const lessonLevelCount = classification.sections.filter(
    (s) => LESSON_HEADING_RE.test(s.heading)
  ).length;
  const alreadyLessonLevel = lessonLevelCount >= classification.sections.length * 0.5;

  const splittingBlock = alreadyLessonLevel
    ? `**IMPORTANT — Do NOT split these sections further.** The sections below are already individual lessons (one section = one class period). Each section may contain multiple activities within a single lesson — that is normal. Keep a 1:1 mapping: one input section → one enriched section. Do NOT create additional sections for sub-activities within a lesson.`
    : `**Lesson splitting (when needed):** If a section covers multiple distinct class periods, lessons, or weeks, split it into separate enriched sections. Signals that a section needs splitting:
- Multiple day/lesson references ("Monday...", "Tuesday...", "Lesson 1...", "Lesson 2...")
- A week's worth of bullet-pointed activities spanning several class sessions
- Transition phrases ("then in the next lesson...", "the following day...")

For each split, create a separate enriched section with a sequential index, a descriptive heading like "Week 1 - Lesson 1: Introduction & Brief", and only the content relevant to that lesson.

However, do NOT split a section just because it has multiple activities within a single class period. A lesson with "10 min intro, 20 min activity, 15 min wrap-up" is ONE lesson, not three. Only split when a section genuinely spans multiple separate class meetings.`;

  return `You are analysing an educational document classified as "${classification.documentType}" about "${classification.topic}" (subject: ${classification.detectedSubject || "unknown"}).

For each section below, determine:

1. **bloom_level** — Bloom's taxonomy level the section targets (remember/understand/apply/analyze/evaluate/create)
2. **time_weight** — How long this takes relative to other activities (quick=<10min, moderate=10-25min, extended=>25min, flexible=varies)
3. **grouping** — Student grouping (individual/pair/small_group/whole_class/flexible)
4. **phase** — Format-neutral design phase (investigate/develop/create/evaluate/plan/reflect)
5. **activity_category** — Best match from: ideation, research, analysis, making, critique, reflection, planning, presentation, warmup, collaboration, skill-building, documentation, assessment, journey
6. **materials** — Physical materials, software, or resources needed
7. **scaffolding_notes** — Brief notes on how to scaffold for diverse learners
8. **udl_hints** — UDL checkpoint IDs that this section addresses (e.g., "5.1" for expression/communication, "8.2" for sustained effort)
9. **teaching_approach** — Brief descriptor (e.g., "direct instruction", "inquiry-based", "project-based", "collaborative")

${splittingBlock}

Sections to analyse:
${sectionDetails}

Return ALL sections, including non-activity ones — enrichment metadata helps with curriculum mapping even for metadata/instruction sections.${correctionContext || ""}`;
}

/** Simulated enrichment for sandbox/test mode. */
function simulateEnrichment(classification: IngestionClassification): IngestionAnalysis {
  const phases = ["investigate", "develop", "create", "evaluate", "plan", "reflect"];
  const categories = ["research", "making", "critique", "reflection", "planning", "skill-building"];
  const blooms = ["remember", "understand", "apply", "analyze", "evaluate", "create"];

  const enrichedSections: EnrichedSection[] = classification.sections.map((s, i) => ({
    ...s,
    bloom_level: blooms[i % blooms.length],
    time_weight: s.estimatedDuration || "moderate",
    grouping: i % 3 === 0 ? "individual" : i % 3 === 1 ? "pair" : "small_group",
    phase: phases[i % phases.length],
    activity_category: s.sectionType === "activity"
      ? categories[i % categories.length]
      : s.sectionType === "assessment"
        ? "assessment"
        : "documentation",
    materials: [],
    scaffolding_notes: "Provide visual guides and sentence starters for ELL students.",
    udl_hints: ["5.1", "8.2"],
    teaching_approach: s.sectionType === "instruction" ? "direct instruction" : "inquiry-based",
  }));

  return {
    classification,
    enrichedSections,
    cost: {
      inputTokens: 0,
      outputTokens: 0,
      modelId: "simulated",
      estimatedCostUSD: 0,
      timeMs: 0,
    },
  };
}

async function runPassB(
  input: IngestionClassification,
  config: PassConfig
): Promise<IngestionAnalysis & { cost: CostBreakdown }> {
  const startTime = Date.now();

  // Sandbox mode — return simulated data
  if (config.sandboxMode || !config.apiKey) {
    const result = simulateEnrichment(input);
    result.cost.timeMs = Date.now() - startTime;
    return result;
  }

  const modelId = config.modelOverride || DEFAULT_MODEL;
  const client = new Anthropic({ apiKey: config.apiKey, maxRetries: 4 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const correctionContext = (config as any)._correctionContext as string | undefined;
  const prompt = buildEnrichmentPrompt(input, correctionContext);

  const response = await client.messages.create({
    model: modelId,
    system: "You are an expert educational content analyst specialising in curriculum design, Bloom's taxonomy, Universal Design for Learning, and activity classification. Analyse each section thoroughly.",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 16000,
    temperature: 0.2,
    tools: [ENRICHMENT_TOOL],
    tool_choice: { type: "tool", name: "enrich_sections" },
  });

  if (response.stop_reason === "max_tokens") {
    throw new Error(
      `[Pass B] Anthropic call hit max_tokens=16000 (output_tokens=${response.usage?.output_tokens}, input_tokens=${response.usage?.input_tokens}, sections=${input.sections.length}). ` +
        `Tool: enrich_sections. The per-section enrichment schema is too large for this document — increase max_tokens, chunk the sections, or shrink the schema. ` +
        `See Lesson #39: silent tool_use truncation drops required fields.`
    );
  }

  const toolBlock = response.content.find((b) => b.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error("[Pass B] AI did not return structured output via tool use");
  }

  const result = toolBlock.input as { enrichedSections: EnrichedSection[] };

  const inputTokens = response.usage?.input_tokens ?? 0;
  const outputTokens = response.usage?.output_tokens ?? 0;

  const cost: CostBreakdown = {
    inputTokens,
    outputTokens,
    modelId,
    estimatedCostUSD:
      inputTokens * INPUT_COST_PER_TOKEN + outputTokens * OUTPUT_COST_PER_TOKEN,
    timeMs: Date.now() - startTime,
  };

  return {
    classification: input,
    enrichedSections: result.enrichedSections ?? [],
    cost,
  };
}

export const passB: IngestionPass<IngestionClassification, IngestionAnalysis> = {
  id: "pass-b-analyse",
  label: "Pass B: Analyse + Enrich",
  model: DEFAULT_MODEL,
  run: runPassB,
};
