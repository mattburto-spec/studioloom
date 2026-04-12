/**
 * Stage 4: Connective Tissue & Polish
 *
 * Adds transitions, cross-references, familiarity adjustments,
 * and scaffolding progression to the filled sequence.
 * One AI call over the full sequence (or per-lesson for >8 lessons).
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
  CostBreakdown,
  FilledSequence,
  PolishedSequence,
  PolishedLesson,
  PolishedActivity,
  CrossReference,
  BlockInteraction,
} from "@/types/activity-blocks";
import type { FormatProfile } from "@/lib/ai/unit-types";
import { validateNeutralContent, NeutralValidationError } from "./stage4-neutral-validator";
import { assertNotMaxTokens, MaxTokensError } from "./max-tokens-guard";
import { MODELS } from "@/lib/ai/models";

// ─── Types ───

interface PolishConfig {
  apiKey: string;
  modelId?: string;
}

// ─── Helpers ───

const ZERO_COST: CostBreakdown = {
  inputTokens: 0, outputTokens: 0, modelId: "simulator",
  estimatedCostUSD: 0, timeMs: 0,
};

// 5.6 — Gloss the enum reflectionStyle into a concrete one-line instruction
// so the AI has an actionable directive, not just a label.
function reflectionStyleGloss(style: "end-only" | "continuous" | "milestone"): string {
  switch (style) {
    case "end-only":
      return "Reserve reflection prompts for the final lesson(s) of the unit. Don't pepper earlier lessons with reflection.";
    case "continuous":
      return "Weave brief reflection prompts into every lesson, not just the end. Reflection is ongoing.";
    case "milestone":
      return "Anchor reflection at named project milestones (e.g. end of research, end of action). Not every lesson, not just the end.";
  }
}

function buildPolishPrompt(
  filled: FilledSequence,
  profile: FormatProfile
): string {
  const lessonSummaries = filled.lessons.map(lesson => ({
    position: lesson.position,
    label: lesson.label,
    activities: lesson.activities.map((act, i) => ({
      index: i,
      title: act.title,
      source: act.source,
      phase: act.phase,
      bloom: act.bloom_level,
      outputType: act.output_type || null,
      prerequisiteTags: act.prerequisite_tags || [],
      hasScaffolding: !!act.scaffolding,
    })),
  }));

  return `You are polishing a ${filled.lessons.length}-lesson ${profile.cycleName} unit on "${filled.request.topic}".

## Connective tissue guidance

Audience framing: refer to the student's audience as "${profile.connectiveTissue.audienceLanguage}".

Reflection style: ${profile.connectiveTissue.reflectionStyle}
${reflectionStyleGloss(profile.connectiveTissue.reflectionStyle)}

Use these as transition tone models (don't copy verbatim — use them to calibrate voice and rhythm):
${profile.connectiveTissue.transitionVocabulary.map(v => `  - ${v}`).join("\n")}

## Current Sequence
${JSON.stringify(lessonSummaries, null, 2)}

## Tasks
For each activity, provide:
1. **transitionIn** — 1 sentence connecting from the previous activity/lesson (null for first activity of first lesson)
2. **transitionOut** — 1 sentence previewing what comes next (null for last activity of last lesson)
3. **crossReferences** — array of references to other activities. Include when:
   - An activity builds on earlier work ("Remember the personas you created in Lesson 2")
   - An activity revisits a concept from earlier
   - Activities in different lessons address the same skill/topic
   Format: { "targetLessonPosition": N, "targetActivityIndex": N, "referenceText": "...", "referenceType": "builds_on|revisits|contrasts|extends" }

Also provide:
4. **interactionMap** — array of block interactions across the unit:
   - prerequisite: block B requires output from block A
   - familiarity: block B uses similar skills/tools as block A
   - artifact_flow: output from A feeds into B
   - cross_reference: thematic connection
   Format: { "type": "prerequisite|familiarity|artifact_flow|cross_reference", "fromLesson": N, "fromActivity": N, "toLesson": N, "toActivity": N, "description": "...", "confidence": "verified|inferred" }

5. **scaffoldingNotes** — for each lesson, note if scaffolding should be:
   - "increase" (early lessons, first time students encounter a skill)
   - "maintain" (middle lessons)
   - "reduce" (later lessons, students are more independent)

## Framework-Neutral Vocabulary (HARD CONSTRAINT)
Your output must NOT contain any framework-specific vocabulary.
Do NOT use any of the following tokens anywhere in transitions,
cross-references, or descriptions:
- "Criterion A", "Criterion B", "Criterion C", "Criterion D"
- "AO1", "AO2", "AO3", "AO4"
- "MYP"
- "GCSE"

If you need to reference an assessment dimension, use the neutral
vocabulary: researching, analysing, designing, creating,
evaluating, reflecting, communicating, or planning.

The output is post-validated and the entire pipeline will fail
loudly if any forbidden token appears.

Respond with JSON:
{
  "activities": [
    {
      "lessonPosition": 1,
      "activityIndex": 0,
      "transitionIn": "...",
      "transitionOut": "...",
      "crossReferences": []
    }
  ],
  "interactionMap": [],
  "scaffoldingNotes": { "1": "increase", "2": "maintain" }
}`;
}

interface AIPolishResult {
  activities: Array<{
    lessonPosition: number;
    activityIndex: number;
    transitionIn?: string;
    transitionOut?: string;
    crossReferences?: CrossReference[];
  }>;
  interactionMap: BlockInteraction[];
  scaffoldingNotes?: Record<string, string>;
}

// ─── Main ───

export async function stage4_polish(
  filled: FilledSequence,
  profile: FormatProfile,
  config: PolishConfig
): Promise<PolishedSequence> {
  const startMs = Date.now();
  const modelId = config.modelId || MODELS.SONNET;

  let polishResult: AIPolishResult | null = null;
  let aiCost: CostBreakdown = { ...ZERO_COST };

  try {
    const client = new Anthropic({ apiKey: config.apiKey, maxRetries: 2 });

    // For long units (>8 lessons), process in chunks
    if (filled.lessons.length > 8) {
      polishResult = await polishInChunks(filled, profile, client, modelId);
    } else {
      const prompt = buildPolishPrompt(filled, profile);

      const response = await client.messages.create({
        model: modelId,
        system: "You are a curriculum continuity editor. Return ONLY valid JSON.",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 4096,
        temperature: 0.3,
      });

      // Lesson #39 — fail loud on max_tokens truncation before JSON.parse
      // can die with a cryptic "Unexpected end of JSON input".
      assertNotMaxTokens(response, "stage4_polish", 4096);

      const textBlock = response.content.find(b => b.type === "text");
      if (textBlock && textBlock.type === "text") {
        let jsonText = textBlock.text.trim();
        if (jsonText.startsWith("```")) {
          jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
        }
        polishResult = JSON.parse(jsonText) as AIPolishResult;
        // Phase 2 sub-task 5.2 — fail-loud neutral content enforcement
        validateNeutralContent(jsonText);
      }

      aiCost = {
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0,
        modelId,
        estimatedCostUSD: ((response.usage?.input_tokens || 0) * 3 + (response.usage?.output_tokens || 0) * 15) / 1_000_000,
        timeMs: Date.now() - startMs,
      };
    }
  } catch (e) {
    // Lesson #39 — max_tokens truncation is a loud, fail-fast condition.
    if (e instanceof MaxTokensError) throw e;
    if (e instanceof NeutralValidationError) throw e;
    console.error("[stage4] AI polish failed, using algorithmic fallback:", e);
  }

  // Build polished output
  const polishMap = new Map<string, {
    transitionIn?: string;
    transitionOut?: string;
    crossReferences?: CrossReference[];
  }>();

  if (polishResult?.activities) {
    for (const act of polishResult.activities) {
      const key = `${act.lessonPosition}-${act.activityIndex}`;
      polishMap.set(key, {
        transitionIn: act.transitionIn,
        transitionOut: act.transitionOut,
        crossReferences: act.crossReferences,
      });
    }
  }

  let transitionsAdded = 0;
  let crossReferencesAdded = 0;
  let scaffoldingProgressions = 0;

  const lessons: PolishedLesson[] = filled.lessons.map((lesson, li) => {
    const lessonProgress = li / filled.lessons.length;

    const activities: PolishedActivity[] = lesson.activities.map((act, ai) => {
      const key = `${lesson.position}-${ai}`;
      const polish = polishMap.get(key);

      // Algorithmic fallback for transitions
      let transitionIn = polish?.transitionIn;
      let transitionOut = polish?.transitionOut;
      const crossReferences = polish?.crossReferences || [];

      if (!transitionIn && (li > 0 || ai > 0)) {
        if (ai > 0) {
          const prevAct = lesson.activities[ai - 1];
          transitionIn = `Building on "${prevAct.title}", now...`;
        } else {
          const prevLesson = filled.lessons[li - 1];
          transitionIn = `Continuing from ${prevLesson.label}...`;
        }
      }

      if (!transitionOut && (li < filled.lessons.length - 1 || ai < lesson.activities.length - 1)) {
        transitionOut = ai < lesson.activities.length - 1
          ? `Next, you'll move on to the next activity.`
          : `In the next lesson, you'll continue this work.`;
      }

      if (transitionIn) transitionsAdded++;
      crossReferencesAdded += crossReferences.length;

      // Adjust scaffolding based on position
      let scaffolding = act.scaffolding;
      if (scaffolding && lessonProgress > 0.7) {
        // Late in unit — reduce scaffolding
        scaffolding = {
          ...scaffolding,
          hints: scaffolding.hints?.slice(0, 1),
          sentence_starters: scaffolding.sentence_starters?.slice(0, 1),
          worked_example: undefined,
        };
        scaffoldingProgressions++;
      }

      return {
        ...act,
        scaffolding,
        transitionIn: transitionIn || undefined,
        transitionOut: transitionOut || undefined,
        crossReferences,
      };
    });

    return { ...lesson, activities };
  });

  const interactionMap = polishResult?.interactionMap || buildAlgorithmicInteractions(filled);

  return {
    request: filled.request,
    lessons,
    polishMetrics: {
      transitionsAdded,
      crossReferencesAdded,
      familiarityAdaptations: 0,
      scaffoldingProgressions,
      totalTokensUsed: aiCost.inputTokens + aiCost.outputTokens,
      totalCost: aiCost,
      polishTimeMs: Date.now() - startMs,
    },
    interactionMap,
  };
}

// ─── Helpers ───

async function polishInChunks(
  filled: FilledSequence,
  profile: FormatProfile,
  client: Anthropic,
  modelId: string
): Promise<AIPolishResult> {
  const chunkSize = 4;
  const allActivities: AIPolishResult["activities"] = [];
  const allInteractions: BlockInteraction[] = [];

  for (let i = 0; i < filled.lessons.length; i += chunkSize) {
    const chunk: FilledSequence = {
      ...filled,
      lessons: filled.lessons.slice(i, i + chunkSize),
    };

    try {
      const prompt = buildPolishPrompt(chunk, profile);
      const response = await client.messages.create({
        model: modelId,
        system: "You are a curriculum continuity editor. Return ONLY valid JSON.",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2048,
        temperature: 0.3,
      });

      // Lesson #39 — fail loud on max_tokens truncation before JSON.parse
      // can die with a cryptic "Unexpected end of JSON input".
      assertNotMaxTokens(response, "stage4_polishInChunks", 2048);

      const textBlock = response.content.find(b => b.type === "text");
      if (textBlock && textBlock.type === "text") {
        let jsonText = textBlock.text.trim();
        if (jsonText.startsWith("```")) {
          jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
        }
        const chunkResult = JSON.parse(jsonText) as AIPolishResult;
        // Phase 2 sub-task 5.2 — fail-loud neutral content enforcement
        validateNeutralContent(jsonText);
        if (chunkResult.activities) allActivities.push(...chunkResult.activities);
        if (chunkResult.interactionMap) allInteractions.push(...chunkResult.interactionMap);
      }
    } catch (e) {
      // Lesson #39 — max_tokens truncation is a loud, fail-fast condition;
      // re-throw out of the chunks loop so stage4_polish's outer catch can
      // surface it to the caller instead of silently producing empty polish.
      if (e instanceof MaxTokensError) throw e;
      if (e instanceof NeutralValidationError) throw e;
      console.error(`[stage4] Chunk ${i}-${i + chunkSize} failed:`, e);
    }
  }

  return { activities: allActivities, interactionMap: allInteractions };
}

function buildAlgorithmicInteractions(filled: FilledSequence): BlockInteraction[] {
  const interactions: BlockInteraction[] = [];
  const outputMap = new Map<string, { lesson: number; activity: number }>();

  for (let li = 0; li < filled.lessons.length; li++) {
    for (let ai = 0; ai < filled.lessons[li].activities.length; ai++) {
      const act = filled.lessons[li].activities[ai];

      // Track outputs
      if (act.output_type) {
        outputMap.set(act.output_type, { lesson: li + 1, activity: ai });
      }

      // Check prerequisites
      if (act.prerequisite_tags) {
        for (const tag of act.prerequisite_tags) {
          const producer = outputMap.get(tag);
          if (producer) {
            interactions.push({
              type: "prerequisite",
              fromLesson: producer.lesson,
              fromActivity: producer.activity,
              toLesson: li + 1,
              toActivity: ai,
              description: `"${act.title}" requires "${tag}" from a previous activity`,
              confidence: "verified",
            });
          }
        }
      }
    }
  }

  return interactions;
}
