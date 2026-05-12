import { describe, it, expect } from "vitest";
import { getLiveStatusLabel } from "../live-status-label";

const NOW = Date.parse("2026-05-13T12:00:00Z");

function minsAgo(n: number): string {
  return new Date(NOW - n * 60_000).toISOString();
}

describe("getLiveStatusLabel", () => {
  it("returns Done regardless of online state when status=complete", () => {
    expect(
      getLiveStatusLabel({ status: "complete", isOnline: true, lastActive: minsAgo(1) }, NOW).label,
    ).toBe("Done");
    expect(
      getLiveStatusLabel({ status: "complete", isOnline: false, lastActive: minsAgo(500) }, NOW).label,
    ).toBe("Done");
  });

  it("returns Not Started regardless of online state when status=not_started", () => {
    expect(
      getLiveStatusLabel({ status: "not_started", isOnline: false, lastActive: null }, NOW).label,
    ).toBe("Not Started");
    expect(
      getLiveStatusLabel({ status: "not_started", isOnline: true, lastActive: minsAgo(1) }, NOW).label,
    ).toBe("Not Started");
  });

  it("returns Working when in_progress + online", () => {
    const r = getLiveStatusLabel(
      { status: "in_progress", isOnline: true, lastActive: minsAgo(2) },
      NOW,
    );
    expect(r.label).toBe("Working");
    expect(r.color).toBe("#2563EB");
  });

  it("returns Idle Xm when in_progress + offline + <30min since last active", () => {
    expect(
      getLiveStatusLabel(
        { status: "in_progress", isOnline: false, lastActive: minsAgo(7) },
        NOW,
      ).label,
    ).toBe("Idle 7m");
    expect(
      getLiveStatusLabel(
        { status: "in_progress", isOnline: false, lastActive: minsAgo(29) },
        NOW,
      ).label,
    ).toBe("Idle 29m");
  });

  it("returns Away when in_progress + offline + 30-120min since last active", () => {
    expect(
      getLiveStatusLabel(
        { status: "in_progress", isOnline: false, lastActive: minsAgo(45) },
        NOW,
      ).label,
    ).toBe("Away");
    expect(
      getLiveStatusLabel(
        { status: "in_progress", isOnline: false, lastActive: minsAgo(119) },
        NOW,
      ).label,
    ).toBe("Away");
  });

  it("returns Xh ago when in_progress + offline + 2-24h since last active", () => {
    expect(
      getLiveStatusLabel(
        { status: "in_progress", isOnline: false, lastActive: minsAgo(120) },
        NOW,
      ).label,
    ).toBe("2h ago");
    expect(
      getLiveStatusLabel(
        { status: "in_progress", isOnline: false, lastActive: minsAgo(60 * 8) },
        NOW,
      ).label,
    ).toBe("8h ago");
    expect(
      getLiveStatusLabel(
        { status: "in_progress", isOnline: false, lastActive: minsAgo(60 * 23) },
        NOW,
      ).label,
    ).toBe("23h ago");
  });

  it("returns Xd ago when in_progress + offline + >24h since last active", () => {
    expect(
      getLiveStatusLabel(
        { status: "in_progress", isOnline: false, lastActive: minsAgo(60 * 25) },
        NOW,
      ).label,
    ).toBe("1d ago");
    expect(
      getLiveStatusLabel(
        { status: "in_progress", isOnline: false, lastActive: minsAgo(60 * 24 * 3) },
        NOW,
      ).label,
    ).toBe("3d ago");
  });

  it("falls back to Idle (without minutes) when in_progress + offline + no lastActive", () => {
    expect(
      getLiveStatusLabel(
        { status: "in_progress", isOnline: false, lastActive: null },
        NOW,
      ).label,
    ).toBe("Idle");
  });

  it("color is calm gray (not blue) for any stale in_progress state", () => {
    const stale = getLiveStatusLabel(
      { status: "in_progress", isOnline: false, lastActive: minsAgo(60 * 8) },
      NOW,
    );
    expect(stale.color).toBe("#9CA3AF");
    expect(stale.bg).toBe("#F9FAFB");

    const idle = getLiveStatusLabel(
      { status: "in_progress", isOnline: false, lastActive: minsAgo(10) },
      NOW,
    );
    expect(idle.color).toBe("#6B7280");

    const working = getLiveStatusLabel(
      { status: "in_progress", isOnline: true, lastActive: minsAgo(1) },
      NOW,
    );
    expect(working.color).toBe("#2563EB");
  });
});
