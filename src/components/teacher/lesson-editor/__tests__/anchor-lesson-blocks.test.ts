/**
 * AG.5 / Round 12 (6 May 2026) — anchor lesson blocks for the
 * CO2 Racers agency unit.
 *
 * Strategy Canvas (Class 1), Self-Reread (Class 7), Final Reflection
 * (Class 14) ship as BlockPalette entries with pre-configured
 * structured-prompts presets so Matt can drag them into the right
 * lessons without re-authoring the prompt sets.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  STRATEGY_CANVAS_PROMPTS,
  SELF_REREAD_PROMPTS,
  FINAL_REFLECTION_PROMPTS,
} from "../../../../lib/structured-prompts/presets";

const PALETTE_SRC = readFileSync(
  join(__dirname, "..", "BlockPalette.tsx"),
  "utf-8"
);

describe("Anchor lesson presets — shape sanity", () => {
  it("STRATEGY_CANVAS_PROMPTS has the 3 first-day commitment fields", () => {
    expect(STRATEGY_CANVAS_PROMPTS).toHaveLength(3);
    const ids = STRATEGY_CANVAS_PROMPTS.map((p) => p.id);
    expect(ids).toEqual(["philosophy", "biggest_risk", "fallback_plan"]);
    // All required (these are non-negotiables for the Class 1 anchor)
    expect(STRATEGY_CANVAS_PROMPTS.every((p) => p.required)).toBe(true);
  });

  it("SELF_REREAD_PROMPTS is a single deep-prompt", () => {
    expect(SELF_REREAD_PROMPTS).toHaveLength(1);
    expect(SELF_REREAD_PROMPTS[0].id).toBe("pattern");
    expect(SELF_REREAD_PROMPTS[0].required).toBe(true);
    // 600 char cap signals it's a wide field, not a quick chip
    expect(SELF_REREAD_PROMPTS[0].softCharCap).toBe(600);
  });

  it("FINAL_REFLECTION_PROMPTS has 5 prompts (4 required + 1 optional carry-forward)", () => {
    expect(FINAL_REFLECTION_PROMPTS).toHaveLength(5);
    const requiredCount = FINAL_REFLECTION_PROMPTS.filter((p) => p.required).length;
    expect(requiredCount).toBe(4);
    const ids = FINAL_REFLECTION_PROMPTS.map((p) => p.id);
    expect(ids).toEqual([
      "biggest_change",
      "biggest_decision",
      "evidence_of_change",
      "agency_meaning",
      "what_next",
    ]);
  });
});

describe("BlockPalette — anchor entries (round 12)", () => {
  it("imports the 3 new presets alongside JOURNAL_PROMPTS", () => {
    expect(PALETTE_SRC).toMatch(/import\s*\{[^}]*JOURNAL_PROMPTS/);
    expect(PALETTE_SRC).toMatch(/import\s*\{[^}]*STRATEGY_CANVAS_PROMPTS/);
    expect(PALETTE_SRC).toMatch(/import\s*\{[^}]*SELF_REREAD_PROMPTS/);
    expect(PALETTE_SRC).toMatch(/import\s*\{[^}]*FINAL_REFLECTION_PROMPTS/);
  });

  it("registers strategy-canvas / self-reread / final-reflection entries", () => {
    expect(PALETTE_SRC).toContain('id: "strategy-canvas"');
    expect(PALETTE_SRC).toContain('id: "self-reread"');
    expect(PALETTE_SRC).toContain('id: "final-reflection"');
  });

  it("each anchor block uses responseType=structured-prompts + portfolioCapture=true", () => {
    for (const id of ["strategy-canvas", "self-reread", "final-reflection"]) {
      const idx = PALETTE_SRC.indexOf(`id: "${id}"`);
      expect(idx).toBeGreaterThan(0);
      const block = PALETTE_SRC.slice(idx, idx + 800);
      expect(block).toContain('responseType: "structured-prompts"');
      expect(block).toContain("portfolioCapture: true");
    }
  });

  it("Strategy Canvas + Self-Reread + Final Reflection all set autoCreateKanbanCardOnSave: false (not tasks)", () => {
    for (const id of ["strategy-canvas", "self-reread", "final-reflection"]) {
      const idx = PALETTE_SRC.indexOf(`id: "${id}"`);
      const block = PALETTE_SRC.slice(idx, idx + 800);
      expect(block).toContain("autoCreateKanbanCardOnSave: false");
    }
  });

  it("default-phase mapping matches the agency-unit lesson-flow doc", () => {
    // Strategy Canvas → workTime (Class 1 main work)
    const sc = PALETTE_SRC.indexOf('id: "strategy-canvas"');
    expect(PALETTE_SRC.slice(sc, sc + 800)).toContain('defaultPhase: "workTime"');
    // Self-Reread → miniLesson (Class 7 opening reflection)
    const sr = PALETTE_SRC.indexOf('id: "self-reread"');
    expect(PALETTE_SRC.slice(sr, sr + 800)).toContain('defaultPhase: "miniLesson"');
    // Final Reflection → debrief (Class 14 closing)
    const fr = PALETTE_SRC.indexOf('id: "final-reflection"');
    expect(PALETTE_SRC.slice(fr, fr + 800)).toContain('defaultPhase: "debrief"');
  });
});
