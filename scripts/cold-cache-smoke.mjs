// Empirical cold-cache rate measurement for Checkpoint 1.1 criterion #5.
// Pulls real lessons from Supabase, tokenises their educational text,
// counts cache misses against word_definitions.

import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// ──────────────────────────────────────────────────────────────────────────
// Inline tokenizer — mirrors src/components/student/tap-a-word/tokenize.ts
// ──────────────────────────────────────────────────────────────────────────
const MIN_TAPPABLE_LENGTH = 2;
const TOKEN_RE = /(\s+)|(\p{L}+(?:[-'’]\p{L}+)*)|([^\s\p{L}]+)/gu;

function tokenize(text) {
  if (!text) return [];
  const urlRanges = [];
  const nonWsRe = /\S+/g;
  let n;
  while ((n = nonWsRe.exec(text)) !== null) {
    if (n[0].includes("://")) urlRanges.push([n.index, n.index + n[0].length]);
  }
  const inUrl = (idx) => urlRanges.some(([s, e]) => idx >= s && idx < e);
  const tokens = [];
  let m;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(text)) !== null) {
    const [, ws, word, other] = m;
    if (ws !== undefined) tokens.push({ text: ws, tappable: false });
    else if (word !== undefined)
      tokens.push({
        text: word,
        tappable: !inUrl(m.index) && word.length >= MIN_TAPPABLE_LENGTH,
      });
    else if (other !== undefined) tokens.push({ text: other, tappable: false });
  }
  return tokens;
}

function tappableWords(text) {
  return tokenize(text).filter((t) => t.tappable).map((t) => t.text.toLowerCase());
}

// ──────────────────────────────────────────────────────────────────────────
// Walk a unit's content_data JSONB and pull all educational text
// ──────────────────────────────────────────────────────────────────────────
function extractEducationalText(contentData) {
  if (!contentData) return [];
  const texts = [];
  // content_data shape varies by version (v1 object pages, v2 pages array, v3 journey)
  // Walk recursively pulling all string fields likely to be educational text
  const TEXT_KEYS = new Set([
    "prompt", "text", "definition", "example", "term", "introduction",
    "title", "description", "notes", "instructions", "context",
  ]);
  function walk(node) {
    if (node === null || node === undefined) return;
    if (typeof node === "string") return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (typeof node !== "object") return;
    for (const [key, val] of Object.entries(node)) {
      if (TEXT_KEYS.has(key) && typeof val === "string" && val.length > 10) {
        texts.push(val);
      } else if (typeof val === "object") {
        walk(val);
      }
    }
  }
  walk(contentData);
  return texts;
}

// ──────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────
const SAMPLE_SIZE = 5;

console.log(`[cold-cache] sampling ${SAMPLE_SIZE} published units…`);
const { data: units, error } = await sb
  .from("units")
  .select("id, title, content_data")
  .eq("is_published", true)
  .not("content_data", "is", null)
  .limit(SAMPLE_SIZE);

if (error) {
  console.error("Query error:", error);
  process.exit(1);
}

if (!units?.length) {
  console.log("No published units with content_data found. Falling back to all units.");
  const { data: anyUnits } = await sb
    .from("units")
    .select("id, title, content_data")
    .not("content_data", "is", null)
    .limit(SAMPLE_SIZE);
  if (!anyUnits?.length) {
    console.log("No units at all. Cannot measure.");
    process.exit(0);
  }
  units.push(...anyUnits);
}

// Pull entire word_definitions cache once for fast lookup
const { data: cacheRows } = await sb
  .from("word_definitions")
  .select("word")
  .eq("language", "en")
  .eq("context_hash", "")
  .eq("l1_target", "en");
const cache = new Set((cacheRows ?? []).map((r) => r.word));
console.log(`[cold-cache] cache size: ${cache.size} words`);
console.log("");

let totalUnits = 0;
let totalTextBlocks = 0;
let totalUniqueWords = 0;
let totalCacheHits = 0;
let totalColdMisses = 0;

for (const unit of units) {
  const texts = extractEducationalText(unit.content_data);
  if (!texts.length) continue;
  totalUnits++;

  const allWords = new Set();
  for (const t of texts) {
    for (const w of tappableWords(t)) allWords.add(w);
  }

  const hits = [];
  const misses = [];
  for (const w of allWords) {
    if (cache.has(w)) hits.push(w);
    else misses.push(w);
  }

  totalTextBlocks += texts.length;
  totalUniqueWords += allWords.size;
  totalCacheHits += hits.length;
  totalColdMisses += misses.length;

  const hitPct = allWords.size > 0 ? ((hits.length / allWords.size) * 100).toFixed(1) : "n/a";
  console.log(`[unit] "${unit.title?.slice(0, 50)}" (${unit.id.slice(0, 8)})`);
  console.log(`  text blocks: ${texts.length}, unique words: ${allWords.size}, cache hits: ${hits.length} (${hitPct}%), cold misses: ${misses.length}`);
  if (misses.length > 0 && misses.length <= 30) {
    console.log(`  cold-miss words: ${misses.slice(0, 30).join(", ")}`);
  } else if (misses.length > 30) {
    console.log(`  cold-miss words (first 30 of ${misses.length}): ${misses.slice(0, 30).join(", ")}`);
  }
}

console.log("");
console.log("─── Aggregate ───");
console.log(`Units sampled:        ${totalUnits}`);
console.log(`Text blocks:          ${totalTextBlocks}`);
console.log(`Unique words seen:    ${totalUniqueWords}`);
console.log(`Cache hits:           ${totalCacheHits}`);
console.log(`Cold misses:          ${totalColdMisses}`);
const overallHitRate = totalUniqueWords > 0 ? (totalCacheHits / totalUniqueWords * 100).toFixed(1) : "n/a";
console.log(`Hit rate:             ${overallHitRate}%`);
console.log(`Avg cold misses/unit: ${totalUnits > 0 ? (totalColdMisses / totalUnits).toFixed(1) : "n/a"}`);
console.log("");
console.log("─── Checkpoint 1.1 criterion #5 ───");
console.log("Threshold: <20 unique uncached words per first-time student per lesson");
const passing = totalUnits > 0 && (totalColdMisses / totalUnits) < 20;
console.log(`Status:    ${passing ? "✅ PASSING" : "⚠️  FAILING — increase pre-warm coverage"}`);
