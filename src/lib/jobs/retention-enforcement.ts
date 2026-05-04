/**
 * Retention enforcement cron — Phase 5.5.
 *
 * Monthly job. Walks the RETENTION_MANIFEST below and:
 *   1. Soft-deletes rows past their retention horizon (UPDATE deleted_at = now()).
 *   2. Writes a `scheduled_deletions` row for each soft-delete so the
 *      scheduled-hard-delete-cron picks it up after the 30-day grace window.
 *   3. Logs every action to `audit_events` (action='retention.soft_delete',
 *      severity='info', failureMode='throw').
 *
 * Q7 sanity assertion: BEFORE running any UPDATE, verify no manifest entry
 * has retentionDays === 'indefinite' or absurdly large. If anything looks
 * wrong, ABORT the run + emit severity='critical' audit event.
 *
 * RETENTION_MANIFEST is intentionally EMPTY in v1. The taxonomy in
 * `docs/data-classification-taxonomy.md` says `2555` (7 years, FERPA) for
 * student data and `indefinite` for everything else — neither requires
 * v1-pilot enforcement (no student will be in the system 7 years before the
 * pilot ends). The 365-day operational tables (Sentry-managed errors etc.)
 * don't live in our DB.
 *
 * The plumbing ships ready: add entries to RETENTION_MANIFEST when a real
 * short-horizon table appears. Documented in this file's header so future
 * sessions don't need to re-derive intent.
 *
 * Cron pattern mirrors src/lib/jobs/cost-alert.ts — entry point at
 * scripts/ops/run-retention-enforcement.ts. Wired into nightly.yml.
 */

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logAuditEvent } from "../access-v2/audit-log";

// ─────────────────────────────────────────────────────────────────────
// Manifest
// ─────────────────────────────────────────────────────────────────────

interface RetentionManifestEntry {
  /** Supabase table name. */
  table: string;
  /** Days after created_at to soft-delete. Must be a finite positive integer. */
  retentionDays: number;
  /**
   * Optional source-data classification hint for documentation/audit.
   * Mirrors the `basis:` field in data-classification-taxonomy.md.
   */
  basis?:
    | "consent"
    | "contract"
    | "legitimate_interest"
    | "legal_obligation"
    | "coppa_art_6"
    | "ferpa_directory"
    | "ferpa_educational"
    | "pseudonymous";
}

/**
 * v1 manifest: EMPTY by design. Add entries when:
 *   - A column in data-classification-taxonomy.md gets `retention_days: <N>`
 *     where N is finite and < 'indefinite'.
 *   - The owning table has a `created_at` column AND a `deleted_at` column
 *     for the soft-delete pattern.
 * Bound check: MAX_RETENTION_DAYS = 36500 (100 years). Anything larger is
 * a configuration error and trips the Q7 sanity assertion.
 */
export const RETENTION_MANIFEST: ReadonlyArray<RetentionManifestEntry> =
  Object.freeze([
    // Example shape (commented out — uncomment + extend when a real
    // short-horizon table lands):
    //
    // {
    //   table: "ai_usage_log",
    //   retentionDays: 365,
    //   basis: "legitimate_interest",
    // },
  ]);

const MAX_RETENTION_DAYS = 36500; // 100 years; sanity bound

// ─────────────────────────────────────────────────────────────────────
// Result types
// ─────────────────────────────────────────────────────────────────────

export interface RetentionPerTable {
  table: string;
  retentionDays: number;
  soft_deleted: number;
  /** Set when an error broke processing of this table; other tables continue. */
  error?: string;
}

export interface RetentionRunSummary {
  runId: string;
  startedAt: string;
  completedAt: string;
  /** Set if Q7 sanity assertion fired and the run was aborted. */
  aborted?: boolean;
  abortReason?: string;
  summary: {
    tables: RetentionPerTable[];
    total_soft_deleted: number;
  };
}

// ─────────────────────────────────────────────────────────────────────
// run() — production entry point uses RETENTION_MANIFEST
// processManifest() — testable variant accepts a manifest parameter
// ─────────────────────────────────────────────────────────────────────

export async function run(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
): Promise<RetentionRunSummary> {
  return processManifest(supabase, RETENTION_MANIFEST);
}

/**
 * Same logic as run() but accepts the manifest as a parameter so tests
 * can exercise non-empty + invalid-entry paths without monkey-patching
 * the imported const. Production code calls run() (which passes
 * RETENTION_MANIFEST); tests call processManifest() directly.
 */
export async function processManifest(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  manifest: ReadonlyArray<RetentionManifestEntry>,
): Promise<RetentionRunSummary> {
  const runId = randomUUID();
  const startedAt = new Date().toISOString();

  // ── Q7 sanity assertion ────────────────────────────────────────
  // Defensive: every manifest entry must have a finite, positive,
  // bounded retentionDays. Catch programming errors BEFORE any UPDATE.
  for (const entry of manifest) {
    if (
      !Number.isFinite(entry.retentionDays) ||
      entry.retentionDays <= 0 ||
      entry.retentionDays > MAX_RETENTION_DAYS
    ) {
      const reason = `Manifest entry for table='${entry.table}' has invalid retentionDays=${entry.retentionDays}; expected 1..${MAX_RETENTION_DAYS}.`;
      await logAuditEvent(supabase, {
        actorId: null,
        actorType: "system",
        action: "retention.aborted",
        targetTable: entry.table,
        payload: { run_id: runId, reason },
        severity: "critical",
        failureMode: "throw",
      });
      return {
        runId,
        startedAt,
        completedAt: new Date().toISOString(),
        aborted: true,
        abortReason: reason,
        summary: { tables: [], total_soft_deleted: 0 },
      };
    }
  }

  // ── Walk manifest ──────────────────────────────────────────────
  const tables: RetentionPerTable[] = [];
  let totalSoftDeleted = 0;

  for (const entry of manifest) {
    const result = await processTable(supabase, runId, entry);
    tables.push(result);
    totalSoftDeleted += result.soft_deleted;
  }

  return {
    runId,
    startedAt,
    completedAt: new Date().toISOString(),
    summary: { tables, total_soft_deleted: totalSoftDeleted },
  };
}

async function processTable(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  runId: string,
  entry: RetentionManifestEntry,
): Promise<RetentionPerTable> {
  const horizonIso = new Date(
    Date.now() - entry.retentionDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  try {
    // 1. Soft-delete past horizon. Using PostgREST's update-with-where
    // pattern — RLS deny-by-default means only service-role can write.
    const { data: softRows, error: updErr } = await supabase
      .from(entry.table)
      .update({ deleted_at: new Date().toISOString() })
      .is("deleted_at", null)
      .lt("created_at", horizonIso)
      .select("id");

    if (updErr) {
      return {
        table: entry.table,
        retentionDays: entry.retentionDays,
        soft_deleted: 0,
        error: updErr.message,
      };
    }

    const softDeletedRows =
      (softRows ?? []) as Array<{ id: string }>;
    const softDeletedCount = softDeletedRows.length;

    // 2. Queue hard-delete for each row.
    if (softDeletedCount > 0) {
      const scheduledFor = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000,
      ).toISOString();

      const targetType = mapTableToTargetType(entry.table);
      if (targetType) {
        await supabase.from("scheduled_deletions").insert(
          softDeletedRows.map((r) => ({
            target_type: targetType,
            target_id: r.id,
            scheduled_for: scheduledFor,
            status: "pending",
          })),
        );
      }

      // 3. Single audit event per table per run (avoids
      // one-row-per-soft-delete audit-table flooding).
      await logAuditEvent(supabase, {
        actorId: null,
        actorType: "system",
        action: "retention.soft_delete",
        targetTable: entry.table,
        payload: {
          run_id: runId,
          retention_days: entry.retentionDays,
          basis: entry.basis ?? null,
          soft_deleted_count: softDeletedCount,
          horizon: horizonIso,
        },
        severity: "info",
        failureMode: "throw",
      });
    }

    return {
      table: entry.table,
      retentionDays: entry.retentionDays,
      soft_deleted: softDeletedCount,
    };
  } catch (err) {
    return {
      table: entry.table,
      retentionDays: entry.retentionDays,
      soft_deleted: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Map a manifest table name to a scheduled_deletions.target_type value.
 * Returns null when the table doesn't have a corresponding target_type
 * enum value — soft-delete still fires but no scheduled hard-delete row
 * is queued (caller responsible for cleanup via a separate path).
 *
 * Currently the CHECK on scheduled_deletions.target_type is
 * ('student','teacher','unit'). Extend that CHECK + this map together
 * when a new table joins the retention pipeline.
 */
function mapTableToTargetType(
  table: string,
): "student" | "teacher" | "unit" | null {
  if (table === "students") return "student";
  if (table === "teachers") return "teacher";
  if (table === "units") return "unit";
  return null;
}
