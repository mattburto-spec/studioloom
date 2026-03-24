"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStudent } from "../student-context";
import { BUILT_IN_BADGES } from "@/lib/safety/badge-definitions";

interface Badge {
  id: string;
  name: string;
  description: string;
  slug: string;
  category: "safety" | "skill" | "software";
  tier: number;
  color: string;
  icon_name: string;
  pass_threshold: number;
  question_count: number;
  student_status: "earned" | "expired" | "cooldown" | "not_started";
  earned_at?: string;
  expires_at?: string;
  cooldown_until?: string;
}

export default function SafetyBadgesPage() {
  const router = useRouter();
  const { student, isLoading: studentLoading } = useStudent();
  const [statusMap, setStatusMap] = useState<Record<string, { status: string; earned_at?: string; expires_at?: string; cooldown_until?: string }>>({});
  const [loading, setLoading] = useState(true);

  // Fetch student status for badges (optional — built-in badges always show)
  useEffect(() => {
    async function loadStatuses() {
      if (!student) return;
      try {
        const res = await fetch("/api/student/safety/badges");
        if (res.ok) {
          const data = await res.json();
          const map: Record<string, any> = {};
          for (const b of (data.badges || [])) {
            map[b.id] = { status: b.student_status, earned_at: b.earned_at, expires_at: b.expires_at, cooldown_until: b.cooldown_until };
            if (b.slug) map[b.slug] = map[b.id];
          }
          setStatusMap(map);
        }
      } catch (err) {
        console.error("Error loading badge statuses:", err);
      } finally {
        setLoading(false);
      }
    }
    loadStatuses();
  }, [student]);

  // Merge built-in badges with student status
  const badges: Badge[] = useMemo(() => {
    return BUILT_IN_BADGES.map((b) => {
      const st = statusMap[b.id] || statusMap[b.slug] || { status: "not_started" };
      return {
        id: b.slug,
        name: b.name,
        description: b.description,
        slug: b.slug,
        category: b.category,
        tier: b.tier,
        color: b.color,
        icon_name: b.icon_name,
        pass_threshold: b.pass_threshold,
        question_count: b.question_count,
        student_status: (st.status || "not_started") as Badge["student_status"],
        earned_at: st.earned_at,
        expires_at: st.expires_at,
        cooldown_until: st.cooldown_until,
      };
    });
  }, [statusMap]);

  // Group badges by tier and category
  const groupedBadges = useMemo(() => {
    const groups: Record<number, Badge[]> = {};
    badges.forEach((badge) => {
      if (!groups[badge.tier]) {
        groups[badge.tier] = [];
      }
      groups[badge.tier].push(badge);
    });
    return groups;
  }, [badges]);

  const tiers = Object.keys(groupedBadges)
    .map(Number)
    .sort((a, b) => a - b);

  // Status badge content
  const getStatusBadge = (badge: Badge) => {
    if (badge.student_status === "earned") {
      return {
        text: "✅ Earned",
        color: "bg-green-100 text-green-700",
        icon: "✓",
      };
    }
    if (badge.student_status === "expired") {
      return { text: "⏰ Expired", color: "bg-amber-100 text-amber-700", icon: "!" };
    }
    if (badge.student_status === "cooldown") {
      const cooldown = badge.cooldown_until
        ? new Date(badge.cooldown_until)
        : null;
      const now = new Date();
      const minutesLeft =
        cooldown && cooldown > now
          ? Math.ceil((cooldown.getTime() - now.getTime()) / 60000)
          : 0;
      return {
        text: `🔒 Retry in ${minutesLeft}m`,
        color: "bg-slate-200 text-slate-700",
        icon: "🔒",
      };
    }
    return {
      text: "🚀 Start",
      color: "bg-indigo-100 text-indigo-700",
      icon: "→",
    };
  };

  const handleBadgeClick = (badge: Badge) => {
    if (badge.student_status === "cooldown") {
      return; // Don't navigate if in cooldown
    }
    router.push(`/safety/${badge.id}`);
  };

  if (studentLoading || loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-slate-500">Loading badges...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-slate-200 bg-slate-50">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <h1 className="text-3xl font-bold text-slate-900">
            Workshop Safety Badges
          </h1>
          <p className="mt-2 text-slate-600">
            Earn safety certifications by passing tests. Each badge shows your
            competency in using specific workshop equipment.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {tiers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500">No badges available yet</p>
          </div>
        ) : (
          <div className="space-y-10">
            {tiers.map((tier) => (
              <div key={tier}>
                <h2 className="text-lg font-semibold text-slate-900 mb-4">
                  {tier === 1 && "🟢 Tier 1 — Foundations"}
                  {tier === 2 && "🔵 Tier 2 — Specialty"}
                  {tier === 3 && "🟣 Tier 3 — Advanced"}
                  {tier === 4 && "🟠 Tier 4 — Expert"}
                  {tier > 4 && `Tier ${tier}`}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {groupedBadges[tier]?.map((badge) => {
                    const statusBadge = getStatusBadge(badge);
                    const isDisabled = badge.student_status === "cooldown";
                    return (
                      <button
                        key={badge.id}
                        onClick={() => handleBadgeClick(badge)}
                        disabled={isDisabled}
                        className={`text-left rounded-lg border-2 p-6 transition ${
                          isDisabled
                            ? "opacity-60 cursor-not-allowed bg-slate-50 border-slate-200"
                            : "border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 cursor-pointer"
                        }`}
                      >
                        {/* Icon and title row */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-start gap-3">
                            <div
                              className="text-3xl flex-shrink-0"
                              style={{
                                filter:
                                  badge.student_status === "earned"
                                    ? "none"
                                    : "grayscale(100%)",
                              }}
                            >
                              {badge.icon_name}
                            </div>
                            <div>
                              <h3 className="font-semibold text-slate-900">
                                {badge.name}
                              </h3>
                              <p className="text-sm text-slate-500 mt-1">
                                {badge.question_count} questions •{" "}
                                {badge.pass_threshold}% to pass
                              </p>
                            </div>
                          </div>
                          <span
                            className={`text-xs font-medium px-2 py-1 rounded whitespace-nowrap ml-2 ${statusBadge.color}`}
                          >
                            {statusBadge.text}
                          </span>
                        </div>

                        {/* Description */}
                        <p className="text-sm text-slate-600 mb-4">
                          {badge.description}
                        </p>

                        {/* Earned date or expiry info */}
                        {badge.student_status === "earned" &&
                          badge.earned_at && (
                            <p className="text-xs text-green-600 flex items-center gap-1">
                              ✓ Earned{" "}
                              {new Date(badge.earned_at).toLocaleDateString()}
                              {badge.expires_at &&
                                ` • Expires ${new Date(
                                  badge.expires_at
                                ).toLocaleDateString()}`}
                            </p>
                          )}
                        {badge.student_status === "expired" &&
                          badge.expires_at && (
                            <p className="text-xs text-amber-600 flex items-center gap-1">
                              ⏰ Expired{" "}
                              {new Date(badge.expires_at).toLocaleDateString()}
                            </p>
                          )}

                        {/* CTA */}
                        <div className="mt-4 flex items-center gap-2 text-indigo-600 font-medium text-sm">
                          {badge.student_status === "earned" && (
                            <>View</>
                          )}
                          {badge.student_status === "expired" && <>Retake</>}
                          {badge.student_status === "not_started" && (
                            <>Start Test</>
                          )}
                          <span>{statusBadge.icon}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
