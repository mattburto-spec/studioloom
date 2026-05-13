/**
 * Class DJ — BlockPalette library entry guard.
 *
 * The Templates tab in BlockPalette reads from the hardcoded
 * BLOCK_LIBRARY constant, NOT from activity_blocks DB rows. The Phase 2
 * activity_blocks seed exists in prod (id 52a60643-…) but is only
 * referenced by the lesson-content runtime; the picker needs an explicit
 * library entry too.
 *
 * Source-static (readFileSync) — matches lis-d-editor-wiring.test.ts +
 * class-dj-editor-wiring.test.ts convention. Can't import BLOCK_LIBRARY
 * directly because BlockPalette.tsx contains JSX that vitest's
 * import-analysis chokes on for non-tsx test files.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const PALETTE_SRC = readFileSync(
  join(__dirname, "..", "BlockPalette.tsx"),
  "utf-8",
);

describe("BLOCK_LIBRARY — Class DJ entry (Templates tab)", () => {
  it("has an id: 'class-dj' entry", () => {
    expect(PALETTE_SRC).toMatch(/id:\s*"class-dj"/);
  });

  it("entry is in the 'live' category (renders under Live accordion)", () => {
    expect(PALETTE_SRC).toMatch(
      /id:\s*"class-dj"[\s\S]{0,400}category:\s*"live"/,
    );
  });

  it("entry uses the music-note icon", () => {
    expect(PALETTE_SRC).toMatch(
      /id:\s*"class-dj"[\s\S]{0,400}icon:\s*"🎵"/,
    );
  });

  it("create() ships responseType='class-dj'", () => {
    expect(PALETTE_SRC).toMatch(
      /id:\s*"class-dj"[\s\S]{0,1500}responseType:\s*"class-dj"/,
    );
  });

  it("create() seeds classDjConfig with brief defaults (60s / gate 3 / max 3)", () => {
    expect(PALETTE_SRC).toMatch(
      /id:\s*"class-dj"[\s\S]{0,1500}classDjConfig:\s*\{[\s\S]{0,200}timerSeconds:\s*60/,
    );
    expect(PALETTE_SRC).toMatch(
      /id:\s*"class-dj"[\s\S]{0,1500}gateMinVotes:\s*3/,
    );
    expect(PALETTE_SRC).toMatch(
      /id:\s*"class-dj"[\s\S]{0,1500}maxSuggestions:\s*3/,
    );
  });

  it("create() ships framing/task/success_signal slot fields", () => {
    expect(PALETTE_SRC).toMatch(
      /id:\s*"class-dj"[\s\S]{0,1500}framing:\s*"Music sets the room/,
    );
    expect(PALETTE_SRC).toMatch(
      /id:\s*"class-dj"[\s\S]{0,1500}task:\s*"Tap your vibe/,
    );
    expect(PALETTE_SRC).toMatch(
      /id:\s*"class-dj"[\s\S]{0,1500}success_signal:\s*"Three suggestions/,
    );
  });

  it("defaultPhase is 'opening' (Class DJ fires at the start of a lesson)", () => {
    expect(PALETTE_SRC).toMatch(
      /id:\s*"class-dj"[\s\S]{0,400}defaultPhase:\s*"opening"/,
    );
  });
});
