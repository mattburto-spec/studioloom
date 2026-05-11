/**
 * TFL.3 C.1 nav rewire — TopNav "Marking" → /teacher/inbox.
 *
 * Pins the contract so a future "let me reorder the nav" edit can't
 * silently break the entry point + the active-state highlighting on
 * the legacy /teacher/marking deep-dive page.
 */

import { describe, it, expect } from "vitest";
import { NAV_ITEMS, activeNavHref } from "../nav-config";

describe("TopNav 'Marking' rewire (TFL.3 C.1)", () => {
  it("'Marking' item href points to /teacher/inbox (the new daily-driver surface)", () => {
    const marking = NAV_ITEMS.find(
      (i): i is Extract<typeof i, { href: string }> =>
        "href" in i && i.label === "Marking",
    );
    expect(marking).toBeDefined();
    expect(marking?.href).toBe("/teacher/inbox");
  });

  it("'Marking' item carries alsoActiveOn: ['/teacher/marking'] (deep-dive keeps the highlight)", () => {
    const marking = NAV_ITEMS.find(
      (i): i is Extract<typeof i, { href: string }> =>
        "href" in i && i.label === "Marking",
    );
    expect(marking?.alsoActiveOn).toEqual(["/teacher/marking"]);
  });
});

describe("activeNavHref — TFL.3 C.1 alsoActiveOn handling", () => {
  it("returns /teacher/inbox for the inbox page itself (primary match)", () => {
    expect(activeNavHref("/teacher/inbox")).toBe("/teacher/inbox");
  });

  it("returns /teacher/inbox for a deep-linked inbox sub-route (prefix match)", () => {
    expect(activeNavHref("/teacher/inbox/some/sub/path")).toBe(
      "/teacher/inbox",
    );
  });

  it("returns /teacher/inbox for /teacher/marking (alsoActiveOn match — teacher in deep-dive keeps highlight)", () => {
    // The key new behaviour. Without alsoActiveOn this would return
    // null (no nav item highlighted on the deep-dive page).
    expect(activeNavHref("/teacher/marking")).toBe("/teacher/inbox");
  });

  it("returns /teacher/inbox for /teacher/marking/<sub> (prefix-of-alsoActiveOn match)", () => {
    // /teacher/marking might gain sub-routes in future (e.g.
    // /teacher/marking/cohort). Still belongs under the same nav
    // item. Query strings are stripped by Next.js usePathname() so
    // we don't need to test those.
    expect(activeNavHref("/teacher/marking/cohort")).toBe(
      "/teacher/inbox",
    );
  });

  it("does NOT light up Marking on an unrelated route (e.g. /teacher/units)", () => {
    const active = activeNavHref("/teacher/units");
    expect(active).toBe("/teacher/units");
    expect(active).not.toBe("/teacher/inbox");
  });

  it("returns null on a route that matches no nav item", () => {
    expect(activeNavHref("/teacher/something-not-in-nav")).toBe(null);
  });

  it("longest-prefix wins when two nav items could match (regression guard)", () => {
    // If both /teacher/inbox and /teacher (hypothetical broader item)
    // matched, the longer prefix should win. Today no broader item
    // exists, but pin the semantic.
    expect(activeNavHref("/teacher/inbox/deep/path")).toBe("/teacher/inbox");
  });
});
