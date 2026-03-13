"use client";

import { CRITERIA, type CriterionKey } from "@/lib/constants";
import type { StudentProgress, UnitPage } from "@/types";

interface ProgressBarProps {
  progress: StudentProgress[];
  pages: UnitPage[];
}

export function ProgressBar({ progress, pages }: ProgressBarProps) {
  // Group pages by criterion for strand pages
  const criterionGroups = new Map<CriterionKey, UnitPage[]>();
  const otherPages: UnitPage[] = [];

  for (const page of pages) {
    if (page.type === "strand" && page.criterion && page.criterion in CRITERIA) {
      const key = page.criterion as CriterionKey;
      if (!criterionGroups.has(key)) criterionGroups.set(key, []);
      criterionGroups.get(key)!.push(page);
    } else {
      otherPages.push(page);
    }
  }

  // If no criterion grouping found, show a single progress bar
  if (criterionGroups.size === 0) {
    const completed = pages.filter((p) =>
      progress.some((pr) => pr.page_id === p.id && pr.status === "complete")
    ).length;
    const fillPercent = pages.length > 0 ? (completed / pages.length) * 100 : 0;

    return (
      <div className="flex gap-1.5">
        <div
          className="flex-1 h-2.5 rounded-full bg-gray-100 overflow-hidden"
          title={`${completed}/${pages.length} complete`}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${fillPercent}%`, backgroundColor: "#2E86AB" }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-1.5">
      {Array.from(criterionGroups.entries()).map(([key, groupPages]) => {
        const completed = groupPages.filter((p) =>
          progress.some(
            (pr) => pr.page_id === p.id && pr.status === "complete"
          )
        ).length;
        const fillPercent = (completed / groupPages.length) * 100;

        return (
          <div
            key={key}
            className="flex-1 h-2.5 rounded-full bg-gray-100 overflow-hidden"
            title={`${CRITERIA[key].name}: ${completed}/${groupPages.length}`}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${fillPercent}%`,
                backgroundColor: CRITERIA[key].color,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
