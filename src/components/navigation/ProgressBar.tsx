"use client";

import { CRITERIA, PAGES, type CriterionKey } from "@/lib/constants";
import type { StudentProgress } from "@/types";

interface ProgressBarProps {
  progress: StudentProgress[];
}

export function ProgressBar({ progress }: ProgressBarProps) {
  const criteria = Object.keys(CRITERIA) as CriterionKey[];

  return (
    <div className="flex gap-1.5">
      {criteria.map((key) => {
        const criterionPages = PAGES.filter((p) => p.criterion === key);
        const completed = criterionPages.filter((p) =>
          progress.some(
            (pr) => pr.page_number === p.number && pr.status === "complete"
          )
        ).length;
        const fillPercent = (completed / criterionPages.length) * 100;

        return (
          <div
            key={key}
            className="flex-1 h-2.5 rounded-full bg-gray-100 overflow-hidden"
            title={`${CRITERIA[key].name}: ${completed}/${criterionPages.length}`}
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
