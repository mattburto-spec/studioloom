/**
 * Verify the migrated batch JSON against the import-endpoint's validation
 * rules. This re-implements the relevant checks from
 * src/app/api/teacher/skills/cards/import/route.ts so we catch shape issues
 * before posting the batch.
 *
 * Run: node scripts/verify-safety-skill-cards-batch.mjs <path-to-batch.json>
 */

import fs from "node:fs";

const VALID_BLOCK_TYPES = new Set([
  "key_concept",
  "micro_story",
  "scenario",
  "before_after",
  "step_by_step",
  "comprehension_check",
  "video_embed",
  "spot_the_hazard",
  "embed",
  "accordion",
  "gallery",
  "prose",
  "callout",
  "checklist",
  "image",
  "video",
  "worked_example",
  "think_aloud",
  "compare_images",
  "code",
  "side_by_side",
]);

const VALID_TIERS = new Set(["bronze", "silver", "gold"]);
const VALID_QUIZ_TYPES = new Set([
  "multiple_choice",
  "true_false",
  "scenario",
]);
const VALID_FRAMEWORKS = new Set(["ATL", "CASEL", "WEF", "StudioHabits"]);
const VALID_CARD_TYPES = new Set(["lesson", "routine"]);
const VALID_CATEGORIES = new Set([
  "researching",
  "analysing",
  "designing",
  "creating",
  "evaluating",
  "reflecting",
  "communicating",
  "planning",
]);
const VALID_DOMAIN_SHORT = new Set([
  "design-making",
  "visual-communication",
  "communication-presenting",
  "collaboration-teamwork",
  "leadership-influence",
  "project-management",
  "finance-enterprise",
  "research-inquiry",
  "digital-literacy",
]);

function slugIsValid(slug) {
  return (
    typeof slug === "string" &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) &&
    slug.length >= 3 &&
    slug.length <= 80
  );
}

function checkCard(card, idx) {
  const errs = [];
  const tag = `card[${idx}] (${card?.slug ?? "?"})`;

  // title
  if (
    typeof card.title !== "string" ||
    card.title.trim().length < 3 ||
    card.title.trim().length > 200
  ) {
    errs.push(`${tag}: title must be 3-200 chars (got ${card.title?.length})`);
  }

  // slug
  if (!slugIsValid(card.slug)) {
    errs.push(`${tag}: invalid slug "${card.slug}"`);
  }

  // category / domain
  if (!card.category_id || !VALID_CATEGORIES.has(card.category_id)) {
    errs.push(`${tag}: invalid category_id "${card.category_id}"`);
  }
  if (!card.domain_id || !VALID_DOMAIN_SHORT.has(card.domain_id)) {
    errs.push(`${tag}: invalid domain_id "${card.domain_id}"`);
  }

  // tier
  if (!VALID_TIERS.has(card.tier)) {
    errs.push(`${tag}: invalid tier "${card.tier}"`);
  }

  // body
  if (!Array.isArray(card.body) || card.body.length === 0) {
    errs.push(`${tag}: body must be a non-empty array`);
  } else {
    card.body.forEach((b, bi) => {
      if (!b || typeof b !== "object" || typeof b.type !== "string") {
        errs.push(`${tag}.body[${bi}]: missing or non-string type`);
      } else if (!VALID_BLOCK_TYPES.has(b.type)) {
        errs.push(`${tag}.body[${bi}]: unknown block type "${b.type}"`);
      }
    });
  }

  // ages
  for (const k of ["age_min", "age_max"]) {
    const v = card[k];
    if (v !== undefined && v !== null) {
      if (!Number.isInteger(v) || v < 5 || v > 25) {
        errs.push(`${tag}: ${k} must be integer 5-25 (got ${v})`);
      }
    }
  }
  if (
    typeof card.age_min === "number" &&
    typeof card.age_max === "number" &&
    card.age_min > card.age_max
  ) {
    errs.push(`${tag}: age_min > age_max`);
  }

  // framework_anchors
  if (card.framework_anchors !== undefined) {
    if (!Array.isArray(card.framework_anchors)) {
      errs.push(`${tag}: framework_anchors must be array`);
    } else {
      card.framework_anchors.forEach((a, i) => {
        if (!a || !VALID_FRAMEWORKS.has(a.framework)) {
          errs.push(
            `${tag}.framework_anchors[${i}]: invalid framework "${a?.framework}"`
          );
        }
        if (!a?.label || typeof a.label !== "string" || !a.label.trim()) {
          errs.push(`${tag}.framework_anchors[${i}]: missing label`);
        }
      });
    }
  }

  // card_type
  if (card.card_type !== undefined && !VALID_CARD_TYPES.has(card.card_type)) {
    errs.push(`${tag}: invalid card_type "${card.card_type}"`);
  }

  // quiz
  const qs = card.quiz_questions ?? [];
  if (!Array.isArray(qs)) {
    errs.push(`${tag}: quiz_questions must be array`);
  } else {
    qs.forEach((q, qi) => {
      const qTag = `${tag}.quiz_questions[${qi}] (${q?.id ?? "?"})`;
      if (!VALID_QUIZ_TYPES.has(q?.type)) {
        errs.push(`${qTag}: invalid type "${q?.type}"`);
      }
      if (typeof q?.prompt !== "string" || !q.prompt.trim()) {
        errs.push(`${qTag}: missing prompt`);
      }
      if (q?.type !== "true_false") {
        if (!Array.isArray(q?.options) || q.options.length < 2) {
          errs.push(`${qTag}: options must have ≥2 entries for ${q?.type}`);
        }
      }
      if (q?.correct_answer === undefined || q?.correct_answer === null) {
        errs.push(`${qTag}: missing correct_answer`);
      }
    });
  }

  // pass_threshold
  if (card.pass_threshold !== undefined) {
    if (
      typeof card.pass_threshold !== "number" ||
      card.pass_threshold < 0 ||
      card.pass_threshold > 100
    ) {
      errs.push(`${tag}: pass_threshold out of range`);
    }
  }

  return errs;
}

function main() {
  const path = process.argv[2];
  if (!path) {
    console.error("usage: node verify-safety-skill-cards-batch.mjs <path>");
    process.exit(2);
  }
  const raw = fs.readFileSync(path, "utf8");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error("Invalid JSON:", e.message);
    process.exit(2);
  }

  if (!parsed?.cards || !Array.isArray(parsed.cards)) {
    console.error("Expected { cards: [...] } at the top level.");
    process.exit(2);
  }

  console.log(`Found ${parsed.cards.length} cards. Validating...\n`);

  const allErrs = [];
  parsed.cards.forEach((c, i) => {
    const errs = checkCard(c, i);
    if (errs.length === 0) {
      const blockTypes = [...new Set(c.body.map((b) => b.type))].join(",");
      console.log(
        `  ✓ ${c.slug.padEnd(32)} ${c.tier.padEnd(6)} ` +
          `body=${c.body.length} (${blockTypes})  quiz=${c.quiz_questions?.length ?? 0}`
      );
    } else {
      console.log(`  ✗ ${c.slug ?? "?"}`);
      errs.forEach((e) => console.log(`      ${e}`));
      allErrs.push(...errs);
    }
  });

  // Slug uniqueness within batch
  const slugs = parsed.cards.map((c) => c.slug);
  const dupSlugs = slugs.filter((s, i) => slugs.indexOf(s) !== i);
  if (dupSlugs.length) {
    console.log(`\nDUPLICATE SLUGS within batch: ${[...new Set(dupSlugs)].join(", ")}`);
    allErrs.push("duplicate slugs");
  }

  console.log(
    `\n${parsed.cards.length - allErrs.length === parsed.cards.length || allErrs.length === 0 ? "PASS" : "FAIL"}: ${
      allErrs.length
    } error(s) across ${parsed.cards.length} cards.`
  );
  if (allErrs.length) process.exit(1);
}

main();
