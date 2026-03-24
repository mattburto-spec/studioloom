"use client";

import { Reorder, AnimatePresence, motion } from "framer-motion";
import type { UnitPage } from "@/types";

interface LessonSidebarProps {
  pages: UnitPage[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onReorder: (newOrder: UnitPage[]) => void;
  onAdd: () => void;
}

const PHASE_COLORS: Record<string, string> = {
  investigation: "text-indigo-600",
  creation: "text-emerald-600",
  evaluation: "text-amber-600",
  research: "text-indigo-600",
  ideation: "text-emerald-600",
  prototyping: "text-orange-600",
  testing: "text-amber-600",
};

export function LessonSidebar({
  pages,
  selectedIndex,
  onSelect,
  onReorder,
  onAdd,
}: LessonSidebarProps) {
  // Group pages by phaseLabel for visual grouping
  let lastPhase = "";

  return (
    <div className="w-64 min-w-[256px] border-r border-gray-200 bg-gray-50/50 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Lessons
        </h3>
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
                        className={`text-[10px] font-bold uppercase tracking-wider ${
                          PHASE_COLORS[phase.toLowerCase()] || "text-gray-500"
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
                      className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all group flex items-center gap-2 ${
                        selectedIndex === index
                          ? "bg-indigo-50 border-l-2 border-indigo-500 text-indigo-900 font-medium"
                          : "hover:bg-gray-100 text-gray-700 border-l-2 border-transparent"
                      }`}
                    >
                      {/* Drag handle */}
                      <span className="opacity-0 group-hover:opacity-40 cursor-grab active:cursor-grabbing text-gray-400 flex-shrink-0 select-none">
                        ⠿
                      </span>

                      {/* Lesson number + title */}
                      <span className="truncate flex-1 min-w-0">
                        <span className="text-gray-400 mr-1.5">{index + 1}.</span>
                        {page.content?.title || page.title || `Lesson ${index + 1}`}
                      </span>

                      {/* Active dot */}
                      {selectedIndex === index && (
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
                      )}
                    </button>
                  </Reorder.Item>
                </div>
              );
            })}
          </AnimatePresence>
        </Reorder.Group>
      </div>

      {/* Add lesson button */}
      <div className="p-3 border-t border-gray-200 flex-shrink-0">
        <button
          onClick={onAdd}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Lesson
        </button>
      </div>
    </div>
  );
}
