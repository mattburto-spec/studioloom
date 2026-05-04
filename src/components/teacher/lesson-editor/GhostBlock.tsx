"use client";

import { motion } from "framer-motion";
import type { ActivitySection } from "@/types";
import { composedPromptText, hasSlotFields } from "@/lib/lever-1/compose-prompt";

interface GhostBlockProps {
  activity: ActivitySection;
  label: string;
  icon: string;
  reason: string;
  onAccept: (activity: ActivitySection) => void;
  onDismiss: () => void;
}

/**
 * GhostBlock — A semi-transparent AI-suggested activity block.
 * Appears in-context within a Workshop Model phase to show
 * where the AI thinks an activity should go.
 *
 * Click ✓ to materialise it into a real block.
 * Click × to dismiss.
 */
export default function GhostBlock({
  activity,
  label,
  icon,
  reason,
  onAccept,
  onDismiss,
}: GhostBlockProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.97 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className="relative group"
    >
      {/* Pulsing border glow */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-indigo-200/40 via-purple-200/40 to-indigo-200/40 animate-pulse" />

      <div className="relative rounded-xl border-2 border-dashed border-indigo-300/60 bg-white/60 backdrop-blur-sm p-3 mx-0.5">
        {/* AI sparkle badge */}
        <div className="absolute -top-2.5 left-3 flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full">
          <span className="text-[10px]">✨</span>
          <span className="text-[10px] font-bold text-white tracking-wide">
            AI SUGGESTION
          </span>
        </div>

        {/* Content */}
        <div className="mt-1.5 flex items-start gap-3">
          <span className="text-xl flex-shrink-0">{icon}</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-gray-700">{label}</div>
            {/* Lever 1: prefer composed slot text, fall back to legacy prompt */}
            {(hasSlotFields(activity) || activity.prompt) && (
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                {composedPromptText(activity)}
              </p>
            )}
            <p className="text-[10px] text-indigo-500/80 mt-1 italic">
              {reason}
            </p>
          </div>

          {/* Duration badge */}
          {activity.durationMinutes && (
            <span className="text-[10px] font-medium text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full flex-shrink-0">
              {activity.durationMinutes}m
            </span>
          )}
        </div>

        {/* Accept / Dismiss buttons */}
        <div className="flex items-center justify-end gap-1.5 mt-2.5">
          <motion.button
            onClick={onDismiss}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Dismiss
          </motion.button>
          <motion.button
            onClick={() => onAccept(activity)}
            className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 shadow-sm transition-all"
            whileHover={{ scale: 1.03, boxShadow: "0 4px 12px rgba(99,102,241,0.3)" }}
            whileTap={{ scale: 0.97 }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Add to lesson
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
