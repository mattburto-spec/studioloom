/**
 * AI assist helpers for the skill card authoring form.
 *
 * Path A from the "skills authoring is too complex" feedback (24 Apr 2026):
 * the form has too many fields with no support — teachers stare at empty
 * "Demo of competency" / "Learning outcomes" / "Framework anchors" / quiz
 * sections and don't know what to write. These helpers generate inline
 * suggestions on demand so the form stops being a blank-page exercise.
 *
 * Each helper is a single Claude call:
 *   - Three lightweight ones (demo / outcomes / anchors) use Haiku +
 *     JSON-via-prompt — same pattern as src/app/api/teacher/lesson-editor
 *     /ai-field/route.ts. Cheap, fast, good enough for short text lists.
 *   - The quiz generator uses Sonnet + tool_choice for structured output
 *     (same pattern as src/lib/ai/anthropic.ts generateOutlines) because
 *     the QuizQuestion shape is rich and we need shape guarantees.
 *
 * Helpers consume a CardDraft — the partially-filled card state from the
 * editor — and return suggestion arrays. The caller (an API route) is
 * responsible for auth + persistence; these are pure server-side
 * generators.
 */

import type Anthropic from "@anthropic-ai/sdk";
import { callAnthropicMessages } from "@/lib/ai/call";
import { MODELS } from "@/lib/ai/models";
import {
  CONTROLLED_VERBS,
  type Block,
  type FrameworkAnchor,
  type QuizQuestion,
  type SkillTier,
} from "@/types/skills";
import { nanoid } from "nanoid";

// ============================================================================
// Card draft — the context payload passed to every helper
// ============================================================================

/**
 * Subset of the form state shipped to every helper. We don't need the full
 * SkillCardRow — we only need the fields that meaningfully shape what the
 * AI should produce. Extra fields are tolerated (forward-compat) but the
 * helpers ignore them.
 */
export interface CardDraft {
  title: string;
  summary?: string | null;
  tier?: SkillTier | null;
  age_min?: number | null;
  age_max?: number | null;
  /** The body blocks already authored. Flattened to text so the AI can
   *  reference what the card actually teaches. Optional — early in the
   *  authoring flow the body may be empty. */
  body?: Block[];
  /** Already-filled demo line, if any — helpers can use it as anchor or
   *  to suggest variants. */
  demo_of_competency?: string | null;
  /** Already-filled outcomes — helpers can suggest more without
   *  duplicating. */
  learning_outcomes?: string[];
  /** Existing framework anchors — same idea, avoid duplicate suggestions. */
  framework_anchors?: FrameworkAnchor[];
}

// ============================================================================
// Body → plain text — feeds richer context to the AI
// ============================================================================

/**
 * Flatten a card's body blocks into a single readable text outline. Each
 * block becomes a labelled section so the AI sees structure rather than
 * one long paragraph. Length-capped to keep prompts cheap.
 */
function flattenBody(blocks: Block[] | undefined): string {
  if (!blocks || blocks.length === 0) return "(no body authored yet)";
  const parts: string[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case "key_concept":
        parts.push(
          `[Key concept] ${b.title}\n${b.content}` +
            (b.tips?.length ? `\nTips: ${b.tips.join("; ")}` : "") +
            (b.examples?.length ? `\nExamples: ${b.examples.join("; ")}` : "") +
            (b.warning ? `\nWarning: ${b.warning}` : "")
        );
        break;
      case "micro_story":
        parts.push(
          `[Micro story] ${b.title}\n${b.narrative}\nKey lesson: ${b.key_lesson}`
        );
        break;
      case "scenario":
        parts.push(
          `[Scenario] ${b.title}\n${b.setup}\nBranches: ${b.branches
            .map(
              (br) =>
                `${br.choice_text} (${br.is_correct ? "correct" : "wrong"}: ${br.feedback})`
            )
            .join(" | ")}`
        );
        break;
      case "before_after":
        parts.push(
          `[Before/After] ${b.title}\nBefore: ${b.before.caption} — hazards: ${b.before.hazards.join("; ")}\nAfter: ${b.after.caption} — principles: ${b.after.principles.join("; ")}\nKey difference: ${b.key_difference}`
        );
        break;
      case "step_by_step":
        parts.push(
          `[Step by step] ${b.title}\n${b.steps
            .map((s) => `${s.number}. ${s.instruction}${s.warning ? ` (warning: ${s.warning})` : ""}`)
            .join("\n")}`
        );
        break;
      case "comprehension_check":
        parts.push(
          `[Comprehension check] Q: ${b.question}\nOptions: ${b.options.join(" / ")}\nCorrect: ${b.options[b.correct_index]}`
        );
        break;
      case "video_embed":
        parts.push(`[Video] ${b.title ?? b.url}${b.caption ? ` — ${b.caption}` : ""}`);
        break;
      case "accordion":
        parts.push(`[Accordion] ${b.title}\n${b.body}`);
        break;
      // Legacy / generic types — fall back to a generic label.
      case "prose":
        parts.push(`[Prose] ${b.text}`);
        break;
      case "callout":
        parts.push(`[${b.tone}] ${b.text}`);
        break;
      case "checklist":
        parts.push(`[Checklist]\n- ${b.items.join("\n- ")}`);
        break;
      case "worked_example":
        parts.push(`[Worked example] ${b.title}\n- ${b.steps.join("\n- ")}`);
        break;
      case "think_aloud":
        parts.push(`[Think aloud] Q: ${b.prompt}\nA: ${b.answer}`);
        break;
      default:
        // Embed / image / video / gallery / compare_images / code /
        // side_by_side carry no rich teaching text — skip.
        break;
    }
  }
  const joined = parts.join("\n\n");
  // Cap at ~6k chars so prompts stay under ~2k tokens of context.
  return joined.length > 6000 ? joined.slice(0, 6000) + "\n…(truncated)" : joined;
}

/**
 * One-line context preamble shared by every helper — gives the AI the
 * card's identity.
 */
function buildIdentityLine(d: CardDraft): string {
  const tier = d.tier ? d.tier.toUpperCase() : "(no tier set)";
  const age =
    d.age_min && d.age_max
      ? `ages ${d.age_min}-${d.age_max}`
      : d.age_min
        ? `ages ${d.age_min}+`
        : d.age_max
          ? `up to age ${d.age_max}`
          : "no age band";
  const summary = d.summary?.trim() ? ` Summary: ${d.summary.trim()}` : "";
  return `Card title: "${d.title}". Tier: ${tier}. ${age}.${summary}`;
}

// ============================================================================
// JSON-array extraction — robust against markdown fences + numbered lists
// ============================================================================

function extractJsonArray<T>(text: string): T[] {
  if (!text) return [];
  // Try direct parse first
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed as T[];
  } catch {
    // fall through
  }
  // Locate the first [ ... ] segment
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) return parsed as T[];
    } catch {
      // fall through
    }
  }
  return [];
}

// ============================================================================
// 1. Demo of competency — 3-5 candidate "Student will…" lines
// ============================================================================

/**
 * Generate 3-5 candidate "demo of competency" lines for the card. Each
 * starts with a controlled verb (research brief principle #2 — verbs are
 * sacred). Returns an array of strings; if the AI somehow returns
 * unverifiable verbs we filter them out.
 */
export async function suggestDemoOfCompetency(
  draft: CardDraft
): Promise<string[]> {
  const verbList = CONTROLLED_VERBS.join(" / ");

  const system = `You are a curriculum design assistant for a skill card library used by secondary teachers (ages 11-18). You write the "demo of competency" line — the single sentence a student must demonstrate to earn the card. Always return a JSON array of strings, no commentary.`;

  const user = `${buildIdentityLine(draft)}

The card's body so far:
${flattenBody(draft.body)}

${draft.demo_of_competency?.trim() ? `Current demo line (offer alternatives or refinements): "${draft.demo_of_competency.trim()}"` : "The demo field is currently empty."}

Generate 3-5 candidate demo lines for this card. Each line:
- Must start with one of these verbs: ${verbList}
- Must be ONE sentence
- Must be observable / verifiable (something a teacher could mark off after watching the student do it)
- BANNED verbs: understand / know about / appreciate / be aware of (unverifiable)
- Should match the card's tier and age band
- Should reflect what the body actually teaches

Return a JSON array of exactly 3-5 strings.
Example: ["Demonstrate ...", "Produce ...", "Explain ..."]
Return ONLY the JSON array, nothing else.`;

  const callResult = await callAnthropicMessages({
    endpoint: "lib/skills/ai-helpers/demo",
    model: MODELS.HAIKU,
    maxTokens: 600,
    system,
    messages: [{ role: "user", content: user }],
  });

  if (!callResult.ok) {
    if (callResult.reason === "api_error") throw callResult.error;
    throw new Error(`suggestDemoOfCompetency: ${callResult.reason}`);
  }

  const response = callResult.response;
  const text =
    response.content[0]?.type === "text" ? response.content[0].text : "";
  const arr = extractJsonArray<string>(text)
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .map((s) => s.trim());

  // Defensive filter: drop anything starting with a banned verb.
  const BANNED = ["understand", "know", "appreciate", "be aware"];
  const verbsLower = (CONTROLLED_VERBS as readonly string[]).map((v) =>
    v.toLowerCase()
  );
  return arr.filter((line) => {
    const first = line.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, "") ?? "";
    if (BANNED.some((b) => first.startsWith(b))) return false;
    if (!verbsLower.includes(first)) {
      // Soft tolerance: keep if it doesn't start with a banned verb. Some
      // models will produce "Sketch and …" which begins with a controlled
      // verb but our exact-match misses; check word-includes instead.
      if (!verbsLower.some((v) => first === v || first === v + "s")) {
        return false;
      }
    }
    return true;
  }).slice(0, 5);
}

// ============================================================================
// 2. Learning outcomes — 3 "Student can…" outcomes
// ============================================================================

export async function suggestLearningOutcomes(
  draft: CardDraft
): Promise<string[]> {
  const existing = (draft.learning_outcomes ?? [])
    .map((o) => o.trim())
    .filter((o) => o.length > 0);

  const system = `You are a curriculum design assistant. You write learning outcomes for a single skill card. Each outcome is a "Student can…" sentence — observable, age-appropriate, and tied to what the card teaches. Always return a JSON array of strings, no commentary.`;

  const user = `${buildIdentityLine(draft)}

The card's body so far:
${flattenBody(draft.body)}

${draft.demo_of_competency?.trim() ? `Demo of competency: "${draft.demo_of_competency.trim()}"` : ""}

${existing.length > 0 ? `Existing outcomes (do NOT duplicate these — suggest complementary ones):\n- ${existing.join("\n- ")}` : "The outcomes list is currently empty."}

Generate 3 learning outcomes. Each outcome:
- Must start with "Student can…" or "Students can…"
- Must be observable (no "understand", "know about", "appreciate")
- Must connect directly to what the card teaches
- Should span knowledge / skill / disposition (one of each ideally)
- Match the tier and age band

Return a JSON array of exactly 3 strings.
Example: ["Student can identify …", "Student can produce …", "Student can explain …"]
Return ONLY the JSON array, nothing else.`;

  const callResult = await callAnthropicMessages({
    endpoint: "lib/skills/ai-helpers/outcomes",
    model: MODELS.HAIKU,
    maxTokens: 500,
    system,
    messages: [{ role: "user", content: user }],
  });

  if (!callResult.ok) {
    if (callResult.reason === "api_error") throw callResult.error;
    throw new Error(`suggestLearningOutcomes: ${callResult.reason}`);
  }

  const response = callResult.response;
  const text =
    response.content[0]?.type === "text" ? response.content[0].text : "";
  return extractJsonArray<string>(text)
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .map((s) => s.trim())
    .slice(0, 3);
}

// ============================================================================
// 3. Framework anchors — 1-3 anchors with framework + label
// ============================================================================

const FRAMEWORK_VOCAB: Record<FrameworkAnchor["framework"], string[]> = {
  ATL: [
    "Thinking",
    "Research",
    "Social",
    "Communication",
    "Self-Management",
  ],
  CASEL: [
    "Self-Awareness",
    "Self-Management",
    "Social Awareness",
    "Relationship Skills",
    "Responsible Decision-Making",
  ],
  WEF: [
    "Analytical Thinking",
    "Creative Thinking",
    "Resilience",
    "Leadership and Social Influence",
    "Motivation and Self-Awareness",
    "Curiosity",
    "Technological Literacy",
    "Empathy",
    "Talent Management",
    "Service Orientation",
  ],
  StudioHabits: [
    "Develop Craft",
    "Engage & Persist",
    "Envision",
    "Express",
    "Observe",
    "Reflect",
    "Stretch & Explore",
    "Understand Art Worlds",
  ],
};

export async function suggestFrameworkAnchors(
  draft: CardDraft
): Promise<FrameworkAnchor[]> {
  const vocabBlock = (Object.keys(FRAMEWORK_VOCAB) as Array<
    keyof typeof FRAMEWORK_VOCAB
  >)
    .map((k) => `${k}: ${FRAMEWORK_VOCAB[k].join(", ")}`)
    .join("\n");

  const existing = (draft.framework_anchors ?? [])
    .filter((a) => a.framework && a.label)
    .map((a) => `${a.framework}/${a.label}`);

  const system = `You map skill cards to four frameworks (ATL, CASEL, WEF Future of Jobs, Studio Habits of Mind). You return 1-3 anchor objects. Always return a JSON array, no commentary.`;

  const user = `${buildIdentityLine(draft)}

The card's body so far:
${flattenBody(draft.body)}

${draft.demo_of_competency?.trim() ? `Demo of competency: "${draft.demo_of_competency.trim()}"` : ""}

Allowed framework labels (use ONLY these):
${vocabBlock}

${existing.length > 0 ? `Existing anchors (do NOT duplicate): ${existing.join(", ")}` : ""}

Map this card to 1-3 anchors. Choose the BEST fits — not all four frameworks should be used unless the card genuinely spans them. One excellent anchor beats three weak ones.

Return a JSON array of objects with EXACTLY this shape:
[
  { "framework": "ATL", "label": "Self-Management" },
  { "framework": "WEF", "label": "Analytical Thinking" }
]
The "framework" must be one of: ATL, CASEL, WEF, StudioHabits.
The "label" must be from the allowed list for that framework.

Return ONLY the JSON array, nothing else.`;

  const callResult = await callAnthropicMessages({
    endpoint: "lib/skills/ai-helpers/anchors",
    model: MODELS.HAIKU,
    maxTokens: 400,
    system,
    messages: [{ role: "user", content: user }],
  });

  if (!callResult.ok) {
    if (callResult.reason === "api_error") throw callResult.error;
    throw new Error(`suggestFrameworkAnchors: ${callResult.reason}`);
  }

  const response = callResult.response;
  const text =
    response.content[0]?.type === "text" ? response.content[0].text : "";
  const raw = extractJsonArray<{ framework?: string; label?: string }>(text);

  // Validate shape + framework + label-in-vocab.
  const validFrameworks: FrameworkAnchor["framework"][] = [
    "ATL",
    "CASEL",
    "WEF",
    "StudioHabits",
  ];
  return raw
    .filter(
      (a): a is { framework: FrameworkAnchor["framework"]; label: string } =>
        typeof a?.framework === "string" &&
        typeof a?.label === "string" &&
        validFrameworks.includes(a.framework as FrameworkAnchor["framework"]) &&
        a.label.trim().length > 0
    )
    .map((a) => ({ framework: a.framework, label: a.label.trim() }))
    .slice(0, 3);
}

// ============================================================================
// 4. Quiz generation — N structured QuizQuestion objects via tool_choice
// ============================================================================

const QUIZ_GENERATION_TOOL: Anthropic.Tool = {
  name: "emit_quiz_questions",
  description:
    "Emit a list of quiz questions for the skill card. Each question has a type, prompt, options, correct_answer, and explanation.",
  input_schema: {
    type: "object",
    properties: {
      questions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["multiple_choice", "true_false"],
              description:
                "Question type. Phase A supports multiple_choice (3-4 options) and true_false (exactly 2 options: True / False).",
            },
            prompt: {
              type: "string",
              description:
                "The question stem shown to the student. One sentence, age-appropriate, drawn directly from the card body.",
            },
            options: {
              type: "array",
              items: { type: "string" },
              description:
                "For multiple_choice: 3-4 plausible options with one clearly correct. For true_false: exactly ['True', 'False'].",
            },
            correct_index: {
              type: "integer",
              description:
                "0-based index into options[] of the correct answer.",
            },
            explanation: {
              type: "string",
              description:
                "1-2 sentence explanation shown to the student after they answer (whether right or wrong). Cite the card.",
            },
            difficulty: {
              type: "string",
              enum: ["easy", "medium", "hard"],
              description: "Approximate difficulty for ranking / question_count.",
            },
          },
          required: [
            "type",
            "prompt",
            "options",
            "correct_index",
            "explanation",
            "difficulty",
          ],
        },
      },
    },
    required: ["questions"],
  },
};

export interface GenerateQuizOptions {
  /** How many questions to produce. Capped at 10 so a single Sonnet call
   *  stays cheap. Default 6. */
  count?: number;
  /** Mix hint — soft preference for multiple_choice vs true_false ratio.
   *  Default "mostly_mc" (≈80% MC, 20% T/F). */
  mix?: "mostly_mc" | "mostly_tf" | "balanced";
}

/**
 * Generate N quiz questions for a card from its body content. Uses Sonnet
 * + tool_choice for structured output — same pattern as the wizard's page
 * generation routes.
 *
 * Returns QuizQuestion[] in the shape stored on `skill_cards.quiz_questions`
 * and validated by validateQuizQuestions(). Caller is responsible for
 * persisting (or returning to the client to merge into form state).
 */
export async function generateQuizQuestions(
  draft: CardDraft,
  opts: GenerateQuizOptions = {}
): Promise<QuizQuestion[]> {
  const count = Math.max(1, Math.min(opts.count ?? 6, 10));
  const mix = opts.mix ?? "mostly_mc";

  const mixHint =
    mix === "mostly_mc"
      ? "Mix: ~80% multiple_choice, ~20% true_false. At minimum 3 multiple_choice questions."
      : mix === "mostly_tf"
        ? "Mix: ~70% true_false, ~30% multiple_choice. Use true_false for clear-cut facts."
        : "Mix: roughly half multiple_choice, half true_false.";

  const system = `You write quiz questions for a single skill card in a secondary-school skill library (ages 11-18). Quizzes gate the "earned" state, so questions must be answerable by anyone who has read the card and not by guesswork. Use the emit_quiz_questions tool to return your output — never plain text.`;

  const user = `${buildIdentityLine(draft)}

The card's body:
${flattenBody(draft.body)}

${draft.demo_of_competency?.trim() ? `Demo of competency: "${draft.demo_of_competency.trim()}"` : ""}
${draft.learning_outcomes?.length ? `Learning outcomes:\n- ${draft.learning_outcomes.filter((o) => o.trim()).join("\n- ")}` : ""}

Generate ${count} quiz questions for this card.

Rules:
- Every question must be answerable from the card body — do NOT pull facts from outside.
- Distractors (wrong options) should be plausible misconceptions, not silly throwaways.
- For multiple_choice: 3 or 4 options total. Exactly one correct.
- For true_false: options must be exactly ["True", "False"].
- correct_index is 0-based.
- Explanations should reference the specific block / concept the question came from.
- Match the tier and age band — bronze ≈ recall + recognition, silver ≈ application, gold ≈ analysis + transfer.
- ${mixHint}

Use the emit_quiz_questions tool to return your output.`;

  const callResult = await callAnthropicMessages({
    endpoint: "lib/skills/ai-helpers/quiz",
    model: MODELS.SONNET,
    maxTokens: 4000,
    temperature: 0.4,
    system,
    messages: [{ role: "user", content: user }],
    tools: [QUIZ_GENERATION_TOOL],
    toolChoice: { type: "tool", name: QUIZ_GENERATION_TOOL.name },
  });

  if (!callResult.ok) {
    if (callResult.reason === "api_error") throw callResult.error;
    throw new Error(`generateQuizQuestions: ${callResult.reason}`);
  }
  const response = callResult.response;

  const toolUseBlock = response.content.find(
    (block) => block.type === "tool_use"
  );
  if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
    throw new Error("Quiz generator did not return structured output");
  }
  const result = toolUseBlock.input as {
    questions?: Array<{
      type?: string;
      prompt?: string;
      options?: string[];
      correct_index?: number;
      explanation?: string;
      difficulty?: "easy" | "medium" | "hard";
    }>;
  };

  const raw = result.questions ?? [];

  // Map to QuizQuestion shape — correct_answer stores the correct OPTION
  // STRING (this is the convention used by validateQuizQuestions + the
  // SkillCardQuizRunner; it's robust across reorderings, where a stored
  // index would silently break).
  const out: QuizQuestion[] = [];
  for (const q of raw) {
    if (!q.prompt || !q.options || !Array.isArray(q.options)) continue;
    const type =
      q.type === "true_false" ? "true_false" : "multiple_choice";
    let options = q.options.map((o) => String(o).trim()).filter(Boolean);
    if (type === "true_false") {
      options = ["True", "False"];
    }
    if (options.length < 2) continue;
    const idx =
      typeof q.correct_index === "number"
        ? Math.max(0, Math.min(q.correct_index, options.length - 1))
        : 0;
    const correct = options[idx];
    out.push({
      id: nanoid(8),
      type,
      prompt: q.prompt.trim(),
      options,
      correct_answer: correct,
      explanation: (q.explanation ?? "").trim(),
      difficulty: q.difficulty,
    });
  }

  return out.slice(0, count);
}
