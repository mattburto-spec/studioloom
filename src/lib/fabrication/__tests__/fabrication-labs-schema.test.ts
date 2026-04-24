/**
 * Fabrication Labs Schema Contract Tests (Phase 8-1)
 *
 * Static-analysis tests that read migrations 112 + 113 + verify the
 * contract we promised in the Phase 8-1 brief:
 *   - fabrication_labs table shape + RLS policies
 *   - machine_profiles.lab_id + classes.default_lab_id FK columns
 *   - Unique partial index enforcing one-default-per-teacher
 *   - Backfill is idempotent (re-run safety guards present)
 *
 * Live DB probe tests (actual migration apply + count assertions) run
 * out-of-band: Matt applies 112 + 113 to prod Supabase, then the
 * mini-checkpoint 8.1-migration matrix in the brief §6 is eyeballed
 * via SQL queries in the Supabase dashboard. No automated live-DB
 * harness yet — FU-HH P2 tracks that gap.
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

const MIG_UP = read("112_fabrication_labs.sql");
const MIG_DOWN = read("112_fabrication_labs.down.sql");
const MIG_BACKFILL = read("113_backfill_fabrication_labs.sql");

// ============================================================
// Migration 112: fabrication_labs table + FK columns
// ============================================================

describe("Migration 112 — fabrication_labs table", () => {
  it("creates the fabrication_labs table idempotently", () => {
    expect(MIG_UP).toMatch(/CREATE TABLE IF NOT EXISTS fabrication_labs/);
  });

  it("declares teacher_id as NOT NULL FK to auth.users with CASCADE", () => {
    expect(MIG_UP).toMatch(
      /teacher_id UUID NOT NULL REFERENCES auth\.users\(id\) ON DELETE CASCADE/
    );
  });

  it("reserves school_id as nullable FK to schools (FU-P)", () => {
    expect(MIG_UP).toMatch(
      /school_id\s+UUID NULL REFERENCES schools\(id\) ON DELETE SET NULL/
    );
  });

  it("requires non-empty name via CHECK", () => {
    expect(MIG_UP).toMatch(/name\s+TEXT NOT NULL CHECK \(length\(trim\(name\)\) > 0\)/);
  });

  it("defaults is_default to false", () => {
    expect(MIG_UP).toMatch(/is_default\s+BOOLEAN NOT NULL DEFAULT false/);
  });

  it("has created_at + updated_at timestamps with default now()", () => {
    expect(MIG_UP).toMatch(/created_at\s+TIMESTAMPTZ NOT NULL DEFAULT now\(\)/);
    expect(MIG_UP).toMatch(/updated_at\s+TIMESTAMPTZ NOT NULL DEFAULT now\(\)/);
  });

  it("wires the shared update_updated_at_column trigger", () => {
    expect(MIG_UP).toMatch(
      /CREATE TRIGGER trigger_fabrication_labs_updated_at[\s\S]*?update_updated_at_column/
    );
  });

  it("does NOT use DO/DECLARE verify blocks (Lesson #51)", () => {
    // Supabase dashboard popup mis-parses PL/pgSQL DECLARE variable names
    // as table identifiers. We rely on post-apply SELECT queries instead.
    expect(MIG_UP).not.toMatch(/DO \$\$[\s\S]*DECLARE/);
  });
});

describe("Migration 112 — indexes", () => {
  it("indexes teacher_id", () => {
    expect(MIG_UP).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_fabrication_labs_teacher_id/
    );
  });

  it("indexes school_id (partial, non-null only)", () => {
    expect(MIG_UP).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_fabrication_labs_school_id[\s\S]*?WHERE school_id IS NOT NULL/
    );
  });

  it("enforces one default lab per teacher via unique partial index", () => {
    // This is the key safety rail — backfill re-run + 8-2 createLab
    // both depend on this to prevent multi-default races.
    expect(MIG_UP).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS uq_fabrication_labs_one_default_per_teacher[\s\S]*?WHERE is_default = true/
    );
  });
});

describe("Migration 112 — RLS policies", () => {
  it("enables row-level security on fabrication_labs", () => {
    expect(MIG_UP).toMatch(/ALTER TABLE fabrication_labs ENABLE ROW LEVEL SECURITY/);
  });

  const policies: Array<{ op: string; name: string }> = [
    { op: "SELECT", name: "fabrication_labs_select_teacher" },
    { op: "INSERT", name: "fabrication_labs_insert_teacher" },
    { op: "UPDATE", name: "fabrication_labs_update_teacher" },
    { op: "DELETE", name: "fabrication_labs_delete_teacher" },
  ];

  for (const { op, name } of policies) {
    it(`defines ${op} policy ${name} scoped to teacher_id = auth.uid()`, () => {
      // Every policy should be wrapped in DROP POLICY IF EXISTS first
      // (idempotent re-apply per Lesson #24).
      expect(MIG_UP).toMatch(
        new RegExp(`DROP POLICY IF EXISTS ${name} ON fabrication_labs`)
      );
      expect(MIG_UP).toMatch(
        new RegExp(`CREATE POLICY ${name}[\\s\\S]*?FOR ${op}`)
      );
      expect(MIG_UP).toMatch(
        new RegExp(`${name}[\\s\\S]*?teacher_id = auth\\.uid\\(\\)`)
      );
    });
  }
});

describe("Migration 112 — machine_profiles.lab_id + classes.default_lab_id", () => {
  it("adds machine_profiles.lab_id as nullable FK with ON DELETE SET NULL", () => {
    expect(MIG_UP).toMatch(
      /ALTER TABLE machine_profiles[\s\S]*?ADD COLUMN IF NOT EXISTS lab_id UUID NULL[\s\S]*?REFERENCES fabrication_labs\(id\) ON DELETE SET NULL/
    );
  });

  it("indexes machine_profiles.lab_id (partial, non-null only)", () => {
    expect(MIG_UP).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_machine_profiles_lab_id[\s\S]*?WHERE lab_id IS NOT NULL/
    );
  });

  it("adds classes.default_lab_id as nullable FK with ON DELETE SET NULL", () => {
    expect(MIG_UP).toMatch(
      /ALTER TABLE classes[\s\S]*?ADD COLUMN IF NOT EXISTS default_lab_id UUID NULL[\s\S]*?REFERENCES fabrication_labs\(id\) ON DELETE SET NULL/
    );
  });

  it("indexes classes.default_lab_id (partial, non-null only)", () => {
    expect(MIG_UP).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_classes_default_lab_id[\s\S]*?WHERE default_lab_id IS NOT NULL/
    );
  });
});

// ============================================================
// Migration 112 DOWN — rollback
// ============================================================

describe("Migration 112 DOWN — rollback", () => {
  it("drops classes.default_lab_id column", () => {
    expect(MIG_DOWN).toMatch(/ALTER TABLE classes DROP COLUMN IF EXISTS default_lab_id/);
  });

  it("drops machine_profiles.lab_id column", () => {
    expect(MIG_DOWN).toMatch(
      /ALTER TABLE machine_profiles DROP COLUMN IF EXISTS lab_id/
    );
  });

  it("drops fabrication_labs table with CASCADE (policies + trigger go with it)", () => {
    expect(MIG_DOWN).toMatch(/DROP TABLE IF EXISTS fabrication_labs CASCADE/);
  });

  it("drops columns BEFORE the table (FK constraint order)", () => {
    const classesDrop = MIG_DOWN.indexOf("ALTER TABLE classes DROP COLUMN");
    const machineDrop = MIG_DOWN.indexOf("ALTER TABLE machine_profiles DROP COLUMN");
    const tableDrop = MIG_DOWN.indexOf("DROP TABLE IF EXISTS fabrication_labs");
    expect(classesDrop).toBeGreaterThan(-1);
    expect(machineDrop).toBeGreaterThan(-1);
    expect(tableDrop).toBeGreaterThan(-1);
    expect(classesDrop).toBeLessThan(tableDrop);
    expect(machineDrop).toBeLessThan(tableDrop);
  });
});

// ============================================================
// Migration 113: backfill
// ============================================================

describe("Migration 113 — backfill idempotency + correctness", () => {
  it("inserts one 'Default lab' per teacher with fabrication footprint", () => {
    expect(MIG_BACKFILL).toMatch(/INSERT INTO fabrication_labs[\s\S]*?SELECT DISTINCT/);
    expect(MIG_BACKFILL).toMatch(/'Default lab'\s+AS name/);
    expect(MIG_BACKFILL).toMatch(/true\s+AS is_default/);
  });

  it("scopes to teachers with ≥1 owned machine_profile OR ≥1 class", () => {
    // Two EXISTS clauses joined by OR — footprint criteria from brief §4.2
    expect(MIG_BACKFILL).toMatch(/EXISTS \(\s*SELECT 1 FROM machine_profiles mp/);
    expect(MIG_BACKFILL).toMatch(/EXISTS \(\s*SELECT 1 FROM classes c/);
    expect(MIG_BACKFILL).toMatch(/\bOR EXISTS\b/);
  });

  it("excludes system_template rows from the machine_profiles backfill criterion", () => {
    // System templates are cross-tenant seeds — they don't count as
    // fabrication footprint and stay lab_id=NULL.
    expect(MIG_BACKFILL).toMatch(
      /mp\.is_system_template = false/
    );
  });

  it("guards re-run via NOT EXISTS (skips teachers with a default lab already)", () => {
    expect(MIG_BACKFILL).toMatch(
      /AND NOT EXISTS \(\s*SELECT 1 FROM fabrication_labs fl[\s\S]*?fl\.is_default = true/
    );
  });

  it("assigns machine_profiles.lab_id only where currently NULL (idempotent)", () => {
    expect(MIG_BACKFILL).toMatch(
      /UPDATE machine_profiles mp\s+SET lab_id = fl\.id[\s\S]*?mp\.lab_id IS NULL/
    );
  });

  it("skips system_templates in the machine_profiles UPDATE", () => {
    expect(MIG_BACKFILL).toMatch(
      /UPDATE machine_profiles[\s\S]*?mp\.is_system_template = false/
    );
  });

  it("assigns classes.default_lab_id only where currently NULL (idempotent)", () => {
    expect(MIG_BACKFILL).toMatch(
      /UPDATE classes c\s+SET default_lab_id = fl\.id[\s\S]*?c\.default_lab_id IS NULL/
    );
  });

  it("scopes both UPDATEs to the teacher's own default lab", () => {
    // Both UPDATEs should join fabrication_labs by fl.teacher_id =
    // mp.teacher_id / c.teacher_id + fl.is_default = true
    expect(MIG_BACKFILL).toMatch(/fl\.teacher_id = mp\.teacher_id/);
    expect(MIG_BACKFILL).toMatch(/fl\.teacher_id = c\.teacher_id/);
    expect(MIG_BACKFILL.match(/fl\.is_default = true/g)?.length).toBeGreaterThanOrEqual(3);
  });
});

// ============================================================
// Cross-cutting: migration sequencing + dependency integrity
// ============================================================

describe("Migration sequence", () => {
  it("112 runs before 113 (numeric ordering)", () => {
    // Implicit via filenames, but call it out explicitly — the backfill
    // needs the table + columns from 112 to exist.
    const m112 = read("112_fabrication_labs.sql");
    const m113 = read("113_backfill_fabrication_labs.sql");
    expect(m112.length).toBeGreaterThan(0);
    expect(m113.length).toBeGreaterThan(0);
    // 113 should reference fabrication_labs (which 112 creates)
    expect(m113).toMatch(/INSERT INTO fabrication_labs/);
  });
});
