/**
 * Class DJ — source-static guards for the lesson-editor wiring (Phase 3).
 *
 * Verifies that:
 *   - ActivityBlock.tsx imports + mounts ClassDjConfigPanel on responseType match
 *   - RESPONSE_TYPES picker includes "class-dj"
 *   - RESPONSE_TYPE_LABELS / RESPONSE_ICON / RESPONSE_TINT have "class-dj" entries
 *   - The ResponseType union in src/types/index.ts includes "class-dj"
 *   - ActivitySection has the classDjConfig field
 *   - BlockPalette.types.ts exports ClassDjConfig with the expected shape
 *
 * Source-static (file-text regex) — matches the convention in
 * lis-d-editor-wiring.test.ts. Catches wiring regressions without
 * needing the full editor render tree.
 *
 * Behavioural tests of the panel itself (defaults, clamp, onUpdate
 * shape) live in class-dj-config-panel.test.tsx.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ACTIVITY_BLOCK_SRC = readFileSync(
  join(__dirname, "..", "ActivityBlock.tsx"),
  "utf-8",
);

const TYPES_SRC = readFileSync(
  join(__dirname, "..", "..", "..", "..", "types", "index.ts"),
  "utf-8",
);

const BLOCK_PALETTE_TYPES_SRC = readFileSync(
  join(__dirname, "..", "BlockPalette.types.ts"),
  "utf-8",
);

const CONFIG_PANEL_SRC = readFileSync(
  join(__dirname, "..", "ClassDjConfigPanel.tsx"),
  "utf-8",
);

describe("ActivityBlock — Class DJ wiring (Phase 3)", () => {
  it("imports ClassDjConfigPanel", () => {
    expect(ACTIVITY_BLOCK_SRC).toMatch(
      /import ClassDjConfigPanel from "\.\/ClassDjConfigPanel"/,
    );
  });

  it("RESPONSE_TYPES includes 'class-dj'", () => {
    expect(ACTIVITY_BLOCK_SRC).toMatch(
      /RESPONSE_TYPES: ResponseType\[\] = \[[\s\S]{0,400}"class-dj"/,
    );
  });

  it("RESPONSE_TYPE_LABELS maps 'class-dj' → 'Class DJ'", () => {
    expect(ACTIVITY_BLOCK_SRC).toMatch(/"class-dj":\s*"Class DJ"/);
  });

  it("RESPONSE_ICON maps 'class-dj' → music-note emoji", () => {
    expect(ACTIVITY_BLOCK_SRC).toMatch(/"class-dj":\s*"🎵"/);
  });

  it("RESPONSE_TINT maps 'class-dj' → a violet hex", () => {
    expect(ACTIVITY_BLOCK_SRC).toMatch(/"class-dj":\s*"#[0-9A-Fa-f]{6}"/);
  });

  it("renders ClassDjConfigPanel only when responseType === 'class-dj'", () => {
    expect(ACTIVITY_BLOCK_SRC).toMatch(
      /responseType === "class-dj" && \(\s*\n?\s*<ClassDjConfigPanel/,
    );
  });

  it("passes activity + onUpdate props (matches FirstMove convention)", () => {
    expect(ACTIVITY_BLOCK_SRC).toMatch(
      /<ClassDjConfigPanel activity=\{activity\} onUpdate=\{onUpdate\} \/>/,
    );
  });
});

describe("ResponseType union — Phase 3 addition", () => {
  it("'class-dj' is in the exported ResponseType union", () => {
    expect(TYPES_SRC).toMatch(
      /export type ResponseType =[\s\S]{0,400}"class-dj"/,
    );
  });

  it("ActivitySection has classDjConfig field with BlockPalette.types import", () => {
    expect(TYPES_SRC).toMatch(
      /classDjConfig\?:\s*import\("@\/components\/teacher\/lesson-editor\/BlockPalette\.types"\)\.ClassDjConfig/,
    );
  });
});

describe("ClassDjConfig type shape", () => {
  it("exports ClassDjConfig interface from BlockPalette.types.ts", () => {
    expect(BLOCK_PALETTE_TYPES_SRC).toMatch(/export interface ClassDjConfig\b/);
  });

  it("ClassDjConfig declares the three teacher-tunable fields", () => {
    // Three numeric fields per brief §7 lesson-editor config panel.
    expect(BLOCK_PALETTE_TYPES_SRC).toMatch(
      /export interface ClassDjConfig \{[\s\S]{0,600}timerSeconds:\s*number/,
    );
    expect(BLOCK_PALETTE_TYPES_SRC).toMatch(
      /export interface ClassDjConfig \{[\s\S]{0,600}gateMinVotes:\s*number/,
    );
    expect(BLOCK_PALETTE_TYPES_SRC).toMatch(
      /export interface ClassDjConfig \{[\s\S]{0,600}maxSuggestions:\s*number/,
    );
  });
});

describe("ClassDjConfigPanel — source-static checks", () => {
  it("declares DEFAULT_CONFIG with brief-specified defaults (60, 3, 3)", () => {
    expect(CONFIG_PANEL_SRC).toMatch(/timerSeconds:\s*60/);
    expect(CONFIG_PANEL_SRC).toMatch(/gateMinVotes:\s*3/);
    expect(CONFIG_PANEL_SRC).toMatch(/maxSuggestions:\s*3/);
  });

  it("declares constants matching ranges (30–180 / 1–10 / 1–3)", () => {
    // Brief §7 originally specified gate 2-10. Lowered to 1-10 on
    // 14 May 2026 to unblock solo-student smoke testing — see
    // ClassDjConfigPanel.tsx for rationale. Server clamp matches.
    expect(CONFIG_PANEL_SRC).toMatch(/TIMER_MIN\s*=\s*30/);
    expect(CONFIG_PANEL_SRC).toMatch(/TIMER_MAX\s*=\s*180/);
    expect(CONFIG_PANEL_SRC).toMatch(/GATE_MIN\s*=\s*1/);
    expect(CONFIG_PANEL_SRC).toMatch(/GATE_MAX\s*=\s*10/);
    expect(CONFIG_PANEL_SRC).toMatch(/SUGGEST_MIN\s*=\s*1/);
    expect(CONFIG_PANEL_SRC).toMatch(/SUGGEST_MAX\s*=\s*3/);
  });

  it("uses a range slider for timer (touch-friendly UX)", () => {
    expect(CONFIG_PANEL_SRC).toMatch(/type="range"/);
  });

  it("calls onUpdate with classDjConfig patch", () => {
    expect(CONFIG_PANEL_SRC).toMatch(
      /onUpdate\(\{\s*classDjConfig:\s*\{\s*\.\.\.cfg,\s*\.\.\.next\s*\}\s*\}\)/,
    );
  });
});
