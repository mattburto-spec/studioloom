'use client';

import type { QuestPhase } from '@/lib/quest/types';

interface PhaseRegionProps {
  phase: QuestPhase;
  currentPhase: QuestPhase;
  x: number;
  width: number;
  height: number;
  label: string;
}

const PHASE_ORDER: QuestPhase[] = [
  'not_started',
  'discovery',
  'planning',
  'working',
  'sharing',
  'completed',
];

const PHASE_COLORS: Record<QuestPhase, { bg: string; base: string }> = {
  not_started: { bg: 'rgba(100, 116, 139, 0.08)', base: '#64748b' },
  discovery: { bg: 'rgba(245, 158, 11, 0.08)', base: '#F59E0B' },
  planning: { bg: 'rgba(99, 102, 241, 0.08)', base: '#6366F1' },
  working: { bg: 'rgba(16, 185, 129, 0.08)', base: '#10B981' },
  sharing: { bg: 'rgba(139, 92, 246, 0.08)', base: '#8B5CF6' },
  completed: { bg: 'rgba(236, 72, 153, 0.08)', base: '#EC4899' },
};

export function PhaseRegion({
  phase,
  currentPhase,
  x,
  width,
  height,
  label,
}: PhaseRegionProps) {
  const phaseIndex = PHASE_ORDER.indexOf(phase);
  const currentIndex = PHASE_ORDER.indexOf(currentPhase);

  // Compute saturation: phases at or before current are full saturation,
  // phases after are nearly grayscale (0.05)
  const isSaturated = phaseIndex <= currentIndex;
  const saturation = isSaturated ? 1 : 0.05;

  const colors = PHASE_COLORS[phase];
  const centerX = x + width / 2;
  const centerY = height / 2;

  // Desaturated tint color if needed
  const bgColor = isSaturated
    ? colors.bg
    : `rgba(100, 116, 139, 0.03)`;

  const labelColor = isSaturated
    ? colors.base
    : 'rgba(100, 116, 139, 0.4)';

  return (
    <g style={{ filter: `saturate(${saturation})` }}>
      {/* Background rectangle */}
      <rect
        x={x}
        y={0}
        width={width}
        height={height}
        fill={bgColor}
        style={{ pointerEvents: 'none' }}
      />

      {/* Watercolor overlay ellipse */}
      <defs>
        <radialGradient id={`phase-gradient-${phase}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={colors.base} stopOpacity={0.05} />
          <stop offset="100%" stopColor={colors.base} stopOpacity={0.01} />
        </radialGradient>
      </defs>
      <ellipse
        cx={centerX}
        cy={centerY}
        rx={width * 0.4}
        ry={height * 0.35}
        fill={`url(#phase-gradient-${phase})`}
        style={{ pointerEvents: 'none' }}
      />

      {/* Phase label */}
      <text
        x={centerX}
        y={height - 20}
        textAnchor="middle"
        style={{
          fontSize: '11px',
          fontWeight: '600',
          letterSpacing: '0.15em',
          fill: labelColor,
          textTransform: 'uppercase',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          pointerEvents: 'none',
        }}
      >
        {label}
      </text>

      {/* Vertical dashed separator at right edge */}
      <line
        x1={x + width}
        y1={0}
        x2={x + width}
        y2={height}
        stroke="rgba(100, 116, 139, 0.2)"
        strokeWidth={1}
        strokeDasharray="4 4"
        style={{ pointerEvents: 'none' }}
      />
    </g>
  );
}

export default PhaseRegion;
