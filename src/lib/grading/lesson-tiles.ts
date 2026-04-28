/**
 * Pure helpers for extracting "tiles" (gradeable activities) from a lesson page.
 *
 * A tile = one ActivitySection inside a UnitPage's content.sections[]. Each
 * tile produces one row per student in Calibrate. The tile_id matches the
 * canonical response-key shape — `activity_<id>` if a stable activityId is
 * present, else `section_<idx>` positional fallback (legacy V2/V3 tiles
 * that the migration backfilled to have stable IDs as of 27 Apr 2026).
 */

import type { ActivitySection, UnitPage } from "@/types";
import { getCriterionDisplay } from "@/lib/constants";

export interface LessonTile {
  /** "activity_<nanoid>" or "section_<idx>" — must match student_progress response key. */
  tileId: string;
  /** Index within the page's sections[] — used for stable React keys. */
  index: number;
  /** Title for display: prompt's first ~60 chars. */
  title: string;
  /** Resolved criterion key for display. Falls back to page-level criterion. */
  criterionKey: string | null;
  /** Display name + colour from the framework adapter. */
  criterionLabel: string;
  criterionColor: string;
  /** Original criterionTags from the section (may include framework codes). */
  criterionTags: string[];
  /** Whether this section has any expected text response (vs. content-only). */
  isGradeable: boolean;
}

/**
 * Resolve a tile_id for an ActivitySection. Mirrors the production response-key
 * format at src/app/(student)/unit/[unitId]/[pageId]/page.tsx:277.
 */
export function tileIdForSection(section: ActivitySection, index: number): string {
  if (section.activityId && section.activityId.length > 0) {
    return `activity_${section.activityId}`;
  }
  return `section_${index}`;
}

/**
 * Truncate a prompt for tile-strip display. Aim for ~60 chars; cut on word
 * boundary if possible.
 */
export function tileTitle(prompt: string | null | undefined, maxLen = 60): string {
  if (!prompt) return "Untitled tile";
  const trimmed = prompt.trim();
  if (trimmed.length <= maxLen) return trimmed;
  const cut = trimmed.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > maxLen * 0.6) return `${cut.slice(0, lastSpace)}…`;
  return `${cut}…`;
}

/**
 * Extract the gradeable tiles from a UnitPage. Excludes pages without a
 * sections array (welcome / overview / pure-content pages). Each tile
 * resolves its criterion via:
 *   1. section.criterionTags[0] (most specific)
 *   2. page.criterion (V2/V3 page-level criterion)
 *   3. null (teacher will pin during marking)
 *
 * The returned tile.criterionLabel + criterionColor come from
 * getCriterionDisplay, which knows the framework's vocabulary. The raw
 * criterionTags are preserved for the writer (G1.1.3 page POSTs) so it
 * can pass them through FrameworkAdapter.fromLabel() for neutralisation
 * before save.
 */
export function extractTilesFromPage(
  page: UnitPage | undefined,
  opts: { unitType?: string; framework?: string } = {},
): LessonTile[] {
  if (!page) return [];
  const sections = page.content?.sections ?? [];
  const out: LessonTile[] = [];

  for (let i = 0; i < sections.length; i += 1) {
    const section = sections[i];
    if (!section) continue;

    // criterion resolution chain
    const tagFromSection = section.criterionTags?.[0];
    const tagFromPage = page.criterion;
    const criterionKey = tagFromSection ?? tagFromPage ?? null;

    const display = criterionKey
      ? getCriterionDisplay(criterionKey, opts.unitType, opts.framework)
      : { key: "", name: "Unmapped", color: "#9CA3AF" };

    const isGradeable = Boolean(section.responseType) || Boolean(section.portfolioCapture);

    out.push({
      tileId: tileIdForSection(section, i),
      index: i,
      title: tileTitle(section.prompt),
      criterionKey,
      criterionLabel: display.name,
      criterionColor: display.color,
      criterionTags: section.criterionTags ? [...section.criterionTags] : [],
      isGradeable,
    });
  }

  return out;
}

/**
 * Build the confirmed/total counts for a tile across a cohort. Used by
 * the tile-strip queue to render the "5/24" progress label.
 */
export function tileProgress(
  tileId: string,
  cohortSize: number,
  confirmedRows: Array<{ tile_id: string; confirmed: boolean }>,
): { confirmed: number; total: number } {
  const confirmed = confirmedRows.filter(
    (r) => r.tile_id === tileId && r.confirmed,
  ).length;
  return { confirmed, total: cohortSize };
}
