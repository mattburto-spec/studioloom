"use client";

import { Reorder, AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { getDesignProcessPhases } from "@/lib/constants";
import type { UnitPage } from "@/types";

type EditMode = "all" | "class";

interface VersionEntry {
  version: number;
  label: string;
  created_at: string;
  source_class_id: string | null;
  sourceClassName: string | null;
}

interface LessonSidebarProps {
  pages: UnitPage[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onReorder: (newOrder: UnitPage[]) => void;
  onAdd: () => void;

  // Framework for design phases
  framework?: string | null;

  // Edit mode
  editMode: EditMode;
  onEditModeChange: (mode: EditMode) => void;
  isFork: boolean;

  // Version history
  versionHistory: VersionEntry[];
  loadingVersions: boolean;

  // Promote fork
  onPromoteFork: (saveVersionFirst: boolean) => Promise<boolean>;
  promoting: boolean;

  // Settings link
  unitId: string;
  classId: string;

  // Unit info
  unitTitle?: string | null;
  thumbnailUrl?: string | null;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function LessonSidebar({
  pages,
  selectedIndex,
  onSelect,
  onReorder,
  onAdd,
  framework,
  editMode,
  onEditModeChange,
  isFork,
  versionHistory,
  loadingVersions,
  onPromoteFork,
  promoting,
  unitId,
  classId,
  unitTitle,
  thumbnailUrl,
}: LessonSidebarProps) {
  const [showPromoteConfirm, setShowPromoteConfirm] = useState(false);
  const { colors: PHASE_COLORS } = getDesignProcessPhases(framework);

  // Group pages by phaseLabel for visual grouping
  let lastPhase = "";

  // Last 3 versions for sidebar display
  const recentVersions = versionHistory.slice(-3).reverse();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Unit title strip — cover lives in UnitThumbnailEditor above this component */}
      {unitTitle && (
        <div className="px-3 pt-2 pb-2 border-b border-[var(--le-hair)] flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px]">🎒</span>
            <div className="text-[11.5px] font-extrabold truncate text-[var(--le-ink)]">
              {unitTitle}
            </div>
          </div>
        </div>
      )}

      {/* ─── EDITING MODE ─── */}
      <div className="px-3 py-2.5 border-b border-[var(--le-hair)] flex-shrink-0">
        <div className="le-cap text-[var(--le-ink-3)] mb-2">Editing</div>
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="radio"
              name="editMode"
              value="all"
              checked={editMode === "all"}
              onChange={() => onEditModeChange("all")}
              className="w-3.5 h-3.5 text-violet-600 border-[var(--le-hair)] focus:ring-violet-500"
            />
            <span
              className={`text-[12px] ${
                editMode === "all"
                  ? "font-semibold text-[var(--le-ink)]"
                  : "text-[var(--le-ink-2)] group-hover:text-[var(--le-ink)]"
              }`}
            >
              All classes
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="radio"
              name="editMode"
              value="class"
              checked={editMode === "class"}
              onChange={() => onEditModeChange("class")}
              className="w-3.5 h-3.5 text-violet-600 border-[var(--le-hair)] focus:ring-violet-500"
            />
            <span
              className={`text-[12px] ${
                editMode === "class"
                  ? "font-semibold text-[var(--le-ink)]"
                  : "text-[var(--le-ink-2)] group-hover:text-[var(--le-ink)]"
              }`}
            >
              This class only
            </span>
          </label>
        </div>

        {/* Context note */}
        {editMode === "all" && isFork && (
          <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-[11px] text-amber-700 leading-tight">
              This class has its own version. Changes here won&apos;t affect it.{" "}
              <button
                onClick={() => onEditModeChange("class")}
                className="underline font-medium hover:text-amber-900"
              >
                Switch to &quot;This class only&quot;
              </button>
            </p>
          </div>
        )}

        {editMode === "all" && (
          <p className="mt-2 text-[11px] text-[var(--le-ink-3)] leading-tight">
            Changes update the unit template. Customized classes keep their own version.
          </p>
        )}

        {editMode === "class" && isFork && (
          <div className="mt-2 flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M6 3v12" />
                <path d="M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
                <path d="M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
                <path d="M18 9c0 9-12 6-12 12" />
              </svg>
              Customized
            </span>
          </div>
        )}
      </div>

      {/* ─── LESSONS header ─── */}
      <div className="px-3 py-2 border-b border-[var(--le-hair)] flex-shrink-0 flex items-center justify-between">
        <h3 className="le-cap text-[var(--le-ink-3)]">Lessons</h3>
        <button
          onClick={onAdd}
          className="text-[10px] font-extrabold tracking-wider px-1.5 py-0.5 rounded border border-violet-300 text-violet-700 bg-[var(--le-paper)] hover:bg-violet-50 transition-colors"
          title="Add a new lesson"
        >
          + New
        </button>
      </div>

      {/* Scrollable lesson list */}
      <div className="flex-1 overflow-y-auto py-2">
        <Reorder.Group
          axis="y"
          values={pages}
          onReorder={onReorder}
          className="space-y-0.5 px-2"
        >
          <AnimatePresence initial={false}>
            {pages.map((page, index) => {
              const phase = page.phaseLabel || page.content?.sections?.[0]?.criterionTags?.[0] || "";
              const showPhaseHeader = phase && phase !== lastPhase;
              if (phase) lastPhase = phase;

              return (
                <div key={page.id}>
                  {showPhaseHeader && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="px-2 pt-3 pb-1"
                    >
                      <span
                        className={`text-[10px] font-extrabold uppercase tracking-widest ${
                          PHASE_COLORS[phase.toLowerCase()] || "text-[var(--le-ink-3)]"
                        }`}
                      >
                        {phase}
                      </span>
                    </motion.div>
                  )}
                  <Reorder.Item
                    value={page}
                    id={page.id}
                    className="list-none"
                    whileDrag={{
                      scale: 1.02,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                      zIndex: 50,
                    }}
                  >
                    <button
                      onClick={() => onSelect(index)}
                      className={`w-full text-left px-2 py-1.5 rounded-md transition-colors group flex items-start gap-2 ${
                        selectedIndex === index
                          ? "bg-violet-50 ring-1 ring-violet-200"
                          : "hover:bg-[var(--le-hair-2)]"
                      }`}
                    >
                      {/* Lesson number circle */}
                      <span
                        className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-extrabold flex-shrink-0 ${
                          selectedIndex === index
                            ? "bg-violet-600 text-white"
                            : "bg-[var(--le-hair-2)] text-[var(--le-ink-2)]"
                        }`}
                      >
                        {index + 1}
                      </span>

                      {/* Lesson title */}
                      <span
                        className={`text-[11.5px] leading-[1.25] flex-1 truncate ${
                          selectedIndex === index
                            ? "font-extrabold text-[var(--le-ink)]"
                            : "font-semibold text-[var(--le-ink-2)]"
                        }`}
                      >
                        {page.content?.title || page.title || `Lesson ${index + 1}`}
                      </span>

                      {/* Active pulse */}
                      {selectedIndex === index && (
                        <span
                          className="mt-1 inline-block w-1.5 h-1.5 rounded-full bg-violet-600 flex-shrink-0"
                          style={{ boxShadow: "0 0 0 3px rgba(147, 51, 234, 0.13)" }}
                        />
                      )}
                    </button>
                  </Reorder.Item>
                </div>
              );
            })}
          </AnimatePresence>
        </Reorder.Group>
      </div>

      {/* ─── HISTORY ─── */}
      <div className="px-3 py-2.5 border-t border-[var(--le-hair)] flex-shrink-0">
        <h3 className="le-cap text-[var(--le-ink-3)] mb-2">History</h3>
        {loadingVersions ? (
          <div className="text-[11px] text-[var(--le-ink-3)]">Loading...</div>
        ) : recentVersions.length === 0 ? (
          <div className="text-[11px] text-[var(--le-ink-3)]">No versions yet</div>
        ) : (
          <div className="space-y-1">
            {recentVersions.map((v) => (
              <div
                key={v.version}
                className="flex items-center justify-between text-[11px] group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[var(--le-ink-3)] flex-shrink-0">
                    {formatDate(v.created_at)}
                  </span>
                  <span className="text-[var(--le-ink-2)] truncate">
                    {v.label || v.sourceClassName || "Saved"}
                  </span>
                </div>
                <button
                  className="opacity-0 group-hover:opacity-100 text-[var(--le-ink-3)] hover:text-violet-700 transition-opacity flex-shrink-0 ml-1"
                  title="Restore this version"
                >
                  ↺
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── BOTTOM ACTIONS ─── */}
      <div className="px-3 py-3 border-t border-[var(--le-hair)] flex-shrink-0 space-y-2">
        {/* Settings link */}
        <a
          href={`/teacher/units/${unitId}/class/${classId}`}
          className="flex items-center gap-2 text-[12px] text-[var(--le-ink-2)] hover:text-[var(--le-ink)] transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          Class Settings
        </a>

        {/* Apply to All Classes button — only when fork exists and in "class" mode */}
        {isFork && editMode === "class" && (
          <>
            {!showPromoteConfirm ? (
              <button
                onClick={() => setShowPromoteConfirm(true)}
                disabled={promoting}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition-all disabled:opacity-50"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19V5" /><path d="M5 12l7-7 7 7" />
                </svg>
                Apply to All Classes
              </button>
            ) : (
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg space-y-2">
                <p className="text-xs text-indigo-700 leading-tight font-medium">
                  This will update the master template with this class&apos;s content. Other classes with their own customizations won&apos;t be affected.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      await onPromoteFork(true);
                      setShowPromoteConfirm(false);
                    }}
                    disabled={promoting}
                    className="flex-1 px-2 py-1.5 rounded text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {promoting ? "Applying..." : "Save version first"}
                  </button>
                  <button
                    onClick={async () => {
                      await onPromoteFork(false);
                      setShowPromoteConfirm(false);
                    }}
                    disabled={promoting}
                    className="flex-1 px-2 py-1.5 rounded text-xs font-medium text-indigo-600 bg-white border border-indigo-200 hover:bg-indigo-50 disabled:opacity-50 transition-colors"
                  >
                    Apply directly
                  </button>
                </div>
                <button
                  onClick={() => setShowPromoteConfirm(false)}
                  className="w-full text-xs text-gray-400 hover:text-gray-600"
                >
                  Cancel
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
