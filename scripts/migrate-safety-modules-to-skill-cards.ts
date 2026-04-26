/**
 * Migrate the 11 safety LearningModules → skill-card import payloads.
 *
 * Reads every module exported from `src/lib/safety/modules/index.ts` and the
 * matching badge in `BUILT_IN_BADGES`, then emits a single batched JSON
 * payload in the shape the `/api/teacher/skills/cards/import` route expects:
 *
 *   { cards: [ { slug, title, summary, category, domain, tier, body, ... }, ... ] }
 *
 * Mapping rules:
 *   - tier:        Tier 1 → bronze, Tier 2 → silver, Tier 3 → gold
 *   - category:    'creating'        (cognitive-action: making/building)
 *   - domain:      'design-making'   (subject area: workshop/technical-craft)
 *   - body:        module.blocks, with the per-block top-level `id` stripped
 *                  (skill-card Block schema is id-less; functional ids inside
 *                   sub-arrays — e.g. ScenarioBlock.branches[].id and
 *                   SpotTheHazardBlock.hazards[].id — are preserved).
 *   - quiz:        badge.question_pool, normalised to skill-card QuizQuestion.
 *                  `sequence` and `match` types are dropped — skill-card
 *                  QuizQuestionType supports only multiple_choice / true_false /
 *                  scenario at v1. Skipped questions are reported in the
 *                  sidecar log.
 *   - tags:        ['safety', tier-name, badge.id]
 *   - card_type:   'lesson'
 *   - publish:     false (drafts — teacher reviews + publishes)
 *
 * Run:
 *   npx tsx scripts/migrate-safety-modules-to-skill-cards.ts \
 *     > /tmp/safety-skill-cards-batch.json \
 *     2> /tmp/safety-skill-cards-migration.log
 */

import * as MODULES from "../src/lib/safety/modules";
import { BUILT_IN_BADGES } from "../src/lib/safety/badge-definitions";
import type {
  ContentBlock,
  LearningModule,
} from "../src/lib/safety/content-blocks";
import type { BadgeDefinition, BadgeQuestion } from "../src/lib/safety/types";
import type {
  Block,
  CardType,
  CreateSkillCardPayload,
  QuizQuestion,
  QuizQuestionType,
  SkillTier,
} from "../src/types/skills";

// ---------------------------------------------------------------------------
// Module ↔ tier map. Mirrors src/lib/safety/modules/index.ts comment grouping.
// Tier 1 = Fundamentals, Tier 2 = Specialty, Tier 3 = Advanced.
// ---------------------------------------------------------------------------

const TIER_BY_MODULE_KEY: Record<string, 1 | 2 | 3> = {
  GENERAL_WORKSHOP_MODULE: 1,
  HAND_TOOL_MODULE: 1,
  FIRE_SAFETY_MODULE: 1,
  PPE_MODULE: 1,
  WOOD_WORKSHOP_MODULE: 2,
  METAL_WORKSHOP_MODULE: 2,
  PLASTICS_MODULE: 2,
  ELECTRONICS_MODULE: 2,
  LASER_CUTTER_MODULE: 2,
  THREE_D_PRINTER_MODULE: 3,
  BAND_SAW_MODULE: 3,
};

const TIER_TO_SKILL_TIER: Record<1 | 2 | 3, SkillTier> = {
  1: "bronze",
  2: "silver",
  3: "gold",
};

const TIER_TAG: Record<SkillTier, string> = {
  bronze: "tier-1-fundamentals",
  silver: "tier-2-specialty",
  gold: "tier-3-advanced",
};

// ---------------------------------------------------------------------------
// Block transform — drops the top-level `id` field present on safety
// ContentBlock variants but absent from the skill-card Block union. Functional
// ids inside sub-collections (branches[].id, hazards[].id) are preserved.
// ---------------------------------------------------------------------------

function transformBlock(b: ContentBlock): Block {
  // Discriminated union: every variant has a string `type`. We narrow per-case
  // and reconstruct the skill-card-shaped object so the output JSON has only
  // fields the target schema declares.
  switch (b.type) {
    case "key_concept":
      return {
        type: "key_concept",
        title: b.title,
        ...(b.icon ? { icon: b.icon } : {}),
        content: b.content,
        ...(b.tips ? { tips: b.tips } : {}),
        ...(b.examples ? { examples: b.examples } : {}),
        ...(b.warning ? { warning: b.warning } : {}),
        ...(b.image ? { image: b.image } : {}),
      };
    case "micro_story":
      return {
        type: "micro_story",
        title: b.title,
        narrative: b.narrative,
        is_real_incident: b.is_real_incident,
        analysis_prompts: b.analysis_prompts,
        key_lesson: b.key_lesson,
        ...(b.related_rule ? { related_rule: b.related_rule } : {}),
      };
    case "scenario":
      return {
        type: "scenario",
        title: b.title,
        setup: b.setup,
        ...(b.illustration ? { illustration: b.illustration } : {}),
        branches: b.branches,
      };
    case "before_after":
      return {
        type: "before_after",
        title: b.title,
        before: b.before,
        after: b.after,
        key_difference: b.key_difference,
      };
    case "step_by_step":
      return {
        type: "step_by_step",
        title: b.title,
        steps: b.steps,
      };
    case "comprehension_check":
      return {
        type: "comprehension_check",
        question: b.question,
        options: b.options,
        correct_index: b.correct_index,
        feedback_correct: b.feedback_correct,
        feedback_wrong: b.feedback_wrong,
        ...(b.hint ? { hint: b.hint } : {}),
      };
    case "video_embed":
      return {
        type: "video_embed",
        ...(b.title ? { title: b.title } : {}),
        url: b.url,
        ...(b.start_time !== undefined ? { start_time: b.start_time } : {}),
        ...(b.end_time !== undefined ? { end_time: b.end_time } : {}),
        ...(b.caption ? { caption: b.caption } : {}),
      };
    case "spot_the_hazard":
      return {
        type: "spot_the_hazard",
        title: b.title,
        scene_id: b.scene_id,
        scene_type: b.scene_type,
        hazards: b.hazards,
        total_hazards: b.total_hazards,
        ...(b.time_limit_seconds !== undefined
          ? { time_limit_seconds: b.time_limit_seconds }
          : {}),
        pass_threshold: b.pass_threshold,
      };
    case "machine_diagram":
      // No skill-card analogue. Audited the 11 modules — none use this. If
      // the assertion ever fails, the script should crash loudly so the
      // omission is visible rather than silently dropped.
      throw new Error(
        `machine_diagram block type encountered but not supported by skill-card schema (block id: ${b.id})`
      );
    default: {
      const _never: never = b;
      throw new Error(
        `Unknown safety block type: ${JSON.stringify(_never)}`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Quiz transform — drops sequence/match (unsupported), maps the rest to the
// skill-card QuizQuestion shape. Returns the kept questions + the skipped
// ones so the caller can report what was dropped.
// ---------------------------------------------------------------------------

interface QuizMapResult {
  questions: QuizQuestion[];
  skipped: Array<{ id: string; type: BadgeQuestion["type"]; reason: string }>;
}

function isSupportedQuizType(t: BadgeQuestion["type"]): t is QuizQuestionType {
  return t === "multiple_choice" || t === "true_false" || t === "scenario";
}

function transformQuiz(pool: BadgeQuestion[]): QuizMapResult {
  const questions: QuizQuestion[] = [];
  const skipped: QuizMapResult["skipped"] = [];

  for (const q of pool) {
    if (!isSupportedQuizType(q.type)) {
      skipped.push({
        id: q.id,
        type: q.type,
        reason: `${q.type} not supported by skill-card QuizQuestionType (only multiple_choice / true_false / scenario at v1)`,
      });
      continue;
    }

    // For true_false, the safety BadgeQuestion has no `options` and stores the
    // answer as 'true' | 'false'. Skill-card runner expects options + the
    // answer keyed against options[]. Synthesize options so the import-route
    // normaliser can map answer → index. Using ['true', 'false'] (lowercase)
    // matches the answer text directly.
    let options = q.options;
    if (q.type === "true_false") {
      if (!options || options.length === 0) {
        options = ["true", "false"];
      }
    }

    questions.push({
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      options,
      // The import route's normaliser accepts either an option-text or an
      // index-string; passing the safety BadgeQuestion's answer through
      // unchanged. (For T/F with synthesized ['true','false'] options, the
      // 'true'/'false' answer string lookups to index 0/1 cleanly.)
      correct_answer: q.correct_answer,
      explanation: q.explanation,
      topic: q.topic,
      difficulty: q.difficulty,
    });
  }

  return { questions, skipped };
}

// ---------------------------------------------------------------------------
// Per-module → per-card transform.
// ---------------------------------------------------------------------------

interface CardWithMeta {
  payload: CreateSkillCardPayload & { publish?: boolean; quiz?: unknown };
  meta: {
    moduleKey: string;
    badgeId: string;
    blockCount: number;
    questionCount: number;
    skippedQuestions: QuizMapResult["skipped"];
  };
}

function buildCard(
  moduleKey: string,
  module: LearningModule,
  badge: BadgeDefinition
): CardWithMeta {
  const tierNum = TIER_BY_MODULE_KEY[moduleKey];
  if (!tierNum) {
    throw new Error(`No tier mapping for module key: ${moduleKey}`);
  }
  const tier = TIER_TO_SKILL_TIER[tierNum];

  const body: Block[] = module.blocks.map(transformBlock);
  const { questions, skipped } = transformQuiz(badge.question_pool);

  // age_min/max — pulled from typical secondary-school workshop ranges. Tier 1
  // fundamentals start at 11; specialty + advanced bump to 13 since they
  // assume some baseline workshop literacy. age_max stays 18 across the board.
  const ageMin = tier === "bronze" ? 11 : 13;

  const payload: CreateSkillCardPayload & { publish?: boolean } = {
    slug: badge.slug,
    title: badge.name,
    summary: badge.description,
    category_id: "creating",
    domain_id: "design-making",
    tier,
    body,
    estimated_min: module.estimated_minutes,
    age_min: ageMin,
    age_max: 18,
    framework_anchors: [
      { framework: "ATL", label: "Self-Management" },
      { framework: "StudioHabits", label: "Develop Craft" },
    ],
    demo_of_competency: `demonstrate ${badge.name.toLowerCase()} by passing the embedded quiz at ${badge.pass_threshold}% and following the procedures in workshop practice`,
    learning_outcomes: module.learning_objectives,
    applied_in: ["Workshop induction", "Project work", "Free Tools — Safety"],
    card_type: "lesson" satisfies CardType,
    author_name: "StudioLoom — Safety",
    tags: ["safety", TIER_TAG[tier], badge.id],
    quiz_questions: questions,
    pass_threshold: badge.pass_threshold,
    retake_cooldown_minutes: badge.retake_cooldown_minutes,
    question_count: badge.question_count,
    publish: false,
  };

  return {
    payload,
    meta: {
      moduleKey,
      badgeId: badge.id,
      blockCount: body.length,
      questionCount: questions.length,
      skippedQuestions: skipped,
    },
  };
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

function main() {
  const moduleEntries: Array<[string, LearningModule]> = Object.entries(
    MODULES as Record<string, LearningModule>
  )
    .filter(
      ([key]) =>
        key !== "default" &&
        key in TIER_BY_MODULE_KEY
    );

  if (moduleEntries.length !== 11) {
    process.stderr.write(
      `WARN: expected 11 modules, found ${moduleEntries.length}\n`
    );
  }

  const badgesById = new Map(BUILT_IN_BADGES.map((b) => [b.id, b]));

  // Resolve a module's `badge_id` against BUILT_IN_BADGES, with a small set of
  // fallbacks for known historical id-skew (e.g. band-saw-module declares
  // badge_id "band-saw-safety" but the badge in BUILT_IN_BADGES is registered
  // as "band-saw"). Fallbacks are reported in the sidecar log so the underlying
  // drift stays visible.
  function resolveBadge(
    declaredId: string
  ): { badge: BadgeDefinition; via: "exact" | "fallback"; matchedId: string } | null {
    const direct = badgesById.get(declaredId);
    if (direct) {
      return { badge: direct, via: "exact", matchedId: declaredId };
    }
    const candidates = [
      declaredId.replace(/-safety$/, ""),       // "band-saw-safety" → "band-saw"
      declaredId.replace(/-fundamentals$/, ""), // "ppe-fundamentals" → "ppe" (defensive)
    ];
    for (const c of candidates) {
      if (c !== declaredId) {
        const hit = badgesById.get(c);
        if (hit) return { badge: hit, via: "fallback", matchedId: c };
      }
    }
    return null;
  }

  const cards: CardWithMeta[] = [];
  const errors: Array<{ moduleKey: string; reason: string }> = [];

  for (const [moduleKey, module] of moduleEntries) {
    const resolved = resolveBadge(module.badge_id);
    if (!resolved) {
      errors.push({
        moduleKey,
        reason: `No badge in BUILT_IN_BADGES with id "${module.badge_id}" (no fallback matched)`,
      });
      continue;
    }
    if (resolved.via === "fallback") {
      process.stderr.write(
        `  ! ${moduleKey}: badge_id "${module.badge_id}" not found, used fallback "${resolved.matchedId}"\n`
      );
    }
    const badge = resolved.badge;
    try {
      cards.push(buildCard(moduleKey, module, badge));
    } catch (err) {
      errors.push({
        moduleKey,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ----- sidecar log to stderr -------------------------------------------
  process.stderr.write(
    `Migrated ${cards.length} of ${moduleEntries.length} safety modules → skill cards.\n`
  );
  for (const c of cards) {
    process.stderr.write(
      `  ✓ ${c.meta.moduleKey.padEnd(28)} → ${c.payload.slug}  ` +
        `(${c.meta.blockCount} blocks, ${c.meta.questionCount} quiz q's, ` +
        `tier=${c.payload.tier}` +
        (c.meta.skippedQuestions.length
          ? `, ${c.meta.skippedQuestions.length} skipped)\n`
          : ")\n")
    );
    for (const skip of c.meta.skippedQuestions) {
      process.stderr.write(
        `      ↳ skipped quiz q ${skip.id} (${skip.type}): ${skip.reason}\n`
      );
    }
  }
  if (errors.length) {
    process.stderr.write(`\nERRORS (${errors.length}):\n`);
    for (const e of errors) {
      process.stderr.write(`  ✗ ${e.moduleKey}: ${e.reason}\n`);
    }
  }

  // ----- batch JSON to stdout --------------------------------------------
  const batch = {
    cards: cards.map((c) => c.payload),
  };
  process.stdout.write(JSON.stringify(batch, null, 2) + "\n");

  if (errors.length || cards.length === 0) {
    process.exit(1);
  }
}

main();
