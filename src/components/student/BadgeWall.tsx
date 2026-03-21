"use client";

import React from "react";
import type { BadgeCategory } from "@/lib/badges/badge-definitions";

/**
 * Represents a computed badge — matches the output of computeBadges()
 */
export interface DisplayBadge {
  id: string;
  category: BadgeCategory;
  name: string;
  icon: string;
  description: string;
  color: string;
  earned: boolean;
  tier: "bronze" | "silver" | "gold" | null;
  progress: number; // 0-100
  nextStep: string | null;
}

interface BadgeWallProps {
  badges: DisplayBadge[];
  showNextBadge?: boolean;
}

const CATEGORY_LABELS: Record<BadgeCategory, string> = {
  "design-cycle": "Design Cycle",
  safety: "Safety Certs",
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

/**
 * BadgeWall component displays earned and unearned badges grouped by category.
 * Shows the closest unearned badge with next steps.
 */
export function BadgeWall({ badges, showNextBadge = true }: BadgeWallProps) {
  const groupedBadges = CATEGORY_ORDER.reduce(
    (acc, category) => {
      const categoryBadges = badges.filter((b) => b.category === category);
      if (categoryBadges.length > 0) {
        acc[category] = categoryBadges;
      }
      return acc;
    },
    {} as Record<BadgeCategory, DisplayBadge[]>
  );

  const earnedCount = badges.filter((b) => b.earned).length;
  const totalCount = badges.length;

  // Find the next badge (highest progress that isn't earned)
  let nextBadge: DisplayBadge | null = null;
  if (showNextBadge) {
    const unearned = badges.filter((b) => !b.earned && b.progress > 0);
    if (unearned.length > 0) {
      nextBadge = unearned.reduce((best, current) =>
        current.progress > best.progress ? current : best
      );
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-purple-200/40 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-text-primary">My Badges</h2>
        <span className="text-sm text-text-secondary font-medium">
          {earnedCount} / {totalCount}
        </span>
      </div>

      {/* Badge groups */}
      <div className="space-y-5">
        {CATEGORY_ORDER.map((category) => {
          const categoryBadges = groupedBadges[category];
          if (!categoryBadges) return null;
          return (
            <div key={category}>
              <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2.5">
                {CATEGORY_LABELS[category]}
              </h3>
              <div className="flex flex-wrap gap-3">
                {categoryBadges.map((badge) => (
                  <div key={badge.id} className="relative group">
                    <button
                      className="w-11 h-11 rounded-full flex items-center justify-center text-lg transition-all duration-200 relative"
                      style={{
                        background: badge.earned
                          ? `linear-gradient(135deg, ${badge.color}30, ${badge.color}60)`
                          : "#f3f4f6",
                        boxShadow: badge.earned
                          ? `0 2px 8px ${badge.color}30`
                          : "none",
                      }}
                      title={badge.name}
                      aria-label={badge.name}
                    >
                      <span className={badge.earned ? "" : "grayscale opacity-40"}>
                        {badge.icon}
                      </span>

                      {/* Tier ring */}
                      {badge.earned && badge.tier && (
                        <div
                          className="absolute inset-0 rounded-full"
                          style={{
                            border: `2px solid ${
                              badge.tier === "gold"
                                ? "#EAB308"
                                : badge.tier === "silver"
                                  ? "#9CA3AF"
                                  : "#C2410C"
                            }`,
                          }}
                        />
                      )}
                    </button>

                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      <div className="bg-gray-900 text-white text-xs px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-lg">
                        <p className="font-medium">{badge.name}</p>
                        {badge.tier && (
                          <p className="text-gray-400 capitalize">{badge.tier}</p>
                        )}
                      </div>
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Next badge callout */}
      {nextBadge && (
        <div className="mt-5 pt-5 border-t border-purple-100">
          <div className="flex items-start gap-3 bg-gradient-to-r from-purple-50 to-transparent p-3 rounded-xl">
            <span className="text-xl">{nextBadge.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary">
                Next: <span className="text-purple-600">{nextBadge.name}</span>
              </p>
              {nextBadge.nextStep && (
                <p className="text-xs text-text-secondary mt-0.5">{nextBadge.nextStep}</p>
              )}
              <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className="bg-purple-500 h-1.5 rounded-full transition-all"
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
