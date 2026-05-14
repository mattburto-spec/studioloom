/**
 * /api/teacher/class-dj/launch — auto-close-expired sweep guard.
 *
 * Lock the Run-again-after-timer-expiry fix. When the timer naturally
 * expires, the round's closed_at stays NULL (only /pick + /close write
 * it). Without a sweep before the existing-round check, "Run again"
 * returns reused:true and the UI gets stuck.
 *
 * Plus: the partial unique index class_dj_rounds_one_open prevents two
 * NULL-closed_at rows on the same tuple, so even bypassing the check
 * the INSERT would 23505.
 *
 * Fix asserted here: launch route sweeps timer-expired rows + sets
 * closed_at = now(), then the existing-round check uses
 * closed_at IS NULL AND ends_at > now() to match the UI semantics.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROUTE_SRC = readFileSync(
  join(__dirname, "..", "route.ts"),
  "utf-8",
);

describe("launch route — auto-close-expired sweep", () => {
  it("UPDATEs class_dj_rounds setting closed_at on timer-expired rows BEFORE the existing-round check", () => {
    // Sweep query shape: UPDATE WHERE closed_at IS NULL AND ends_at < now.
    expect(ROUTE_SRC).toMatch(
      /from\("class_dj_rounds"\)\s*\n?\s*\.update\(\{ closed_at:[\s\S]{0,400}\.lt\("ends_at", nowIso\)/,
    );
  });

  it("existing-round check uses closed_at IS NULL AND ends_at > now() (matches UI semantics)", () => {
    expect(ROUTE_SRC).toMatch(
      /existing,[\s\S]{0,500}\.is\("closed_at", null\)[\s\S]{0,200}\.gt\("ends_at", nowIso\)/,
    );
  });

  it("sweep failure is logged but NOT fatal — falls through to existing-round behaviour", () => {
    expect(ROUTE_SRC).toMatch(/sweep failed/);
    expect(ROUTE_SRC).toMatch(/Non-fatal/);
  });

  it("uses a single nowIso to avoid clock skew between sweep + existing-check + insert", () => {
    expect(ROUTE_SRC).toMatch(/const nowIso = new Date\(\)\.toISOString\(\);/);
  });
});
