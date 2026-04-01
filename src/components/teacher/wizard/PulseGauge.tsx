"use client";

/**
 * PulseGauge — compact arc gauge for Lesson Pulse dimension scores.
 *
 * Renders a small SVG semicircle arc that fills based on a 0-10 score.
 * Three instances (CR, SA, TC) are shown side-by-side on each lesson card.
 *
 * Colors: green (≥7), amber (≥5), red (<5)
 */

import type { LessonPulseScore } from "@/lib/layers/lesson-pulse";

interface GaugeProps {
  /** Score 0-10 */
  value: number;
  /** Short label (e.g., "CR", "SA", "TC") */
  label: string;
  /** Size in pixels */
  size?: number;
}

function scoreColor(v: number): string {
  if (v >= 7) return "#22c55e"; // green-500
  if (v >= 5) return "#f59e0b"; // amber-500
  return "#ef4444"; // red-500
}

function scoreLabel(v: number): string {
  if (v >= 8) return "Strong";
  if (v >= 6) return "Good";
  if (v >= 5) return "OK";
  if (v >= 3) return "Weak";
  return "Low";
}

/** Single arc gauge */
function Gauge({ value, label, size = 48 }: GaugeProps) {
  const r = (size - 6) / 2;
  const cx = size / 2;
  const cy = size / 2 + 2; // shift down slightly for semicircle
  const circumference = Math.PI * r; // half-circle
  const pct = Math.max(0, Math.min(10, value)) / 10;
  const dashLen = pct * circumference;
  const color = scoreColor(value);

  return (
    <div className="flex flex-col items-center gap-0.5">
      <svg width={size} height={size / 2 + 6} viewBox={`0 0 ${size} ${size / 2 + 6}`}>
        {/* Background arc */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="4"
          strokeLinecap="round"
        />
        {/* Filled arc */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${dashLen} ${circumference}`}
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
        {/* Score text */}
        <text
          x={cx}
          y={cy - 2}
          textAnchor="middle"
          fill={color}
          fontSize="11"
          fontWeight="700"
        >
          {value.toFixed(1)}
        </text>
      </svg>
      <span className="text-[9px] font-semibold text-text-secondary uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
}

/** Full dimension labels for tooltip/expanded view */
const DIMENSION_LABELS = {
  cr: "Cognitive Rigour",
  sa: "Student Agency",
  tc: "Teacher Craft",
};

interface PulseGaugesProps {
  pulse: LessonPulseScore;
  /** Compact = just arcs. Expanded = arcs + insights */
  variant?: "compact" | "expanded";
}

/** Row of 3 arc gauges + optional overall badge */
export default function PulseGauges({ pulse, variant = "compact" }: PulseGaugesProps) {
  const overallColor = scoreColor(pulse.overall);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3">
        <Gauge value={pulse.cognitiveRigour} label="CR" />
        <Gauge value={pulse.studentAgency} label="SA" />
        <Gauge value={pulse.teacherCraft} label="TC" />
        {/* Overall pill */}
        <div
          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-white text-[10px] font-bold"
          style={{ backgroundColor: overallColor }}
          title={`Overall: ${pulse.overall.toFixed(1)}/10 — ${scoreLabel(pulse.overall)}`}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z" />
          </svg>
          {pulse.overall.toFixed(1)}
        </div>
      </div>

      {/* Insights (expanded mode only) */}
      {variant === "expanded" && pulse.insights.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {pulse.insights.map((insight, i) => (
            <p key={i} className="text-[10px] text-text-secondary leading-tight">
              💡 {insight}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export { Gauge, DIMENSION_LABELS, scoreColor, scoreLabel };
