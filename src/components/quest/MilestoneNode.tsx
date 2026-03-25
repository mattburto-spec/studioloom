'use client';

import type { QuestMilestone, MilestoneStatus } from '@/lib/quest/types';

interface MilestoneNodeProps {
  x: number;
  y: number;
  milestone: QuestMilestone;
  isActive: boolean;
  isReachable: boolean;
  onClick?: (milestone: QuestMilestone) => void;
}

const PHASE_COLORS: Record<string, string> = {
  discovery: '#F59E0B',
  planning: '#6366F1',
  working: '#10B981',
  sharing: '#8B5CF6',
  not_started: '#64748b',
  completed: '#EC4899',
};

function CheckmarkIcon() {
  return (
    <path
      d="M-4 0 L-1 3 L4 -4"
      stroke="white"
      strokeWidth={2}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

function XIcon() {
  return (
    <g>
      <line x1={-4} y1={-4} x2={4} y2={4} stroke="#EF4444" strokeWidth={2} strokeLinecap="round" />
      <line x1={4} y1={-4} x2={-4} y2={4} stroke="#EF4444" strokeWidth={2} strokeLinecap="round" />
    </g>
  );
}

function ExclamationIcon() {
  return (
    <g>
      <circle cx={0} cy={-2} r={1.5} fill="#F59E0B" />
      <line x1={0} y1={0} x2={0} y2={3} stroke="#F59E0B" strokeWidth={2} strokeLinecap="round" />
    </g>
  );
}

export function MilestoneNode({
  x,
  y,
  milestone,
  isActive,
  isReachable,
  onClick,
}: MilestoneNodeProps) {
  const phaseColor = PHASE_COLORS[milestone.phase] || '#64748b';
  const radius = 16;
  const isCompleted = milestone.status === 'completed';
  const isSkipped = milestone.status === 'skipped';
  const isOverdue = milestone.status === 'overdue';

  let fill = '#1e293b';
  let stroke = '#475569';
  let strokeWidth = 2;
  let strokeOpacity = 0.5;

  if (isCompleted) {
    fill = '#10B981';
    stroke = '#34D399';
    strokeOpacity = 1;
  } else if (isActive) {
    fill = '#1e293b';
    stroke = phaseColor;
    strokeOpacity = 1;
  } else if (isSkipped) {
    fill = '#1e293b';
    stroke = '#EF4444';
    strokeOpacity = 1;
  } else if (isOverdue) {
    fill = '#1e293b';
    stroke = '#F59E0B';
    strokeOpacity = 1;
  } else if (!isReachable) {
    fill = '#0f172a';
    stroke = '#334155';
    strokeOpacity = 0.3;
  } else if (isReachable) {
    fill = '#1e293b';
    stroke = '#475569';
    strokeOpacity = 0.6;
    // dashed stroke for upcoming reachable
    // SVG dashes handled via strokeDasharray
  }

  const isDashed = !isCompleted && !isActive && !isSkipped && !isOverdue && isReachable;

  return (
    <g
      transform={`translate(${x}, ${y})`}
      style={{
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={() => onClick?.(milestone)}
    >
      {/* Animated glow for active milestones */}
      {isActive && (
        <>
          <circle
            cx={0}
            cy={0}
            r={radius}
            fill="none"
            stroke={phaseColor}
            strokeWidth={2}
            strokeOpacity={0.2}
            style={{ animation: 'pulse-glow 2s ease-in-out infinite' }}
          />
          <style>
            {`
              @keyframes pulse-glow {
                0%, 100% { stroke-opacity: 0.2; r: ${radius}; }
                50% { stroke-opacity: 0.5; r: ${radius + 4}; }
              }
            `}
          </style>
        </>
      )}

      {/* Main circle */}
      <circle
        cx={0}
        cy={0}
        r={radius}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeOpacity={strokeOpacity}
        strokeDasharray={isDashed ? '4 4' : undefined}
        style={{
          transition: 'all 0.3s ease',
        }}
      />

      {/* Inner icon */}
      {isCompleted && <CheckmarkIcon />}
      {isSkipped && <XIcon />}
      {isOverdue && <ExclamationIcon />}

      {/* Label below */}
      <text
        x={0}
        y={28}
        textAnchor="middle"
        style={{
          fontSize: '10px',
          fontWeight: '500',
          fill: isReachable || isCompleted ? 'rgba(255, 255, 255, 0.7)' : 'rgba(100, 116, 139, 0.5)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          pointerEvents: 'none',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: '30px',
          whiteSpace: 'nowrap',
        }}
      >
        {milestone.title.substring(0, 15)}
        {milestone.title.length > 15 ? '…' : ''}
      </text>
    </g>
  );
}

export default MilestoneNode;
