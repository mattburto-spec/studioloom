"use client";

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

// Tier colors for the Bloom mini-bar (low → high)
const BLOOM_TIER_COLORS = ["#E5E7EB", "#DBEAFE", "#C7D2FE", "#DDD6FE", "#FBCFE8", "#FCA5A5"];

// Phase ordering + colors for Time segments
const PHASE_ORDER: { key: keyof WorkshopPhases; short: string; color: string }[] = [
  { key: "opening", short: "Opening", color: "var(--le-phase-opening)" },
  { key: "miniLesson", short: "Mini", color: "var(--le-phase-miniLesson)" },
  { key: "workTime", short: "Work", color: "var(--le-phase-workTime)" },
  { key: "debrief", short: "Debrief", color: "var(--le-phase-debrief)" },
];

const TARGET_MINUTES = 60;

function loadTone(score: number): { label: string; bg: string; text: string; border: string; bar: string } {
  if (score <= 2) return { label: "Low", bg: "bg-emerald-50", text: "text-emerald-900", border: "border-emerald-200", bar: "#10B981" };
  if (score <= 3.2) return { label: "Moderate", bg: "bg-emerald-50", text: "text-emerald-900", border: "border-emerald-200", bar: "#10B981" };
  if (score <= 4) return { label: "High", bg: "bg-amber-50", text: "text-amber-900", border: "border-amber-200", bar: "#F59E0B" };
  return { label: "Very High", bg: "bg-rose-50", text: "text-rose-900", border: "border-rose-200", bar: "#F43F5E" };
}

/**
 * DimensionsSummaryBar (renamed in spirit to "Lesson Health card") —
 * warm-paper 3-column card showing live Time / Bloom's / Cognitive Load.
 * Updates as activities + phase durations change.
 */
export default function DimensionsSummaryBar({ sections, phases }: DimensionsSummaryBarProps) {
  // ─── Time column ──────────────────────────────────────────────────
  const segments = phases
    ? PHASE_ORDER.map((p) => ({ ...p, minutes: phases[p.key].durationMinutes || 0 }))
    : [];
  const totalMin =
    segments.length > 0
      ? segments.reduce((s, x) => s + x.minutes, 0)
      : sections.reduce((s, a) => s + (a.durationMinutes || 0), 0);
  const overUnder = totalMin - TARGET_MINUTES;
  const overUnderTone =
    overUnder > 0
      ? "text-rose-600"
      : overUnder < -5
      ? "text-amber-600"
      : "text-emerald-600";
  const overUnderLabel =
    overUnder > 0
      ? `+${overUnder}m over`
      : overUnder < -5
      ? `${-overUnder}m under`
      : "on target";

  // ─── Bloom's column ───────────────────────────────────────────────
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

  // ─── Cognitive load column ────────────────────────────────────────
  // Score = bloomAvg * 0.7 + activityDensity * 0.3, normalised to 1-5
  const activityCount = sections.length;
  const phaseMinutes = totalMin || 1;
  const density = (activityCount / Math.max(phaseMinutes, 30)) * 60; // activities per 60 min
  const rawLoad = bloomAvg * 0.7 + Math.min(density, 6) * 0.3;
  const loadScore = Math.min(5, Math.max(1, rawLoad / 1.2));
  const loadPct = (loadScore / 5) * 100;
  const tone = loadTone(loadScore);

  return (
    <div className="le-card p-3.5">
      <div className="le-cap text-[var(--le-ink-3)] mb-2">Lesson Health</div>
      <div className="grid grid-cols-3 gap-3">
        {/* ── Time ── */}
        <div>
          <div className="flex items-baseline justify-between">
            <div className="text-[10px] font-extrabold tracking-widest uppercase text-[var(--le-ink-3)]">Time</div>
            <div className={`text-[10px] font-extrabold ${overUnderTone}`}>{overUnderLabel}</div>
          </div>
          <div className="mt-1 text-[20px] font-extrabold le-tnum text-[var(--le-ink)]">
            {totalMin}
            <span className="text-[11px] font-bold text-[var(--le-ink-3)]"> / {TARGET_MINUTES}m</span>
          </div>
          <div className="mt-1.5 h-1.5 rounded-full bg-[var(--le-hair-2)] overflow-hidden flex">
            {segments.length > 0 ? (
              segments.map((s) => (
                <div
                  key={s.key}
                  className="h-full"
                  style={{
                    width: `${(s.minutes / TARGET_MINUTES) * 100}%`,
                    background: s.color,
                    opacity: s.minutes ? 1 : 0.25,
                  }}
                />
              ))
            ) : (
              <div
                className="h-full bg-[var(--le-accent)]"
                style={{ width: `${Math.min(100, (totalMin / TARGET_MINUTES) * 100)}%` }}
              />
            )}
          </div>
          {segments.length > 0 && (
            <div className="mt-1.5 flex gap-2 flex-wrap">
              {segments.map((s) => (
                <div
                  key={s.key}
                  className="flex items-center gap-1 text-[10px] text-[var(--le-ink-2)]"
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
                  {s.short} {s.minutes}m
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Bloom's ── */}
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

        {/* ── Cognitive Load ── */}
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
            Derived from Bloom&apos;s mix · {activityCount} {activityCount === 1 ? "activity" : "activities"} in {totalMin}m.
          </div>
        </div>
      </div>
    </div>
  );
}
