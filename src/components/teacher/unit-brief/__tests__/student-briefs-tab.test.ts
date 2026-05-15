/**
 * Source-static structural tests for the Phase F.E Student briefs tab +
 * its integration with the existing /teacher/units/[unitId]/brief page.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const tabSrc = readFileSync(
  join(__dirname, "..", "StudentBriefsTab.tsx"),
  "utf-8",
);
const pageSrc = readFileSync(
  join(
    __dirname,
    "..",
    "..",
    "..",
    "..",
    "app",
    "teacher",
    "units",
    "[unitId]",
    "brief",
    "page.tsx",
  ),
  "utf-8",
);

describe("StudentBriefsTab — structure (Phase F.E)", () => {
  it("fetches the new student-briefs endpoint with unitId query param", () => {
    expect(tabSrc).toMatch(
      /fetch\(\s*`\/api\/teacher\/unit-brief\/student-briefs\?unitId=\$\{encodeURIComponent\(unitId\)\}`/,
    );
  });

  it("renders 3 distinct states: loading / error / empty / list", () => {
    expect(tabSrc).toMatch(/data-testid="student-briefs-tab-loading"/);
    expect(tabSrc).toMatch(/data-testid="student-briefs-tab-error"/);
    expect(tabSrc).toMatch(/data-testid="student-briefs-tab-empty"/);
    expect(tabSrc).toMatch(/data-testid="student-briefs-tab"/);
  });

  it("each student renders as a card keyed by student_id", () => {
    expect(tabSrc).toMatch(/data-testid=\{`student-brief-card-\$\{brief\.student_id\}`\}/);
    expect(tabSrc).toMatch(/data-testid=\{`student-brief-name-\$\{brief\.student_id\}`\}/);
  });

  it("shows the picked choice card label as a purple chip when present", () => {
    expect(tabSrc).toContain("brief.choice_card_label");
    expect(tabSrc).toMatch(/bg-purple-100/);
  });

  it("renders brief_text inline (skipped when null/empty)", () => {
    expect(tabSrc).toMatch(
      /brief\.brief_text !== null && brief\.brief_text\.length > 0/,
    );
    expect(tabSrc).toMatch(/data-testid=\{`student-brief-text-\$\{brief\.student_id\}`\}/);
  });

  it("renders Design constraints only when archetype is design + data non-empty", () => {
    expect(tabSrc).toMatch(/brief\.constraints\.archetype === "design"/);
    expect(tabSrc).toMatch(/Object\.keys\(designData\)\.length > 0/);
  });

  it("MATERIAL_LABEL_BY_ID maps catalogue ids → labels (custom materials fall through)", () => {
    expect(tabSrc).toContain("MATERIAL_LABEL_BY_ID");
    expect(tabSrc).toMatch(/MATERIAL_LABEL_BY_ID\.get\(m\)\s*\?\?\s*m/);
  });

  it("relative date formatter — '5 min ago' / '2h ago' / fallback to locale date", () => {
    expect(tabSrc).toContain("min ago");
    expect(tabSrc).toContain("h ago");
    expect(tabSrc).toContain("toLocaleDateString");
  });

  it("read-only — no input/textarea/button for editing student briefs", () => {
    // F.E is review-only. Editing student briefs from the teacher
    // surface is out of scope (students own their authoring).
    expect(tabSrc).not.toMatch(/<input/);
    expect(tabSrc).not.toMatch(/<textarea/);
    expect(tabSrc).not.toMatch(/onSave/);
  });
});

describe("brief page — tab container (Phase F.E)", () => {
  it("imports both UnitBriefEditor and StudentBriefsTab", () => {
    expect(pageSrc).toMatch(
      /import \{ UnitBriefEditor \} from "@\/components\/teacher\/unit-brief\/UnitBriefEditor"/,
    );
    expect(pageSrc).toMatch(
      /import \{ StudentBriefsTab \} from "@\/components\/teacher\/unit-brief\/StudentBriefsTab"/,
    );
  });

  it("local tab state — Phase F.E spec deferred URL deeplink", () => {
    expect(pageSrc).toMatch(
      /const \[tab, setTab\] = useState<TabKey>\("brief"\)/,
    );
    expect(pageSrc).not.toMatch(/useSearchParams/);
  });

  it("renders both tab buttons with stable testids", () => {
    expect(pageSrc).toMatch(/data-testid=\{`brief-tab-\$\{tab\}`\}/);
    expect(pageSrc).toContain('<TabButton');
  });

  it("aria-selected + role=tablist for a11y", () => {
    expect(pageSrc).toMatch(/role="tablist"/);
    expect(pageSrc).toMatch(/aria-selected=\{active\}/);
  });

  it("ternary swap: Brief tab → UnitBriefEditor; Students tab → StudentBriefsTab", () => {
    expect(pageSrc).toMatch(
      /tab === "brief" \?[\s\S]*?<UnitBriefEditor[\s\S]*?<StudentBriefsTab/,
    );
  });
});
