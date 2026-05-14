/**
 * Read-only audit of the `choice_cards` table.
 *
 * Surfaces every card whose `on_pick_action` doesn't map cleanly to a
 * known Product Brief archetype — i.e. the cards that would cause a
 * student to fall through to the archetype picker (or land on the
 * wrong default) after picking.
 *
 * Why this exists: 14 May 2026 — G8 students reported "I picked Space
 * and ended up doing a dress design". The wiring (Choice Cards →
 * Product Brief archetype) is sound; the bug is in the per-card
 * `on_pick_action` configuration. See CLAUDE.md / dashboard for the
 * design conversation.
 *
 * Usage:
 *   node scripts/dev/audit-choice-cards.mjs
 *
 * Reads .env.local for SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 * No writes, no side effects.
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

// Valid archetypes from src/lib/project-spec/product-brief.ts
const VALID_ARCHETYPES = new Set([
  "toy-design",
  "architecture-interior",
  "app-digital-tool",
  "film-video",
  "fashion-wearable",
  "event-service-performance",
  "other",
]);

const { data: cards, error } = await sb
  .from("choice_cards")
  .select("id, label, emoji, tags, on_pick_action, created_by, is_seeded, created_at")
  .order("created_at", { ascending: true });

if (error) {
  console.error("Query failed:", error.message);
  process.exit(1);
}

if (!cards || cards.length === 0) {
  console.log("No choice cards found.");
  process.exit(0);
}

console.log(`Found ${cards.length} choice cards.\n`);

// Classify each card
const ok = [];
const noAction = [];
const wrongType = [];
const unknownArchetype = [];
const malformed = [];

for (const c of cards) {
  const action = c.on_pick_action;
  if (!action || typeof action !== "object") {
    noAction.push(c);
    continue;
  }
  if (action.type !== "set-archetype") {
    wrongType.push({ ...c, _actionType: action.type });
    continue;
  }
  const archetypeId = action.payload?.archetypeId;
  if (typeof archetypeId !== "string") {
    malformed.push(c);
    continue;
  }
  if (!VALID_ARCHETYPES.has(archetypeId)) {
    unknownArchetype.push({ ...c, _archetypeId: archetypeId });
    continue;
  }
  ok.push({ ...c, _archetypeId: archetypeId });
}

// created_by points at auth.users(id), not teachers. Resolve via auth admin API.
const userIds = [...new Set(cards.map((c) => c.created_by).filter(Boolean))];
const userById = {};
for (const uid of userIds) {
  try {
    const { data } = await sb.auth.admin.getUserById(uid);
    if (data?.user) userById[uid] = data.user;
  } catch {
    // ignore; will fall through to id slice
  }
}

function ownerLabel(c) {
  if (c.is_seeded) return "(seeded)";
  const u = c.created_by ? userById[c.created_by] : null;
  if (!u) return c.created_by ? c.created_by.slice(0, 8) : "(none)";
  return u.email || c.created_by.slice(0, 8);
}

function printCard(c, extra = "") {
  const tags = Array.isArray(c.tags) ? c.tags.join(",") : "";
  console.log(
    `    ${c.emoji ?? ""} ${c.label}  ${extra}` +
      `\n        id: ${c.id}` +
      `\n        owner: ${ownerLabel(c)}` +
      (tags ? `\n        tags: [${tags}]` : "") +
      `\n        on_pick_action: ${JSON.stringify(c.on_pick_action)}`,
  );
}

// ──────────────────────────────────────────────────────────────────────
// PRINT REPORT
// ──────────────────────────────────────────────────────────────────────

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`SUMMARY`);
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`  ✓ OK (valid archetype):           ${ok.length}`);
console.log(`  ⚠ no on_pick_action:              ${noAction.length}`);
console.log(`  ⚠ action.type ≠ set-archetype:    ${wrongType.length}`);
console.log(`  ⚠ malformed payload:              ${malformed.length}`);
console.log(`  ⚠ unknown archetypeId:            ${unknownArchetype.length}`);
console.log("");

if (noAction.length) {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("⚠  CARDS WITH NO on_pick_action");
  console.log("    (Student picks card → no archetype set → spec block");
  console.log("     falls through to picker, may default to first option)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  for (const c of noAction) printCard(c);
  console.log("");
}

if (wrongType.length) {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("⚠  CARDS WITH WRONG action.type");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  for (const c of wrongType) printCard(c, `← type="${c._actionType}"`);
  console.log("");
}

if (malformed.length) {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("⚠  CARDS WITH MALFORMED PAYLOAD (missing archetypeId)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  for (const c of malformed) printCard(c);
  console.log("");
}

if (unknownArchetype.length) {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("⚠  CARDS POINTING TO UNKNOWN archetypeId");
  console.log("    (Product Brief doesn't recognise this archetype —");
  console.log("     student falls through to picker silently)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  for (const c of unknownArchetype) printCard(c, `← archetypeId="${c._archetypeId}"`);
  console.log("");
}

if (ok.length) {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✓  OK CARDS (archetype distribution)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  const byArchetype = {};
  for (const c of ok) {
    (byArchetype[c._archetypeId] ??= []).push(c);
  }
  for (const [arch, list] of Object.entries(byArchetype).sort()) {
    console.log(`  ${arch}  (${list.length})`);
    for (const c of list) {
      console.log(`      ${c.emoji ?? ""} ${c.label}  [${ownerLabel(c)}]`);
    }
  }
  console.log("");
}

console.log(`Done. ${noAction.length + wrongType.length + malformed.length + unknownArchetype.length} cards need attention.`);
