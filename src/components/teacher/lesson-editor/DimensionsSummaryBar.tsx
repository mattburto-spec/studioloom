"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { ActivitySection, BloomLevel, WorkshopPhases } from "@/types";

interface DimensionsSummaryBarProps {
  sections: ActivitySection[];
  phases?: WorkshopPhases | null;
  udlEnabled?: boolean;
}

const BLOOM_ORDER: BloomLevel[] = [
  "remember",
  "understand",
  "apply",
  "analyze",
  "evaluate",
  "create",
];

const BLOOM_LABEL: Record<BloomLevel, string> = {
  remember: "Remember",
  understand: "Understand",
  apply: "Apply",
  analyze: "Analyze",
  evaluate: "Evaluate",
  create: "Create",
};

const BLOOM_LOAD: Record<BloomLevel, number> = {
  remember: 1,
  understand: 2,
  apply: 3,
  analyze: 4,
  evaluate: 5,
  create: 6,
};

const BLOOM_TIER_COLORS = ["#E5E7EB", "#DBEAFE", "#C7D2FE", "#DDD6FE", "#FBCFE8", "#FCA5A5"];

function loadTone(score: number): { label: string; bg: string; text: string; border: string; bar: string } {
  if (score <= 2) return { label: "Low", bg: "bg-emerald-50", text: "text-emerald-900", border: "border-emerald-200", bar: "#10B981" };
  if (score <= 3.2) return { label: "Moderate", bg: "bg-emerald-50", text: "text-emerald-900", border: "border-emerald-200", bar: "#10B981" };
  if (score <= 4) return { label: "High", bg: "bg-amber-50", text: "text-amber-900", border: "border-amber-200", bar: "#F59E0B" };
  return { label: "Very High", bg: "bg-rose-50", text: "text-rose-900", border: "border-rose-200", bar: "#F43F5E" };
}

/**
 * Lesson Health card — Bloom's distribution + Cognitive Load.
 *
 * Time was previously a third column here, but the phase strip above the
 * card already shows the same per-phase segments + total + over/under, so
 * Time here was duplicate. Dropped to two columns.
 *
 * Collapsible: defaults to collapsed and shows a one-line summary strip.
 * Click to expand into the full two-column view.
 */
export default function DimensionsSummaryBar({ sections, phases }: DimensionsSummaryBarProps) {
  const [open, setOpen] = useState(false);

  // Derived totals (still used to drive Cognitive Load math + section count)
  const segmentTotal = phases
    ? phases.opening.durationMinutes +
      phases.miniLesson.durationMinutes +
      phases.workTime.durationMinutes +
      phases.debrief.durationMinutes
    : sections.reduce((s, a) => s + (a.durationMinutes || 0), 0);

  // ─── Bloom's ──────────────────────────────────────────────────────
  const bloomCounts: Record<BloomLevel, number> = {
    remember: 0, understand: 0, apply: 0, analyze: 0, evaluate: 0, create: 0,
  };
  let bloomLoadSum = 0;
  let bloomTotal = 0;
  sections.forEach((s) => {
    if (s.bloom_level) {
      bloomCounts[s.bloom_level]++;
      bloomLoadSum += BLOOM_LOAD[s.bloom_level];
      bloomTotal++;
    }
  });
  const bloomAvg = bloomTotal > 0 ? bloomLoadSum / bloomTotal : 0;
  const bloomRounded = Math.round(bloomAvg);
  const bloomLabel = bloomTotal > 0 ? BLOOM_LABEL[BLOOM_ORDER[bloomRounded - 1] || "apply"] : "—";
  const bloomNarrative =
    bloomAvg === 0
      ? "Tag activities with Bloom's to see distribution."
      : bloomAvg < 2.5
      ? "Skews toward foundational — consider one Apply or higher."
      : bloomAvg < 4
      ? "Skews toward mid-tier — consider one Create task."
      : "Heavy on higher-order thinking — pace your scaffolding.";

  // ─── Cognitive load ───────────────────────────────────────────────
  const activityCount = sections.length;
  const phaseMinutes = segmentTotal || 1;
  const density = (activityCount / Math.max(phaseMinutes, 30)) * 60;
  const rawLoad = bloomAvg * 0.7 + Math.min(density, 6) * 0.3;
  const loadScore = Math.min(5, Math.max(1, rawLoad / 1.2));
  const loadPct = (loadScore / 5) * 100;
  const tone = loadTone(loadScore);

  // ─── Collapsed strip ──────────────────────────────────────────────
  return (
    <div className="le-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-3.5 py-2 hover:bg-[var(--le-hair-2)]/40 transition-colors text-left"
      >
        <div className="le-cap text-[var(--le-ink-3)]">Lesson Health</div>
        <div className="flex-1 flex items-center gap-3 text-[11px]">
          {/* Bloom's mini summary */}
          <span className="flex items-center gap-1.5">
            <span className="text-[var(--le-ink-3)] uppercase tracking-wider text-[9.5px] font-extrabold">Bloom&apos;s</span>
            <span className="font-extrabold le-tnum text-[var(--le-ink)]">
              {bloomTotal > 0 ? bloomAvg.toFixed(1) : "—"}
              <span className="font-bold text-[var(--le-ink-3)]">/6</span>
            </span>
            <span className="text-[var(--le-ink-2)] hidden md:inline">· {bloomLabel}</span>
          </span>
          <span className="w-px h-3 bg-[var(--le-hair)]" />
          {/* Cognitive load mini summary */}
          <span className="flex items-center gap-1.5">
            <span className="text-[var(--le-ink-3)] uppercase tracking-wider text-[9.5px] font-extrabold">Load</span>
            <span className="font-extrabold le-tnum text-[var(--le-ink)]">
              {loadScore.toFixed(1)}
              <span className="font-bold text-[var(--le-ink-3)]">/5</span>
            </span>
            <span
              className={`text-[10px] font-extrabold tracking-wider uppercase px-1.5 py-[1px] border rounded-full ${tone.bg} ${tone.text} ${tone.border}`}
            >
              {tone.label}
            </span>
          </span>
        </div>
        <span className="text-[var(--le-ink-3)] text-[12px] leading-none select-none">
          {open ? "▴" : "▾"}
        </span>
      </button>

      <motion.div
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="overflow-hidden"
      >
        <div className="px-3.5 pb-3.5 pt-1 grid grid-cols-2 gap-4 border-t border-[var(--le-hair)]">
          {/* Bloom's full */}
          <div>
            <div className="flex items-baseline justify-between">
              <div className="text-[10px] font-extrabold tracking-widest uppercase text-[var(--le-ink-3)]">Bloom&apos;s</div>
              <div className="text-[10px] font-extrabold text-[var(--le-ink-2)]">{bloomLabel}</div>
            </div>
            <div className="mt-1 text-[20px] font-extrabold le-tnum text-[var(--le-ink)]">
              {bloomTotal > 0 ? bloomAvg.toFixed(1) : "—"}
              <span className="text-[11px] font-bold text-[var(--le-ink-3)]"> / 6</span>
            </div>
            <div className="mt-1.5 flex gap-[2px]">
              {Array.from({ length: 6 }).map((_, i) => {
                const filled = i < bloomRounded;
                const total = bloomTotal;
                const cellColor = filled
                  ? BLOOM_TIER_COLORS[i] || "var(--le-hair-2)"
                  : "var(--le-hair-2)";
                const count = bloomCounts[BLOOM_ORDER[i]];
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div
                    key={i}
                    className="flex-1 h-1.5 rounded-sm"
                    style={{ background: cellColor }}
                    title={`${BLOOM_LABEL[BLOOM_ORDER[i]]}: ${count} (${pct}%)`}
                  />
                );
              })}
            </div>
            <div className="mt-1.5 text-[10px] text-[var(--le-ink-3)]">{bloomNarrative}</div>
          </div>

          {/* Cognitive load full */}
          <div>
            <div className="flex items-baseline justify-between">
              <div className="text-[10px] font-extrabold tracking-widest uppercase text-[var(--le-ink-3)]">Cognitive Load</div>
              <span
                className={`text-[10.5px] font-extrabold tracking-wider uppercase px-2 py-[3px] border rounded-full ${tone.bg} ${tone.text} ${tone.border}`}
              >
                {tone.label}
              </span>
            </div>
            <div className="mt-1 text-[20px] font-extrabold le-tnum text-[var(--le-ink)]">
              {loadScore.toFixed(1)}
              <span className="text-[11px] font-bold text-[var(--le-ink-3)]"> / 5</span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-[var(--le-hair-2)] overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${loadPct}%`, background: tone.bar }}
              />
            </div>
            <div className="mt-1.5 text-[10px] text-[var(--le-ink-3)]">
              Derived from Bloom&apos;s mix · {activityCount} {activityCount === 1 ? "activity" : "activities"} in {segmentTotal}m.
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
