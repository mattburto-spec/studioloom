/**
 * AG.4.2 + AG.4.3 — source-static guards for UnitAttentionPanel +
 * DontRescueBanner + Class Hub wiring.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  formatRelative,
  isStale,
} from "../unit-attention-helpers";

const PANEL_SRC = readFileSync(
  join(__dirname, "..", "UnitAttentionPanel.tsx"),
  "utf-8"
);

const HUB_SRC = readFileSync(
  join(
    process.cwd(),
    "src/app/teacher/units/[unitId]/class/[classId]/page.tsx"
  ),
  "utf-8"
);

describe("UnitAttentionPanel — wiring", () => {
  it("loads via typed client (loadAttentionPanel + AttentionApiError)", () => {
    expect(PANEL_SRC).toContain('from "@/lib/unit-tools/attention/client"');
    expect(PANEL_SRC).toContain("loadAttentionPanel(unitId, classId)");
    expect(PANEL_SRC).toContain("AttentionApiError");
  });

  it("renders 4 load states (loading / error / empty / ready)", () => {
    expect(PANEL_SRC).toContain('data-testid="attention-loading"');
    expect(PANEL_SRC).toContain('data-testid="attention-error"');
    expect(PANEL_SRC).toContain('data-testid="attention-empty"');
    expect(PANEL_SRC).toContain('data-testid="attention-panel"');
  });

  it("error state has reload affordance", () => {
    expect(PANEL_SRC).toMatch(/window\.location\.reload\(\)/);
  });

  it("renders DontRescueBanner above rows when ready", () => {
    expect(PANEL_SRC).toMatch(
      /attention-panel[\s\S]*?DontRescueBanner/
    );
  });

  it("cleans up async load on unmount (cancellation flag)", () => {
    expect(PANEL_SRC).toMatch(/let cancelled = false/);
    expect(PANEL_SRC).toMatch(/if \(cancelled\) return/);
  });

  it("re-loads when unitId, classId, or refreshKey change (refreshKey added in calibration round)", () => {
    expect(PANEL_SRC).toMatch(/\[unitId,\s*classId,\s*refreshKey\]/);
  });
});

describe("UnitAttentionPanel — row rendering", () => {
  it("each row carries data-testid + suggested flag", () => {
    expect(PANEL_SRC).toMatch(/data-testid=\{`attention-row-\$\{row\.studentId\}`\}/);
    expect(PANEL_SRC).toContain("data-suggested-one-on-one={row.suggestedOneOnOne}");
  });

  it("Suggested 1-on-1 badge gated by row flag (round 7 — clearer label)", () => {
    expect(PANEL_SRC).toMatch(
      /row\.suggestedOneOnOne\s*&&[\s\S]*?Suggested 1-on-1/
    );
    expect(PANEL_SRC).toContain('data-testid="attention-1on1-badge"');
  });

  it("renders an expandable legend explaining 1:1 / Three Cs / Calibration / Journal-Kanban (round 7)", () => {
    expect(PANEL_SRC).toContain('data-testid="attention-legend"');
    // All four legend items present
    expect(PANEL_SRC).toContain("Suggested 1:1:");
    expect(PANEL_SRC).toContain("Three Cs:");
    expect(PANEL_SRC).toContain("Calibration:");
    expect(PANEL_SRC).toContain("Journal / Kanban:");
  });

  it("each signal cell carries an explanatory title tooltip (round 7)", () => {
    // SignalCell now accepts + renders a `tooltip` prop on the outer span.
    expect(PANEL_SRC).toMatch(/title=\{tooltip\}/);
    // Specific tooltip text passed at the call sites
    expect(PANEL_SRC).toContain("Last Process Journal entry");
    expect(PANEL_SRC).toContain("Last time the student moved a card");
    expect(PANEL_SRC).toContain("Last time YOU recorded a teacher observation");
  });

  it("'no rating' badge tooltip explains where ratings come from (round 7)", () => {
    expect(PANEL_SRC).toContain("Add a New Metrics block to a lesson");
  });

  it("renders 3 signal cells (journal / kanban / calibration)", () => {
    // SignalCell takes testId as a prop and passes it to data-testid;
    // assert the prop assignments rather than the rendered attribute.
    expect(PANEL_SRC).toContain('testId="attention-signal-journal"');
    expect(PANEL_SRC).toContain('testId="attention-signal-kanban"');
    expect(PANEL_SRC).toContain('testId="attention-signal-calibration"');
    expect(PANEL_SRC).toContain("data-testid={testId}");
  });

  it("ThreeCsBadge tone tiers (emerald >= 3, amber >= 2, rose otherwise, gray for null)", () => {
    expect(PANEL_SRC).toContain("bg-emerald-100");
    expect(PANEL_SRC).toContain("bg-amber-100");
    expect(PANEL_SRC).toContain("bg-rose-100");
    expect(PANEL_SRC).toMatch(/aggregate === null[\s\S]*?bg-gray-100/);
  });
});

describe("DontRescueBanner (AG.4.3)", () => {
  it("renders with 🛑 emoji and core copy", () => {
    expect(PANEL_SRC).toContain('data-testid="dont-rescue-banner"');
    expect(PANEL_SRC).toContain("🛑");
    expect(PANEL_SRC).toContain("Don&apos;t rescue");
    expect(PANEL_SRC).toContain("Recovery IS the learning");
  });

  it("exported separately so caller can mount above other tabs too", () => {
    expect(PANEL_SRC).toMatch(/export function DontRescueBanner\(\)/);
  });
});

describe("Class Hub wiring", () => {
  it('"attention" added to HubTab union', () => {
    expect(HUB_SRC).toMatch(
      /type HubTab[\s\S]{0,200}"attention"/
    );
  });

  it('"attention" tab in TABS list (after badges, before settings)', () => {
    const badgesIdx = HUB_SRC.indexOf('id: "badges"');
    const attentionIdx = HUB_SRC.indexOf('id: "attention"');
    const settingsIdx = HUB_SRC.indexOf('id: "settings"');
    expect(attentionIdx).toBeGreaterThan(badgesIdx);
    expect(settingsIdx).toBeGreaterThan(attentionIdx);
  });

  it("attention tab passes unitId + classId to panel", () => {
    expect(HUB_SRC).toMatch(
      /activeTab === "attention"[\s\S]{0,200}<UnitAttentionPanel unitId=\{unitId\} classId=\{classId\}/
    );
  });

  it("URL tab parser whitelists 'attention'", () => {
    expect(HUB_SRC).toMatch(/tab === "attention"/);
  });
});

// ─── formatRelative + isStale (pure helpers) ─────────────────────────────

describe("formatRelative", () => {
  const NOW = "2026-05-06T12:00:00Z";
  it('returns "never" for null', () => {
    expect(formatRelative(null, NOW)).toBe("never");
  });
  it('returns "today" within 24h', () => {
    expect(formatRelative("2026-05-06T08:00:00Z", NOW)).toBe("today");
  });
  it('returns "1 day ago" for 24-48h', () => {
    expect(formatRelative("2026-05-05T08:00:00Z", NOW)).toBe("1 day ago");
  });
  it("returns N days ago for older", () => {
    expect(formatRelative("2026-05-01T12:00:00Z", NOW)).toBe("5 days ago");
  });
  it('returns "in future" for future timestamps (clock skew)', () => {
    expect(formatRelative("2026-05-07T00:00:00Z", NOW)).toBe("in future");
  });
});

describe("isStale", () => {
  const NOW = "2026-05-06T12:00:00Z";
  it("false for today", () => {
    expect(isStale("2026-05-06T08:00:00Z", NOW)).toBe(false);
  });
  it("false for 3 days exactly", () => {
    expect(isStale("2026-05-03T12:00:00Z", NOW)).toBe(false);
  });
  it("true for >3 days", () => {
    expect(isStale("2026-05-02T11:00:00Z", NOW)).toBe(true);
  });
});
