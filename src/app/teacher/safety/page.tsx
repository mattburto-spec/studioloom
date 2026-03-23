"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { Badge, BadgeTier } from "@/types";

// ---------------------------------------------------------------------------
// Badge Icon — maps icon_name to inline SVG
// ---------------------------------------------------------------------------

function BadgeIcon({ name, color, size = 28 }: { name: string; color: string; size?: number }) {
  const props = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: "1.5" as const, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  switch (name?.toLowerCase()) {
    case "flame":
      return <svg {...props}><path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z" /></svg>;
    case "zap":
      return <svg {...props}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>;
    case "cpu":
      return <svg {...props}><rect x="4" y="4" width="16" height="16" rx="2" ry="2" /><rect x="9" y="9" width="6" height="6" /><line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" /><line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" /><line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" /><line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" /></svg>;
    case "flask-conical":
      return <svg {...props}><path d="M10 2v7.527a2 2 0 01-.211.896L4.72 20.55a1 1 0 00.9 1.45h12.76a1 1 0 00.9-1.45l-5.069-10.127A2 2 0 0114 9.527V2" /><line x1="8.5" y1="2" x2="15.5" y2="2" /></svg>;
    case "tree-pine":
      return <svg {...props}><path d="M17 14l3 3.3a1 1 0 01-.7 1.7H4.7a1 1 0 01-.7-1.7L7 14" /><path d="M17 9l3 3.3a1 1 0 01-.7 1.7H4.7a1 1 0 01-.7-1.7L7 9" /><path d="M17 4l3 3.3a1 1 0 01-.7 1.7H4.7a1 1 0 01-.7-1.7L7 4" /><line x1="12" y1="19" x2="12" y2="22" /></svg>;
    case "hammer":
      return <svg {...props}><path d="M15 12l-8.5 8.5c-.83.83-2.17.83-3 0 0 0 0 0 0 0a2.12 2.12 0 010-3L12 9" /><path d="M17.64 15L22 10.64" /><path d="M20.91 11.7l-1.25-1.25c-.6-.6-.93-1.4-.93-2.25V6.5L14.5 2.14 12 4.64l2 2v1.86L10.36 12" /></svg>;
    case "wrench":
      return <svg {...props}><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" /></svg>;
    case "scissors":
      return <svg {...props}><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" /><line x1="8.12" y1="8.12" x2="12" y2="12" /></svg>;
    case "hard-hat":
    case "shield":
    default:
      return <svg {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type TierInfo = { number: BadgeTier; name: string; color: string; bg: string; border: string; description: string };

const TIER_INFO: Record<BadgeTier, TierInfo> = {
  1: { number: 1, name: "Fundamentals", color: "#059669", bg: "#D1FAE5", border: "#A7F3D0", description: "Build core competency" },
  2: { number: 2, name: "Specialty", color: "#2563EB", bg: "#DBEAFE", border: "#BFDBFE", description: "Develop specialized skills" },
  3: { number: 3, name: "Advanced", color: "#7C3AED", bg: "#F3E8FF", border: "#E9D5FF", description: "Master advanced techniques" },
  4: { number: 4, name: "Expert", color: "#D97706", bg: "#FEF3C7", border: "#FDE68A", description: "Achieve expert mastery" },
};

const CATEGORY_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  safety: { bg: "#FEE2E2", color: "#991B1B", border: "#FECACA" },
  skill: { bg: "#DBEAFE", color: "#1E40AF", border: "#BFDBFE" },
  software: { bg: "#F3E8FF", color: "#6B21A8", border: "#E9D5FF" },
};

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function SafetyBadgesPage() {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSeedLoading, setIsSeedLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterTier, setFilterTier] = useState<string>("all");

  useEffect(() => {
    const fetchBadges = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch("/api/teacher/badges");
        if (!response.ok) throw new Error("Failed to load badges");
        const data = await response.json();
        setBadges(data.badges || []);
      } catch (err) {
        console.error("[SafetyBadgesPage] Fetch error:", err);
        setError(err instanceof Error ? err.message : "Failed to load badges");
      } finally {
        setIsLoading(false);
      }
    };
    fetchBadges();
  }, []);

  const handleSeedBadges = async () => {
    try {
      setIsSeedLoading(true);
      setError(null);
      const response = await fetch("/api/teacher/badges/seed", { method: "POST" });
      if (!response.ok) throw new Error("Failed to seed badges");
      const refreshResponse = await fetch("/api/teacher/badges");
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        setBadges(refreshData.badges || []);
      }
    } catch (err) {
      console.error("[SafetyBadgesPage] Seed error:", err);
      setError(err instanceof Error ? err.message : "Failed to seed badges");
    } finally {
      setIsSeedLoading(false);
    }
  };

  // Filtering
  const filtered = badges.filter((b) => {
    if (filterCategory !== "all" && b.category !== filterCategory) return false;
    if (filterTier !== "all" && String(b.tier) !== filterTier) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = [b.name, b.description, b.category].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // Group by tier
  const byTier: Record<BadgeTier, Badge[]> = { 1: [], 2: [], 3: [], 4: [] };
  for (const b of filtered) {
    const t = b.tier as BadgeTier;
    if (byTier[t]) byTier[t].push(b);
  }

  // Stats
  const categories = [...new Set(badges.map((b) => b.category))];
  const safetyCount = badges.filter((b) => b.category === "safety").length;
  const skillCount = badges.filter((b) => b.category === "skill").length;
  const softwareCount = badges.filter((b) => b.category === "software").length;
  const hasBadges = badges.length > 0;

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900">Safety & Skills</h1>
          <p className="text-gray-500 mt-1">Manage workshop certifications, safety tests, and skill badges</p>
        </div>
        <div className="flex items-center gap-2">
          {hasBadges && !isLoading && (
            <button
              onClick={handleSeedBadges}
              disabled={isSeedLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50"
            >
              {isSeedLoading ? "Seeding..." : "Seed More"}
            </button>
          )}
          <Link
            href="/teacher/safety/create"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-xl shadow-md hover:shadow-lg hover:opacity-90 transition-all"
            style={{ background: "linear-gradient(135deg, #7B2FF2, #5C16C5)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
            Create Badge
          </Link>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>), value: badges.length, label: "Total Badges", bg: "#F3E8FF", border: "#E9D5FF" },
          { icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>), value: safetyCount, label: "Safety", bg: "#FEE2E2", border: "#FECACA" },
          { icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" /></svg>), value: skillCount, label: "Skill", bg: "#DBEAFE", border: "#BFDBFE" },
          { icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2" /><rect x="9" y="9" width="6" height="6" /></svg>), value: softwareCount, label: "Software", bg: "#F3E8FF", border: "#E9D5FF" },
        ].map((stat, i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: stat.bg, border: `1px solid ${stat.border}` }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "white" }}>
              {stat.icon}
            </div>
            <div>
              <p className="text-xl font-extrabold text-gray-900">{stat.value}</p>
              <p className="text-[11px] text-gray-500 font-medium">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search + Filter bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-6">
        <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search badges..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-transparent"
            />
          </div>
          {/* Category pills */}
          <div className="flex items-center gap-1.5">
            {["all", ...categories].map((cat) => {
              const isActive = filterCategory === cat;
              const style = cat === "all" ? null : CATEGORY_STYLES[cat];
              return (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold transition capitalize"
                  style={isActive ? {
                    background: cat === "all" ? "linear-gradient(135deg, #7B2FF2, #5C16C5)" : (style?.color || "#7B2FF2"),
                    color: "white",
                  } : {
                    background: style?.bg || "#F3F4F6",
                    color: style?.color || "#6B7280",
                  }}
                >
                  {cat}
                </button>
              );
            })}
          </div>
          {/* Tier filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400 font-medium">Tier:</span>
            {["all", "1", "2", "3", "4"].map((t) => {
              const isActive = filterTier === t;
              const tier = t !== "all" ? TIER_INFO[Number(t) as BadgeTier] : null;
              return (
                <button
                  key={t}
                  onClick={() => setFilterTier(t)}
                  className="w-7 h-7 rounded-full text-[11px] font-bold transition flex items-center justify-center"
                  style={isActive ? {
                    background: tier?.color || "linear-gradient(135deg, #7B2FF2, #5C16C5)",
                    color: "white",
                  } : {
                    background: tier?.bg || "#F3F4F6",
                    color: tier?.color || "#6B7280",
                  }}
                  title={tier ? `Tier ${t}: ${tier.name}` : "All tiers"}
                >
                  {t === "all" ? "*" : t}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && !isLoading && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl">
          <p className="text-red-700 text-sm font-medium">Error: {error}</p>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 animate-pulse h-20" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && !hasBadges && (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: "#F3E8FF" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
          </div>
          <p className="text-gray-700 text-lg font-semibold">No badges yet</p>
          <p className="text-gray-400 text-sm mt-1 max-w-sm mx-auto">
            Get started by seeding the built-in safety and skill badges, or create your own.
          </p>
          <div className="flex items-center justify-center gap-3 mt-5">
            <button
              onClick={handleSeedBadges}
              disabled={isSeedLoading}
              className="px-5 py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #7B2FF2, #5C16C5)" }}
            >
              {isSeedLoading ? "Seeding..." : "Seed Built-in Badges"}
            </button>
            <Link
              href="/teacher/safety/create"
              className="px-5 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50"
            >
              Create Custom
            </Link>
          </div>
        </div>
      )}

      {/* Badge list by tier */}
      {!isLoading && hasBadges && (
        <div className="space-y-8">
          {([1, 2, 3, 4] as BadgeTier[]).map((tierNum) => {
            const tierBadges = byTier[tierNum];
            if (tierBadges.length === 0) return null;
            const tier = TIER_INFO[tierNum];

            return (
              <section key={tierNum}>
                {/* Tier header */}
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white"
                    style={{ background: tier.color }}
                  >
                    {tierNum}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-900">{tier.name}</h2>
                    <p className="text-xs text-gray-400">{tier.description}</p>
                  </div>
                  <span className="text-xs text-gray-400 ml-auto">{tierBadges.length} badge{tierBadges.length !== 1 ? "s" : ""}</span>
                </div>

                {/* Compact badge rows */}
                <div className="space-y-2">
                  {tierBadges.map((badge) => {
                    const bgColor = badge.color || "#6366f1";
                    const catStyle = CATEGORY_STYLES[badge.category as keyof typeof CATEGORY_STYLES] || CATEGORY_STYLES.skill;

                    return (
                      <div
                        key={badge.id}
                        className="bg-white rounded-2xl border border-gray-100 hover:shadow-sm transition-shadow group"
                      >
                        <div className="flex items-center gap-4 px-4 py-3">
                          {/* Icon */}
                          <div
                            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: `${bgColor}15` }}
                          >
                            <BadgeIcon name={badge.icon_name} color={bgColor} size={22} />
                          </div>

                          {/* Name + description */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/teacher/safety/${badge.id}`}
                                className="font-semibold text-gray-900 text-sm hover:text-purple-700 transition truncate"
                              >
                                {badge.name}
                              </Link>
                              <span
                                className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 capitalize"
                                style={{ background: catStyle.bg, color: catStyle.color, border: `1px solid ${catStyle.border}` }}
                              >
                                {badge.category}
                              </span>
                            </div>
                            {badge.description && (
                              <p className="text-xs text-gray-400 truncate mt-0.5">{badge.description}</p>
                            )}
                          </div>

                          {/* Stats */}
                          <div className="hidden md:flex items-center gap-4 flex-shrink-0">
                            <div className="text-center">
                              <p className="text-sm font-bold text-gray-900">{badge.question_count}</p>
                              <p className="text-[10px] text-gray-400">Questions</p>
                            </div>
                            <div className="text-center">
                              <p className="text-sm font-bold text-gray-900">{badge.pass_threshold}%</p>
                              <p className="text-[10px] text-gray-400">Pass</p>
                            </div>
                            {badge.expiry_months && (
                              <div className="text-center">
                                <p className="text-sm font-bold text-gray-900">{badge.expiry_months}mo</p>
                                <p className="text-[10px] text-gray-400">Expiry</p>
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <Link
                              href={`/teacher/safety/${badge.id}?tab=results&action=assign`}
                              className="px-3 py-1.5 text-[11px] font-semibold rounded-lg transition"
                              style={{ background: "#FEF3C7", color: "#92400E" }}
                              title="Assign as unit prerequisite"
                            >
                              Assign
                            </Link>
                            <Link
                              href={`/teacher/safety/${badge.id}?tab=results&action=award`}
                              className="px-3 py-1.5 text-[11px] font-semibold rounded-lg transition"
                              style={{ background: "#D1FAE5", color: "#065F46" }}
                              title="Award directly to students"
                            >
                              Award
                            </Link>
                            <Link
                              href={`/teacher/safety/${badge.id}`}
                              className="px-3 py-1.5 text-[11px] font-semibold rounded-lg transition"
                              style={{ background: "#F3E8FF", color: "#7C3AED" }}
                            >
                              View
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {/* No results after filter */}
          {filtered.length === 0 && (
            <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
              <p className="text-gray-500 text-sm">No badges match your filters.</p>
              <button
                onClick={() => { setSearch(""); setFilterCategory("all"); setFilterTier("all"); }}
                className="text-purple-600 text-sm font-medium mt-2 hover:underline"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tip */}
      {hasBadges && !isLoading && (
        <div className="mt-8 bg-purple-50 border border-purple-100 rounded-2xl px-5 py-3 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#E9D5FF" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          </div>
          <p className="text-xs text-purple-700 leading-relaxed pt-1.5">
            <span className="font-semibold">Tip:</span> Assign badges as unit prerequisites to gate access until students pass the safety test. Students see pending tests on their dashboard and take a 3-screen flow: learn cards, quiz, results.
          </p>
        </div>
      )}
    </main>
  );
}
