/**
 * Standalone CLI for the efficacy batch.
 * Single source of truth — imports library functions directly.
 *
 * Usage: ./node_modules/.bin/tsx scripts/run-efficacy-update.ts [--teacher-id UUID] [--dry-run]
 */

import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { runEfficacyBatch, efficacyToProposals } from "../src/lib/feedback/efficacy";
import { getBlockUsageStats } from "../src/lib/feedback/signals";
import { analyzeSelfHealing, healingToProposals } from "../src/lib/feedback/self-healing";

config({ path: resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const tidIdx = args.indexOf("--teacher-id");
const teacherId = tidIdx !== -1 ? args[tidIdx + 1] : null;

async function main() {
  console.log(`\n🔄 Efficacy Batch${dryRun ? " (DRY RUN)" : ""}`);
  console.log(`   Teacher: ${teacherId || "all"}\n`);

  if (!teacherId) {
    console.error("--teacher-id required");
    process.exit(1);
  }

  // Run efficacy + self-healing (same logic as POST /api/admin/feedback)
  const efficacyResults = await runEfficacyBatch(supabase, teacherId);
  const efficacyRows = efficacyToProposals(efficacyResults);

  const blocks = await getBlockUsageStats(supabase, teacherId);
  const healingProposals = analyzeSelfHealing(blocks);
  const healingRows = healingToProposals(healingProposals);

  const allRows = [...efficacyRows, ...healingRows];
  console.log(`Computed: ${efficacyResults.length} efficacy, ${healingProposals.length} self-healing`);

  if (dryRun) {
    for (const row of allRows) {
      console.log(`  📊 ${row.block_id.slice(0, 8)} | ${row.field}: ${row.current_value} → ${row.proposed_value}`);
    }
    console.log(`\n✅ Dry run complete — ${allRows.length} proposals would be created\n`);
    return;
  }

  let inserted = 0;
  for (const row of allRows) {
    // Same dedup + 7-day rejection suppression as POST handler
    const { data: existing } = await supabase
      .from("feedback_proposals")
      .select("id")
      .eq("block_id", row.block_id)
      .eq("field", row.field)
      .eq("status", "pending")
      .maybeSingle();
    if (existing) continue;

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: rejected } = await supabase
      .from("feedback_proposals")
      .select("id")
      .eq("block_id", row.block_id)
      .eq("field", row.field)
      .eq("status", "rejected")
      .gte("updated_at", sevenDaysAgo)
      .maybeSingle();
    if (rejected) continue;

    await supabase.from("feedback_proposals").insert(row);
    inserted++;
  }

  console.log(`\n✅ Done: ${inserted} proposals inserted\n`);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
