#!/usr/bin/env node
/**
 * Lever 1 sub-phase 1C-revised — AI rewrite Teaching Moves into v2 shape.
 *
 * Reads scripts/seed-data/teaching-moves-rewritten.json (the existing
 * 55 single-blob prompts, authored before v2) and asks Claude Sonnet
 * to split each into the three v2 slot fields:
 *   - framing
 *   - task
 *   - success_signal
 *
 * Brief: docs/projects/lesson-quality-lever-1-slot-fields.md
 * Style: docs/specs/lesson-content-style-guide-v2-draft.md
 *
 * Cached output: scripts/seed-data/teaching-moves-v2.json
 *
 * USAGE:
 *   node scripts/seed-data/rewrite-to-v2-shape.mjs                 # process all 55 (uses cache)
 *   node scripts/seed-data/rewrite-to-v2-shape.mjs --limit 3       # first 3 only (sample review)
 *   node scripts/seed-data/rewrite-to-v2-shape.mjs --dry-run       # don't write cache, print to stdout
 *   node scripts/seed-data/rewrite-to-v2-shape.mjs --force         # re-process cached entries
 *
 * REQUIRES env: ANTHROPIC_API_KEY
 *
 * Why tool_use, not free-form JSON: Anthropic enforces the schema; we
 * never have to parse-and-pray. (CLAUDE.md API constraint: don't combine
 * tool_choice with thinking — we don't.)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../..");
const INPUT_PATH = resolve(REPO_ROOT, "scripts/seed-data/teaching-moves-rewritten.json");
const OUTPUT_PATH = resolve(REPO_ROOT, "scripts/seed-data/teaching-moves-v2.json");

const args = new Set(process.argv.slice(2));
const limitArg = process.argv.find((a) => a.startsWith("--limit"));
const LIMIT = limitArg ? parseInt(limitArg.split("=")[1] || process.argv[process.argv.indexOf(limitArg) + 1] || "0", 10) : 0;
const DRY_RUN = args.has("--dry-run");
const FORCE = args.has("--force");

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_KEY) {
  console.error("Missing ANTHROPIC_API_KEY env var");
  process.exit(1);
}

const MODEL_SONNET = "claude-sonnet-4-5-20250929";

// ─── System prompt — encodes v2 style guide rules ─────────────────────────

const SYSTEM_PROMPT = `You restructure existing student-facing activity prompts into three named slot fields.

INPUT: a single-blob activity prompt (already written in second person, action-verb-first, ≤300 words).

OUTPUT (via the structured tool call): three fields:

1. **framing** — One sentence (≤30 words / ≤200 chars) that orients the student: what they're doing and why it matters. Direct, second-person. NOT meta commentary about the activity ("In this activity..."). NOT a teacher-side framing ("This move is good for..."). It's what the student would think entering the task.

2. **task** — The imperative body. The actual work the student does. Use bulleted/numbered lists when there are discrete steps. Keep it ≤800 chars. Strip section headings ("**Step 1:**", "**Slide 1:**") — just write the steps as a numbered list. Drop **bold sub-headings** that the renderer doesn't preserve; convert structural beats into list items.

3. **success_signal** — One short sentence (≤200 chars) telling the student what they should produce, record, submit, or share so they know when they're done. Use a clear production verb (write / record / submit / share / sketch / annotate / present etc.). If the original prompt has no explicit closing line, INFER one from the task — the success signal must always be present, even if the original was implicit. This is the most important field for the new editor.

RULES:
- Preserve the pedagogical intent of the original. Don't change what the activity DOES, just how it's structured.
- No meta commentary anywhere ("In this activity students...", "Teachers can use this to...").
- No framework labels (no "Criterion B", no "AO2").
- Second person throughout ("you", "your team").
- Active voice. Imperative for instructions.
- Short paragraphs. 1-3 sentences each.
- No headings. No tables. No images. The renderer drops them.
- If a critical context note is in the original (e.g. "resist the urge to restart from scratch"), keep it in the task field as a short final sentence before the success signal.

The three fields will render in a hybrid composition: framing as a muted lead paragraph, task as the body, success_signal prefixed with 🎯 in bold. Keep that visual rhythm in mind — framing reads quietly, task carries the work, success_signal closes with the production cue.`;

const TOOL = {
  name: "emit_v2_slots",
  description: "Emit the three v2 slot fields for this activity prompt.",
  input_schema: {
    type: "object",
    properties: {
      framing: {
        type: "string",
        description: "One sentence (≤30 words / ≤200 chars) orienting the student. Second person, action-oriented.",
      },
      task: {
        type: "string",
        description: "The imperative body. Bulleted/numbered list when there are discrete steps. ≤800 chars. No headings. No tables.",
      },
      success_signal: {
        type: "string",
        description: "One short sentence (≤200 chars) with a production verb (write / record / submit / share / sketch / present etc.) telling the student what to produce.",
      },
    },
    required: ["framing", "task", "success_signal"],
  },
};

// ─── Anthropic call (tool_use enforced) ──────────────────────────────────

async function callSonnetTool(systemPrompt, userMessage) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL_SONNET,
      max_tokens: 1500,
      system: systemPrompt,
      tools: [TOOL],
      tool_choice: { type: "tool", name: TOOL.name },
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${text.slice(0, 400)}`);
  }

  const data = await res.json();

  // CLAUDE.md Lesson #39: stop_reason guard — fail loud on truncation
  if (data?.stop_reason && data.stop_reason !== "end_turn" && data.stop_reason !== "tool_use") {
    throw new Error(`Unexpected stop_reason: ${data.stop_reason} (expected end_turn or tool_use)`);
  }

  const toolBlock = (data?.content || []).find((b) => b.type === "tool_use" && b.name === TOOL.name);
  if (!toolBlock) {
    throw new Error(`No tool_use block named ${TOOL.name} in response: ${JSON.stringify(data).slice(0, 400)}`);
  }

  const { framing, task, success_signal } = toolBlock.input;
  if (!framing || !task || !success_signal) {
    throw new Error(`Missing fields in tool input: ${JSON.stringify(toolBlock.input).slice(0, 200)}`);
  }
  return { framing, task, success_signal };
}

// ─── v2 length-cap validation (warn, don't reject) ────────────────────────

function validateV2Shape(slots) {
  const warnings = [];
  if (slots.framing.length > 200) warnings.push(`framing ${slots.framing.length}>200`);
  if (slots.task.length > 800) warnings.push(`task ${slots.task.length}>800`);
  if (slots.success_signal.length > 200) warnings.push(`success_signal ${slots.success_signal.length}>200`);
  return warnings;
}

// ─── Main ─────────────────────────────────────────────────────────────────

function loadCache() {
  if (!existsSync(OUTPUT_PATH)) return {};
  try {
    return JSON.parse(readFileSync(OUTPUT_PATH, "utf-8"));
  } catch {
    return {};
  }
}

function saveCache(cache) {
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(cache, null, 2));
}

async function main() {
  const input = JSON.parse(readFileSync(INPUT_PATH, "utf-8"));
  const allKeys = Object.keys(input);
  const keys = LIMIT > 0 ? allKeys.slice(0, LIMIT) : allKeys;

  const cache = loadCache();
  const results = { ...cache };

  let processed = 0;
  let cached = 0;
  let warnings = 0;

  console.log(`Rewriting ${keys.length} of ${allKeys.length} Teaching Moves into v2 shape`);
  console.log(`  Mode: ${DRY_RUN ? "DRY-RUN (no cache write)" : "WRITE"}${FORCE ? " + FORCE re-process" : ""}`);
  console.log(`  Cache: ${Object.keys(cache).length} entries already in ${OUTPUT_PATH}`);
  console.log("");

  for (const key of keys) {
    const original = input[key];
    if (!original) {
      console.log(`  [skip] ${key} — not in input file`);
      continue;
    }

    if (cache[key] && !FORCE) {
      cached++;
      console.log(`  [cached] ${key}`);
      continue;
    }

    process.stdout.write(`  [processing] ${key}... `);
    const userMessage = `Original prompt:\n\n${original}\n\nNow emit the three v2 slot fields via the emit_v2_slots tool.`;

    try {
      const slots = await callSonnetTool(SYSTEM_PROMPT, userMessage);
      const ws = validateV2Shape(slots);
      if (ws.length > 0) {
        warnings++;
        console.log(`done (warnings: ${ws.join(", ")})`);
      } else {
        console.log("done");
      }
      results[key] = {
        framing: slots.framing,
        task: slots.task,
        success_signal: slots.success_signal,
        warnings: ws.length > 0 ? ws : undefined,
        rewritten_at: new Date().toISOString(),
      };
      processed++;
    } catch (err) {
      console.log(`FAILED — ${err.message}`);
    }

    // Tiny rate limit courtesy
    await new Promise((r) => setTimeout(r, 250));
  }

  console.log("");
  console.log(`Summary: ${processed} processed, ${cached} cached, ${warnings} with length warnings`);

  if (!DRY_RUN) {
    saveCache(results);
    console.log(`Cache written: ${OUTPUT_PATH}`);
  } else {
    console.log("DRY-RUN — cache NOT written. Sample of new entries:");
    for (const key of keys.slice(0, 3)) {
      if (results[key] && (!cache[key] || FORCE)) {
        console.log("");
        console.log(`--- ${key} ---`);
        console.log(JSON.stringify(results[key], null, 2));
      }
    }
  }
}

main().catch((err) => {
  console.error("Rewrite failed:", err);
  process.exit(1);
});
