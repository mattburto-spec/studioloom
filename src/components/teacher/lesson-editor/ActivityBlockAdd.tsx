"use client";

import { useState, type DragEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { nanoid } from "nanoid";
import { useDndContext } from "./DndContext";
import type {
  ActivitySection,
  ResponseType,
  BloomLevel,
  TimeWeight,
  GroupingStrategy,
  ActivityAIRules,
} from "@/types";

interface ActivityBlockAddProps {
  onAdd: (activity: ActivitySection) => void;
}

interface ActivityTemplate {
  label: string;
  icon: string;
  responseType: ResponseType;
  defaultPrompt: string;
  defaultDuration: number;
  bloom_level?: BloomLevel;
  timeWeight?: TimeWeight;
  grouping?: GroupingStrategy;
  ai_rules?: ActivityAIRules;
}

const TEMPLATES: ActivityTemplate[] = [
  {
    label: "Written Response",
    icon: "📝",
    responseType: "text",
    defaultPrompt: "",
    defaultDuration: 10,
    bloom_level: "apply",
    timeWeight: "moderate",
    grouping: "individual",
    ai_rules: { phase: "neutral" },
  },
  {
    label: "Creative Upload",
    icon: "🎨",
    responseType: "upload",
    defaultPrompt: "Upload your work.",
    defaultDuration: 15,
    bloom_level: "create",
    timeWeight: "extended",
    grouping: "individual",
    ai_rules: { phase: "divergent" },
  },
  {
    label: "Voice Recording",
    icon: "🎤",
    responseType: "voice",
    defaultPrompt: "Record your explanation.",
    defaultDuration: 5,
    bloom_level: "understand",
    timeWeight: "quick",
    grouping: "individual",
  },
  {
    label: "Canvas Drawing",
    icon: "🖼️",
    responseType: "canvas",
    defaultPrompt: "Sketch your idea.",
    defaultDuration: 10,
    bloom_level: "create",
    timeWeight: "moderate",
    grouping: "individual",
    ai_rules: { phase: "divergent" },
  },
  {
    label: "Decision Matrix",
    icon: "📊",
    responseType: "decision-matrix" as ResponseType,
    defaultPrompt: "Compare your options using the criteria below.",
    defaultDuration: 15,
    bloom_level: "evaluate",
    timeWeight: "extended",
    grouping: "individual",
    ai_rules: { phase: "convergent" },
  },
  {
    label: "Content Block",
    icon: "📋",
    responseType: undefined as unknown as ResponseType,
    defaultPrompt: "Read the following information carefully.",
    defaultDuration: 5,
    bloom_level: "remember",
    timeWeight: "quick",
    grouping: "whole_class",
  },
  {
    label: "Toolkit Tool",
    icon: "#",
    responseType: "toolkit-tool" as ResponseType,
    defaultPrompt: "Use the tool below to work through this activity.",
    defaultDuration: 15,
    bloom_level: "apply",
    timeWeight: "extended",
    grouping: "individual",
    ai_rules: { phase: "divergent" },
  },
];

export function ActivityBlockAdd({ onAdd }: ActivityBlockAddProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isOver, setIsOver] = useState(false);
  const { isDragging, payload, endDrag } = useDndContext();

  const handleSelect = (template: ActivityTemplate) => {
    const activity: ActivitySection = {
      activityId: nanoid(8),
      prompt: template.defaultPrompt,
      durationMinutes: template.defaultDuration,
      ...(template.responseType ? { responseType: template.responseType } : {}),
      ...(template.bloom_level ? { bloom_level: template.bloom_level } : {}),
      ...(template.timeWeight ? { timeWeight: template.timeWeight } : {}),
      ...(template.grouping ? { grouping: template.grouping } : {}),
      ...(template.ai_rules ? { ai_rules: template.ai_rules } : {}),
    };
    onAdd(activity);
    setIsOpen(false);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (!isOver) setIsOver(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsOver(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsOver(false);

    // Prefer in-page DnD context payload
    if (payload) {
      const activity: ActivitySection = {
        ...payload.activity,
        activityId: payload.activity.activityId || nanoid(8),
      };
      onAdd(activity);
      endDrag();
      return;
    }

    // Fallback: parse from dataTransfer
    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json"));
      if (data?.activity) {
        const activity: ActivitySection = {
          ...data.activity,
          activityId: data.activity.activityId || nanoid(8),
        };
        onAdd(activity);
      }
    } catch {
      /* ignore */
    }
  };

  const dropping = isDragging && isOver;

  return (
    <div className="relative">
      {/* Add button — also a drop target */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg border-2 border-dashed text-[11.5px] font-bold transition-all ${
          dropping
            ? "border-violet-400 bg-violet-50 text-violet-700 shadow-md scale-[1.01]"
            : isDragging
            ? "border-violet-300 bg-violet-50/50 text-violet-600"
            : "border-[var(--le-hair)] text-[var(--le-ink-3)] hover:border-violet-300 hover:text-violet-600 hover:bg-violet-50/30"
        }`}
      >
        {dropping && payload ? (
          <>
            <span className="text-[14px]">{payload.icon}</span>
            <span>Drop to add {payload.label}</span>
          </>
        ) : isDragging ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Drop block here
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            + Add activity · drop a block
          </>
        )}
      </button>

      {/* Type picker dropdown */}
      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ type: "spring", damping: 25, stiffness: 400 }}
              className="absolute left-0 right-0 mt-1 bg-[var(--le-paper)] rounded-xl border border-[var(--le-hair)] shadow-lg z-50 p-2"
            >
              <div className="text-[11px] font-semibold text-[var(--le-ink-3)] px-2 py-1.5 mb-1">
                What kind of activity?
              </div>
              <div className="grid grid-cols-2 gap-1">
                {TEMPLATES.map((template) => (
                  <button
                    key={template.label}
                    onClick={() => handleSelect(template)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] text-[var(--le-ink-2)] hover:bg-violet-50 hover:text-violet-800 transition-colors text-left"
                  >
                    <span className="text-[14px]">{template.icon}</span>
                    <span className="font-semibold">{template.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
