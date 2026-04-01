"use client";

import { useState, useRef, useCallback } from "react";
import type { PageContent, ResponseType, WorkshopPhases, LessonExtension } from "@/types";
import type { WizardDispatch } from "@/hooks/useWizardState";
import type { LessonPulseScore } from "@/lib/layers/lesson-pulse";
import PhaseTimelineBar, { type PhaseConfig, type OverheadConfig, buildDefaultPhases } from "@/components/lesson-timing/PhaseTimelineBar";
import PulseGauges from "@/components/teacher/wizard/PulseGauge";

interface Props {
  pageId: string;
  content: PageContent;
  color: string;
  isExpanded: boolean;
  dispatch: WizardDispatch;
  onActivityDrop?: (pageId: string, activityId: string) => void;
  onRegeneratePage?: (pageId: string) => void;
  /** Period length in minutes for timing bar (default 60) */
  periodMinutes?: number;
  /** Max instruction minutes from 1+age rule (default 14) */
  instructionCap?: number;
  /** Lesson Pulse quality scores */
  pulseScore?: LessonPulseScore | null;
}

const RESPONSE_TYPE_OPTIONS: { value: ResponseType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "upload", label: "Upload" },
  { value: "voice", label: "Voice" },
  { value: "link", label: "Link" },
  { value: "multi", label: "Multi-type" },
  { value: "decision-matrix", label: "Decision Matrix" },
  { value: "pmi", label: "PMI" },
  { value: "pairwise", label: "Pairwise" },
  { value: "trade-off-sliders", label: "Trade-off Sliders" },
];

const MIN_SECTION_MINUTES = 5;

// Spanner/wrench edit icon
function EditIcon({ onClick, title }: { onClick: () => void; title: string }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="opacity-0 group-hover/editable:opacity-100 focus:opacity-100 transition-opacity p-1 rounded-md hover:bg-brand-purple/10"
      title={title}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-brand-purple">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    </button>
  );
}

// Clock icon with drag handle for time adjustment
function DraggableTime({
  minutes,
  color,
  onAdjust,
}: {
  minutes: number;
  color: string;
  onAdjust: (delta: number) => void;
}) {
  const dragStartY = useRef<number | null>(null);
  const accumulatedDelta = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    dragStartY.current = e.clientY;
    accumulatedDelta.current = 0;
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (dragStartY.current === null) return;
    const diff = dragStartY.current - e.clientY; // up = positive = more time
    const stepPx = 12; // pixels per 5-minute step
    const steps = Math.round(diff / stepPx);
    const newDelta = steps * 5;
    if (newDelta !== accumulatedDelta.current) {
      onAdjust(newDelta - accumulatedDelta.current);
      accumulatedDelta.current = newDelta;
    }
  }, [onAdjust]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    dragStartY.current = null;
    accumulatedDelta.current = 0;
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

  return (
    <span
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`text-[9px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 select-none touch-none transition-all ${
        isDragging
          ? "ring-2 ring-brand-purple/30 bg-brand-purple/10 text-brand-purple font-semibold scale-110"
          : "bg-gray-100 text-text-tertiary hover:bg-gray-200 cursor-ns-resize"
      }`}
      title="Drag up/down to adjust time"
    >
      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
      {minutes}m
    </span>
  );
}

// Visual time breakdown bar
function TimeBar({ sections, color }: { sections: PageContent["sections"]; color: string }) {
  const total = sections.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
  if (total === 0) return null;

  const colors = [
    color + "60",
    color + "40",
    color + "80",
    color + "30",
  ];

  return (
    <div className="flex rounded-full overflow-hidden h-1.5 bg-gray-100">
      {sections.map((s, i) => {
        const pct = ((s.durationMinutes || 0) / total) * 100;
        if (pct === 0) return null;
        return (
          <div
            key={i}
            className="transition-all duration-300"
            style={{ width: `${pct}%`, backgroundColor: colors[i % colors.length] }}
            title={`${s.durationMinutes}m`}
          />
        );
      })}
    </div>
  );
}

export function JourneyLessonCard({ pageId, content, color, isExpanded, dispatch, onActivityDrop, onRegeneratePage, periodMinutes = 60, instructionCap = 14, pulseScore }: Props) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<number | null>(null);

  const toggleExpanded = () => {
    dispatch({ type: "TOGGLE_EXPANDED_PAGE", pageId });
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("application/questerra-activity")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const activityId = e.dataTransfer.getData("application/questerra-activity");
    if (activityId && onActivityDrop) {
      onActivityDrop(pageId, activityId);
    }
  };

  // Adjust one section's time and rebalance others within the same lesson total
  const handleTimeAdjust = useCallback((sectionIndex: number, delta: number) => {
    const sections = content.sections;
    const totalMinutes = sections.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
    if (totalMinutes === 0) return; // no timing data

    const current = sections[sectionIndex].durationMinutes || 0;
    const newValue = Math.max(MIN_SECTION_MINUTES, current + delta);
    const actualDelta = newValue - current;
    if (actualDelta === 0) return;

    // Distribute the opposite delta across other sections proportionally
    const otherIndices = sections
      .map((s, i) => i)
      .filter(i => i !== sectionIndex && (s => (s.durationMinutes || 0) > MIN_SECTION_MINUTES)(sections[i]));

    if (otherIndices.length === 0) return;

    const otherTotal = otherIndices.reduce((sum, i) => sum + (sections[i].durationMinutes || 0), 0);
    const newSections = sections.map((s, i) => {
      if (i === sectionIndex) return { ...s, durationMinutes: newValue };
      if (!otherIndices.includes(i)) return s;
      const proportion = (s.durationMinutes || 0) / otherTotal;
      const reduction = Math.round(actualDelta * proportion);
      return { ...s, durationMinutes: Math.max(MIN_SECTION_MINUTES, (s.durationMinutes || 0) - reduction) };
    });

    dispatch({ type: "UPDATE_PAGE", pageId, page: { ...content, sections: newSections } });
  }, [content, dispatch, pageId]);

  // Collapsed: clean — just title + learning goal + chevron
  if (!isExpanded) {
    return (
      <button
        onClick={toggleExpanded}
        className={`w-full text-left rounded-xl border transition-all duration-200 overflow-hidden ${
          isDragOver
            ? "border-brand-purple border-dashed bg-brand-purple/5 shadow-lg"
            : "border-gray-200/80 hover:shadow-md"
        }`}
        style={{ backgroundColor: color + "0A", borderLeftWidth: "3px", borderLeftColor: color }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">{content.title}</p>
            {content.learningGoal && (
              <p className="text-[11px] text-text-secondary mt-0.5 line-clamp-1">{content.learningGoal}</p>
            )}
          </div>
          {pulseScore && (
            <PulseGauges pulse={pulseScore} variant="compact" />
          )}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-tertiary flex-shrink-0">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </button>
    );
  }

  // Expanded: content-first with inline edit icons + draggable time
  return (
    <div
      className={`rounded-xl border transition-all duration-200 overflow-hidden ${
        isDragOver
          ? "border-brand-purple border-dashed bg-brand-purple/5 shadow-lg"
          : "border-gray-200/80 shadow-md"
      }`}
      style={{ backgroundColor: color + "08", borderLeftWidth: "3px", borderLeftColor: color }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Color accent bar at top */}
      <div className="h-1" style={{ backgroundColor: color + "50" }} />

      <div className="p-4 space-y-3">
        {/* Title — editable on click */}
        <div className="group/editable flex items-start gap-2">
          {editingField === "title" ? (
            <input
              type="text"
              value={content.title}
              onChange={(e) =>
                dispatch({ type: "UPDATE_PAGE", pageId, page: { ...content, title: e.target.value } })
              }
              onBlur={() => setEditingField(null)}
              onKeyDown={(e) => e.key === "Enter" && setEditingField(null)}
              autoFocus
              className="flex-1 px-2 py-1 border border-brand-purple/30 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-purple/20"
            />
          ) : (
            <>
              <h4 className="flex-1 text-sm font-semibold text-text-primary">{content.title}</h4>
              <EditIcon onClick={() => setEditingField("title")} title="Edit title" />
            </>
          )}
          {/* Collapse button */}
          <button onClick={toggleExpanded} className="p-1 rounded-md hover:bg-gray-100 flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-tertiary rotate-180">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>

        {/* Learning goal */}
        {content.learningGoal && (
          <div className="group/editable flex items-start gap-2">
            {editingField === "goal" ? (
              <textarea
                value={content.learningGoal}
                onChange={(e) =>
                  dispatch({ type: "UPDATE_PAGE", pageId, page: { ...content, learningGoal: e.target.value } })
                }
                onBlur={() => setEditingField(null)}
                autoFocus
                rows={2}
                className="flex-1 px-2 py-1 border border-brand-purple/30 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-purple/20 resize-none"
              />
            ) : (
              <>
                <p className="flex-1 text-xs text-text-secondary leading-relaxed">{content.learningGoal}</p>
                <EditIcon onClick={() => setEditingField("goal")} title="Edit learning goal" />
              </>
            )}
          </div>
        )}

        {/* Lesson Pulse scores — shows when pulse data exists */}
        {pulseScore && (
          <div className="pt-1">
            <PulseGauges pulse={pulseScore} variant="expanded" />
          </div>
        )}

        {/* Workshop Phase Timeline Bar — shows when workshopPhases data exists */}
        {content.workshopPhases && (() => {
          const wp = content.workshopPhases!;
          const overhead: OverheadConfig = { transitionMinutes: 3, setupMinutes: 0, cleanupMinutes: 0, isWorkshop: false };
          const phases: PhaseConfig[] = [
            { id: "opening", label: "Opening", shortLabel: "Open", color: "#7C3AED", bgColor: "#F3E8FF", borderColor: "#C4B5FD", durationMinutes: wp.opening.durationMinutes, minMinutes: 3, locked: false },
            { id: "miniLesson", label: "Mini-Lesson", shortLabel: "Teach", color: "#2563EB", bgColor: "#DBEAFE", borderColor: "#93C5FD", durationMinutes: wp.miniLesson.durationMinutes, minMinutes: 3, locked: false },
            { id: "workTime", label: "Work Time", shortLabel: "Work", color: "#16A34A", bgColor: "#DCFCE7", borderColor: "#86EFAC", durationMinutes: wp.workTime.durationMinutes, minMinutes: 15, locked: false },
            { id: "debrief", label: "Debrief", shortLabel: "Debrief", color: "#D97706", bgColor: "#FEF3C7", borderColor: "#FCD34D", durationMinutes: wp.debrief.durationMinutes, minMinutes: 5, locked: false },
          ];
          return (
            <div className="pt-1 pb-2">
              <PhaseTimelineBar
                periodMinutes={periodMinutes}
                phases={phases}
                overhead={overhead}
                instructionCap={instructionCap}
                onPhasesChange={(newPhases) => {
                  const updated: WorkshopPhases = {
                    opening: { ...wp.opening, durationMinutes: newPhases.find(p => p.id === "opening")!.durationMinutes },
                    miniLesson: { ...wp.miniLesson, durationMinutes: newPhases.find(p => p.id === "miniLesson")!.durationMinutes },
                    workTime: { ...wp.workTime, durationMinutes: newPhases.find(p => p.id === "workTime")!.durationMinutes },
                    debrief: { ...wp.debrief, durationMinutes: newPhases.find(p => p.id === "debrief")!.durationMinutes },
                  };
                  dispatch({ type: "UPDATE_PAGE", pageId, page: { ...content, workshopPhases: updated } });
                }}
              />
            </div>
          );
        })()}

        {/* Extensions — collapsible early finisher activities */}
        {content.extensions && content.extensions.length > 0 && (
          <details className="text-xs">
            <summary className="text-text-tertiary cursor-pointer hover:text-brand-purple transition-colors py-1">
              {content.extensions.length} extension{content.extensions.length > 1 ? "s" : ""} for early finishers
            </summary>
            <div className="pl-3 pt-1 space-y-1">
              {content.extensions.map((ext, i) => (
                <div key={i} className="flex items-start gap-2 text-text-secondary">
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 whitespace-nowrap">{ext.durationMinutes}m</span>
                  <span>{ext.title}</span>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* Sections — show content with draggable time */}
        <div className="space-y-2 pt-1">
          {content.sections.map((section, si) => (
            <div key={si} className="group/editable relative">
              {editingSection === si ? (
                <div className="space-y-2 bg-white rounded-lg p-3 border border-brand-purple/20">
                  <textarea
                    value={section.prompt}
                    onChange={(e) => {
                      const newSections = [...content.sections];
                      newSections[si] = { ...section, prompt: e.target.value };
                      dispatch({ type: "UPDATE_PAGE", pageId, page: { ...content, sections: newSections } });
                    }}
                    rows={3}
                    autoFocus
                    className="w-full px-2 py-1.5 border border-border rounded text-xs focus:outline-none focus:ring-1 focus:ring-brand-purple/30 resize-none"
                  />
                  <div className="flex items-center gap-2">
                    <select
                      value={section.responseType}
                      onChange={(e) => {
                        const newSections = [...content.sections];
                        newSections[si] = { ...section, responseType: e.target.value as ResponseType };
                        dispatch({ type: "UPDATE_PAGE", pageId, page: { ...content, sections: newSections } });
                      }}
                      className="text-[10px] text-text-secondary bg-white border border-border rounded px-2 py-1 focus:outline-none"
                    >
                      {RESPONSE_TYPE_OPTIONS.map((rt) => (
                        <option key={rt.value} value={rt.value}>{rt.label}</option>
                      ))}
                    </select>
                    {/* Move / Delete controls */}
                    <div className="flex items-center gap-1 ml-auto">
                      {si > 0 && (
                        <button
                          onClick={() => dispatch({ type: "REORDER_SECTIONS", pageId, fromIndex: si, toIndex: si - 1 })}
                          className="w-6 h-6 flex items-center justify-center text-text-tertiary hover:text-text-primary rounded hover:bg-gray-100"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 15l-6-6-6 6" /></svg>
                        </button>
                      )}
                      {si < content.sections.length - 1 && (
                        <button
                          onClick={() => dispatch({ type: "REORDER_SECTIONS", pageId, fromIndex: si, toIndex: si + 1 })}
                          className="w-6 h-6 flex items-center justify-center text-text-tertiary hover:text-text-primary rounded hover:bg-gray-100"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6" /></svg>
                        </button>
                      )}
                      {content.sections.length > 1 && (
                        <button
                          onClick={() => { if (window.confirm(`Delete this section?`)) dispatch({ type: "DELETE_SECTION", pageId, sectionIndex: si }); }}
                          className="w-6 h-6 flex items-center justify-center text-text-tertiary hover:text-red-500 rounded hover:bg-red-50"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => setEditingSection(null)}
                      className="text-[10px] text-brand-purple font-medium px-2 py-1 rounded hover:bg-brand-purple/10"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-lg px-3 py-2 hover:bg-white/60 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-text-primary leading-relaxed">{section.prompt}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {section.durationMinutes && (
                        <DraggableTime
                          minutes={section.durationMinutes}
                          color={color}
                          onAdjust={(delta) => handleTimeAdjust(si, delta)}
                        />
                      )}
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-text-tertiary capitalize">
                        {section.responseType === "text" ? "Written" : section.responseType}
                      </span>
                      {section.criterionTags?.map(tag => (
                        <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-brand-purple/10 text-brand-purple font-medium">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <EditIcon onClick={() => setEditingSection(si)} title="Edit section" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Time breakdown bar */}
        <TimeBar sections={content.sections} color={color} />

        {/* Bottom actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-border/50">
          <button
            onClick={() => dispatch({ type: "ADD_SECTION", pageId })}
            className="text-[10px] text-text-tertiary hover:text-brand-purple transition px-2 py-1 rounded hover:bg-brand-purple/5"
          >
            + Add section
          </button>
          <div className="flex-1" />
          {onRegeneratePage && (
            <button
              onClick={() => onRegeneratePage(pageId)}
              className="text-[10px] text-text-tertiary hover:text-brand-purple transition px-2 py-1 rounded hover:bg-brand-purple/5 flex items-center gap-1"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 4v6h6M23 20v-6h-6" />
                <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
              </svg>
              Regenerate
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
