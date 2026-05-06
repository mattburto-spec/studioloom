/**
 * Round 27 (7 May 2026) — Inline unit-title rename in the lesson editor.
 *
 * Per Matt: "need to be able to change the name of the unit in the unit
 * editor". Was a real gap — only page titles were editable, unit title
 * was read-only.
 *
 * Source-static guards lock the contract:
 *   1. useLessonEditor exposes a renameUnit(string) function
 *   2. LessonSidebar accepts an optional onRenameUnit callback
 *   3. The title-strip toggles between a button (display) and an
 *      autoFocused input (edit), with Enter / Escape / blur behavior
 *   4. LessonEditor wires renameUnit → LessonSidebar.onRenameUnit
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const HOOK_SRC = readFileSync(
  join(__dirname, "..", "useLessonEditor.ts"),
  "utf-8"
);
const SIDEBAR_SRC = readFileSync(
  join(__dirname, "..", "LessonSidebar.tsx"),
  "utf-8"
);
const EDITOR_SRC = readFileSync(
  join(__dirname, "..", "LessonEditor.tsx"),
  "utf-8"
);

describe("useLessonEditor — round 27 renameUnit", () => {
  it("imports the supabase client (needed for the units update)", () => {
    expect(HOOK_SRC).toContain('from "@/lib/supabase/client"');
  });

  it("declares renameUnit in the return type as Promise<void>", () => {
    expect(HOOK_SRC).toMatch(/renameUnit:\s*\(newTitle:\s*string\)\s*=>\s*Promise<void>/);
  });

  it("renameUnit is wrapped in useCallback with [unitId, unitTitle] deps", () => {
    expect(HOOK_SRC).toMatch(
      /const renameUnit = useCallback\([\s\S]{0,800}\[unitId,\s*unitTitle\]/
    );
  });

  it("renameUnit optimistically updates local state then PATCHes units.title", () => {
    expect(HOOK_SRC).toMatch(/setUnitTitle\(trimmed\)/);
    expect(HOOK_SRC).toMatch(
      /\.from\("units"\)[\s\S]{0,80}\.update\(\{\s*title:\s*trimmed\s*\}\)[\s\S]{0,80}\.eq\("id",\s*unitId\)/
    );
  });

  it("renameUnit reverts local state on persistence failure + throws", () => {
    expect(HOOK_SRC).toMatch(
      /if\s*\(error\)\s*\{[\s\S]{0,200}setUnitTitle\(previous\)[\s\S]{0,200}throw new Error/
    );
  });

  it("returns renameUnit alongside the existing setThumbnailUrl", () => {
    expect(HOOK_SRC).toMatch(/setThumbnailUrl,\s*renameUnit,/);
  });
});

describe("LessonSidebar — round 27 inline title editor", () => {
  it("accepts an optional onRenameUnit callback in props", () => {
    expect(SIDEBAR_SRC).toMatch(
      /onRenameUnit\?:\s*\(newTitle:\s*string\)\s*=>\s*Promise<void>\s*\|\s*void/
    );
  });

  it("declares titleDraft + savingTitle local state", () => {
    expect(SIDEBAR_SRC).toMatch(/\[titleDraft,\s*setTitleDraft\][\s\S]{0,100}useState/);
    expect(SIDEBAR_SRC).toMatch(/\[savingTitle,\s*setSavingTitle\][\s\S]{0,100}useState/);
  });

  it("commitTitleEdit bails on empty/unchanged + skips when no callback", () => {
    expect(SIDEBAR_SRC).toContain("commitTitleEdit");
    expect(SIDEBAR_SRC).toMatch(/!trimmed\s*\|\|\s*trimmed === unitTitle/);
    expect(SIDEBAR_SRC).toMatch(/if\s*\(!onRenameUnit\)/);
  });

  it("renders a button when titleDraft === null (display mode)", () => {
    expect(SIDEBAR_SRC).toMatch(/titleDraft === null \?/);
    expect(SIDEBAR_SRC).toContain('data-testid="lesson-sidebar-unit-title"');
  });

  it("renders an autoFocused input in edit mode with Enter/Escape handlers", () => {
    expect(SIDEBAR_SRC).toContain('data-testid="lesson-sidebar-unit-title-input"');
    expect(SIDEBAR_SRC).toContain("autoFocus");
    expect(SIDEBAR_SRC).toMatch(/e\.key === "Enter"[\s\S]{0,100}\.blur\(\)/);
    expect(SIDEBAR_SRC).toMatch(/e\.key === "Escape"[\s\S]{0,80}setTitleDraft\(null\)/);
  });

  it("commits on blur (no extra Save button — keeps the strip compact)", () => {
    expect(SIDEBAR_SRC).toContain("onBlur={commitTitleEdit}");
  });

  it("button is disabled when no onRenameUnit callback is wired", () => {
    expect(SIDEBAR_SRC).toMatch(/disabled=\{!onRenameUnit\}/);
  });
});

describe("LessonEditor — round 27 wires the rename through", () => {
  it("destructures renameUnit from useLessonEditor", () => {
    expect(EDITOR_SRC).toMatch(/setThumbnailUrl,\s*renameUnit,/);
  });

  it("passes renameUnit to LessonSidebar as onRenameUnit", () => {
    expect(EDITOR_SRC).toContain("onRenameUnit={renameUnit}");
  });
});
