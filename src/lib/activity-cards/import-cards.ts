/**
 * Import script: loads activity cards from a JSON file into the database.
 *
 * Usage:
 *   npx tsx src/lib/activity-cards/import-cards.ts path/to/cards.json
 *
 * The JSON file should contain an array of card objects matching the format
 * from the Gemini generation prompt (docs/gemini-activity-cards-prompt.md).
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional: VOYAGE_API_KEY (for generating embeddings)
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local manually (no dotenv dependency needed)
function loadEnv(filename: string) {
  try {
    const content = readFileSync(resolve(process.cwd(), filename), "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  } catch { /* file not found — skip */ }
}
loadEnv(".env.local");
loadEnv(".env");

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY || "";

// ---------------------------------------------------------------------------
// Voyage AI embedding helper
// ---------------------------------------------------------------------------

async function getEmbedding(text: string): Promise<number[] | null> {
  if (!VOYAGE_API_KEY) return null;

  try {
    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${VOYAGE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "voyage-3.5",
        input: text,
        input_type: "document",
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.warn(`  ⚠ Embedding failed (${res.status}): ${err}`);
      return null;
    }

    const data = await res.json();
    return data.data?.[0]?.embedding || null;
  } catch (err) {
    console.warn("  ⚠ Embedding request failed:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npx tsx src/lib/activity-cards/import-cards.ts <path-to-cards.json>");
    process.exit(1);
  }

  const absolutePath = resolve(process.cwd(), filePath);
  console.log(`\n📂 Reading cards from: ${absolutePath}\n`);

  let rawCards: Record<string, unknown>[];
  try {
    const content = readFileSync(absolutePath, "utf-8");
    rawCards = JSON.parse(content);
    if (!Array.isArray(rawCards)) {
      console.error("JSON file must contain an array of card objects.");
      process.exit(1);
    }
  } catch (err) {
    console.error("Failed to read/parse JSON file:", err);
    process.exit(1);
  }

  console.log(`Found ${rawCards.length} cards to import.\n`);

  let inserted = 0;
  let skipped = 0;
  let embeddings = 0;
  let errors = 0;

  for (const raw of rawCards) {
    const slug = raw.slug as string;
    const name = raw.name as string;

    if (!slug || !name) {
      console.log(`  ✗ Skipping card with missing slug or name`);
      errors++;
      continue;
    }

    // Check if slug already exists
    const { data: existing } = await supabase
      .from("activity_cards")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (existing) {
      console.log(`  ⏭ ${name} (${slug}) — already exists, skipping`);
      skipped++;
      continue;
    }

    // Generate embedding
    const embeddingText = `${name}: ${raw.description || ""}`;
    const embedding = await getEmbedding(embeddingText);
    if (embedding) embeddings++;

    // Insert card
    const { error } = await supabase.from("activity_cards").insert({
      slug,
      name,
      description: raw.description || "",
      category: raw.category || "design-thinking",
      criteria: (raw.criteria as string[]) || [],
      phases: (raw.phases as string[]) || [],
      thinking_type: raw.thinking_type || null,
      duration_minutes: raw.duration_minutes || null,
      group_size: raw.group_size || null,
      materials: (raw.materials as string[]) || [],
      tools: (raw.tools as string[]) || [],
      resources_needed: raw.resources_needed || null,
      teacher_notes: raw.teacher_notes || null,
      template: raw.template || { sections: [] },
      ai_hints: raw.ai_hints || { whenToUse: "", topicAdaptation: "", modifierAxes: [] },
      curriculum_frameworks: (raw.curriculum_frameworks as string[]) || [],
      source: (raw.source as string) || "system",
      is_public: true,
      embedding: embedding ? `[${embedding.join(",")}]` : null,
    });

    if (error) {
      console.log(`  ✗ ${name} (${slug}) — error: ${error.message}`);
      errors++;
    } else {
      console.log(`  ✓ ${name} (${slug})${embedding ? " 🧠" : ""}`);
      inserted++;
    }

    // Rate limit delay for Voyage API
    if (VOYAGE_API_KEY) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Inserted:   ${inserted}
  Skipped:    ${skipped}
  Errors:     ${errors}
  Embeddings: ${embeddings}/${inserted}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

main().catch(console.error);
