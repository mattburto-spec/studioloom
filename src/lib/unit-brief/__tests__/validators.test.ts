/**
 * Behavioural tests for the shared unit-brief validators + coercers.
 *
 * Source-static tests in /api/teacher/unit-brief/__tests__ confirm the
 * presence of the validators + their error strings. THESE tests confirm
 * the actual runtime behaviour — particularly the defensive coercion
 * Matt's CO2 Dragsters bug exposed (post-F.C 14 May 2026): a legacy
 * brief had a STRING in constraints.data.dimensions, and the editor's
 * `{ ...value }` merge round-tripped that through every save until the
 * validator rejected it.
 */
import { describe, expect, it } from "vitest";
import {
  GENERIC_CONSTRAINTS,
  coerceConstraints,
  coerceLocks,
  validateConstraints,
  validateLocks,
} from "../validators";

describe("coerceConstraints — defensive sanitisation (hotfix 14 May 2026)", () => {
  it("drops a stale string dimensions field (pre-smoke-polish legacy)", () => {
    const stored = {
      archetype: "design",
      data: { dimensions: "max 200mm any axis", budget: "AUD $20" },
    };
    const result = coerceConstraints(stored);
    expect(result.archetype).toBe("design");
    if (result.archetype === "design") {
      expect(result.data.dimensions).toBeUndefined();
      expect(result.data.budget).toBe("AUD $20"); // valid field survives
    }
  });

  it("drops a null dimensions field", () => {
    const stored = {
      archetype: "design",
      data: { dimensions: null, audience: "Year 7" },
    };
    const result = coerceConstraints(stored);
    if (result.archetype === "design") {
      expect(result.data.dimensions).toBeUndefined();
      expect(result.data.audience).toBe("Year 7");
    }
  });

  it("drops a dimensions object whose axes are wrong types", () => {
    const stored = {
      archetype: "design",
      data: {
        dimensions: { h: "200", w: -1, d: NaN, unit: "yards" },
      },
    };
    const result = coerceConstraints(stored);
    if (result.archetype === "design") {
      // All axes failed type/finite/non-negative checks → no axes set
      // → no usable cleaned object → key dropped entirely
      expect(result.data.dimensions).toBeUndefined();
    }
  });

  it("preserves a valid dimensions object", () => {
    const stored = {
      archetype: "design",
      data: { dimensions: { h: 200, w: 150, d: 80, unit: "mm" } },
    };
    const result = coerceConstraints(stored);
    if (result.archetype === "design") {
      expect(result.data.dimensions).toEqual({ h: 200, w: 150, d: 80, unit: "mm" });
    }
  });

  it("keeps numeric axes but drops invalid unit", () => {
    const stored = {
      archetype: "design",
      data: { dimensions: { h: 200, unit: "yards" } },
    };
    const result = coerceConstraints(stored);
    if (result.archetype === "design") {
      expect(result.data.dimensions).toEqual({ h: 200 });
    }
  });

  it("drops string-array fields whose entries aren't strings", () => {
    const stored = {
      archetype: "design",
      data: {
        materials_whitelist: ["pla", 42, null, "plywood-3mm"],
        must_include: "not-an-array", // wrong type entirely
        must_avoid: [123],
      },
    };
    const result = coerceConstraints(stored);
    if (result.archetype === "design") {
      expect(result.data.materials_whitelist).toEqual(["pla", "plywood-3mm"]);
      expect(result.data.must_include).toBeUndefined();
      expect(result.data.must_avoid).toBeUndefined();
    }
  });

  it("returns GENERIC_CONSTRAINTS for empty / null / non-object input", () => {
    expect(coerceConstraints({})).toEqual(GENERIC_CONSTRAINTS);
    expect(coerceConstraints(null)).toEqual(GENERIC_CONSTRAINTS);
    expect(coerceConstraints("string")).toEqual(GENERIC_CONSTRAINTS);
    expect(coerceConstraints([1, 2, 3])).toEqual(GENERIC_CONSTRAINTS);
  });

  it("returns GENERIC_CONSTRAINTS when archetype is design but data is missing or non-object", () => {
    expect(coerceConstraints({ archetype: "design" })).toEqual(GENERIC_CONSTRAINTS);
    expect(coerceConstraints({ archetype: "design", data: "string" })).toEqual(
      GENERIC_CONSTRAINTS,
    );
    expect(coerceConstraints({ archetype: "design", data: [] })).toEqual(
      GENERIC_CONSTRAINTS,
    );
  });

  it("the post-coerce shape always passes validateConstraints (round-trip safety)", () => {
    // Whatever garbage comes off the wire, coerce → validate should
    // always succeed. This is the invariant the editor's `{ ...value }`
    // merge relies on.
    const garbage = {
      archetype: "design",
      data: {
        dimensions: "legacy string",
        budget: 42, // wrong type
        audience: "Year 7",
        materials_whitelist: [1, "pla"],
        must_include: null,
      },
    };
    const coerced = coerceConstraints(garbage);
    const validated = validateConstraints(coerced);
    expect(validated.ok).toBe(true);
  });
});

describe("coerceLocks — already drift-defensive (Phase F.A)", () => {
  it("drops unknown lock keys silently", () => {
    const out = coerceLocks({ "brief_text": true, "nonsense.key": true });
    expect(out).toEqual({ "brief_text": true });
  });

  it("treats non-true values (false / undefined / null) as unlocked", () => {
    const out = coerceLocks({
      "brief_text": true,
      "diagram_url": false,
      "constraints.budget": null,
    });
    expect(out).toEqual({ "brief_text": true });
  });
});

describe("validateLocks", () => {
  it("rejects non-object payloads", () => {
    expect(validateLocks(null)).toEqual({ ok: false, error: "locks must be an object" });
    expect(validateLocks([])).toEqual({ ok: false, error: "locks must be an object" });
  });

  it("rejects unknown keys", () => {
    const result = validateLocks({ "bogus.key": true });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("bogus.key");
  });

  it("rejects non-boolean values", () => {
    const result = validateLocks({ "brief_text": "yes" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("must be a boolean");
  });

  it("canonicalises false / absent as not stored", () => {
    const result = validateLocks({
      "brief_text": true,
      "diagram_url": false,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ "brief_text": true });
    }
  });
});
