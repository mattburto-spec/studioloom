import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  derivePhaseState,
  isLevelSelected,
  AUTONOMY_LEVELS,
  resolveAutonomyDisplay,
  hintsAvailable,
  hintsOpenByDefault,
  exampleVisible,
  exampleOpenByDefault,
  type AutonomyLevel,
} from "../helpers";

/**
 * Project has no DOM-render harness (no @testing-library/react, no jsdom,
 * no JSX transform in vitest config). Convention: test pure helpers, not
 * JSX output. See ClassMachinePicker.test.tsx + DesignAssistantWidget.test.tsx
 * for the same pattern. .tsx extension kept for sibling proximity; no JSX here.
 */

describe("derivePhaseState", () => {
  it("returns 'done' when done=true — including the done+current edge case (done wins)", () => {
    expect(derivePhaseState({ done: true })).toBe("done");
    expect(derivePhaseState({ done: true, current: true })).toBe("done");
  });

  it("returns 'current' when done is falsy and current=true, 'upcoming' otherwise", () => {
    expect(derivePhaseState({ current: true })).toBe("current");
    expect(derivePhaseState({ done: false, current: true })).toBe("current");
    expect(derivePhaseState({})).toBe("upcoming");
    expect(derivePhaseState({ done: false, current: false })).toBe("upcoming");
  });
});

describe("AUTONOMY_LEVELS", () => {
  it("exposes exactly 3 levels in the fixed order scaffolded → balanced → independent", () => {
    expect(AUTONOMY_LEVELS).toHaveLength(3);
    expect(AUTONOMY_LEVELS.map((l) => l.id)).toEqual([
      "scaffolded",
      "balanced",
      "independent",
    ]);
  });
});

describe("isLevelSelected", () => {
  it("matches the exact level and returns false for null / mismatches", () => {
    const allLevels: AutonomyLevel[] = ["scaffolded", "balanced", "independent"];
    for (const l of allLevels) {
      expect(isLevelSelected(l, l)).toBe(true);
      expect(isLevelSelected(null, l)).toBe(false);
    }
    expect(isLevelSelected("balanced", "scaffolded")).toBe(false);
    expect(isLevelSelected("independent", "balanced")).toBe(false);
  });
});

describe("resolveAutonomyDisplay", () => {
  it("falls back to 'balanced' for null and undefined; passes other levels through", () => {
    expect(resolveAutonomyDisplay(null)).toBe("balanced");
    expect(resolveAutonomyDisplay(undefined)).toBe("balanced");
    expect(resolveAutonomyDisplay("scaffolded")).toBe("scaffolded");
    expect(resolveAutonomyDisplay("balanced")).toBe("balanced");
    expect(resolveAutonomyDisplay("independent")).toBe("independent");
  });
});

describe("hint + example gating helpers", () => {
  it("hintsAvailable: independent hides, scaffolded + balanced show", () => {
    expect(hintsAvailable("scaffolded")).toBe(true);
    expect(hintsAvailable("balanced")).toBe(true);
    expect(hintsAvailable("independent")).toBe(false);
  });

  it("hintsOpenByDefault: only scaffolded auto-opens", () => {
    expect(hintsOpenByDefault("scaffolded")).toBe(true);
    expect(hintsOpenByDefault("balanced")).toBe(false);
    expect(hintsOpenByDefault("independent")).toBe(false);
  });

  it("exampleVisible: independent hides, scaffolded + balanced show", () => {
    expect(exampleVisible("scaffolded")).toBe(true);
    expect(exampleVisible("balanced")).toBe(true);
    expect(exampleVisible("independent")).toBe(false);
  });

  it("exampleOpenByDefault: only scaffolded auto-expands", () => {
    expect(exampleOpenByDefault("scaffolded")).toBe(true);
    expect(exampleOpenByDefault("balanced")).toBe(false);
    expect(exampleOpenByDefault("independent")).toBe(false);
  });
});

describe("Migration 116 — student_progress.autonomy_level", () => {
  const MIGRATION_PATH = join(
    process.cwd(),
    "supabase/migrations/116_student_progress_autonomy_level.sql"
  );
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  it("adds autonomy_level column with TEXT type and CHECK on the 3 levels — no DEFAULT, no NOT NULL", () => {
    // ADD COLUMN with the right type
    expect(sql).toMatch(
      /ALTER TABLE student_progress\s+ADD COLUMN IF NOT EXISTS autonomy_level TEXT/i
    );
    // CHECK constraint contains all three values exactly
    expect(sql).toMatch(/CHECK\s*\(\s*autonomy_level\s+IN\s*\(\s*'scaffolded'\s*,\s*'balanced'\s*,\s*'independent'\s*\)\s*\)/i);
    // No DEFAULT clause on the autonomy_level column (Lesson #38).
    expect(sql).not.toMatch(/autonomy_level\s+TEXT[\s\S]*?DEFAULT/i);
    // No NOT NULL — NULL is the explicit "not yet picked" sentinel.
    expect(sql).not.toMatch(/autonomy_level\s+TEXT[\s\S]*?NOT NULL/i);
    // No backfill / data-migration UPDATE (Lesson #38).
    expect(sql).not.toMatch(/UPDATE\s+student_progress/i);
  });

  it("contains no destructive statements (DROP, DELETE, TRUNCATE)", () => {
    expect(sql).not.toMatch(/\bDROP\s+(TABLE|COLUMN|CONSTRAINT|INDEX)\b/i);
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
  });

  it("AUTONOMY_LEVELS UI list matches the SQL CHECK enum exactly (Lesson #38 cross-reference)", () => {
    // Extract the CHECK list from the SQL — must be the same set the UI exports.
    const m = sql.match(
      /CHECK\s*\(\s*autonomy_level\s+IN\s*\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*\)\s*\)/i
    );
    expect(m).not.toBeNull();
    const sqlLevels = [m![1], m![2], m![3]].sort();
    const uiLevels = AUTONOMY_LEVELS.map((l) => l.id).sort();
    expect(sqlLevels).toEqual(uiLevels);
  });
});
