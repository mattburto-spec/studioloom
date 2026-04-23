"use client";

/* ================================================================
 * Skills page — PLACEHOLDER (23 Apr 2026).
 *
 * Shows earned + pending safety badges from /api/student/safety/pending.
 * This is the thinnest possible page that makes the Skills nav pill
 * work. The full Skills page — with skill_cards, completion states,
 * freshness, radar chart, etc. — is a deliverable of the Skills Library
 * workshop (P1, ~4-6 days).
 *
 * Specs:
 *   - docs/projects/skills-library.md (canonical)
 *   - docs/specs/skills-library-spec.md
 *   - docs/specs/skills-library-completion-addendum.md
 *
 * This placeholder intentionally has no schema dependencies beyond the
 * existing safety badges. When Skills Library lands, this file is the
 * mount point for the richer UI.
 * ================================================================ */

import { useEffect, useState } from "react";
import Link from "next/link";
import type { JSX } from "react";
import { Icon, type IconName } from "@/components/student/BoldTopNav";

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

function mapBadgeIcon(slug: string | undefined): IconName {
  const set: Record<string, IconName> = {
    shield: "shield", wrench: "wrench", bolt: "bolt", print: "print",
    flame: "flame", trophy: "trophy", star: "star", book: "book",
  };
  return (slug && set[slug.toLowerCase()]) || "shield";
}

function RingProgress({ pct, size, stroke, color }: { pct: number; size: number; stroke: number; color: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="ring-track" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} stroke={color} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c}
      />
    </svg>
  );
}

function BadgeCircle({ name, icon, color, size = 96 }: { name: string; icon: IconName; color: string; size?: number }): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <div className="absolute inset-0 rounded-full" style={{ background: `radial-gradient(circle, ${color}35 0%, ${color}08 60%, transparent 85%)` }} />
        <div className="absolute inset-2 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`, boxShadow: `0 8px 24px -8px ${color}80` }}>
          <div className="text-white"><Icon name={icon} size={Math.round(size * 0.4)} s={2} /></div>
        </div>
      </div>
      <div className="text-center">
        <div className="text-[12px] font-extrabold leading-tight max-w-[120px]">{name}</div>
      </div>
    </div>
  );
}

export default function SkillsPage() {
  const [earned, setEarned] = useState<SafetyEarned[] | null>(null);
  const [pending, setPending] = useState<SafetyPending[] | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/student/safety/pending");
        if (!res.ok) { setEarned([]); setPending([]); return; }
        const data = await res.json();
        setEarned(data.earned ?? []);
        setPending(data.pending ?? []);
      } catch {
        setEarned([]);
        setPending([]);
      }
    })();
  }, []);

  const isLoading = earned === null || pending === null;

  return (
    <div className="max-w-[1400px] mx-auto px-6 pt-8 pb-20">
      {/* Header */}
      <div className="mb-8 px-1">
        <div className="cap text-[var(--sl-ink-3)]">Credentials &amp; progression</div>
        <h1 className="display-lg text-[30px] md:text-[44px] leading-[0.95] mt-1">Your skills.</h1>
        <p className="text-[13px] text-[var(--sl-ink-3)] mt-3 max-w-xl">
          Safety tests you&apos;ve passed and ones you still need.
          More skill categories and a richer view coming with the Skills Library build.
        </p>
      </div>

      {/* Earned */}
      {isLoading ? (
        <div className="rounded-3xl h-48 bg-[var(--sl-hair)]/40 animate-pulse mb-8" />
      ) : earned && earned.length > 0 ? (
        <div className="mb-10 rounded-3xl overflow-hidden card-shadow-lg glow-inner p-8 text-white relative" style={{ background: "linear-gradient(135deg, #1F2937 0%, #111827 100%)" }}>
          <div className="cap text-white/60 inline-flex items-center gap-2">
            <Icon name="trophy" size={12} s={2.5} /> You&apos;ve earned
          </div>
          <h2 className="display text-[48px] leading-none mt-1">
            {earned.length} skill{earned.length === 1 ? "" : "s"}<span className="text-[#FBBF24]">.</span>
          </h2>
          <div className="text-[13px] text-white/70 mt-2">
            Workshop safety certifications you&apos;ve passed.
          </div>
          <div className="mt-8 flex items-center gap-8 flex-wrap">
            {earned.map((b) => (
              <BadgeCircle
                key={b.badge_id}
                name={b.badge_name}
                icon={mapBadgeIcon(b.badge_icon)}
                color={b.badge_color || "#10B981"}
                size={88}
              />
            ))}
          </div>
          <div className="absolute top-6 right-6 text-[#FBBF24] opacity-70"><Icon name="sparkle" size={48} s={1.5} /></div>
        </div>
      ) : (
        <div className="mb-10 rounded-3xl bg-white card-shadow p-10 text-center">
          <div className="cap text-[var(--sl-ink-3)]">Nothing earned yet</div>
          <h2 className="display text-[28px] mt-2">Your first skill is waiting.</h2>
          <p className="text-[13px] text-[var(--sl-ink-3)] mt-2 max-w-md mx-auto">
            Pass a safety test to earn your first badge — click any pending one below to get started.
          </p>
        </div>
      )}

      {/* Pending */}
      <div className="mb-4">
        <div className="flex items-end justify-between">
          <div>
            <div className="cap text-[var(--sl-ink-3)]">Safety</div>
            <h2 className="display text-[28px] leading-none mt-1">
              Next to unlock{pending ? ` · ${pending.length}` : ""}
            </h2>
          </div>
        </div>
      </div>
      {isLoading ? (
        <div className="space-y-2.5">
          <div className="h-16 rounded-2xl bg-[var(--sl-hair)]/40 animate-pulse" />
          <div className="h-16 rounded-2xl bg-[var(--sl-hair)]/40 animate-pulse" />
        </div>
      ) : pending && pending.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          {pending.map((b) => {
            const unlock =
              b.student_status === "cooldown" ? "In cooldown · try again soon"
              : b.student_status === "expired" ? "Needs retake"
              : "Pass safety test";
            return (
              <Link
                key={b.badge_id}
                href={`/safety/${b.badge_id}`}
                className="bg-white rounded-2xl p-4 border border-[var(--sl-hair)] flex items-center gap-4 hover:card-shadow transition"
              >
                <div className="relative flex-shrink-0" style={{ width: 52, height: 52 }}>
                  <RingProgress pct={0} size={52} stroke={4} color={b.badge_color || "#D97706"} />
                  <div className="absolute inset-0 flex items-center justify-center" style={{ color: b.badge_color || "#D97706" }}>
                    <Icon name={mapBadgeIcon(b.badge_icon)} size={20} s={2} />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-extrabold leading-tight">{b.badge_name}</div>
                  <div className="text-[11px] text-[var(--sl-ink-3)] mt-0.5">{unlock}</div>
                </div>
                <Icon name="arrow" size={14} s={2.5} />
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-6 border border-[var(--sl-hair)] text-[13px] text-[var(--sl-ink-3)]">
          Nothing to unlock right now — your units haven&apos;t required any safety tests yet.
        </div>
      )}

      {/* Future-sections hint — explicit scope communication */}
      <div className="mt-12 rounded-2xl border border-dashed border-[var(--sl-hair)] p-6 text-center">
        <div className="cap text-[var(--sl-ink-3)]">Coming with Skills Library</div>
        <p className="text-[13px] text-[var(--sl-ink-3)] mt-2 max-w-md mx-auto">
          Technical skill cards, progression state, freshness, strength radar, and teacher-curated references will land here when the Skills Library workshop ships.
        </p>
      </div>
    </div>
  );
}
