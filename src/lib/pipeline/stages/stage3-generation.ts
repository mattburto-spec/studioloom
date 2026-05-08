/**
 * Stage 3: Gap Generation
 *
 * Fills gaps identified in Stage 2 with AI-generated activities.
 * One Sonnet call per gap, parallelized via Promise.all.
 * Most expensive stage — most tokens spent here.
 */

import { callAnthropicMessages } from "@/lib/ai/call";
import type {
  CostBreakdown,
  AssembledSequence,
  FilledSequence,
  FilledLesson,
  FilledActivity,
  GapMetric,
  ActivitySlot,
  Scaffolding,
  AIRules,
} from "@/types/activity-blocks";
import type { FormatProfile } from "@/lib/ai/unit-types";
import { MaxTokensError } from "./max-tokens-guard";
import { MODELS } from "@/lib/ai/models";

// ─── Types ───

interface GenerationConfig {
  apiKey: string;
  modelId?: string;
  maxConcurrency?: number;
}

// ─── Helpers ───

// 5.5 — Forbidden-pattern validator. Scans the FULL serialized AI response
// (JSON.stringify + toLowerCase) for any natural-language banned phrase from
// profile.gapGenerationRules.forbiddenPatterns. Returns the first matching
// pattern string if a violation is detected, or null if clean. Called after
// JSON.parse of the AI response, before the activity is accepted into the
// output. Per Matt's lock: case-insensitive substring, whole-response scan.
//
// Design note: we intentionally stringify the entire response (not just the
// student-facing text fields) so the AI cannot hide banned content in
// metadata, tags, or bookkeeping fields. False-positive risk is mitigated by
// the distinctive natural-language shape of the spec's forbidden patterns.
export function findForbiddenPattern(
  parsedAIResponse: unknown,
  profile: FormatProfile
): string | null {
  const patterns = profile.gapGenerationRules?.forbiddenPatterns ?? [];
  if (patterns.length === 0) return null;

  const serialized = JSON.stringify(parsedAIResponse).toLowerCase();
  for (const pattern of patterns) {
    if (serialized.includes(pattern.toLowerCase())) {
      return pattern;
    }
  }
  return null;
}

const ZERO_COST: CostBreakdown = {
  inputTokens: 0, outputTokens: 0, modelId: "simulator",
  estimatedCostUSD: 0, timeMs: 0,
};

function buildGapPrompt(
  gap: ActivitySlot,
  lessonLabel: string,
  lessonPosition: number,
  totalLessons: number,
  topic: string,
  gradeLevel: string,
  profile: FormatProfile
): string {
  const ctx = gap.gapContext || {};
  const progress = lessonPosition / totalLessons;
  const progressLabel = progress < 0.33 ? "early" : progress < 0.66 ? "middle" : "late";

  return `Generate a single teaching activity for a ${profile.cycleName} unit.

## Context
- Topic: "${topic}"
- Grade: ${gradeLevel}
- Lesson: "${lessonLabel}" (${lessonPosition}/${totalLessons}, ${progressLabel} in unit)
- Unit type: ${profile.type}
- Phase: ${ctx.suggestedPhase || "core"}
- Gap description: ${gap.gapDescription || "Activity needed"}

## Requirements
- Bloom level: ${ctx.suggestedBloom || "apply"}
- Grouping: ${ctx.suggestedGrouping || "individual"}
- Time weight: ${ctx.suggestedTimeWeight || "moderate"} (quick=5-8min, moderate=10-18min, extended=20-35min)
- Category: ${ctx.suggestedCategory || "research"}
- Lesson role: ${ctx.suggestedLessonRole || "core"}

## Teaching Context
${(profile.gapGenerationRules?.teachingPrinciples ?? profile.teachingPrinciples).slice(0, 500)}

## Scaffolding Requirements
- Include hints (2-3 progressive hints)
- Include sentence starters (3-4 for ELL support)
- Include vocabulary if relevant
- ${progressLabel === "early" ? "Heavy scaffolding — worked examples, structured templates" : progressLabel === "middle" ? "Moderate scaffolding — some sentence starters" : "Minimal scaffolding — extension prompts only"}

## AI Rules for This Activity
Determine the appropriate AI interaction rules:
- phase: "divergent" (ideation/brainstorming), "convergent" (analysis/evaluation), or "neutral"
- tone: brief description of how AI should interact
- rules: 2-3 specific behaviour rules for the AI mentor

Respond with JSON matching this exact schema (Lever 1 — three slot fields, NOT a single prompt):
{
  "title": "Short descriptive title",
  "framing": "ONE sentence (≤200 chars) orienting the student: what they're doing and why it matters today. Direct, second-person. Reads quietly as the lead.",
  "task": "The imperative body — numbered list for discrete steps. ≤800 chars. NO ### headings or | col | tables (renderer drops them). Inline **bold**/*italic*/[links](url)/lists fine.",
  "success_signal": "ONE sentence (≤200 chars) telling the student what to produce/record/submit/share. Use a clear production verb. ALWAYS PRESENT.",
  "bloom_level": "${ctx.suggestedBloom || "apply"}",
  "time_weight": "${ctx.suggestedTimeWeight || "moderate"}",
  "grouping": "${ctx.suggestedGrouping || "individual"}",
  "phase": "${ctx.suggestedPhase || "core"}",
  "activity_category": "${ctx.suggestedCategory || "research"}",
  "lesson_structure_role": "${ctx.suggestedLessonRole || "core"}",
  "response_type": "long-text",
  "materials_needed": [],
  "scaffolding": {
    "hints": ["Hint 1", "Hint 2"],
    "sentence_starters": ["Start with...", "Consider..."],
    "worked_example": "Brief example or null",
    "vocabulary": ["term1", "term2"]
  },
  "ai_rules": {
    "phase": "divergent|convergent|neutral",
    "tone": "Brief tone description",
    "rules": ["Rule 1", "Rule 2"]
  },
  "udl_checkpoints": ["5.1", "7.2"],
  "success_look_fors": ["Student can...", "Evidence of..."],
  "output_type": "what this activity produces (e.g., research_notes, sketch, analysis)",
  "prerequisite_tags": []
}`;
}

interface AIActivity {
  title: string;
  // Lever 1 — three v2 slot fields. The legacy `prompt` field is
  // composed at persist time (output-adapter) from these three.
  framing: string;
  task: string;
  success_signal: string;
  /** Legacy single-blob fallback. May be present in older fixtures or
   *  fallback paths; consumers compose from slots when present. */
  prompt?: string;
  bloom_level: string;
  time_weight: string;
  grouping: string;
  phase: string;
  activity_category: string;
  lesson_structure_role: string;
  response_type: string;
  materials_needed: string[];
  scaffolding?: Scaffolding;
  ai_rules?: AIRules;
  udl_checkpoints?: string[];
  success_look_fors?: string[];
  output_type?: string;
  prerequisite_tags?: string[];
}

// ─── Main ───

export async function stage3_fillGaps(
  assembled: AssembledSequence,
  profile: FormatProfile,
  config: GenerationConfig
): Promise<FilledSequence> {
  const startMs = Date.now();
  const modelId = config.modelId || MODELS.SONNET;
  const maxConcurrency = config.maxConcurrency ?? 4;
  const { request } = assembled;

  // Collect all gaps that need filling
  interface GapTask {
    lessonIndex: number;
    activityIndex: number;
    slot: ActivitySlot;
    lessonLabel: string;
    lessonPosition: number;
  }

  const gapTasks: GapTask[] = [];
  for (let li = 0; li < assembled.lessons.length; li++) {
    const lesson = assembled.lessons[li];
    for (let ai = 0; ai < lesson.activities.length; ai++) {
      const slot = lesson.activities[ai];
      if (slot.source === "gap") {
        gapTasks.push({
          lessonIndex: li,
          activityIndex: ai,
          slot,
          lessonLabel: lesson.label,
          lessonPosition: lesson.position,
        });
      }
    }
  }

  // Fill gaps with AI calls, batched by concurrency limit (calls go through callAnthropicMessages helper)
  const gapResults = new Map<string, { activity: AIActivity; metric: GapMetric }>();
  const perGapMetrics: GapMetric[] = [];

  // Process in batches
  for (let batch = 0; batch < gapTasks.length; batch += maxConcurrency) {
    const batchTasks = gapTasks.slice(batch, batch + maxConcurrency);

    const batchResults = await Promise.allSettled(
      batchTasks.map(async (task) => {
        const gapStartMs = Date.now();
        const key = `${task.lessonIndex}-${task.activityIndex}`;

        try {
          const prompt = buildGapPrompt(
            task.slot,
            task.lessonLabel,
            task.lessonPosition,
            assembled.lessons.length,
            request.topic,
            request.gradeLevel,
            profile
          );

          const callResult = await callAnthropicMessages({
            apiKey: config.apiKey,
            endpoint: "lib/pipeline/stage3-generation",
            model: modelId,
            // 5.5 — Inject aiPersona from nested gapGenerationRules, fall back to flat field for back-compat.
            // teachingPrinciples follows the same nested-preferred pattern at its read site in buildGapPrompt.
            system: `You are a ${profile.cycleName} curriculum designer.\n\n## Persona\n${profile.gapGenerationRules?.aiPersona ?? profile.aiPersona}\n\nReturn ONLY valid JSON — no markdown, no explanation.`,
            messages: [{ role: "user", content: prompt }],
            maxTokens: 2048,
            temperature: 0.7,
          });

          // Lesson #39 — fail loud on max_tokens truncation before JSON.parse
          // can die with a cryptic "Unexpected end of JSON input".
          if (!callResult.ok) {
            if (callResult.reason === "truncated") throw new MaxTokensError("stage3_fillGaps", 2048);
            if (callResult.reason === "api_error") throw callResult.error;
            throw new Error(`stage3_fillGaps: ${callResult.reason}`);
          }
          const response = callResult.response;

          const textBlock = response.content.find(b => b.type === "text");
          if (!textBlock || textBlock.type !== "text") {
            throw new Error("No text response");
          }

          let jsonText = textBlock.text.trim();
          if (jsonText.startsWith("```")) {
            jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
          }

          const activity = JSON.parse(jsonText) as AIActivity;

          // 5.5 — Forbidden-pattern validator. If AI gap-fill output contains a banned phrase
          // from profile.gapGenerationRules.forbiddenPatterns, discard the AI output and throw
          // into the local catch so the standard per-gap fallback path fires. This keeps the
          // fallback discriminator (metric.modelUsed === "fallback") consistent with existing
          // parse-error semantics — tests can distinguish AI-happy from fallback via that
          // single field. Per Matt's lock: soft-warn, per-gap fallback, output-level.
          const violatingPattern = findForbiddenPattern(activity, profile);
          if (violatingPattern !== null) {
            console.warn(
              `[stage3_fillGaps] Forbidden pattern detected in AI output: "${violatingPattern}" (profile=${profile.type}, gap=${task.lessonIndex}-${task.activityIndex}). Falling back.`
            );
            throw new Error(`Forbidden pattern in AI output: ${violatingPattern}`);
          }

          const metric: GapMetric = {
            gapIndex: batch + batchTasks.indexOf(task),
            lessonPosition: task.lessonPosition,
            tokensUsed: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
            cost: {
              inputTokens: response.usage?.input_tokens || 0,
              outputTokens: response.usage?.output_tokens || 0,
              modelId,
              estimatedCostUSD: ((response.usage?.input_tokens || 0) * 3 + (response.usage?.output_tokens || 0) * 15) / 1_000_000,
              timeMs: Date.now() - gapStartMs,
            },
            timeMs: Date.now() - gapStartMs,
            modelUsed: modelId,
            promptTokens: response.usage?.input_tokens || 0,
            completionTokens: response.usage?.output_tokens || 0,
          };

          return { key, activity, metric };
        } catch (e) {
          // Lesson #39 — max_tokens truncation is a loud, fail-fast condition;
          // re-throw so Promise.allSettled surfaces it as a rejection instead
          // of silently falling back to a generic gap activity.
          if (e instanceof MaxTokensError) throw e;
          console.error(`[stage3] Gap fill failed for ${key}:`, e);
          // Fallback: create a basic activity from the gap context
          const ctx = task.slot.gapContext || {};
          const fallback: AIActivity = {
            title: task.slot.gapDescription || "Activity",
            framing: `An ${ctx.suggestedCategory || "activity"} task for "${request.topic}".`,
            task: `Complete this ${ctx.suggestedCategory || "activity"} task. Document your work as you go.`,
            success_signal: "Submit your completed work.",
            bloom_level: ctx.suggestedBloom || "apply",
            time_weight: ctx.suggestedTimeWeight || "moderate",
            grouping: ctx.suggestedGrouping || "individual",
            phase: ctx.suggestedPhase || "",
            activity_category: ctx.suggestedCategory || "research",
            lesson_structure_role: ctx.suggestedLessonRole || "core",
            response_type: "long-text",
            materials_needed: [],
            scaffolding: { hints: ["Think about the key requirements."], sentence_starters: ["I think..."] },
          };
          return {
            key,
            activity: fallback,
            metric: {
              gapIndex: batch + batchTasks.indexOf(task),
              lessonPosition: task.lessonPosition,
              tokensUsed: 0, cost: { ...ZERO_COST, timeMs: Date.now() - gapStartMs },
              timeMs: Date.now() - gapStartMs, modelUsed: "fallback",
              promptTokens: 0, completionTokens: 0,
            },
          };
        }
      })
    );

    for (const result of batchResults) {
      // Lesson #39 — don't let Promise.allSettled swallow a MaxTokensError.
      if (result.status === "rejected" && result.reason instanceof MaxTokensError) throw result.reason;
      if (result.status === "fulfilled") {
        gapResults.set(result.value.key, {
          activity: result.value.activity,
          metric: result.value.metric,
        });
        perGapMetrics.push(result.value.metric);
      }
    }
  }

  // Build FilledSequence
  const lessons: FilledLesson[] = assembled.lessons.map((lesson, li) => {
    const activities: FilledActivity[] = lesson.activities.map((slot, ai) => {
      if (slot.source === "library" && slot.block) {
        const b = slot.block.block;
        // Lever 1 — pull v2 slots from the activity_block. For legacy
        // blocks where the seeder didn't populate them, fall back to
        // the legacy prompt (renderer will render through legacy path).
        const framing = b.framing || "";
        const task = b.task || (b.framing ? "" : b.prompt);
        const success_signal = b.success_signal || "";
        return {
          source: "library" as const,
          sourceBlockId: b.id,
          title: b.title,
          framing,
          task,
          success_signal,
          prompt: b.prompt,
          bloom_level: b.bloom_level || "apply",
          time_weight: b.time_weight,
          grouping: b.grouping,
          phase: b.phase || "",
          activity_category: b.activity_category || "research",
          lesson_structure_role: b.lesson_structure_role || "core",
          response_type: b.response_type || "long-text",
          materials_needed: b.materials_needed,
          scaffolding: b.scaffolding,
          ai_rules: b.ai_rules,
          udl_checkpoints: b.udl_checkpoints,
          success_look_fors: b.success_look_fors,
          output_type: b.output_type || undefined,
          prerequisite_tags: b.prerequisite_tags,
        };
      }

      // Gap — use AI-generated activity
      const key = `${li}-${ai}`;
      const generated = gapResults.get(key);
      if (generated) {
        const act = generated.activity;
        // Lever 1 — generated activities now produce three slot fields
        // per the updated AIActivity contract. Compose legacy prompt
        // from them as the fallback for any reader still on prompt.
        const composedPrompt = [act.framing, act.task, act.success_signal]
          .filter((s) => s && s.trim())
          .join("\n\n") || act.prompt || act.title;
        return {
          source: "generated" as const,
          title: act.title,
          framing: act.framing || "",
          task: act.task || "",
          success_signal: act.success_signal || "",
          prompt: composedPrompt,
          bloom_level: act.bloom_level || "apply",
          time_weight: act.time_weight || "moderate",
          grouping: act.grouping || "individual",
          phase: act.phase || "",
          activity_category: act.activity_category || "research",
          lesson_structure_role: act.lesson_structure_role || "core",
          response_type: act.response_type || "long-text",
          materials_needed: act.materials_needed || [],
          scaffolding: act.scaffolding,
          ai_rules: act.ai_rules,
          udl_checkpoints: act.udl_checkpoints,
          success_look_fors: act.success_look_fors,
          output_type: act.output_type,
          prerequisite_tags: act.prerequisite_tags,
        };
      }

      // Absolute fallback
      const ctx = slot.gapContext || {};
      const fallbackFraming = `An activity for "${request.topic}".`;
      const fallbackTask = `Complete this activity. Document your work as you go.`;
      const fallbackSignal = "Submit your completed work.";
      return {
        source: "generated" as const,
        title: slot.gapDescription || "Activity",
        framing: fallbackFraming,
        task: fallbackTask,
        success_signal: fallbackSignal,
        prompt: `${fallbackFraming}\n\n${fallbackTask}\n\n${fallbackSignal}`,
        bloom_level: ctx.suggestedBloom || "apply",
        time_weight: ctx.suggestedTimeWeight || "moderate",
        grouping: ctx.suggestedGrouping || "individual",
        phase: ctx.suggestedPhase || "",
        activity_category: ctx.suggestedCategory || "research",
        lesson_structure_role: ctx.suggestedLessonRole || "core",
        response_type: "long-text",
        materials_needed: [],
      };
    });

    return {
      position: lesson.position,
      label: lesson.label,
      description: lesson.description,
      learningGoal: `Students will develop ${profile.cycleName} skills through "${request.topic}"`,
      activities,
    };
  });

  const totalTokens = perGapMetrics.reduce((sum, m) => sum + m.tokensUsed, 0);
  const totalCostUSD = perGapMetrics.reduce((sum, m) => sum + m.cost.estimatedCostUSD, 0);

  return {
    request,
    lessons,
    generationMetrics: {
      gapsFilled: gapTasks.length,
      totalTokensUsed: totalTokens,
      totalCost: {
        inputTokens: perGapMetrics.reduce((s, m) => s + m.promptTokens, 0),
        outputTokens: perGapMetrics.reduce((s, m) => s + m.completionTokens, 0),
        modelId,
        estimatedCostUSD: totalCostUSD,
        timeMs: Date.now() - startMs,
      },
      generationTimeMs: Date.now() - startMs,
      perGapMetrics,
    },
  };
}
