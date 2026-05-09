// audit-skip: routine teacher pedagogy ops, low audit value
/**
 * POST /api/teacher/skills/cards/import
 *
 * Bulk-friendly import endpoint for the Cowork-authored card flow. Accepts
 * a single card JSON (or {cards: [...]} for batches) in a forgiving shape:
 *
 *   - category    can be id OR label OR fragment match
 *   - domain      can be id OR short_code OR label OR fragment match
 *   - tier        bronze|silver|gold
 *   - body        array of blocks (same shape as the editor)
 *   - quiz        optional — { questions, pass_threshold?, retake_cooldown_minutes?,
 *                  question_count? } — questions[].correct_answer accepts
 *                  either a 0-based index OR the option string verbatim;
 *                  we normalise to the index-string form the runner uses.
 *   - slug        optional — auto-generated from title if omitted
 *
 * The endpoint never edits an existing card — slug collisions return 409
 * with a suggestion ("widget-safety-2"). The teacher can then retry with
 * the suggested slug or change it in the JSON.
 *
 * One transaction per card. Errors per-card in the batch don't roll back
 * already-created siblings — caller sees `{ created, errors }` per row.
 *
 * Pairs with the .claude/skills/skill-card-author Cowork skill which emits
 * JSON in this shape.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BLOCK_TYPES, SKILL_TIERS } from "@/types/skills";
import {
  validateQuizQuestions,
  validatePassThreshold,
  validateRetakeCooldown,
  validateQuestionCount,
} from "@/lib/skills/validate-quiz";
import type {
  Block,
  CardType,
  FrameworkAnchor,
  QuizQuestion,
  SkillCardRow,
  SkillTier,
} from "@/types/skills";
import { nanoid } from "nanoid";
import { requireTeacher } from "@/lib/auth/require-teacher";

// ---------------------------------------------------------------------------
// Helpers — kept local to avoid touching the existing POST route
// ---------------------------------------------------------------------------

const VALID_BLOCK_TYPES = new Set<string>(BLOCK_TYPES);
const VALID_CARD_TYPES: readonly CardType[] = ["lesson", "routine"];
const VALID_FRAMEWORKS = new Set<FrameworkAnchor["framework"]>([
  "ATL",
  "CASEL",
  "WEF",
  "StudioHabits",
]);

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function slugIsValid(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length >= 3 && slug.length <= 80;
}

function validateBody(body: unknown): body is Block[] {
  if (!Array.isArray(body)) return false;
  return body.every(
    (b) =>
      b &&
      typeof b === "object" &&
      "type" in b &&
      typeof (b as { type: unknown }).type === "string" &&
      VALID_BLOCK_TYPES.has((b as { type: string }).type)
  );
}

function validateFrameworkAnchors(
  anchors: unknown
): anchors is FrameworkAnchor[] {
  if (!Array.isArray(anchors)) return false;
  return anchors.every(
    (a) =>
      a &&
      typeof a === "object" &&
      typeof (a as { framework: unknown }).framework === "string" &&
      VALID_FRAMEWORKS.has((a as { framework: FrameworkAnchor["framework"] }).framework) &&
      typeof (a as { label: unknown }).label === "string" &&
      (a as { label: string }).label.trim().length > 0
  );
}

// ---------------------------------------------------------------------------
// Forgiving lookup — allows the cowork skill to refer to a category/domain
// by id, short_code, or label (case-insensitive prefix match for labels).
// ---------------------------------------------------------------------------

interface LookupRow {
  id: string;
  label?: string;
  short_code?: string;
}

function findRef(rows: LookupRow[], q: string | null | undefined): string | null {
  if (!q || typeof q !== "string") return null;
  const needle = q.trim().toLowerCase();
  if (!needle) return null;
  // Exact id
  const byId = rows.find((r) => r.id.toLowerCase() === needle);
  if (byId) return byId.id;
  // Exact short_code
  const bySc = rows.find((r) => r.short_code?.toLowerCase() === needle);
  if (bySc) return bySc.id;
  // Exact label
  const byLabel = rows.find((r) => r.label?.toLowerCase() === needle);
  if (byLabel) return byLabel.id;
  // Prefix label
  const byPrefix = rows.find((r) =>
    r.label?.toLowerCase().startsWith(needle)
  );
  if (byPrefix) return byPrefix.id;
  // Fragment label
  const byFrag = rows.find((r) => r.label?.toLowerCase().includes(needle));
  return byFrag?.id ?? null;
}

// ---------------------------------------------------------------------------
// Import-payload normalisation
// ---------------------------------------------------------------------------

interface ImportCardPayload {
  slug?: string;
  title?: string;
  summary?: string | null;
  category?: string;
  category_id?: string;
  domain?: string;
  domain_id?: string;
  tier?: SkillTier;
  body?: Block[];
  estimated_min?: number | null;
  age_min?: number | null;
  age_max?: number | null;
  framework_anchors?: FrameworkAnchor[];
  demo_of_competency?: string | null;
  learning_outcomes?: string[];
  applied_in?: string[];
  card_type?: CardType;
  author_name?: string | null;
  tags?: string[];
  external_links?: Array<{ url: string; title?: string; kind?: string }>;
  prerequisite_ids?: string[];
  // Quiz can be supplied flat or under a `quiz` envelope
  quiz?: {
    questions?: QuizQuestion[];
    pass_threshold?: number;
    retake_cooldown_minutes?: number;
    question_count?: number | null;
  };
  quiz_questions?: QuizQuestion[];
  pass_threshold?: number;
  retake_cooldown_minutes?: number;
  question_count?: number | null;
  publish?: boolean;
}

interface ImportResult {
  ok: boolean;
  slug?: string;
  card_id?: string;
  error?: string;
  /** When the failure is a slug collision, suggest a free slug. */
  suggested_slug?: string;
  /** Non-fatal warnings — e.g. question_count auto-clamped, slug
   *  auto-shortened, etc. */
  warnings?: string[];
}

/**
 * Locate the first invalid block in `body`. Used to produce a sharper
 * error message than "body invalid" — names the offending index and
 * type so the cowork skill (or the teacher) can fix it directly.
 */
function findInvalidBlock(
  body: unknown
): { index: number; reason: string } | null {
  if (!Array.isArray(body)) return { index: -1, reason: "not an array" };
  for (let i = 0; i < body.length; i++) {
    const b = body[i];
    if (!b || typeof b !== "object") {
      return { index: i, reason: "not an object" };
    }
    if (!("type" in b) || typeof (b as { type: unknown }).type !== "string") {
      return { index: i, reason: "missing string `type` field" };
    }
    const type = (b as { type: string }).type;
    if (!VALID_BLOCK_TYPES.has(type)) {
      return { index: i, reason: `unknown block type "${type}"` };
    }
  }
  return null;
}

async function importOne(
  payload: ImportCardPayload,
  teacherId: string,
  categories: LookupRow[],
  domains: LookupRow[]
): Promise<ImportResult> {
  const admin = createAdminClient();

  // --- title / slug -------------------------------------------------------
  const title = (payload.title ?? "").trim();
  if (title.length < 3 || title.length > 200) {
    return { ok: false, error: "title must be 3-200 chars" };
  }

  let slug = (payload.slug ?? "").trim();
  if (!slug) slug = slugify(title);
  if (!slugIsValid(slug)) {
    return {
      ok: false,
      error: `slug "${slug}" is not lowercase-kebab 3-80 chars`,
    };
  }

  // --- taxonomy lookup ----------------------------------------------------
  const categoryId =
    payload.category_id ?? findRef(categories, payload.category);
  if (!categoryId) {
    return {
      ok: false,
      error: `category not found: "${payload.category ?? payload.category_id ?? "(missing)"}". Try one of: ${categories.map((c) => c.label).join(", ")}`,
    };
  }
  const domainId = payload.domain_id ?? findRef(domains, payload.domain);
  if (!domainId) {
    return {
      ok: false,
      error: `domain not found: "${payload.domain ?? payload.domain_id ?? "(missing)"}". Try one of: ${domains.map((d) => `${d.short_code} (${d.label})`).join(", ")}`,
    };
  }

  // --- tier ---------------------------------------------------------------
  if (!payload.tier || !SKILL_TIERS.includes(payload.tier)) {
    return { ok: false, error: "tier must be bronze|silver|gold" };
  }

  // --- body ---------------------------------------------------------------
  if (!validateBody(payload.body)) {
    const bad = findInvalidBlock(payload.body);
    const tail = bad
      ? `block #${bad.index + 1}: ${bad.reason}`
      : "body must be an array";
    return {
      ok: false,
      error:
        `body invalid — ${tail}. Allowed types: key_concept / micro_story / scenario / before_after / step_by_step / comprehension_check / video_embed / accordion / gallery / embed.`,
    };
  }

  // --- ages ---------------------------------------------------------------
  for (const k of ["age_min", "age_max"] as const) {
    const v = payload[k];
    if (v !== undefined && v !== null) {
      if (!Number.isInteger(v) || v < 5 || v > 25) {
        return { ok: false, error: `${k} must be an integer 5-25` };
      }
    }
  }
  if (
    typeof payload.age_min === "number" &&
    typeof payload.age_max === "number" &&
    payload.age_min > payload.age_max
  ) {
    return { ok: false, error: "age_min must be <= age_max" };
  }

  // --- framework anchors --------------------------------------------------
  if (
    payload.framework_anchors !== undefined &&
    !validateFrameworkAnchors(payload.framework_anchors)
  ) {
    return {
      ok: false,
      error:
        "framework_anchors must be an array of {framework: ATL|CASEL|WEF|StudioHabits, label: string}",
    };
  }

  // --- card_type ----------------------------------------------------------
  if (
    payload.card_type !== undefined &&
    !VALID_CARD_TYPES.includes(payload.card_type)
  ) {
    return { ok: false, error: "card_type must be lesson|routine" };
  }

  // --- quiz (envelope OR flat) -------------------------------------------
  const rawQuestions =
    payload.quiz?.questions ?? payload.quiz_questions ?? [];
  const passThreshold =
    payload.quiz?.pass_threshold ?? payload.pass_threshold ?? 80;
  const retakeCooldown =
    payload.quiz?.retake_cooldown_minutes ?? payload.retake_cooldown_minutes ?? 0;
  // Auto-clamp question_count to the actual pool size: a common cowork
  // mistake is "question_count: 10" when the pool has 8 or 9. Intent is
  // clearly "use the full pool" — null is the canonical way to express
  // that, so coerce + warn rather than reject.
  let questionCount: number | null =
    payload.quiz?.question_count ?? payload.question_count ?? null;
  const importWarnings: string[] = [];

  // Normalise each question — accept either an index in `correct_answer` or
  // the option string verbatim, and ensure every question has an `id`.
  const normalisedQuestions: QuizQuestion[] = (
    Array.isArray(rawQuestions) ? rawQuestions : []
  ).map((q) => {
    const base = q as Partial<QuizQuestion> & {
      correct_index?: number;
      correct?: string | number;
    };
    const opts = (base.options ?? []).map((o) => String(o));
    let correct: string | string[] | number[] = "0";
    if (typeof base.correct_index === "number" && opts.length > 0) {
      correct = String(Math.max(0, Math.min(base.correct_index, opts.length - 1)));
    } else if (typeof base.correct === "number") {
      correct = String(base.correct);
    } else if (typeof base.correct === "string") {
      const idx = opts.findIndex((o) => o === base.correct);
      correct = idx >= 0 ? String(idx) : base.correct;
    } else if (typeof base.correct_answer === "string") {
      // If it's already an index string keep it; otherwise lookup the index.
      const maybeIdx = parseInt(base.correct_answer, 10);
      if (!Number.isNaN(maybeIdx) && opts[maybeIdx] !== undefined) {
        correct = String(maybeIdx);
      } else {
        const idx = opts.findIndex((o) => o === base.correct_answer);
        correct = idx >= 0 ? String(idx) : base.correct_answer;
      }
    } else if (Array.isArray(base.correct_answer)) {
      correct = base.correct_answer as string[] | number[];
    }
    return {
      id: base.id ?? nanoid(8),
      type: (base.type ?? "multiple_choice") as QuizQuestion["type"],
      prompt: base.prompt ?? "",
      options: opts,
      correct_answer: correct,
      explanation: base.explanation ?? "",
      topic: base.topic,
      difficulty: base.difficulty,
    };
  });

  if (normalisedQuestions.length > 0) {
    const err = validateQuizQuestions(normalisedQuestions);
    if (err) return { ok: false, error: `quiz: ${err}` };
  }

  // Clamp question_count BEFORE running validateQuestionCount, so the
  // forgiving behaviour kicks in for the common "10 vs 9" overshoot.
  if (
    typeof questionCount === "number" &&
    normalisedQuestions.length > 0 &&
    questionCount >= normalisedQuestions.length
  ) {
    if (questionCount > normalisedQuestions.length) {
      importWarnings.push(
        `question_count (${questionCount}) clamped to ${normalisedQuestions.length} (size of quiz pool)`
      );
    }
    // Either equal-to-pool or larger — both mean "use full pool". Null
    // is the canonical encoding so the runner picks all questions.
    questionCount = null;
  }

  for (const [k, v] of [
    ["pass_threshold", validatePassThreshold(passThreshold)],
    ["retake_cooldown_minutes", validateRetakeCooldown(retakeCooldown)],
    [
      "question_count",
      validateQuestionCount(questionCount, normalisedQuestions.length),
    ],
  ] as const) {
    if (v) return { ok: false, error: `${k}: ${v}` };
  }

  // --- slug uniqueness check + suggestion --------------------------------
  const { data: existing } = await admin
    .from("skill_cards")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (existing) {
    // Suggest -2, -3, ... up to -9
    let suggested: string | null = null;
    for (let i = 2; i <= 9; i++) {
      const candidate = `${slug}-${i}`.slice(0, 80);
      const { data: dup } = await admin
        .from("skill_cards")
        .select("id")
        .eq("slug", candidate)
        .maybeSingle();
      if (!dup) {
        suggested = candidate;
        break;
      }
    }
    return {
      ok: false,
      error: `Slug "${slug}" already exists`,
      suggested_slug: suggested ?? undefined,
    };
  }

  // --- insert -------------------------------------------------------------
  const { data: card, error: insertError } = await admin
    .from("skill_cards")
    .insert({
      slug,
      title,
      summary: payload.summary?.trim() || null,
      category_id: categoryId,
      domain_id: domainId,
      tier: payload.tier,
      body: payload.body,
      estimated_min: payload.estimated_min ?? null,
      age_min: payload.age_min ?? null,
      age_max: payload.age_max ?? null,
      framework_anchors: payload.framework_anchors ?? [],
      demo_of_competency: payload.demo_of_competency?.trim() || null,
      learning_outcomes: payload.learning_outcomes ?? [],
      applied_in: payload.applied_in ?? [],
      card_type: payload.card_type ?? "lesson",
      author_name: payload.author_name?.trim() || null,
      quiz_questions: normalisedQuestions,
      pass_threshold: passThreshold,
      retake_cooldown_minutes: retakeCooldown,
      question_count: questionCount,
      is_built_in: false,
      created_by_teacher_id: teacherId,
      is_published: !!payload.publish,
    })
    .select()
    .single();

  if (insertError || !card) {
    console.error("[skills/import] insert error:", insertError);
    return {
      ok: false,
      error: insertError?.message ?? "Insert failed (see server log)",
    };
  }
  const cardRow = card as SkillCardRow;

  // --- side inserts -------------------------------------------------------
  const cleanTags = (payload.tags ?? [])
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0 && t.length <= 40);
  if (cleanTags.length) {
    await admin
      .from("skill_card_tags")
      .insert(cleanTags.map((tag) => ({ skill_id: cardRow.id, tag })));
  }
  const cleanLinks = (payload.external_links ?? [])
    .filter((l) => l && typeof l.url === "string" && l.url.trim().length > 0)
    .map((l, i) => ({
      skill_id: cardRow.id,
      url: l.url.trim(),
      title: l.title?.trim() || null,
      kind: l.kind ?? null,
      display_order: i,
      status: "unchecked" as const,
    }));
  if (cleanLinks.length) {
    await admin.from("skill_external_links").insert(cleanLinks);
  }
  const cleanPrereqs = (payload.prerequisite_ids ?? []).filter(
    (id) => typeof id === "string" && id !== cardRow.id
  );
  if (cleanPrereqs.length) {
    await admin
      .from("skill_prerequisites")
      .insert(
        cleanPrereqs.map((pid) => ({
          skill_id: cardRow.id,
          prerequisite_id: pid,
        }))
      );
  }

  return {
    ok: true,
    slug,
    card_id: cardRow.id,
    warnings: importWarnings.length > 0 ? importWarnings : undefined,
  };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const auth = await requireTeacher(request);
    if (auth.error) return auth.error;
    const { teacherId } = auth;

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // Accept either { ...card } or { cards: [...] } or { card: {...} }
    const wrapper = raw as { cards?: unknown[]; card?: unknown };
    const cards: ImportCardPayload[] = Array.isArray(wrapper?.cards)
      ? (wrapper.cards as ImportCardPayload[])
      : wrapper?.card
        ? [wrapper.card as ImportCardPayload]
        : [raw as ImportCardPayload];

    if (cards.length === 0) {
      return NextResponse.json(
        { error: "No cards in payload" },
        { status: 400 }
      );
    }
    if (cards.length > 25) {
      return NextResponse.json(
        { error: "Max 25 cards per import — split into multiple calls" },
        { status: 400 }
      );
    }

    // Pre-fetch lookup tables once
    const admin = createAdminClient();
    const [{ data: categories }, { data: domains }] = await Promise.all([
      admin.from("skill_categories").select("id, label"),
      admin.from("skill_domains").select("id, short_code, label"),
    ]);
    if (!categories || !domains) {
      return NextResponse.json(
        { error: "Failed to load taxonomy lookups" },
        { status: 500 }
      );
    }

    const results: ImportResult[] = [];
    for (const c of cards) {
      try {
        const r = await importOne(
          c,
          teacherId,
          categories as LookupRow[],
          domains as LookupRow[]
        );
        results.push(r);
      } catch (e) {
        results.push({
          ok: false,
          error: e instanceof Error ? e.message : "Unknown error",
        });
      }
    }

    const created = results.filter((r) => r.ok).length;
    const status = created > 0 ? 201 : 400;
    return NextResponse.json(
      {
        created,
        total: results.length,
        results,
      },
      { status }
    );
  } catch (err) {
    console.error("[skills/import] fatal:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
