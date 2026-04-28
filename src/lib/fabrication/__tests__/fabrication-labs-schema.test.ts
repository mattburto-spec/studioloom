/**
 * Fabrication Labs Schema Contract Tests (Phase 8-1, revised 27 Apr).
 *
 * Static-analysis tests that read the timestamp-prefixed migrations
 * `20260427134953_fabrication_labs.sql/.down.sql` +
 * `20260427135108_backfill_fabrication_labs.sql` and verify the
 * contract we promised in the Phase 8-1 brief (revised 27 Apr for
 * school-scoped lab ownership):
 *   - fabrication_labs table shape (school_id NOT NULL, audit-only
 *     created_by_teacher_id, unique-name-per-school index)
 *   - machine_profiles.lab_id + classes.default_lab_id +
 *     teachers.default_lab_id FK columns
 *   - current_teacher_school_id() SECURITY DEFINER helper
 *   - 4 RLS policies (SELECT/INSERT/UPDATE/DELETE) all school-scoped
 *   - Backfill 4-pass structure + system-sentinel exclusion
 *     (`@studioloom.internal`) + idempotency guards
 *
 * Live DB probe tests (actual migration apply + cross-school RLS
 * verification + count assertions) run out-of-band: Matt applies
 * the migrations to prod Supabase, then the mini-checkpoint 8.1-
 * migration matrix in the brief §6 is verified via SQL queries +
 * a manual UI smoke (sign in as Test Teacher A vs Test Teacher B).
 * No automated live-DB harness yet — FU-HH P2 tracks that gap.
 *
 * History:
 * - Originally drafted under 24 Apr brief at 113/114 numbering with
 *   teacher-scoped ownership model.
 * - Renumbered 113/114 → fresh timestamps 27 Apr after Q3 flip to
 *   school-scoped ownership invalidated the schema. Old 113/114 SQL
 *   files deleted in the same commit; this file rewritten to match
 *   the new contract.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const MIGRATIONS_DIR = join(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "supabase",
  "migrations"
);

function read(filename: string): string {
  return readFileSync(join(MIGRATIONS_DIR, filename), "utf-8");
}

/**
 * Strip line comments (-- ...) from SQL so structural regexes can't
 * match prose inside `-- Lesson #51 compliance: no DO $$ DECLARE …`.
 * Block comments (/* ... *\/) aren't used in our migrations so we
 * don't bother stripping them. Tests that care about comment text
 * read the raw file directly.
 */
function stripSqlComments(sql: string): string {
  return sql
    .split("\n")
    .map((line) => {
      const idx = line.indexOf("--");
      return idx === -1 ? line : line.slice(0, idx);
    })
    .join("\n");
}

const SCHEMA_FILENAME = "20260427134953_fabrication_labs.sql";
const SCHEMA_DOWN_FILENAME = "20260427134953_fabrication_labs.down.sql";
const BACKFILL_FILENAME = "20260427135108_backfill_fabrication_labs.sql";

const MIG_UP = read(SCHEMA_FILENAME);
const MIG_DOWN = read(SCHEMA_DOWN_FILENAME);
const MIG_BACKFILL = read(BACKFILL_FILENAME);

// ============================================================
// Schema migration: fabrication_labs table shape
// ============================================================

describe("Schema migration — fabrication_labs table", () => {
  it("creates the fabrication_labs table", () => {
    expect(MIG_UP).toMatch(/CREATE TABLE fabrication_labs\b/);
  });

  it("declares school_id NOT NULL FK to schools with ON DELETE RESTRICT", () => {
    // Labs are owned by the school. RESTRICT on delete: schools
    // can't be removed while labs reference them.
    expect(MIG_UP).toMatch(
      /school_id\s+UUID NOT NULL REFERENCES schools\(id\) ON DELETE RESTRICT/
    );
  });

  it("declares created_by_teacher_id as nullable FK (audit only) with ON DELETE SET NULL", () => {
    // Audit field — does not gate access. SET NULL on delete: if a
    // teacher row goes, labs they created stay (school owns them).
    expect(MIG_UP).toMatch(
      /created_by_teacher_id\s+UUID NULL REFERENCES teachers\(id\) ON DELETE SET NULL/
    );
  });

  it("does NOT have a top-level teacher_id column (revised from 24 Apr)", () => {
    // The 24 Apr draft had `teacher_id NOT NULL` as the ownership
    // column. 27 Apr revision moves ownership to school_id.
    // created_by_teacher_id is allowed (audit), bare teacher_id is not.
    const tableCreate = MIG_UP.match(/CREATE TABLE fabrication_labs\s*\(([\s\S]*?)\);/);
    expect(tableCreate).not.toBeNull();
    const tableBody = tableCreate![1];
    expect(tableBody).not.toMatch(/^\s*teacher_id\s/m);
  });

  it("does NOT have an is_default flag (revised from 24 Apr)", () => {
    // The 24 Apr draft tracked a per-row "default lab" flag. 27 Apr
    // moves the default concept to teachers.default_lab_id +
    // classes.default_lab_id columns instead.
    expect(MIG_UP).not.toMatch(/is_default\s+BOOLEAN/);
  });

  it("requires non-empty name via CHECK", () => {
    expect(MIG_UP).toMatch(
      /name\s+TEXT NOT NULL CHECK \(length\(trim\(name\)\) > 0\)/
    );
  });

  it("has created_at + updated_at timestamps with default NOW()", () => {
    expect(MIG_UP).toMatch(/created_at\s+TIMESTAMPTZ NOT NULL DEFAULT NOW\(\)/);
    expect(MIG_UP).toMatch(/updated_at\s+TIMESTAMPTZ NOT NULL DEFAULT NOW\(\)/);
  });

  it("wires the shared update_updated_at_column trigger", () => {
    // Same shared function used by machine_profiles (mig 093) +
    // fabrication_scan_jobs (mig 096).
    expect(MIG_UP).toMatch(
      /CREATE TRIGGER trg_fabrication_labs_updated_at[\s\S]*?update_updated_at_column/
    );
  });

  it("does NOT use DO/DECLARE verify blocks in schema migration (Lesson #51)", () => {
    // Supabase dashboard popup mis-parses PL/pgSQL DECLARE variable
    // names as table identifiers. Schema migration relies on
    // post-apply SELECT queries instead. (The backfill migration's
    // RAISE NOTICE block uses scalar INT vars that don't trip the
    // mis-parser — that's a separate test below.)
    //
    // stripSqlComments() so the assertion doesn't fire on the
    // explanatory comment "Lesson #51 compliance: no DO $$ DECLARE …"
    // inside the migration.
    expect(stripSqlComments(MIG_UP)).not.toMatch(/DO \$\$[\s\S]*?DECLARE/);
  });
});

// ============================================================
// Schema migration: indexes
// ============================================================

describe("Schema migration — indexes", () => {
  it("indexes school_id (every lab visibility query uses it)", () => {
    expect(MIG_UP).toMatch(
      /CREATE INDEX idx_fabrication_labs_school\s+ON fabrication_labs\(school_id\)/
    );
  });

  it("indexes created_by_teacher_id (audit lookups)", () => {
    expect(MIG_UP).toMatch(
      /CREATE INDEX idx_fabrication_labs_created_by\s+ON fabrication_labs\(created_by_teacher_id\)/
    );
  });

  it("enforces unique lab name within a school (case-insensitive, whitespace-collapsed)", () => {
    // Two schools can both have a "Design Centre"; one school
    // can't have two. Pattern matches schools.normalized_name (mig 085).
    expect(MIG_UP).toMatch(
      /CREATE UNIQUE INDEX idx_fabrication_labs_unique_name_per_school[\s\S]*?lower\(regexp_replace\(trim\(name\)/
    );
  });
});

// ============================================================
// Schema migration: SECURITY DEFINER helper function
// ============================================================

describe("Schema migration — current_teacher_school_id helper", () => {
  it("creates the function with SECURITY DEFINER + STABLE", () => {
    // SECURITY DEFINER: reads teachers.school_id without
    // recursing through teachers' own RLS. STABLE: same input
    // → same output within a transaction (planner can cache).
    expect(MIG_UP).toMatch(
      /CREATE OR REPLACE FUNCTION current_teacher_school_id\(\)[\s\S]*?SECURITY DEFINER[\s\S]*?STABLE/
    );
  });

  it("pins search_path to public (defence in depth)", () => {
    expect(MIG_UP).toMatch(/SET search_path = public/);
  });

  it("returns school_id from teachers WHERE id = auth.uid()", () => {
    expect(MIG_UP).toMatch(
      /SELECT school_id FROM teachers WHERE id = auth\.uid\(\)/
    );
  });

  it("grants EXECUTE to the authenticated role", () => {
    expect(MIG_UP).toMatch(
      /GRANT EXECUTE ON FUNCTION current_teacher_school_id\(\) TO authenticated/
    );
  });
});

// ============================================================
// Schema migration: RLS policies (school-scoped)
// ============================================================

describe("Schema migration — school-scoped RLS policies", () => {
  it("enables row-level security on fabrication_labs", () => {
    expect(MIG_UP).toMatch(
      /ALTER TABLE fabrication_labs ENABLE ROW LEVEL SECURITY/
    );
  });

  const policies: Array<{ op: string; namePattern: RegExp }> = [
    { op: "SELECT", namePattern: /Teachers read same-school labs/ },
    { op: "INSERT", namePattern: /Teachers insert labs into their school/ },
    { op: "UPDATE", namePattern: /Teachers update same-school labs/ },
    { op: "DELETE", namePattern: /Teachers delete same-school labs/ },
  ];

  for (const { op, namePattern } of policies) {
    it(`defines ${op} policy gated by school_id = current_teacher_school_id()`, () => {
      const policyMatcher = new RegExp(
        `CREATE POLICY "${namePattern.source}"\\s*ON fabrication_labs FOR ${op}[\\s\\S]*?school_id = current_teacher_school_id\\(\\)`
      );
      expect(MIG_UP).toMatch(policyMatcher);
    });
  }

  it("UPDATE policy uses both USING and WITH CHECK (defence in depth)", () => {
    // USING gates which rows are visible to update; WITH CHECK
    // gates the new value. Without WITH CHECK a teacher could
    // re-parent a lab to another school via UPDATE.
    expect(MIG_UP).toMatch(
      /CREATE POLICY "Teachers update same-school labs"\s*ON fabrication_labs FOR UPDATE\s*USING[\s\S]*?WITH CHECK/
    );
  });

  it("INSERT policy uses WITH CHECK (only path on INSERT)", () => {
    expect(MIG_UP).toMatch(
      /CREATE POLICY "Teachers insert labs into their school"\s*ON fabrication_labs FOR INSERT\s*WITH CHECK/
    );
  });
});

// ============================================================
// Schema migration: lab_id + default_lab_id columns
// ============================================================

describe("Schema migration — lab_id + default_lab_id columns", () => {
  it("adds machine_profiles.lab_id as nullable FK with ON DELETE SET NULL", () => {
    expect(MIG_UP).toMatch(
      /ALTER TABLE machine_profiles\s+ADD COLUMN lab_id UUID NULL REFERENCES fabrication_labs\(id\) ON DELETE SET NULL/
    );
  });

  it("indexes machine_profiles.lab_id", () => {
    expect(MIG_UP).toMatch(
      /CREATE INDEX idx_machine_profiles_lab\s+ON machine_profiles\(lab_id\)/
    );
  });

  it("adds classes.default_lab_id as nullable FK with ON DELETE SET NULL", () => {
    expect(MIG_UP).toMatch(
      /ALTER TABLE classes\s+ADD COLUMN default_lab_id UUID NULL REFERENCES fabrication_labs\(id\) ON DELETE SET NULL/
    );
  });

  it("indexes classes.default_lab_id", () => {
    expect(MIG_UP).toMatch(
      /CREATE INDEX idx_classes_default_lab\s+ON classes\(default_lab_id\)/
    );
  });

  it("adds teachers.default_lab_id as nullable FK with ON DELETE SET NULL (NEW in 27 Apr)", () => {
    // The 24 Apr draft did not have this column. The revised brief
    // adds per-teacher preference that seeds per-class default.
    expect(MIG_UP).toMatch(
      /ALTER TABLE teachers\s+ADD COLUMN default_lab_id UUID NULL REFERENCES fabrication_labs\(id\) ON DELETE SET NULL/
    );
  });

  it("indexes teachers.default_lab_id", () => {
    expect(MIG_UP).toMatch(
      /CREATE INDEX idx_teachers_default_lab\s+ON teachers\(default_lab_id\)/
    );
  });
});

// ============================================================
// Schema down migration: rollback ordering
// ============================================================

describe("Schema down migration — rollback", () => {
  it("drops all 4 RLS policies before the helper function", () => {
    // Function can't be dropped while policies reference it.
    const policyDropIdx = MIG_DOWN.search(/DROP POLICY IF EXISTS/);
    const fnDropIdx = MIG_DOWN.search(
      /DROP FUNCTION IF EXISTS current_teacher_school_id/
    );
    expect(policyDropIdx).toBeGreaterThan(-1);
    expect(fnDropIdx).toBeGreaterThan(-1);
    expect(policyDropIdx).toBeLessThan(fnDropIdx);
  });

  it("drops new columns from teachers / classes / machine_profiles", () => {
    expect(MIG_DOWN).toMatch(
      /ALTER TABLE teachers\s+DROP COLUMN IF EXISTS default_lab_id/
    );
    expect(MIG_DOWN).toMatch(
      /ALTER TABLE classes\s+DROP COLUMN IF EXISTS default_lab_id/
    );
    expect(MIG_DOWN).toMatch(
      /ALTER TABLE machine_profiles\s+DROP COLUMN IF EXISTS lab_id/
    );
  });

  it("drops the table last with CASCADE (defence in depth)", () => {
    const tableDropIdx = MIG_DOWN.search(
      /DROP TABLE IF EXISTS fabrication_labs CASCADE/
    );
    const columnsDropIdx = MIG_DOWN.search(
      /ALTER TABLE machine_profiles\s+DROP COLUMN/
    );
    expect(tableDropIdx).toBeGreaterThan(-1);
    expect(columnsDropIdx).toBeGreaterThan(-1);
    expect(columnsDropIdx).toBeLessThan(tableDropIdx);
  });
});

// ============================================================
// Backfill migration: 4-pass correctness
// ============================================================

describe("Backfill migration — 4-pass structure", () => {
  it("PASS 1 inserts one Default lab per qualifying school", () => {
    expect(MIG_BACKFILL).toMatch(/INSERT INTO fabrication_labs/);
    expect(MIG_BACKFILL).toMatch(/'Default lab'\s+AS name/);
  });

  it("PASS 1 picks audit creator deterministically (earliest real teacher)", () => {
    // Stable across re-runs — ORDER BY created_at ASC, id ASC
    // tiebreak. The audit creator is the school's earliest real
    // teacher (excluding system sentinels).
    expect(MIG_BACKFILL).toMatch(
      /SELECT id\s+FROM teachers t2[\s\S]*?ORDER BY t2\.created_at ASC, t2\.id ASC[\s\S]*?LIMIT 1/
    );
  });

  it("PASS 2 updates machine_profiles.lab_id only where currently NULL", () => {
    expect(MIG_BACKFILL).toMatch(
      /UPDATE machine_profiles mp[\s\S]*?SET lab_id = \([\s\S]*?WHERE\s+mp\.is_system_template = false[\s\S]*?AND mp\.lab_id IS NULL/
    );
  });

  it("PASS 2 picks the school's earliest-created lab (deterministic)", () => {
    expect(MIG_BACKFILL).toMatch(
      /JOIN teachers t ON t\.school_id = fl\.school_id[\s\S]*?ORDER BY fl\.created_at ASC, fl\.id ASC[\s\S]*?LIMIT 1/
    );
  });

  it("PASS 3 sets teachers.default_lab_id only where currently NULL", () => {
    expect(MIG_BACKFILL).toMatch(
      /UPDATE teachers t[\s\S]*?SET default_lab_id = \([\s\S]*?WHERE\s+t\.default_lab_id IS NULL/
    );
  });

  it("PASS 4 cascades classes.default_lab_id from owning teacher's default", () => {
    expect(MIG_BACKFILL).toMatch(
      /UPDATE classes c[\s\S]*?SET default_lab_id = \(\s*SELECT t\.default_lab_id[\s\S]*?WHERE\s+c\.default_lab_id IS NULL/
    );
  });
});

// ============================================================
// Backfill migration: system-sentinel exclusion
// ============================================================

describe("Backfill migration — system sentinel exclusion", () => {
  it("excludes @studioloom.internal from PASS 1 (no Default lab created for them)", () => {
    expect(MIG_BACKFILL).toMatch(
      /FROM teachers t[\s\S]*?email NOT LIKE '%@studioloom\.internal'/
    );
  });

  it("excludes @studioloom.internal from the audit-creator subselect", () => {
    expect(MIG_BACKFILL).toMatch(
      /SELECT id\s+FROM teachers t2[\s\S]*?email NOT LIKE '%@studioloom\.internal'/
    );
  });

  it("excludes @studioloom.internal from PASS 2 machine assignment", () => {
    expect(MIG_BACKFILL).toMatch(
      /UPDATE machine_profiles mp[\s\S]*?email NOT LIKE '%@studioloom\.internal'/
    );
  });

  it("excludes @studioloom.internal from PASS 3 teacher default assignment", () => {
    expect(MIG_BACKFILL).toMatch(
      /UPDATE teachers t[\s\S]*?email NOT LIKE '%@studioloom\.internal'/
    );
  });

  it("references the exclusion clause across all 4 passes (≥4 occurrences)", () => {
    // Belt + suspenders — if any pass forgets the clause, this catches.
    const matches = MIG_BACKFILL.match(/email NOT LIKE '%@studioloom\.internal'/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(4);
  });
});

// ============================================================
// Backfill migration: idempotency guards
// ============================================================

describe("Backfill migration — idempotency guards", () => {
  it("PASS 1 skips schools that already have ANY lab", () => {
    expect(MIG_BACKFILL).toMatch(
      /AND NOT EXISTS \(\s*SELECT 1\s+FROM fabrication_labs fl\s+WHERE fl\.school_id = t\.school_id/
    );
  });

  it("PASS 2 only touches NULL lab_id (skip already-assigned)", () => {
    expect(MIG_BACKFILL).toMatch(/AND mp\.lab_id IS NULL/);
  });

  it("PASS 3 only touches NULL default_lab_id (skip already-set teachers)", () => {
    // First predicate after WHERE in PASS 3, so no leading AND.
    expect(MIG_BACKFILL).toMatch(/UPDATE teachers t[\s\S]*?WHERE\s+t\.default_lab_id IS NULL/);
  });

  it("PASS 4 only touches NULL default_lab_id (skip already-set classes)", () => {
    // First predicate after WHERE in PASS 4, so no leading AND.
    expect(MIG_BACKFILL).toMatch(/UPDATE classes c[\s\S]*?WHERE\s+c\.default_lab_id IS NULL/);
  });
});

// ============================================================
// Backfill migration: verification block
// ============================================================

describe("Backfill migration — verification block", () => {
  it("uses RAISE NOTICE only (no table-name-like DECLARE vars per Lesson #51)", () => {
    // The DO block IS allowed in the backfill — but only with
    // scalar INT v_* variables. Lesson #51's mis-parser fires on
    // DECLARE values that LOOK like table names. v_orphan_machines
    // etc. are safe.
    expect(MIG_BACKFILL).toMatch(/RAISE NOTICE/);
    // The DECLARE block exists but uses only v_* INT scalars.
    expect(MIG_BACKFILL).toMatch(/DECLARE\s+v_\w+\s+INT;/);
    // No bare table-name-shaped DECLARE.
    expect(MIG_BACKFILL).not.toMatch(/DECLARE\s+rls_enabled/);
  });

  it("counts orphan machines (real-teacher non-template with NULL lab_id)", () => {
    expect(MIG_BACKFILL).toMatch(
      /v_orphan_machines[\s\S]*?machine_profiles[\s\S]*?lab_id IS NULL/
    );
  });

  it("counts orphan classes (real-teacher with NULL default_lab_id where teacher has one)", () => {
    expect(MIG_BACKFILL).toMatch(
      /v_orphan_classes[\s\S]*?default_lab_id IS NULL[\s\S]*?t\.default_lab_id IS NOT NULL/
    );
  });

  it("counts excluded system sentinels separately (audit signal, not a warning)", () => {
    expect(MIG_BACKFILL).toMatch(
      /v_excluded_system[\s\S]*?email LIKE '%@studioloom\.internal'/
    );
  });
});

// ============================================================
// Cross-cutting: migration sequence integrity
// ============================================================

describe("Migration sequence integrity", () => {
  it("schema runs before backfill (timestamp lex ordering)", () => {
    // 20260427134953 (schema) sorts before 20260427135108 (backfill).
    expect(SCHEMA_FILENAME < BACKFILL_FILENAME).toBe(true);
  });

  it("backfill references fabrication_labs (depends on schema)", () => {
    expect(MIG_BACKFILL).toMatch(/INSERT INTO fabrication_labs/);
    expect(MIG_BACKFILL).toMatch(
      /UPDATE (machine_profiles|teachers|classes)/
    );
  });

  it("schema migration is timestamp-prefixed (v2 discipline)", () => {
    expect(SCHEMA_FILENAME).toMatch(/^\d{14}_/);
  });

  it("backfill migration is timestamp-prefixed (v2 discipline)", () => {
    expect(BACKFILL_FILENAME).toMatch(/^\d{14}_/);
  });
});
