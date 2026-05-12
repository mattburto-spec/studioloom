/**
 * formatInboxRelativeTime — compact human-readable timestamps for
 * inbox queue rows. Deterministic via the injected `now`.
 */

import { describe, it, expect } from "vitest";
import { formatInboxRelativeTime } from "../relative-time";

const NOW = new Date("2026-05-12T10:00:00.000Z");

describe("formatInboxRelativeTime — sub-hour", () => {
  it("returns 'now' for < 1 minute", () => {
    expect(formatInboxRelativeTime("2026-05-12T09:59:30.000Z", NOW)).toBe(
      "now",
    );
  });

  it("returns 'Nm' for minutes < 60", () => {
    expect(formatInboxRelativeTime("2026-05-12T09:55:00.000Z", NOW)).toBe(
      "5m",
    );
    expect(formatInboxRelativeTime("2026-05-12T09:01:00.000Z", NOW)).toBe(
      "59m",
    );
  });
});

describe("formatInboxRelativeTime — sub-day", () => {
  it("returns 'Nh' for hours < 24", () => {
    expect(formatInboxRelativeTime("2026-05-12T07:00:00.000Z", NOW)).toBe(
      "3h",
    );
    expect(formatInboxRelativeTime("2026-05-11T11:00:00.000Z", NOW)).toBe(
      "23h",
    );
  });
});

describe("formatInboxRelativeTime — multi-day", () => {
  it("returns 'yest.' for 24–48h", () => {
    expect(formatInboxRelativeTime("2026-05-11T08:00:00.000Z", NOW)).toBe(
      "yest.",
    );
  });

  it("returns 'Nd' for 2–6 days", () => {
    expect(formatInboxRelativeTime("2026-05-09T10:00:00.000Z", NOW)).toBe(
      "3d",
    );
    expect(formatInboxRelativeTime("2026-05-06T10:00:00.000Z", NOW)).toBe(
      "6d",
    );
  });
});

describe("formatInboxRelativeTime — older than a week", () => {
  it("returns 'D Mon' for >= 7 days in same year", () => {
    expect(formatInboxRelativeTime("2026-04-15T10:00:00.000Z", NOW)).toMatch(
      /^\d{1,2} Apr$/,
    );
  });

  it("returns abbreviated month + 2-digit year for prior year", () => {
    expect(formatInboxRelativeTime("2025-08-10T10:00:00.000Z", NOW)).toMatch(
      /^[A-Z][a-z]{2} '25$/,
    );
  });
});

describe("formatInboxRelativeTime — defensive", () => {
  it("returns empty string for unparseable input", () => {
    expect(formatInboxRelativeTime("not-a-date", NOW)).toBe("");
  });
});
