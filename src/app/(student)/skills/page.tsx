"use client";

/* ================================================================
 * /skills — Student Skills Library landing page.
 *
 * Replaces the Apr 23 stub (safety-badges only). Now shows the full
 * catalogue organised by domain × tier, with per-card state chips
 * sourced from student_skill_state. Safety Badges continue to live
 * at the bottom as a distinct section — until the unified content
 * layer migration lands, they're still a separate system.
 *
 * Design language matches the student Bold dashboard v2:
 *   - `.cap` eyebrow text, `.display` / `.display-lg` headlines
 *   - `.card-shadow` / `.card-shadow-lg` elevated surfaces
 *   - CSS variables `--sl-ink-*`, `--sl-hair` for colours
 * ================================================================ */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { JSX } from "react";
import { Icon, type IconName } from "@/components/student/BoldTopNav";
import { SKILL_TIER_LABELS, type CardType, type SkillTier } from "@/types/skills";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface CardTile {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  tier: SkillTier | null;
  domain_id: string | null;
  card_type: CardType;
  estimated_min: number | null;
  age_min: number | null;
  age_max: number | null;
  state: "untouched" | "viewed" | "quiz_passed" | "demonstrated" | "applied";
  freshness: "fresh" | "cooling" | "stale" | null;
  last_passed_at: string | null;
}

interface DomainSection {
  id: string;
  short_code: string;
  label: string;
  description: string;
  display_order: number;
  tiers: Record<SkillTier, CardTile[]>;
}

interface LibrarySummary {
  total: number;
  viewed: number;
  quiz_passed: number;
  demonstrated: number;
  applied: number;
}

type SafetyEarned = {
  badge_id: string;
  badge_name: string;
  badge_icon: string;
  badge_color: string;
  earned_at: string;
};

type SafetyPending = {
  badge_id: string;
  badge_name: string;
  badge_icon: string;
  badge_color: string;
  student_status: "not_started" | "cooldown" | "expired";
};

// ---------------------------------------------------------------------------
// State-chip palette
// ---------------------------------------------------------------------------
const STATE_LABELS: Record<CardTile["state"], string> = {
  untouched: "New",
  viewed: "Started",
  quiz_passed: "Quiz passed",
  demonstrated: "Demonstrated",
  applied: "Applied",
};
const STATE_CHIP_CLS: Record<CardTile["state"], string> = {
  untouched: "bg-gray-100 text-gray-500",
  viewed: "bg-sky-100 text-sky-700",
  quiz_passed: "bg-indigo-100 text-indigo-700",
  demonstrated: "bg-violet-100 text-violet-700",
  applied: "bg-emerald-100 text-emerald-700",
};
const TIER_CHIP_CLS: Record<SkillTier, string> = {
  bronze: "bg-amber-100 text-amber-800",
  silver: "bg-slate-100 text-slate-700",
  gold: "bg-yellow-100 text-yellow-800",
};

// ---------------------------------------------------------------------------
// Helpers for the safety badges section (carried over from the Apr 23 stub)
// ---------------------------------------------------------------------------
function mapBadgeIcon(slug: string | undefined): IconName {
  const set: Record<string, IconName> = {
    shield: "shield",
    wrench: "wrench",
    bolt: "bolt",
    print: "print",
    flame: "flame",
    trophy: "trophy",
    star: "star",
    book: "book",
  };
  return (slug && set[slug.toLowerCase()]) || "shield";
}

function RingProgress({
  pct,
  size,
  stroke,
  color,
}: {
  pct: number;
  size: number;
  stroke: number;
  color: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        className="ring-track"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        stroke={color}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c - (pct / 100) * c}
      />
    </svg>
  );
}

function BadgeCircle({
  name,
  icon,
  color,
  size = 96,
}: {
  name: string;
  icon: IconName;
  color: string;
  size?: number;
}): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative flex-shrink-0"
        style={{ width: size, height: size }}
      >
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `radial-gradient(circle, ${color}35 0%, ${color}08 60%, transparent 85%)`,
          }}
        />
        <div
          className="absolute inset-2 rounded-full flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`,
            boxShadow: `0 8px 24px -8px ${color}80`,
          }}
        >
          <div className="text-white">
            <Icon name={icon} size={Math.round(size * 0.4)} s={2} />
          </div>
        </div>
      </div>
      <div className="text-center">
        <div className="text-[12px] font-extrabold leading-tight max-w-[120px]">
          {name}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card tile — one skill card in the ladder
// ---------------------------------------------------------------------------
function SkillCardTile({ tile }: { tile: CardTile }) {
  return (
    <Link
      href={`/skills/cards/${tile.slug}`}
      className="block bg-white border border-[var(--sl-hair)] rounded-2xl p-4 hover:border-[var(--sl-ink-1)]/30 hover:card-shadow transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="text-[14px] font-bold leading-tight flex-1 min-w-0">
          {tile.title}
        </div>
        {tile.tier && (
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide flex-shrink-0 ${TIER_CHIP_CLS[tile.tier]}`}
          >
            {SKILL_TIER_LABELS[tile.tier]}
          </span>
        )}
      </div>
      {tile.summary && (
        <p className="text-[12px] text-[var(--sl-ink-3)] mb-2.5 line-clamp-2">
          {tile.summary}
        </p>
      )}
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span
          className={`font-semibold px-2 py-0.5 rounded-full ${STATE_CHIP_CLS[tile.state]}`}
        >
          {STATE_LABELS[tile.state]}
        </span>
        <div className="flex items-center gap-2 text-[var(--sl-ink-3)]">
          {tile.card_type === "routine" && (
            <span className="bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full font-medium">
              Routine
            </span>
          )}
          {tile.estimated_min && <span>~{tile.estimated_min}m</span>}
          {tile.freshness && tile.freshness !== "fresh" && (
            <span className="text-amber-600 font-medium">
              {tile.freshness === "cooling" ? "Cooling off" : "Stale"}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Tier row within a domain — label + horizontal card tiles
// ---------------------------------------------------------------------------
function TierRow({
  tier,
  cards,
}: {
  tier: SkillTier;
  cards: CardTile[];
}) {
  if (cards.length === 0) {
    return (
      <div className="flex items-start gap-3">
        <div className="w-20 flex-shrink-0 pt-2">
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${TIER_CHIP_CLS[tier]}`}
          >
            {SKILL_TIER_LABELS[tier]}
          </span>
        </div>
        <div className="flex-1 text-[12px] text-[var(--sl-ink-3)] italic pt-2">
          No cards published at this level yet.
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3">
      <div className="w-20 flex-shrink-0 pt-4">
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${TIER_CHIP_CLS[tier]}`}
        >
          {SKILL_TIER_LABELS[tier]}
        </span>
      </div>
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {cards.map((c) => (
          <SkillCardTile key={c.id} tile={c} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Domain section — one domain card with 3 tier rows
// ---------------------------------------------------------------------------
function DomainCard({ domain }: { domain: DomainSection }) {
  const counts = {
    bronze: domain.tiers.bronze.length,
    silver: domain.tiers.silver.length,
    gold: domain.tiers.gold.length,
  };
  const earned = {
    bronze: domain.tiers.bronze.filter((c) =>
      ["quiz_passed", "demonstrated", "applied"].includes(c.state)
    ).length,
    silver: domain.tiers.silver.filter((c) =>
      ["quiz_passed", "demonstrated", "applied"].includes(c.state)
    ).length,
    gold: domain.tiers.gold.filter((c) =>
      ["quiz_passed", "demonstrated", "applied"].includes(c.state)
    ).length,
  };
  const total = counts.bronze + counts.silver + counts.gold;
  const totalEarned = earned.bronze + earned.silver + earned.gold;

  return (
    <section className="bg-white rounded-3xl card-shadow border border-[var(--sl-hair)] p-6 mb-5">
      <header className="flex items-start justify-between gap-4 mb-5">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[var(--sl-ink-1)] text-white flex items-center justify-center font-extrabold text-[14px] flex-shrink-0">
            {domain.short_code}
          </div>
          <div className="min-w-0">
            <h2 className="text-[18px] font-extrabold leading-tight">
              {domain.label}
            </h2>
            <p className="text-[12px] text-[var(--sl-ink-3)] mt-0.5 line-clamp-2">
              {domain.description}
            </p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-[20px] font-extrabold leading-none">
            {totalEarned}
            <span className="text-[var(--sl-ink-3)]">/{total}</span>
          </div>
          <div className="cap text-[var(--sl-ink-3)] mt-1">earned</div>
        </div>
      </header>
      <div className="space-y-4">
        <TierRow tier="bronze" cards={domain.tiers.bronze} />
        <TierRow tier="silver" cards={domain.tiers.silver} />
        <TierRow tier="gold" cards={domain.tiers.gold} />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function SkillsPage() {
  // Library state
  const [domains, setDomains] = useState<DomainSection[] | null>(null);
  const [summary, setSummary] = useState<LibrarySummary | null>(null);
  const [ageBand, setAgeBand] = useState<string>(""); // "" | "primary" | "middle" | "senior"

  // Safety badges state (carried forward)
  const [earned, setEarned] = useState<SafetyEarned[] | null>(null);
  const [pending, setPending] = useState<SafetyPending[] | null>(null);

  // Load library (refetches when ageBand changes)
  useEffect(() => {
    let abort = false;
    (async () => {
      const qs = ageBand ? `?age_band=${ageBand}` : "";
      try {
        const res = await fetch(`/api/student/skills/library${qs}`);
        if (abort) return;
        if (!res.ok) {
          setDomains([]);
          setSummary({
            total: 0,
            viewed: 0,
            quiz_passed: 0,
            demonstrated: 0,
            applied: 0,
          });
          return;
        }
        const json = await res.json();
        setDomains(json.domains ?? []);
        setSummary(json.summary ?? null);
      } catch {
        if (abort) return;
        setDomains([]);
      }
    })();
    return () => {
      abort = true;
    };
  }, [ageBand]);

  // Load safety badges (once)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/student/safety/pending");
        if (!res.ok) {
          setEarned([]);
          setPending([]);
          return;
        }
        const data = await res.json();
        setEarned(data.earned ?? []);
        setPending(data.pending ?? []);
      } catch {
        setEarned([]);
        setPending([]);
      }
    })();
  }, []);

  const isSafetyLoading = earned === null || pending === null;
  const isLibraryLoading = domains === null;

  const heroCount = useMemo(() => {
    const safe = earned?.length ?? 0;
    const demo = summary?.demonstrated ?? 0;
    return safe + demo;
  }, [earned, summary]);

  return (
    <div className="max-w-[1400px] mx-auto px-6 pt-8 pb-20">
      {/* ================= Header ================= */}
      <div className="mb-8 px-1">
        <div className="cap text-[var(--sl-ink-3)]">
          Credentials &amp; progression
        </div>
        <h1 className="display-lg text-[30px] md:text-[44px] leading-[0.95] mt-1">
          Your skills.
        </h1>
        <p className="text-[13px] text-[var(--sl-ink-3)] mt-3 max-w-xl">
          Cards you&apos;ve started, passed, and demonstrated — plus the
          safety tests that let you use the workshop.
        </p>
      </div>

      {/* ================= Hero (combined earn count) ================= */}
      {isLibraryLoading || isSafetyLoading ? (
        <div className="rounded-3xl h-48 bg-[var(--sl-hair)]/40 animate-pulse mb-8" />
      ) : heroCount > 0 ? (
        <div
          className="mb-10 rounded-3xl overflow-hidden card-shadow-lg glow-inner p-8 text-white relative"
          style={{
            background: "linear-gradient(135deg, #1F2937 0%, #111827 100%)",
          }}
        >
          <div className="cap text-white/60 inline-flex items-center gap-2">
            <Icon name="trophy" size={12} s={2.5} /> You&apos;ve earned
          </div>
          <h2 className="display text-[48px] leading-none mt-1">
            {heroCount} skill{heroCount === 1 ? "" : "s"}
            <span className="text-[#FBBF24]">.</span>
          </h2>
          <div className="text-[13px] text-white/70 mt-2">
            {summary && summary.demonstrated > 0 && (
              <>
                {summary.demonstrated} demonstrated
                {earned && earned.length > 0
                  ? `, ${earned.length} safety certification${earned.length === 1 ? "" : "s"}`
                  : ""}
              </>
            )}
            {summary?.demonstrated === 0 && earned && earned.length > 0 && (
              <>
                {earned.length} safety certification
                {earned.length === 1 ? "" : "s"}
              </>
            )}
          </div>
          {summary && summary.total > 0 && (
            <div className="mt-8 flex items-center gap-6 text-white/70 text-[12px] flex-wrap">
              <div>
                <div className="text-white font-extrabold text-[18px] leading-none">
                  {summary.viewed}
                </div>
                <div className="cap mt-1">started</div>
              </div>
              <div className="w-px h-8 bg-white/20" />
              <div>
                <div className="text-white font-extrabold text-[18px] leading-none">
                  {summary.quiz_passed}
                </div>
                <div className="cap mt-1">quiz passed</div>
              </div>
              <div className="w-px h-8 bg-white/20" />
              <div>
                <div className="text-white font-extrabold text-[18px] leading-none">
                  {summary.demonstrated}
                </div>
                <div className="cap mt-1">demonstrated</div>
              </div>
              <div className="w-px h-8 bg-white/20" />
              <div>
                <div className="text-white font-extrabold text-[18px] leading-none">
                  {summary.applied}
                </div>
                <div className="cap mt-1">applied</div>
              </div>
            </div>
          )}
          <div className="absolute top-6 right-6 text-[#FBBF24] opacity-70">
            <Icon name="sparkle" size={48} s={1.5} />
          </div>
        </div>
      ) : (
        <div className="mb-10 rounded-3xl bg-white card-shadow p-10 text-center">
          <div className="cap text-[var(--sl-ink-3)]">Nothing earned yet</div>
          <h2 className="display text-[28px] mt-2">
            Your first skill is waiting.
          </h2>
          <p className="text-[13px] text-[var(--sl-ink-3)] mt-2 max-w-md mx-auto">
            Open any card below to start. Each one has what you need to learn
            the skill, then show you can do it.
          </p>
        </div>
      )}

      {/* ================= Skills Library ================= */}
      <div className="mb-4 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="cap text-[var(--sl-ink-3)]">Skills Library</div>
          <h2 className="display text-[28px] leading-none mt-1">
            By domain &amp; tier
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[12px] text-[var(--sl-ink-3)]">Age band</label>
          <select
            value={ageBand}
            onChange={(e) => setAgeBand(e.target.value)}
            className="bg-white border border-[var(--sl-hair)] rounded-lg px-3 py-1.5 text-[12px]"
          >
            <option value="">All</option>
            <option value="primary">Primary (8–11)</option>
            <option value="middle">Middle (11–14)</option>
            <option value="senior">Senior (14–18)</option>
          </select>
        </div>
      </div>

      {isLibraryLoading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-3xl h-64 bg-[var(--sl-hair)]/40 animate-pulse"
            />
          ))}
        </div>
      ) : domains && domains.length > 0 ? (
        <div>
          {domains.map((d) => (
            <DomainCard key={d.id} domain={d} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-8 border border-[var(--sl-hair)] text-center">
          <div className="cap text-[var(--sl-ink-3)]">
            Library still filling up
          </div>
          <p className="text-[13px] text-[var(--sl-ink-3)] mt-2 max-w-md mx-auto">
            Your teacher is authoring the first set of skill cards. Once they
            publish, the ladder shows up here.
          </p>
        </div>
      )}

      {/* ================= Safety badges ================= */}
      <div className="mb-4 mt-12">
        <div className="cap text-[var(--sl-ink-3)]">Safety</div>
        <h2 className="display text-[28px] leading-none mt-1">
          Certifications{pending ? ` · ${pending.length} to unlock` : ""}
        </h2>
      </div>

      {isSafetyLoading ? (
        <div className="space-y-2.5">
          <div className="h-16 rounded-2xl bg-[var(--sl-hair)]/40 animate-pulse" />
          <div className="h-16 rounded-2xl bg-[var(--sl-hair)]/40 animate-pulse" />
        </div>
      ) : (
        <>
          {earned && earned.length > 0 && (
            <div className="flex items-center gap-6 flex-wrap mb-5 bg-white card-shadow rounded-2xl p-5">
              {earned.map((b) => (
                <BadgeCircle
                  key={b.badge_id}
                  name={b.badge_name}
                  icon={mapBadgeIcon(b.badge_icon)}
                  color={b.badge_color || "#10B981"}
                  size={72}
                />
              ))}
            </div>
          )}
          {pending && pending.length > 0 ? (
            <div className="flex flex-col gap-2.5">
              {pending.map((b) => {
                const unlock =
                  b.student_status === "cooldown"
                    ? "In cooldown · try again soon"
                    : b.student_status === "expired"
                      ? "Needs retake"
                      : "Pass safety test";
                return (
                  <Link
                    key={b.badge_id}
                    href={`/safety/${b.badge_id}`}
                    className="bg-white rounded-2xl p-4 border border-[var(--sl-hair)] flex items-center gap-4 hover:card-shadow transition"
                  >
                    <div
                      className="relative flex-shrink-0"
                      style={{ width: 52, height: 52 }}
                    >
                      <RingProgress
                        pct={0}
                        size={52}
                        stroke={4}
                        color={b.badge_color || "#D97706"}
                      />
                      <div
                        className="absolute inset-0 flex items-center justify-center"
                        style={{ color: b.badge_color || "#D97706" }}
                      >
                        <Icon
                          name={mapBadgeIcon(b.badge_icon)}
                          size={20}
                          s={2}
                        />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-extrabold leading-tight">
                        {b.badge_name}
                      </div>
                      <div className="text-[11px] text-[var(--sl-ink-3)] mt-0.5">
                        {unlock}
                      </div>
                    </div>
                    <Icon name="arrow" size={14} s={2.5} />
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-6 border border-[var(--sl-hair)] text-[13px] text-[var(--sl-ink-3)]">
              Nothing to unlock right now — your projects haven&apos;t required
              any safety tests yet.
            </div>
          )}
        </>
      )}
    </div>
  );
}
