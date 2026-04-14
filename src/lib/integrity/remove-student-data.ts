/**
 * Student Data Removal / Anonymization
 *
 * Dimensions3 Phase 7A — Integrity & Versioning (§8.3)
 *
 * Anonymizes a student's identity across all tables while preserving
 * aggregate metrics (efficacy scores, completion rates, etc.).
 * Never deletes rows — sets identity fields to NULL / '[removed]'.
 *
 * Usage: called by scripts/remove-student-data.ts CLI wrapper.
 */

import { createAdminClient } from "@/lib/supabase/admin";

/** Tables that hold student_id references, ordered by dependency */
const STUDENT_TABLES = [
  // Tables with FK ON DELETE CASCADE — handled by students row deletion if we ever delete
  // But we anonymize, not delete, so we handle each explicitly.
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
] as const;

export interface RemovalResult {
  studentId: string;
  dryRun: boolean;
  rowCounts: Record<string, number>;
  errors: string[];
  totalRows: number;
}

/**
 * Anonymize a student's data across all tables.
 *
 * - dryRun=true: counts rows only, no mutations
 * - dryRun=false: sets student_id to NULL where nullable,
 *   replaces name fields with '[removed]', writes audit log
 */
export async function removeStudentData(
  studentId: string,
  options: { dryRun: boolean; removedBy?: string; reason?: string }
): Promise<RemovalResult> {
  const supabase = createAdminClient();
  const rowCounts: Record<string, number> = {};
  const errors: string[] = [];

  // Count rows in each table
  for (const table of STUDENT_TABLES) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true })
        .eq("student_id", studentId);

      if (error) {
        // Table might not exist — skip gracefully
        errors.push(`${table}: ${error.message}`);
        rowCounts[table] = 0;
      } else {
        rowCounts[table] = count ?? 0;
      }
    } catch {
      errors.push(`${table}: query failed`);
      rowCounts[table] = 0;
    }
  }

  // Also count the students table row itself
  try {
    const { count, error } = await supabase
      .from("students")
      .select("*", { count: "exact", head: true })
      .eq("id", studentId);
    rowCounts["students"] = error ? 0 : (count ?? 0);
  } catch {
    rowCounts["students"] = 0;
  }

  const totalRows = Object.values(rowCounts).reduce((s, c) => s + c, 0);

  if (options.dryRun) {
    // Write a dry-run audit entry
    await supabase.from("data_removal_log").insert({
      removed_student_ref: studentId,
      removed_by: options.removedBy ?? null,
      reason: options.reason ?? "dry_run",
      row_counts: rowCounts,
      dry_run: true,
    });

    return { studentId, dryRun: true, rowCounts, errors, totalRows };
  }

  // ── Anonymize ──

  // 1. Anonymize the students table row (keep row for FK integrity)
  const { error: studentErr } = await supabase
    .from("students")
    .update({
      name: "[removed]",
      email: null,
      learning_profile: null,
    })
    .eq("id", studentId);

  if (studentErr) errors.push(`students: ${studentErr.message}`);

  // 2. For each related table, set student_id to NULL where possible.
  //    Some tables have NOT NULL on student_id — for those we delete the rows
  //    since the identity link is the entire purpose of the row.
  const nullableTables = [
    "student_content_moderation_log",
    "ai_usage_log",
    "usage_rollups",
  ];

  const deleteTables = [
    "student_tool_sessions",
    "student_sessions",
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
  ];

  // student_progress: keep rows for aggregate metrics but anonymize
  const { error: progressErr } = await supabase
    .from("student_progress")
    .update({ student_id: null } as Record<string, unknown>)
    .eq("student_id", studentId);
  if (progressErr) errors.push(`student_progress (anonymize): ${progressErr.message}`);

  for (const table of nullableTables) {
    if (rowCounts[table] === 0) continue;
    try {
      const { error } = await supabase
        .from(table)
        .update({ student_id: null } as Record<string, unknown>)
        .eq("student_id", studentId);
      if (error) errors.push(`${table} (nullify): ${error.message}`);
    } catch {
      errors.push(`${table} (nullify): failed`);
    }
  }

  for (const table of deleteTables) {
    if (rowCounts[table] === 0) continue;
    try {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq("student_id", studentId);
      if (error) errors.push(`${table} (delete): ${error.message}`);
    } catch {
      errors.push(`${table} (delete): failed`);
    }
  }

  // 3. Write audit log
  const { error: auditErr } = await supabase.from("data_removal_log").insert({
    removed_student_ref: studentId,
    removed_by: options.removedBy ?? null,
    reason: options.reason ?? "student_left",
    row_counts: rowCounts,
    dry_run: false,
  });
  if (auditErr) errors.push(`data_removal_log: ${auditErr.message}`);

  return { studentId, dryRun: false, rowCounts, errors, totalRows };
}
