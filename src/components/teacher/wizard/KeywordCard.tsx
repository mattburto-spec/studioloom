"use client";

import { useCallback } from "react";
import type { KeywordCategory, KeywordPriority } from "@/hooks/useWizardState";

interface KeywordCardProps {
  label: string;
  category: KeywordCategory;
  priority: KeywordPriority;
  index: number;
  onToggle: () => void;
  onSetPriority?: (index: number, priority: KeywordPriority) => void;
  delay?: number;
}

const categoryColors: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  skill: { bg: "bg-accent-orange/10", text: "text-accent-orange", border: "border-accent-orange/30", glow: "shadow-accent-orange/25" },
  context: { bg: "bg-accent-blue/10", text: "text-accent-blue", border: "border-accent-blue/30", glow: "shadow-accent-blue/25" },
  topic: { bg: "bg-brand-purple/10", text: "text-brand-purple", border: "border-brand-purple/30", glow: "shadow-brand-purple/25" },
  concept: { bg: "bg-accent-green/10", text: "text-accent-green", border: "border-accent-green/30", glow: "shadow-accent-green/25" },
  activity: { bg: "bg-amber-500/10", text: "text-amber-600", border: "border-amber-500/30", glow: "shadow-amber-500/25" },
  groupwork: { bg: "bg-sky-500/10", text: "text-sky-600", border: "border-sky-500/30", glow: "shadow-sky-500/25" },
  tool: { bg: "bg-violet-500/10", text: "text-violet-600", border: "border-violet-500/30", glow: "shadow-violet-500/25" },
  resource: { bg: "bg-rose-500/10", text: "text-rose-600", border: "border-rose-500/30", glow: "shadow-rose-500/25" },
};

export { categoryColors };

export function KeywordCard({ label, category, priority, index, onToggle, delay = 0 }: KeywordCardProps) {
  const colors = categoryColors[category] || categoryColors.topic;

  const stateClasses =
    priority === "essential"
      ? `${colors.bg} ${colors.text} border-2 ${colors.border} shadow-md ${colors.glow} font-semibold`
      : priority === "included"
        ? `${colors.bg} ${colors.text} border ${colors.border} shadow-sm`
        : `${colors.bg} ${colors.text} border border-transparent hover:${colors.border} opacity-70 hover:opacity-100`;

  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", String(index));
    e.dataTransfer.effectAllowed = "move";
    // Add a class via the drag image for visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.4";
    }
  }, [index]);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "";
    }
  }, []);

  return (
    <button
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={onToggle}
      className={`animate-slide-up inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 cursor-grab active:cursor-grabbing select-none ${stateClasses}`}
      style={{ animationDelay: `${delay}ms` }}
      title={
        priority === "none"
          ? "Drag to a bucket or tap to include"
          : priority === "included"
            ? "Drag to Must Have or tap to promote"
            : "Tap to remove"
      }
    >
      {priority === "included" && (
        <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" className="flex-shrink-0">
          <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
        </svg>
      )}
      {priority === "essential" && (
        <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" className="flex-shrink-0">
          <path d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z" />
        </svg>
      )}
      <span>{label}</span>
      <span className={`text-[9px] uppercase tracking-wider ${priority !== "none" ? "opacity-60" : "opacity-50"}`}>
        {category}
      </span>
    </button>
  );
}
