"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { CRITERIA, PAGE_TYPE_LABELS, type CriterionKey } from "@/lib/constants";
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
import DesignAssistantWidget from "@/components/student/DesignAssistantWidget";
import { useStudent } from "@/app/(student)/student-context";
import { OpenStudioBanner } from "@/components/open-studio";
import { useOpenStudio } from "@/hooks/useOpenStudio";
import { CompetencyPulse } from "@/components/nm";
import type { PageContent } from "@/types";

export default function UnitPageView({
  params,
}: {
  params: Promise<{ unitId: string; pageId: string }>;
}) {
  const { unitId, pageId } = use(params);
  const router = useRouter();
  const unitNav = useUnitNav();

  const { data, loading, allPages, currentPage, enabledPages, nextPage, currentSettings, pageColor } =
    usePageData(unitId, pageId);
  const { responses, setResponses, saving, showSaveToast, saveProgress } =
    usePageResponses(unitId, pageId, currentPage, data);

  const { student } = useStudent();
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

  // Fetch NM checkpoint config for this page
  useEffect(() => {
    fetch(`/api/student/nm-checkpoint/${pageId}?unitId=${unitId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.checkpoint) setNmCheckpoint(d.checkpoint);
      })
      .catch(() => {}); // silently ignore — NM is optional
  }, [pageId]);

  if (loading || !data || !currentPage) {
    return null; // Layout handles the loading state
  }

  const journeyMode = isV3(data.unit.content_data);
  const currentIndex = enabledPages.findIndex((p) => p.id === pageId);
  const criterion = currentPage.type === "strand" && currentPage.criterion
    ? CRITERIA[currentPage.criterion as CriterionKey]
    : null;
  const pageContent: PageContent | undefined = currentPage.content;

  let sectionNum = 0;
  const hasContext = pageContent?.learningGoal || pageContent?.vocabWarmup || pageContent?.introduction;

  const displayTitle = currentPage.phaseLabel && pageContent?.title?.startsWith(`${currentPage.phaseLabel}: `)
    ? pageContent.title.slice(currentPage.phaseLabel.length + 2)
    : pageContent?.title || currentPage.title;

  return (
    <div className="min-h-screen bg-white">
      {/* ── Sticky top nav bar ── */}
      <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {unitNav && (
              <button
                onClick={() => unitNav.setSidebarOpen(true)}
                className="md:hidden w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
            )}
            <span className="text-xs text-gray-400 font-medium hidden sm:block">
              {currentIndex + 1}/{enabledPages.length}
            </span>
          </div>
          <span className="text-sm font-semibold text-gray-700 truncate max-w-[50%]">
            {displayTitle}
          </span>
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Dashboard
          </button>
        </div>
      </div>

      {/* ── Hero header — full-width gradient block ── */}
      <div className="w-full" style={{ background: `linear-gradient(135deg, #1A1A2E 0%, ${pageColor} 100%)` }}>
        <div className="max-w-4xl mx-auto px-6 pt-6 pb-10">

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
            {(journeyMode || currentPage.type === "lesson") && pageContent?.sections?.some(s => s.criterionTags?.length) && (
              pageContent.sections
                .flatMap(s => s.criterionTags || [])
                .filter((v, i, a) => a.indexOf(v) === i)
                .map(tag => {
                  const criterionMeta = CRITERIA[tag as CriterionKey];
                  return (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-white/20 text-white"
                    >
                      <span
                        className="w-2 h-2 rounded-full bg-white/60"
                      />
                      {criterionMeta ? `${tag}: ${criterionMeta.name}` : tag}
                    </span>
                  );
                })
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

      {/* ── Open Studio Banner ── */}
      {openStudio.state && (openStudio.state.unlocked || openStudio.justRevoked) && (
        <div className="max-w-4xl mx-auto px-6 pt-6">
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
      <main className="max-w-4xl mx-auto px-6 py-10 pb-28">

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
                  <div className="max-w-4xl mx-auto px-6">
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

        {/* ── Activity sections with dividers ── */}
        {pageContent?.sections ? (
          pageContent.sections.map((section, i) => {
            const responseKey = section.activityId ? `activity_${section.activityId}` : `section_${i}`;
            return (
              <ScrollReveal key={section.activityId || i} delay={i * 80}>
                <SectionDivider number={++sectionNum} color={pageColor} />
                <ActivityCard
                  section={section}
                  index={i}
                  ellLevel={data.ellLevel}
                  responseValue={responses[responseKey] || ""}
                  onResponseChange={(val) =>
                    setResponses((prev) => ({
                      ...prev,
                      [responseKey]: val,
                    }))
                  }
                  isLast={true}
                  arrowOffset={0}
                  allowedTypes={[...new Set(pageContent.sections.map(s => s.responseType).filter(Boolean))] as ("text" | "upload" | "voice" | "link")[]}
                  unitId={unitId}
                  pageId={pageId}
                  pageColor={pageColor}
                />
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
          <div className="max-w-4xl mx-auto px-6 mt-10 mb-2">
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
        <div className="fixed top-[3.25rem] right-4 z-50 flex items-center gap-1.5 px-3 py-1 bg-gray-100 text-gray-500 text-xs font-medium rounded-full shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          Saving...
        </div>
      )}
      {showSaveToast && (
        <div className="fixed top-[3.25rem] right-4 z-50 flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 text-xs font-medium rounded-full shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          Saved
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
              Portfolio
            </span>
            <button
              onClick={() => setPortfolioOpen(true)}
              className="w-11 h-11 rounded-full gradient-cta text-white shadow-lg shadow-brand-pink/30 hover:scale-110 hover:shadow-xl active:scale-95 transition-all duration-150 flex items-center justify-center"
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
              Design Tools
            </span>
            <button
              onClick={() => window.dispatchEvent(new Event('questerra:open-tools'))}
              className="w-11 h-11 rounded-full text-white shadow-lg hover:scale-110 hover:shadow-xl active:scale-95 transition-all duration-150 flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #7B2FF2, #5C16C5)", boxShadow: "0 4px 14px rgba(123, 47, 242, 0.35)" }}
            >
              <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
                <rect x="2" y="8" width="28" height="5" rx="2.5" fill="white" />
                <rect x="2" y="19" width="28" height="5" rx="2.5" fill="white" />
                <rect x="8" y="2" width="5" height="28" rx="2.5" fill="white" />
                <rect x="19" y="2" width="5" height="28" rx="2.5" fill="white" />
              </svg>
            </button>
          </div>
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

      {/* Design Assistant — Socratic mentor chat widget */}
      {student?.id && (
        <DesignAssistantWidget
          unitId={unitId}
          pageId={pageId}
          studentId={student.id}
        />
      )}
    </div>
  );
}
