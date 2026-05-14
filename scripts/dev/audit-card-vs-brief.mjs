/**
 * Cross-reference choice_card_selections with student_unit_product_briefs.
 *
 * For each student who has at least one Choice Card pick AND a Product
 * Brief row, show:
 *   - the full pick history (in order)
 *   - the final brief archetype_id
 *   - whether the final archetype matches the LATEST pick's archetype
 *
 * This surfaces the "picked Space then ended up with a Dress" pattern:
 * students whose final archetype doesn't match the latest choice-card
 * archetype (typically because they routed through "Pitch your own"
 * and used the "redo archetype" escape hatch).
 *
 * Usage: node scripts/dev/audit-card-vs-brief.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const envText = readFileSync("/Users/matt/CWORK/questerra/.env.local", "utf8");
const env = Object.fromEntries(
  envText
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, "")];
    }),
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Load all choice_cards so we can label picks
const { data: allCards } = await sb
  .from("choice_cards")
  .select("id, label, emoji, on_pick_action");
const cardById = Object.fromEntries((allCards ?? []).map((c) => [c.id, c]));

function archetypeFromAction(action) {
  if (!action || typeof action !== "object") return null;
  if (action.type !== "set-archetype") return action.type ?? null;
  return action.payload?.archetypeId ?? null;
}

// All picks
const { data: picks, error: picksErr } = await sb
  .from("choice_card_selections")
  .select("student_id, unit_id, card_id, action_resolved, picked_at")
  .order("picked_at", { ascending: true });
if (picksErr) {
  console.error("Picks query failed:", picksErr.message);
  process.exit(1);
}

// All briefs
const { data: briefs, error: briefsErr } = await sb
  .from("student_unit_product_briefs")
  .select("student_id, unit_id, archetype_id, completed_at, updated_at");
if (briefsErr) {
  console.error("Briefs query failed:", briefsErr.message);
  process.exit(1);
}

// Group picks by (student, unit)
const picksByKey = {};
for (const p of picks ?? []) {
  const k = `${p.student_id}::${p.unit_id}`;
  (picksByKey[k] ??= []).push(p);
}

// Index briefs by (student, unit)
const briefByKey = {};
for (const b of briefs ?? []) {
  const k = `${b.student_id}::${b.unit_id}`;
  briefByKey[k] = b;
}

// Resolve student labels
const studentIds = [...new Set([...(picks ?? []), ...(briefs ?? [])].map((r) => r.student_id))];
const { data: students } = await sb
  .from("students")
  .select("id, display_name, full_name")
  .in("id", studentIds);
const studentById = Object.fromEntries((students ?? []).map((s) => [s.id, s]));

function studentLabel(id) {
  const s = studentById[id];
  return s ? s.display_name || s.full_name || id.slice(0, 8) : id.slice(0, 8);
}

// Walk every (student, unit) that has either picks or a brief
const keys = new Set([...Object.keys(picksByKey), ...Object.keys(briefByKey)]);

let matches = 0;
let mismatches = 0;
let onlyPicks = 0;
let onlyBriefs = 0;
let pitchRouted = 0;

const flagged = [];

for (const key of keys) {
  const [studentId, unitId] = key.split("::");
  const studentPicks = picksByKey[key] ?? [];
  const brief = briefByKey[key];

  if (studentPicks.length === 0 && brief) {
    onlyBriefs++;
    continue;
  }
  if (studentPicks.length > 0 && !brief) {
    onlyPicks++;
    continue;
  }
  if (!brief) continue;

  const latestPick = studentPicks[studentPicks.length - 1];
  const latestPickArchetype = archetypeFromAction(latestPick.action_resolved);
  const finalArchetype = brief.archetype_id;

  // Did they ever pick "Pitch your own"?
  const hadPitchPick = studentPicks.some(
    (p) => archetypeFromAction(p.action_resolved) === "pitch-to-teacher",
  );

  // Did they pick MORE THAN ONE card?
  const distinctCards = new Set(studentPicks.map((p) => p.card_id));

  // Match logic — when does the brief "honour" the picks?
  // (a) brief.archetype_id matches latest pick's archetype → expected
  // (b) brief.archetype_id is null AND no pick was set-archetype → expected
  // (c) brief.archetype_id differs from latest pick's archetype → INTERESTING
  let status = "match";
  if (finalArchetype && latestPickArchetype === "pitch-to-teacher") {
    status = "pitch-then-other-archetype";
    pitchRouted++;
  } else if (
    finalArchetype &&
    latestPickArchetype &&
    finalArchetype !== latestPickArchetype
  ) {
    status = "mismatch";
    mismatches++;
  } else {
    matches++;
  }

  if (status !== "match") {
    flagged.push({
      studentId,
      unitId,
      studentLabel: studentLabel(studentId),
      picks: studentPicks,
      brief,
      latestPickArchetype,
      finalArchetype,
      hadPitchPick,
      distinctCardCount: distinctCards.size,
      status,
    });
  }
}

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("SUMMARY");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`  Total (student, unit) pairs:           ${keys.size}`);
console.log(`  Latest pick → brief archetype match:   ${matches}`);
console.log(`  Routed via "Pitch your own":           ${pitchRouted}`);
console.log(`  Picked but no brief row:               ${onlyPicks}`);
console.log(`  Brief but never picked a card:         ${onlyBriefs}`);
console.log(`  ⚠ Brief archetype ≠ latest pick:       ${mismatches}`);
console.log("");

if (flagged.length === 0) {
  console.log("No flagged rows. All picks match.");
  process.exit(0);
}

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("FLAGGED ROWS");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
for (const f of flagged) {
  console.log(`\n● ${f.studentLabel}  (status: ${f.status})`);
  console.log(`    student: ${f.studentId.slice(0, 8)}  unit: ${f.unitId.slice(0, 8)}`);
  console.log(`    picks (${f.picks.length}):`);
  for (const p of f.picks) {
    const card = cardById[p.card_id];
    const arch = archetypeFromAction(p.action_resolved);
    console.log(
      `        ${new Date(p.picked_at).toISOString().slice(0, 16)}  ` +
        `${card?.emoji ?? ""} ${card?.label ?? p.card_id}  →  ${arch ?? "(no archetype)"}`,
    );
  }
  console.log(`    brief.archetype_id:  ${f.finalArchetype ?? "(null)"}`);
  console.log(`    brief.completed:     ${f.brief.completed_at ?? "no"}`);
  console.log(`    distinct cards picked: ${f.distinctCardCount}`);
  console.log(`    had pitch-to-teacher pick: ${f.hadPitchPick}`);
}
