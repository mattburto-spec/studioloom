#!/usr/bin/env npx tsx
/**
 * Student Data Removal CLI
 *
 * Dimensions3 Phase 7A — Integrity & Versioning (§8.3)
 *
 * Usage:
 *   npx tsx scripts/remove-student-data.ts --student <uuid> --dry-run
 *   npx tsx scripts/remove-student-data.ts --student <uuid> --confirm --reason "gdpr_request"
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env
 */

import "dotenv/config";

// Inline the removal logic to avoid Next.js module resolution issues in scripts
import { createClient } from "@supabase/supabase-js";

const STUDENT_TABLES = [
  "student_content_moderation_log",
  "student_tool_sessions",
  "student_sessions",
  "student_progress",
  "student_badges",
  "safety_certifications",
  "quest_journeys",
  "portfolio_entries",
  "planning_tasks",
  "open_studio_status",
  "open_studio_sessions",
  "open_studio_profiles",
  "gallery_submissions",
  "discovery_sessions",
  "design_conversations",
  "competency_assessments",
  "assessment_records",
  "class_students",
  "ai_usage_log",
  "usage_rollups",
];

async function main() {
  const args = process.argv.slice(2);
  const studentIdx = args.indexOf("--student");
  const isDryRun = args.includes("--dry-run");
  const isConfirm = args.includes("--confirm");
  const reasonIdx = args.indexOf("--reason");

  if (studentIdx === -1 || !args[studentIdx + 1]) {
    console.error("Usage: npx tsx scripts/remove-student-data.ts --student <uuid> [--dry-run | --confirm] [--reason <reason>]");
    process.exit(1);
  }

  const studentId = args[studentIdx + 1];
  const reason = reasonIdx !== -1 ? args[reasonIdx + 1] : "student_left";

  if (!isDryRun && !isConfirm) {
    console.error("Must specify either --dry-run or --confirm");
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`\n${ isDryRun ? "🔍 DRY RUN" : "⚠️  CONFIRM MODE"} — Student: ${studentId}\n`);

  // Count rows per table
  const rowCounts: Record<string, number> = {};
  for (const table of STUDENT_TABLES) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true })
        .eq("student_id", studentId);
      rowCounts[table] = error ? 0 : (count ?? 0);
      if (error) console.warn(`  ⚠ ${table}: ${error.message}`);
    } catch {
      rowCounts[table] = 0;
    }
  }

  // Students table
  const { count: studentCount } = await supabase
    .from("students")
    .select("*", { count: "exact", head: true })
    .eq("id", studentId);
  rowCounts["students"] = studentCount ?? 0;

  // Print summary
  const total = Object.values(rowCounts).reduce((s, c) => s + c, 0);
  console.log("Row counts:");
  for (const [table, count] of Object.entries(rowCounts)) {
    if (count > 0) console.log(`  ${table}: ${count}`);
  }
  console.log(`\nTotal rows affected: ${total}`);

  if (total === 0) {
    console.log("\nNo data found for this student. Nothing to do.");
    process.exit(0);
  }

  if (isDryRun) {
    // Log dry run
    await supabase.from("data_removal_log").insert({
      removed_student_ref: studentId,
      reason,
      row_counts: rowCounts,
      dry_run: true,
    });
    console.log("\n✅ Dry run complete. No data was modified.\n");
    process.exit(0);
  }

  // ── Confirm mode: actually anonymize ──
  console.log("\n🔴 Anonymizing student data...\n");
  const errors: string[] = [];

  // Anonymize students row
  const { error: sErr } = await supabase
    .from("students")
    .update({ name: "[removed]", email: null, learning_profile: null })
    .eq("id", studentId);
  if (sErr) errors.push(`students: ${sErr.message}`);
  else console.log("  ✓ students: anonymized");

  // Anonymize student_progress (keep for aggregate metrics)
  if (rowCounts["student_progress"] > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase
      .from("student_progress")
      .update({ student_id: null } as any)
      .eq("student_id", studentId);
    if (error) errors.push(`student_progress: ${error.message}`);
    else console.log("  ✓ student_progress: student_id nullified");
  }

  // Nullify student_id in tables where it's nullable
  for (const table of ["student_content_moderation_log", "ai_usage_log", "usage_rollups"]) {
    if (rowCounts[table] === 0) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from(table).update({ student_id: null } as any).eq("student_id", studentId);
    if (error) errors.push(`${table}: ${error.message}`);
    else console.log(`  ✓ ${table}: student_id nullified`);
  }

  // Delete rows from identity-purpose tables
  const deleteTables = STUDENT_TABLES.filter(
    (t) => !["student_content_moderation_log", "ai_usage_log", "usage_rollups", "student_progress"].includes(t)
  );
  for (const table of deleteTables) {
    if (rowCounts[table] === 0) continue;
    const { error } = await supabase.from(table).delete().eq("student_id", studentId);
    if (error) errors.push(`${table}: ${error.message}`);
    else console.log(`  ✓ ${table}: ${rowCounts[table]} rows deleted`);
  }

  // Write audit log
  await supabase.from("data_removal_log").insert({
    removed_student_ref: studentId,
    reason,
    row_counts: rowCounts,
    dry_run: false,
  });

  if (errors.length > 0) {
    console.log("\n⚠️  Errors encountered:");
    errors.forEach((e) => console.log(`  - ${e}`));
  }

  console.log(`\n✅ Student data removal complete. ${total} rows affected.\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
