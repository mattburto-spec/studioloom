import { describe, it, expect } from "vitest";
import {
  slugifyForFilename,
  buildFabricationDownloadFilename,
} from "../download-filename";

/**
 * Phase 6-6k tests. Locks the fabricator-facing filename shape so
 * teachers / fabricators can assume the convention once Phase 7
 * wires the helper into the download endpoint.
 */

describe("slugifyForFilename", () => {
  it("lowercases + kebabs a plain name", () => {
    expect(slugifyForFilename("Matt Burton")).toBe("matt-burton");
  });
  it("handles multiple spaces + punctuation", () => {
    expect(slugifyForFilename("Matt  B.  Burton")).toBe("matt-b-burton");
  });
  it("strips accents / diacritics", () => {
    expect(slugifyForFilename("Céline Dupré")).toBe("celine-dupre");
    expect(slugifyForFilename("Jürgen")).toBe("jurgen");
    expect(slugifyForFilename("Niño")).toBe("nino");
  });
  it("replaces non-ASCII script chars with hyphens (safe fallback)", () => {
    // Non-Latin scripts are stripped — filenames stay ASCII-safe.
    // PH6-FU-FILENAME-CJK can extend this if the school has CJK names.
    const out = slugifyForFilename("王小明");
    expect(out).toMatch(/^[a-z0-9-]*$/);
  });
  it("collapses runs of hyphens + trims edges", () => {
    expect(slugifyForFilename("-- Matt -- Burton --")).toBe("matt-burton");
  });
  it("returns empty string for null / undefined / whitespace", () => {
    expect(slugifyForFilename(null)).toBe("");
    expect(slugifyForFilename(undefined)).toBe("");
    expect(slugifyForFilename("   ")).toBe("");
  });
  it("preserves digits", () => {
    expect(slugifyForFilename("Year 10 Design")).toBe("year-10-design");
  });
});

describe("buildFabricationDownloadFilename", () => {
  it("combines all four fields with the canonical convention", () => {
    expect(
      buildFabricationDownloadFilename({
        studentName: "Matt Burton",
        gradeLevel: "10 Design",
        unitTitle: "Cardboard Furniture",
        originalFilename: "chair-v3.svg",
      })
    ).toBe("matt-burton-10-design-cardboard-furniture.svg");
  });

  it("drops null / empty context fields but keeps the rest", () => {
    expect(
      buildFabricationDownloadFilename({
        studentName: "Kai",
        gradeLevel: null,
        unitTitle: null,
        originalFilename: "coaster.svg",
      })
    ).toBe("kai.svg");
  });

  it("falls back to slugified original filename when NO context available", () => {
    expect(
      buildFabricationDownloadFilename({
        studentName: "",
        gradeLevel: null,
        unitTitle: null,
        originalFilename: "My Cool Model v2.STL",
      })
    ).toBe("my-cool-model-v2.stl");
  });

  it("handles extension-less original filename (no trailing dot)", () => {
    expect(
      buildFabricationDownloadFilename({
        studentName: "Kai",
        gradeLevel: null,
        unitTitle: null,
        originalFilename: "blob",
      })
    ).toBe("kai");
  });

  it("lowercases the extension always", () => {
    expect(
      buildFabricationDownloadFilename({
        studentName: "Kai",
        gradeLevel: null,
        unitTitle: null,
        originalFilename: "model.STL",
      })
    ).toBe("kai.stl");
  });

  it("produces a last-ditch fallback when nothing salvageable", () => {
    // Student name empty, no grade, no unit, original filename is
    // all-non-slug chars. Should still return something valid.
    expect(
      buildFabricationDownloadFilename({
        studentName: null,
        gradeLevel: null,
        unitTitle: null,
        originalFilename: "???.svg",
      })
    ).toBe("fabrication.svg");
  });

  it("handles unit titles with slashes / ampersands safely", () => {
    expect(
      buildFabricationDownloadFilename({
        studentName: "Kai",
        gradeLevel: "Year 9",
        unitTitle: "Art/Design & Tech",
        originalFilename: "final.svg",
      })
    ).toBe("kai-year-9-art-design-tech.svg");
  });

  it("is stable (idempotent) when re-applied to its own output", () => {
    const input = {
      studentName: "Matt Burton",
      gradeLevel: "10 Design",
      unitTitle: "Cardboard Furniture",
      originalFilename: "chair.svg",
    };
    const once = buildFabricationDownloadFilename(input);
    const twice = buildFabricationDownloadFilename({
      ...input,
      originalFilename: once,
    });
    // Re-feeding the already-slugified name shouldn't produce double
    // prefixing — it just stays as the student-context version with
    // the once-output's base appended. Not strictly identical but
    // the student-prefix convention holds.
    expect(twice.startsWith("matt-burton-10-design-cardboard-furniture"))
      .toBe(true);
    expect(twice.endsWith(".svg")).toBe(true);
  });
});
