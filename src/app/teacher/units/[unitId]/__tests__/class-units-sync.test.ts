/**
 * Unit page ↔ class page assignment sync.
 *
 * Pre-Block-B (Phase: "One active unit per class enforced at DB level",
 * 16 May 2026): both pages did direct class_units writes — the unit page
 * used `.upsert({ is_active: true })` on the activate path and `.update({
 * is_active: false })` on the deactivate path. The class page used
 * `.update({ is_active: isActive })` / `.insert({ is_active: isActive })`.
 *
 * Post-Block-B: both pages route the ACTIVATE path through the atomic
 * RPC helper `setActiveUnit(supabase, classId, unitId)` so that the
 * partial unique index `class_units_one_active_per_class` (migration
 * 20260515214045) is never tripped. The deactivate paths remain direct
 * `.update({ is_active: false })` writes — going from "1 active" to
 * "0 active" doesn't violate the partial unique, no helper needed.
 *
 * Lesson #29 — soft-removed rows are filtered on read via
 * `.eq("is_active", true)`. Lesson #39 — both write sites refactored
 * together; the third writer audit returned zero new callsites.
 *
 * Source-static — mirrors the dispatch-test pattern used across the
 * codebase. NC at the bottom mutates an in-memory copy of each page
 * source and confirms the assertion fails.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const UNIT_PAGE_SRC = readFileSync(
  join(__dirname, "..", "page.tsx"),
  "utf-8",
);

const CLASS_PAGE_SRC = readFileSync(
  join(
    __dirname,
    "..",
    "..",
    "..",
    "classes",
    "[classId]",
    "page.tsx",
  ),
  "utf-8",
);

describe("Unit page — class_units read filters on is_active=true", () => {
  it("the assignment-list fetch filters on is_active=true (soft-removed rows excluded)", () => {
    // Pre-fix the line was:
    //   .from("class_units").select(...).eq("unit_id", unitId)
    // Post-fix it gains:
    //   .eq("is_active", true)
    expect(UNIT_PAGE_SRC).toMatch(
      /from\("class_units"\)[\s\S]{0,300}\.eq\("unit_id", unitId\)[\s\S]{0,200}\.eq\("is_active", true\)/,
    );
  });
});

describe("Unit page — toggleClassAssignment refactored to use setActiveUnit (Block B)", () => {
  it("imports setActiveUnit from the canonical helper module", () => {
    expect(UNIT_PAGE_SRC).toMatch(
      /import\s*\{\s*setActiveUnit\s*\}\s*from\s*"@\/lib\/classes\/active-unit"/,
    );
  });

  it("activate path (else branch — !currentlyAssigned) calls setActiveUnit with (supabase, classId, unitId)", () => {
    // The else branch is the activate path — the previous-active upsert
    // is replaced by an RPC call through the helper. We grep for the
    // call shape inside the toggleClassAssignment function body.
    const fnIdx = UNIT_PAGE_SRC.indexOf(
      "async function toggleClassAssignment",
    );
    expect(fnIdx).toBeGreaterThan(0);
    // The whole function body fits within ~3500 chars after the signature.
    const fnSlice = UNIT_PAGE_SRC.slice(fnIdx, fnIdx + 3500);
    expect(fnSlice).toMatch(
      /setActiveUnit\(\s*supabase\s*,\s*classId\s*,\s*unitId\s*\)/,
    );
  });

  it("activate path no longer uses .upsert with is_active: true", () => {
    // The pre-Block-B activate path used:
    //   .upsert({ class_id, unit_id, is_active: true })
    // After Block B, this pattern must not appear anywhere in the file
    // (and the activate path is now setActiveUnit instead).
    expect(UNIT_PAGE_SRC).not.toMatch(
      /\.upsert\(\{[\s\S]{0,200}is_active:\s*true/,
    );
  });
});

describe("Unit page — deactivate path uses soft-toggle (consistent with class page)", () => {
  it("removeAssignment path UPDATEs is_active=false (not DELETE)", () => {
    // Look for the currentlyAssigned branch — the remove path.
    const idx = UNIT_PAGE_SRC.indexOf("if (currentlyAssigned)");
    expect(idx).toBeGreaterThan(0);
    const slice = UNIT_PAGE_SRC.slice(idx, idx + 1500);
    expect(slice).toContain(`.update({ is_active: false })`);
    // Hard DELETE on class_units must be gone from this branch.
    expect(slice).not.toMatch(/\.from\("class_units"\)[\s\S]{0,200}\.delete\(\)/);
  });
});

describe("Class page — toggleUnit refactored to use setActiveUnit (Block B)", () => {
  it("imports setActiveUnit from the canonical helper module", () => {
    expect(CLASS_PAGE_SRC).toMatch(
      /import\s*\{\s*setActiveUnit\s*\}\s*from\s*"@\/lib\/classes\/active-unit"/,
    );
  });

  it("activate path (isActive=true branch) calls setActiveUnit with (supabase, classId, unitId)", () => {
    const fnIdx = CLASS_PAGE_SRC.indexOf("async function toggleUnit(unitId:");
    expect(fnIdx).toBeGreaterThan(0);
    const fnSlice = CLASS_PAGE_SRC.slice(fnIdx, fnIdx + 3500);
    expect(fnSlice).toMatch(
      /setActiveUnit\(\s*supabase\s*,\s*classId\s*,\s*unitId\s*\)/,
    );
  });

  it("deactivate path still narrow-updates is_active=false", () => {
    const fnIdx = CLASS_PAGE_SRC.indexOf("async function toggleUnit(unitId:");
    const fnSlice = CLASS_PAGE_SRC.slice(fnIdx, fnIdx + 3500);
    expect(fnSlice).toMatch(
      /\.from\("class_units"\)[\s\S]{0,400}\.update\(\{\s*is_active:\s*false\s*\}\)/,
    );
  });

  it("activate path no longer uses .update with is_active: isActive (pre-Block-B pattern)", () => {
    // The pre-Block-B activate pattern was:
    //   .update({ is_active: isActive })
    // After Block B, the only narrow update writes is_active=false; the
    // generic isActive variable no longer appears on either side of the
    // .update payload because the branch is split.
    const fnIdx = CLASS_PAGE_SRC.indexOf("async function toggleUnit(unitId:");
    const fnSlice = CLASS_PAGE_SRC.slice(fnIdx, fnIdx + 3500);
    expect(fnSlice).not.toMatch(
      /\.update\(\{\s*is_active:\s*isActive\s*\}\)/,
    );
  });

  it("activate path no longer uses .insert with is_active: isActive (pre-Block-B pattern)", () => {
    const fnIdx = CLASS_PAGE_SRC.indexOf("async function toggleUnit(unitId:");
    const fnSlice = CLASS_PAGE_SRC.slice(fnIdx, fnIdx + 3500);
    expect(fnSlice).not.toMatch(
      /\.insert\(\{[\s\S]{0,200}is_active:\s*isActive/,
    );
  });
});

describe("Both pages — error toast surface (Block B step 3)", () => {
  it("unit page renders the toggleClassError toast banner", () => {
    expect(UNIT_PAGE_SRC).toMatch(/\{toggleClassError\s*\?/);
  });

  it("class page renders the toggleUnitError toast banner", () => {
    expect(CLASS_PAGE_SRC).toMatch(/\{toggleUnitError\s*\?/);
  });

  it("both pages declare toastForRpcCode that maps 42501 + 23505", () => {
    for (const src of [UNIT_PAGE_SRC, CLASS_PAGE_SRC]) {
      expect(src).toMatch(/function toastForRpcCode\(/);
      expect(src).toMatch(/code === "42501"/);
      expect(src).toMatch(/code === "23505"/);
    }
  });
});

describe("NC (Lesson #46) — the setActiveUnit assertion is load-bearing on both pages", () => {
  const ACTIVATE_CALL_REGEX =
    /setActiveUnit\(\s*supabase\s*,\s*classId\s*,\s*unitId\s*\)/;

  it("unit page: removing the setActiveUnit call makes the activate-path assertion fail", () => {
    const mutated = UNIT_PAGE_SRC.replace(
      ACTIVATE_CALL_REGEX,
      "/* setActiveUnit call removed by NC */",
    );
    expect(mutated).not.toBe(UNIT_PAGE_SRC);
    expect(mutated).not.toMatch(ACTIVATE_CALL_REGEX);
    // Confirm the original still matches — no file mutation occurred.
    const reloaded = readFileSync(join(__dirname, "..", "page.tsx"), "utf-8");
    expect(reloaded).toBe(UNIT_PAGE_SRC);
    expect(reloaded).toMatch(ACTIVATE_CALL_REGEX);
  });

  it("class page: removing the setActiveUnit call makes the activate-path assertion fail", () => {
    const mutated = CLASS_PAGE_SRC.replace(
      ACTIVATE_CALL_REGEX,
      "/* setActiveUnit call removed by NC */",
    );
    expect(mutated).not.toBe(CLASS_PAGE_SRC);
    expect(mutated).not.toMatch(ACTIVATE_CALL_REGEX);
    const reloaded = readFileSync(
      join(
        __dirname,
        "..",
        "..",
        "..",
        "classes",
        "[classId]",
        "page.tsx",
      ),
      "utf-8",
    );
    expect(reloaded).toBe(CLASS_PAGE_SRC);
    expect(reloaded).toMatch(ACTIVATE_CALL_REGEX);
  });
});
