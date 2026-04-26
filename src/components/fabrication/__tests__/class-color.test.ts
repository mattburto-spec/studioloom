import { describe, it, expect } from "vitest";
import {
  colorForClassName,
  colorTintForClassName,
} from "../class-color";

/**
 * Phase 8.1d-20 hash-to-palette tests. Two contracts to lock:
 *   1. Deterministic — same input always returns the same colour.
 *      Lab tech can't have "9 Design" be cyan one minute and red
 *      the next.
 *   2. Spread — different class names should generally land on
 *      different palette slots. We don't enforce a strict spread
 *      but spot-check that common school-class strings don't all
 *      collide on one colour.
 */

describe("colorForClassName", () => {
  it("returns the same colour for the same name on repeated calls", () => {
    const a = colorForClassName("9 Design");
    const b = colorForClassName("9 Design");
    expect(a).toBe(b);
  });

  it("returns a 7-character hex (#RRGGBB) for any non-empty name", () => {
    for (const n of ["A", "9 Design", "11 Robotics — North"]) {
      const c = colorForClassName(n);
      expect(c).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it("trims whitespace before hashing (so '9 Design' === ' 9 Design ')", () => {
    expect(colorForClassName("9 Design")).toBe(colorForClassName(" 9 Design "));
  });

  it("returns the muted fallback for null / undefined / whitespace", () => {
    expect(colorForClassName(null)).toBe("#6E6A60");
    expect(colorForClassName(undefined)).toBe("#6E6A60");
    expect(colorForClassName("")).toBe("#6E6A60");
    expect(colorForClassName("   ")).toBe("#6E6A60");
  });

  it("spreads typical school class names across multiple palette slots", () => {
    const names = [
      "9 Design",
      "10 Design",
      "11 Design",
      "12 Design",
      "6 Robotics",
      "7 Robotics",
      "8 Engineering",
      "PYP-X",
    ];
    const colors = new Set(names.map((n) => colorForClassName(n)));
    // 8 inputs through 8-colour palette. School class strings share
    // long suffixes ("Design", "Robotics") so djb2 collisions land
    // higher than birthday-paradox would predict on random input —
    // empirical run on these 8 names produces 4 distinct slots.
    // Threshold ≥ 4 catches the "every name maps to one colour"
    // bug without being flaky on the realistic suffix pattern.
    // Bump the threshold if PALETTE grows or the hash gets swapped
    // for something with better suffix-spread.
    expect(colors.size).toBeGreaterThanOrEqual(4);
  });
});

describe("colorTintForClassName", () => {
  it("appends '22' for subtle, '33' for soft", () => {
    const c = colorForClassName("9 Design");
    expect(colorTintForClassName("9 Design")).toBe(`${c}22`);
    expect(colorTintForClassName("9 Design", "soft")).toBe(`${c}33`);
  });

  it("uses an rgba fallback for null/empty inputs (hex '#6E6A60' alpha would be confusing)", () => {
    expect(colorTintForClassName(null)).toBe("rgba(110,106,96,0.10)");
    expect(colorTintForClassName(undefined, "soft")).toBe("rgba(110,106,96,0.18)");
    expect(colorTintForClassName("")).toBe("rgba(110,106,96,0.10)");
  });
});
