"use client";

import { useState, useEffect, use } from "react";
import { createClient } from "@/lib/supabase/client";
import { getPageList, normalizeContentData } from "@/lib/unit-adapter";
import PhaseTimer from "@/components/teach/PhaseTimer";
import type { Unit, PageContent, WorkshopPhases, LessonExtension } from "@/types";

/**
 * Projector View — opened in a separate window from the Teaching Dashboard.
 * This is what the class sees on the projector/TV.
 *
 * Design principles:
 * - LARGE text, readable from back of room
 * - Dark background for projector clarity
 * - Minimal UI — no distracting menus or buttons
 * - Shows: lesson title, learning goal, current phase + timer, activity prompts
 * - Phase-aware: automatically highlights the current activity
 */

export default function ProjectorView({
  params,
  searchParams,
}: {
  params: Promise<{ unitId: string }>;
  searchParams: Promise<{ pageId?: string }>;
}) {
  const { unitId } = use(params);
  const { pageId: initialPageId } = use(searchParams);

  const [unit, setUnit] = useState<Unit | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(initialPageId || null);
  const [currentPhaseId, setCurrentPhaseId] = useState<string>("opening");
  const [showActivities, setShowActivities] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase.from("units").select("*").eq("id", unitId).single();
      setUnit(data);
      if (data && !selectedPageId) {
        const pages = getPageList(data.content_data);
        if (pages.length > 0) setSelectedPageId(pages[0].id);
      }
      setLoading(false);
    }
    load();
  }, [unitId, selectedPageId]);

  // Listen for messages from the teaching dashboard (same-origin postMessage)
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "studioloom-projector-sync") {
        if (event.data.pageId) setSelectedPageId(event.data.pageId);
        if (event.data.phase) setCurrentPhaseId(event.data.phase);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-purple-400 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (!unit) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500 text-lg">Unit not found.</p>
      </main>
    );
  }

  const pages = getPageList(unit.content_data);
  const currentPage = pages.find((p) => p.id === selectedPageId);
  const content: PageContent | null = currentPage?.content || null;
  const workshopPhases: WorkshopPhases | null = content?.workshopPhases || null;
  const extensions: LessonExtension[] = content?.extensions || [];

  // Phase-to-section mapping
  const PHASE_COLORS: Record<string, string> = {
    opening: "#7C3AED",
    miniLesson: "#2563EB",
    workTime: "#16A34A",
    debrief: "#D97706",
  };

  const PHASE_LABELS: Record<string, string> = {
    opening: "Opening",
    miniLesson: "Mini-Lesson",
    workTime: "Work Time",
    debrief: "Debrief",
  };

  const phaseColor = PHASE_COLORS[currentPhaseId] || "#7C3AED";

  return (
    <main className="min-h-screen bg-gray-950 text-white overflow-hidden">
      {/* ================================================================= */}
      {/* TOP BAR — lesson title + phase indicator                          */}
      {/* ================================================================= */}
      <header className="px-8 pt-6 pb-4">
        <div className="flex items-center gap-4">
          {/* Phase badge */}
          <div
            className="px-4 py-2 rounded-xl text-sm font-black uppercase tracking-wider"
            style={{ background: `${phaseColor}22`, color: phaseColor }}
          >
            {PHASE_LABELS[currentPhaseId] || currentPhaseId}
          </div>

          <div className="flex-1">
            <h1 className="text-2xl font-black leading-tight">
              {currentPage?.title || unit.title}
            </h1>
          </div>

          {/* Lesson nav (small, bottom-right) */}
          <div className="flex gap-1">
            {pages.map((p, i) => (
              <button
                key={p.id}
                onClick={() => setSelectedPageId(p.id)}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition ${
                  p.id === selectedPageId
                    ? "bg-white text-gray-900"
                    : "bg-gray-800 text-gray-500 hover:bg-gray-700"
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ================================================================= */}
      {/* MAIN CONTENT                                                      */}
      {/* ================================================================= */}
      <div className="px-8 pb-8 space-y-6">

        {/* Learning Goal — hero */}
        {content?.learningGoal && (
          <div
            className="rounded-2xl p-6 border"
            style={{
              background: `${phaseColor}11`,
              borderColor: `${phaseColor}33`,
            }}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: `${phaseColor}99` }}>
              Learning Goal
            </p>
            <p className="text-xl font-semibold leading-relaxed" style={{ color: `${phaseColor}dd` }}>
              {content.learningGoal}
            </p>
          </div>
        )}

        {/* Phase Timer (compact) */}
        {workshopPhases && (
          <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
            <PhaseTimer
              workshopPhases={workshopPhases}
              onPhaseChange={(phase) => setCurrentPhaseId(phase)}
              compact
            />
          </div>
        )}

        {/* Phase-specific content */}
        {currentPhaseId === "opening" && workshopPhases?.opening?.hook && (
          <div className="bg-violet-950/50 rounded-2xl p-6 border border-violet-800/30">
            <p className="text-3xl font-bold text-violet-200 leading-relaxed">
              {workshopPhases.opening.hook}
            </p>
          </div>
        )}

        {currentPhaseId === "miniLesson" && workshopPhases?.miniLesson?.focus && (
          <div className="bg-blue-950/50 rounded-2xl p-6 border border-blue-800/30">
            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-3">
              Today&apos;s Focus
            </p>
            <p className="text-2xl font-bold text-blue-200 leading-relaxed">
              {workshopPhases.miniLesson.focus}
            </p>
          </div>
        )}

        {currentPhaseId === "workTime" && (
          <div className="bg-green-950/50 rounded-2xl p-6 border border-green-800/30">
            <p className="text-[10px] font-bold text-green-400 uppercase tracking-widest mb-3">
              Work Time
            </p>
            {workshopPhases?.workTime?.focus && (
              <p className="text-xl font-semibold text-green-200 mb-4">
                {workshopPhases.workTime.focus}
              </p>
            )}
            {/* Show activity prompts */}
            {content?.sections && (
              <button
                onClick={() => setShowActivities(!showActivities)}
                className="text-xs text-green-400 hover:text-green-300 font-medium"
              >
                {showActivities ? "Hide activities" : `Show ${content.sections.length} activities`}
              </button>
            )}
            {showActivities && content?.sections && (
              <div className="mt-4 space-y-3">
                {content.sections.map((s, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="text-green-600 font-mono text-sm mt-0.5">{i + 1}.</span>
                    <p className="text-base text-green-100 leading-relaxed">{s.prompt}</p>
                  </div>
                ))}
              </div>
            )}
            {/* Checkpoints */}
            {workshopPhases?.workTime?.checkpoints && workshopPhases.workTime.checkpoints.length > 0 && (
              <div className="mt-4 pt-4 border-t border-green-800/30">
                <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest mb-2">
                  Checkpoints
                </p>
                {workshopPhases.workTime.checkpoints.map((cp, i) => (
                  <p key={i} className="text-sm text-green-300 flex items-start gap-2 mb-1">
                    <span className="text-green-600">○</span> {cp}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {currentPhaseId === "debrief" && (
          <div className="bg-amber-950/50 rounded-2xl p-6 border border-amber-800/30">
            <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-3">
              Debrief
            </p>
            {workshopPhases?.debrief?.protocol && (
              <p className="text-lg font-semibold text-amber-200 mb-2">
                Protocol: {workshopPhases.debrief.protocol}
              </p>
            )}
            {workshopPhases?.debrief?.prompt && (
              <p className="text-2xl font-bold text-amber-100 leading-relaxed">
                {workshopPhases.debrief.prompt}
              </p>
            )}
          </div>
        )}

        {/* Extensions (shown during work time when students finish early) */}
        {currentPhaseId === "workTime" && extensions.length > 0 && (
          <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-3">
              Early Finishers
            </p>
            <div className="grid grid-cols-3 gap-3">
              {extensions.map((ext, i) => (
                <div key={i} className="bg-emerald-950/50 rounded-xl p-3 border border-emerald-800/30">
                  <p className="text-sm font-bold text-emerald-200">{ext.title}</p>
                  <p className="text-xs text-emerald-400 mt-1">{ext.description}</p>
                  <p className="text-[10px] text-emerald-600 mt-1 font-mono">~{ext.durationMinutes}m</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Vocab (shown during opening) */}
        {currentPhaseId === "opening" && content?.vocabWarmup?.terms && content.vocabWarmup.terms.length > 0 && (
          <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
            <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-3">
              Key Vocabulary
            </p>
            <div className="grid grid-cols-2 gap-3">
              {content.vocabWarmup.terms.map((term, i) => (
                <div key={i} className="bg-purple-950/50 rounded-xl p-3 border border-purple-800/30">
                  <p className="text-base font-bold text-purple-200">{term.term}</p>
                  <p className="text-xs text-purple-400 mt-0.5">{term.definition}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer watermark */}
      <div className="fixed bottom-4 right-4 text-[10px] text-gray-700 font-medium">
        StudioLoom
      </div>
    </main>
  );
}
