import { describe, expect, it } from "vitest";

import type {
  DesignConstraints,
  UnitBrief,
  UnitBriefAmendment,
  UnitBriefConstraints,
} from "../unit-brief";

describe("UnitBrief — type shapes", () => {
  it("constructs a Design-archetype UnitBrief with all fields and asserts exact values", () => {
    const constraints: UnitBriefConstraints = {
      archetype: "design",
      data: {
        dimensions: { h: 200, w: 150, d: 80, unit: "mm" },
        materials_whitelist: ["pla", "plywood-3mm", "CNC MDF 12mm"],
        budget: "≤ AUD $20",
        audience: "Year 7 students at NIS",
        must_include: ["a moving part", "a brand mark"],
        must_avoid: ["batteries", "exposed sharp edges"],
      },
    };

    const brief: UnitBrief = {
      unit_id: "unit-abc",
      brief_text: "Design a desk-organiser for a Year 7 student.",
      constraints,
      diagram_url: "/api/storage/unit-images/unit-abc/brief-diagram-12345.jpg",
      created_at: "2026-05-13T09:00:00.000Z",
      updated_at: "2026-05-13T09:05:00.000Z",
      created_by: "teacher-uuid-1",
    };

    expect(brief.unit_id).toBe("unit-abc");
    expect(brief.brief_text).toBe("Design a desk-organiser for a Year 7 student.");
    expect(brief.constraints.archetype).toBe("design");
    expect(brief.diagram_url).toBe("/api/storage/unit-images/unit-abc/brief-diagram-12345.jpg");
    expect(brief.created_by).toBe("teacher-uuid-1");
    expect(brief.created_at).toBe("2026-05-13T09:00:00.000Z");
    expect(brief.updated_at).toBe("2026-05-13T09:05:00.000Z");

    // Narrow on archetype to access design-only fields
    if (brief.constraints.archetype === "design") {
      const data: DesignConstraints = brief.constraints.data;
      expect(data.dimensions).toEqual({ h: 200, w: 150, d: 80, unit: "mm" });
      expect(data.dimensions?.h).toBe(200);
      expect(data.dimensions?.unit).toBe("mm");
      // Catalogue chips + free-text custom entries coexist in the same array.
      expect(data.materials_whitelist).toEqual(["pla", "plywood-3mm", "CNC MDF 12mm"]);
      expect(data.budget).toBe("≤ AUD $20");
      expect(data.audience).toBe("Year 7 students at NIS");
      expect(data.must_include).toEqual(["a moving part", "a brand mark"]);
      expect(data.must_avoid).toEqual(["batteries", "exposed sharp edges"]);
    } else {
      throw new Error("Discriminated union should have narrowed to design");
    }
  });

  it("allows a partial DesignDimensions object (axes are independent)", () => {
    const constraints: UnitBriefConstraints = {
      archetype: "design",
      data: {
        // Only height capped, width + depth unconstrained.
        dimensions: { h: 250, unit: "mm" },
      },
    };
    if (constraints.archetype === "design") {
      expect(constraints.data.dimensions).toEqual({ h: 250, unit: "mm" });
      expect(constraints.data.dimensions?.w).toBeUndefined();
      expect(constraints.data.dimensions?.d).toBeUndefined();
    } else {
      throw new Error("Discriminated union should have narrowed to design");
    }
  });

  it("constructs a Generic-archetype UnitBrief (non-Design fallback) with empty data object", () => {
    const constraints: UnitBriefConstraints = {
      archetype: "generic",
      data: {},
    };

    const brief: UnitBrief = {
      unit_id: "unit-service-1",
      brief_text: "Run a 6-week service project for the Year 8 cohort.",
      constraints,
      diagram_url: null,
      created_at: "2026-05-13T09:10:00.000Z",
      updated_at: "2026-05-13T09:10:00.000Z",
      created_by: "teacher-uuid-2",
    };

    expect(brief.constraints.archetype).toBe("generic");
    expect(brief.constraints.data).toEqual({});
    expect(brief.brief_text).toBe("Run a 6-week service project for the Year 8 cohort.");
  });

  it("constructs an Amendment with exact values", () => {
    const amendment: UnitBriefAmendment = {
      id: "amendment-uuid-1",
      unit_id: "unit-abc",
      version_label: "v2.0",
      title: "Add LEDs",
      body: "The brief now requires at least one LED on the final prototype.",
      created_at: "2026-05-13T10:00:00.000Z",
      created_by: "teacher-uuid-1",
    };

    expect(amendment.id).toBe("amendment-uuid-1");
    expect(amendment.unit_id).toBe("unit-abc");
    expect(amendment.version_label).toBe("v2.0");
    expect(amendment.title).toBe("Add LEDs");
    expect(amendment.body).toBe(
      "The brief now requires at least one LED on the final prototype.",
    );
    expect(amendment.created_at).toBe("2026-05-13T10:00:00.000Z");
    expect(amendment.created_by).toBe("teacher-uuid-1");
  });

  it("allows nullable brief_text + created_by + diagram_url per the schema", () => {
    const brief: UnitBrief = {
      unit_id: "unit-empty",
      brief_text: null,
      constraints: { archetype: "generic", data: {} },
      diagram_url: null,
      created_at: "2026-05-13T09:15:00.000Z",
      updated_at: "2026-05-13T09:15:00.000Z",
      created_by: null,
    };

    expect(brief.brief_text).toBeNull();
    expect(brief.created_by).toBeNull();
    expect(brief.diagram_url).toBeNull();
  });

  it("supports partial Design constraints (all fields optional)", () => {
    // Teacher fills in only budget + audience, leaves everything else off
    const constraints: UnitBriefConstraints = {
      archetype: "design",
      data: {
        budget: "free",
        audience: "Year 9",
      },
    };

    if (constraints.archetype === "design") {
      expect(constraints.data.budget).toBe("free");
      expect(constraints.data.audience).toBe("Year 9");
      expect(constraints.data.dimensions).toBeUndefined();
      expect(constraints.data.materials_whitelist).toBeUndefined();
      expect(constraints.data.must_include).toBeUndefined();
      expect(constraints.data.must_avoid).toBeUndefined();
    } else {
      throw new Error("Discriminated union should have narrowed to design");
    }
  });

  it("DimensionUnit narrows to mm | cm | in", () => {
    const cases: Array<UnitBriefConstraints> = [
      { archetype: "design", data: { dimensions: { h: 1, unit: "mm" } } },
      { archetype: "design", data: { dimensions: { h: 1, unit: "cm" } } },
      { archetype: "design", data: { dimensions: { h: 1, unit: "in" } } },
    ];
    for (const c of cases) {
      if (c.archetype === "design") {
        expect(["mm", "cm", "in"]).toContain(c.data.dimensions?.unit);
      }
    }
  });
});
