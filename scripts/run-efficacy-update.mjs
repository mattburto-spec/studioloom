#!/usr/bin/env node

/**
 * Standalone CLI for running the efficacy batch + self-healing analysis.
 *
 * Usage:
 *   node scripts/run-efficacy-update.mjs [--teacher-id <UUID>] [--dry-run]
 *
 * Requires .env.local (or env vars) with:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Matt runs this manually until Phase 4 wires the scheduler.
 * Spec ref: §5.2 trigger
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

// Load env from .env.local
config({ path: resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Parse args ───

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
let teacherId = null;

const tidIdx = args.indexOf("--teacher-id");
if (tidIdx !== -1 && args[tidIdx + 1]) {
  teacherId = args[tidIdx + 1];
}

// ─── Inline implementations (avoid ts import issues in .mjs) ───

/**
 * Get blocks eligible for recomputation.
 */
async function getBlocks(tid) {
  let query = supabase
    .from("activity_blocks")
    .select("id, title, efficacy_score, time_weight")
    .gte("efficacy_score", 0);

  // If teacher ID provided, filter by units they own
  if (tid) {
    const { data: units } = await supabase
      .from("class_units")
      .select("id")
      .eq("author_teacher_id", tid);

    if (!units?.length) {
      console.log("No units found for teacher", tid);
      return [];
    }

    const unitIds = units.map((u) => u.id);
    query = query.in("unit_id", unitIds);
  }

  const { data, error } = await query.limit(500);
  if (error) throw error;
  return data ?? [];
}

/**
 * Get aggregated signals for a block. Simplified version that checks
 * generation_feedback for teacher edits and signal_breakdown.
 */
async function getSignals(blockId) {
  const { data: feedback } = await supabase
    .from("generation_feedback")
    .select("signal_type, signal_data")
    .eq("block_id", blockId);

  if (!feedback?.length) return null;

  // Aggregate from generation_feedback rows
  let keptCount = 0, totalTeacher = 0;
  let completionSum = 0, completionCount = 0;
  let timeAccSum = 0, timeObsCount = 0;
  let deletionCount = 0;
  let paceSum = 0, paceCount = 0;
  let editCount = 0;

  for (const row of feedback) {
    const d = row.signal_data || {};
    if (row.signal_type === "teacher_edit") {
      totalTeacher++;
      if (d.kept) keptCount++;
      if (d.deleted) deletionCount++;
      if (d.edited) editCount++;
    }
    if (row.signal_type === "student_completion") {
      completionCount++;
      if (d.completed) completionSum++;
    }
    if (row.signal_type === "time_observation") {
      timeObsCount++;
      timeAccSum += d.accuracy ?? 0;
    }
    if (row.signal_type === "pace_feedback") {
      paceCount++;
      paceSum += d.score ?? 0.5;
    }
  }

  const evidenceCount = feedback.length;
  if (evidenceCount < 3) return null;

  return {
    keptRate: totalTeacher > 0 ? keptCount / totalTeacher : 0.5,
    deletionRate: totalTeacher > 0 ? deletionCount / totalTeacher : 0,
    editRate: totalTeacher > 0 ? editCount / totalTeacher : 0,
    completionRate: completionCount > 0 ? completionSum / completionCount : 0.5,
    timeAccuracy: timeObsCount > 0 ? timeAccSum / timeObsCount : 0.5,
    paceScore: paceCount > 0 ? paceSum / paceCount : 0.5,
    evidenceCount,
    signalBreakdown: {
      teacherInteractions: totalTeacher,
      studentCompletions: completionCount,
      timeObservations: timeObsCount,
      paceFeedbackCount: paceCount,
    },
  };
}

function computeScore(s) {
  const raw =
    0.3 * s.keptRate +
    0.25 * s.completionRate +
    0.2 * s.timeAccuracy +
    0.1 * (1 - s.deletionRate) +
    0.1 * s.paceScore +
    0.05 * (1 - s.editRate);
  return Math.round(raw * 100 * 10) / 10;
}

function clamp(score) {
  return Math.max(10, Math.min(95, score));
}

// ─── Main ───

async function main() {
  console.log(`\n🔄 Efficacy Batch Update${dryRun ? " (DRY RUN)" : ""}`);
  console.log(`   Teacher: ${teacherId || "all"}\n`);

  const blocks = await getBlocks(teacherId);
  console.log(`Found ${blocks.length} blocks to evaluate\n`);

  let proposals = 0;
  let skipped = 0;

  for (const block of blocks) {
    const signals = await getSignals(block.id);
    if (!signals) {
      skipped++;
      continue;
    }

    const proposed = clamp(computeScore(signals));
    const delta = proposed - block.efficacy_score;

    if (Math.abs(delta) < 1) {
      skipped++;
      continue;
    }

    console.log(
      `  📊 ${block.title.substring(0, 40).padEnd(40)} ` +
      `${block.efficacy_score} → ${proposed} (${delta > 0 ? "+" : ""}${delta.toFixed(1)}) ` +
      `[${signals.evidenceCount} evidence]`
    );

    if (!dryRun) {
      // Check for existing pending or recent rejection
      const { data: existing } = await supabase
        .from("feedback_proposals")
        .select("id")
        .eq("block_id", block.id)
        .eq("field", "efficacy_score")
        .eq("status", "pending")
        .maybeSingle();

      if (existing) {
        console.log(`     ⏭️  Already has pending proposal`);
        continue;
      }

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: rejected } = await supabase
        .from("feedback_proposals")
        .select("id")
        .eq("block_id", block.id)
        .eq("field", "efficacy_score")
        .eq("status", "rejected")
        .gte("updated_at", sevenDaysAgo)
        .maybeSingle();

      if (rejected) {
        console.log(`     ⏭️  Recently rejected (7-day suppression)`);
        continue;
      }

      const { error } = await supabase.from("feedback_proposals").insert({
        block_id: block.id,
        proposal_type: "efficacy_adjustment",
        field: "efficacy_score",
        current_value: block.efficacy_score,
        proposed_value: proposed,
        evidence_count: signals.evidenceCount,
        evidence_summary: `${signals.signalBreakdown.teacherInteractions} teacher edits, ${signals.signalBreakdown.studentCompletions} completions, ${signals.signalBreakdown.timeObservations} time obs`,
        signal_breakdown: signals.signalBreakdown,
        reasoning: {
          keptRate: signals.keptRate,
          completionRate: signals.completionRate,
          timeAccuracy: signals.timeAccuracy,
          deletionRate: signals.deletionRate,
          paceScore: signals.paceScore,
          editRate: signals.editRate,
        },
        requires_manual_approval: signals.evidenceCount < 8 || Math.abs(delta) > 15,
        guardrail_flags: Math.abs(delta) > 15 ? [`Large delta: ${delta.toFixed(1)}`] : [],
        status: "pending",
      });

      if (error) {
        console.error(`     ❌ Insert failed:`, error.message);
      }
    }

    proposals++;
  }

  console.log(`\n✅ Done: ${proposals} proposals created, ${skipped} blocks skipped`);
  if (dryRun) console.log("   (dry run — nothing written to database)");
  console.log();
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
