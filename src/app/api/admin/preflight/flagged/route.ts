/**
 * GET /api/admin/preflight/flagged
 *
 * Preflight Pilot Mode P3 — dev review surface for Matt-as-developer.
 *
 * Returns up to 200 fabrication_jobs rows that the scanner flagged
 * (block/warn rule counts > 0) OR that the student bypassed via
 * Pilot Mode override (pilot_override_at NOT NULL). Cross-school —
 * unlike the teacher queue, this surface is for ruleset triage.
 *
 * Auth: platform admin only (`requirePlatformAdmin`). Today's
 * `is_platform_admin` flag is set on Matt's Gmail account; no other
 * user can hit this endpoint.
 *
 * Cache: private, no-cache, no-store.
 *
 * Response 200: { rows: FlaggedJobRow[], total: number }
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  FABRICATION_UPLOAD_BUCKET,
  FABRICATION_THUMBNAIL_BUCKET,
} from "@/lib/fabrication/orchestration";

const NO_CACHE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate",
} as const;

const FLAGGED_LIMIT = 200;
const SIGNED_URL_TTL_SECONDS = 10 * 60; // 10 min — enough for triage browsing

export interface FlaggedJobRow {
  jobId: string;
  jobStatus: string;
  studentName: string;
  className: string | null;
  schoolId: string | null;
  teacherId: string;
  machineLabel: string;
  machineCategory: string | null;
  currentRevision: number;
  originalFilename: string;
  ruleCounts: { block: number; warn: number; fyi: number };
  ruleIds: string[];
  pilotOverrideAt: string | null;
  pilotOverrideRuleIds: string[];
  thumbnailUrl: string | null;
  /** Signed download URL for the original uploaded file. 10-min TTL. */
  downloadUrl: string | null;
  createdAt: string;
}

export async function GET(request: NextRequest) {
  const auth = await requirePlatformAdmin(request);
  if (auth.error) return auth.error;

  const db = createAdminClient();

  // Two queries OR'd at the SQL level via PostgREST `or=()` filter:
  //   - pilot_override_at NOT NULL, OR
  //   - latest revision had block/warn rules
  // The rule-count predicate doesn't translate cleanly to a SQL filter
  // (scan_results JSONB → array length per severity), so we over-fetch
  // recent jobs and filter in TS. Cap at 4× FLAGGED_LIMIT to keep the
  // worst-case set bounded (~800 rows scanned, returning 200).
  const { data, error } = await db
    .from("fabrication_jobs")
    .select(
      `
      id, status, current_revision, created_at, original_filename,
      teacher_id, class_id, school_id,
      pilot_override_at, pilot_override_rule_ids,
      students(display_name, username),
      classes(name),
      machine_profiles(name, machine_category),
      fabrication_job_revisions(revision_number, thumbnail_path, scan_results, storage_path)
      `
    )
    .order("created_at", { ascending: false })
    .limit(FLAGGED_LIMIT * 4);

  if (error) {
    return NextResponse.json(
      { error: `Flagged jobs lookup failed: ${error.message}` },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }

  type RawRow = {
    id: string;
    status: string;
    current_revision: number;
    created_at: string;
    original_filename: string;
    teacher_id: string;
    class_id: string | null;
    school_id: string | null;
    pilot_override_at: string | null;
    pilot_override_rule_ids: string[] | null;
    students:
      | { display_name: string | null; username: string | null }
      | { display_name: string | null; username: string | null }[]
      | null;
    classes: { name: string | null } | { name: string | null }[] | null;
    machine_profiles:
      | { name: string | null; machine_category: string | null }
      | { name: string | null; machine_category: string | null }[]
      | null;
    fabrication_job_revisions:
      | Array<{
          revision_number: number;
          thumbnail_path: string | null;
          scan_results: {
            rules?: Array<{ id?: string; severity?: string }> | null;
          } | null;
          storage_path: string | null;
        }>
      | null;
  };

  const rows = (data ?? []) as RawRow[];

  // Build the flagged set client-side. Same array-or-object defensive
  // pattern as teacher-orchestration.
  const flagged: FlaggedJobRow[] = [];
  for (const raw of rows) {
    const latestRev = (raw.fabrication_job_revisions ?? []).find(
      (r) => r.revision_number === raw.current_revision
    );

    const counts = { block: 0, warn: 0, fyi: 0 };
    const ruleIds: string[] = [];
    for (const rule of latestRev?.scan_results?.rules ?? []) {
      if (rule.severity === "block") counts.block++;
      else if (rule.severity === "warn") counts.warn++;
      else if (rule.severity === "fyi") counts.fyi++;
      if (rule.id) ruleIds.push(rule.id);
    }

    const hasFindings = counts.block > 0 || counts.warn > 0;
    const hasOverride = raw.pilot_override_at !== null;
    if (!hasFindings && !hasOverride) continue;

    const studentRow = Array.isArray(raw.students) ? raw.students[0] : raw.students;
    const classRow = Array.isArray(raw.classes) ? raw.classes[0] : raw.classes;
    const machineRow = Array.isArray(raw.machine_profiles)
      ? raw.machine_profiles[0]
      : raw.machine_profiles;

    let thumbnailUrl: string | null = null;
    if (latestRev?.thumbnail_path) {
      const signed = await db.storage
        .from(FABRICATION_THUMBNAIL_BUCKET)
        .createSignedUrl(latestRev.thumbnail_path, SIGNED_URL_TTL_SECONDS);
      if (!signed.error && signed.data) thumbnailUrl = signed.data.signedUrl;
    }

    let downloadUrl: string | null = null;
    if (latestRev?.storage_path) {
      const signed = await db.storage
        .from(FABRICATION_UPLOAD_BUCKET)
        .createSignedUrl(latestRev.storage_path, SIGNED_URL_TTL_SECONDS);
      if (!signed.error && signed.data) downloadUrl = signed.data.signedUrl;
    }

    flagged.push({
      jobId: raw.id,
      jobStatus: raw.status,
      studentName:
        studentRow?.display_name || studentRow?.username || "Unknown student",
      className: classRow?.name ?? null,
      schoolId: raw.school_id,
      teacherId: raw.teacher_id,
      machineLabel: machineRow?.name ?? "Unknown machine",
      machineCategory: machineRow?.machine_category ?? null,
      currentRevision: raw.current_revision,
      originalFilename: raw.original_filename,
      ruleCounts: counts,
      ruleIds,
      pilotOverrideAt: raw.pilot_override_at,
      pilotOverrideRuleIds: raw.pilot_override_rule_ids ?? [],
      thumbnailUrl,
      downloadUrl,
      createdAt: raw.created_at,
    });

    if (flagged.length >= FLAGGED_LIMIT) break;
  }

  return NextResponse.json(
    { rows: flagged, total: flagged.length },
    { status: 200, headers: NO_CACHE_HEADERS }
  );
}
