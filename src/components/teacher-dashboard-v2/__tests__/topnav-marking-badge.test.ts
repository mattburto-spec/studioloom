/**
 * TFL.3 C.5 — TopNav Marking badge source-static guards.
 *
 * The badge is the dashboard chip equivalent: visible from EVERY
 * teacher page (TopNav is in the layout), shows the same counts as
 * the inbox header. Polls /api/teacher/inbox/count every 60s,
 * tab-aware via Visibility API.
 *
 * Pins:
 *   - polls /api/teacher/inbox/count (NOT /items)
 *   - 60s interval, document.hidden guard, visibilitychange listener
 *   - immediate fetch on mount + on regain focus
 *   - badge hides when total === 0 or count is null
 *   - amber when replyWaiting > 0, purple-tint otherwise
 *   - data-reply-waiting attribute for e2e
 *   - cleanup on unmount (clearInterval + removeEventListener)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(
  join(__dirname, "..", "TopNav.tsx"),
  "utf-8",
);

describe("TopNav — inbox count fetch", () => {
  it("calls /api/teacher/inbox/count (the thin counter, NOT /items)", () => {
    expect(src).toContain('"/api/teacher/inbox/count"');
    expect(src).not.toMatch(/fetch\("\/api\/teacher\/inbox\/items"/);
  });

  it("uses cache: 'no-store' on the fetch", () => {
    expect(src).toMatch(/cache:\s*"no-store"/);
  });

  it("polls on a 60s interval", () => {
    expect(src).toMatch(/setInterval\([\s\S]*?60_000\)/);
  });

  it("guards on document.hidden inside each tick", () => {
    expect(src).toMatch(/document\.hidden/);
  });

  it("listens to visibilitychange + refetches on focus", () => {
    expect(src).toMatch(/visibilitychange/);
    expect(src).toMatch(/if\s*\(document\.hidden\)\s*stop\(\);[\s\S]*?else\s*\{\s*void fetchInboxCount\(\);\s*start\(\)/);
  });

  it("cleans up interval + listener on unmount", () => {
    expect(src).toMatch(/clearInterval\(intervalId\)/);
    expect(src).toMatch(/removeEventListener\("visibilitychange"/);
  });

  it("gates the entire effect on teacher being non-null", () => {
    expect(src).toMatch(/if\s*\(!teacher\)\s*return/);
  });
});

describe("TopNav — Marking badge render", () => {
  it("only renders the badge for the /teacher/inbox link", () => {
    expect(src).toMatch(/item\.href\s*===\s*"\/teacher\/inbox"/);
  });

  it("hides badge when total === 0 or inboxCount is null", () => {
    expect(src).toMatch(
      /showInboxBadge\s*=[\s\S]*?inboxCount\s*!==\s*null[\s\S]*?inboxCount\.total\s*>\s*0/,
    );
  });

  it("badge carries data-testid + data-reply-waiting attrs", () => {
    expect(src).toContain('data-testid="topnav-marking-badge"');
    expect(src).toMatch(/data-reply-waiting=\{inboxCount\.replyWaiting\s*>\s*0\}/);
  });

  it("badge tone is amber when replyWaiting > 0", () => {
    expect(src).toMatch(
      /inboxCount\.replyWaiting\s*>\s*0\s*\?\s*"bg-amber-500\s+text-white/,
    );
  });

  it("title attr surfaces both counts for hover/screen-reader context", () => {
    expect(src).toMatch(
      /title=\{\s*inboxCount\.replyWaiting\s*>\s*0[\s\S]*?to review\s·\s\$\{inboxCount\.replyWaiting\}\s*waiting on you/,
    );
  });

  it("Marking link itself carries data-testid topnav-marking-link", () => {
    // The data-testid is conditional (only on the inbox href), so
    // the literal "topnav-marking-link" appears as a JSX ternary
    // branch rather than a static attribute string.
    expect(src).toMatch(
      /item\.href\s*===\s*"\/teacher\/inbox"\s*\?\s*"topnav-marking-link"/,
    );
  });
});
