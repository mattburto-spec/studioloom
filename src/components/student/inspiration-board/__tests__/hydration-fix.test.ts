/**
 * InspirationBoardBlock — async-value hydration fix.
 *
 * Matt smoke 14 May 2026: student-uploaded images visible to the
 * teacher in /teacher/marking but NOT in the student's own lesson
 * view. Root cause: the IB block used `useState(() => parseValue(value))`
 * which only runs on mount. When the lesson page mounts with
 * `value=""` and the server response arrives ~200ms later updating
 * `value` to the saved JSON, the block didn't re-hydrate.
 *
 * Fix: useEffect watches `value` and re-parses on external change.
 * useRef guard prevents a clobber loop on user edits (user types →
 * persist → onChange → parent value updates → would re-fire effect
 * but ref short-circuits because we know it's our own emission).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(
  join(__dirname, "..", "InspirationBoardBlock.tsx"),
  "utf-8",
);

describe("InspirationBoardBlock — async-value hydration (Matt smoke 14 May 2026)", () => {
  it("declares a useEffect that re-parses `value` when it changes externally", () => {
    expect(src).toMatch(
      /useEffect\(\(\)\s*=>\s*\{[\s\S]*?setState\(parseValue\(value\)\)/,
    );
  });

  it("effect dep array contains value (not [], not [activityId])", () => {
    expect(src).toMatch(
      /setState\(parseValue\(value\)\);\s*\n\s*\},\s*\[value\]\)/,
    );
  });

  it("useRef tracks the last serialized value to short-circuit re-hydration loops", () => {
    expect(src).toMatch(
      /lastSerializedRef\s*=\s*useRef<string>\(value\)/,
    );
  });

  it("hydration effect short-circuits when value matches the last persisted JSON", () => {
    expect(src).toMatch(
      /if\s*\(value\s*===\s*lastSerializedRef\.current\)\s*return/,
    );
  });

  it("persist() updates lastSerializedRef BEFORE setState + onChange", () => {
    expect(src).toMatch(
      /const serialized\s*=\s*JSON\.stringify\(next\);[\s\S]*?lastSerializedRef\.current\s*=\s*serialized;[\s\S]*?setState\(next\);[\s\S]*?onChange\(serialized\)/,
    );
  });

  it("useRef is imported from react", () => {
    expect(src).toMatch(
      /import\s*\{[^}]*useRef[^}]*\}\s*from\s*"react"/,
    );
  });

  it("initial useState still uses parseValue(value) lazy init (mount-time hydration preserved)", () => {
    // The mount-time hydration was already correct — we're only
    // ADDING the async-load handling, not replacing the lazy init.
    expect(src).toMatch(
      /useState<BoardState>\(\(\)\s*=>\s*parseValue\(value\)\)/,
    );
  });
});
