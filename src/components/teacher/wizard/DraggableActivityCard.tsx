"use client";

import type { ActivityTemplate } from "@/lib/activity-library";

interface Props {
  activity: ActivityTemplate;
  isUsed: boolean;
}

export function DraggableActivityCard({ activity, isUsed }: Props) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("application/questerra-activity", activity.id);
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className={`relative px-3 py-2.5 rounded-lg border transition-all cursor-grab active:cursor-grabbing ${
        isUsed
          ? "border-accent-green/30 bg-accent-green/5"
          : "border-border hover:border-gray-300 hover:bg-gray-50"
      }`}
    >
      {/* Used checkmark */}
      {isUsed && (
        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-accent-green flex items-center justify-center">
          <svg width="10" height="10" viewBox="0 0 16 16" fill="white">
            <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
          </svg>
        </div>
      )}

      <div className="pr-6">
        <div className="text-xs font-semibold text-text-primary">{activity.name}</div>
        <p className="text-[10px] text-text-secondary mt-0.5 line-clamp-2">
          {activity.description}
        </p>
      </div>

      {/* Badges */}
      <div className="flex items-center gap-1.5 mt-1.5">
        <span className="text-[9px] text-text-secondary/60 bg-gray-100 px-1.5 py-0.5 rounded">
          {activity.tags.duration}
        </span>
        <span className="text-[9px] text-text-secondary/60 bg-gray-100 px-1.5 py-0.5 rounded">
          {activity.tags.groupSize}
        </span>
        {isUsed && (
          <span className="text-[9px] text-accent-green font-medium">In use</span>
        )}
      </div>
    </div>
  );
}
