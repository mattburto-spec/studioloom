/**
 * Asserts the shape of migration
 * 20260515220845_set_active_unit_function.sql.
 *
 * Phase: "One active unit per class enforced at DB level" — atomic helper
 * that pairs with the partial unique index from migration 20260515214045.
 * Per docs/decisions-log.md entry dated 16 May 2026.
 *
 * Lesson coverage:
 *   - Lesson #64 — SECURITY DEFINER + locked search_path (public, pg_temp)
 *   - Lesson #66 — sanity DO-block bakes safety properties into the migration
 *   - Block B1 — is_teacher_of_class auth gate must live in the function body
 *     (SECURITY DEFINER bypasses RLS, so an external GRANT is not enough)
 *   - Block D1 — INSERT ON CONFLICT for the target, no caller pre-existence
 *     dance required
 *
 * NC discipline: the deactivate-others UPDATE is load-bearing. Without it,
 * the second UPDATE-via-INSERT-ON-CONFLICT would violate the partial unique
 * index class_units_one_active_per_class. An in-memory mutation that strips
 * the deactivate block is run at the end of the suite to confirm the
 * shape assertion is genuinely catching that statement, not just any
 * statement that happens to mention class_units.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");
const TIMESTAMP = "20260515220845";

function loadMigration(suffix: string): string {
  const all = fs.readdirSync(MIGRATIONS_DIR);
  const file = all.find(
    (f) => f.startsWith(TIMESTAMP) && f.endsWith(suffix)
  );
  if (!file) {
    throw new Error(
      `Migration with timestamp ${TIMESTAMP} and suffix ${suffix} not found`
    );
  }
  return fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
}

/** Regex matching the deactivate-others UPDATE statement. */
const DEACTIVATE_OTHERS_REGEX =
  /UPDATE\s+class_units\s+SET\s+is_active\s*=\s*false\s+WHERE\s+class_id\s*=\s*class_uuid\s+AND\s+unit_id\s*<>\s*target_unit_uuid\s+AND\s+is_active\s*=\s*true/;

describe("Migration: 20260515220845_set_active_unit_function (up.sql)", () => {
  const sql = loadMigration("_set_active_unit_function.sql");

  describe("function signature + safety properties (Lesson #64 + #66)", () => {
    it("declares CREATE OR REPLACE FUNCTION public.set_active_unit(uuid, uuid)", () => {
      expect(sql).toMatch(
        /CREATE OR REPLACE FUNCTION public\.set_active_unit\(\s*class_uuid uuid,\s*target_unit_uuid uuid\s*\)/
      );
    });

    it("is SECURITY DEFINER (required for RLS-bypass cross-table writes)", () => {
      expect(sql).toMatch(/SECURITY DEFINER/);
    });

    it("locks search_path to public, pg_temp (Lesson #64)", () => {
      expect(sql).toMatch(/SET search_path = public, pg_temp/);
    });

    it("RETURNS void (the function is a side-effect helper, no result needed)", () => {
      expect(sql).toMatch(/RETURNS\s+void/);
    });

    it("uses plpgsql (needed for the IF/RAISE control flow)", () => {
      expect(sql).toMatch(/LANGUAGE\s+plpgsql/);
    });
  });

  describe("authorization gate inside function body (Block B1 fix)", () => {
    it("calls is_teacher_of_class(class_uuid) before any writes", () => {
      expect(sql).toMatch(/IF NOT public\.is_teacher_of_class\(class_uuid\) THEN/);
    });

    it("raises with SQLSTATE 42501 (permission denied) when the gate fails", () => {
      expect(sql).toMatch(/RAISE EXCEPTION 'set_active_unit: not teacher of class %'/);
      expect(sql).toMatch(/USING ERRCODE = '42501'/);
    });
  });

  describe("statement order: deactivate then activate (atomicity)", () => {
    it("contains the deactivate-others UPDATE with the correct WHERE shape", () => {
      expect(sql).toMatch(DEACTIVATE_OTHERS_REGEX);
    });

    it("contains the INSERT ON CONFLICT (class_id, unit_id) DO UPDATE for the target (Block D1)", () => {
      expect(sql).toMatch(
        /INSERT INTO class_units \(class_id, unit_id, is_active\)\s*VALUES \(class_uuid, target_unit_uuid, true\)\s*ON CONFLICT \(class_id, unit_id\) DO UPDATE SET is_active = true/
      );
    });

    it("orders deactivate BEFORE INSERT/upsert so the partial unique never sees two active rows", () => {
      const deactivateIdx = sql.search(DEACTIVATE_OTHERS_REGEX);
      const insertIdx = sql.indexOf("INSERT INTO class_units");
      expect(deactivateIdx).toBeGreaterThan(-1);
      expect(insertIdx).toBeGreaterThan(-1);
      expect(deactivateIdx).toBeLessThan(insertIdx);
    });
  });

  describe("permissions hardening", () => {
    it("REVOKEs ALL from PUBLIC (default-deny)", () => {
      expect(sql).toMatch(
        /REVOKE ALL ON FUNCTION public\.set_active_unit\(uuid, uuid\) FROM PUBLIC/
      );
    });

    it("GRANTs EXECUTE to authenticated only", () => {
      expect(sql).toMatch(
        /GRANT EXECUTE ON FUNCTION public\.set_active_unit\(uuid, uuid\) TO authenticated/
      );
    });

    it("includes a COMMENT ON FUNCTION describing the auth model + closure rationale", () => {
      expect(sql).toMatch(/COMMENT ON FUNCTION public\.set_active_unit\(uuid, uuid\) IS/);
    });
  });

  describe("Lesson #66 sanity DO-block (bake safety properties into the migration)", () => {
    it("contains a DO $$ ... $$ block that runs after the function is created", () => {
      // The DO-block sits below the GRANT statement.
      const grantIdx = sql.indexOf("GRANT EXECUTE ON FUNCTION public.set_active_unit");
      const doIdx = sql.indexOf("DO $$", grantIdx);
      expect(doIdx).toBeGreaterThan(grantIdx);
    });

    it("asserts SECURITY DEFINER survived via pg_get_functiondef", () => {
      expect(sql).toMatch(/v_def NOT LIKE '%SECURITY DEFINER%'/);
    });

    it("asserts search_path lockdown via dual-LIKE pattern (= form AND TO form)", () => {
      // Matches the canonical defensive pattern from migration 20260502102745.
      expect(sql).toMatch(/v_def NOT LIKE '%SET search_path = public, pg_temp%'/);
      expect(sql).toMatch(/v_def NOT LIKE '%SET search_path TO ''public'', ''pg_temp''%'/);
    });

    it("asserts the is_teacher_of_class auth gate is still present", () => {
      expect(sql).toMatch(/v_def NOT LIKE '%is_teacher_of_class\(class_uuid\)%'/);
    });
  });

  describe("NC (Lesson #46) — deactivate-others is load-bearing, not decorative", () => {
    it("removing the deactivate-others UPDATE makes the shape assertion fail", () => {
      const mutated = sql.replace(DEACTIVATE_OTHERS_REGEX, "-- deactivate UPDATE removed by NC");
      // Confirm the mutation actually changed the SQL.
      expect(mutated).not.toBe(sql);
      // Confirm the original assertion now fails against the mutated SQL.
      expect(mutated).not.toMatch(DEACTIVATE_OTHERS_REGEX);
      // Original SQL on disk is untouched (no fs.writeFileSync was called).
      const reloaded = loadMigration("_set_active_unit_function.sql");
      expect(reloaded).toBe(sql);
      // The original still matches — proves restore.
      expect(reloaded).toMatch(DEACTIVATE_OTHERS_REGEX);
    });
  });
});

describe("Migration: 20260515220845_set_active_unit_function (down.sql)", () => {
  const sql = loadMigration("_set_active_unit_function.down.sql");

  it("drops the function with IF EXISTS for idempotent rollback", () => {
    expect(sql).toMatch(
      /DROP FUNCTION IF EXISTS public\.set_active_unit\(uuid, uuid\)/
    );
  });
});
