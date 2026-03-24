"use client";

import { useCallback, useState, type DragEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDndContext } from "./DndContext";
import type { ActivitySection } from "@/types";

// ─────────────────────────────────────────────────────────────────
// Drop Zone — appears inside each Workshop Model phase when a
// block is being dragged from the palette. Glows to invite drop.
// ─────────────────────────────────────────────────────────────────

interface DropZoneProps {
  /** Unique ID for this drop zone (e.g., "opening", "workTime") */
  zoneId: string;
  /** Called when a block is dropped here */
  onDrop: (activity: ActivitySection) => void;
  /** Label shown in the drop zone */
  label?: string;
  /** Phase color accent */
  accentColor?: string;
}

export default function DropZone({
  zoneId,
  onDrop,
  label = "Drop block here",
  accentColor = "indigo",
}: DropZoneProps) {
  const { isDragging, payload, activeDropZone, setActiveDropZone, endDrag } =
    useDndContext();
  const [isOver, setIsOver] = useState(false);

  const handleDragOver = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      if (!isOver) {
        setIsOver(true);
        setActiveDropZone(zoneId);
      }
    },
    [isOver, zoneId, setActiveDropZone]
  );

  const handleDragLeave = useCallback(
    (e: DragEvent) => {
      // Only trigger if leaving the actual drop zone (not a child)
      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
      setIsOver(false);
      setActiveDropZone(null);
    },
    [setActiveDropZone]
  );

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setIsOver(false);
      setActiveDropZone(null);

      // Try to get from DnD context first (for in-page drags)
      if (payload) {
        onDrop(payload.activity);
        endDrag();
        return;
      }

      // Fallback: parse from dataTransfer (for external drags)
      try {
        const data = JSON.parse(e.dataTransfer.getData("application/json"));
        if (data?.activity) {
          onDrop(data.activity);
        }
      } catch {
        // ignore
      }
    },
    [payload, onDrop, endDrag, setActiveDropZone]
  );

  // Color map
  const colors: Record<string, { border: string; bg: string; text: string; glow: string }> = {
    indigo: { border: "border-indigo-400", bg: "bg-indigo-50", text: "text-indigo-500", glow: "shadow-indigo-200" },
    blue: { border: "border-blue-400", bg: "bg-blue-50", text: "text-blue-500", glow: "shadow-blue-200" },
    emerald: { border: "border-emerald-400", bg: "bg-emerald-50", text: "text-emerald-500", glow: "shadow-emerald-200" },
    amber: { border: "border-amber-400", bg: "bg-amber-50", text: "text-amber-500", glow: "shadow-amber-200" },
  };
  const c = colors[accentColor] || colors.indigo;

  return (
    <AnimatePresence>
      {isDragging && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
        >
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              relative my-2 rounded-xl border-2 border-dashed transition-all duration-200
              ${
                isOver
                  ? `${c.border} ${c.bg} shadow-lg ${c.glow} scale-[1.01]`
                  : "border-gray-300 bg-gray-50/50"
              }
            `}
          >
            <div
              className={`flex items-center justify-center gap-2 py-4 ${
                isOver ? c.text : "text-gray-400"
              } transition-colors`}
            >
              {isOver && payload ? (
                <>
                  <span className="text-lg">{payload.icon}</span>
                  <span className="text-sm font-semibold">{payload.label}</span>
                  <span className="text-xs opacity-60">— release to add</span>
                </>
              ) : (
                <>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="opacity-50"
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span className="text-xs font-medium">{label}</span>
                </>
              )}
            </div>

            {/* Pulse ring on hover */}
            {isOver && (
              <motion.div
                className={`absolute inset-0 rounded-xl border-2 ${c.border} opacity-40`}
                animate={{ scale: [1, 1.02, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
