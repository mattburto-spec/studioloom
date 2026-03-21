"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
// Shield icon as inline SVG (no lucide-react dependency)
const ShieldIcon = ({ size = 24, className = "" }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);
import type { Badge, BadgeTier } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TierInfo = {
  number: BadgeTier;
  name: string;
  accent: string;
  description: string;
};

interface BadgeCardProps {
  badge: Badge;
}

interface BadgeSectionProps {
  tier: TierInfo;
  badges: Badge[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIER_INFO: Record<BadgeTier, TierInfo> = {
  1: {
    number: 1,
    name: "Fundamentals",
    accent: "emerald",
    description: "Build core competency",
  },
  2: {
    number: 2,
    name: "Specialty",
    accent: "blue",
    description: "Develop specialized skills",
  },
  3: {
    number: 3,
    name: "Advanced",
    accent: "purple",
    description: "Master advanced techniques",
  },
  4: {
    number: 4,
    name: "Expert",
    accent: "amber",
    description: "Achieve expert mastery",
  },
};

const CATEGORY_COLORS = {
  safety: "bg-red-50 border-red-200 text-red-700",
  skill: "bg-blue-50 border-blue-200 text-blue-700",
  software: "bg-purple-50 border-purple-200 text-purple-700",
};

const ACCENT_COLORS = {
  emerald: "#10b981",
  blue: "#3b82f6",
  purple: "#8b5cf6",
  amber: "#f59e0b",
};

// ---------------------------------------------------------------------------
// Skeleton Loader
// ---------------------------------------------------------------------------

function BadgeCardSkeleton() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3 flex-1">
          <div className="w-10 h-10 bg-gray-200 rounded-lg" />
          <div className="flex-1">
            <div className="w-32 h-5 bg-gray-200 rounded mb-2" />
            <div className="w-20 h-4 bg-gray-100 rounded" />
          </div>
        </div>
        <div className="w-6 h-6 bg-gray-200 rounded-full" />
      </div>
      <div className="w-48 h-4 bg-gray-100 rounded mb-4" />
      <div className="space-y-3 mb-4">
        <div className="w-full h-3 bg-gray-100 rounded" />
        <div className="w-3/4 h-3 bg-gray-100 rounded" />
      </div>
      <div className="flex gap-2 mb-4">
        <div className="w-16 h-6 bg-gray-100 rounded" />
        <div className="w-16 h-6 bg-gray-100 rounded" />
        <div className="w-16 h-6 bg-gray-100 rounded" />
      </div>
      <div className="w-full h-9 bg-gray-100 rounded-lg" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Badge Card Component
// ---------------------------------------------------------------------------

function BadgeCard({ badge }: BadgeCardProps) {
  const tier = TIER_INFO[badge.tier as BadgeTier];
  const categoryColor =
    CATEGORY_COLORS[badge.category as keyof typeof CATEGORY_COLORS];

  // Convert icon_name (emoji string) to actual emoji if it's valid
  const icon = badge.icon_name;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow duration-200">
      {/* Header: Icon + Name + Tier Dot */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3 flex-1">
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 text-xl"
            style={{ backgroundColor: `${badge.color}20` }}
          >
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 text-sm leading-tight">
              {badge.name}
            </h3>
            <p className="text-xs text-gray-500 mt-1">{tier.name}</p>
          </div>
        </div>
        {/* Tier dot */}
        <div
          className="w-3 h-3 rounded-full flex-shrink-0 mt-1"
          style={{ backgroundColor: ACCENT_COLORS[tier.accent as keyof typeof ACCENT_COLORS] }}
          title={tier.name}
        />
      </div>

      {/* Category pill */}
      <div className="mb-3">
        <span
          className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full border capitalize ${categoryColor}`}
        >
          {badge.category}
        </span>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 line-clamp-2 mb-4">
        {badge.description || "No description provided"}
      </p>

      {/* Stats row */}
      <div className="flex gap-4 text-xs text-gray-500 mb-4 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-1">
          <span className="font-medium text-gray-700">{badge.question_count}</span>
          <span>Questions</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="font-medium text-gray-700">{badge.pass_threshold}%</span>
          <span>Pass</span>
        </div>
        {badge.expiry_months && (
          <div className="flex items-center gap-1">
            <span className="font-medium text-gray-700">{badge.expiry_months}mo</span>
            <span>Expires</span>
          </div>
        )}
      </div>

      {/* View button */}
      <Link
        href={`/teacher/safety/${badge.id}`}
        className="block w-full text-center bg-gray-50 hover:bg-gray-100 text-gray-900 font-medium py-2 px-4 rounded-lg transition-colors duration-150"
      >
        View
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Badge Section (per tier)
// ---------------------------------------------------------------------------

function BadgeSection({ tier, badges }: BadgeSectionProps) {
  if (badges.length === 0) return null;

  const accentMap = {
    emerald: "border-l-4 border-l-emerald-500 bg-emerald-50",
    blue: "border-l-4 border-l-blue-500 bg-blue-50",
    purple: "border-l-4 border-l-purple-500 bg-purple-50",
    amber: "border-l-4 border-l-amber-500 bg-amber-50",
  };

  return (
    <section className="mb-12">
      <div className={`p-4 rounded-lg mb-6 ${accentMap[tier.accent as keyof typeof accentMap]}`}>
        <h2 className="text-lg font-bold text-gray-900">
          Tier {tier.number}: {tier.name}
        </h2>
        <p className="text-sm text-gray-600 mt-1">{tier.description}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {badges.map((badge) => (
          <BadgeCard key={badge.id} badge={badge} />
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

function EmptyState({
  onSeed,
  isSeedLoading,
}: {
  onSeed: () => void;
  isSeedLoading: boolean;
}) {
  return (
    <div className="text-center py-16">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
        <ShieldIcon size={32} className="text-gray-400" />
      </div>
      <h3 className="text-lg font-bold text-gray-900 mb-2">No badges yet</h3>
      <p className="text-gray-600 mb-6">
        Get started by seeding the built-in safety and skill badges.
      </p>
      <button
        onClick={onSeed}
        disabled={isSeedLoading}
        className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors duration-150"
      >
        {isSeedLoading ? "Seeding..." : "Seed Built-in Badges"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function SafetyBadgesPage() {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSeedLoading, setIsSeedLoading] = useState(false);

  // Fetch badges on mount
  useEffect(() => {
    const fetchBadges = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch("/api/teacher/badges");
        if (!response.ok) {
          throw new Error("Failed to load badges");
        }

        const data = await response.json();
        setBadges(data.badges || []);
      } catch (err) {
        console.error("[SafetyBadgesPage] Fetch error:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load badges"
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchBadges();
  }, []);

  // Handle seed built-in badges
  const handleSeedBadges = async () => {
    try {
      setIsSeedLoading(true);
      setError(null);

      const response = await fetch("/api/teacher/badges/seed", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to seed badges");
      }

      const data = await response.json();

      // Refresh badge list
      const refreshResponse = await fetch("/api/teacher/badges");
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        setBadges(refreshData.badges || []);
      }
    } catch (err) {
      console.error("[SafetyBadgesPage] Seed error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to seed badges"
      );
    } finally {
      setIsSeedLoading(false);
    }
  };

  // Group badges by tier
  const badgesByTier: Record<BadgeTier, Badge[]> = {
    1: badges.filter((b) => b.tier === 1),
    2: badges.filter((b) => b.tier === 2),
    3: badges.filter((b) => b.tier === 3),
    4: badges.filter((b) => b.tier === 4),
  };

  const hasBadges = badges.length > 0;

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <ShieldIcon size={24} className="text-purple-600" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900">
                Safety & Skills
              </h1>
            </div>
            <div className="flex gap-3">
              {hasBadges && !isLoading && (
                <button
                  onClick={handleSeedBadges}
                  disabled={isSeedLoading}
                  className="px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-900 font-medium rounded-lg transition-colors duration-150 disabled:opacity-50"
                >
                  {isSeedLoading ? "Seeding..." : "Seed More Badges"}
                </button>
              )}
              <Link
                href="/teacher/safety/create"
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-medium rounded-lg transition-all duration-150"
              >
                <span>+</span>
                <span>Create Badge</span>
              </Link>
            </div>
          </div>
          <p className="text-gray-600">
            Manage workshop certifications, safety tests, and skill badges
          </p>
        </div>

        {/* Error state */}
        {error && !isLoading && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 font-medium">Error: {error}</p>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-12">
            {Array.from({ length: 8 }).map((_, i) => (
              <BadgeCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !hasBadges && (
          <EmptyState
            onSeed={handleSeedBadges}
            isSeedLoading={isSeedLoading}
          />
        )}

        {/* Badges by tier */}
        {!isLoading && hasBadges && (
          <div>
            {(Object.keys(TIER_INFO) as unknown as BadgeTier[]).map((tier) => (
              <BadgeSection
                key={tier}
                tier={TIER_INFO[tier]}
                badges={badgesByTier[tier]}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
