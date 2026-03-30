"use client";

import { CRITERIA, getCriterionDisplay, getCriterionKeys, type CriterionKey } from "@/lib/constants";
import type { GenerationStatus } from "@/hooks/useWizardState";

interface Props {
  journeyMode?: boolean;
  selectedCriteria?: CriterionKey[];
  unitType?: string;
  framework?: string;
  criterionStatus: Partial<Record<CriterionKey, GenerationStatus>>;
  generationBatches?: Array<{ lessonIds: string[]; status: GenerationStatus }>;
  error?: string;
  onRetryCriterion?: (criterion: CriterionKey) => void;
}

export function GenerationProgress({
  journeyMode,
  selectedCriteria,
  unitType,
  framework,
  criterionStatus,
  generationBatches,
  error,
  onRetryCriterion,
}: Props) {
  if (journeyMode && generationBatches && generationBatches.length > 0) {
    return (
      <JourneyProgress
        batches={generationBatches}
        error={error}
      />
    );
  }

  // Criterion mode (existing)
  const criteria = selectedCriteria || (getCriterionKeys(unitType || "design") as CriterionKey[]);
  const allDone = criteria.every((k) => criterionStatus[k] === "done");
  const currentCriterion = criteria.find((k) => criterionStatus[k] === "generating");
  const hasCompletedPages = criteria.some((k) => criterionStatus[k] === "done");

  return (
    <div className={`max-w-md mx-auto text-center animate-slide-up ${hasCompletedPages ? "py-4" : "py-8"}`}>
      {/* Spinner / checkmark — compact when pages showing below */}
      <div className={hasCompletedPages ? "mb-3" : "mb-6"}>
        {allDone ? (
          <div className="w-12 h-12 rounded-full bg-accent-green/10 flex items-center justify-center mx-auto animate-fade-in">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2DA05E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
        ) : (
          <div className={`${hasCompletedPages ? "w-10 h-10" : "w-16 h-16"} rounded-full border-4 border-brand-purple/20 border-t-brand-purple animate-spin mx-auto`} />
        )}
      </div>

      <h2 className={`${hasCompletedPages ? "text-sm" : "text-lg"} font-bold text-text-primary mb-1`}>
        {allDone ? "Your unit is ready!" : "Building your unit..."}
      </h2>

      {currentCriterion && (
        <p className="text-xs text-text-secondary mb-4">
          Working on Criterion {currentCriterion}: {getCriterionDisplay(currentCriterion, unitType, framework).name}
        </p>
      )}

      {/* Criterion progress bars */}
      <div className="flex gap-2 mb-3">
        {criteria.map((key) => {
          const c = getCriterionDisplay(key, unitType, framework);
          const status = criterionStatus[key];
          return (
            <div key={key} className="flex-1">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  status === "generating" ? "animate-pulse" : ""
                }`}
                style={{
                  backgroundColor:
                    status === "done"
                      ? c.color
                      : status === "generating"
                        ? `${c.color}80`
                        : status === "error"
                          ? "#ef4444"
                          : "#e2e8f0",
                }}
              />
              <div className="flex items-center justify-center gap-1 mt-1.5">
                <span className="text-[10px] font-bold" style={{ color: status === "done" ? c.color : status === "error" ? "#ef4444" : "#94a3b8" }}>
                  {key}
                </span>
                {status === "done" && (
                  <svg width="8" height="8" viewBox="0 0 16 16" fill={c.color}>
                    <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
                  </svg>
                )}
                {status === "error" && onRetryCriterion && (
                  <button
                    onClick={() => onRetryCriterion(key)}
                    className="text-[9px] text-red-500 hover:text-red-700 transition font-medium"
                    title={`Retry Criterion ${key}`}
                  >
                    retry
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
          {error}
        </div>
      )}
    </div>
  );
}

// --- Journey mode batch progress ---

function JourneyProgress({
  batches,
  error,
}: {
  batches: Array<{ lessonIds: string[]; status: GenerationStatus }>;
  error?: string;
}) {
  const allDone = batches.every((b) => b.status === "done");
  const currentBatchIndex = batches.findIndex((b) => b.status === "generating");
  const hasCompletedBatches = batches.some((b) => b.status === "done");
  const completedCount = batches.filter((b) => b.status === "done").length;
  const totalLessons = batches.reduce((sum, b) => sum + b.lessonIds.length, 0);
  const completedLessons = batches
    .filter((b) => b.status === "done")
    .reduce((sum, b) => sum + b.lessonIds.length, 0);

  return (
    <div className={`max-w-md mx-auto text-center animate-slide-up ${hasCompletedBatches ? "py-4" : "py-8"}`}>
      {/* Spinner / checkmark */}
      <div className={hasCompletedBatches ? "mb-3" : "mb-6"}>
        {allDone ? (
          <div className="w-12 h-12 rounded-full bg-accent-green/10 flex items-center justify-center mx-auto animate-fade-in">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2DA05E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
        ) : (
          <div className={`${hasCompletedBatches ? "w-10 h-10" : "w-16 h-16"} rounded-full border-4 border-brand-purple/20 border-t-brand-purple animate-spin mx-auto`} />
        )}
      </div>

      <h2 className={`${hasCompletedBatches ? "text-sm" : "text-lg"} font-bold text-text-primary mb-1`}>
        {allDone ? "Your learning journey is ready!" : "Building your learning journey..."}
      </h2>

      {currentBatchIndex >= 0 && (
        <p className="text-xs text-text-secondary mb-4">
          Generating lessons {batches[currentBatchIndex].lessonIds[0]}–
          {batches[currentBatchIndex].lessonIds[batches[currentBatchIndex].lessonIds.length - 1]}
          {" "}({completedLessons + batches[currentBatchIndex].lessonIds.length} of {totalLessons})
        </p>
      )}

      {/* Batch progress — single continuous bar */}
      <div className="mb-3">
        <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              allDone ? "bg-accent-green" : "bg-brand-purple"
            } ${currentBatchIndex >= 0 ? "animate-pulse" : ""}`}
            style={{
              width: `${Math.max(
                allDone ? 100 : (completedCount / batches.length) * 100 + (currentBatchIndex >= 0 ? (1 / batches.length) * 50 : 0),
                2
              )}%`,
            }}
          />
        </div>

        {/* Batch segment labels */}
        <div className="flex mt-2 gap-1">
          {batches.map((batch, i) => {
            const isActive = batch.status === "generating";
            const isDone = batch.status === "done";
            const isError = batch.status === "error";
            const first = batch.lessonIds[0];
            const last = batch.lessonIds[batch.lessonIds.length - 1];
            return (
              <div key={i} className="flex-1 text-center">
                <span
                  className={`text-[9px] font-medium ${
                    isDone
                      ? "text-accent-green"
                      : isActive
                        ? "text-brand-purple"
                        : isError
                          ? "text-red-500"
                          : "text-text-tertiary"
                  }`}
                >
                  {first}–{last}
                </span>
                {isDone && (
                  <svg className="mx-auto mt-0.5" width="8" height="8" viewBox="0 0 16 16" fill="#2DA05E">
                    <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
          {error}
        </div>
      )}
    </div>
  );
}
