import { describe, it, expect } from "vitest";
import { validateUnitJson, isJsonUnitFile } from "../import-json";

const validV4 = {
  format: "studioloom-unit-v1",
  title: "Test Unit",
  description: "Hand-authored",
  gradeLevel: "Grade 9",
  topic: "Sustainability",
  unitType: "design",
  contentData: {
    version: 4,
    generationModel: "timeline",
    lessonLengthMinutes: 60,
    assessmentCriteria: ["A", "B", "C", "D"],
    timeline: [
      {
        id: "abc12345",
        role: "warmup",
        title: "Hook",
        prompt: "Watch this 2 min video.",
        durationMinutes: 5,
        timeWeight: "quick",
      },
      {
        id: "def67890",
        role: "core",
        title: "Investigate",
        prompt: "Take apart the product.",
        durationMinutes: 30,
        criterionTags: ["A1", "B2"],
      },
    ],
  },
};

describe("validateUnitJson", () => {
  it("accepts a complete v4 unit", () => {
    const result = validateUnitJson(JSON.stringify(validV4));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.title).toBe("Test Unit");
      expect(result.payload.unitType).toBe("design");
      expect(result.payload.contentData.version).toBe(4);
      expect(result.warnings).toEqual([]);
    }
  });

  it("rejects malformed JSON with the parse error", () => {
    const result = validateUnitJson("{ not valid json");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0].path).toBe("(root)");
      expect(result.errors[0].message).toContain("Invalid JSON");
    }
  });

  it("rejects a non-object root", () => {
    const result = validateUnitJson("[]");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0].message).toContain("must be a JSON object");
    }
  });

  it("warns (not errors) when format is missing but accepts otherwise valid input", () => {
    const noFormat = { ...validV4 };
    delete (noFormat as Record<string, unknown>).format;
    const result = validateUnitJson(JSON.stringify(noFormat));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings.some((w) => w.includes("format"))).toBe(true);
    }
  });

  it("rejects a wrong format string", () => {
    const result = validateUnitJson(
      JSON.stringify({ ...validV4, format: "different-format" })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === "format")).toBe(true);
    }
  });

  it("requires a non-empty title", () => {
    const result = validateUnitJson(JSON.stringify({ ...validV4, title: "" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === "title")).toBe(true);
    }
  });

  it("requires contentData to be an object", () => {
    const result = validateUnitJson(
      JSON.stringify({ ...validV4, contentData: "nope" })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === "contentData")).toBe(true);
    }
  });

  it("rejects an unknown contentData.version", () => {
    const result = validateUnitJson(
      JSON.stringify({
        ...validV4,
        contentData: { ...validV4.contentData, version: 99 },
      })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === "contentData.version")).toBe(true);
    }
  });

  it("rejects v4 with non-timeline generationModel", () => {
    const result = validateUnitJson(
      JSON.stringify({
        ...validV4,
        contentData: { ...validV4.contentData, generationModel: "journey" },
      })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some((e) => e.path === "contentData.generationModel")
      ).toBe(true);
    }
  });

  it("rejects v4 with missing or non-positive lessonLengthMinutes", () => {
    const result = validateUnitJson(
      JSON.stringify({
        ...validV4,
        contentData: { ...validV4.contentData, lessonLengthMinutes: 0 },
      })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some((e) => e.path === "contentData.lessonLengthMinutes")
      ).toBe(true);
    }
  });

  it("rejects an activity with an unknown role", () => {
    const bad = JSON.parse(JSON.stringify(validV4));
    bad.contentData.timeline[0].role = "homework";
    const result = validateUnitJson(JSON.stringify(bad));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some((e) => e.path === "contentData.timeline[0].role")
      ).toBe(true);
    }
  });

  it("rejects duplicate activity ids", () => {
    const bad = JSON.parse(JSON.stringify(validV4));
    bad.contentData.timeline[1].id = bad.contentData.timeline[0].id;
    const result = validateUnitJson(JSON.stringify(bad));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some(
          (e) =>
            e.path === "contentData.timeline[1].id" &&
            e.message.includes("Duplicate")
        )
      ).toBe(true);
    }
  });

  it("rejects negative durationMinutes on an activity", () => {
    const bad = JSON.parse(JSON.stringify(validV4));
    bad.contentData.timeline[0].durationMinutes = -5;
    const result = validateUnitJson(JSON.stringify(bad));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some(
          (e) => e.path === "contentData.timeline[0].durationMinutes"
        )
      ).toBe(true);
    }
  });

  it("rejects an unknown unitType", () => {
    const result = validateUnitJson(
      JSON.stringify({ ...validV4, unitType: "something_else" })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === "unitType")).toBe(true);
    }
  });

  it("warns on an empty timeline but does not reject", () => {
    const result = validateUnitJson(
      JSON.stringify({
        ...validV4,
        contentData: { ...validV4.contentData, timeline: [] },
      })
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings.some((w) => w.includes("empty"))).toBe(true);
    }
  });

  it("accepts a v2 pages-shaped unit", () => {
    const v2 = {
      format: "studioloom-unit-v1",
      title: "v2 Unit",
      contentData: {
        version: 2,
        pages: [
          {
            id: "p1",
            type: "lesson",
            title: "Lesson 1",
            content: { body: "..." },
          },
        ],
      },
    };
    const result = validateUnitJson(JSON.stringify(v2));
    expect(result.ok).toBe(true);
  });

  it("collects multiple errors in a single pass", () => {
    const result = validateUnitJson(
      JSON.stringify({
        title: "",
        contentData: { version: 99 },
      })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("isJsonUnitFile", () => {
  it("matches by .json extension", () => {
    const f = new File(["{}"], "unit.json", { type: "" });
    expect(isJsonUnitFile(f)).toBe(true);
  });

  it("matches by application/json MIME type", () => {
    const f = new File(["{}"], "unit", { type: "application/json" });
    expect(isJsonUnitFile(f)).toBe(true);
  });

  it("rejects non-JSON files", () => {
    const f = new File(["..."], "unit.pdf", { type: "application/pdf" });
    expect(isJsonUnitFile(f)).toBe(false);
  });
});
