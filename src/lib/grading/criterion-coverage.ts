/**
 * G2.2 — Criterion coverage heatmap.
 *
 * "Have I graded enough on each criterion before releasing?" Aggregates
 * confirmed tile grades across the WHOLE unit (not just the active page)
 * and reports, per criterion, how many students have at least one
 * confirmed score.
 *
 * Pure derivation from already-loaded state — no DB calls.
 */

import { extractTilesFromPage } from "./lesson-tiles";
import { getCriterionDisplay } from "@/lib/constants";
import { getPageList } from "@/lib/unit-adapter";
import type { UnitContentData } from "@/types";

interface CoverageGradeInput {
  student_id: string;
  page_id: string;
  tile_id: string;
  confirmed: boolean;
  criterion_keys: string[];
  score: number | null;
}

export interface CriterionCoverage {
  criterionKey: string;
  /** Display label (framework-aware via getCriterionDisplay). */
  label: string;
  /** Display colour (hex). */
  color: string;
  /** Number of students with ≥1 confirmed score on a tile tagged with this criterion. */
  confirmedStudents: number;
  /** Total students in the cohort. */
  totalStudents: number;
  /** Percent rounded to nearest integer. */
  percent: number;
  /** Number of tiles in the unit that target this criterion. */
  tilesTargeting: number;
}

/**
 * Compute per-criterion coverage for a unit.
 *
 * @param contentData     The unit's resolved content_data (forked or master).
 * @param grades          All confirmed (or unconfirmed — we filter) grade rows for this unit+class.
 * @param studentIds      Cohort student IDs (drives the denominator).
 * @param framework       Optional, drives criterion display name + colour.
 * @param unitType        Optional, fallback for criterion mapping.
 */
export function computeCriterionCoverage(
  contentData: UnitContentData | null,
  grades: CoverageGradeInput[],
  studentIds: string[],
  opts: { framework?: string; unitType?: string } = {},
): CriterionCoverage[] {
  if (!contentData || studentIds.length === 0) return [];

  // Walk every tile in every page, collect:
  //  - unique criterion keys across the unit
  //  - count of tiles targeting each
  const tilesTargetingByKey = new Map<string, number>();
  const pages = getPageList(contentData);
  for (const page of pages) {
    const tiles = extractTilesFromPage(page, opts);
    for (const t of tiles) {
      // criterionTags is the raw (possibly framework-coded) set; the rollup
      // and the heatmap use neutral keys persisted on student_tile_grades.
      // We use criterionTags here for ENUMERATION (which criteria are *targeted*
      // by the unit), and the grades' criterion_keys for COVERAGE counts.
      // This handles tiles whose criterionTags are framework codes ("A", "B")
      // or already neutral ("designing") — same enumeration shape either way.
      for (const tag of t.criterionTags) {
        tilesTargetingByKey.set(tag, (tilesTargetingByKey.get(tag) ?? 0) + 1);
      }
      // If the tile has a fallback page-level criterion, count that too.
      if (t.criterionTags.length === 0 && t.criterionKey) {
        tilesTargetingByKey.set(
          t.criterionKey,
          (tilesTargetingByKey.get(t.criterionKey) ?? 0) + 1,
        );
      }
    }
  }

  // For each enumerated criterion, count students with ≥1 confirmed grade on
  // a tile whose criterion_keys array CONTAINS that criterion. Exact-match
  // is fine — the writer already neutralised at save time.
  const studentSet = new Set(studentIds);
  const out: CriterionCoverage[] = [];
  for (const [criterionKey, tilesTargeting] of tilesTargetingByKey) {
    const studentsWithConfirmed = new Set<string>();
    for (const g of grades) {
      if (!g.confirmed) continue;
      if (g.score === null) continue;
      if (!studentSet.has(g.student_id)) continue;
      if (!g.criterion_keys.includes(criterionKey)) continue;
      studentsWithConfirmed.add(g.student_id);
    }
    const display = getCriterionDisplay(criterionKey, opts.unitType, opts.framework);
    out.push({
      criterionKey,
      label: display.name,
      color: display.color,
      confirmedStudents: studentsWithConfirmed.size,
      totalStudents: studentIds.length,
      percent:
        studentIds.length === 0
          ? 0
          : Math.round((studentsWithConfirmed.size / studentIds.length) * 100),
      tilesTargeting,
    });
  }

  // Sort by percent ascending so "needs attention" criteria float to the left.
  out.sort((a, b) => a.percent - b.percent || a.criterionKey.localeCompare(b.criterionKey));
  return out;
}

/**
 * Bucket a coverage percent into a status label for visual treatment.
 *  >= 80 → "covered" (green)
 *  >= 40 → "partial" (amber)
 *  <  40 → "thin"    (red)
 */
export type CoverageStatus = "covered" | "partial" | "thin";

export function coverageStatus(percent: number): CoverageStatus {
  if (percent >= 80) return "covered";
  if (percent >= 40) return "partial";
  return "thin";
}
