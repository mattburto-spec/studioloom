import { describe, it, expect } from "vitest";
import {
  computeCriterionCoverage,
  coverageStatus,
} from "../criterion-coverage";
import type { UnitContentData } from "@/types";

function v2Unit(sections: Array<{ activityId?: string; criterionTags?: string[] }>): UnitContentData {
  return {
    version: 2,
    pages: [
      {
        id: "p1",
        type: "lesson",
        title: "p1",
        content: {
          title: "p1",
          learningGoal: "",
          sections: sections.map((s, i) => ({
            prompt: `q${i}`,
            activityId: s.activityId ?? `id${i}`,
            criterionTags: s.criterionTags,
            responseType: "long-text",
          })),
        },
      },
    ],
  } as unknown as UnitContentData;
}

describe("computeCriterionCoverage", () => {
  it("returns empty when content is null or no students", () => {
    expect(computeCriterionCoverage(null, [], ["s1"])).toEqual([]);
    expect(computeCriterionCoverage(v2Unit([{ criterionTags: ["A"] }]), [], [])).toEqual([]);
  });

  it("counts students with at least one confirmed grade per criterion", () => {
    const unit = v2Unit([
      { activityId: "t1", criterionTags: ["designing"] },
      { activityId: "t2", criterionTags: ["designing"] },
    ]);
    const grades = [
      { student_id: "s1", page_id: "p1", tile_id: "activity_t1", confirmed: true, criterion_keys: ["designing"], score: 6 },
      { student_id: "s2", page_id: "p1", tile_id: "activity_t1", confirmed: true, criterion_keys: ["designing"], score: 5 },
      { student_id: "s3", page_id: "p1", tile_id: "activity_t1", confirmed: false, criterion_keys: ["designing"], score: 5 },
    ];
    const cov = computeCriterionCoverage(unit, grades, ["s1", "s2", "s3", "s4"]);
    expect(cov).toHaveLength(1);
    expect(cov[0].criterionKey).toBe("designing");
    expect(cov[0].confirmedStudents).toBe(2);
    expect(cov[0].totalStudents).toBe(4);
    expect(cov[0].percent).toBe(50); // 2/4
    expect(cov[0].tilesTargeting).toBe(2); // both tiles target designing
  });

  it("does not double-count a student with multiple confirmed grades on the same criterion", () => {
    const unit = v2Unit([
      { activityId: "t1", criterionTags: ["designing"] },
      { activityId: "t2", criterionTags: ["designing"] },
    ]);
    const grades = [
      { student_id: "s1", page_id: "p1", tile_id: "activity_t1", confirmed: true, criterion_keys: ["designing"], score: 6 },
      { student_id: "s1", page_id: "p1", tile_id: "activity_t2", confirmed: true, criterion_keys: ["designing"], score: 7 },
    ];
    const cov = computeCriterionCoverage(unit, grades, ["s1", "s2"]);
    expect(cov[0].confirmedStudents).toBe(1);
    expect(cov[0].percent).toBe(50);
  });

  it("ignores grades from students not in the cohort (RLS-defensive)", () => {
    const unit = v2Unit([{ activityId: "t1", criterionTags: ["designing"] }]);
    const grades = [
      { student_id: "stranger", page_id: "p1", tile_id: "activity_t1", confirmed: true, criterion_keys: ["designing"], score: 6 },
      { student_id: "s1", page_id: "p1", tile_id: "activity_t1", confirmed: true, criterion_keys: ["designing"], score: 6 },
    ];
    const cov = computeCriterionCoverage(unit, grades, ["s1", "s2"]);
    expect(cov[0].confirmedStudents).toBe(1);
  });

  it("ignores unconfirmed and null-score grades", () => {
    const unit = v2Unit([{ activityId: "t1", criterionTags: ["designing"] }]);
    const grades = [
      { student_id: "s1", page_id: "p1", tile_id: "activity_t1", confirmed: false, criterion_keys: ["designing"], score: 6 },
      { student_id: "s2", page_id: "p1", tile_id: "activity_t1", confirmed: true, criterion_keys: ["designing"], score: null },
    ];
    const cov = computeCriterionCoverage(unit, grades, ["s1", "s2", "s3"]);
    expect(cov[0].confirmedStudents).toBe(0);
  });

  it("enumerates multiple criteria across tiles", () => {
    const unit = v2Unit([
      { activityId: "t1", criterionTags: ["designing"] },
      { activityId: "t2", criterionTags: ["evaluating"] },
      { activityId: "t3", criterionTags: ["designing", "evaluating"] },
    ]);
    const grades = [
      { student_id: "s1", page_id: "p1", tile_id: "activity_t1", confirmed: true, criterion_keys: ["designing"], score: 6 },
      { student_id: "s1", page_id: "p1", tile_id: "activity_t2", confirmed: true, criterion_keys: ["evaluating"], score: 5 },
    ];
    const cov = computeCriterionCoverage(unit, grades, ["s1", "s2"]);
    const keys = cov.map((c) => c.criterionKey).sort();
    expect(keys).toEqual(["designing", "evaluating"]);
    const designing = cov.find((c) => c.criterionKey === "designing")!;
    const evaluating = cov.find((c) => c.criterionKey === "evaluating")!;
    expect(designing.tilesTargeting).toBe(2); // t1 + t3
    expect(evaluating.tilesTargeting).toBe(2); // t2 + t3
    expect(designing.confirmedStudents).toBe(1);
    expect(evaluating.confirmedStudents).toBe(1);
  });

  it("sorts criteria ascending by percent (needs-attention first)", () => {
    const unit = v2Unit([
      { activityId: "t1", criterionTags: ["designing"] },
      { activityId: "t2", criterionTags: ["evaluating"] },
    ]);
    const grades = [
      { student_id: "s1", page_id: "p1", tile_id: "activity_t1", confirmed: true, criterion_keys: ["designing"], score: 6 },
      { student_id: "s2", page_id: "p1", tile_id: "activity_t1", confirmed: true, criterion_keys: ["designing"], score: 6 },
    ];
    const cov = computeCriterionCoverage(unit, grades, ["s1", "s2"]);
    expect(cov[0].criterionKey).toBe("evaluating"); // 0% first
    expect(cov[1].criterionKey).toBe("designing");  // 100% last
  });
});

describe("coverageStatus", () => {
  it("buckets percents", () => {
    expect(coverageStatus(0)).toBe("thin");
    expect(coverageStatus(39)).toBe("thin");
    expect(coverageStatus(40)).toBe("partial");
    expect(coverageStatus(79)).toBe("partial");
    expect(coverageStatus(80)).toBe("covered");
    expect(coverageStatus(100)).toBe("covered");
  });
});
