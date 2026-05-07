/**
 * Round 32 (7 May 2026, NIS Class 1) — NM survey permanent celebration.
 *
 * Per Matt during Class 1: "after a student completes the NM survey it
 * shows a big pop art 'New Metrics Feedback Done!' as i dont need them
 * to ever go back to a lesson and do it again. they will have other
 * opportunities in following lessons to do NM surveys again".
 *
 * Source-static guards lock:
 *   - The 1.5s setTimeout(onComplete, 1500) is GONE — celebration is
 *     permanent for the lesson session.
 *   - GET endpoint added so the component can detect prior submission
 *     on mount + skip straight to the celebration.
 *   - Component fetches the GET on mount + sets submitted=true if a
 *     prior assessment exists.
 *   - The celebration headline reads "New Metrics Feedback Done!"
 *     (Matt's exact copy) instead of v1's small "Reflection complete!".
 *   - Parent page no longer gates the component on !nmCompleted, so
 *     the celebration stays mounted on the page.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const COMPONENT_SRC = readFileSync(
  join(__dirname, "..", "CompetencyPulse.tsx"),
  "utf-8"
);
const ROUTE_SRC = readFileSync(
  join(
    __dirname,
    "..",
    "..",
    "..",
    "app",
    "api",
    "student",
    "nm-assessment",
    "route.ts"
  ),
  "utf-8"
);
const PAGE_SRC = readFileSync(
  join(
    __dirname,
    "..",
    "..",
    "..",
    "app",
    "(student)",
    "unit",
    "[unitId]",
    "[pageId]",
    "page.tsx"
  ),
  "utf-8"
);

describe("CompetencyPulse — round 32 permanent celebration", () => {
  it("removed the 1.5s auto-dismiss setTimeout(onComplete, 1500)", () => {
    expect(COMPONENT_SRC).not.toMatch(
      /setTimeout\(\(\)\s*=>\s*onComplete\(\),\s*1500\)/
    );
  });

  it("imports useEffect (needed for the prior-submission fetch on mount)", () => {
    expect(COMPONENT_SRC).toMatch(
      /import\s*\{[^}]*\buseEffect\b[^}]*\}\s*from\s*"react"/
    );
  });

  it("fetches GET /api/student/nm-assessment on mount + flips submitted on prior", () => {
    expect(COMPONENT_SRC).toMatch(
      /fetch\(\s*[`'"]\/api\/student\/nm-assessment[\s\S]{0,300}data\?\.submitted[\s\S]{0,80}setSubmitted\(true\)/
    );
  });

  it("celebration headline reads 'New Metrics Feedback Done!'", () => {
    expect(COMPONENT_SRC).toContain("New Metrics");
    expect(COMPONENT_SRC).toContain("Feedback Done!");
  });

  it("celebration block is tagged with the test selector", () => {
    expect(COMPONENT_SRC).toContain('data-testid="nm-survey-complete"');
  });

  it("submit success path STILL calls onComplete (parent tracking)", () => {
    expect(COMPONENT_SRC).toMatch(
      /if\s*\(res\.ok\)\s*\{[\s\S]{0,500}setSubmitted\(true\)[\s\S]{0,200}onComplete\(\)/
    );
  });
});

describe("nm-assessment route — round 32 GET handler", () => {
  it("exports a GET handler", () => {
    expect(ROUTE_SRC).toMatch(/export async function GET\(/);
  });

  it("requires auth + unitId + pageId query params", () => {
    expect(ROUTE_SRC).toMatch(/requireStudentSession/);
    expect(ROUTE_SRC).toMatch(/searchParams\.get\("unitId"\)/);
    expect(ROUTE_SRC).toMatch(/searchParams\.get\("pageId"\)/);
  });

  it("returns { submitted: boolean } based on competency_assessments rows", () => {
    expect(ROUTE_SRC).toMatch(
      /\.from\("competency_assessments"\)[\s\S]{0,300}\.eq\("source",\s*"student_self"\)/
    );
    expect(ROUTE_SRC).toMatch(/submitted:\s*\(data\?\.length\s*\?\?\s*0\)\s*>\s*0/);
  });
});

describe("lesson page — round 32 unconditional CompetencyPulse render", () => {
  it("removed the !nmCompleted gate; component always renders when nmCheckpoint is set", () => {
    expect(PAGE_SRC).toMatch(
      /\{nmCheckpoint && \(\s*<div[\s\S]{0,400}<CompetencyPulse/
    );
    // The old "{nmCheckpoint && !nmCompleted && (" pattern must be gone.
    expect(PAGE_SRC).not.toMatch(
      /\{nmCheckpoint\s*&&\s*!nmCompleted\s*&&\s*\(/
    );
  });
});
