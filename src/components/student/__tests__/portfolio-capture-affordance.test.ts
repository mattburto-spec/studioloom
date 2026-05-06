/**
 * Round 14 (6 May 2026) — subtle "Send to Portfolio" affordance on
 * any non-empty student response.
 *
 * Per Matt: "there should be a 'send to portfolio' for all blocks in
 * a lesson... dont want it to be too obvious as i dont want 'send to
 * portfolio' buttons all through the lesson page — more of a mouseover
 * on that section and you can see the option appear in a subtle way."
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const AFFORDANCE_SRC = readFileSync(
  join(__dirname, "..", "PortfolioCaptureAffordance.tsx"),
  "utf-8"
);

const ACTIVITY_CARD_SRC = readFileSync(
  join(__dirname, "..", "ActivityCard.tsx"),
  "utf-8"
);

describe("PortfolioCaptureAffordance", () => {
  it("posts to /api/student/portfolio with type='auto' + pageId + sectionIndex", () => {
    expect(AFFORDANCE_SRC).toContain('fetch("/api/student/portfolio"');
    const idx = AFFORDANCE_SRC.indexOf('fetch("/api/student/portfolio"');
    const slice = AFFORDANCE_SRC.slice(idx, idx + 600);
    expect(slice).toContain('type: "auto"');
    expect(slice).toContain("pageId,");
    expect(slice).toContain("sectionIndex,");
  });

  it("extracts media_url when value is a JSON-encoded upload payload", () => {
    expect(AFFORDANCE_SRC).toMatch(
      /parsed\.type === "upload"[\s\S]{0,200}mediaUrl\s*=\s*parsed\.url/
    );
  });

  it("disabled state when value is empty / whitespace", () => {
    expect(AFFORDANCE_SRC).toMatch(
      /isEmpty\s*=\s*!value\s*\|\|\s*\(typeof value === "string" && value\.trim\(\) === ""\)/
    );
    expect(AFFORDANCE_SRC).toContain("disabled={isEmpty");
  });

  it("subtle visibility — opacity-0 default, group-hover lifts to 70%", () => {
    expect(AFFORDANCE_SRC).toContain(
      'opacity-0 group-hover:opacity-70 focus-within:opacity-100'
    );
  });

  it("renders ✓ Sent toast for ~2.4s after success", () => {
    expect(AFFORDANCE_SRC).toContain('data-testid="portfolio-capture-toast"');
    expect(AFFORDANCE_SRC).toContain("Sent to Portfolio");
    expect(AFFORDANCE_SRC).toMatch(/setTimeout\(\(\)\s*=>\s*setStatus\("idle"\),\s*2400\)/);
  });

  it("error path shows inline error msg + auto-recovers after 3.5s", () => {
    expect(AFFORDANCE_SRC).toContain('data-testid="portfolio-capture-error"');
    // Recovery
    expect(AFFORDANCE_SRC).toMatch(/setTimeout\(\(\)\s*=>\s*\{[\s\S]{0,200}setStatus\("idle"\)[\s\S]{0,200}\},\s*3500\)/);
  });

  it("button has affordance testid for smoke selectors", () => {
    expect(AFFORDANCE_SRC).toContain('data-testid="portfolio-capture-affordance"');
  });
});

describe("ActivityCard mounts the affordance with correct gating", () => {
  it("imports PortfolioCaptureAffordance", () => {
    expect(ACTIVITY_CARD_SRC).toContain(
      'from "@/components/student/PortfolioCaptureAffordance"'
    );
  });

  it("wraps ResponseInput in a `group` container so on-hover lifts the affordance", () => {
    expect(ACTIVITY_CARD_SRC).toMatch(
      /<div className="group relative">[\s\S]{0,300}<ResponseInput/
    );
  });

  it("affordance hidden when responseType is 'structured-prompts'", () => {
    expect(ACTIVITY_CARD_SRC).toContain(
      'section.responseType !== "structured-prompts"'
    );
  });

  it("affordance hidden when section.portfolioCapture === true (already auto-captures)", () => {
    expect(ACTIVITY_CARD_SRC).toMatch(
      /!section\.portfolioCapture/
    );
  });

  it("affordance gets unitId + pageId + sectionIndex + value props", () => {
    const idx = ACTIVITY_CARD_SRC.indexOf("<PortfolioCaptureAffordance");
    expect(idx).toBeGreaterThan(0);
    const slice = ACTIVITY_CARD_SRC.slice(idx, idx + 400);
    expect(slice).toContain("unitId={unitId}");
    expect(slice).toContain("pageId={pageId}");
    expect(slice).toContain("sectionIndex={index}");
    expect(slice).toContain("value={responseValue}");
  });

  it("affordance row carries a stable testid so smoke can find the slot", () => {
    expect(ACTIVITY_CARD_SRC).toContain('data-testid="portfolio-capture-row"');
  });
});
