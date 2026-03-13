"use client";

import Link from "next/link";
import { getPageSettings, getPageColor } from "@/lib/constants";
import type { StudentProgress, PageSettingsMap, UnitPage } from "@/types";

interface SubwayNavProps {
  unitId: string;
  currentPageId: string;
  lockedPages: string[];
  progress: StudentProgress[];
  pageSettings?: PageSettingsMap;
  pages: UnitPage[];
}

export function SubwayNav({
  unitId,
  currentPageId,
  lockedPages,
  progress,
  pageSettings,
  pages,
}: SubwayNavProps) {
  // Filter to only enabled pages
  const visiblePages = pageSettings
    ? pages.filter((p) => getPageSettings(pageSettings, p.id).enabled)
    : pages;

  function getPageStatus(pageId: string) {
    if (lockedPages.includes(pageId)) return "locked";
    const p = progress.find((pr) => pr.page_id === pageId);
    if (!p) return "not_started";
    return p.status;
  }

  return (
    <div className="relative">
      {/* Rail and dots */}
      <div className="relative flex items-center">
        {/* Background rail */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-gray-200" />

        {/* Dots */}
        <div className="relative flex justify-between w-full">
          {visiblePages.map((page) => {
            const status = getPageStatus(page.id);
            const isCurrent = page.id === currentPageId;
            const isLocked = status === "locked";
            const isComplete = status === "complete";
            const isInProgress = status === "in_progress";
            const color = getPageColor(page);

            const dot = (
              <div
                className="relative flex flex-col items-center group"
                key={page.id}
              >
                <div
                  className={`
                    relative z-10 rounded-full border-2 transition-all duration-200
                    flex items-center justify-center
                    ${isCurrent ? "w-8 h-8 -mt-1" : "w-5 h-5"}
                    ${isLocked ? "bg-gray-100 border-gray-300 cursor-not-allowed" : ""}
                    ${isComplete && !isCurrent ? "border-transparent" : ""}
                    ${isInProgress && !isCurrent ? "border-current bg-white" : ""}
                    ${!isComplete && !isInProgress && !isLocked && !isCurrent ? "bg-white border-gray-300" : ""}
                  `}
                  style={{
                    borderColor: isLocked
                      ? undefined
                      : isCurrent || isComplete || isInProgress
                      ? color
                      : undefined,
                    backgroundColor: isComplete || isCurrent ? color : undefined,
                  }}
                >
                  {isLocked && (
                    <svg
                      className="w-2.5 h-2.5 text-gray-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                  {isComplete && !isCurrent && (
                    <svg
                      className="w-3 h-3 text-white"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                  {isCurrent && (
                    <span className="text-white text-[10px] font-bold">
                      {page.id}
                    </span>
                  )}
                </div>

                {/* Tooltip */}
                <div className="absolute top-full mt-1 hidden group-hover:block z-20">
                  <div className="bg-gray-900 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap shadow-lg">
                    {page.id}: {page.title}
                  </div>
                </div>
              </div>
            );

            if (isLocked) {
              return dot;
            }

            return (
              <Link
                key={page.id}
                href={`/unit/${unitId}/${page.id}`}
                className="no-underline"
              >
                {dot}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
