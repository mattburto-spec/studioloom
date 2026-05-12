/**
 * TFL.3 C.3.3 — persistent (server-side) thread resolution.
 *
 * Replaces the localStorage approach from the abandoned PR #208 with
 * a real POST → student_tile_grades.resolved_at write. The new column
 * lives in migration 20260512023440.
 *
 * Cross-device: Matt's school laptop + home laptop now see the same
 * resolution state because it lives in the DB, not localStorage.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "..", "page.tsx"), "utf-8");

describe("/teacher/inbox C.3.3 — handleResolve POST handler", () => {
  it("posts to /api/teacher/grading/resolve-thread with grade_id + resolved=true", () => {
    expect(src).toMatch(/const handleResolve\s*=\s*React\.useCallback/);
    expect(src).toContain('"/api/teacher/grading/resolve-thread"');
    expect(src).toMatch(
      /body:\s*JSON\.stringify\(\{\s*grade_id:\s*item\.gradeId,\s*resolved:\s*true\s*\}\)/,
    );
  });

  it("optimistically hides the item via skipped Set before the network roundtrip", () => {
    // The polling refetch can be up to 60s away; instant local hide
    // makes the UX feel snappy. If POST fails, the catch un-skips
    // and surfaces an alert.
    expect(src).toMatch(
      /setResolving[\s\S]*?setSkipped\(\(prev\)\s*=>\s*new\s+Set\(prev\)\.add\(itemKey\)\)/,
    );
  });

  it("rolls back the optimistic skip on POST failure", () => {
    expect(src).toMatch(
      /\/\/ Restore: un-skip[\s\S]*?next\.delete\(itemKey\)/,
    );
    // Plus an alert so the teacher knows the click didn't take.
    expect(src).toMatch(/alert\(err instanceof Error/);
  });

  it("on success drops the row from local items (count + auto-select update)", () => {
    expect(src).toMatch(
      /setItems\(\(prev\)\s*=>[\s\S]*?\.filter\(\(p\)\s*=>\s*p\.itemKey\s*!==\s*itemKey\)/,
    );
  });

  it("tracks per-item resolving state (so multiple buttons don't double-fire)", () => {
    expect(src).toMatch(
      /resolving,\s*setResolving\]\s*=\s*React\.useState<Record<string,\s*boolean>>/,
    );
  });
});

describe("/teacher/inbox C.3.3 — Mark resolved button wiring", () => {
  it("Mark resolved button calls onResolve (NOT onSkip)", () => {
    expect(src).toMatch(
      /data-testid="inbox-mark-resolved-button"[\s\S]*?onClick=\{onResolve\}/,
    );
  });

  it("button disables during the in-flight POST (resolving=true)", () => {
    expect(src).toMatch(/disabled=\{approving\s*\|\|\s*resolving\}/);
  });

  it("button label flips to 'Resolving…' while POST is in flight", () => {
    expect(src).toMatch(
      /resolving\s*\?\s*"Resolving…"\s*:\s*"✓ Mark resolved"/,
    );
  });

  it("DetailPane signature accepts onResolve + resolving props", () => {
    expect(src).toMatch(/onResolve:\s*\(\)\s*=>\s*void/);
    expect(src).toMatch(/resolving:\s*boolean/);
  });

  it("parent passes handleResolve + resolving[itemKey] into DetailPane", () => {
    expect(src).toMatch(/onResolve=\{handleResolve\}/);
    expect(src).toMatch(/resolving=\{!!resolving\[selectedItem\.itemKey\]\}/);
  });
});

describe("/teacher/inbox C.3.3 — no localStorage residue", () => {
  it("no longer references RESOLVED_STORAGE_KEY (abandoned PR #208 pattern)", () => {
    expect(src).not.toMatch(/RESOLVED_STORAGE_KEY/);
  });

  it("no localStorage.setItem / getItem / removeItem calls for resolution", () => {
    // Scoped to lines mentioning "resolved" so we don't false-positive
    // any unrelated localStorage usage.
    const resolvedLines = src
      .split("\n")
      .filter((l) => /resolv/i.test(l))
      .join("\n");
    expect(resolvedLines).not.toMatch(/localStorage\.(set|get|remove)Item/);
  });
});
