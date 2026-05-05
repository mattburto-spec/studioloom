/**
 * Lever-MM sub-phase MM.0F — pure NM-config state transition tests.
 *
 * Tests cover the three ops used by the Phase 0.5 lesson editor's New
 * Metrics block category:
 *   - addCheckpoint     (idempotent, bootstraps competencies/elements,
 *                        flips enabled flag on first registration)
 *   - removeCheckpoint  (zombie-pageId guard — deletes pageId entry
 *                        when the elements array would go empty)
 *   - setCompetency     (single-element replacement; doesn't touch
 *                        elements/checkpoints per brief stop-trigger)
 *
 * Brief: docs/projects/unit-editor-nm-block.md
 */

import { describe, it, expect } from "vitest";
import { addCheckpoint, removeCheckpoint, setCompetency } from "../checkpoint-ops";
import { DEFAULT_NM_CONFIG, type NMUnitConfig } from "../constants";

describe("Lever-MM checkpoint-ops — addCheckpoint", () => {
  it("adds an element to a fresh page, bootstrapping enabled + competencies + elements", () => {
    const next = addCheckpoint(DEFAULT_NM_CONFIG, "L01", "acting_with_autonomy", "agency_in_learning");
    expect(next.enabled).toBe(true);
    expect(next.competencies).toEqual(["agency_in_learning"]);
    expect(next.elements).toEqual(["acting_with_autonomy"]);
    expect(next.checkpoints["L01"]).toEqual({ elements: ["acting_with_autonomy"] });
  });

  it("appends to an existing page's element list", () => {
    const seed: NMUnitConfig = {
      enabled: true,
      competencies: ["agency_in_learning"],
      elements: ["acting_with_autonomy"],
      checkpoints: { L01: { elements: ["acting_with_autonomy"] } },
    };
    const next = addCheckpoint(seed, "L01", "managing_self", "agency_in_learning");
    expect(next.checkpoints["L01"].elements).toEqual([
      "acting_with_autonomy",
      "managing_self",
    ]);
    expect(next.elements).toEqual(["acting_with_autonomy", "managing_self"]);
  });

  it("idempotent — re-adding the same element on the same page returns the SAME config (reference-equal)", () => {
    const seed: NMUnitConfig = {
      enabled: true,
      competencies: ["agency_in_learning"],
      elements: ["acting_with_autonomy"],
      checkpoints: { L01: { elements: ["acting_with_autonomy"] } },
    };
    const next = addCheckpoint(seed, "L01", "acting_with_autonomy", "agency_in_learning");
    expect(next).toBe(seed); // reference equality — caller can detect no-op via `next === current`
  });

  it("doesn't double-add an element to unit-level elements when already present (different page)", () => {
    const seed: NMUnitConfig = {
      enabled: true,
      competencies: ["agency_in_learning"],
      elements: ["acting_with_autonomy"],
      checkpoints: { L01: { elements: ["acting_with_autonomy"] } },
    };
    const next = addCheckpoint(seed, "L02", "acting_with_autonomy", "agency_in_learning");
    expect(next.checkpoints["L01"].elements).toEqual(["acting_with_autonomy"]);
    expect(next.checkpoints["L02"].elements).toEqual(["acting_with_autonomy"]);
    expect(next.elements).toEqual(["acting_with_autonomy"]); // not duplicated
  });

  it("does not mutate the input config", () => {
    const seed: NMUnitConfig = {
      enabled: false,
      competencies: [],
      elements: [],
      checkpoints: {},
    };
    const seedSnapshot = JSON.parse(JSON.stringify(seed));
    addCheckpoint(seed, "L01", "acting_with_autonomy", "agency_in_learning");
    expect(seed).toEqual(seedSnapshot);
  });
});

describe("Lever-MM checkpoint-ops — removeCheckpoint", () => {
  it("removes an element from a page's elements list", () => {
    const seed: NMUnitConfig = {
      enabled: true,
      competencies: ["agency_in_learning"],
      elements: ["acting_with_autonomy", "managing_self"],
      checkpoints: { L01: { elements: ["acting_with_autonomy", "managing_self"] } },
    };
    const next = removeCheckpoint(seed, "L01", "acting_with_autonomy");
    expect(next.checkpoints["L01"].elements).toEqual(["managing_self"]);
  });

  it("zombie-pageId guard: deletes the pageId entry entirely when elements would go empty", () => {
    const seed: NMUnitConfig = {
      enabled: true,
      competencies: ["agency_in_learning"],
      elements: ["acting_with_autonomy"],
      checkpoints: {
        L01: { elements: ["acting_with_autonomy"] },
        L02: { elements: ["managing_self"] },
      },
    };
    const next = removeCheckpoint(seed, "L01", "acting_with_autonomy");
    expect(next.checkpoints).not.toHaveProperty("L01");
    expect(next.checkpoints["L02"]).toEqual({ elements: ["managing_self"] }); // other pages untouched
    expect(Object.keys(next.checkpoints)).toEqual(["L02"]);
  });

  it("idempotent — removing a missing element returns the SAME config (reference-equal)", () => {
    const seed: NMUnitConfig = {
      enabled: true,
      competencies: ["agency_in_learning"],
      elements: ["acting_with_autonomy"],
      checkpoints: { L01: { elements: ["acting_with_autonomy"] } },
    };
    const next = removeCheckpoint(seed, "L01", "managing_self");
    expect(next).toBe(seed);
  });

  it("idempotent — removing from a non-existent page returns the SAME config", () => {
    const seed: NMUnitConfig = {
      enabled: true,
      competencies: ["agency_in_learning"],
      elements: ["acting_with_autonomy"],
      checkpoints: { L01: { elements: ["acting_with_autonomy"] } },
    };
    const next = removeCheckpoint(seed, "L99", "acting_with_autonomy");
    expect(next).toBe(seed);
  });

  it("does NOT prune unit-level elements when the same element is still on another page", () => {
    // The unit-level elements array isn't pruned by removeCheckpoint —
    // it tracks which elements have ever been used, and removing a
    // checkpoint from one page doesn't necessarily mean the element is
    // no longer used elsewhere. (Recompute is out-of-scope per docstring.)
    const seed: NMUnitConfig = {
      enabled: true,
      competencies: ["agency_in_learning"],
      elements: ["acting_with_autonomy"],
      checkpoints: {
        L01: { elements: ["acting_with_autonomy"] },
        L02: { elements: ["acting_with_autonomy"] },
      },
    };
    const next = removeCheckpoint(seed, "L01", "acting_with_autonomy");
    expect(next.elements).toEqual(["acting_with_autonomy"]); // unchanged
    expect(next.checkpoints).not.toHaveProperty("L01");
    expect(next.checkpoints["L02"].elements).toEqual(["acting_with_autonomy"]);
  });

  it("does not mutate the input config", () => {
    const seed: NMUnitConfig = {
      enabled: true,
      competencies: ["agency_in_learning"],
      elements: ["acting_with_autonomy"],
      checkpoints: { L01: { elements: ["acting_with_autonomy"] } },
    };
    const seedSnapshot = JSON.parse(JSON.stringify(seed));
    removeCheckpoint(seed, "L01", "acting_with_autonomy");
    expect(seed).toEqual(seedSnapshot);
  });
});

describe("Lever-MM checkpoint-ops — setCompetency", () => {
  it("sets the competency on a fresh config", () => {
    const next = setCompetency(DEFAULT_NM_CONFIG, "communication");
    expect(next.competencies).toEqual(["communication"]);
  });

  it("replaces a single-element competencies array (v1 semantics)", () => {
    const seed: NMUnitConfig = {
      enabled: true,
      competencies: ["agency_in_learning"],
      elements: ["acting_with_autonomy"],
      checkpoints: { L01: { elements: ["acting_with_autonomy"] } },
    };
    const next = setCompetency(seed, "communication");
    expect(next.competencies).toEqual(["communication"]);
  });

  it("does NOT touch elements or checkpoints when switching competency (orphan-element rule)", () => {
    const seed: NMUnitConfig = {
      enabled: true,
      competencies: ["agency_in_learning"],
      elements: ["acting_with_autonomy", "managing_self"],
      checkpoints: {
        L01: { elements: ["acting_with_autonomy"] },
        L02: { elements: ["managing_self"] },
      },
    };
    const next = setCompetency(seed, "communication");
    // Per Lever-MM brief stop-trigger: don't auto-erase elements when
    // competency changes — orphaned chips stay visible + removable by
    // the teacher. The stored elements/checkpoints data is preserved.
    expect(next.elements).toEqual(["acting_with_autonomy", "managing_self"]);
    expect(next.checkpoints).toEqual(seed.checkpoints);
  });

  it("idempotent — setting the same competency returns the SAME config (reference-equal)", () => {
    const seed: NMUnitConfig = {
      enabled: true,
      competencies: ["agency_in_learning"],
      elements: [],
      checkpoints: {},
    };
    const next = setCompetency(seed, "agency_in_learning");
    expect(next).toBe(seed);
  });

  it("does not mutate the input config", () => {
    const seed: NMUnitConfig = {
      enabled: true,
      competencies: ["agency_in_learning"],
      elements: ["acting_with_autonomy"],
      checkpoints: { L01: { elements: ["acting_with_autonomy"] } },
    };
    const seedSnapshot = JSON.parse(JSON.stringify(seed));
    setCompetency(seed, "communication");
    expect(seed).toEqual(seedSnapshot);
  });
});

describe("Lever-MM checkpoint-ops — round-trip + interaction", () => {
  it("add → remove returns the original elements but does not restore unit-level elements (by design)", () => {
    const seed = DEFAULT_NM_CONFIG;
    const added = addCheckpoint(seed, "L01", "acting_with_autonomy", "agency_in_learning");
    const removed = removeCheckpoint(added, "L01", "acting_with_autonomy");
    expect(removed.checkpoints).toEqual({}); // pageId was the only one — gone
    // elements stays populated even after removal — see removeCheckpoint
    // docstring (cross-page recompute is out of scope for v1).
    expect(removed.elements).toEqual(["acting_with_autonomy"]);
    // enabled stays true — once a unit has been NM-configured, it stays
    // configured even if every checkpoint is later removed. (Teachers
    // can disable from the school settings panel if needed.)
    expect(removed.enabled).toBe(true);
  });

  it("setCompetency does not affect existing checkpoints — a teacher can switch competency, see new palette, switch back, and chips stay", () => {
    let config = DEFAULT_NM_CONFIG;
    config = addCheckpoint(config, "L01", "acting_with_autonomy", "agency_in_learning");
    expect(config.checkpoints["L01"].elements).toEqual(["acting_with_autonomy"]);
    config = setCompetency(config, "communication");
    expect(config.competencies).toEqual(["communication"]);
    expect(config.checkpoints["L01"].elements).toEqual(["acting_with_autonomy"]); // chip preserved
    config = setCompetency(config, "agency_in_learning");
    expect(config.competencies).toEqual(["agency_in_learning"]);
    expect(config.checkpoints["L01"].elements).toEqual(["acting_with_autonomy"]); // still preserved
  });

  it("multiple pages independent — adding to L01 doesn't affect L02 and vice versa", () => {
    let config = DEFAULT_NM_CONFIG;
    config = addCheckpoint(config, "L01", "acting_with_autonomy", "agency_in_learning");
    config = addCheckpoint(config, "L02", "managing_self", "agency_in_learning");
    expect(config.checkpoints["L01"].elements).toEqual(["acting_with_autonomy"]);
    expect(config.checkpoints["L02"].elements).toEqual(["managing_self"]);
    config = removeCheckpoint(config, "L01", "acting_with_autonomy");
    expect(config.checkpoints).not.toHaveProperty("L01");
    expect(config.checkpoints["L02"].elements).toEqual(["managing_self"]);
  });
});
