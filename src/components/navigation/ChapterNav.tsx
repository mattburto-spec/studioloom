"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { getCriterionDisplay, type CriterionKey, getPageColor } from "@/lib/constants";
import type { UnitPage, StudentProgress } from "@/types";

interface PageGroup {
  key: string;
  label: string;
  shortLabel: string;
  color: string;
  pages: UnitPage[];
  completedCount: number;
}

interface ChapterNavProps {
  pages: UnitPage[];
  currentPageId: string;
  progress: StudentProgress[];
  lockedPages: string[];
  unitId: string;
  onDone: () => void;
  /** When true, renders a linear lesson strip instead of criterion groups */
  journeyMode?: boolean;
}

function getPageStatus(
  page: UnitPage,
  progress: StudentProgress[],
  lockedPages: string[]
): "locked" | "complete" | "in_progress" | "not_started" {
  if (lockedPages.includes(page.id)) return "locked";
  const p = progress.find((pr) => pr.page_id === page.id);
  if (!p) return "not_started";
  return p.status as "complete" | "in_progress" | "not_started";
}

export function ChapterNav({
  pages,
  currentPageId,
  progress,
  lockedPages,
  unitId,
  onDone,
  journeyMode,
}: ChapterNavProps) {
  const router = useRouter();

  // Find current page index and prev/next
  const currentIndex = pages.findIndex((p) => p.id === currentPageId);
  const prevPage = currentIndex > 0 ? pages[currentIndex - 1] : null;
  const nextPage = currentIndex < pages.length - 1 ? pages[currentIndex + 1] : null;
  const currentPage = pages[currentIndex];
  const pageColor = currentPage ? getPageColor(currentPage) : "#6B7280";

  // Build groups from page data
  const groups = useMemo(() => {
    const result: PageGroup[] = [];
    let currentGroup: PageGroup | null = null;

    for (const page of pages) {
      const criterion = page.type === "strand" ? page.criterion : undefined;

      if (criterion) {
        // Check if we already have a group for this criterion
        const existing = result.find((g) => g.key === criterion);
        if (existing) {
          existing.pages.push(page);
          currentGroup = existing;
        } else {
          const meta = getCriterionDisplay(criterion as string);
          const group: PageGroup = {
            key: criterion,
            label: meta.name,
            shortLabel: criterion,
            color: meta.color || getPageColor(page),
            pages: [page],
            completedCount: 0,
          };
          result.push(group);
          currentGroup = group;
        }
      } else {
        // Non-strand page: attach to current group or create an "Other" bucket
        if (currentGroup) {
          currentGroup.pages.push(page);
        } else {
          const other = result.find((g) => g.key === "_other");
          if (other) {
            other.pages.push(page);
          } else {
            const group: PageGroup = {
              key: "_other",
              label: "Pages",
              shortLabel: "•",
              color: getPageColor(page),
              pages: [page],
              completedCount: 0,
            };
            result.push(group);
            currentGroup = group;
          }
        }
      }
    }

    // Compute completed counts
    for (const group of result) {
      group.completedCount = group.pages.filter(
        (p) => getPageStatus(p, progress, lockedPages) === "complete"
      ).length;
    }

    return result;
  }, [pages, progress, lockedPages]);

  // Which group is active (contains current page)
  const activeGroupKey = useMemo(() => {
    for (const group of groups) {
      if (group.pages.some((p) => p.id === currentPageId)) return group.key;
    }
    return groups[0]?.key;
  }, [groups, currentPageId]);

  const isSingleGroup = journeyMode || groups.length <= 1;

  function navigateToPage(pageId: string) {
    router.push(`/unit/${unitId}/${pageId}`);
  }

  function handlePillClick(group: PageGroup) {
    // Find first incomplete page in this group
    const firstIncomplete = group.pages.find((p) => {
      const status = getPageStatus(p, progress, lockedPages);
      return status !== "complete" && status !== "locked";
    });
    navigateToPage(firstIncomplete?.id || group.pages[0].id);
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-border z-30">
      <div className="max-w-3xl mx-auto px-3 py-2">
        <div className="flex items-center gap-2">
          {/* Prev button */}
          {prevPage ? (
            <button
              onClick={() => navigateToPage(prevPage.id)}
              className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-alt active:scale-90 transition-all duration-150 flex-shrink-0"
              title={`Previous: ${prevPage.id}`}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          ) : (
            <div className="w-7 flex-shrink-0" />
          )}

          {/* Chapter pills / dot strip */}
          <div className="flex-1 flex items-center gap-1 min-w-0 overflow-hidden">
            {isSingleGroup ? (
              /* Single group: flat dot strip */
              <FlatDotStrip
                pages={pages}
                currentPageId={currentPageId}
                progress={progress}
                lockedPages={lockedPages}
                onNavigate={navigateToPage}
              />
            ) : (
              /* Multiple groups: chapter pills */
              groups.map((group) => {
                const isActive = group.key === activeGroupKey;
                return isActive ? (
                  <ExpandedPill
                    key={group.key}
                    group={group}
                    currentPageId={currentPageId}
                    progress={progress}
                    lockedPages={lockedPages}
                    onNavigate={navigateToPage}
                  />
                ) : (
                  <CollapsedPill
                    key={group.key}
                    group={group}
                    onClick={() => handlePillClick(group)}
                  />
                );
              })
            )}
          </div>

          {/* CTA button */}
          <button
            onClick={onDone}
            className="px-3 py-1.5 text-sm font-medium text-white rounded-lg transition-all duration-150 hover:brightness-110 hover:shadow-md active:scale-95 flex-shrink-0"
            style={{ backgroundColor: pageColor }}
          >
            {nextPage
              ? journeyMode
                ? `Lesson ${currentIndex + 2} →`
                : `${nextPage.id} →`
              : "Done ✓"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Collapsed pill ────────────────────────────────── */

function CollapsedPill({
  group,
  onClick,
}: {
  group: PageGroup;
  onClick: () => void;
}) {
  const fillPct = group.pages.length > 0
    ? (group.completedCount / group.pages.length) * 100
    : 0;
  const allDone = group.completedCount === group.pages.length;

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-all duration-150 hover:shadow-sm hover:-translate-y-0.5 active:scale-95 min-w-0 flex-shrink-0"
      style={{
        borderColor: group.color + "40",
        backgroundColor: allDone ? group.color + "10" : "transparent",
      }}
      title={`${group.label} — ${group.completedCount}/${group.pages.length} complete`}
    >
      <span
        className="text-xs font-bold flex-shrink-0"
        style={{ color: group.color }}
      >
        {group.shortLabel}
      </span>
      {/* Mini progress bar */}
      <div className="w-8 h-1.5 rounded-full bg-gray-100 overflow-hidden flex-shrink-0 sm:block hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${fillPct}%`,
            backgroundColor: group.color,
          }}
        />
      </div>
    </button>
  );
}

/* ─── Expanded pill (active group) ──────────────────── */

function ExpandedPill({
  group,
  currentPageId,
  progress,
  lockedPages,
  onNavigate,
}: {
  group: PageGroup;
  currentPageId: string;
  progress: StudentProgress[];
  lockedPages: string[];
  onNavigate: (pageId: string) => void;
}) {
  return (
    <div
      className="flex items-center gap-1 px-2 py-1 rounded-lg border flex-1 min-w-0"
      style={{
        borderColor: group.color + "50",
        backgroundColor: group.color + "08",
      }}
    >
      {/* Group label */}
      <span
        className="text-xs font-bold flex-shrink-0 mr-0.5"
        style={{ color: group.color }}
      >
        {group.shortLabel}
      </span>

      {/* Page dots */}
      <div className="flex items-center gap-1 flex-1 justify-evenly min-w-0">
        {group.pages.map((page) => {
          const status = getPageStatus(page, progress, lockedPages);
          const isCurrent = page.id === currentPageId;
          const isLocked = status === "locked";
          const isComplete = status === "complete";
          const dotColor = getPageColor(page);

          if (isLocked) {
            return (
              <div
                key={page.id}
                className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0"
                title={`${page.id}: ${page.title} (locked)`}
              >
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
            );
          }

          return (
            <button
              key={page.id}
              onClick={() => onNavigate(page.id)}
              className={`rounded-full flex items-center justify-center transition-all duration-150 flex-shrink-0 ${
                isCurrent
                  ? "w-6 h-6 ring-2 ring-offset-1"
                  : "w-5 h-5 hover:scale-125 hover:shadow-md active:scale-90"
              }`}
              style={{
                backgroundColor: isComplete || isCurrent ? dotColor : dotColor + "30",
                ...(isCurrent ? { ["--tw-ring-color" as string]: dotColor } : {}),
              }}
              title={`${page.id}: ${page.title}`}
            >
              {isCurrent ? (
                <span className="text-white text-[8px] font-bold">{page.id}</span>
              ) : isComplete ? (
                <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              ) : (
                <span className="text-[7px] font-bold opacity-0 hover:opacity-100 transition-opacity" style={{ color: dotColor }}>
                  {page.id}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Flat dot strip (single group / no grouping) ──── */

function FlatDotStrip({
  pages,
  currentPageId,
  progress,
  lockedPages,
  onNavigate,
}: {
  pages: UnitPage[];
  currentPageId: string;
  progress: StudentProgress[];
  lockedPages: string[];
  onNavigate: (pageId: string) => void;
}) {
  return (
    <div className="flex items-center justify-evenly flex-1 relative py-1">
      {/* Background rail */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-gray-200" />

      {pages.map((page) => {
        const status = getPageStatus(page, progress, lockedPages);
        const isCurrent = page.id === currentPageId;
        const isLocked = status === "locked";
        const isComplete = status === "complete";
        const dotColor = getPageColor(page);

        if (isLocked) {
          return (
            <div
              key={page.id}
              className="relative z-10 w-3 h-3 rounded-full bg-gray-300 opacity-30"
              title={`${page.id}: ${page.title} (locked)`}
            />
          );
        }

        return (
          <button
            key={page.id}
            onClick={() => onNavigate(page.id)}
            className={`relative z-10 rounded-full transition-all duration-150 group flex items-center justify-center ${
              isCurrent
                ? "w-6 h-6 ring-2 ring-offset-1"
                : "w-3 h-3 hover:w-5 hover:h-5 hover:shadow-md active:scale-90"
            }`}
            style={{
              backgroundColor: isComplete || isCurrent ? dotColor : dotColor + "40",
              opacity: isComplete || isCurrent ? 1 : 0.6,
              ...(isCurrent ? { ["--tw-ring-color" as string]: dotColor } : {}),
            }}
            title={`${page.id}: ${page.title}`}
          >
            {isCurrent && (
              <span className="text-white text-[9px] font-bold">{page.id}</span>
            )}
            {isComplete && !isCurrent && (
              <svg className="w-2 h-2 text-white group-hover:opacity-0 transition-opacity" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
}
