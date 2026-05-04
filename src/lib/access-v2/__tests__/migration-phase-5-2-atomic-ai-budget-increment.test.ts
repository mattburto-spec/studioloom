/**
 * Asserts the shape of migration 20260503012514_phase_5_2_atomic_ai_budget_increment.sql.
 *
 * Phase 5.2 — single SECURITY DEFINER function that atomically increments
 * ai_budget_state.tokens_used_today + zeros + bumps reset_at when past
 * the previous midnight-in-school-timezone horizon.
 *
 * Lessons applied:
 *   #38 — assert specific values (function signature, search_path lockdown,
 *         REVOKE/GRANT shape, sanity DO-block contents).
 *   #66 — verify locked search_path is part of the migration (not "trust me").
 *   #52 — verify REVOKE FROM PUBLIC + anon + authenticated.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MIGRATION_PATH = resolve(
  __dirname,
  "../../../../supabase/migrations/20260503012514_phase_5_2_atomic_ai_budget_increment.sql",
);
const sql = readFileSync(MIGRATION_PATH, "utf-8");

describe("Migration: 20260503012514_phase_5_2_atomic_ai_budget_increment", () => {
  // ── Function shape ─────────────────────────────────────────────────

  it("creates atomic_increment_ai_budget(UUID, INTEGER) function", () => {
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION atomic_increment_ai_budget\s*\(\s*p_student_id UUID\s*,\s*p_tokens INTEGER\s*\)/,
    );
  });

  it("returns (new_tokens_used_today INTEGER, next_reset_at TIMESTAMPTZ)", () => {
    expect(sql).toMatch(
      /RETURNS TABLE \(\s*new_tokens_used_today INTEGER\s*,\s*next_reset_at TIMESTAMPTZ\s*\)/,
    );
  });

  it("is SECURITY DEFINER", () => {
    expect(sql).toContain("SECURITY DEFINER");
  });

  it("locks search_path to public, pg_temp INSIDE the function definition (Lesson #66)", () => {
    // Strict assertion: the SET search_path clause must appear immediately
    // after SECURITY DEFINER (the function-definition lockdown), not just
    // anywhere in the file (which would let a comment-only mention pass).
    expect(sql).toMatch(
      /SECURITY DEFINER\s*\n\s*SET search_path = public, pg_temp/,
    );
  });

  it("language is plpgsql", () => {
    expect(sql).toMatch(/LANGUAGE plpgsql/);
  });

  // ── Behaviour invariants ──────────────────────────────────────────

  it("rejects negative p_tokens with RAISE EXCEPTION", () => {
    expect(sql).toMatch(/p_tokens must be >= 0/);
    expect(sql).toMatch(/IF p_tokens < 0 THEN/);
  });

  it("resolves school timezone via students → schools.timezone with Asia/Shanghai fallback", () => {
    expect(sql).toMatch(/COALESCE\(s\.timezone, 'Asia\/Shanghai'\)/);
    expect(sql).toMatch(/FROM students st\s+LEFT JOIN schools s ON s\.id = st\.school_id/);
  });

  it("raises on unknown student", () => {
    expect(sql).toMatch(/student % not found/);
  });

  it("computes next-midnight in school's local timezone via the date+1 trick", () => {
    // ((v_now AT TIME ZONE v_tz)::date + 1) AT TIME ZONE v_tz
    expect(sql).toMatch(/\(\(v_now AT TIME ZONE v_tz\)::date \+ 1\) AT TIME ZONE v_tz/);
  });

  it("uses INSERT ... ON CONFLICT (student_id) DO UPDATE for atomic upsert", () => {
    expect(sql).toMatch(/INSERT INTO ai_budget_state/);
    expect(sql).toMatch(/ON CONFLICT \(student_id\) DO UPDATE SET/);
  });

  it("zeros tokens_used_today when reset_at is past (CASE branch)", () => {
    expect(sql).toMatch(
      /WHEN ai_budget_state\.reset_at <= v_now THEN EXCLUDED\.tokens_used_today/,
    );
  });

  it("increments tokens_used_today (not zeros) when reset_at is future", () => {
    expect(sql).toMatch(
      /ELSE ai_budget_state\.tokens_used_today \+ EXCLUDED\.tokens_used_today/,
    );
  });

  it("bumps reset_at to next midnight when past, leaves alone when future", () => {
    // Two CASE expressions — one for tokens_used_today, one for reset_at
    const caseCount = (sql.match(/WHEN ai_budget_state\.reset_at <= v_now/g) ?? []).length;
    expect(caseCount).toBeGreaterThanOrEqual(2);
  });

  // ── Permission lockdown (Lesson #52) ──────────────────────────────

  it("REVOKEs EXECUTE from PUBLIC, anon, authenticated", () => {
    expect(sql).toMatch(
      /REVOKE EXECUTE ON FUNCTION atomic_increment_ai_budget\(UUID, INTEGER\) FROM PUBLIC/,
    );
    expect(sql).toMatch(
      /REVOKE EXECUTE ON FUNCTION atomic_increment_ai_budget\(UUID, INTEGER\) FROM anon/,
    );
    expect(sql).toMatch(
      /REVOKE EXECUTE ON FUNCTION atomic_increment_ai_budget\(UUID, INTEGER\) FROM authenticated/,
    );
  });

  it("GRANTs EXECUTE to service_role", () => {
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION atomic_increment_ai_budget\(UUID, INTEGER\) TO service_role/,
    );
  });

  it("does NOT GRANT to authenticated/anon (positive assertion)", () => {
    expect(sql).not.toMatch(/GRANT EXECUTE.*atomic_increment_ai_budget.*TO authenticated/);
    expect(sql).not.toMatch(/GRANT EXECUTE.*atomic_increment_ai_budget.*TO anon/);
  });

  it("has a COMMENT ON FUNCTION explaining purpose", () => {
    expect(sql).toMatch(/COMMENT ON FUNCTION atomic_increment_ai_budget\(UUID, INTEGER\)/);
    expect(sql).toMatch(/SECURITY DEFINER \+ service_role only/);
  });

  // ── Sanity DO-block (Lesson #38) ──────────────────────────────────

  it("sanity DO-block asserts function existence by signature (not just name)", () => {
    expect(sql).toMatch(/AND p\.pronargs = 2/);
    expect(sql).toMatch(/AND p\.proname = 'atomic_increment_ai_budget'/);
  });

  it("sanity DO-block asserts SECURITY DEFINER flag (prosecdef)", () => {
    expect(sql).toMatch(/v_security_definer\s+BOOLEAN/);
    expect(sql).toMatch(/IF NOT v_security_definer THEN/);
    expect(sql).toMatch(/is not SECURITY DEFINER/);
  });

  it("sanity DO-block asserts search_path lockdown via pg_proc.proconfig", () => {
    expect(sql).toMatch(/proconfig::TEXT LIKE '%search_path=public, pg_temp%'/);
    expect(sql).toMatch(/missing locked search_path \(Lesson #66\)/);
  });

  it("sanity DO-block asserts service_role has EXECUTE", () => {
    expect(sql).toMatch(
      /has_function_privilege\(\s*'service_role',\s*'atomic_increment_ai_budget\(UUID, INTEGER\)',\s*'EXECUTE'\s*\)/,
    );
  });

  it("sanity DO-block asserts authenticated does NOT have EXECUTE", () => {
    expect(sql).toMatch(
      /IF has_function_privilege\(\s*'authenticated'/,
    );
    expect(sql).toMatch(/authenticated has unexpected EXECUTE.*Lesson #52/);
  });

  it("sanity DO-block emits a final RAISE NOTICE on success", () => {
    expect(sql).toMatch(
      /RAISE NOTICE\s*'Migration phase_5_2_atomic_ai_budget_increment applied OK/,
    );
  });

  // ── Down migration ────────────────────────────────────────────────

  it("paired down migration drops the function with the right signature", () => {
    const downPath = resolve(
      __dirname,
      "../../../../supabase/migrations/20260503012514_phase_5_2_atomic_ai_budget_increment.down.sql",
    );
    const downSql = readFileSync(downPath, "utf-8");
    expect(downSql).toMatch(
      /DROP FUNCTION IF EXISTS atomic_increment_ai_budget\(UUID, INTEGER\)/,
    );
  });
});
