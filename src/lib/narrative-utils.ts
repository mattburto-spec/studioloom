import type { UnitPage, StudentProgress, PortfolioEntry } from "@/types";
import type { NarrativeSection } from "@/components/portfolio/NarrativeView";
import { CRITERIA, type CriterionKey, getPageColor, PAGE_TYPE_LABELS } from "@/lib/constants";

/**
 * Check if any page in the unit has at least one section with portfolioCapture set.
 * Used for backwards compatibility: if none do, show everything.
 */
function hasAnyPortfolioCaptureFlags(pages: UnitPage[]): boolean {
  return pages.some((page) =>
    page.content?.sections?.some((s) => s.portfolioCapture === true)
  );
}

/**
 * LIS.E (FU-LIS-PORTFOLIO-NARRATIVE-DISPLAY) — build the set of
 * (pageId, sectionIndex) coords that have a portfolio_entries row for
 * this student/unit. Used to widen the portfolio-filter so a section
 * shows up in Narrative when the student manually pressed the Portfolio
 * affordance, even if `section.portfolioCapture` is false on the section
 * itself (which is the common case for plain text responses — only
 * structured-prompts and lever-1-flagged sections set portfolioCapture
 * by default).
 */
function buildSentToPortfolioSet(
  portfolioEntries: PortfolioEntry[]
): Set<string> {
  const set = new Set<string>();
  for (const entry of portfolioEntries) {
    if (entry.page_id && entry.section_index !== null && entry.section_index !== undefined) {
      set.add(`${entry.page_id}:${entry.section_index}`);
    }
  }
  return set;
}

/**
 * Build narrative sections from pages + progress.
 *
 * Inclusion rules:
 *   1. If any section in the unit has `portfolioCapture` set, the
 *      portfolio filter activates. In filter mode a section's response
 *      is included when EITHER:
 *      a) the section has `portfolioCapture: true` (auto-capture path:
 *         AG.1 structured-prompts, lever-1 flagged blocks, etc.); OR
 *      b) the student has manually sent the response to portfolio (a
 *         portfolio_entries row exists for the section's `(page_id,
 *         section_index)` — LIS.E fix for FU-LIS-PORTFOLIO-NARRATIVE-
 *         DISPLAY where manual Portfolio captures of regular text
 *         responses were silently dropped).
 *   2. Otherwise (legacy units with no portfolio flags anywhere),
 *      include all sections that have a non-empty response.
 */
export function buildNarrativeSections(
  allPages: UnitPage[],
  allProgress: StudentProgress[],
  portfolioEntries: PortfolioEntry[] = []
): NarrativeSection[] {
  const usePortfolioFilter = hasAnyPortfolioCaptureFlags(allPages);
  const sentToPortfolio = buildSentToPortfolioSet(portfolioEntries);
  const sections: NarrativeSection[] = [];
  let currentGroup: NarrativeSection | null = null;

  for (const page of allPages) {
    const pageProgress = allProgress.find((p) => p.page_id === page.id);
    const responses =
      (pageProgress?.responses as Record<string, unknown>) || {};

    // Filter responses based on portfolioCapture flags.
    //
    // Smoke-fix 6 May 2026 (round 5): the lesson page stores responses
    // under TWO different key schemes:
    //   - "section_${i}"            — legacy sections without activityId
    //   - "activity_${activityId}"  — modern activity blocks (Process
    //                                  Journal, custom blocks, anything
    //                                  authored via BlockPalette)
    // Narrative was only ever reading section_${i}, so any new-style
    // block (including the AG.1 Process Journal) silently fell off the
    // narrative even though student_progress.responses held the data.
    // We now try the activity_ key first, falling back to section_ for
    // legacy. The output is still keyed by section_${i} so the
    // downstream renderer doesn't have to know about the dual scheme.
    const filteredResponses: Record<string, unknown> = {};
    if (page.content?.sections) {
      page.content.sections.forEach((section, i) => {
        const sectionKey = `section_${i}`;
        const activityKey = section.activityId
          ? `activity_${section.activityId}`
          : null;
        // Prefer activityId-keyed value (modern); fall back to
        // section-index-keyed (legacy).
        const value =
          (activityKey ? responses[activityKey] : undefined) ??
          responses[sectionKey];
        if (value === null || value === undefined || value === "") return;

        if (usePortfolioFilter) {
          // LIS.E — include if the section has portfolioCapture OR the
          // student manually sent it to portfolio (Portfolio affordance
          // on a regular text response).
          const wasSentToPortfolio = sentToPortfolio.has(`${page.id}:${i}`);
          if (section.portfolioCapture || wasSentToPortfolio) {
            filteredResponses[sectionKey] = value;
          }
        } else {
          filteredResponses[sectionKey] = value;
        }
      });
    }

    // Include reflection responses (always shown when not filtering, skip when filtering)
    if (!usePortfolioFilter && page.content?.reflection) {
      page.content.reflection.items.forEach((_, i) => {
        const key = `reflection_${i}`;
        if (
          responses[key] !== null &&
          responses[key] !== undefined &&
          responses[key] !== ""
        ) {
          filteredResponses[key] = responses[key];
        }
      });
    }

    const hasResponses = Object.keys(filteredResponses).length > 0;
    if (!hasResponses) continue;

    const pageEntry = {
      page,
      responses: filteredResponses,
      updatedAt: pageProgress?.updated_at || null,
    };

    if (page.type === "strand" && page.criterion) {
      if (
        currentGroup &&
        sections.length > 0 &&
        currentGroup === sections[sections.length - 1] &&
        currentGroup.heading ===
          CRITERIA[page.criterion as CriterionKey].name
      ) {
        currentGroup.pages.push(pageEntry);
      } else {
        currentGroup = {
          heading: CRITERIA[page.criterion as CriterionKey].name,
          color: CRITERIA[page.criterion as CriterionKey].color,
          pages: [pageEntry],
        };
        sections.push(currentGroup);
      }
    } else {
      currentGroup = null;
      sections.push({
        heading: PAGE_TYPE_LABELS[page.type] || page.title,
        color: getPageColor(page),
        pages: [pageEntry],
      });
    }
  }

  return sections;
}
