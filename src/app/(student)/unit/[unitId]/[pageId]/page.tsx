"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { CRITERIA, PAGES, type CriterionKey, type PageId } from "@/lib/constants";
import { ProgressBar } from "@/components/navigation/ProgressBar";
import { SubwayNav } from "@/components/navigation/SubwayNav";
import { ResponseInput } from "@/components/student/ResponseInput";
import { VocabWarmup } from "@/components/student/VocabWarmup";
import { FloatingTimer } from "@/components/planning/FloatingTimer";
import { PlanningPanel } from "@/components/planning/PlanningPanel";
import type { Unit, StudentProgress, PageContent } from "@/types";

interface UnitPageData {
  unit: Unit;
  lockedPages: number[];
  progress: StudentProgress[];
  ellLevel: number;
}

export default function UnitPage({
  params,
}: {
  params: Promise<{ unitId: string; pageId: string }>;
}) {
  const { unitId, pageId } = use(params);
  const router = useRouter();
  const [data, setData] = useState<UnitPageData | null>(null);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confidenceLevel, setConfidenceLevel] = useState(3);
  const [planOpen, setPlanOpen] = useState(false);

  const currentPage = PAGES.find((p) => p.id === pageId);
  const currentPageIndex = PAGES.findIndex((p) => p.id === pageId);
  const nextPage = currentPageIndex < 15 ? PAGES[currentPageIndex + 1] : null;
  const prevPage = currentPageIndex > 0 ? PAGES[currentPageIndex - 1] : null;

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch(`/api/student/unit?unitId=${unitId}`);
        if (!res.ok) {
          router.push("/dashboard");
          return;
        }
        const result = await res.json();
        setData(result);

        // Load saved responses for this page
        const pageProgress = result.progress.find(
          (p: StudentProgress) => p.page_number === currentPage?.number
        );
        if (pageProgress?.responses) {
          setResponses(pageProgress.responses as Record<string, string>);
        }
      } catch {
        router.push("/dashboard");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [unitId, pageId, router, currentPage?.number]);

  const saveProgress = useCallback(
    async (newStatus?: string) => {
      if (!currentPage) return;
      setSaving(true);
      try {
        await fetch("/api/student/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            unitId,
            pageNumber: currentPage.number,
            status: newStatus || "in_progress",
            responses,
          }),
        });
      } finally {
        setSaving(false);
      }
    },
    [unitId, currentPage, responses]
  );

  // Auto-save on response changes (debounced)
  useEffect(() => {
    if (!data || Object.keys(responses).length === 0) return;
    const timer = setTimeout(() => {
      saveProgress();
    }, 2000);
    return () => clearTimeout(timer);
  }, [responses, data, saveProgress]);

  // Mark page as in_progress on first visit
  useEffect(() => {
    if (!data || !currentPage) return;
    const pageProgress = data.progress.find(
      (p) => p.page_number === currentPage.number
    );
    if (!pageProgress || pageProgress.status === "not_started") {
      saveProgress("in_progress");
    }
  }, [data, currentPage, saveProgress]);

  if (loading || !data || !currentPage) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-3 bg-gray-200 rounded w-full" />
          <div className="h-10 bg-gray-200 rounded w-full" />
          <div className="h-64 bg-gray-200 rounded w-full" />
        </div>
      </div>
    );
  }

  const criterion = CRITERIA[currentPage.criterion as CriterionKey];
  const pageContent: PageContent | undefined =
    data.unit.content_data?.pages?.[pageId as PageId];

  // Get ELL-specific scaffolding
  const ellKey = `ell${data.ellLevel}` as "ell1" | "ell2" | "ell3";

  return (
    <main className="max-w-3xl mx-auto px-4 py-6 pb-24">
      {/* Progress bar */}
      <div className="mb-4">
        <ProgressBar progress={data.progress} />
      </div>

      {/* Subway navigation */}
      <div className="mb-8">
        <SubwayNav
          unitId={unitId}
          currentPageId={pageId}
          lockedPages={data.lockedPages}
          progress={data.progress}
        />
      </div>

      {/* Page header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span
            className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded"
            style={{
              backgroundColor: criterion.color + "15",
              color: criterion.color,
            }}
          >
            Criterion {currentPage.criterion}
          </span>
          <span className="text-xs text-text-secondary">
            {criterion.name}
          </span>
        </div>
        <h1 className="text-2xl font-bold text-text-primary">
          {currentPage.id}: {pageContent?.title || currentPage.title}
        </h1>
      </div>

      {/* Learning goal */}
      {pageContent?.learningGoal && (
        <div className="bg-surface-alt rounded-xl p-4 mb-6 border-l-4"
          style={{ borderLeftColor: criterion.color }}
        >
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1">
            Learning Goal
          </p>
          <p className="text-sm text-text-primary">
            {pageContent.learningGoal}
          </p>
        </div>
      )}

      {/* Vocab warm-up (ELL 1-2) */}
      {pageContent?.vocabWarmup && (
        <div className="mb-6">
          <VocabWarmup
            warmup={pageContent.vocabWarmup}
            ellLevel={data.ellLevel}
          />
        </div>
      )}

      {/* Introduction */}
      {pageContent?.introduction && (
        <div className="mb-8">
          <p className="text-text-primary leading-relaxed">
            {pageContent.introduction.text}
          </p>
          {pageContent.introduction.media && (
            <div className="mt-3 rounded-lg overflow-hidden bg-surface-alt">
              {pageContent.introduction.media.type === "image" && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={pageContent.introduction.media.url}
                  alt=""
                  className="w-full"
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Activity sections */}
      {pageContent?.sections ? (
        <div className="space-y-8">
          {pageContent.sections.map((section, i) => {
            const scaffolding = section.scaffolding?.[ellKey];
            const sentenceStarters =
              (scaffolding as { sentenceStarters?: string[] })
                ?.sentenceStarters || [];
            const extensionPrompts =
              data.ellLevel === 3
                ? (scaffolding as { extensionPrompts?: string[] })
                    ?.extensionPrompts || []
                : [];

            return (
              <div key={i} className="scroll-mt-20">
                <div className="border-b border-border pb-1 mb-3">
                  <h2 className="text-base font-semibold text-text-primary">
                    {section.prompt}
                  </h2>
                </div>

                {/* Extension prompts for ELL 3 */}
                {extensionPrompts.length > 0 && (
                  <div className="bg-accent-purple/5 border border-accent-purple/20 rounded-lg p-3 mb-3">
                    <p className="text-xs font-semibold text-accent-purple mb-1">
                      Extension
                    </p>
                    {extensionPrompts.map((prompt, j) => (
                      <p key={j} className="text-sm text-text-secondary">
                        {prompt}
                      </p>
                    ))}
                  </div>
                )}

                {/* Hints for ELL 1 */}
                {data.ellLevel === 1 &&
                  (scaffolding as { hints?: string[] })?.hints && (
                    <div className="bg-accent-orange/5 border border-accent-orange/20 rounded-lg p-3 mb-3">
                      <p className="text-xs font-semibold text-accent-orange mb-1">
                        💡 Hints
                      </p>
                      {((scaffolding as { hints?: string[] }).hints || []).map(
                        (hint, j) => (
                          <p key={j} className="text-sm text-text-secondary">
                            {hint}
                          </p>
                        )
                      )}
                    </div>
                  )}

                <ResponseInput
                  sectionIndex={i}
                  responseType={section.responseType}
                  value={responses[`section_${i}`] || ""}
                  onChange={(val) =>
                    setResponses((prev) => ({
                      ...prev,
                      [`section_${i}`]: val,
                    }))
                  }
                  sentenceStarters={sentenceStarters}
                  unitId={unitId}
                  pageId={pageId}
                />

                {/* Example response (collapsible) */}
                {section.exampleResponse && (
                  <details className="mt-2">
                    <summary className="text-xs text-text-secondary cursor-pointer hover:text-text-primary">
                      Show example response
                    </summary>
                    <div className="mt-2 bg-surface-alt rounded-lg p-3 text-sm text-text-secondary italic">
                      {section.exampleResponse}
                    </div>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Fallback when no content_data exists for this page */
        <div className="bg-surface-alt rounded-xl p-8 text-center mb-8">
          <p className="text-text-secondary">
            Content for this page hasn&apos;t been added yet.
          </p>
          <p className="text-text-secondary/70 text-sm mt-1">
            Your teacher will upload the content soon.
          </p>
          {/* Still show a text area for freeform response */}
          <div className="mt-6 text-left max-w-lg mx-auto">
            <textarea
              value={responses["freeform"] || ""}
              onChange={(e) =>
                setResponses((prev) => ({
                  ...prev,
                  freeform: e.target.value,
                }))
              }
              placeholder="You can still write notes here..."
              rows={4}
              className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent resize-y text-sm"
            />
          </div>
        </div>
      )}

      {/* Reflection / Self-check */}
      {pageContent?.reflection && (
        <div className="mt-10 border-t border-border pt-6">
          <h3 className="text-base font-semibold text-text-primary mb-3">
            Reflection
          </h3>
          {pageContent.reflection.type === "confidence-slider" && (
            <div>
              <p className="text-sm text-text-secondary mb-3">
                How confident are you about this section?
              </p>
              <div className="flex items-center gap-3">
                <span className="text-xs text-text-secondary">Not sure</span>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={confidenceLevel}
                  onChange={(e) => setConfidenceLevel(Number(e.target.value))}
                  className="flex-1 accent-accent-blue"
                />
                <span className="text-xs text-text-secondary">Very confident</span>
              </div>
            </div>
          )}
          {pageContent.reflection.type === "checklist" && (
            <div className="space-y-2">
              {pageContent.reflection.items.map((item, i) => (
                <label key={i} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5 accent-accent-blue"
                    checked={responses[`check_${i}`] === "true"}
                    onChange={(e) =>
                      setResponses((prev) => ({
                        ...prev,
                        [`check_${i}`]: String(e.target.checked),
                      }))
                    }
                  />
                  <span className="text-text-primary">{item}</span>
                </label>
              ))}
            </div>
          )}
          {pageContent.reflection.type === "short-response" && (
            <div className="space-y-2">
              {pageContent.reflection.items.map((item, i) => (
                <div key={i}>
                  <p className="text-sm text-text-primary mb-1">{item}</p>
                  <textarea
                    value={responses[`reflection_${i}`] || ""}
                    onChange={(e) =>
                      setResponses((prev) => ({
                        ...prev,
                        [`reflection_${i}`]: e.target.value,
                      }))
                    }
                    rows={2}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent resize-y text-sm"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Planning Panel */}
      <PlanningPanel unitId={unitId} open={planOpen} onClose={() => setPlanOpen(false)} />

      {/* Floating Timer */}
      <FloatingTimer unitId={unitId} />

      {/* Save status + Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-border py-3 px-4 z-30">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            {prevPage && (
              <button
                onClick={() => router.push(`/unit/${unitId}/${prevPage.id}`)}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary border border-border rounded-lg hover:bg-surface-alt transition"
              >
                ← {prevPage.id}
              </button>
            )}
            <button
              onClick={() => setPlanOpen(true)}
              className="px-3 py-2 text-sm text-text-secondary hover:text-text-primary border border-border rounded-lg hover:bg-surface-alt transition"
            >
              📋 Plan
            </button>
          </div>

          <span className="text-xs text-text-secondary">
            {saving ? "Saving..." : "Auto-saved"}
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                await saveProgress("complete");
                if (nextPage) {
                  router.push(`/unit/${unitId}/${nextPage.id}`);
                }
              }}
              className="px-4 py-2 text-sm font-medium text-white rounded-lg transition"
              style={{ backgroundColor: criterion.color }}
            >
              {nextPage
                ? `Save & Continue → ${nextPage.id}`
                : "Mark Complete ✓"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
