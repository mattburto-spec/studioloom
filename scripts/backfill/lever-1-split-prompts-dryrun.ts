/**
 * Lever 1 sub-phase 1C — DRY-RUN backfill report.
 *
 * Reads every activity_blocks row from prod, runs the splitPrompt
 * heuristic on its `prompt`, aggregates stats per author + globally,
 * and writes a markdown report to:
 *
 *   docs/projects/lesson-quality-lever-1-backfill-dryrun.md
 *
 * READ-ONLY. Does not modify the database. Safe to run any number of
 * times.
 *
 * Brief: docs/projects/lesson-quality-lever-1-slot-fields.md
 *
 * USAGE:
 *   npx tsx scripts/backfill/lever-1-split-prompts-dryrun.ts
 *
 * REQUIRES env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * VERIFICATION GATE (per brief):
 *   - Report shows ≤25% needs_review per author. STOP if higher.
 *   - 10 sample splits printed verbatim so Matt can eyeball quality.
 *   - Distinct fingerprint count matches pre-1B baseline (62 expected).
 *     We do NOT recompute fingerprints in 1C — this row is just a
 *     guard that we read back the same value we baselined in 1B.
 */

import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { splitPrompt, type PromptSplit } from "../../src/lib/lever-1/split-prompt-heuristic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface ActivityBlockRow {
  id: string;
  teacher_id: string | null;
  title: string;
  prompt: string;
  source_type: string;
  content_fingerprint: string | null;
  created_at: string;
}

interface PerAuthorStats {
  teacher_id: string;
  total: number;
  clean: number;
  needs_review: number;
  reasons: Record<string, number>;
}

interface ScoredRow {
  row: ActivityBlockRow;
  split: PromptSplit;
}

async function main() {
  console.log("Loading all activity_blocks rows from prod...");

  const { data: rows, error } = await supabase
    .from("activity_blocks")
    .select(
      "id, teacher_id, title, prompt, source_type, content_fingerprint, created_at"
    )
    .eq("is_archived", false)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to load activity_blocks:", error);
    process.exit(1);
  }

  if (!rows || rows.length === 0) {
    console.error("No activity_blocks rows returned. Check env / RLS.");
    process.exit(1);
  }

  console.log(`Loaded ${rows.length} rows. Running heuristic...`);

  const scored: ScoredRow[] = (rows as ActivityBlockRow[]).map((row) => ({
    row,
    split: splitPrompt(row.prompt),
  }));

  // Fingerprint stability guard
  const distinctFingerprints = new Set(
    rows
      .map((r) => (r as ActivityBlockRow).content_fingerprint)
      .filter((f): f is string => f !== null)
  ).size;

  // Global counters
  const total = scored.length;
  const clean = scored.filter((s) => !s.split.needs_review).length;
  const needsReview = total - clean;
  const cleanPct = total > 0 ? Math.round((clean / total) * 100) : 0;
  const needsReviewPct = 100 - cleanPct;

  // Reasons breakdown
  const reasonCounts: Record<string, number> = {};
  for (const s of scored) {
    if (s.split.needs_review && s.split.reason) {
      reasonCounts[s.split.reason] = (reasonCounts[s.split.reason] || 0) + 1;
    }
  }

  // Per-author breakdown
  const perAuthor = new Map<string, PerAuthorStats>();
  for (const s of scored) {
    const tid = s.row.teacher_id || "<null>";
    let stats = perAuthor.get(tid);
    if (!stats) {
      stats = {
        teacher_id: tid,
        total: 0,
        clean: 0,
        needs_review: 0,
        reasons: {},
      };
      perAuthor.set(tid, stats);
    }
    stats.total++;
    if (s.split.needs_review) {
      stats.needs_review++;
      if (s.split.reason) {
        stats.reasons[s.split.reason] = (stats.reasons[s.split.reason] || 0) + 1;
      }
    } else {
      stats.clean++;
    }
  }

  // Char count distributions for clean splits
  const cleanSplits = scored.filter((s) => !s.split.needs_review);
  const framingLens = cleanSplits.map((s) => (s.split.framing || "").length);
  const taskLens = cleanSplits.map((s) => (s.split.task || "").length);
  const signalLens = cleanSplits.map(
    (s) => (s.split.success_signal || "").length
  );

  function stats(arr: number[]) {
    if (arr.length === 0) return { min: 0, median: 0, p90: 0, max: 0 };
    const sorted = [...arr].sort((a, b) => a - b);
    return {
      min: sorted[0],
      median: sorted[Math.floor(sorted.length / 2)],
      p90: sorted[Math.floor(sorted.length * 0.9)],
      max: sorted[sorted.length - 1],
    };
  }
  const fStats = stats(framingLens);
  const tStats = stats(taskLens);
  const sStats = stats(signalLens);

  // V2 cap violations within clean splits
  const fOver = framingLens.filter((n) => n > 200).length;
  const tOver = taskLens.filter((n) => n > 800).length;
  const sOver = signalLens.filter((n) => n > 200).length;

  // 10 random sample splits from clean + 5 from needs_review (or all if fewer)
  function sample<T>(arr: T[], n: number): T[] {
    if (arr.length <= n) return arr;
    const out: T[] = [];
    const used = new Set<number>();
    while (out.length < n && used.size < arr.length) {
      const i = Math.floor(Math.random() * arr.length);
      if (used.has(i)) continue;
      used.add(i);
      out.push(arr[i]);
    }
    return out;
  }
  const cleanSamples = sample(cleanSplits, 10);
  const needsReviewSamples = sample(
    scored.filter((s) => s.split.needs_review),
    5
  );

  // Write report
  const reportPath = join(
    process.cwd(),
    "docs/projects/lesson-quality-lever-1-backfill-dryrun.md"
  );

  const lines: string[] = [];
  lines.push("# Lever 1 sub-phase 1C — Backfill DRY-RUN report");
  lines.push("");
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push(
    `**Source:** \`scripts/backfill/lever-1-split-prompts-dryrun.ts\` (read-only)`
  );
  lines.push(
    `**Brief:** [lesson-quality-lever-1-slot-fields.md](lesson-quality-lever-1-slot-fields.md)`
  );
  lines.push("");
  lines.push(`---`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- **Total rows scanned:** ${total}`);
  lines.push(`- **Distinct fingerprints:** ${distinctFingerprints} (must match pre-1B baseline of 62)`);
  lines.push(`- **Clean splits:** ${clean} (${cleanPct}%)`);
  lines.push(`- **needs_review:** ${needsReview} (${needsReviewPct}%)`);
  lines.push("");
  lines.push(
    `**Stop trigger:** ≥25% needs_review per the brief. Currently ${needsReviewPct}% — ${
      needsReviewPct < 25 ? "✅ within budget" : "🚨 STOP, iterate the heuristic"
    }.`
  );
  lines.push("");
  lines.push("## needs_review breakdown by reason");
  lines.push("");
  if (Object.keys(reasonCounts).length === 0) {
    lines.push("_No needs_review rows._");
  } else {
    lines.push("| Reason | Count |");
    lines.push("|---|---|");
    for (const [reason, count] of Object.entries(reasonCounts).sort(
      (a, b) => b[1] - a[1]
    )) {
      lines.push(`| ${reason} | ${count} |`);
    }
  }
  lines.push("");
  lines.push("## Per-author breakdown");
  lines.push("");
  lines.push("| Author (teacher_id prefix) | Total | Clean | needs_review | % needs_review |");
  lines.push("|---|---|---|---|---|");
  for (const stats of [...perAuthor.values()].sort((a, b) => b.total - a.total)) {
    const tidShort = stats.teacher_id === "<null>" ? "(null)" : stats.teacher_id.slice(0, 8);
    const pct = stats.total > 0 ? Math.round((stats.needs_review / stats.total) * 100) : 0;
    lines.push(
      `| \`${tidShort}\` | ${stats.total} | ${stats.clean} | ${stats.needs_review} | ${pct}% |`
    );
  }
  lines.push("");
  lines.push("## Char count distribution (clean splits only)");
  lines.push("");
  lines.push("| Slot | Min | Median | p90 | Max | Cap | Violations |");
  lines.push("|---|---|---|---|---|---|---|");
  lines.push(`| framing | ${fStats.min} | ${fStats.median} | ${fStats.p90} | ${fStats.max} | 200 | ${fOver} |`);
  lines.push(`| task | ${tStats.min} | ${tStats.median} | ${tStats.p90} | ${tStats.max} | 800 | ${tOver} |`);
  lines.push(`| success_signal | ${sStats.min} | ${sStats.median} | ${sStats.p90} | ${sStats.max} | 200 | ${sOver} |`);
  lines.push("");
  lines.push("Cap violations are **informational** — Lever 1 does not enforce the v2 length caps on backfilled rows. Teachers tune oversize splits in the editor on their own time. Lever 2 lints will surface them.");
  lines.push("");
  lines.push("## Sample clean splits (10)");
  lines.push("");
  for (const [i, s] of cleanSamples.entries()) {
    lines.push(`### Sample ${i + 1} — \`${s.row.title}\` (id \`${s.row.id.slice(0, 8)}\`)`);
    lines.push("");
    lines.push(`**Original prompt** (${s.row.prompt.length} chars):`);
    lines.push("");
    lines.push("> " + s.row.prompt.replace(/\n/g, "\n> ").slice(0, 600) + (s.row.prompt.length > 600 ? "…" : ""));
    lines.push("");
    lines.push(`**Split:**`);
    lines.push("");
    lines.push(`- **framing** (${(s.split.framing || "").length} chars): ${s.split.framing || "_(null)_"}`);
    lines.push(`- **task** (${(s.split.task || "").length} chars): ${(s.split.task || "_(null)_").slice(0, 400)}${(s.split.task || "").length > 400 ? "…" : ""}`);
    lines.push(`- **success_signal** (${(s.split.success_signal || "").length} chars): ${s.split.success_signal || "_(null)_"}`);
    lines.push("");
  }
  lines.push("## Sample needs_review (5)");
  lines.push("");
  if (needsReviewSamples.length === 0) {
    lines.push("_No needs_review rows to sample._");
  } else {
    for (const [i, s] of needsReviewSamples.entries()) {
      lines.push(`### needs_review ${i + 1} — \`${s.row.title}\` (id \`${s.row.id.slice(0, 8)}\`, reason \`${s.split.reason}\`)`);
      lines.push("");
      lines.push(`**Original prompt** (${s.row.prompt.length} chars):`);
      lines.push("");
      lines.push("> " + s.row.prompt.replace(/\n/g, "\n> ").slice(0, 600) + (s.row.prompt.length > 600 ? "…" : ""));
      lines.push("");
      lines.push(`**Best-effort split** (preserved for teacher review in editor):`);
      lines.push("");
      lines.push(`- **framing**: ${s.split.framing || "_(null)_"}`);
      lines.push(`- **task**: ${(s.split.task || "_(null)_").slice(0, 400)}${(s.split.task || "").length > 400 ? "…" : ""}`);
      lines.push(`- **success_signal**: ${s.split.success_signal || "_(null)_"}`);
      lines.push("");
    }
  }
  lines.push("---");
  lines.push("");
  lines.push("## Apply this backfill");
  lines.push("");
  lines.push("After Matt reviews this report and signs off:");
  lines.push("");
  lines.push("```");
  lines.push("npx tsx scripts/backfill/lever-1-split-prompts-apply.ts");
  lines.push("```");
  lines.push("");
  lines.push("The apply script:");
  lines.push("- Re-reads all rows + re-runs the same heuristic (idempotent)");
  lines.push("- UPDATEs `framing`, `task`, `success_signal`, `backfill_needs_review` on each row");
  lines.push("- DOES NOT touch `prompt`, `content_fingerprint`, or any other column");
  lines.push("- Prints a per-row diff before writing");

  writeFileSync(reportPath, lines.join("\n"), "utf-8");

  console.log("");
  console.log(`Report written: ${reportPath}`);
  console.log("");
  console.log(`Total: ${total} | Clean: ${clean} (${cleanPct}%) | needs_review: ${needsReview} (${needsReviewPct}%)`);
  console.log(`Distinct fingerprints: ${distinctFingerprints} (expected 62)`);
  console.log("");
  if (needsReviewPct >= 25) {
    console.log("🚨 STOP TRIGGER FIRED: ≥25% needs_review. Iterate the heuristic before applying.");
    process.exit(2);
  } else {
    console.log("✅ Within budget. Hand the report to Matt for review before applying.");
  }
}

main().catch((err) => {
  console.error("Dry-run failed:", err);
  process.exit(1);
});
