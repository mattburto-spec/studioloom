#!/usr/bin/env node
/**
 * Pre-warm the word_definitions cache with the top design-vocabulary words.
 *
 * Phase 1C of language-scaffolding-redesign. Reads
 * scripts/seed-data/design-vocab-500.json (~575 unique words across 10
 * categories), batches Anthropic Haiku 4.5 calls, and upserts into the
 * word_definitions table. First-time students hit cache rather than
 * burning a Haiku call per word; cold-cache rate target is <20 unique
 * uncached words per first-time student per lesson.
 *
 * Usage:
 *   node scripts/preflight-tap-a-word-seed.mjs                 # full live run
 *   node scripts/preflight-tap-a-word-seed.mjs --dry-run       # print what WOULD be sent, no API/DB writes
 *   node scripts/preflight-tap-a-word-seed.mjs --sandbox       # use sandbox dictionary instead of live Anthropic
 *   node scripts/preflight-tap-a-word-seed.mjs --concurrency=8 # tune parallelism (default 5)
 *   node scripts/preflight-tap-a-word-seed.mjs --limit=50      # only seed first N words (for smoke testing)
 *
 * Environment (live mode):
 *   SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ANTHROPIC_API_KEY
 *
 * Environment (sandbox/dry-run):
 *   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (sandbox writes to cache so it can be re-tested)
 *   ANTHROPIC_API_KEY not required
 *
 * Cost projection (live mode, 575 words × ~250 input + ~80 output tokens × Haiku rates):
 *   Input:  575 × 250 = 143,750 tokens × $0.80/MTok ≈ $0.115
 *   Output: 575 × 80  =  46,000 tokens × $4.00/MTok ≈ $0.184
 *   Total one-time seed: ~$0.30. Run once per environment.
 *
 * Idempotency:
 *   - Cache hit (word already in word_definitions for language='en', context_hash='', l1_target='en') is skipped.
 *   - Re-running is safe + cheap. Only cache misses incur API cost.
 *
 * Lesson #39 guards: stop_reason check + defensive destructure on every Haiku call.
 */

import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const SEED_LIST_PATH = resolve(REPO_ROOT, "scripts/seed-data/design-vocab-500.json");

// ─── CLI args ───
const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const SANDBOX = args.has("--sandbox");
const CONCURRENCY = (() => {
  const flag = [...args].find((a) => a.startsWith("--concurrency="));
  return flag ? Math.max(1, parseInt(flag.split("=")[1], 10)) : 5;
})();
const LIMIT = (() => {
  const flag = [...args].find((a) => a.startsWith("--limit="));
  return flag ? parseInt(flag.split("=")[1], 10) : Infinity;
})();

// ─── Env ───
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

if (!DRY_RUN) {
  if (!SUPABASE_URL) die("SUPABASE_URL env var not set (or NEXT_PUBLIC_SUPABASE_URL)");
  if (!SUPABASE_KEY) die("SUPABASE_SERVICE_ROLE_KEY env var not set");
  if (!SANDBOX && !ANTHROPIC_KEY) die("ANTHROPIC_API_KEY env var not set (or use --sandbox)");
}

// ─── Constants ───
const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 250;
const TOOL_NAME = "word_definition";
// Anthropic Haiku 4.5 pricing (April 2026)
const PRICE_INPUT_PER_MTOK = 0.80;
const PRICE_OUTPUT_PER_MTOK = 4.00;

// ─── Sandbox dictionary (mirrors src/lib/ai/sandbox/word-lookup-sandbox.ts) ───
function sandboxLookup(word) {
  // Trim to a marker so we can tell sandbox-seeded entries apart from real ones.
  return {
    definition: `[sandbox] definition of "${word}"`,
    example: `[sandbox] example using "${word}".`,
  };
}

// ─── Tool schema (matches /api/student/word-lookup route) ───
const TOOL = {
  name: TOOL_NAME,
  description:
    "Return a student-friendly definition and an example sentence for an English word.",
  input_schema: {
    type: "object",
    properties: {
      definition: {
        type: "string",
        description:
          "One short sentence in plain language a 12-year-old understands. Max 20 words.",
      },
      example: {
        type: "string",
        description: "One sentence using the word naturally. Max 20 words.",
      },
    },
    required: ["definition", "example"],
  },
};

// ─── Helpers ───
function die(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

function loadWords() {
  const raw = JSON.parse(readFileSync(SEED_LIST_PATH, "utf8"));
  const all = [];
  for (const [cat, words] of Object.entries(raw)) {
    if (cat.startsWith("_")) continue;
    if (!Array.isArray(words)) continue;
    for (const w of words) {
      const norm = String(w).trim().toLowerCase();
      if (norm.length >= 2 && norm.length <= 50) all.push(norm);
    }
  }
  // De-dup case-insensitive, preserve first-seen order
  const seen = new Set();
  const unique = [];
  for (const w of all) {
    if (!seen.has(w)) {
      seen.add(w);
      unique.push(w);
    }
  }
  return unique;
}

async function fetchExistingCache(supabase, words) {
  // Bulk SELECT in chunks of 200 (Postgres parameter cap is generous but be polite)
  const cached = new Set();
  const CHUNK = 200;
  for (let i = 0; i < words.length; i += CHUNK) {
    const chunk = words.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from("word_definitions")
      .select("word")
      .in("word", chunk)
      .eq("language", "en")
      .eq("context_hash", "")
      .eq("l1_target", "en");
    if (error) die(`cache lookup failed: ${error.message}`);
    for (const row of data ?? []) cached.add(row.word);
  }
  return cached;
}

async function callHaiku(client, word) {
  const userPrompt =
    `Define the word "${word}" for a secondary-school student in design class. ` +
    `Give a short definition that fits design context, then a short example sentence.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    tools: [TOOL],
    tool_choice: { type: "tool", name: TOOL_NAME },
    messages: [{ role: "user", content: userPrompt }],
  });

  // Lesson #39: stop_reason guard
  if (response.stop_reason === "max_tokens") {
    throw new Error(
      `[seed] Anthropic truncated for word="${word}" at max_tokens=${MAX_TOKENS} ` +
        `(output_tokens=${response.usage.output_tokens}, model=${MODEL}). ` +
        `Bump MAX_TOKENS or shorten input.`
    );
  }

  const block = response.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") {
    throw new Error(`[seed] no tool_use block for word="${word}"`);
  }

  // Lesson #39 + #42: defensive destructure
  const input = block.input ?? {};
  const definition = typeof input.definition === "string" ? input.definition : "";
  const example = typeof input.example === "string" ? input.example : "";
  if (!definition) {
    throw new Error(`[seed] empty definition for word="${word}"`);
  }

  return {
    definition,
    example,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

async function seedOne(supabase, client, word) {
  let definition, example, inputTokens = 0, outputTokens = 0;

  // DRY-RUN implies sandbox-style lookup (no live API call, no DB write).
  // SANDBOX is sandbox lookup but DOES write to DB so the cache is exercised.
  if (DRY_RUN || SANDBOX) {
    const s = sandboxLookup(word);
    definition = s.definition;
    example = s.example;
  } else {
    const result = await callHaiku(client, word);
    definition = result.definition;
    example = result.example;
    inputTokens = result.inputTokens;
    outputTokens = result.outputTokens;
  }

  if (DRY_RUN) {
    console.log(`  [dry] ${word}: ${definition}`);
    return { ok: true, inputTokens, outputTokens };
  }

  const { error } = await supabase.from("word_definitions").upsert({
    word,
    language: "en",
    context_hash: "",
    l1_target: "en",
    definition,
    example_sentence: example || null,
  });
  if (error) {
    return { ok: false, inputTokens, outputTokens, errorMessage: error.message };
  }
  return { ok: true, inputTokens, outputTokens };
}

async function runWithConcurrency(items, concurrency, fn) {
  const results = [];
  let next = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (next < items.length) {
      const i = next++;
      try {
        const r = await fn(items[i], i);
        results[i] = r;
      } catch (err) {
        results[i] = { ok: false, errorMessage: err instanceof Error ? err.message : String(err) };
      }
    }
  });
  await Promise.all(workers);
  return results;
}

// ─── Main ───
(async function main() {
  const startedAt = Date.now();
  console.log(`[seed] mode: ${DRY_RUN ? "DRY-RUN" : SANDBOX ? "SANDBOX" : "LIVE"} | concurrency: ${CONCURRENCY}${isFinite(LIMIT) ? ` | limit: ${LIMIT}` : ""}`);

  const allWords = loadWords();
  const targetWords = allWords.slice(0, isFinite(LIMIT) ? LIMIT : allWords.length);
  console.log(`[seed] loaded ${allWords.length} unique words from ${SEED_LIST_PATH}; targeting ${targetWords.length}`);

  let supabase = null;
  let client = null;
  let cachedSet = new Set();

  if (!DRY_RUN) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
    cachedSet = await fetchExistingCache(supabase, targetWords);
    console.log(`[seed] ${cachedSet.size}/${targetWords.length} already cached — will skip`);
  }
  if (!DRY_RUN && !SANDBOX) {
    client = new Anthropic({ apiKey: ANTHROPIC_KEY, maxRetries: 2 });
  }

  const todo = targetWords.filter((w) => !cachedSet.has(w));
  console.log(`[seed] ${todo.length} words to process`);

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let succeeded = 0;
  let failed = 0;
  const failures = [];

  // Progress every 50
  let processedSinceLog = 0;
  let lastLog = Date.now();

  const results = await runWithConcurrency(todo, CONCURRENCY, async (word) => {
    const r = await seedOne(supabase, client, word);
    totalInputTokens += r.inputTokens || 0;
    totalOutputTokens += r.outputTokens || 0;
    if (r.ok) succeeded++; else { failed++; failures.push({ word, error: r.errorMessage }); }

    processedSinceLog++;
    if (processedSinceLog >= 50 || succeeded + failed === todo.length) {
      const elapsed = ((Date.now() - lastLog) / 1000).toFixed(1);
      const cost = (totalInputTokens * PRICE_INPUT_PER_MTOK + totalOutputTokens * PRICE_OUTPUT_PER_MTOK) / 1_000_000;
      console.log(
        `[seed] ${succeeded + failed}/${todo.length} processed (${succeeded} ok, ${failed} failed) | ${totalInputTokens} in + ${totalOutputTokens} out tokens | $${cost.toFixed(4)} so far | +${elapsed}s`
      );
      processedSinceLog = 0;
      lastLog = Date.now();
    }
    return r;
  });

  // ─── Final report ───
  const elapsedTotal = ((Date.now() - startedAt) / 1000).toFixed(1);
  const inputCost = (totalInputTokens * PRICE_INPUT_PER_MTOK) / 1_000_000;
  const outputCost = (totalOutputTokens * PRICE_OUTPUT_PER_MTOK) / 1_000_000;
  const totalCost = inputCost + outputCost;

  console.log("\n─── Seed report ───");
  console.log(`Mode:           ${DRY_RUN ? "DRY-RUN" : SANDBOX ? "SANDBOX" : "LIVE"}`);
  console.log(`Total words:    ${targetWords.length}`);
  console.log(`Already cached: ${cachedSet.size}`);
  console.log(`Processed:      ${todo.length}`);
  console.log(`Succeeded:      ${succeeded}`);
  console.log(`Failed:         ${failed}`);
  console.log(`Input tokens:   ${totalInputTokens.toLocaleString()} ($${inputCost.toFixed(4)})`);
  console.log(`Output tokens:  ${totalOutputTokens.toLocaleString()} ($${outputCost.toFixed(4)})`);
  console.log(`Total cost:     $${totalCost.toFixed(4)}`);
  console.log(`Wall time:      ${elapsedTotal}s`);

  if (failures.length > 0) {
    console.log("\n─── Failures ───");
    for (const f of failures.slice(0, 20)) {
      console.log(`  ${f.word}: ${f.error}`);
    }
    if (failures.length > 20) console.log(`  ... + ${failures.length - 20} more`);
  }

  // For Checkpoint 1.1 cost analysis:
  // Average per-student-lesson session: ~5 first-encounter words / lesson × 1/30 cache amortisation = ~0.17 cache misses / student / lesson.
  // After this seed, cache hit rate >95% on common vocab → most lessons hit 0 cold misses.
  // Worst-case student-lesson session cost: 5 misses × $0.0005 each = $0.0025 (well under the $0.02 ceiling).
  console.log("\n─── Checkpoint 1.1 budget context ───");
  console.log("Per-student-lesson worst case (5 cold misses): $0.0025");
  console.log("Checkpoint 1.1 ceiling:                          $0.02");
  console.log(`Headroom:                                        ${((0.02 - 0.0025) / 0.02 * 100).toFixed(0)}%`);

  process.exit(failed > 0 ? 1 : 0);
})().catch((err) => {
  console.error("\n[seed] FATAL:", err);
  process.exit(1);
});
