/**
 * Asserts the shape of migration 20260503143034_phase_5_4_scheduled_deletions.sql.
 *
 * Phase 5.4 — single new table for the soft-delete + 30-day hard-delete queue.
 * Two consumers from day one (delete endpoint + retention cron); legal-hold
 * path via status='held'.
 *
 * Lessons applied:
 *   #38 — assert specific values (column shape, CHECK enums, RLS policies,
 *         partial unique index, sanity DO-block).
 *   #45 — surgical: only this migration; cron logic lives in §5.5.
 *   #61 — index predicates can't contain non-IMMUTABLE; status='pending'
 *         is fine, scheduled_for < now() would NOT be.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MIGRATION_PATH = resolve(
  __dirname,
  "../../../../supabase/migrations/20260503143034_phase_5_4_scheduled_deletions.sql",
);
const sql = readFileSync(MIGRATION_PATH, "utf-8");

describe("Migration: 20260503143034_phase_5_4_scheduled_deletions", () => {
  // ── Table shape ────────────────────────────────────────────────

  it("creates scheduled_deletions table", () => {
    expect(sql).toMatch(/CREATE TABLE scheduled_deletions/);
  });

  it("has id UUID PRIMARY KEY DEFAULT gen_random_uuid()", () => {
    expect(sql).toMatch(/id UUID PRIMARY KEY DEFAULT gen_random_uuid\(\)/);
  });

  it("target_type CHECK enumerates exactly student/teacher/unit", () => {
    expect(sql).toMatch(
      /target_type TEXT NOT NULL\s+CHECK \(target_type IN \('student', 'teacher', 'unit'\)\)/,
    );
  });

  it("target_id UUID NOT NULL", () => {
    expect(sql).toMatch(/target_id UUID NOT NULL/);
  });

  it("scheduled_for TIMESTAMPTZ NOT NULL", () => {
    expect(sql).toMatch(/scheduled_for TIMESTAMPTZ NOT NULL/);
  });

  it("status CHECK enumerates exactly pending/completed/held with default 'pending'", () => {
    expect(sql).toMatch(
      /status TEXT NOT NULL DEFAULT 'pending'\s+CHECK \(status IN \('pending', 'completed', 'held'\)\)/,
    );
  });

  it("scheduled_by FK auth.users with ON DELETE SET NULL (audit-correlation seam)", () => {
    expect(sql).toMatch(
      /scheduled_by UUID NULL REFERENCES auth\.users\(id\) ON DELETE SET NULL/,
    );
  });

  it("hold_reason TEXT NULL for legal-hold UX", () => {
    expect(sql).toMatch(/hold_reason TEXT NULL/);
  });

  it("completed_at coherence CHECK — populated iff status='completed'", () => {
    expect(sql).toMatch(/CHECK \(\s*\(status = 'completed' AND completed_at IS NOT NULL\) OR/);
    expect(sql).toMatch(/\(status != 'completed' AND completed_at IS NULL\)/);
  });

  // ── Indexes ───────────────────────────────────────────────────

  it("unique partial index on (target_type, target_id) WHERE status='pending'", () => {
    expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduled_deletions_unique_pending/);
    expect(sql).toMatch(
      /ON scheduled_deletions\(target_type, target_id\)\s+WHERE status = 'pending'/,
    );
  });

  it("cron-friendly index on (scheduled_for, status) WHERE pending", () => {
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_scheduled_deletions_due\s+ON scheduled_deletions\(scheduled_for, status\)\s+WHERE status = 'pending'/,
    );
  });

  it("status-faceted admin index on (status, created_at DESC)", () => {
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_scheduled_deletions_status_created\s+ON scheduled_deletions\(status, created_at DESC\)/,
    );
  });

  it("does NOT use now() in any index predicate (Lesson #61)", () => {
    // Partial-index WHERE clauses must not call non-IMMUTABLE functions.
    // A grep for `WHERE.*now()` in the migration would catch the violation.
    const indexBlock = sql.match(/CREATE (?:UNIQUE )?INDEX[\s\S]+?;/g) ?? [];
    for (const idx of indexBlock) {
      expect(idx).not.toMatch(/\bnow\s*\(\s*\)/);
    }
  });

  // ── RLS ───────────────────────────────────────────────────────

  it("ALTER TABLE scheduled_deletions ENABLE ROW LEVEL SECURITY", () => {
    expect(sql).toContain("ALTER TABLE scheduled_deletions ENABLE ROW LEVEL SECURITY");
  });

  it("has platform_admin SELECT policy", () => {
    expect(sql).toContain("scheduled_deletions_platform_admin_read");
    expect(sql).toMatch(/up\.is_platform_admin = TRUE/);
  });

  it("has school_teacher SELECT policy with CASE on target_type", () => {
    expect(sql).toContain("scheduled_deletions_school_teacher_read");
    expect(sql).toMatch(/CASE target_type/);
    expect(sql).toMatch(/WHEN 'student' THEN/);
    expect(sql).toMatch(/WHEN 'teacher' THEN/);
    expect(sql).toMatch(/WHEN 'unit' THEN/);
  });

  it("has NO INSERT/UPDATE/DELETE policies (service-role only by design)", () => {
    expect(sql).not.toMatch(/CREATE POLICY[^;]+ON scheduled_deletions FOR INSERT/);
    expect(sql).not.toMatch(/CREATE POLICY[^;]+ON scheduled_deletions FOR UPDATE/);
    expect(sql).not.toMatch(/CREATE POLICY[^;]+ON scheduled_deletions FOR DELETE/);
  });

  it("has COMMENT ON TABLE explaining the queue + legal-hold path", () => {
    expect(sql).toMatch(/COMMENT ON TABLE scheduled_deletions/);
    expect(sql).toMatch(/Legal-hold path: UPDATE status=held/);
  });

  // ── Sanity DO-block ───────────────────────────────────────────

  it("sanity DO-block asserts target_type CHECK has all 3 values", () => {
    expect(sql).toMatch(/cc\.check_clause LIKE '%student%'/);
    expect(sql).toMatch(/cc\.check_clause LIKE '%teacher%'/);
    expect(sql).toMatch(/cc\.check_clause LIKE '%unit%'/);
  });

  it("sanity DO-block asserts status CHECK has all 3 values", () => {
    expect(sql).toMatch(/cc\.check_clause LIKE '%pending%'/);
    expect(sql).toMatch(/cc\.check_clause LIKE '%completed%'/);
    expect(sql).toMatch(/cc\.check_clause LIKE '%held%'/);
  });

  it("sanity DO-block asserts RLS enabled", () => {
    expect(sql).toMatch(/rowsecurity = TRUE/);
    expect(sql).toMatch(/scheduled_deletions RLS not enabled/);
  });

  it("sanity DO-block asserts NO INSERT/UPDATE/DELETE policies (positive assertion)", () => {
    expect(sql).toMatch(/cmd IN \('INSERT', 'UPDATE', 'DELETE'\)/);
    expect(sql).toMatch(/has unexpected INSERT\/UPDATE\/DELETE policy/);
  });

  it("sanity DO-block asserts unique-pending partial index exists", () => {
    expect(sql).toMatch(/indexname = 'idx_scheduled_deletions_unique_pending'/);
    expect(sql).toMatch(/missing unique-pending partial index/);
  });

  it("sanity DO-block emits final RAISE NOTICE on success", () => {
    expect(sql).toMatch(
      /RAISE NOTICE\s+'Migration phase_5_4_scheduled_deletions applied OK/,
    );
  });

  // ── Down migration ────────────────────────────────────────────

  it("paired down migration drops the table", () => {
    const downPath = resolve(
      __dirname,
      "../../../../supabase/migrations/20260503143034_phase_5_4_scheduled_deletions.down.sql",
    );
    const down = readFileSync(downPath, "utf-8");
    expect(down).toMatch(/DROP TABLE IF EXISTS scheduled_deletions/);
  });
});
