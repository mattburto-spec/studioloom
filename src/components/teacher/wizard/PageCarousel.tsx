"use client";

import { CRITERIA, buildPageDefinitions, PAGE_TYPE_COLORS, type CriterionKey } from "@/lib/constants";
import type { WizardState, WizardDispatch } from "@/hooks/useWizardState";
import { PageReviewCard } from "./PageReviewCard";

interface Props {
  state: WizardState;
  dispatch: WizardDispatch;
  onActivityDrop?: (pageId: string, activityId: string) => void;
  onRegeneratePage?: (pageId: string) => void;
}

export function PageCarousel({ state, dispatch, onActivityDrop, onRegeneratePage }: Props) {
  const { generatedPages, expandedPages, journeyMode } = state;

  if (journeyMode) {
    return <JourneyCarousel state={state} dispatch={dispatch} onActivityDrop={onActivityDrop} onRegeneratePage={onRegeneratePage} />;
  }

  return (
    <div className="animate-slide-up max-w-4xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-lg font-bold text-text-primary">Review Your Unit</h2>
        <p className="text-xs text-text-secondary mt-1">
          {Object.keys(generatedPages).length} pages generated. Click any page to edit.
        </p>
      </div>

      {/* Criterion groups */}
      <div className="space-y-6">
        {(state.input.selectedCriteria || ["A", "B", "C", "D"] as CriterionKey[]).map((key) => {
          const c = CRITERIA[key];
          const pageDefs = buildPageDefinitions([key], state.input.criteriaFocus || {});
          const criterionPages = pageDefs.map((d) => ({ id: d.id, criterion: d.criterion, title: d.title }));
          const hasPages = criterionPages.some((p) => generatedPages[p.id]);

          if (!hasPages) return null;

          // Switch to vertical layout when ANY page in this criterion is expanded
          const anyExpanded = criterionPages.some((p) => expandedPages.has(p.id));

          return (
            <div key={key}>
              {/* Criterion header */}
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                  style={{ backgroundColor: c.color }}
                >
                  {key}
                </div>
                <span className="text-sm font-semibold text-text-primary">{c.name}</span>
              </div>

              {/* Page cards - vertical stack when expanded, horizontal scroll when collapsed */}
              {anyExpanded ? (
                <div className="space-y-3">
                  {criterionPages.map((page) => {
                    const content = generatedPages[page.id];
                    if (!content) return null;
                    return (
                      <PageReviewCard
                        key={page.id}
                        pageId={page.id}
                        content={content}
                        color={c.color}
                        isExpanded={expandedPages.has(page.id)}
                        dispatch={dispatch}
                        onActivityDrop={onActivityDrop}
                        onRegeneratePage={onRegeneratePage}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin snap-x snap-mandatory">
                  {criterionPages.map((page) => {
                    const content = generatedPages[page.id];
                    if (!content) return null;
                    return (
                      <div key={page.id} className="snap-start flex-shrink-0">
                        <PageReviewCard
                          pageId={page.id}
                          content={content}
                          color={c.color}
                          isExpanded={false}
                          dispatch={dispatch}
                          onActivityDrop={onActivityDrop}
                          onRegeneratePage={onRegeneratePage}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Journey mode: sequential lesson cards ─────────── */

function JourneyCarousel({ state, dispatch, onActivityDrop, onRegeneratePage }: Props) {
  const { generatedPages, expandedPages } = state;
  const lessonColor = PAGE_TYPE_COLORS.lesson;

  // Get lesson IDs in order (L01, L02, ...)
  const lessonIds = Object.keys(generatedPages).sort();

  // Collect unique criterion tags across all sections for each lesson
  function getLessonCriterionTags(pageId: string): string[] {
    const content = generatedPages[pageId];
    if (!content?.sections) return [];
    const tags = content.sections.flatMap(s => s.criterionTags || []);
    return [...new Set(tags)];
  }

  return (
    <div className="animate-slide-up max-w-4xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-lg font-bold text-text-primary">Review Your Learning Journey</h2>
        <p className="text-xs text-text-secondary mt-1">
          {lessonIds.length} lessons generated. Click any lesson to edit.
        </p>
      </div>

      {/* Sequential lesson list */}
      <div className="space-y-3">
        {lessonIds.map((lessonId, index) => {
          const content = generatedPages[lessonId];
          if (!content) return null;
          const criterionTags = getLessonCriterionTags(lessonId);
          const isExpanded = expandedPages.has(lessonId);

          return (
            <div key={lessonId}>
              {/* Lesson header with number and criterion tags */}
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-bold"
                  style={{ backgroundColor: lessonColor }}
                >
                  {index + 1}
                </div>
                <span className="text-sm font-semibold text-text-primary flex-1 truncate">
                  {content.title || `Lesson ${index + 1}`}
                </span>
                {criterionTags.map(tag => {
                  const meta = CRITERIA[tag as CriterionKey];
                  return (
                    <span
                      key={tag}
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: (meta?.color || "#6B7280") + "15",
                        color: meta?.color || "#6B7280",
                      }}
                    >
                      {tag}
                    </span>
                  );
                })}
              </div>

              <PageReviewCard
                pageId={lessonId}
                content={content}
                color={lessonColor}
                isExpanded={isExpanded}
                dispatch={dispatch}
                onActivityDrop={onActivityDrop}
                onRegeneratePage={onRegeneratePage}
              />

              {/* Connector line between lessons */}
              {index < lessonIds.length - 1 && !isExpanded && (
                <div className="flex justify-center py-1">
                  <div className="w-px h-4" style={{ backgroundColor: lessonColor + "30" }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
