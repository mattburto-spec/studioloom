"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { nanoid } from "nanoid";
import type { ActivitySection, ResponseType } from "@/types";

interface ActivityBlockAddProps {
  onAdd: (activity: ActivitySection) => void;
}

interface ActivityTemplate {
  label: string;
  icon: string;
  responseType: ResponseType;
  defaultPrompt: string;
  defaultDuration: number;
}

const TEMPLATES: ActivityTemplate[] = [
  {
    label: "Written Response",
    icon: "📝",
    responseType: "text",
    defaultPrompt: "",
    defaultDuration: 10,
  },
  {
    label: "Creative Upload",
    icon: "🎨",
    responseType: "upload",
    defaultPrompt: "Upload your work.",
    defaultDuration: 15,
  },
  {
    label: "Voice Recording",
    icon: "🎤",
    responseType: "voice",
    defaultPrompt: "Record your explanation.",
    defaultDuration: 5,
  },
  {
    label: "Canvas Drawing",
    icon: "🖼️",
    responseType: "canvas",
    defaultPrompt: "Sketch your idea.",
    defaultDuration: 10,
  },
  {
    label: "Decision Matrix",
    icon: "📊",
    responseType: "decision-matrix" as ResponseType,
    defaultPrompt: "Compare your options using the criteria below.",
    defaultDuration: 15,
  },
  {
    label: "Content Block",
    icon: "📋",
    responseType: undefined as unknown as ResponseType,
    defaultPrompt: "Read the following information carefully.",
    defaultDuration: 5,
  },
];

export function ActivityBlockAdd({ onAdd }: ActivityBlockAddProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (template: ActivityTemplate) => {
    const activity: ActivitySection = {
      activityId: nanoid(8),
      prompt: template.defaultPrompt,
      durationMinutes: template.defaultDuration,
      ...(template.responseType ? { responseType: template.responseType } : {}),
    };
    onAdd(activity);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      {/* Add button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/30 transition-all"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Add Activity
      </button>

      {/* Type picker dropdown */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ type: "spring", damping: 25, stiffness: 400 }}
              className="absolute left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-lg z-50 p-2"
            >
              <div className="text-xs font-medium text-gray-500 px-2 py-1.5 mb-1">
                What kind of activity?
              </div>
              <div className="grid grid-cols-2 gap-1">
                {TEMPLATES.map((template) => (
                  <button
                    key={template.label}
                    onClick={() => handleSelect(template)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors text-left"
                  >
                    <span className="text-base">{template.icon}</span>
                    <span className="font-medium">{template.label}</span>
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
