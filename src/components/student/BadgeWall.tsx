"use client";

import React from "react";
import type { BadgeCategory } from "@/lib/badges/badge-definitions";

export interface DisplayBadge {
  id: string;
  category: BadgeCategory;
  name: string;
  icon: string;
  description: string;
  color: string;
  earned: boolean;
  tier: "bronze" | "silver" | "gold" | null;
  progress: number;
  nextStep: string | null;
}

interface BadgeWallProps {
  badges: DisplayBadge[];
}

const CATEGORY_LABELS: Record<BadgeCategory, string> = {
  "design-cycle": "Design Cycle",
  safety: "Safety",
  toolkit: "Toolkit",
  growth: "Growth",
  studio: "Studio",
};

const CATEGORY_ORDER: BadgeCategory[] = [
  "design-cycle",
  "safety",
  "toolkit",
  "growth",
  "studio",
];

export function BadgeWall({ badges }: BadgeWallProps) {
  const earnedCount = badges.filter((b) => b.earned).length;
  const totalCount = badges.length;

  // Find the next badge closest to earning
  const unearned = badges.filter((b) => !b.earned && b.progress > 0);
  const nextBadge = unearned.length > 0
    ? unearned.reduce((best, c) => (c.progress > best.progress ? c : best))
    : null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-purple-200/40 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-text-primary">Badges</h2>
        <span className="text-xs text-purple-600 font-semibold bg-purple-50 px-2 py-0.5 rounded-full">
          {earnedCount}/{totalCount}
        </span>
      </div>

      {/* Compact badge grid — all categories in one flow */}
      <div className="space-y-3">
        {CATEGORY_ORDER.map((category) => {
          const categoryBadges = badges.filter((b) => b.category === category);
          if (categoryBadges.length === 0) return null;
          return (
            <div key={category} className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider w-14 flex-shrink-0 leading-tight">
                {CATEGORY_LABELS[category]}
              </span>
              <div className="flex gap-1.5 flex-wrap">
                {categoryBadges.map((badge) => (
                  <div key={badge.id} className="relative group">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all duration-200"
                      style={{
                        background: badge.earned
                          ? `linear-gradient(135deg, ${badge.color}25, ${badge.color}50)`
                          : "#f3f4f6",
                        boxShadow: badge.earned ? `0 1px 4px ${badge.color}25` : "none",
                      }}
                    >
                      <span className={badge.earned ? "" : "grayscale opacity-35"} style={{ fontSize: "14px" }}>
                        {badge.icon}
                      </span>
                      {badge.earned && badge.tier && (
                        <div
                          className="absolute inset-0 rounded-full"
                          style={{
                            border: `2px solid ${
                              badge.tier === "gold" ? "#EAB308"
                                : badge.tier === "silver" ? "#9CA3AF"
                                  : "#C2410C"
                            }`,
                          }}
                        />
                      )}
                    </div>
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      <div className="bg-gray-900 text-white text-[10px] px-2 py-1 rounded-md whitespace-nowrap shadow-lg">
                        {badge.name}
                      </div>
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-[3px] border-transparent border-t-gray-900" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Next badge */}
      {nextBadge && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-base">{nextBadge.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-text-primary truncate">
                Next: <span className="text-purple-600">{nextBadge.name}</span>
              </p>
              <div className="mt-1 w-full bg-gray-200 rounded-full h-1">
                <div
                  className="bg-purple-500 h-1 rounded-full transition-all"
                  style={{ width: `${nextBadge.progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
