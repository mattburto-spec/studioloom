import { nanoid } from "nanoid";
import { DEFAULT_MYP_PAGES } from "@/lib/constants";
import type { CriterionKey } from "@/lib/constants";
import type { UnitContentData, UnitContentDataV2, UnitContentDataV3, UnitContentDataV4, UnitPage, PageContent } from "@/types";
import { v4ToPageList } from "@/lib/timeline";

/**
 * Check if content_data is v2 (criterion-based) format.
 */
export function isV2(raw: UnitContentData): raw is UnitContentDataV2 {
  return raw != null && "version" in raw && (raw as UnitContentDataV2).version === 2;
}

/**
 * Check if content_data is v3 (journey-based) format.
 */
export function isV3(raw: UnitContentData): raw is UnitContentDataV3 {
  return raw != null && "version" in raw && (raw as { version: number }).version === 3;
}

/**
 * Check if content_data is v4 (timeline-based) format.
 */
export function isV4(raw: UnitContentData): raw is UnitContentDataV4 {
  return raw != null && "version" in raw && (raw as { version: number }).version === 4;
}

/**
 * Normalize content_data to v2 format.
 * v1 (Record<PageId, PageContent>) → ordered UnitPage[] array.
 * For v1 units, page IDs are preserved as "A1", "B3" etc. so existing
 * student_progress rows (backfilled with page_id = "A1") remain valid.
 */
export function normalizeContentData(raw: UnitContentData | null | undefined): UnitContentDataV2 | UnitContentDataV3 | UnitContentDataV4 {
  if (!raw) return { version: 2, pages: [] };

  if (isV4(raw)) return raw;
  if (isV3(raw)) return raw;
  if (isV2(raw)) return raw;

  // v1: convert Record<PageId, PageContent> to UnitPage[]
  const v1 = raw as { pages?: Record<string, PageContent> };
  const pages: UnitPage[] = [];

  if (v1.pages) {
    for (const def of DEFAULT_MYP_PAGES) {
      const content = v1.pages[def.id];
      if (content) {
        pages.push({
          id: def.id,
          type: "strand",
          criterion: def.criterion as CriterionKey,
          strandIndex: ((def.number - 1) % 4) + 1,
          title: content.title || def.title,
          content,
        });
      }
    }
  }

  return { version: 2, pages };
}

/**
 * Get an ordered page list from any content_data.
 */
export function getPageList(contentData: UnitContentData | null | undefined): UnitPage[] {
  const normalized = normalizeContentData(contentData);
  if (isV4(normalized)) return v4ToPageList(normalized);
  return normalized.pages;
}

/**
 * Find a page by ID in content_data.
 */
export function getPageById(contentData: UnitContentData | null | undefined, pageId: string): UnitPage | undefined {
  return getPageList(contentData).find(p => p.id === pageId);
}

/**
 * Find the index of a page by ID.
 */
export function getPageIndex(contentData: UnitContentData | null | undefined, pageId: string): number {
  return getPageList(contentData).findIndex(p => p.id === pageId);
}

/**
 * Generate a new page ID.
 */
export function newPageId(): string {
  return nanoid(8);
}
