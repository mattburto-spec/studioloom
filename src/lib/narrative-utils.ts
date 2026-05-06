import type { UnitPage, StudentProgress } from "@/types";
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
 * Build narrative sections from pages + progress.
 * If any section in the unit has portfolioCapture set, only include those sections.
 * Otherwise (legacy units), include all sections with responses.
 */
export function buildNarrativeSections(
  allPages: UnitPage[],
  allProgress: StudentProgress[]
): NarrativeSection[] {
  const usePortfolioFilter = hasAnyPortfolioCaptureFlags(allPages);
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
          if (section.portfolioCapture) {
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
