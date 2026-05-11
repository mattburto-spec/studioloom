/**
 * class_units / is_active read-site audit — batch source-static test.
 *
 * Same root cause as PRs #189 (toggle list), #196 (units listing +
 * versions banner), #199 (teacher dashboard schedule). After Matt
 * smoke caught the symptom on three different surfaces, a proactive
 * audit of every class_units read site revealed 9 more reads where
 * soft-removed (is_active=false) assignments could still surface:
 *
 *   1. /api/student/insights — student insight cards (unit_id list)
 *   2. /api/student/insights — student NM checkpoint card list
 *   3. /api/student/nm-assessment — NM config lookup by (classIds, unitId)
 *   4. /api/student/nm-checkpoint/[pageId] — same NM config lookup
 *   5. /api/student/open-studio/check-in — framework resolution probe
 *   6. /api/student/safety/pending — badge requirement unit list
 *   7. src/lib/design-assistant/conversation.ts — legacy fallback
 *      framework probe (students.class_id path)
 *   8. src/lib/design-assistant/conversation.ts — class_students path
 *      framework probe
 *   9. /teacher/teach/[unitId] — teach-mode class picker
 *  10. /teacher/units/[unitId]/edit — first-class redirect target
 *
 * The fix: every read above chains .eq("is_active", true). This file
 * source-statics each one so future regressions (adding a new
 * surface that forgets the filter, or removing the filter from an
 * existing one) trip a test, not a smoke round.
 *
 * Scope note: writes / probes that target a single explicit
 * (class_id, unit_id) pair are intentionally NOT in this audit —
 * those are usually editing the assignment itself (toggle, fork,
 * promote, nm-config update) and need to see soft-removed rows.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const REPO_ROOT = join(__dirname, "..", "..");

function readSrc(relPath: string): string {
  return readFileSync(join(REPO_ROOT, relPath), "utf-8");
}

describe("class_units is_active audit — student-side reads", () => {
  it("/api/student/insights — unit_id list filters is_active=true", () => {
    const src = readSrc("src/app/api/student/insights/route.ts");
    // The first class_units fetch (unit_id list driving insight cards)
    expect(src).toMatch(
      /from\("class_units"\)\s*\.select\("unit_id"\)[\s\S]{0,200}\.eq\("is_active",\s*true\)/,
    );
  });

  it("/api/student/insights — NM checkpoint card list filters is_active=true", () => {
    const src = readSrc("src/app/api/student/insights/route.ts");
    // The second class_units fetch (nm_config list driving NM checkpoints)
    expect(src).toMatch(
      /from\("class_units"\)\s*\.select\("nm_config"\)[\s\S]{0,200}\.eq\("is_active",\s*true\)/,
    );
  });

  it("/api/student/nm-assessment — NM config lookup filters is_active=true", () => {
    const src = readSrc("src/app/api/student/nm-assessment/route.ts");
    expect(src).toMatch(
      /from\("class_units"\)\s*\.select\("class_id,\s*nm_config"\)[\s\S]{0,200}\.eq\("is_active",\s*true\)/,
    );
  });

  it("/api/student/nm-checkpoint/[pageId] — NM config lookup filters is_active=true", () => {
    const src = readSrc("src/app/api/student/nm-checkpoint/[pageId]/route.ts");
    expect(src).toMatch(
      /from\("class_units"\)\s*\.select\("nm_config"\)[\s\S]{0,200}\.eq\("is_active",\s*true\)/,
    );
  });

  it("/api/student/open-studio/check-in — framework probe filters is_active=true", () => {
    const src = readSrc("src/app/api/student/open-studio/check-in/route.ts");
    expect(src).toMatch(
      /from\("class_units"\)[\s\S]{0,300}\.eq\("is_active",\s*true\)[\s\S]{0,100}\.maybeSingle\(\)/,
    );
  });

  it("/api/student/safety/pending — badge requirement unit list filters is_active=true", () => {
    const src = readSrc("src/app/api/student/safety/pending/route.ts");
    expect(src).toMatch(
      /from\("class_units"\)\s*\.select\("unit_id"\)[\s\S]{0,200}\.eq\("is_active",\s*true\)/,
    );
  });
});

describe("class_units is_active audit — design-assistant conversation framework probes", () => {
  it("legacy students.class_id fallback path filters is_active=true", () => {
    const src = readSrc("src/lib/design-assistant/conversation.ts");
    // The single-class fallback probe (uses student.class_id directly)
    expect(src).toMatch(
      /from\("class_units"\)\s*\.select\("class_id"\)\s*\.eq\("class_id",\s*student\.class_id\)[\s\S]{0,200}\.eq\("is_active",\s*true\)/,
    );
  });

  it("class_students[] path filters is_active=true", () => {
    const src = readSrc("src/lib/design-assistant/conversation.ts");
    // The multi-class probe (.in("class_id", classIds))
    expect(src).toMatch(
      /from\("class_units"\)\s*\.select\("class_id"\)\s*\.eq\("unit_id",\s*unitId\)\s*\.in\("class_id",\s*classIds\)\s*\.eq\("is_active",\s*true\)/,
    );
  });
});

describe("class_units is_active audit — teacher-side reads", () => {
  it("/teacher/teach/[unitId] — class picker filters is_active=true", () => {
    const src = readSrc("src/app/teacher/teach/[unitId]/page.tsx");
    expect(src).toMatch(
      /from\("class_units"\)\s*\.select\("class_id,\s*content_data,\s*classes\(id,\s*name,\s*code\)"\)[\s\S]{0,200}\.eq\("is_active",\s*true\)/,
    );
  });

  it("/teacher/units/[unitId]/edit — first-class redirect target filters is_active=true", () => {
    const src = readSrc("src/app/teacher/units/[unitId]/edit/page.tsx");
    expect(src).toMatch(
      /from\("class_units"\)\s*\.select\("class_id"\)\s*\.eq\("unit_id",\s*unitId\)\s*\.eq\("is_active",\s*true\)/,
    );
  });
});
