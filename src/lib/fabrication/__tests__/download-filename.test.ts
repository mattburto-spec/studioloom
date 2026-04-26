import { describe, it, expect } from "vitest";
import {
  slugifyForFilename,
  buildFabricationDownloadFilename,
} from "../download-filename";

/**
 * Phase 6-6k tests + Phase 8.1d-19 collision-resistance update.
 *
 * Locks the fabricator-facing filename shape so teachers /
 * fabricators can rely on the convention. The 8.1d-19 changes
 * added two new discriminators (originalBase + date+time) so
 * different files from the same student / class / unit no longer
 * overwrite each other in the lab tech's downloads folder.
 */

// Pinned timestamp for deterministic tests. UTC matters — the
// helper formats in UTC for stability across regions.
const T_2026_04_26_1430Z = "2026-04-26T14:30:12Z";

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

describe("buildFabricationDownloadFilename — collision-resistant format (8.1d-19)", () => {
  it("combines all 5 segments: student + grade + unit + originalBase + date", () => {
    expect(
      buildFabricationDownloadFilename({
        studentName: "Matt Burton",
        gradeLevel: "10 Design",
        unitTitle: "Cardboard Furniture",
        originalFilename: "chair-v3.svg",
        submittedAt: T_2026_04_26_1430Z,
      })
    ).toBe(
      "matt-burton-10-design-cardboard-furniture-chair-v3-2026-04-26-1430.svg"
    );
  });

  it("disambiguates same-student same-class same-unit by file content (originalBase)", () => {
    // The exact case Matt flagged in S3 smoke 26 Apr: same student,
    // same class, same unit, two different files in the same minute.
    // Without the originalBase discriminator both would have come out
    // as `matt-burton-10-design-cardboard-furniture-...svg` and the
    // second download would overwrite the first.
    const a = buildFabricationDownloadFilename({
      studentName: "Matt Burton",
      gradeLevel: "10 Design",
      unitTitle: "Cardboard Furniture",
      originalFilename: "chair.svg",
      submittedAt: T_2026_04_26_1430Z,
    });
    const b = buildFabricationDownloadFilename({
      studentName: "Matt Burton",
      gradeLevel: "10 Design",
      unitTitle: "Cardboard Furniture",
      originalFilename: "table.svg",
      submittedAt: T_2026_04_26_1430Z,
    });
    expect(a).not.toBe(b);
    expect(a).toContain("-chair-");
    expect(b).toContain("-table-");
  });

  it("disambiguates re-submissions of the same file by date (date+time)", () => {
    const morning = buildFabricationDownloadFilename({
      studentName: "Matt Burton",
      gradeLevel: "10 Design",
      unitTitle: "Cardboard Furniture",
      originalFilename: "chair.svg",
      submittedAt: "2026-04-26T09:00:00Z",
    });
    const afternoon = buildFabricationDownloadFilename({
      studentName: "Matt Burton",
      gradeLevel: "10 Design",
      unitTitle: "Cardboard Furniture",
      originalFilename: "chair.svg",
      submittedAt: "2026-04-26T15:00:00Z",
    });
    expect(morning).not.toBe(afternoon);
    expect(morning).toContain("-2026-04-26-0900");
    expect(afternoon).toContain("-2026-04-26-1500");
  });

  it("formats date+time in UTC (timezone-stable across regions)", () => {
    // Same wall-clock moment in two ISO strings (one with Z, one
    // with explicit +0). Output should be identical.
    const out1 = buildFabricationDownloadFilename({
      studentName: "Kai",
      gradeLevel: null,
      unitTitle: null,
      originalFilename: "x.stl",
      submittedAt: "2026-04-26T14:30:00Z",
    });
    const out2 = buildFabricationDownloadFilename({
      studentName: "Kai",
      gradeLevel: null,
      unitTitle: null,
      originalFilename: "x.stl",
      submittedAt: "2026-04-26T14:30:00+00:00",
    });
    expect(out1).toBe(out2);
    expect(out1).toContain("-2026-04-26-1430");
  });

  it("drops null / empty context fields but keeps the rest + date", () => {
    expect(
      buildFabricationDownloadFilename({
        studentName: "Kai",
        gradeLevel: null,
        unitTitle: null,
        originalFilename: "coaster.svg",
        submittedAt: T_2026_04_26_1430Z,
      })
    ).toBe("kai-coaster-2026-04-26-1430.svg");
  });

  it("omits date segment cleanly when submittedAt is null/undefined", () => {
    // Backwards-compat for callers that don't have a timestamp
    // (e.g. tests, ad-hoc previews). No trailing hyphen left over.
    expect(
      buildFabricationDownloadFilename({
        studentName: "Matt Burton",
        gradeLevel: "10 Design",
        unitTitle: "Cardboard Furniture",
        originalFilename: "chair.svg",
        submittedAt: null,
      })
    ).toBe("matt-burton-10-design-cardboard-furniture-chair.svg");
    expect(
      buildFabricationDownloadFilename({
        studentName: "Matt Burton",
        gradeLevel: "10 Design",
        unitTitle: "Cardboard Furniture",
        originalFilename: "chair.svg",
      })
    ).toBe("matt-burton-10-design-cardboard-furniture-chair.svg");
  });

  it("omits date segment when submittedAt is unparseable (defensive)", () => {
    expect(
      buildFabricationDownloadFilename({
        studentName: "Kai",
        gradeLevel: null,
        unitTitle: null,
        originalFilename: "x.svg",
        submittedAt: "not-a-real-date",
      })
    ).toBe("kai-x.svg");
  });

  it("falls back to slugified original + date when NO student/grade/unit context", () => {
    expect(
      buildFabricationDownloadFilename({
        studentName: "",
        gradeLevel: null,
        unitTitle: null,
        originalFilename: "My Cool Model v2.STL",
        submittedAt: T_2026_04_26_1430Z,
      })
    ).toBe("my-cool-model-v2-2026-04-26-1430.stl");
  });

  it("handles extension-less original filename (no trailing dot)", () => {
    expect(
      buildFabricationDownloadFilename({
        studentName: "Kai",
        gradeLevel: null,
        unitTitle: null,
        originalFilename: "blob",
        submittedAt: T_2026_04_26_1430Z,
      })
    ).toBe("kai-blob-2026-04-26-1430");
  });

  it("lowercases the extension always", () => {
    expect(
      buildFabricationDownloadFilename({
        studentName: "Kai",
        gradeLevel: null,
        unitTitle: null,
        originalFilename: "model.STL",
        submittedAt: T_2026_04_26_1430Z,
      })
    ).toBe("kai-model-2026-04-26-1430.stl");
  });

  it("produces a last-ditch fallback when nothing salvageable", () => {
    // Student name empty, no grade, no unit, original filename is
    // all-non-slug chars. Should still return something valid.
    // Date keeps it unique even at the bottom of the fallback chain.
    expect(
      buildFabricationDownloadFilename({
        studentName: null,
        gradeLevel: null,
        unitTitle: null,
        originalFilename: "???.svg",
        submittedAt: T_2026_04_26_1430Z,
      })
    ).toBe("fabrication-2026-04-26-1430.svg");
    // …and even nuller still works.
    expect(
      buildFabricationDownloadFilename({
        studentName: null,
        gradeLevel: null,
        unitTitle: null,
        originalFilename: "???.svg",
        submittedAt: null,
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
        submittedAt: T_2026_04_26_1430Z,
      })
    ).toBe("kai-year-9-art-design-tech-final-2026-04-26-1430.svg");
  });
});
