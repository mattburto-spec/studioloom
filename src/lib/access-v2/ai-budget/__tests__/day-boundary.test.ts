import { describe, it, expect } from "vitest";
import { startOfDayInTz, DEFAULT_SCHOOL_TIMEZONE } from "../day-boundary";

describe("startOfDayInTz", () => {
  it("returns local midnight for Asia/Shanghai (UTC+8, no DST)", () => {
    // 5 May 2026 14:32 UTC = 5 May 2026 22:32 Shanghai → start of 5 May Shanghai = 4 May 2026 16:00 UTC
    const now = new Date("2026-05-05T14:32:00Z");
    const start = startOfDayInTz("Asia/Shanghai", now);
    expect(start.toISOString()).toBe("2026-05-04T16:00:00.000Z");
  });

  it("handles a moment just past local midnight", () => {
    // 4 May 2026 16:01 UTC = 5 May 2026 00:01 Shanghai → start of 5 May Shanghai = 4 May 2026 16:00 UTC
    const now = new Date("2026-05-04T16:01:00Z");
    const start = startOfDayInTz("Asia/Shanghai", now);
    expect(start.toISOString()).toBe("2026-05-04T16:00:00.000Z");
  });

  it("handles a moment just before local midnight (still 'yesterday' UTC)", () => {
    // 4 May 2026 15:59 UTC = 4 May 2026 23:59 Shanghai → start of 4 May Shanghai = 3 May 2026 16:00 UTC
    const now = new Date("2026-05-04T15:59:00Z");
    const start = startOfDayInTz("Asia/Shanghai", now);
    expect(start.toISOString()).toBe("2026-05-03T16:00:00.000Z");
  });

  it("returns local midnight for UTC", () => {
    const now = new Date("2026-05-08T12:00:00Z");
    const start = startOfDayInTz("UTC", now);
    expect(start.toISOString()).toBe("2026-05-08T00:00:00.000Z");
  });

  it("handles America/Los_Angeles during PDT (UTC-7)", () => {
    // 8 Jul 2026 06:00 UTC = 7 Jul 2026 23:00 PDT → start of 7 Jul PDT = 7 Jul 07:00 UTC
    const now = new Date("2026-07-08T06:00:00Z");
    const start = startOfDayInTz("America/Los_Angeles", now);
    expect(start.toISOString()).toBe("2026-07-07T07:00:00.000Z");
  });

  it("handles America/Los_Angeles during PST (UTC-8)", () => {
    // 8 Jan 2026 06:00 UTC = 7 Jan 2026 22:00 PST → start of 7 Jan PST = 7 Jan 08:00 UTC
    const now = new Date("2026-01-08T06:00:00Z");
    const start = startOfDayInTz("America/Los_Angeles", now);
    expect(start.toISOString()).toBe("2026-01-07T08:00:00.000Z");
  });

  it("handles Australia/Sydney (UTC+10/+11)", () => {
    // 8 Jul 2026 14:00 UTC (winter, AEST UTC+10) = 9 Jul 00:00 Sydney → start = 8 Jul 14:00 UTC
    const now = new Date("2026-07-08T14:00:00Z");
    const start = startOfDayInTz("Australia/Sydney", now);
    expect(start.toISOString()).toBe("2026-07-08T14:00:00.000Z");
  });

  it("exposes the SQL fallback default", () => {
    expect(DEFAULT_SCHOOL_TIMEZONE).toBe("Asia/Shanghai");
  });

  it("throws on an invalid timezone", () => {
    expect(() => startOfDayInTz("Not/A_Real_Zone", new Date())).toThrow(RangeError);
  });
});
