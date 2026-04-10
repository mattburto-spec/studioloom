#!/usr/bin/env node
/**
 * Seed the activity_blocks library with the 55 curated Teaching Moves.
 *
 * Phase 1 (Dimensions3 Completion Spec §3.1), 10 Apr 2026.
 *
 * Usage:
 *   node scripts/seed-teaching-moves.mjs                    # full run: rewrite + insert
 *   node scripts/seed-teaching-moves.mjs --dry-run          # simulate inserts, do not write
 *   node scripts/seed-teaching-moves.mjs --rewrite-only     # rewrite prompts only, do not touch DB
 *   node scripts/seed-teaching-moves.mjs --dry-run --rewrite-only  # Checkpoint 1.1 mode
 *   node scripts/seed-teaching-moves.mjs --force            # update existing community blocks
 *
 * Environment:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, VOYAGE_API_KEY, SYSTEM_TEACHER_ID
 *
 * Idempotency:
 *   - Second run (no flag) skips all moves already present (by title + module + source_type='community').
 *   - --force updates the existing row instead of skipping.
 *   - Rewrite prompts are cached to scripts/seed-data/teaching-moves-rewritten.json — re-reads on every run.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const REWRITE_CACHE_PATH = resolve(REPO_ROOT, "scripts/seed-data/teaching-moves-rewritten.json");
const REWRITE_PROMPT_PATH = resolve(REPO_ROOT, "scripts/seed-data/rewrite-prompt.md");

// ─── CLI args ───
const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const REWRITE_ONLY = args.has("--rewrite-only");
const FORCE = args.has("--force");

// ─── Env ───
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const VOYAGE_KEY = process.env.VOYAGE_API_KEY;
const SYSTEM_TEACHER_ID = process.env.SYSTEM_TEACHER_ID;

if (!ANTHROPIC_KEY) die("ANTHROPIC_API_KEY env var not set");
if (!REWRITE_ONLY) {
  if (!SUPABASE_URL) die("SUPABASE_URL env var not set");
  if (!SUPABASE_KEY) die("SUPABASE_SERVICE_ROLE_KEY env var not set");
  if (!SYSTEM_TEACHER_ID) die("SYSTEM_TEACHER_ID env var not set");
  if (!VOYAGE_KEY) die("VOYAGE_API_KEY env var not set");
}

// ─── Constants ───
const MODEL_SONNET = "claude-sonnet-4-5-20250929";
const VOYAGE_MODEL = "voyage-3.5";
const VOYAGE_DIMS = 1024;

// 14-category taxonomy (from §6.3 of master spec / migration 060 comment)
const VALID_CATEGORIES = new Set([
  "ideation", "research", "analysis", "making", "critique",
  "reflection", "planning", "presentation", "warmup", "collaboration",
  "skill-building", "documentation", "assessment", "journey",
]);

function die(msg) {
  console.error(`[seed] FATAL: ${msg}`);
  process.exit(1);
}

// ─── Load rewrite cache ───
function loadRewriteCache() {
  if (!existsSync(REWRITE_CACHE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(REWRITE_CACHE_PATH, "utf8"));
  } catch (e) {
    console.warn(`[seed] Could not read rewrite cache: ${e.message}`);
    return {};
  }
}

function saveRewriteCache(cache) {
  mkdirSync(dirname(REWRITE_CACHE_PATH), { recursive: true });
  writeFileSync(REWRITE_CACHE_PATH, JSON.stringify(cache, null, 2));
}

// ─── Anthropic Sonnet rewrite ───
async function callSonnet(systemPrompt, userMessage) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL_SONNET,
      max_tokens: 1200,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${text.slice(0, 400)}`);
  }
  const data = await res.json();
  const text = data?.content?.[0]?.text;
  if (!text) throw new Error("Empty Anthropic response");
  return text.trim();
}

function validateRewrite(text) {
  if (!text || text.length === 0) return "empty";
  if (text.length > 2000) return "too long (>2000 chars)";
  const lc = text.toLowerCase();
  // Banned meta/teacher-perspective vocabulary
  if (/\bstudents\s+will\b/.test(lc)) return 'contains "students will" (meta commentary)';
  if (/^in this activity/.test(lc)) return 'starts with "In this activity"';
  if (/\bthe teacher\b/.test(lc)) return 'contains "the teacher"';
  return null;
}

async function rewriteMove(move, systemPrompt, cache) {
  if (cache[move.id]) return { text: cache[move.id], cached: true };

  const userMessage = [
    `Name: ${move.name}`,
    `Description: ${move.description}`,
    `Example: ${move.example}`,
  ].join("\n");

  const raw = await callSonnet(systemPrompt, userMessage);
  const err = validateRewrite(raw);
  if (err) {
    throw new Error(`Rewrite validation failed (${err}): ${raw.slice(0, 120)}…`);
  }
  cache[move.id] = raw;
  saveRewriteCache(cache); // Persist after every successful rewrite (cheap, safe)
  return { text: raw, cached: false };
}

// ─── Voyage embeddings ───
async function embedText(text) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch("https://api.voyageai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${VOYAGE_KEY}`,
        },
        body: JSON.stringify({
          model: VOYAGE_MODEL,
          input: [text],
          output_dimension: VOYAGE_DIMS,
        }),
      });
      if (!res.ok) throw new Error(`Voyage API ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = await res.json();
      const vec = data?.data?.[0]?.embedding;
      if (!Array.isArray(vec) || vec.length !== VOYAGE_DIMS) {
        throw new Error(`Voyage returned invalid vector (len=${vec?.length})`);
      }
      return vec;
    } catch (e) {
      lastErr = e;
      const backoffMs = 500 * Math.pow(2, attempt - 1);
      console.warn(`[seed] Voyage attempt ${attempt} failed: ${e.message} — retrying in ${backoffMs}ms`);
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
  throw lastErr || new Error("Voyage failed after retries");
}

// ─── Field mapping ───
function timeWeightFromRange(range) {
  const max = Array.isArray(range) ? range[1] : null;
  if (max == null) return "moderate";
  if (max <= 10) return "quick";
  if (max <= 20) return "moderate";
  return "extended";
}

function parseMaterials(prep) {
  if (!prep || typeof prep !== "string" || prep.trim() === "") return [];
  return prep.split(",").map((s) => s.trim()).filter(Boolean);
}

function buildTags(move) {
  const tags = ["teaching-move", "seed"];
  for (const b of move.boosts || []) tags.push(b);
  tags.push(`energy:${move.energy}`);
  for (const ut of move.unitTypes || []) tags.push(`unit_type:${ut}`);
  if (Array.isArray(move.durationRange)) {
    tags.push(`duration_min:${move.durationRange[0]}`);
    tags.push(`duration_max:${move.durationRange[1]}`);
  }
  return tags;
}

function moveToBlockPayload(move, studentPrompt) {
  const category = move.category;
  if (!VALID_CATEGORIES.has(category)) {
    throw new Error(`Invalid activity_category "${category}" for move ${move.id}`);
  }

  return {
    title: move.name,
    prompt: studentPrompt,
    description: `${move.description}\n\nExample: ${move.example}`,
    source_type: "community",
    teacher_id: SYSTEM_TEACHER_ID,
    is_public: true,
    efficacy_score: 65,
    times_used: 0,
    bloom_level: move.bloomLevels?.[0] || null,
    grouping: move.grouping?.[0] || "flexible",
    time_weight: timeWeightFromRange(move.durationRange),
    activity_category: category,
    phase: move.phases?.[0] || "any",
    tags: buildTags(move),
    materials_needed: parseMaterials(move.prep),
    module: "studioloom",
    // NOTE: moderation_status, typical_duration_minutes, unit_type_tags columns
    // do not yet exist in the schema (§6.2 spec / Phase 5). Duration + unit
    // types are encoded into `tags` above so the data is not lost.
  };
}

// ─── Dedup check ───
async function findExistingBlock(supabase, move) {
  const { data, error } = await supabase
    .from("activity_blocks")
    .select("id")
    .eq("source_type", "community")
    .eq("module", "studioloom")
    .eq("title", move.name)
    .limit(1);
  if (error) throw new Error(`Dedup lookup failed: ${error.message}`);
  return data?.[0]?.id || null;
}

// ─── Embedding literal ───
function toPgVector(vec) {
  // halfvec accepts string literal `[0.1,0.2,...]`
  return `[${vec.join(",")}]`;
}

// ─── Main ───
async function main() {
  const mode = [
    DRY_RUN && "dry-run",
    REWRITE_ONLY && "rewrite-only",
    FORCE && "force",
  ]
    .filter(Boolean)
    .join(" + ") || "full run";
  console.log(`[seed] Mode: ${mode}`);

  // Load rewrite prompt template
  if (!existsSync(REWRITE_PROMPT_PATH)) die(`Missing rewrite prompt: ${REWRITE_PROMPT_PATH}`);
  const systemPrompt = readFileSync(REWRITE_PROMPT_PATH, "utf8");

  // Load moves via native TS import (Node 24+)
  const movesModule = await import(resolve(REPO_ROOT, "src/lib/ai/teaching-moves.ts"));
  const moves = movesModule.TEACHING_MOVES;
  if (!Array.isArray(moves) || moves.length === 0) die("TEACHING_MOVES export is empty");
  console.log(`[seed] Loaded ${moves.length} teaching moves`);

  const cache = loadRewriteCache();

  const supabase = REWRITE_ONLY || DRY_RUN
    ? null
    : createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

  const summary = { inserted: 0, updated: 0, skipped: 0, failed: 0, rewritten: 0, cached: 0 };
  const failures = [];

  for (const move of moves) {
    try {
      // Step 1: rewrite prompt (always — either from cache or fresh)
      const { text: studentPrompt, cached } = await rewriteMove(move, systemPrompt, cache);
      if (cached) summary.cached++;
      else summary.rewritten++;

      if (REWRITE_ONLY) {
        console.log(`  ✓ rewrite ${cached ? "(cached)" : "(new)   "} ${move.id}`);
        continue;
      }

      // Step 2: dedup check against DB
      const existingId = supabase ? await findExistingBlock(supabase, move) : null;
      if (existingId && !FORCE) {
        summary.skipped++;
        console.log(`  ⊘ skip (exists)   ${move.id}`);
        continue;
      }

      // Step 3: build payload
      const payload = moveToBlockPayload(move, studentPrompt);

      // Step 4: embedding
      const embedSource = `${move.name}\n\n${studentPrompt}\n\nExample: ${move.example}`;
      const vec = await embedText(embedSource);
      payload.embedding = toPgVector(vec);

      if (DRY_RUN) {
        console.log(`  ✎ dry-run         ${move.id} (would ${existingId ? "update" : "insert"})`);
        continue;
      }

      // Step 5: insert or update
      if (existingId && FORCE) {
        const { error } = await supabase
          .from("activity_blocks")
          .update(payload)
          .eq("id", existingId);
        if (error) throw new Error(`Update failed: ${error.message}`);
        summary.updated++;
        console.log(`  ↻ updated         ${move.id} → ${existingId}`);
      } else {
        const { data, error } = await supabase
          .from("activity_blocks")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw new Error(`Insert failed: ${error.message}`);
        summary.inserted++;
        console.log(`  ✓ inserted        ${move.id} → ${data.id}`);
      }
    } catch (e) {
      summary.failed++;
      failures.push({ id: move.id, error: e.message });
      console.error(`  ✗ FAILED          ${move.id}: ${e.message}`);
    }
  }

  console.log("\n[seed] Summary:");
  console.log(`  rewrites cached:  ${summary.cached}`);
  console.log(`  rewrites new:     ${summary.rewritten}`);
  if (!REWRITE_ONLY) {
    console.log(`  inserted:         ${summary.inserted}`);
    console.log(`  updated:          ${summary.updated}`);
    console.log(`  skipped:          ${summary.skipped}`);
  }
  console.log(`  failed:           ${summary.failed}`);
  if (REWRITE_ONLY) {
    console.log(`\n[seed] Rewrites written to: ${REWRITE_CACHE_PATH}`);
    console.log("[seed] Review this file, spot-check 10 at random, then run without --rewrite-only to commit to DB.");
  }

  if (summary.failed > 0) {
    console.error(`\n[seed] ${summary.failed} failures:`);
    for (const f of failures) console.error(`  - ${f.id}: ${f.error}`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("[seed] Unhandled error:", e);
  process.exit(1);
});
