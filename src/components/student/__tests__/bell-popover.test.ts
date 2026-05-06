/**
 * Round 11 (6 May 2026) — bell-icon popover, replacing the old
 * navigate-to-#dashboard-priority behaviour.
 *
 * Per Matt: "the alert icon in the top right of the student screen
 * shouldn't take students to another page — clicking on it should
 * just have a little pop up with the important notifications."
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const NAV_SRC = readFileSync(
  join(__dirname, "..", "BoldTopNav.tsx"),
  "utf-8"
);

const CTX_SRC = readFileSync(
  join(__dirname, "..", "BellCountContext.tsx"),
  "utf-8"
);

const DASH_SRC = readFileSync(
  join(
    process.cwd(),
    "src/app/(student)/dashboard/DashboardClient.tsx"
  ),
  "utf-8"
);

describe("BellCountContext — items channel (round 11)", () => {
  it("exports NotificationItem interface", () => {
    expect(CTX_SRC).toMatch(/export interface NotificationItem/);
    expect(CTX_SRC).toMatch(/kind:\s*"overdue"\s*\|\s*"today"\s*\|\s*"soon"/);
  });

  it("BellCountValue carries items + setItems alongside count + setCount", () => {
    expect(CTX_SRC).toMatch(/items:\s*NotificationItem\[\]/);
    expect(CTX_SRC).toMatch(/setItems:\s*\(items:\s*NotificationItem\[\]\)\s*=>\s*void/);
  });

  it("default ctx value carries empty items array (no crash on read)", () => {
    expect(CTX_SRC).toMatch(/items:\s*\[\]/);
  });
});

describe("DashboardClient pushes items + count to bell context", () => {
  it("destructures setItems from useBellCount", () => {
    expect(DASH_SRC).toContain("setItems: setBellItems");
  });

  it("populates items from buckets.overdue + today + soon (capped) and calls setBellItems", () => {
    expect(DASH_SRC).toMatch(
      /setBellItems\(items\)/
    );
    expect(DASH_SRC).toContain("toNotification");
    // soon is sliced to 5 to keep the popover short
    expect(DASH_SRC).toMatch(/soon\.slice\(0,\s*5\)/);
  });

  it("toNotification helper maps QueueItem → NotificationItem and is co-located", () => {
    expect(DASH_SRC).toMatch(/function toNotification\(\s*q:\s*QueueItem\s*\)/);
    expect(DASH_SRC).toMatch(/id:\s*`\$\{q\.kind\}:\$\{q\.due\}:\$\{q\.title\}`/);
  });
});

describe("BoldTopNav — bell popover (round 11)", () => {
  it("imports useBellCount + NotificationItem from BellCountContext", () => {
    expect(NAV_SRC).toMatch(
      /import\s*\{\s*useBellCount,\s*type\s+NotificationItem\s*\}\s*from\s*"\.\/BellCountContext"/
    );
  });

  it("renders BellPopoverButton instead of the inline scroll-to-anchor button", () => {
    expect(NAV_SRC).toContain("<BellPopoverButton");
    // Old navigation logic gone from the bell area
    expect(NAV_SRC).not.toMatch(
      /scrollTo\("dashboard-priority"\)[\s\S]{0,100}aria-label=\{bellCount > 0/
    );
  });

  it("BellPopoverButton wires open state + outside-click + ESC", () => {
    const idx = NAV_SRC.indexOf("function BellPopoverButton");
    expect(idx).toBeGreaterThan(0);
    const fn = NAV_SRC.slice(idx, idx + 4000);
    expect(fn).toContain("setOpen((o) => !o)");
    expect(fn).toMatch(/e\.key === "Escape"/);
    expect(fn).toMatch(/!ref\.current\.contains\(e\.target as Node\)/);
  });

  it("popover element carries role=dialog + aria-haspopup + aria-expanded for a11y", () => {
    expect(NAV_SRC).toMatch(/role="dialog"[\s\S]{0,200}aria-label="Notifications"/);
    expect(NAV_SRC).toContain('aria-haspopup="dialog"');
    expect(NAV_SRC).toContain("aria-expanded={open}");
  });

  it("renders empty-state copy when items.length === 0", () => {
    expect(NAV_SRC).toContain('data-testid="bell-popover-empty"');
    expect(NAV_SRC).toContain("Nothing urgent right now");
  });

  it("renders one row per item with kind-tinted dueText pill", () => {
    expect(NAV_SRC).toMatch(
      /data-testid=\{`bell-popover-row-\$\{item\.kind\}`\}/
    );
    // Tone mapping: overdue=red, today=amber, soon=muted
    expect(NAV_SRC).toContain("text-[#DC2626]");
    expect(NAV_SRC).toContain("text-[#D97706]");
  });

  it('"View all" footer falls back to scroll-or-navigate (preserves old behaviour as escape hatch)', () => {
    expect(NAV_SRC).toContain('data-testid="bell-popover-view-all"');
    expect(NAV_SRC).toMatch(
      /scrollTo\("dashboard-priority"\)[\s\S]{0,200}window\.location\.href\s*=\s*"\/dashboard#dashboard-priority"/
    );
  });

  it("rows route via Link when href is set, plain <li> otherwise", () => {
    const idx = NAV_SRC.indexOf("function BellPopoverRow");
    expect(idx).toBeGreaterThan(0);
    const fn = NAV_SRC.slice(idx, idx + 1500);
    expect(fn).toMatch(/if\s*\(item\.href\)/);
    expect(fn).toContain("<Link");
  });

  it("count badge still shows when bellCount > 0 (preserved from old button)", () => {
    expect(NAV_SRC).toMatch(/bellCount > 9 \? "9\+" : bellCount/);
    expect(NAV_SRC).toContain("bg-[#DC2626]");
  });
});
