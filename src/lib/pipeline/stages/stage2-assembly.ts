/**
 * Stage 2: Sequence Assembly
 *
 * Takes retrieved blocks + request → produces an ordered slot plan.
 * One medium-model AI call (Sonnet) to determine optimal sequence.
 * Identifies gaps where no suitable block exists.
 * Validates prerequisite chains.
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
  CostBreakdown,
  GenerationRequest,
  BlockRetrievalResult,
  AssembledSequence,
  LessonSlot,
  ActivitySlot,
  PrerequisiteViolation,
  RetrievedBlock,
} from "@/types/activity-blocks";
import type { FormatProfile } from "@/lib/ai/unit-types";

// ─── Types ───

interface AssemblyConfig {
  apiKey: string;
  modelId?: string;
}

// ─── Helpers ───

const ZERO_COST: CostBreakdown = {
  inputTokens: 0, outputTokens: 0, modelId: "simulator",
  estimatedCostUSD: 0, timeMs: 0,
};

function validatePrerequisites(lessons: LessonSlot[]): PrerequisiteViolation[] {
  const violations: PrerequisiteViolation[] = [];
  const producedOutputs = new Set<string>();

  for (const lesson of lessons) {
    for (const slot of lesson.activities) {
      if (slot.source === "library" && slot.block) {
        const block = slot.block.block;
        // Check prerequisites
        for (const tag of block.prerequisite_tags) {
          if (!producedOutputs.has(tag)) {
            violations.push({
              blockId: block.id,
              blockTitle: block.title,
              position: lesson.position,
              requiresTag: tag,
              missingFrom: `No preceding block produces "${tag}"`,
              severity: "soft",
            });
          }
        }
        // Track outputs
        if (block.output_type) {
          producedOutputs.add(block.output_type);
        }
      }
    }
  }

  return violations;
}

function buildAssemblyPrompt(
  request: GenerationRequest,
  profile: FormatProfile,
  candidates: RetrievedBlock[]
): string {
  const blockSummaries = candidates.map((c, i) => ({
    index: i,
    title: c.block.title,
    phase: c.block.phase,
    category: c.block.activity_category,
    bloom: c.block.bloom_level,
    grouping: c.block.grouping,
    timeWeight: c.block.time_weight,
    relevance: Math.round(c.relevanceScore * 100),
    outputType: c.block.output_type,
    prerequisiteTags: c.block.prerequisite_tags,
  }));

  const phaseDesc = profile.phases.map(p => `  - ${p.id}: ${p.label} — ${p.description}`).join("\n");
  const phaseWeights = Object.entries(profile.sequenceHints.phaseWeights)
    .map(([id, w]) => `  ${id}: ${Math.round(w * 100)}%`)
    .join("\n");

  return `You are assembling a ${request.lessonCount}-lesson unit on "${request.topic}" for ${request.gradeLevel} students.

## Unit Format: ${profile.cycleName}
Phases (in order):
${phaseDesc}

Phase distribution targets:
${phaseWeights}

Opening phase: ${profile.sequenceHints.openingPhase}
Closing phase: ${profile.sequenceHints.closingPhase}

## Available Library Blocks
${candidates.length > 0 ? JSON.stringify(blockSummaries, null, 2) : "NONE — all activities will need to be generated from scratch."}

${request.preferences?.suggestedSequencePattern ? `## Suggested Pattern\n${request.preferences.suggestedSequencePattern}\n` : ""}
${request.context?.realWorldContext ? `## Real-World Context\n${request.context.realWorldContext}\n` : ""}

## Instructions
Create a lesson sequence with ${request.lessonCount} lessons. For each lesson:
1. Assign a phase from the format's phases
2. Place available library blocks (by index) where they fit, OR mark slots as "gap" needing generation
3. Each lesson should have 2-4 activity slots
4. Respect prerequisite chains (check prerequisiteTags vs outputType)
5. Follow Bloom's progression: early lessons lower Bloom, later lessons higher
6. Vary grouping across the unit

Respond with JSON matching this schema:
{
  "lessons": [
    {
      "position": 1,
      "label": "Lesson 1: Title",
      "description": "What students do and learn",
      "activities": [
        {
          "source": "library",
          "blockIndex": 0
        },
        {
          "source": "gap",
          "gapDescription": "What activity is needed here",
          "suggestedPhase": "investigate",
          "suggestedBloom": "understand",
          "suggestedCategory": "research",
          "suggestedGrouping": "pair",
          "suggestedTimeWeight": "moderate",
          "suggestedLessonRole": "core"
        }
      ]
    }
  ]
}`;
}

interface AILesson {
  position: number;
  label: string;
  description: string;
  activities: Array<{
    source: "library" | "gap";
    blockIndex?: number;
    gapDescription?: string;
    suggestedPhase?: string;
    suggestedBloom?: string;
    suggestedCategory?: string;
    suggestedGrouping?: string;
    suggestedTimeWeight?: string;
    suggestedLessonRole?: string;
  }>;
}

// ─── Main ───

export async function stage2_assembleSequence(
  retrieval: BlockRetrievalResult,
  profile: FormatProfile,
  config: AssemblyConfig
): Promise<AssembledSequence> {
  const startMs = Date.now();
  const { request, candidates } = retrieval;
  const modelId = config.modelId || "claude-sonnet-4-20250514";

  // If no candidates, build a pure-gap sequence without AI call
  if (candidates.length === 0) {
    return buildPureGapSequence(request, profile, startMs);
  }

  try {
    const client = new Anthropic({ apiKey: config.apiKey, maxRetries: 2 });
    const prompt = buildAssemblyPrompt(request, profile, candidates);

    const response = await client.messages.create({
      model: modelId,
      system: "You are a curriculum assembly engine. Return ONLY valid JSON — no markdown, no explanation.",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4096,
      temperature: 0.3,
    });

    const textBlock = response.content.find(b => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from assembly AI");
    }

    // Parse JSON from response (strip markdown fences if present)
    let jsonText = textBlock.text.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(jsonText) as { lessons: AILesson[] };
    const aiLessons = parsed.lessons || [];

    // Convert AI response to typed LessonSlots
    const lessons: LessonSlot[] = aiLessons.map((aiLesson, li) => {
      const activities: ActivitySlot[] = (aiLesson.activities || []).map((act, ai) => {
        if (act.source === "library" && act.blockIndex !== undefined && candidates[act.blockIndex]) {
          return {
            slotIndex: ai,
            source: "library" as const,
            block: candidates[act.blockIndex],
          };
        }
        return {
          slotIndex: ai,
          source: "gap" as const,
          gapDescription: act.gapDescription || `Activity for "${request.topic}"`,
          gapContext: {
            suggestedPhase: act.suggestedPhase,
            suggestedBloom: act.suggestedBloom,
            suggestedCategory: act.suggestedCategory,
            suggestedGrouping: act.suggestedGrouping,
            suggestedTimeWeight: act.suggestedTimeWeight,
            suggestedLessonRole: act.suggestedLessonRole,
          },
        };
      });

      return {
        position: aiLesson.position || li + 1,
        label: aiLesson.label || `Lesson ${li + 1}`,
        description: aiLesson.description || "",
        activities,
      };
    });

    // Ensure we have the requested lesson count
    while (lessons.length < request.lessonCount) {
      const i = lessons.length;
      const progress = i / request.lessonCount;
      const phaseIndex = Math.min(
        Math.floor(progress * profile.phases.length),
        profile.phases.length - 1
      );
      const phase = profile.phases[phaseIndex];
      lessons.push({
        position: i + 1,
        label: `Lesson ${i + 1}: ${phase.label}`,
        description: `${phase.description} — focused on "${request.topic}"`,
        activities: [{
          slotIndex: 0,
          source: "gap",
          gapDescription: `${phase.label} activity for "${request.topic}"`,
          gapContext: {
            suggestedPhase: phase.id,
            suggestedBloom: progress < 0.33 ? "understand" : progress < 0.66 ? "apply" : "evaluate",
            suggestedCategory: profile.blockRelevance.boost[0] || "research",
            suggestedTimeWeight: "moderate",
            suggestedLessonRole: "core",
          },
        }],
      });
    }

    const prerequisiteViolations = validatePrerequisites(lessons);
    const filledCount = lessons.reduce(
      (sum, l) => sum + l.activities.filter(a => a.source === "library").length, 0
    );
    const totalSlots = lessons.reduce((sum, l) => sum + l.activities.length, 0);

    const cost: CostBreakdown = {
      inputTokens: response.usage?.input_tokens || 0,
      outputTokens: response.usage?.output_tokens || 0,
      modelId,
      estimatedCostUSD: ((response.usage?.input_tokens || 0) * 3 + (response.usage?.output_tokens || 0) * 15) / 1_000_000,
      timeMs: Date.now() - startMs,
    };

    return {
      request,
      lessons,
      sequenceMetrics: {
        totalSlots,
        filledFromLibrary: filledCount,
        gapsToGenerate: totalSlots - filledCount,
        fillRate: totalSlots > 0 ? filledCount / totalSlots : 0,
        prerequisiteViolations,
        sequenceTimeMs: Date.now() - startMs,
        sequenceCost: cost,
      },
    };
  } catch (e) {
    console.error("[stage2] AI assembly failed, falling back to algorithmic:", e);
    return buildAlgorithmicSequence(request, profile, candidates, startMs);
  }
}

// ─── Fallbacks ───

function buildPureGapSequence(
  request: GenerationRequest,
  profile: FormatProfile,
  startMs: number
): AssembledSequence {
  const lessons: LessonSlot[] = [];
  const lessonCount = request.lessonCount || 6;

  for (let i = 0; i < lessonCount; i++) {
    const progress = i / lessonCount;
    const phaseIndex = Math.min(
      Math.floor(progress * profile.phases.length),
      profile.phases.length - 1
    );
    const phase = profile.phases[phaseIndex];

    // 3 activities per lesson: opening + core + reflection
    const activities: ActivitySlot[] = [
      {
        slotIndex: 0,
        source: "gap",
        gapDescription: `Opening warm-up for ${phase.label}`,
        gapContext: {
          suggestedPhase: phase.id,
          suggestedBloom: "remember",
          suggestedCategory: "warmup",
          suggestedTimeWeight: "quick",
          suggestedLessonRole: "opening",
        },
      },
      {
        slotIndex: 1,
        source: "gap",
        gapDescription: `Core ${phase.label} activity for "${request.topic}"`,
        gapContext: {
          suggestedPhase: phase.id,
          suggestedBloom: progress < 0.33 ? "understand" : progress < 0.66 ? "apply" : "evaluate",
          suggestedCategory: profile.blockRelevance.boost[0] || "research",
          suggestedTimeWeight: "extended",
          suggestedLessonRole: "core",
        },
      },
      {
        slotIndex: 2,
        source: "gap",
        gapDescription: `Reflection on ${phase.label} work`,
        gapContext: {
          suggestedPhase: phase.id,
          suggestedBloom: "evaluate",
          suggestedCategory: "reflection",
          suggestedTimeWeight: "quick",
          suggestedLessonRole: "reflection",
        },
      },
    ];

    lessons.push({
      position: i + 1,
      label: `Lesson ${i + 1}: ${phase.label}`,
      description: `${phase.description} — focused on "${request.topic}"`,
      activities,
    });
  }

  const totalSlots = lessons.reduce((sum, l) => sum + l.activities.length, 0);

  return {
    request,
    lessons,
    sequenceMetrics: {
      totalSlots,
      filledFromLibrary: 0,
      gapsToGenerate: totalSlots,
      fillRate: 0,
      prerequisiteViolations: [],
      sequenceTimeMs: Date.now() - startMs,
      sequenceCost: { ...ZERO_COST, timeMs: Date.now() - startMs },
    },
  };
}

function buildAlgorithmicSequence(
  request: GenerationRequest,
  profile: FormatProfile,
  candidates: RetrievedBlock[],
  startMs: number
): AssembledSequence {
  const lessonCount = request.lessonCount || 6;
  const lessons: LessonSlot[] = [];
  const usedBlocks = new Set<string>();

  for (let i = 0; i < lessonCount; i++) {
    const progress = i / lessonCount;
    const phaseIndex = Math.min(
      Math.floor(progress * profile.phases.length),
      profile.phases.length - 1
    );
    const phase = profile.phases[phaseIndex];

    const activities: ActivitySlot[] = [];

    // Try to find a matching block for this phase
    const match = candidates.find(
      c => c.block.phase === phase.id && !usedBlocks.has(c.block.id)
    );

    if (match) {
      usedBlocks.add(match.block.id);
      activities.push({ slotIndex: 0, source: "library", block: match });
    } else {
      activities.push({
        slotIndex: 0,
        source: "gap",
        gapDescription: `${phase.label} activity for "${request.topic}"`,
        gapContext: {
          suggestedPhase: phase.id,
          suggestedBloom: progress < 0.33 ? "understand" : progress < 0.66 ? "apply" : "evaluate",
          suggestedCategory: profile.blockRelevance.boost[0] || "research",
          suggestedTimeWeight: "moderate",
          suggestedLessonRole: "core",
        },
      });
    }

    lessons.push({
      position: i + 1,
      label: `Lesson ${i + 1}: ${phase.label}`,
      description: `${phase.description} — focused on "${request.topic}"`,
      activities,
    });
  }

  const prerequisiteViolations = validatePrerequisites(lessons);
  const filledCount = lessons.reduce(
    (sum, l) => sum + l.activities.filter(a => a.source === "library").length, 0
  );
  const totalSlots = lessons.reduce((sum, l) => sum + l.activities.length, 0);

  return {
    request,
    lessons,
    sequenceMetrics: {
      totalSlots,
      filledFromLibrary: filledCount,
      gapsToGenerate: totalSlots - filledCount,
      fillRate: totalSlots > 0 ? filledCount / totalSlots : 0,
      prerequisiteViolations,
      sequenceTimeMs: Date.now() - startMs,
      sequenceCost: { ...ZERO_COST, timeMs: Date.now() - startMs },
    },
  };
}
