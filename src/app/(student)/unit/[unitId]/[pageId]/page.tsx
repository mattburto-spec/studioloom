"use client";

import { useState, useEffect, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { CRITERIA, PAGE_TYPE_LABELS, type CriterionKey } from "@/lib/constants";
import { collectCriterionChips } from "@/lib/frameworks/render-helpers";
import type { FrameworkId } from "@/lib/frameworks/adapter";
import { isV3 } from "@/lib/unit-adapter";
import { usePageData } from "@/hooks/usePageData";
import { usePageResponses } from "@/hooks/usePageResponses";
import { ActivityCard } from "@/components/student/ActivityCard";
import { SectionDivider } from "@/components/student/SectionDivider";
import { MobileBottomNav } from "@/components/student/MobileBottomNav";
// Smoke-fix round 6 — rail buttons swapped: "My Plan" (PlanningPanelV2)
// and "Schedule" (GanttPanel) replaced by in-page drawers wrapping the
// CO2 Racers Kanban + Timeline boards. Old planning components left in
// the codebase for now (used by other surfaces? — TODO: audit).
import KanbanBoard from "@/components/student/kanban/KanbanBoard";
import TimelineBoard from "@/components/student/timeline/TimelineBoard";
import { BoardDrawer } from "@/components/student/BoardDrawer";
import { QuickCaptureFAB } from "@/components/portfolio/QuickCaptureFAB";
import { PortfolioPanel } from "@/components/portfolio/PortfolioPanel";
import { ExportPagePdf } from "@/components/student/ExportPagePdf";
import { NarrativeModal } from "@/components/portfolio/NarrativeModal";
import { useUnitNav } from "@/contexts/UnitNavContext";
import { ScrollReveal } from "@/components/student/ScrollReveal";
import {
  LessonHeader,
  LessonIntro,
  LessonFooter,
  LessonToolsRail,
  type LessonTool,
} from "@/components/student/lesson-bold";
import StudentFeedbackPulse from "@/components/teacher/knowledge/StudentFeedbackPulse";
// DesignAssistantWidget import removed in Phase 10 polish. Component file
// still exists — will be re-integrated via a unified AI-mentor surface.
import { useStudent } from "@/app/(student)/student-context";
import { OpenStudioBanner } from "@/components/open-studio";
import { useOpenStudio } from "@/hooks/useOpenStudio";
import { CompetencyPulse } from "@/components/nm";
import { ErrorBoundary } from "@/components/student/ErrorBoundary";
import { useActivityTracking } from "@/hooks/useActivityTracking";
import { SkillRefsForPage } from "@/components/skills/SkillRefsForPage";
import {
  InlineTeacherFeedback,
  TeacherFeedbackBanner,
  useTileFeedbackThreads,
} from "@/components/grading/TeacherFeedbackPanel";
import type { PageContent } from "@/types";
import type { IntegrityMetadata } from "@/components/student/MonitoredTextarea";

export default function UnitPageView(props: { params: Promise<{ unitId: string; pageId: string }> }) {
  return (
    <ErrorBoundary>
      <UnitPageViewInner {...props} />
    </ErrorBoundary>
  );
}

function UnitPageViewInner({
  params,
}: {
  params: Promise<{ unitId: string; pageId: string }>;
}) {
  const { unitId, pageId } = use(params);
  const router = useRouter();
  const unitNav = useUnitNav();

  const { data, loading, allPages, currentPage, enabledPages, nextPage, currentSettings, pageColor } =
    usePageData(unitId, pageId);
  const integrityMetadataRef = useRef<Record<string, unknown> | null>(null);

  // Per-activity engagement tracking (Dimensions Phase 3)
  const {
    registerActivity,
    getObserverRef,
    recordInteraction,
    recordResponseChange,
    getTrackingPayload,
  } = useActivityTracking(pageId, {});

  const { responses, setResponses, saving, showSaveToast, saveProgress, saveResponseImmediate, moderationError } =
    usePageResponses(
      unitId,
      pageId,
      currentPage,
      data,
      integrityMetadataRef,
      getTrackingPayload,
      // Round 17 — invalidate the cached unit data after explicit
      // saves so navigate-away + come-back shows the saved value.
      // refreshProgress is a no-op when unitNav isn't mounted (mock
      // /direct-load mode), so wrapping is safe.
      unitNav ? () => unitNav.refreshProgress() : undefined
    );

  const { student, classInfo } = useStudent();
  const openStudio = useOpenStudio(unitId);
  // G3.3 / TFL.2 Pass B.2/B.3 — fetch teacher feedback THREADS for this
  // lesson once. Banner + per-tile inline cards both read from this
  // single map. Each value is an array of Turn (teacher OR student)
  // ordered by sent_at, ready to drop into <TeacherFeedback turns={...} />.
  // gradeIdByTileId routes the reply POST endpoint per tile (B.3).
  // refresh re-fetches after a student reply lands so the new turn
  // appears in the bubble.
  const {
    threadsByTileId,
    gradeIdByTileId,
    teacherFedTileIds,
    refresh: refreshThreads,
  } = useTileFeedbackThreads(unitId, pageId);
  // Smoke-fix round 6 — renamed for honest mapping to the surfaces they
  // open. Old names (planOpen / ganttOpen) opened MYP-criteria + Gantt
  // panels that have been replaced by Kanban + Timeline drawers.
  const [kanbanOpen, setKanbanOpen] = useState(false);
  const [portfolioOpen, setPortfolioOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [narrativeOpen, setNarrativeOpen] = useState(false);
  const [showFeedbackPulse, setShowFeedbackPulse] = useState(false);
  const [pendingNavTarget, setPendingNavTarget] = useState<string | null>(null);
  const [nmCheckpoint, setNmCheckpoint] = useState<{ elements: Array<{ id: string; name: string; studentDescription: string; definition: string; color: string }> } | null>(null);
  const [showNmPulse, setShowNmPulse] = useState(false);
  const [nmCompleted, setNmCompleted] = useState(false);
  const [integrityMetadata, setIntegrityMetadata] = useState<Record<number, IntegrityMetadata>>({});
  // Safety badge requirements are tracked but do NOT block lesson access.
  // Teachers check completion status on their dashboard instead.

  // Fetch NM checkpoint config for this page
  useEffect(() => {
    fetch(`/api/student/nm-checkpoint/${pageId}?unitId=${unitId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.checkpoint) setNmCheckpoint(d.checkpoint);
      })
      .catch(() => {}); // silently ignore — NM is optional
  }, [pageId]);

  // Redirect to valid page if current pageId not found in content
  useEffect(() => {
    if (!loading && data && !currentPage && allPages.length > 0) {
      router.replace(`/unit/${unitId}/${allPages[0].id}`);
    }
  }, [loading, data, currentPage, allPages, unitId, router]);

  if (loading || !data) {
    return null; // Layout handles the loading state
  }

  // Derived values — safe even when currentPage is undefined
  const journeyMode = data ? isV3(data.unit.content_data) : false;
  const currentIndex = currentPage ? enabledPages.findIndex((p) => p.id === pageId) : -1;
  const criterion = currentPage?.type === "strand" && currentPage.criterion
    ? CRITERIA[currentPage.criterion as CriterionKey]
    : null;
  const pageContent: PageContent | undefined = currentPage?.content;
  // 5.10.3: null-framework classes render as MYP (behavior-preserving). See FU-I.
  const framework: FrameworkId =
    (classInfo?.framework as FrameworkId | null | undefined) ?? "IB_MYP";

  let sectionNum = 0;

  const displayTitle = currentPage
    ? (currentPage.phaseLabel && pageContent?.title?.startsWith(`${currentPage.phaseLabel}: `)
        ? pageContent.title.slice(currentPage.phaseLabel.length + 2)
        : pageContent?.title || currentPage.title)
    : data?.unit.title || "Lesson";

  // If page not found but we have pages, useEffect will redirect — show nothing briefly
  if (!currentPage && allPages.length > 0) {
    return null;
  }

  // Derive prev-page navigation target (usePageData only exposes nextPage).
  const prevPage =
    currentIndex > 0 ? enabledPages[currentIndex - 1] : null;

  // Derive LessonHeader props once — keeps JSX block below readable.
  const lessonTitleDisplay =
    currentPage && (journeyMode || currentPage.type === "lesson")
      ? displayTitle
      : currentPage
        ? `${currentPage.id}: ${displayTitle}`
        : data?.unit.title || "Lesson";
  const lessonStrandLabel =
    currentPage && !journeyMode && currentPage.type !== "lesson" && criterion
      ? `Criterion ${currentPage.criterion}: ${criterion.name}`
      : undefined;
  const lessonCriterionChips =
    currentPage && (journeyMode || currentPage.type === "lesson") && pageContent?.sections
      ? collectCriterionChips(pageContent.sections, framework)
      : undefined;

  return (
    <div className="lesson-bold min-h-screen" style={{ background: "var(--sl-bg)" }}>
      {/* Lesson sticky bar removed in Phase 10 follow-up — its mobile
          hamburger now lives in the layout-owned BoldTopNav via
          SidebarSlotContext. The Dashboard button was redundant with the
          nav logo. Progress + title are already shown in the hero block
          below. */}

      {/* ── Lesson header — warm-paper Bold card ── */}
      {currentPage ? (
        <div className="max-w-5xl mx-auto px-6 pt-6">
          <LessonHeader
            phaseName={currentPage.phaseLabel}
            phaseColor={pageColor}
            lessonIndex={currentIndex + 1}
            lessonTotal={enabledPages.length}
            strandLabel={lessonStrandLabel}
            title={lessonTitleDisplay}
            whyItMatters={pageContent?.learningGoal}
            learningObjectives={pageContent?.success_criteria}
            criterionChips={lessonCriterionChips}
            summative={currentSettings.assessment_type === "summative"}
            actions={
              currentSettings.export_pdf && pageContent?.sections ? (
                <ExportPagePdf
                  pageId={pageId}
                  pageTitle={pageContent.title || currentPage.title}
                  sections={pageContent.sections}
                  responses={responses}
                  studentName={data.studentName || "Student"}
                  unitTitle={data.unit.title}
                />
              ) : undefined
            }
          />
        </div>
      ) : (
        /* No lesson content — show a helpful empty state in the warm-paper shell */
        <div className="max-w-5xl mx-auto px-6 pt-6">
          <div className="card-lb p-8">
            <h1
              className="display-lg"
              style={{
                fontSize: "clamp(32px, 4.5vw, 44px)",
                lineHeight: "1",
                color: "var(--sl-ink)",
              }}
            >
              {data?.unit.title || "Unit"}
            </h1>
            <p
              className="mt-3"
              style={{ fontSize: "15px", color: "var(--sl-ink-2)" }}
            >
              This unit doesn&apos;t have any lesson content yet. Your teacher will
              add content soon.
            </p>
          </div>
        </div>
      )}

      {/* ── Open Studio Banner ── */}
      {openStudio.state && (openStudio.state.unlocked || openStudio.justRevoked) && (
        <div className="max-w-5xl mx-auto px-6 pt-6">
          <OpenStudioBanner
            unitId={unitId}
            unlocked={openStudio.state.unlocked}
            activeSession={openStudio.state.activeSession}
            teacherNote={openStudio.state.teacherNote}
            checkInMessage={openStudio.checkInMessage}
            onDismissCheckIn={openStudio.dismissCheckIn}
            onStartSession={openStudio.startSession}
            onEndSession={openStudio.endSession}
            onUpdateFocusArea={openStudio.updateFocusArea}
            justRevoked={openStudio.justRevoked}
          />
        </div>
      )}

      {/* ── Main scrollable content — white background ── */}
      <main className="max-w-5xl mx-auto px-6 py-10 pb-28">
      {!currentPage && (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <p className="text-gray-500 text-lg font-medium">No lesson content yet</p>
          <p className="text-gray-400 text-sm mt-1">Your teacher will add content soon. You can still use the tools below.</p>

          <button
            onClick={() => router.push("/dashboard")}
            className="mt-6 px-5 py-2 text-sm font-medium text-purple-600 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 rounded-lg transition"
          >
            Back to Dashboard
          </button>
        </div>
      )}

      {currentPage && (<>
        {/* ── Context block (vocab + intro text + media + links) — warm-paper Bold ── */}
        {(pageContent?.vocabWarmup || pageContent?.introduction) && (
          <ScrollReveal>
            <LessonIntro
              vocabWarmup={pageContent?.vocabWarmup}
              introduction={pageContent?.introduction}
              ellLevel={data.ellLevel}
              pageColor={pageColor}
            />
          </ScrollReveal>
        )}

        {/* Skills for this lesson — renders only when teacher has pinned
            skill cards to this page via the "Used in" panel on the card
            edit page. Zero noise when there are no pins. */}
        <SkillRefsForPage pageId={pageId} />

        {/* G3.3 / TFL.2 Pass B.2 — top-of-lesson feedback banner.
            Renders only when ≥1 tile has a teacher turn on this page.
            Click → scroll to the first inline card. */}
        {teacherFedTileIds.length > 0 && (
          <TeacherFeedbackBanner teacherFedTileIds={teacherFedTileIds} />
        )}

        {/* ── Activity sections with dividers ── */}
        {pageContent?.sections ? (
          pageContent.sections.map((section, i) => {
            const responseKey = section.activityId ? `activity_${section.activityId}` : `section_${i}`;
            // Register activity for engagement tracking (Dimensions Phase 3)
            registerActivity(responseKey);
            return (
              <ScrollReveal key={section.activityId || i} delay={i * 80}>
                <SectionDivider number={++sectionNum} color={pageColor} />
                {/* Tracking observer wrapper — tracks time visible in viewport */}
                <div ref={getObserverRef(responseKey)}>
                <ActivityCard
                  section={section}
                  index={i}
                  ellLevel={data.ellLevel}
                  responseValue={responses[responseKey] || ""}
                  onResponseChange={(val) => {
                    recordInteraction(responseKey);
                    recordResponseChange(responseKey, typeof val === "string" ? val : JSON.stringify(val));
                    setResponses((prev) => ({
                      ...prev,
                      [responseKey]: val,
                    }));
                  }}
                  // Round 11 — pass through to allow Process Journal saves
                  // to bypass the 2s debounce. Other response types fall
                  // back to the debounced setResponses path above.
                  onSaveResponseImmediate={(val) => {
                    recordInteraction(responseKey);
                    recordResponseChange(responseKey, typeof val === "string" ? val : JSON.stringify(val));
                    return saveResponseImmediate(responseKey, val);
                  }}
                  isLast={true}
                  arrowOffset={0}
                  allowedTypes={[...new Set(pageContent.sections.map(s => s.responseType).filter(Boolean))] as ("text" | "upload" | "voice" | "link")[]}
                  unitId={unitId}
                  pageId={pageId}
                  pageColor={pageColor}
                  enableIntegrityMonitoring={true}
                  onIntegrityUpdate={(sectionIndex, metadata) => {
                    setIntegrityMetadata((prev) => {
                      const next = { ...prev, [sectionIndex]: metadata };
                      // Sync ref for save flow — key by response key (activity ID or section index)
                      const refData: Record<string, unknown> = {};
                      const sections = pageContent?.sections || [];
                      for (const [idx, meta] of Object.entries(next)) {
                        const sec = sections[Number(idx)];
                        const key = sec?.activityId ? `activity_${sec.activityId}` : `section_${idx}`;
                        refData[key] = meta;
                      }
                      integrityMetadataRef.current = refData;
                      return next;
                    });
                  }}
                />
                </div>

                {/* G3.3 — anchored teacher feedback inline beneath the tile.
                    The first card on the page gets the data-feedback-anchor
                    so the top banner can scroll to it. */}
                {threadsByTileId[responseKey] && threadsByTileId[responseKey].length > 0 && gradeIdByTileId[responseKey] && (() => {
                  // First-anchor: the first tile WITH a teacher turn on
                  // this page. The hook already derives that list as
                  // teacherFedTileIds; isFirst is true if responseKey is
                  // its first entry.
                  const isFirst = teacherFedTileIds[0] === responseKey;
                  return (
                    <InlineTeacherFeedback
                      gradeId={gradeIdByTileId[responseKey]}
                      turns={threadsByTileId[responseKey]}
                      isFirst={isFirst}
                      onReplyPersisted={refreshThreads}
                    />
                  );
                })()}
                </ScrollReveal>
            );
          })
        ) : (
          <>
            <SectionDivider number={++sectionNum} color={pageColor} />
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">
                Content for this page hasn&apos;t been added yet.
              </p>
              <p className="text-gray-400 text-sm mt-1">
                Your teacher will upload the content soon.
              </p>
              <div className="mt-8 text-left max-w-lg mx-auto">
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
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent resize-y text-base"
                />
              </div>
            </div>
          </>
        )}

        {/* ── Reflection section removed ──
            Per-question emoji ratings didn't match the question types
            (comprehension questions paired with feeling scales).
            Pace feedback is now collected via StudentFeedbackPulse modal
            on "Complete & Continue" — feeds the timing model. ── */}

        {/* ── NM Competency Pulse — above Complete & Continue ──
            Round 32: removed the !nmCompleted gate. CompetencyPulse now
            shows a permanent pop-art "Feedback Done!" celebration after
            submission AND on subsequent loads (it fetches its own
            already-submitted state). Parent's nmCompleted is still set
            via onComplete in case other UI hooks gate on it later. */}
        {nmCheckpoint && (
          <div className="max-w-5xl mx-auto px-6 mt-10 mb-2">
            <CompetencyPulse
              pageId={pageId}
              unitId={unitId}
              elements={nmCheckpoint.elements}
              onComplete={() => setNmCompleted(true)}
            />
          </div>
        )}

      </>)}
      {/* G3.3 — bottom panel removed; feedback now renders inline beneath
          each tile via <InlineTeacherFeedback />, plus a banner at the top. */}
      </main>

      {/* ── Lesson footer — Previous / Next preview / Complete & continue ── */}
      {currentPage && (
        <LessonFooter
          onPrev={
            prevPage
              ? () => {
                  // Hard navigation — see onComplete below for rationale.
                  window.location.href = `/unit/${unitId}/${prevPage.id}`;
                }
              : undefined
          }
          onComplete={async () => {
            await saveProgress("complete");
            // Smoke-fix round 7 (6 May 2026) — pace-feedback popup
            // removed per Matt: "too many questions". The modal still
            // exists at line ~500 (gated on showFeedbackPulse) but is
            // no longer triggered. To restore: replace this block with
            // setPendingNavTarget(...) + setShowFeedbackPulse(true).
            if (nextPage) {
              // Hard navigation — see LessonSidebar.navigateToPage
              // for the rationale. router.push silently no-ops when
              // navigating to recently-created [pageId] segments.
              window.location.href = `/unit/${unitId}/${nextPage.id}`;
            }
          }}
          saving={saving}
          nextPreview={
            nextPage
              ? {
                  eyebrow: `Next · Lesson ${currentIndex + 2}`,
                  title:
                    (nextPage.phaseLabel && nextPage.title.startsWith(`${nextPage.phaseLabel}: `)
                      ? nextPage.title.slice(nextPage.phaseLabel.length + 2)
                      : nextPage.title) || "Next lesson",
                }
              : undefined
          }
        />
      )}

      {/* Panels */}
      {/* Smoke-fix round 6 — Kanban drawer (was: PlanningPanel V2 with MYP
          criteria, ripped out per Matt's request — agency unit doesn't
          use criterion-by-criterion planning). */}
      <BoardDrawer
        open={kanbanOpen}
        title="Project Board"
        subtitle="Pull from Backlog → This Class → Doing → Done. WIP=1: finish before you start."
        onClose={() => setKanbanOpen(false)}
        fullBoardHref={`/unit/${unitId}/board`}
      >
        <KanbanBoard unitId={unitId} />
      </BoardDrawer>
      <PortfolioPanel
        unitId={unitId}
        open={portfolioOpen}
        onClose={() => setPortfolioOpen(false)}
        onRequestCapture={() => {
          window.dispatchEvent(new CustomEvent("questerra:open-capture"));
        }}
        onOpenNarrative={() => {
          setPortfolioOpen(false);
          setNarrativeOpen(true);
        }}
        unitTitle={data.unit.title}
        studentName={data.studentName}
      />
      {/* Smoke-fix round 6 — Timeline drawer (was: GanttPanel; ripped
          out per Matt's request — milestones with race-day variance
          replace the page-due-date Gantt for agency-style units). */}
      <BoardDrawer
        open={timelineOpen}
        title="Timeline & Milestones"
        subtitle="Backward-map from race day. Variance dots flip as deadlines approach."
        onClose={() => setTimelineOpen(false)}
        fullBoardHref={`/unit/${unitId}/board`}
      >
        <TimelineBoard unitId={unitId} />
      </BoardDrawer>
      <NarrativeModal
        open={narrativeOpen}
        onClose={() => setNarrativeOpen(false)}
        unit={data.unit}
        progress={data.progress}
        studentName={data.studentName || "Student"}
      />

      {/* Save indicator — subtle auto-save status in top bar area */}
      {saving && (
        <div className="fixed top-[4.5rem] right-4 z-50 flex items-center gap-1.5 px-3 py-1 bg-gray-100 text-gray-500 text-xs font-medium rounded-full shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          Saving...
        </div>
      )}
      {showSaveToast && (
        <div className="fixed top-[4.5rem] right-4 z-50 flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 text-xs font-medium rounded-full shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          Saved
        </div>
      )}
      {moderationError && (
        <div className="fixed top-[4.5rem] left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 text-red-700 text-sm font-medium rounded-lg shadow-md max-w-md text-center">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/></svg>
          {moderationError}
        </div>
      )}

      {/* Pace pulse — shown after completing a page. Feeds timing model. */}
      {showFeedbackPulse && student?.id && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-6 animate-pop-in">
            <StudentFeedbackPulse
              studentId={student.id}
              unitId={unitId}
              pageId={pageId}
              onSubmit={() => {
                setShowFeedbackPulse(false);
                if (pendingNavTarget) router.push(pendingNavTarget);
              }}
              onClose={() => {
                setShowFeedbackPulse(false);
                if (pendingNavTarget) router.push(pendingNavTarget);
              }}
            />
          </div>
        </div>
      )}

      {/* NM pulse removed from here — moved inline above Complete & Continue */}

      {/* ── Right-side tools rail — Portfolio / Project Board / Timeline ──
          Smoke-fix round 6 (6 May 2026):
            - "My Plan" (MYP-criteria PlanningPanelV2) → Project Board
              (Kanban drawer)
            - "Schedule" (page-due-date GanttPanel) → Timeline (milestones
              + variance drawer)
            - Class Gallery temporarily removed — Matt: "not something I
              have time for right now"
          The drawer pattern keeps students inside the lesson while
          reviewing their project surfaces; the full board page is one
          click away via the drawer's "Full board →" link. */}
      {!kanbanOpen && !portfolioOpen && !timelineOpen && (
        <LessonToolsRail
          tools={(
            [
              {
                id: "portfolio",
                label: "Portfolio",
                onClick: () => setPortfolioOpen(true),
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </svg>
                ),
              },
              {
                id: "project-board",
                label: "Project Board",
                onClick: () => setKanbanOpen(true),
                // Kanban-style 4-rect icon (matches the LH sidebar CTA)
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="9" rx="1.5" />
                    <rect x="14" y="3" width="7" height="5" rx="1.5" />
                    <rect x="14" y="12" width="7" height="9" rx="1.5" />
                    <rect x="3" y="16" width="7" height="5" rx="1.5" />
                  </svg>
                ),
              },
              {
                id: "timeline",
                label: "Timeline",
                onClick: () => setTimelineOpen(true),
                // Milestones-on-a-line icon
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <circle cx="6" cy="12" r="2" />
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="18" cy="12" r="2" />
                  </svg>
                ),
              },
            ] as LessonTool[]
          )}
        />
      )}

      <QuickCaptureFAB
        unitId={unitId}
        hidden={!portfolioOpen}
        onEntryCreated={() => {
          setPortfolioOpen(false);
          setTimeout(() => setPortfolioOpen(true), 50);
        }}
      />

      {/* Mobile bottom nav */}
      <MobileBottomNav
        enabledPages={enabledPages}
        currentPageId={pageId}
        unitId={unitId}
        pageColor={pageColor}
        onDone={async () => {
          await saveProgress("complete");
          if (nextPage) {
            // Hard navigation — see onComplete in LessonFooter above.
            window.location.href = `/unit/${unitId}/${nextPage.id}`;
          }
        }}
      />

      {/* Design Assistant chat widget removed in Phase 10 polish.
          Will return in a later phase with a unified integration — Matt
          wants to rethink how the AI mentor surfaces across the shell. */}
    </div>
  );
}
