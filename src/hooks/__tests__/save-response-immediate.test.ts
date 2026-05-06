/**
 * Round 11 (6 May 2026) — saveResponseImmediate plumbing.
 *
 * Source-static guards lock the prop chain through:
 *   usePageResponses (exposes saveResponseImmediate)
 *   → lesson page (passes onSaveResponseImmediate to ActivityCard)
 *   → ActivityCard (forwards to ResponseInput)
 *   → ResponseInput (forwards to StructuredPromptsResponse)
 *   → StructuredPromptsResponse (calls onSaveImmediate after journal save)
 *
 * Without this chain a Process Journal save can be lost if the
 * student navigates away within the 2s autosave debounce window.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const HOOK_SRC = readFileSync(
  join(process.cwd(), "src/hooks/usePageResponses.ts"),
  "utf-8"
);
const PAGE_SRC = readFileSync(
  join(
    process.cwd(),
    "src/app/(student)/unit/[unitId]/[pageId]/page.tsx"
  ),
  "utf-8"
);
const ACTIVITY_CARD_SRC = readFileSync(
  join(process.cwd(), "src/components/student/ActivityCard.tsx"),
  "utf-8"
);
const RESPONSE_INPUT_SRC = readFileSync(
  join(process.cwd(), "src/components/student/ResponseInput.tsx"),
  "utf-8"
);

describe("usePageResponses — onPersistedExplicit refresh hook (round 17)", () => {
  it("usePageResponses signature accepts onPersistedExplicit as the 7th arg", () => {
    expect(HOOK_SRC).toMatch(
      /onPersistedExplicit\?:\s*\(\)\s*=>\s*Promise<void>\s*\|\s*void/
    );
  });

  it("saveResponseImmediate awaits onPersistedExplicit after the saveProgress POST", () => {
    const idx = HOOK_SRC.indexOf("const saveResponseImmediate = useCallback");
    expect(idx).toBeGreaterThan(0);
    const fn = HOOK_SRC.slice(idx, idx + 1500);
    // saveProgress fires first
    expect(fn).toContain('await saveProgress("in_progress"');
    // then onPersistedExplicit (best-effort, wrapped in try/catch)
    expect(fn).toMatch(/await onPersistedExplicit\(\)/);
    expect(fn).toMatch(/onPersistedExplicit failed/);
  });

  it("onPersistedExplicit is in the useCallback deps", () => {
    expect(HOOK_SRC).toMatch(
      /\[saveProgress,\s*onPersistedExplicit\]/
    );
  });

  it("lesson page wires unitNav.refreshProgress as onPersistedExplicit", () => {
    expect(PAGE_SRC).toContain("unitNav ? () => unitNav.refreshProgress() : undefined");
  });
});

describe("usePageResponses — saveResponseImmediate exposure (round 11)", () => {
  it("declares saveResponseImmediate in the return type", () => {
    expect(HOOK_SRC).toMatch(
      /saveResponseImmediate:\s*\(key:\s*string,\s*value:\s*string\)\s*=>\s*Promise<void>/
    );
  });

  it("body sets responsesRef + setResponses + awaits saveProgress", () => {
    const idx = HOOK_SRC.indexOf("const saveResponseImmediate = useCallback");
    expect(idx).toBeGreaterThan(0);
    const fn = HOOK_SRC.slice(idx, idx + 600);
    expect(fn).toContain("responsesRef.current = next");
    expect(fn).toContain("setResponses(next)");
    expect(fn).toMatch(/await saveProgress\("in_progress",\s*\{\s*silent:\s*true\s*\}\)/);
  });

  it("returns saveResponseImmediate alongside saveProgress in the hook output", () => {
    expect(HOOK_SRC).toMatch(
      /return\s*\{[\s\S]{0,400}saveResponseImmediate,/
    );
  });
});

describe("Lesson page wires saveResponseImmediate into ActivityCard", () => {
  it("destructures saveResponseImmediate from usePageResponses", () => {
    expect(PAGE_SRC).toContain("saveResponseImmediate");
  });

  it("ActivityCard receives onSaveResponseImmediate prop", () => {
    expect(PAGE_SRC).toMatch(
      /onSaveResponseImmediate=\{\(val\)\s*=>\s*\{[\s\S]{0,300}saveResponseImmediate\(responseKey,\s*val\)/
    );
  });
});

describe("ActivityCard forwards onSaveResponseImmediate to ResponseInput", () => {
  it("declares the prop on the interface", () => {
    expect(ACTIVITY_CARD_SRC).toMatch(
      /onSaveResponseImmediate\?:\s*\(value:\s*string\)\s*=>\s*Promise<void>/
    );
  });

  it("forwards the prop to <ResponseInput>", () => {
    expect(ACTIVITY_CARD_SRC).toContain(
      "onSaveResponseImmediate={onSaveResponseImmediate}"
    );
  });
});

describe("ResponseInput forwards to <StructuredPromptsResponse>", () => {
  it("declares the prop", () => {
    expect(RESPONSE_INPUT_SRC).toMatch(
      /onSaveResponseImmediate\?:\s*\(value:\s*string\)\s*=>\s*Promise<void>/
    );
  });

  it("renames + threads to onSaveImmediate prop on StructuredPromptsResponse", () => {
    expect(RESPONSE_INPUT_SRC).toContain(
      "onSaveImmediate={onSaveResponseImmediate}"
    );
  });
});
