/**
 * Asserts the shape of migration
 * 20260516052310_set_active_unit_unit_ownership_check.sql.
 *
 * Phase: Block C — closes FU-SEC-SET-ACTIVE-UNIT-MISSING-UNIT-OWNERSHIP-CHECK
 * (P1) per docs/security/security-plan.md. Adds a SECOND auth gate to the
 * SECURITY DEFINER function public.set_active_unit, between the existing
 * is_teacher_of_class check and the deactivate-others UPDATE. Design:
 * Option B per Cowork sign-off — caller must own the target unit
 * (units.author_teacher_id = auth.uid()) OR the unit must be published
 * (is_published = true).
 *
 * Lesson coverage:
 *   - Lesson #64 — SECURITY DEFINER + locked search_path preserved
 *   - Lesson #66 — sanity DO-block extended with assertions for the new
 *     gate (three independent LIKE checks for author_teacher_id,
 *     is_published, and the RAISE EXCEPTION message)
 *   - Lesson #46 — NC verifies the new-gate assertion is load-bearing
 *
 * Sibling test: migration-set-active-unit-function.test.ts asserts the
 * shape of the prior migration (20260515220845). Both tests stay green
 * after Block C ships — each tests its own migration SQL file.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");
const TIMESTAMP = "20260516052310";

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

/** Regex matching the new unit-ownership IF NOT EXISTS gate. */
const UNIT_OWNERSHIP_GATE_REGEX =
  /IF NOT EXISTS \(\s*SELECT 1 FROM units\s+WHERE id = target_unit_uuid\s+AND \(author_teacher_id = auth\.uid\(\) OR is_published = true\)\s*\) THEN/;

describe("Migration: 20260516052310_set_active_unit_unit_ownership_check (up.sql)", () => {
  const sql = loadMigration("_set_active_unit_unit_ownership_check.sql");

  describe("function signature + safety properties preserved (Lesson #64 + #66)", () => {
    it("uses CREATE OR REPLACE FUNCTION (not DROP + CREATE — preserves grants)", () => {
      expect(sql).toMatch(
        /CREATE OR REPLACE FUNCTION public\.set_active_unit\(\s*class_uuid uuid,\s*target_unit_uuid uuid\s*\)/
      );
    });

    it("preserves SECURITY DEFINER", () => {
      expect(sql).toMatch(/SECURITY DEFINER/);
    });

    it("preserves search_path lockdown to public, pg_temp (Lesson #64)", () => {
      expect(sql).toMatch(/SET search_path = public, pg_temp/);
    });

    it("preserves RETURNS void (no contract change)", () => {
      expect(sql).toMatch(/RETURNS\s+void/);
    });

    it("preserves LANGUAGE plpgsql", () => {
      expect(sql).toMatch(/LANGUAGE\s+plpgsql/);
    });
  });

  describe("authorization gate 1 — is_teacher_of_class — still present", () => {
    it("calls is_teacher_of_class(class_uuid) before any writes", () => {
      expect(sql).toMatch(/IF NOT public\.is_teacher_of_class\(class_uuid\) THEN/);
    });

    it("raises with SQLSTATE 42501 + class-specific message", () => {
      expect(sql).toMatch(/RAISE EXCEPTION 'set_active_unit: not teacher of class %'/);
      expect(sql).toMatch(/USING ERRCODE = '42501'/);
    });
  });

  describe("authorization gate 2 — unit ownership (Block C, Option B)", () => {
    it("contains the unit-ownership IF NOT EXISTS subquery against units table", () => {
      expect(sql).toMatch(UNIT_OWNERSHIP_GATE_REGEX);
    });

    it("checks units.author_teacher_id = auth.uid() (caller owns)", () => {
      expect(sql).toMatch(/author_teacher_id = auth\.uid\(\)/);
    });

    it("checks units.is_published = true (published library bypass)", () => {
      expect(sql).toMatch(/is_published = true/);
    });

    it("uses OR (authored-OR-published, not authored-AND-published)", () => {
      // Confirms Option B was implemented, not a stricter A or different shape.
      expect(sql).toMatch(/author_teacher_id = auth\.uid\(\) OR is_published = true/);
    });

    it("raises with SQLSTATE 42501 + unit-specific message (cannot attach unit)", () => {
      expect(sql).toMatch(
        /RAISE EXCEPTION 'set_active_unit: cannot attach unit %[\s\S]{0,200}USING ERRCODE = '42501'/
      );
      expect(sql).toMatch(/cannot attach unit/);
    });
  });

  describe("statement order: gate 1 → gate 2 → deactivate → INSERT", () => {
    it("gate 1 precedes gate 2 (class-auth fires before unit-ownership)", () => {
      const gate1Idx = sql.search(/IF NOT public\.is_teacher_of_class/);
      const gate2Idx = sql.search(UNIT_OWNERSHIP_GATE_REGEX);
      expect(gate1Idx).toBeGreaterThan(-1);
      expect(gate2Idx).toBeGreaterThan(-1);
      expect(gate1Idx).toBeLessThan(gate2Idx);
    });

    it("gate 2 precedes the deactivate-others UPDATE (no writes before both gates pass)", () => {
      const gate2Idx = sql.search(UNIT_OWNERSHIP_GATE_REGEX);
      const updateIdx = sql.indexOf("UPDATE class_units");
      expect(updateIdx).toBeGreaterThan(-1);
      expect(gate2Idx).toBeLessThan(updateIdx);
    });

    it("preserves the INSERT ON CONFLICT mutation shape (no behavior regression)", () => {
      expect(sql).toMatch(
        /INSERT INTO class_units \(class_id, unit_id, is_active\)\s*VALUES \(class_uuid, target_unit_uuid, true\)\s*ON CONFLICT \(class_id, unit_id\) DO UPDATE SET is_active = true/
      );
    });
  });

  describe("permissions hardening preserved", () => {
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

    it("COMMENT ON FUNCTION mentions both gates + the FU that opened the work", () => {
      expect(sql).toMatch(/COMMENT ON FUNCTION public\.set_active_unit\(uuid, uuid\) IS/);
      // Both gates referenced in the comment so future readers see the auth model.
      expect(sql).toMatch(/Two-gate authorization/);
      expect(sql).toMatch(/is_teacher_of_class/);
      expect(sql).toMatch(/author_teacher_id/);
      expect(sql).toMatch(/is_published/);
    });
  });

  describe("Lesson #66 sanity DO-block extended for the new gate", () => {
    it("retains all prior assertions (SECURITY DEFINER, search_path, gate 1)", () => {
      expect(sql).toMatch(/v_def NOT LIKE '%SECURITY DEFINER%'/);
      expect(sql).toMatch(/v_def NOT LIKE '%SET search_path = public, pg_temp%'/);
      expect(sql).toMatch(/v_def NOT LIKE '%SET search_path TO ''public'', ''pg_temp''%'/);
      expect(sql).toMatch(/v_def NOT LIKE '%is_teacher_of_class\(class_uuid\)%'/);
    });

    it("asserts the new gate's author_teacher_id check is present in pg_get_functiondef", () => {
      expect(sql).toMatch(/v_def NOT LIKE '%author_teacher_id = auth\.uid\(\)%'/);
    });

    it("asserts the new gate's is_published clause is present", () => {
      expect(sql).toMatch(/v_def NOT LIKE '%is_published = true%'/);
    });

    it("asserts the new gate's RAISE EXCEPTION message is present", () => {
      expect(sql).toMatch(/v_def NOT LIKE '%cannot attach unit%'/);
    });

    it("RAISE NOTICE confirms successful application by name", () => {
      expect(sql).toMatch(
        /RAISE NOTICE 'Migration set_active_unit_unit_ownership_check applied OK'/
      );
    });
  });

  describe("NC (Lesson #46) — the new unit-ownership gate is load-bearing, not decorative", () => {
    it("removing the new IF NOT EXISTS block makes the shape assertion fail", () => {
      const mutated = sql.replace(
        UNIT_OWNERSHIP_GATE_REGEX,
        "-- new unit-ownership gate removed by NC --\n  IF false THEN"
      );
      // Confirm the mutation actually changed the SQL.
      expect(mutated).not.toBe(sql);
      // The new-gate regex no longer matches the mutated SQL.
      expect(mutated).not.toMatch(UNIT_OWNERSHIP_GATE_REGEX);
      // Original SQL on disk is untouched (no fs.writeFileSync was called).
      const reloaded = loadMigration("_set_active_unit_unit_ownership_check.sql");
      expect(reloaded).toBe(sql);
      // Restore proves the original still matches the assertion.
      expect(reloaded).toMatch(UNIT_OWNERSHIP_GATE_REGEX);
    });
  });
});

describe("Migration: 20260516052310_set_active_unit_unit_ownership_check (down.sql)", () => {
  const sql = loadMigration("_set_active_unit_unit_ownership_check.down.sql");

  it("uses CREATE OR REPLACE FUNCTION (not DROP) — restores prior body in place", () => {
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.set_active_unit\(\s*class_uuid uuid,\s*target_unit_uuid uuid\s*\)/
    );
  });

  it("restores the prior body with ONLY the is_teacher_of_class gate (no unit-ownership)", () => {
    expect(sql).toMatch(/IF NOT public\.is_teacher_of_class\(class_uuid\) THEN/);
    // The new gate's load-bearing pieces must NOT appear in the rollback body.
    expect(sql).not.toMatch(/author_teacher_id = auth\.uid\(\)/);
    expect(sql).not.toMatch(/is_published = true/);
    expect(sql).not.toMatch(/cannot attach unit/);
  });

  it("preserves SECURITY DEFINER + search_path lockdown in the rollback body", () => {
    expect(sql).toMatch(/SECURITY DEFINER/);
    expect(sql).toMatch(/SET search_path = public, pg_temp/);
  });

  it("warns about the privilege gap re-opening if rollback is applied", () => {
    // Text spans two lines in the file (wrapped at 80 cols with `--` continuation).
    expect(sql).toMatch(/RE-OPENS the privilege escalation\s+(?:--\s+)?gap/);
  });
});
