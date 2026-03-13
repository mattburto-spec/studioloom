"use client";

import type { ActivityTemplate } from "@/lib/activity-library";
import { DraggableActivityCard } from "./DraggableActivityCard";

interface Props {
  label: string;
  color: string;
  activities: ActivityTemplate[];
  usedActivityIds: Set<string>;
  onClose: () => void;
}

export function ActivityCategoryPanel({ label, color, activities, usedActivityIds, onClose }: Props) {
  return (
    <div className="w-64 bg-white rounded-xl shadow-xl border border-border animate-slide-in-right overflow-hidden">
      {/* Header */}
      <div
        className="px-3 py-2.5 flex items-center justify-between"
        style={{ backgroundColor: `${color}10` }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="text-xs font-bold text-text-primary">{label}</span>
          <span className="text-[9px] text-text-secondary">
            {activities.length} {activities.length === 1 ? "activity" : "activities"}
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-5 h-5 flex items-center justify-center text-text-secondary/50 hover:text-text-secondary transition rounded"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Activity list */}
      <div className="p-2 space-y-1.5 max-h-80 overflow-y-auto scrollbar-thin">
        {activities.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-xs text-text-secondary/60">Coming soon</p>
            <p className="text-[10px] text-text-secondary/40 mt-1">
              Activities for this category are being developed
            </p>
          </div>
        ) : (
          activities.map((activity) => (
            <DraggableActivityCard
              key={activity.id}
              activity={activity}
              isUsed={usedActivityIds.has(activity.id)}
            />
          ))
        )}
      </div>

      {/* Drag hint */}
      {activities.length > 0 && (
        <div className="px-3 py-2 border-t border-border bg-gray-50/50">
          <p className="text-[9px] text-text-secondary/50 text-center">
            Drag an activity onto a page card to insert it
          </p>
        </div>
      )}
    </div>
  );
}
