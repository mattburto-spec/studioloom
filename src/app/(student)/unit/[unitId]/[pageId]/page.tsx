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
import { PlanningPanelV2 as PlanningPanel } from "@/components/planning/PlanningPanelV2";
import { GanttPanel } from "@/components/planning/GanttPanel";
import { QuickCaptureFAB } from "@/components/portfolio/QuickCaptureFAB";
import { PortfolioPanel } from "@/components/portfolio/PortfolioPanel";
import { ExportPagePdf } from "@/components/student/ExportPagePdf";
import { NarrativeModal } from "@/components/portfolio/NarrativeModal";
import { VocabWarmup } from "@/components/student/VocabWarmup";
import { TextToSpeech } from "@/components/student/TextToSpeech";
import { useUnitNav } from "@/contexts/UnitNavContext";
import { ScrollReveal } from "@/components/student/ScrollReveal";
import { toEmbedUrl } from "@/lib/video-embed";
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

  const { responses, setResponses, saving, showSaveToast, saveProgress, moderationError } =
    usePageResponses(unitId, pageId, currentPage, data, integrityMetadataRef, getTrackingPayload);

  const { student, classInfo } = useStudent();
  const openStudio = useOpenStudio(unitId);
  const [planOpen, setPlanOpen] = useState(false);
  const [portfolioOpen, setPortfolioOpen] = useState(false);
  const [ganttOpen, setGanttOpen] = useState(false);
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
  const hasContext = pageContent?.learningGoal || pageContent?.vocabWarmup || pageContent?.introduction;

  const displayTitle = currentPage
    ? (currentPage.phaseLabel && pageContent?.title?.startsWith(`${currentPage.phaseLabel}: `)
        ? pageContent.title.slice(currentPage.phaseLabel.length + 2)
        : pageContent?.title || currentPage.title)
    : data?.unit.title || "Lesson";

  // If page not found but we have pages, useEffect will redirect — show nothing briefly
  if (!currentPage && allPages.length > 0) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Lesson sticky bar removed in Phase 10 follow-up — its mobile
          hamburger now lives in the layout-owned BoldTopNav via
          SidebarSlotContext. The Dashboard button was redundant with the
          nav logo. Progress + title are already shown in the hero block
          below. */}

      {/* ── Hero header — full-width gradient block ── */}
      {currentPage ? (
      <div className="w-full" style={{ background: `linear-gradient(135deg, #1A1A2E 0%, ${pageColor} 100%)` }}>
        <div className="max-w-5xl mx-auto px-6 pt-6 pb-10">

          <p className="text-sm text-white/70 font-medium mb-3 uppercase tracking-wider">
            Lesson {currentIndex + 1} of {enabledPages.length}
          </p>

          <h1 className="text-4xl md:text-5xl font-extrabold text-white leading-tight">
            {journeyMode || currentPage.type === "lesson"
              ? displayTitle
              : `${currentPage.id}: ${displayTitle}`}
          </h1>

          {/* Badges */}
          <div className="flex items-center gap-2 mt-5 flex-wrap">
            {(journeyMode || currentPage.type === "lesson") && pageContent?.sections && (
              collectCriterionChips(pageContent.sections, framework).map(chip => (
                <span
                  key={chip.key}
                  className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-white/20 text-white"
                >
                  <span className="w-2 h-2 rounded-full bg-white/60" />
                  {chip.kind === "label" || chip.kind === "implicit"
                    ? `${chip.short}: ${chip.name}`
                    : chip.kind === "unknown"
                      ? chip.tag
                      : "Not assessed"}
                </span>
              ))
            )}
            {!journeyMode && currentPage.type !== "lesson" && criterion && (
              <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full bg-white/20 text-white">
                Criterion {currentPage.criterion}: {criterion.name}
              </span>
            )}
            {currentSettings.assessment_type === "summative" && (
              <span className="inline-flex items-center text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full bg-white/20 text-white">
                Summative
              </span>
            )}
            {currentSettings.export_pdf && pageContent?.sections && (
              <ExportPagePdf
                pageId={pageId}
                pageTitle={pageContent.title || currentPage.title}
                sections={pageContent.sections}
                responses={responses}
                studentName={data.studentName || "Student"}
                unitTitle={data.unit.title}
              />
            )}
          </div>
        </div>
      </div>
      ) : (
      /* No lesson content — show a helpful empty state instead of blank page */
      <div className="w-full" style={{ background: "linear-gradient(135deg, #1A1A2E 0%, #6B7280 100%)" }}>
        <div className="max-w-5xl mx-auto px-6 pt-6 pb-10">
          <h1 className="text-3xl md:text-4xl font-extrabold text-white leading-tight">
            {data?.unit.title || "Unit"}
          </h1>
          <p className="text-white/70 mt-3">
            This unit doesn&apos;t have any lesson content yet. Your teacher will add content soon.
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
        {/* ── Section 1: Context (Learning Goal + Vocab + Intro) ── */}
        {hasContext && (
          <>
            {/* Learning goal — gradient colored block */}
            {pageContent?.learningGoal && (
              <ScrollReveal>
                <div
                  className="full-bleed py-10 mb-8"
                  style={{ background: `linear-gradient(135deg, #1A1A2E 0%, ${pageColor} 100%)` }}
                >
                  <div className="max-w-5xl mx-auto px-6">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-sm font-bold uppercase tracking-widest text-white/70">
                        Learning Objectives
                      </h2>
                      <TextToSpeech text={pageContent.learningGoal} />
                    </div>
                    <p className="text-xl md:text-2xl font-medium text-white leading-relaxed">
                      {pageContent.learningGoal}
                    </p>
                  </div>
                </div>
              </ScrollReveal>
            )}

            <SectionDivider number={++sectionNum} color={pageColor} />

            {/* Vocab warmup — bold colored accent block */}
            {pageContent?.vocabWarmup && (
              <ScrollReveal delay={100}>
                <div
                  className="rounded-2xl p-6 md:p-8 mb-8"
                  style={{ backgroundColor: pageColor + "18" }}
                >
                  <VocabWarmup warmup={pageContent.vocabWarmup} ellLevel={data.ellLevel} />
                </div>
              </ScrollReveal>
            )}

            {/* Introduction — big readable paragraph */}
            {pageContent?.introduction && (
              <ScrollReveal delay={150}>
                <div className="mb-8">
                  <div className="flex items-start gap-3">
                    <p className="text-lg text-gray-700 leading-relaxed flex-1">
                      {pageContent.introduction.text}
                    </p>
                    <TextToSpeech text={pageContent.introduction.text} />
                  </div>
                  {pageContent.introduction.media?.type === "image" && (
                    <div className="mt-6 rounded-2xl overflow-hidden shadow-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={pageContent.introduction.media.url} alt="" className="w-full" />
                    </div>
                  )}
                  {pageContent.introduction.media?.type === "video" && (() => {
                    const embedUrl = toEmbedUrl(pageContent.introduction.media!.url);
                    return embedUrl ? (
                      <div className="mt-6 rounded-2xl overflow-hidden bg-black aspect-video shadow-sm">
                        <iframe
                          src={embedUrl}
                          className="w-full h-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    ) : null;
                  })()}
                  {pageContent.introduction.links && pageContent.introduction.links.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {pageContent.introduction.links.map((link, i) => (
                        <a
                          key={i}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
                          style={{ backgroundColor: pageColor + "15", color: pageColor }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                          </svg>
                          {link.label}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollReveal>
            )}
          </>
        )}

        {/* Skills for this lesson — renders only when teacher has pinned
            skill cards to this page via the "Used in" panel on the card
            edit page. Zero noise when there are no pins. */}
        <SkillRefsForPage pageId={pageId} />

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

        {/* ── NM Competency Pulse — above Complete & Continue ── */}
        {nmCheckpoint && !nmCompleted && (
          <div className="max-w-5xl mx-auto px-6 mt-10 mb-2">
            <CompetencyPulse
              pageId={pageId}
              unitId={unitId}
              elements={nmCheckpoint.elements}
              onComplete={() => setNmCompleted(true)}
            />
          </div>
        )}

        {/* ── Complete & Continue — solid colored block ── */}
        <ScrollReveal>
          <div
            className="mt-12 full-bleed py-10 text-center"
            style={{ backgroundColor: pageColor }}
          >
            <button
              onClick={async () => {
                await saveProgress("complete");
                if (student?.id) {
                  // Show feedback pulse before navigating
                  setPendingNavTarget(nextPage ? `/unit/${unitId}/${nextPage.id}` : null);
                  setShowFeedbackPulse(true);
                } else if (nextPage) {
                  router.push(`/unit/${unitId}/${nextPage.id}`);
                }
              }}
              disabled={saving}
              className="px-10 py-4 rounded-xl font-bold text-lg transition-all hover:shadow-lg hover:scale-105 active:scale-95 disabled:opacity-50 bg-white"
              style={{ color: pageColor }}
            >
              {saving
                ? "Saving..."
                : nextPage
                  ? "Complete & Continue"
                  : "Mark as Complete"}
            </button>
            {nextPage && (
              <p className="text-sm text-white/70 mt-3">
                Next: Lesson {currentIndex + 2}
              </p>
            )}
          </div>
        </ScrollReveal>
      </>)}
      </main>

      {/* Panels */}
      <PlanningPanel unitId={unitId} open={planOpen} onClose={() => setPlanOpen(false)} pages={allPages} />
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
      <GanttPanel
        unitId={unitId}
        open={ganttOpen}
        onClose={() => setGanttOpen(false)}
        pageDueDates={data.pageDueDates || {}}
        currentPageId={pageId}
        pages={allPages}
      />
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

      {/* Floating action buttons */}
      {!planOpen && !portfolioOpen && !ganttOpen && (
        <div className="fixed right-4 z-40 flex flex-col-reverse items-end gap-3" style={{ bottom: "5.5rem" }}>
          <div className="group flex items-center gap-2 animate-pop-in">
            <span className="px-2.5 py-1 rounded-lg bg-gray-900/80 text-white text-xs font-medium shadow-lg opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 pointer-events-none whitespace-nowrap">
              Journal
            </span>
            <button
              onClick={() => setPortfolioOpen(true)}
              className="w-11 h-11 rounded-full gradient-cta text-white shadow-lg shadow-brand-pink/30 hover:scale-110 hover:shadow-xl active:scale-95 transition-all duration-150 flex items-center justify-center"
              aria-label="Journal"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            </button>
          </div>

          <div className="group flex items-center gap-2 animate-pop-in" style={{ animationDelay: "50ms" }}>
            <span className="px-2.5 py-1 rounded-lg bg-gray-900/80 text-white text-xs font-medium shadow-lg opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 pointer-events-none whitespace-nowrap">
              My Plan
            </span>
            <button
              onClick={() => setPlanOpen(true)}
              className="w-11 h-11 rounded-full gradient-cta text-white shadow-lg shadow-brand-pink/30 hover:scale-110 hover:shadow-xl active:scale-95 transition-all duration-150 flex items-center justify-center"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            </button>
          </div>

          <div className="group flex items-center gap-2 animate-pop-in" style={{ animationDelay: "100ms" }}>
            <span className="px-2.5 py-1 rounded-lg bg-gray-900/80 text-white text-xs font-medium shadow-lg opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 pointer-events-none whitespace-nowrap">
              Schedule
            </span>
            <button
              onClick={() => setGanttOpen(true)}
              className="w-11 h-11 rounded-full gradient-cta text-white shadow-lg shadow-brand-pink/30 hover:scale-110 hover:shadow-xl active:scale-95 transition-all duration-150 flex items-center justify-center"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </button>
          </div>

          <div className="group flex items-center gap-2 animate-pop-in" style={{ animationDelay: "150ms" }}>
            <span className="px-2.5 py-1 rounded-lg bg-gray-900/80 text-white text-xs font-medium shadow-lg opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 pointer-events-none whitespace-nowrap">
              Class Gallery
            </span>
            <button
              onClick={() => window.open("/dashboard#gallery", "_blank")}
              className="w-11 h-11 rounded-full text-white shadow-lg hover:scale-110 hover:shadow-xl active:scale-95 transition-all duration-150 flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #EC4899, #DB2777)", boxShadow: "0 4px 14px rgba(236, 72, 153, 0.35)" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </button>
          </div>

          {/* Design Tools floating button removed in Phase 10 polish — not
              project-management and not relevant to non-Design units. */}
        </div>
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
            router.push(`/unit/${unitId}/${nextPage.id}`);
          }
        }}
      />

      {/* Design Assistant chat widget removed in Phase 10 polish.
          Will return in a later phase with a unified integration — Matt
          wants to rethink how the AI mentor surfaces across the shell. */}
    </div>
  );
}
