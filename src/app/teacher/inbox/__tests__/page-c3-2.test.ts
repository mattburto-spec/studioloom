/**
 * TFL.3 C.3.2 — inbox auto-refresh source-static guards.
 *
 * Matt feedback 12 May 2026: "inbox needs to auto update every minute
 * or so i dont need to hit refresh". Adds a 60s polling interval that
 * pauses on tab-hidden + refetches on tab-focus.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "..", "page.tsx"), "utf-8");

describe("/teacher/inbox C.3.2 — auto-refresh polling", () => {
  it("declares a 60s poll interval (INBOX_POLL_MS = 60_000)", () => {
    expect(src).toMatch(/INBOX_POLL_MS\s*=\s*60_000/);
  });

  it("uses setInterval keyed off refetch", () => {
    expect(src).toMatch(/intervalId\s*=\s*setInterval\(/);
    expect(src).toMatch(/void refetch\(\)/);
  });

  it("pauses polling when document.hidden (visibility-aware)", () => {
    // Two guards: (a) inside the interval tick skip if hidden,
    // (b) on visibilitychange stop the interval entirely.
    expect(src).toMatch(/document\.hidden/);
    expect(src).toMatch(/visibilitychange/);
  });

  it("cleans up the interval + visibility listener on unmount", () => {
    expect(src).toMatch(/clearInterval\(intervalId\)/);
    expect(src).toMatch(/removeEventListener\("visibilitychange"/);
  });

  it("refetches immediately when the tab regains focus", () => {
    // When document.hidden flips false, fire a refetch and restart
    // the interval — don't make the teacher wait up to 60s for fresh
    // data after they switch back to the tab.
    expect(src).toMatch(
      /if\s*\(document\.hidden\)\s*\{\s*stop\(\);\s*\}\s*else\s*\{\s*void\s+refetch\(\);\s*start\(\);/,
    );
  });
});
