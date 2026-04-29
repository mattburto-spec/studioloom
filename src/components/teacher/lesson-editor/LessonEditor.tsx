"use client";

import { useEffect, useCallback, useState, useMemo } from "react";
import { Reorder, AnimatePresence, motion } from "framer-motion";
import { useLessonEditor } from "./useLessonEditor";
import { useAISuggestions } from "./useAISuggestions";
import type { AISuggestion } from "./useAISuggestions";
import { LessonSidebar } from "./LessonSidebar";
import LessonHeader from "./LessonHeader";
import PhaseSection from "./PhaseSection";
import ActivityBlock from "./ActivityBlock";
import { ActivityBlockAdd } from "./ActivityBlockAdd";
import BlockPalette from "./BlockPalette";
import GhostBlock from "./GhostBlock";
import DropZone from "./DropZone";
import { DndProvider } from "./DndContext";
import AITextField from "./AITextField";
import ExtensionBlock from "./ExtensionBlock";
import DimensionsSummaryBar from "./DimensionsSummaryBar";
import UnitThumbnailEditor from "./UnitThumbnailEditor";
import { LessonSkillsPanel } from "@/components/skills/LessonSkillsPanel";
import { autoPopulateBloomLevels } from "@/lib/dimensions/infer-bloom";
import type {
  UnitPage,
  PageContent,
  ActivitySection,
  WorkshopPhases,
  LessonExtension,
} from "@/types";
import { nanoid } from "nanoid";

interface LessonEditorProps {
  unitId: string;
  classId: string;
  onBack?: () => void;
  /** Enable version management (Save as Version, Reset to Master) */
  enableVersioning?: boolean;
}

const SAVE_STATUS_LABELS: Record<string, { text: string; color: string }> = {
  idle: { text: "", color: "" },
  saving: { text: "Saving...", color: "text-gray-400" },
  saved: { text: "✓ Saved", color: "text-emerald-500" },
  error: { text: "Save failed", color: "text-red-500" },
};

export default function LessonEditor({
  unitId,
  classId,
  onBack,
  enableVersioning = true,
}: LessonEditorProps) {
  const {
    content,
    loading,
    error,
    unitTitle,
    thumbnailUrl,
    setThumbnailUrl,
    framework,
    selectedPageIndex,
    setSelectedPageIndex,
    updatePage,
    addPage,
    removePage,
    reorderPages,
    isFork,
    editMode,
    setEditMode,
    versionHistory,
    loadingVersions,
    promoteFork,
    promoting,
    undo,
    redo,
    canUndo,
    canRedo,
    saveStatus,
  } = useLessonEditor({ unitId, classId });

  // Phase collapse state
  const [openPhases, setOpenPhases] = useState<Record<string, boolean>>({
    opening: true,
    miniLesson: true,
    workTime: true,
    debrief: true,
  });

  const togglePhase = (phase: string) => {
    setOpenPhases((prev) => ({ ...prev, [phase]: !prev[phase] }));
  };

  // Block palette state
  const [paletteOpen, setPaletteOpen] = useState(true);

  // AI suggestions
  const {
    suggestions,
    loading: suggestionsLoading,
    fetchSuggestions,
    dismissSuggestion,
    acceptSuggestion,
    suggestedBlockIds,
  } = useAISuggestions({ unitId, classId });

  // Teacher preferences (UDL gating)
  const [udlEnabled, setUdlEnabled] = useState(false);
  useEffect(() => {
    fetch("/api/teacher/profile").then(r => r.ok ? r.json() : null).then(data => {
      if (data) setUdlEnabled(data.teacher_preferences?.enable_udl || data.school_context?.enable_udl || false);
    }).catch(() => {});
  }, []);

  // AI generation state
  const [showAIGenerate, setShowAIGenerate] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);

  // Version management state
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [versionLabel, setVersionLabel] = useState("");
  const [savingVersion, setSavingVersion] = useState(false);
  const [versionSaved, setVersionSaved] = useState<number | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const handleSaveAsVersion = useCallback(async () => {
    if (!versionLabel.trim()) return;
    setSavingVersion(true);
    try {
      const res = await fetch("/api/teacher/units/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId, classId, label: versionLabel.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setVersionSaved(data.versionNumber);
        setShowVersionModal(false);
        setVersionLabel("");
        setTimeout(() => setVersionSaved(null), 4000);
      }
    } catch {
      // Silent fail — version save is optional
    }
    setSavingVersion(false);
  }, [unitId, classId, versionLabel]);

  const handleResetToMaster = useCallback(async () => {
    setResetting(true);
    try {
      const res = await fetch("/api/teacher/class-units/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, unitId }),
      });
      if (res.ok) {
        // Reload the page to re-fetch content
        window.location.reload();
      }
    } catch {
      // Silent fail
    }
    setResetting(false);
    setShowResetConfirm(false);
  }, [unitId, classId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Undo
      if (isMod && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Redo
      if (isMod && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

  // Get pages array safely
  const pages = useMemo(() => {
    if (!content) return [];
    const pages = (content as any).pages;
    if (Array.isArray(pages)) return pages as UnitPage[];
    return [];
  }, [content]);

  const selectedPage =
    selectedPageIndex !== null && pages[selectedPageIndex]
      ? pages[selectedPageIndex]
      : null;

  const pageContent = useMemo(() => {
    if (!selectedPage?.content) return null;
    // Ensure sections is always an array for safe iteration
    return {
      ...selectedPage.content,
      sections: selectedPage.content.sections || [],
      extensions: selectedPage.content.extensions || [],
    };
  }, [selectedPage]);

  // --- Auto-populate Bloom's levels on legacy activities ---
  // Runs once per page when activities lack bloom_level, infers from keywords, saves automatically
  const [bloomPopulated, setBloomPopulated] = useState(false);
  useEffect(() => {
    if (!pageContent || !pageContent.sections.length || selectedPageIndex === null) {
      setBloomPopulated(false);
      return;
    }
    // Check if any sections are missing bloom_level
    const missingCount = pageContent.sections.filter((s) => !s.bloom_level).length;
    if (missingCount === 0) {
      setBloomPopulated(false);
      return;
    }
    // Run heuristic
    const { sections: newSections, populatedCount } = autoPopulateBloomLevels(pageContent.sections);
    if (populatedCount > 0) {
      updatePage(selectedPageIndex, { sections: newSections });
      setBloomPopulated(true);
      // Auto-dismiss the notification after 4 seconds
      setTimeout(() => setBloomPopulated(false), 4000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPageIndex]); // Only run when page changes, not on every section edit

  // --- Mutation helpers ---

  const handleUpdatePageContent = useCallback(
    (partial: Partial<PageContent>) => {
      if (selectedPageIndex === null) return;
      updatePage(selectedPageIndex, partial);
    },
    [selectedPageIndex, updatePage]
  );

  // Activity mutations
  const handleUpdateActivity = useCallback(
    (activityIndex: number, partial: Partial<ActivitySection>) => {
      if (!pageContent) return;
      const newSections = [...pageContent.sections];
      newSections[activityIndex] = { ...newSections[activityIndex], ...partial };
      handleUpdatePageContent({ sections: newSections });
    },
    [pageContent, handleUpdatePageContent]
  );

  const handleDeleteActivity = useCallback(
    (activityIndex: number) => {
      if (!pageContent) return;
      const newSections = pageContent.sections.filter(
        (_, i) => i !== activityIndex
      );
      handleUpdatePageContent({ sections: newSections });
    },
    [pageContent, handleUpdatePageContent]
  );

  const handleAddActivity = useCallback(
    (activity: ActivitySection) => {
      if (!pageContent) return;
      const newActivity = {
        ...activity,
        activityId: activity.activityId || nanoid(8),
      };
      handleUpdatePageContent({
        sections: [...pageContent.sections, newActivity],
      });
    },
    [pageContent, handleUpdatePageContent]
  );

  const handleReorderActivities = useCallback(
    (newOrder: ActivitySection[]) => {
      handleUpdatePageContent({ sections: newOrder });
    },
    [handleUpdatePageContent]
  );

  const handleDuplicateActivity = useCallback(
    (activityIndex: number) => {
      if (!pageContent) return;
      const source = pageContent.sections[activityIndex];
      const duplicate: ActivitySection = {
        ...structuredClone(source),
        activityId: nanoid(8),
      };
      const newSections = [...pageContent.sections];
      newSections.splice(activityIndex + 1, 0, duplicate);
      handleUpdatePageContent({ sections: newSections });
    },
    [pageContent, handleUpdatePageContent]
  );

  // Workshop phases mutations
  const handleUpdatePhase = useCallback(
    (
      phase: keyof WorkshopPhases,
      partial: Partial<WorkshopPhases[keyof WorkshopPhases]>
    ) => {
      if (!pageContent?.workshopPhases) return;
      handleUpdatePageContent({
        workshopPhases: {
          ...pageContent.workshopPhases,
          [phase]: { ...pageContent.workshopPhases[phase], ...partial },
        },
      });
    },
    [pageContent, handleUpdatePageContent]
  );

  // Extension mutations
  const handleUpdateExtension = useCallback(
    (index: number, partial: Partial<LessonExtension>) => {
      if (!pageContent?.extensions) return;
      const newExts = [...pageContent.extensions];
      newExts[index] = { ...newExts[index], ...partial };
      handleUpdatePageContent({ extensions: newExts });
    },
    [pageContent, handleUpdatePageContent]
  );

  const handleDeleteExtension = useCallback(
    (index: number) => {
      if (!pageContent?.extensions) return;
      handleUpdatePageContent({
        extensions: pageContent.extensions.filter((_, i) => i !== index),
      });
    },
    [pageContent, handleUpdatePageContent]
  );

  const handleAddExtension = useCallback(() => {
    const newExt: LessonExtension = {
      title: "Extension Activity",
      description: "",
      durationMinutes: 10,
    };
    handleUpdatePageContent({
      extensions: [...(pageContent?.extensions || []), newExt],
    });
  }, [pageContent, handleUpdatePageContent]);

  // Lesson sidebar reorder — Framer Motion gives us the full new array
  const handleReorderPages = useCallback(
    (newOrder: UnitPage[]) => {
      if (!content || !Array.isArray((content as any).pages)) return;
      const oldPages = (content as any).pages as UnitPage[];

      // Find which page moved and where
      for (let i = 0; i < newOrder.length; i++) {
        if (newOrder[i].id !== oldPages[i]?.id) {
          // This is where the change happened — find original index
          const movedPage = newOrder[i];
          const fromIndex = oldPages.findIndex((p) => p.id === movedPage.id);
          if (fromIndex >= 0 && fromIndex !== i) {
            reorderPages(fromIndex, i);
            return;
          }
        }
      }
    },
    [content, reorderPages]
  );

  // --- Timing computation ---
  const phases = pageContent?.workshopPhases;
  const totalDuration = phases
    ? phases.opening.durationMinutes +
      phases.miniLesson.durationMinutes +
      phases.workTime.durationMinutes +
      phases.debrief.durationMinutes
    : 0;

  const activityTotalMinutes = (pageContent?.sections || []).reduce(
    (sum, s) => sum + (s.durationMinutes || 0),
    0
  );

  // --- Render ---

  if (loading) {
    return (
      <div className="lesson-editor-warm flex items-center justify-center min-h-screen bg-[var(--le-bg)]">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading editor...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="lesson-editor-warm flex items-center justify-center min-h-screen bg-[var(--le-bg)]">
        <div className="text-center">
          <p className="text-red-600 font-medium">{error}</p>
          <button
            onClick={onBack}
            className="mt-3 text-sm text-indigo-600 hover:underline"
          >
            ← Go back
          </button>
        </div>
      </div>
    );
  }

  const saveLabel = SAVE_STATUS_LABELS[saveStatus] || SAVE_STATUS_LABELS.idle;

  return (
    <DndProvider>
    <div className="lesson-editor-warm flex flex-col h-screen">
      {/* ─── Sticky Header (warm paper sub-bar) ─── */}
      <div className="flex items-center justify-between px-4 h-10 border-b border-[var(--le-hair)] bg-[var(--le-bg)] z-30 flex-shrink-0">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="text-[12px] text-[var(--le-ink-2)] hover:text-[var(--le-ink)] transition-colors flex items-center gap-1"
            >
              ‹ Back
            </button>
          )}

          <h1 className="text-[13px] font-extrabold tracking-tight text-[var(--le-ink)]">Unit Editor</h1>

          {/* Edit mode indicator — warm paper pill */}
          {editMode === "all" ? (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-[var(--le-hair)] bg-[var(--le-paper)] text-[11px] font-semibold text-[var(--le-ink-2)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--le-accent)]" />
              All classes
            </span>
          ) : isFork ? (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-amber-300 bg-amber-50 text-[11px] font-semibold text-amber-800">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              This class only
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-[var(--le-hair)] bg-[var(--le-paper)] text-[11px] font-semibold text-[var(--le-ink-2)]">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
              This class only
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-[11.5px]">
          {/* Save status */}
          <AnimatePresence mode="wait">
            {saveLabel.text && (
              <motion.span
                key={saveStatus}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                className={`text-[11px] ${saveLabel.color}`}
              >
                {saveLabel.text}
              </motion.span>
            )}
          </AnimatePresence>

          {/* Undo/Redo */}
          <div className="flex items-center">
            <button
              onClick={undo}
              disabled={!canUndo}
              className="px-2 py-1 rounded-md text-[var(--le-ink-3)] hover:bg-[var(--le-hair-2)] hover:text-[var(--le-ink)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-[14px] leading-none"
              title="Undo (Cmd+Z)"
              aria-label="Undo"
            >
              ↶
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              className="px-2 py-1 rounded-md text-[var(--le-ink-3)] hover:bg-[var(--le-hair-2)] hover:text-[var(--le-ink)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-[14px] leading-none"
              title="Redo (Cmd+Shift+Z)"
              aria-label="Redo"
            >
              ↷
            </button>
          </div>

          {/* Version saved toast */}
          <AnimatePresence>
            {versionSaved && (
              <motion.span
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="text-[11px] text-emerald-700 font-semibold"
              >
                Saved as v{versionSaved}
              </motion.span>
            )}
          </AnimatePresence>

          {/* Bloom auto-populated toast */}
          <AnimatePresence>
            {bloomPopulated && (
              <motion.span
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="text-[11px] text-violet-700 font-semibold"
              >
                ✦ Bloom&apos;s levels auto-detected
              </motion.span>
            )}
          </AnimatePresence>

          {/* AI Suggest button — warm violet outline */}
          <button
            onClick={() => {
              if (!pageContent) return;
              fetchSuggestions({
                lessonTitle: selectedPage?.title || "",
                learningGoal: pageContent.learningGoal || "",
                existingActivities: pageContent.sections || [],
                workshopPhases: pageContent.workshopPhases
                  ? {
                      opening: { hook: pageContent.workshopPhases.opening?.hook },
                      miniLesson: { focus: pageContent.workshopPhases.miniLesson?.focus },
                      debrief: {
                        protocol: pageContent.workshopPhases.debrief?.protocol,
                        prompt: pageContent.workshopPhases.debrief?.prompt,
                      },
                    }
                  : undefined,
              });
            }}
            disabled={!selectedPage || suggestionsLoading}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-violet-300 bg-violet-50 text-violet-800 text-[11.5px] font-bold hover:bg-violet-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Get AI suggestions for this lesson"
          >
            {suggestionsLoading ? (
              <div className="animate-spin w-3 h-3 border-2 border-violet-700 border-t-transparent rounded-full" />
            ) : (
              <span>✨</span>
            )}
            {suggestionsLoading ? "Thinking..." : "AI Suggest"}
          </button>

          {/* Save / palette toggle — solid ink */}
          <button
            onClick={() => setPaletteOpen(!paletteOpen)}
            className={`px-2 py-1 rounded-md transition-colors text-[11.5px] font-bold border ${
              paletteOpen
                ? "border-[var(--le-ink)] bg-[var(--le-paper)] text-[var(--le-ink)]"
                : "border-[var(--le-hair)] bg-[var(--le-paper)] text-[var(--le-ink-3)] hover:text-[var(--le-ink)]"
            }`}
            title={paletteOpen ? "Hide block palette" : "Show block palette"}
            aria-label={paletteOpen ? "Hide block palette" : "Show block palette"}
          >
            ▦ Blocks
          </button>

          {/* Version management menu */}
          {enableVersioning && isFork && (
            <div className="relative">
              <button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className="px-2 py-1 rounded-md hover:bg-[var(--le-hair-2)] text-[var(--le-ink-3)] hover:text-[var(--le-ink)] transition-colors text-[14px] leading-none"
                title="Version controls"
                aria-label="Version controls"
              >
                ⋮
              </button>
              {showMoreMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
                  <div className="absolute right-0 mt-1 bg-[var(--le-paper)] rounded-xl border border-[var(--le-hair)] shadow-lg z-50 py-1 w-48">
                    <button
                      onClick={() => { setShowMoreMenu(false); setShowVersionModal(true); }}
                      className="w-full text-left px-3 py-2 text-[12px] text-[var(--le-ink-2)] hover:bg-violet-50 hover:text-violet-800 transition-colors"
                    >
                      Save as Version
                    </button>
                    <button
                      onClick={() => { setShowMoreMenu(false); setShowResetConfirm(true); }}
                      className="w-full text-left px-3 py-2 text-[12px] text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      Reset to Master
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Version Modal ─── */}
      {showVersionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Save as Version</h3>
            <p className="text-sm text-gray-500 mb-4">
              Save your class edits as a new version on the master unit. Other classes can then use this version.
            </p>
            <input
              type="text"
              value={versionLabel}
              onChange={(e) => setVersionLabel(e.target.value)}
              placeholder="Version label (e.g. 'Refined for 2026')"
              maxLength={100}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 mb-4"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleSaveAsVersion(); }}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowVersionModal(false); setVersionLabel(""); }}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAsVersion}
                disabled={savingVersion || !versionLabel.trim()}
                className="px-5 py-2 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                {savingVersion ? "Saving..." : "Save Version"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Reset Confirmation ─── */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Reset to Master?</h3>
            <p className="text-sm text-gray-500 mb-4">
              This will discard all class-specific changes and revert to the master template. Student progress is preserved.
            </p>
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800 mb-4">
              <strong>Tip:</strong> Save as a version first if you might want these changes later.
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleResetToMaster}
                disabled={resetting}
                className="px-5 py-2 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 transition"
              >
                {resetting ? "Resetting..." : "Reset to Master"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Three-Panel Layout ─── */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Sidebar column (thumbnail + lessons) */}
        <div className="w-64 min-w-[256px] border-r border-[var(--le-hair)] bg-[var(--le-paper)] flex flex-col h-full overflow-hidden">
          {/* Unit thumbnail */}
          <div className="px-3 pt-3 pb-2 flex-shrink-0">
            <UnitThumbnailEditor
              unitId={unitId}
              thumbnailUrl={thumbnailUrl}
              unitTitle={unitTitle}
              onThumbnailChange={setThumbnailUrl}
            />
          </div>
          {/* Lesson list (takes remaining height) */}
          <div className="flex-1 min-h-0">
            <LessonSidebar
              pages={pages}
              selectedIndex={selectedPageIndex}
              onSelect={setSelectedPageIndex}
              onReorder={handleReorderPages}
              onAdd={() => addPage()}
              framework={framework}
              editMode={editMode}
              onEditModeChange={setEditMode}
              isFork={isFork}
              versionHistory={versionHistory}
              loadingVersions={loadingVersions}
              onPromoteFork={promoteFork}
              promoting={promoting}
              unitId={unitId}
              classId={classId}
              unitTitle={unitTitle}
              thumbnailUrl={thumbnailUrl}
            />
          </div>
        </div>

        {/* Center: Editor main area */}
        <div className="flex-1 overflow-y-auto">
          {selectedPage && pageContent ? (
            <div className="max-w-5xl mx-auto px-6 py-6">
              {/* ─── Timing Bar (sticky) — or "Add Timing" prompt ─── */}
              {!phases && (
                <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-[var(--le-paper)] border border-dashed border-[var(--le-hair)] rounded-lg">
                  <svg className="w-4 h-4 text-[var(--le-ink-3)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span className="text-[11.5px] text-[var(--le-ink-3)]">No Workshop Model timing on this lesson.</span>
                  <button
                    onClick={() => {
                      handleUpdatePageContent({
                        workshopPhases: {
                          opening: { durationMinutes: 5, hook: "" },
                          miniLesson: { durationMinutes: 10, focus: "" },
                          workTime: { durationMinutes: 22, checkpoints: [] as string[] },
                          debrief: { durationMinutes: 8, protocol: "", prompt: "" },
                        },
                      });
                    }}
                    className="ml-auto text-[11.5px] font-bold text-violet-700 hover:text-violet-900 hover:bg-violet-50 px-2 py-1 rounded-md transition-colors"
                  >
                    + Add Timing
                  </button>
                </div>
              )}
              {/* Dimensions bar (non-sticky) when no timeline exists */}
              {!phases && pageContent?.sections && pageContent.sections.length > 0 && (
                <DimensionsSummaryBar sections={pageContent.sections} phases={phases} udlEnabled={udlEnabled} />
              )}
              {phases && (
                <div className="sticky top-0 z-20 bg-[var(--le-bg)]/95 backdrop-blur-sm pb-3 mb-4 -mx-6 px-6 pt-2 border-b border-[var(--le-hair)]">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="flex-1 flex h-6 rounded-md overflow-hidden border border-[var(--le-hair)]">
                      {(
                        [
                          { key: "opening", label: "Opening", color: "var(--le-phase-opening)", dur: phases.opening.durationMinutes },
                          { key: "miniLesson", label: "Mini-Lesson", color: "var(--le-phase-miniLesson)", dur: phases.miniLesson.durationMinutes },
                          { key: "workTime", label: "Work Time", color: "var(--le-phase-workTime)", dur: phases.workTime.durationMinutes },
                          { key: "debrief", label: "Debrief", color: "var(--le-phase-debrief)", dur: phases.debrief.durationMinutes },
                        ] as const
                      ).map((p) => (
                        <div
                          key={p.key}
                          className="relative flex items-center justify-center text-[9.5px] font-extrabold tracking-widest uppercase text-white cursor-pointer hover:brightness-110 transition-all"
                          style={{
                            background: p.color,
                            width: totalDuration > 0 ? `${(p.dur / totalDuration) * 100}%` : "25%",
                            opacity: p.dur === 0 ? 0.45 : 1,
                          }}
                          onClick={() => {
                            const el = document.getElementById(`phase-${p.key}`);
                            el?.scrollIntoView({ behavior: "smooth", block: "start" });
                          }}
                          title={`${p.label}: ${p.dur} min — click to scroll`}
                        >
                          {p.dur >= 5 && <span>{p.label}</span>}
                        </div>
                      ))}
                    </div>
                    <span
                      className={`text-[11px] font-extrabold le-tnum min-w-[60px] text-right ${
                        totalDuration > 50
                          ? "text-rose-600"
                          : totalDuration > 45
                          ? "text-amber-600"
                          : "text-[var(--le-ink-2)]"
                      }`}
                    >
                      {totalDuration} min
                    </span>
                  </div>
                  {/* ─── Dimensions Summary Bar (sticky with timeline) ─── */}
                  {pageContent?.sections && pageContent.sections.length > 0 && (
                    <DimensionsSummaryBar sections={pageContent.sections} phases={phases} udlEnabled={udlEnabled} />
                  )}
                </div>
              )}

              {/* ─── AI Suggestions Banner ─── */}
              <AnimatePresence>
                {suggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">✨</span>
                        <span className="text-xs font-semibold text-indigo-600">
                          {suggestions.length} AI suggestion{suggestions.length !== 1 ? "s" : ""} for this lesson
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          suggestions.forEach((s) => dismissSuggestion(s.id));
                        }}
                        className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        Dismiss all
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ─── Lesson Header ─── */}
              <LessonHeader
                page={selectedPage}
                onUpdate={handleUpdatePageContent}
              />

              {/* ─── Skills pinned to this lesson ─── */}
              {/* Teacher-side of skill_card_refs. Pinning a card here makes
                  it surface in the student's "Skills for this lesson" panel
                  at the top of the unit page. */}
              <div className="mt-3">
                <LessonSkillsPanel
                  pageId={selectedPage.id}
                  subjectLabel={`${unitTitle ?? "Unit"} · ${selectedPage.title ?? "Lesson"}`}
                />
              </div>

              {/* ─── Opening Phase ─── */}
              {phases && (
                <div id="phase-opening">
                  <PhaseSection
                    phase="opening"
                    phaseDuration={phases.opening.durationMinutes}
                    onDurationChange={(dur) =>
                      handleUpdatePhase("opening", { durationMinutes: dur })
                    }
                    isOpen={openPhases.opening}
                    onToggle={() => togglePhase("opening")}
                  >
                    <div className="space-y-3">
                      <AITextField
                        label="Hook"
                        value={phases.opening.hook || ""}
                        onChange={(val) =>
                          handleUpdatePhase("opening", { hook: val })
                        }
                        placeholder="How will you grab students' attention?"
                        rows={2}
                        aiContext={{
                          field: "hook",
                          lessonTitle: selectedPage?.title || "",
                          learningGoal: pageContent.learningGoal || "",
                          phase: "opening",
                        }}
                        unitId={unitId}
                        classId={classId}
                      />
                      {/* Vocab warmup */}
                      {pageContent.vocabWarmup && (
                        <div className="bg-indigo-50/50 rounded-lg p-3">
                          <span className="text-xs font-medium text-indigo-600">
                            Vocab: {pageContent.vocabWarmup.terms?.map((t: { term: string }) => t.term).join(", ")}
                          </span>
                        </div>
                      )}
                      {/* Drop zone for opening phase */}
                      <DropZone
                        zoneId="opening"
                        onDrop={handleAddActivity}
                        label="Drop block into Opening"
                        accentColor="indigo"
                      />
                      {/* Ghost blocks for opening phase */}
                      <AnimatePresence>
                        {suggestions
                          .filter((s) => s.phase === "opening")
                          .map((suggestion) => (
                            <GhostBlock
                              key={suggestion.id}
                              activity={suggestion.activity}
                              label={suggestion.label}
                              icon={suggestion.icon}
                              reason={suggestion.reason}
                              onAccept={(activity) => {
                                handleAddActivity(activity);
                                acceptSuggestion(suggestion.id);
                              }}
                              onDismiss={() => dismissSuggestion(suggestion.id)}
                            />
                          ))}
                      </AnimatePresence>
                    </div>
                  </PhaseSection>
                </div>
              )}

              {/* ─── Mini-Lesson Phase ─── */}
              {phases && (
                <div id="phase-miniLesson">
                  <PhaseSection
                    phase="miniLesson"
                    phaseDuration={phases.miniLesson.durationMinutes}
                    onDurationChange={(dur) =>
                      handleUpdatePhase("miniLesson", { durationMinutes: dur })
                    }
                    isOpen={openPhases.miniLesson}
                    onToggle={() => togglePhase("miniLesson")}
                  >
                    <div className="space-y-3">
                      <AITextField
                        label="Focus"
                        value={phases.miniLesson.focus || ""}
                        onChange={(val) =>
                          handleUpdatePhase("miniLesson", { focus: val })
                        }
                        placeholder="What are you teaching directly?"
                        rows={2}
                        aiContext={{
                          field: "focus",
                          lessonTitle: selectedPage?.title || "",
                          learningGoal: pageContent.learningGoal || "",
                          phase: "miniLesson",
                        }}
                        unitId={unitId}
                        classId={classId}
                      />
                      {/* Drop zone for miniLesson phase */}
                      <DropZone
                        zoneId="miniLesson"
                        onDrop={handleAddActivity}
                        label="Drop block into Mini-Lesson"
                        accentColor="blue"
                      />
                      {/* Ghost blocks for miniLesson phase */}
                      <AnimatePresence>
                        {suggestions
                          .filter((s) => s.phase === "miniLesson")
                          .map((suggestion) => (
                            <GhostBlock
                              key={suggestion.id}
                              activity={suggestion.activity}
                              label={suggestion.label}
                              icon={suggestion.icon}
                              reason={suggestion.reason}
                              onAccept={(activity) => {
                                handleAddActivity(activity);
                                acceptSuggestion(suggestion.id);
                              }}
                              onDismiss={() => dismissSuggestion(suggestion.id)}
                            />
                          ))}
                      </AnimatePresence>
                    </div>
                  </PhaseSection>
                </div>
              )}

              {/* ─── Work Time Phase (Activities) ─── */}
              <div id="phase-workTime">
                <PhaseSection
                  phase="workTime"
                  phaseDuration={phases?.workTime.durationMinutes || 0}
                  onDurationChange={(dur) =>
                    handleUpdatePhase("workTime", { durationMinutes: dur })
                  }
                  isOpen={openPhases.workTime}
                  onToggle={() => togglePhase("workTime")}
                >
                  <div className="space-y-2">
                    {/* Drop zone for workTime phase */}
                    <DropZone
                      zoneId="workTime"
                      onDrop={handleAddActivity}
                      label="Drop block into Work Time"
                      accentColor="emerald"
                    />
                    {/* Ghost blocks for workTime phase — shown above activities */}
                    <AnimatePresence>
                      {suggestions
                        .filter((s) => s.phase === "workTime")
                        .map((suggestion) => (
                          <GhostBlock
                            key={suggestion.id}
                            activity={suggestion.activity}
                            label={suggestion.label}
                            icon={suggestion.icon}
                            reason={suggestion.reason}
                            onAccept={(activity) => {
                              handleAddActivity(activity);
                              acceptSuggestion(suggestion.id);
                            }}
                            onDismiss={() => dismissSuggestion(suggestion.id)}
                          />
                        ))}
                    </AnimatePresence>

                    {/* Activities with drag-and-drop */}
                    <Reorder.Group
                      axis="y"
                      values={pageContent.sections}
                      onReorder={handleReorderActivities}
                      className="space-y-2"
                    >
                      <AnimatePresence initial={false}>
                        {pageContent.sections.map((section, index) => (
                          <Reorder.Item
                            key={section.activityId || `section-${index}`}
                            value={section}
                            className="list-none"
                            whileDrag={{
                              scale: 1.01,
                              boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                              zIndex: 50,
                            }}
                            layout
                            transition={{
                              type: "spring",
                              damping: 25,
                              stiffness: 300,
                            }}
                          >
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{
                                type: "spring",
                                damping: 20,
                                stiffness: 300,
                              }}
                            >
                              <ActivityBlock
                                activity={section}
                                index={index}
                                framework={framework}
                                udlEnabled={udlEnabled}
                                onUpdate={(partial) =>
                                  handleUpdateActivity(index, partial)
                                }
                                onDelete={() => handleDeleteActivity(index)}
                                onDuplicate={() =>
                                  handleDuplicateActivity(index)
                                }
                              />
                            </motion.div>
                          </Reorder.Item>
                        ))}
                      </AnimatePresence>
                    </Reorder.Group>

                    {/* Activity duration summary + timeWeight distribution */}
                    {pageContent.sections.length > 0 && (
                      <div className="text-xs text-gray-400 text-right py-1 space-y-0.5">
                        <div>
                          Activities total: {activityTotalMinutes} min
                          {phases?.workTime.durationMinutes &&
                            activityTotalMinutes > phases.workTime.durationMinutes && (
                              <span className="text-red-500 ml-1">
                                (over by{" "}
                                {activityTotalMinutes -
                                  phases.workTime.durationMinutes}{" "}
                                min)
                              </span>
                            )}
                        </div>
                        {/* TimeWeight distribution */}
                        {(() => {
                          const weights = pageContent.sections.reduce((acc, s) => {
                            if (s.timeWeight) acc[s.timeWeight] = (acc[s.timeWeight] || 0) + 1;
                            return acc;
                          }, {} as Record<string, number>);
                          const total = Object.values(weights).reduce((a, b) => a + b, 0);
                          if (total === 0) return null;
                          const icons: Record<string, string> = { quick: "⚡", moderate: "📐", extended: "🔬", flexible: "🔄" };
                          return (
                            <div className="flex items-center justify-end gap-2">
                              {Object.entries(weights).map(([w, count]) => (
                                <span key={w} className="inline-flex items-center gap-0.5">
                                  {icons[w]} {count}
                                </span>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Add activity */}
                    <ActivityBlockAdd onAdd={handleAddActivity} />
                  </div>
                </PhaseSection>
              </div>

              {/* ─── Debrief Phase ─── */}
              {phases && (
                <div id="phase-debrief">
                  <PhaseSection
                    phase="debrief"
                    phaseDuration={phases.debrief.durationMinutes}
                    onDurationChange={(dur) =>
                      handleUpdatePhase("debrief", { durationMinutes: dur })
                    }
                    isOpen={openPhases.debrief}
                    onToggle={() => togglePhase("debrief")}
                  >
                    <div className="space-y-3">
                      <AITextField
                        label="Protocol"
                        value={phases.debrief.protocol || ""}
                        onChange={(val) =>
                          handleUpdatePhase("debrief", { protocol: val })
                        }
                        placeholder="Think-Pair-Share, Gallery Walk, Exit Ticket..."
                        rows={1}
                        aiContext={{
                          field: "protocol",
                          lessonTitle: selectedPage?.title || "",
                          learningGoal: pageContent.learningGoal || "",
                          phase: "debrief",
                        }}
                        unitId={unitId}
                        classId={classId}
                      />
                      <AITextField
                        label="Prompt"
                        value={phases.debrief.prompt || ""}
                        onChange={(val) =>
                          handleUpdatePhase("debrief", { prompt: val })
                        }
                        placeholder="What question will you ask students to reflect on?"
                        rows={2}
                        aiContext={{
                          field: "prompt",
                          lessonTitle: selectedPage?.title || "",
                          learningGoal: pageContent.learningGoal || "",
                          phase: "debrief",
                        }}
                        unitId={unitId}
                        classId={classId}
                      />
                      {/* Drop zone for debrief phase */}
                      <DropZone
                        zoneId="debrief"
                        onDrop={handleAddActivity}
                        label="Drop block into Debrief"
                        accentColor="amber"
                      />
                      {/* Ghost blocks for debrief phase */}
                      <AnimatePresence>
                        {suggestions
                          .filter((s) => s.phase === "debrief")
                          .map((suggestion) => (
                            <GhostBlock
                              key={suggestion.id}
                              activity={suggestion.activity}
                              label={suggestion.label}
                              icon={suggestion.icon}
                              reason={suggestion.reason}
                              onAccept={(activity) => {
                                handleAddActivity(activity);
                                acceptSuggestion(suggestion.id);
                              }}
                              onDismiss={() => dismissSuggestion(suggestion.id)}
                            />
                          ))}
                      </AnimatePresence>
                    </div>
                  </PhaseSection>
                </div>
              )}

              {/* ─── Extensions ─── */}
              <div className="mt-6 mb-12">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[14px]">🚀</span>
                  <div className="text-[12.5px] font-extrabold text-[var(--le-ink)]">
                    Extensions
                  </div>
                  <div className="text-[10.5px] text-[var(--le-ink-3)] italic">
                    for early finishers · optional
                  </div>
                  <button
                    onClick={handleAddExtension}
                    className="ml-auto text-[11px] font-bold text-[var(--le-ink-3)] hover:text-[var(--le-ink)] transition-colors"
                  >
                    + Add extension
                  </button>
                </div>

                <div className="rounded-lg border border-[var(--le-hair)] bg-amber-50/30 overflow-hidden">
                  <AnimatePresence initial={false}>
                    {(pageContent.extensions || []).length === 0 ? (
                      <div className="px-3 py-3 text-[11.5px] italic text-[var(--le-ink-3)]">
                        No extensions yet.
                      </div>
                    ) : (
                      (pageContent.extensions || []).map((ext, index) => (
                        <motion.div
                          key={`ext-${index}`}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{
                            type: "spring",
                            damping: 20,
                            stiffness: 300,
                          }}
                        >
                          <ExtensionBlock
                            extension={ext}
                            index={index}
                            framework={framework}
                            onUpdate={(partial) =>
                              handleUpdateExtension(index, partial)
                            }
                            onDelete={() => handleDeleteExtension(index)}
                          />
                        </motion.div>
                      ))
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          ) : (
            /* No lesson selected */
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-400">
                <div className="text-4xl mb-3">📝</div>
                <p className="text-sm">
                  {pages.length === 0
                    ? "No lessons yet. Click \"Add Lesson\" to get started."
                    : "Select a lesson from the sidebar to start editing."}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right: Block Palette */}
        <AnimatePresence>
          {paletteOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 300, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="border-l border-[var(--le-hair)] bg-[var(--le-paper)] overflow-hidden flex-shrink-0"
            >
              <div className="w-[300px] h-full overflow-y-auto">
                <BlockPalette
                  onAddBlock={handleAddActivity}
                  suggestedBlockIds={suggestedBlockIds}
                  isOpen={paletteOpen}
                  onToggle={() => setPaletteOpen(!paletteOpen)}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
    </DndProvider>
  );
}
