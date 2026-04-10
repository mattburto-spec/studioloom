/**
 * Pass A — Classify + Tag (cheap model, ~500-1000 tokens)
 *
 * Single AI call: document type classification, confidence, structural outline,
 * section boundaries, topic detection. Maps to what old Passes 0+1 did together.
 *
 * OS Seam 1: Pure function — receives config, no HTTP/request dependencies.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { CostBreakdown } from "@/types/activity-blocks";
import type {
  IngestionPass,
  ParseResult,
  IngestionClassification,
  IngestionSection,
  PassConfig,
} from "./types";

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

// Cost per token (Haiku pricing, approximate)
const INPUT_COST_PER_TOKEN = 0.001 / 1000;
const OUTPUT_COST_PER_TOKEN = 0.005 / 1000;

const CLASSIFICATION_TOOL = {
  name: "classify_document",
  description: "Classify an uploaded document and identify its sections",
  input_schema: {
    type: "object" as const,
    properties: {
      documentType: {
        type: "string",
        enum: [
          "lesson_plan",
          "scheme_of_work",
          "rubric",
          "resource",
          "textbook_extract",
          "worksheet",
          "unknown",
        ],
        description: "The type of educational document",
      },
      documentTypeConfidence: {
        type: "number",
        description: "Confidence in documentType classification (0-1)",
      },
      topic: {
        type: "string",
        description: "Main topic or subject of the document",
      },
      detectedSubject: {
        type: "string",
        description: "Academic subject area (e.g., Design Technology, Science, Art)",
      },
      detectedSubjectConfidence: {
        type: "number",
        description: "Confidence in detectedSubject (0-1). Omit if subject is unclear.",
      },
      detectedStrand: {
        type: "string",
        description:
          "Curriculum strand or domain within the subject (e.g., 'Materials & Manufacture', 'Algebra', 'Reading Comprehension'). Omit if not detectable.",
      },
      detectedStrandConfidence: {
        type: "number",
        description: "Confidence in detectedStrand (0-1). Omit if strand absent.",
      },
      detectedLevel: {
        type: "string",
        description:
          "Year/grade level or stage (e.g., 'MYP3', 'Year 9', 'KS3', 'Grade 7'). Omit if not detectable.",
      },
      detectedLevelConfidence: {
        type: "number",
        description: "Confidence in detectedLevel (0-1). Omit if level absent.",
      },
      sections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            index: { type: "number" },
            heading: { type: "string" },
            content: { type: "string", description: "Brief summary of section content (1-2 sentences)" },
            sectionType: {
              type: "string",
              enum: ["activity", "instruction", "assessment", "metadata", "unknown"],
            },
            estimatedDuration: {
              type: "string",
              enum: ["quick", "moderate", "extended"],
              description: "Estimated duration if detectable",
            },
          },
          required: ["index", "heading", "content", "sectionType"],
        },
      },
    },
    required: ["documentType", "documentTypeConfidence", "topic", "sections"],
  },
};

function buildClassificationPrompt(parsed: ParseResult): string {
  const sectionSummaries = parsed.sections
    .map(
      (s) =>
        `[Section ${s.index}: "${s.heading}" (${s.wordCount} words${s.hasDuration ? ", contains timing" : ""}${s.hasListItems ? ", has list items" : ""})]\n${s.content.slice(0, 300)}${s.content.length > 300 ? "..." : ""}`
    )
    .join("\n\n");

  return `Classify this educational document and identify the type of each section.

Document title: "${parsed.title}"
Total sections: ${parsed.sections.length}
Total words: ${parsed.totalWordCount}

Sections:
${sectionSummaries}

DOCUMENT-LEVEL CLASSIFICATION
You must return:
- documentType + documentTypeConfidence (0-1)
- detectedSubject + detectedSubjectConfidence (e.g., "Design Technology", "Mathematics") — omit confidence if subject unclear
- detectedStrand + detectedStrandConfidence — the curriculum strand or domain within the subject (e.g., "Materials & Manufacture" inside Design Tech, "Number & Algebra" inside Maths). Omit if not detectable.
- detectedLevel + detectedLevelConfidence — year/grade/stage (e.g., "MYP3", "Year 9", "KS3", "Grade 7"). Omit if not detectable.

Confidence is YOUR self-rated certainty 0-1. Use the full range — 0.3 if you're guessing, 0.95 if it's explicit in the document.

SECTION CLASSIFICATION
For each section, determine if it is:
- "activity": A student task or hands-on activity
- "instruction": Teacher-directed content or explanation
- "assessment": Evaluation criteria, rubrics, or grading information
- "metadata": Administrative info (dates, resources, standards references)
- "unknown": Cannot be classified

Also estimate duration where detectable:
- "quick": Under 10 minutes
- "moderate": 10-25 minutes
- "extended": Over 25 minutes`;
}

/** Simulated classification for sandbox/test mode. */
function simulateClassification(parsed: ParseResult): IngestionClassification {
  const sections: IngestionSection[] = parsed.sections.map((s) => ({
    index: s.index,
    heading: s.heading,
    content: s.content.slice(0, 200),
    sectionType: s.hasDuration ? "activity" : s.hasListItems ? "instruction" : "unknown",
    estimatedDuration: s.hasDuration
      ? s.wordCount > 150
        ? "extended"
        : s.wordCount > 50
          ? "moderate"
          : "quick"
      : undefined,
  }));

  return {
    documentType: "lesson_plan",
    confidence: 0.75,
    confidences: {
      documentType: 0.75,
      subject: 0.7,
      strand: 0.5,
      level: 0.5,
    },
    topic: parsed.title,
    sections,
    detectedSubject: "Design Technology",
    detectedStrand: "Materials & Manufacture",
    detectedLevel: "MYP3",
    cost: {
      inputTokens: 0,
      outputTokens: 0,
      modelId: "simulated",
      estimatedCostUSD: 0,
      timeMs: 0,
    },
  };
}

async function runPassA(
  input: ParseResult,
  config: PassConfig
): Promise<IngestionClassification & { cost: CostBreakdown }> {
  const startTime = Date.now();

  // Sandbox mode — return simulated data
  if (config.sandboxMode || !config.apiKey) {
    const result = simulateClassification(input);
    result.cost.timeMs = Date.now() - startTime;
    return result;
  }

  const modelId = config.modelOverride || DEFAULT_MODEL;
  const client = new Anthropic({ apiKey: config.apiKey, maxRetries: 2 });
  const prompt = buildClassificationPrompt(input);

  const response = await client.messages.create({
    model: modelId,
    system: "You are an expert educational document analyst. Classify documents accurately and identify section types.",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 2000,
    temperature: 0.2,
    tools: [CLASSIFICATION_TOOL],
    tool_choice: { type: "tool", name: "classify_document" },
  });

  const toolBlock = response.content.find((b) => b.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error("[Pass A] AI did not return structured output via tool use");
  }

  const result = toolBlock.input as {
    documentType: IngestionClassification["documentType"];
    documentTypeConfidence: number;
    topic: string;
    detectedSubject?: string;
    detectedSubjectConfidence?: number;
    detectedStrand?: string;
    detectedStrandConfidence?: number;
    detectedLevel?: string;
    detectedLevelConfidence?: number;
    sections: IngestionSection[];
  };

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
    documentType: result.documentType,
    confidence: result.documentTypeConfidence,
    confidences: {
      documentType: result.documentTypeConfidence,
      subject: result.detectedSubjectConfidence,
      strand: result.detectedStrandConfidence,
      level: result.detectedLevelConfidence,
    },
    topic: result.topic,
    detectedSubject: result.detectedSubject,
    detectedStrand: result.detectedStrand,
    detectedLevel: result.detectedLevel,
    sections: result.sections,
    cost,
  };
}

export const passA: IngestionPass<ParseResult, IngestionClassification> = {
  id: "pass-a-classify",
  label: "Pass A: Classify + Tag",
  model: DEFAULT_MODEL,
  run: runPassA,
};
