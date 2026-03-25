'use client';

import { useMemo } from 'react';
import type { QuestPhase, QuestMilestone, MentorId } from '@/lib/quest/types';
import { computeMapLayout, getActiveNodeId } from '@/lib/quest/map-layout';
import { getMentor } from '@/lib/quest/mentors';
import PhaseRegion from './PhaseRegion';
import MilestoneNode from './MilestoneNode';
import JourneyPath from './JourneyPath';
import StudentMarker from './StudentMarker';
import PhaseTransition from './PhaseTransition';

interface OverworldMapProps {
  milestones: QuestMilestone[];
  currentPhase: QuestPhase;
  mentorId?: MentorId | null;
  onMilestoneClick?: (milestone: QuestMilestone) => void;
  onPhaseGateClick?: (phase: QuestPhase) => void;
  showTransition?: QuestPhase | null;
  onTransitionComplete?: () => void;
  compact?: boolean;
}

const PHASE_ORDER: QuestPhase[] = [
  'not_started',
  'discovery',
  'planning',
  'working',
  'sharing',
  'completed',
];

const PHASE_CONFIG: Record<
  QuestPhase,
  {
    emoji: string;
    label: string;
    color: string;
    glowColor: string;
  }
> = {
  not_started: {
    emoji: '🌟',
    label: 'Start',
    color: '#6B7280',
    glowColor: '#D1D5DB',
  },
  discovery: {
    emoji: '🔍',
    label: 'Discovery',
    color: '#F59E0B',
    glowColor: '#FCD34D',
  },
  planning: {
    emoji: '📋',
    label: 'Planning',
    color: '#6366F1',
    glowColor: '#A5B4FC',
  },
  working: {
    emoji: '⚡',
    label: 'Working',
    color: '#10B981',
    glowColor: '#6EE7B7',
  },
  sharing: {
    emoji: '🎤',
    label: 'Sharing',
    color: '#8B5CF6',
    glowColor: '#C4B5FD',
  },
  completed: {
    emoji: '🏆',
    label: 'Complete',
    color: '#EC4899',
    glowColor: '#F9A8D4',
  },
};

export default function OverworldMap({
  milestones,
  currentPhase,
  mentorId,
  onMilestoneClick,
  onPhaseGateClick,
  showTransition,
  onTransitionComplete,
  compact = false,
}: OverworldMapProps) {
  // Compute layout
  const layout = useMemo(
    () => computeMapLayout(milestones, currentPhase),
    [milestones, currentPhase]
  );

  // Get active node ID
  const activeNodeId = useMemo(
    () => getActiveNodeId(milestones, currentPhase),
    [milestones, currentPhase]
  );

  // Get mentor color
  const mentor = mentorId ? getMentor(mentorId) : null;
  const mentorColor = mentor?.primaryColor || '#A78BFA';

  // Determine which phases are reached
  const currentPhaseIndex = PHASE_ORDER.indexOf(currentPhase);
  const reachedPhases = new Set(PHASE_ORDER.slice(0, currentPhaseIndex + 1));

  // Container styles
  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    backgroundColor: '#0B0F1A',
    borderRadius: '16px',
    border: '1px solid #1e293b',
    overflow: compact ? 'auto' : 'hidden',
  };

  // SVG wrapper styles
  const svgWrapperStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    minHeight: compact ? '600px' : '500px',
  };

  return (
    <div style={containerStyle}>
      <div style={svgWrapperStyle}>
        <svg
          viewBox={`0 0 ${layout.viewBox.width} ${layout.viewBox.height}`}
          preserveAspectRatio="xMidYMid meet"
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
          }}
        >
          {/* Phase regions (background) */}
          {PHASE_ORDER.map((phase, index) => {
            const x = (index / PHASE_ORDER.length) * layout.viewBox.width;
            const width = layout.viewBox.width / PHASE_ORDER.length;
            const config = PHASE_CONFIG[phase];

            return (
              <PhaseRegion
                key={`region-${phase}`}
                x={x}
                width={width}
                height={layout.viewBox.height}
                phase={phase}
                currentPhase={currentPhase}
                label={config.label}
              />
            );
          })}

          {/* Journey paths (edges) */}
          {layout.edges.map((edge, idx) => {
            const fromNode = layout.nodes.find((n) => n.id === edge.from);
            const toNode = layout.nodes.find((n) => n.id === edge.to);

            if (!fromNode || !toNode) return null;

            const fromPhaseIndex = PHASE_ORDER.indexOf(fromNode.phase);
            const toPhaseIndex = PHASE_ORDER.indexOf(toNode.phase);
            const isTraversed =
              fromPhaseIndex <= currentPhaseIndex &&
              toPhaseIndex <= currentPhaseIndex;
            const isActive =
              fromNode.id === activeNodeId || toNode.id === activeNodeId;

            return (
              <JourneyPath
                key={`path-${idx}`}
                fromX={fromNode.x}
                fromY={fromNode.y}
                toX={toNode.x}
                toY={toNode.y}
                phase={edge.phase as string}
                isTraversed={isTraversed}
                isActive={isActive}
              />
            );
          })}

          {/* Milestone nodes */}
          {layout.nodes
            .filter((node) => node.type === 'milestone')
            .map((node) => {
              const milestone = node.milestoneData;
              if (!milestone) return null;

              const nodePhaseIndex = PHASE_ORDER.indexOf(node.phase);
              const isReachable = nodePhaseIndex <= currentPhaseIndex;
              const isActive = node.id === activeNodeId;

              return (
                <MilestoneNode
                  key={node.id}
                  x={node.x}
                  y={node.y}
                  milestone={milestone}
                  isActive={isActive}
                  isReachable={isReachable}
                  onClick={
                    isReachable && onMilestoneClick
                      ? (m) => onMilestoneClick(m)
                      : undefined
                  }
                />
              );
            })}

          {/* Phase gates */}
          {layout.nodes
            .filter((node) => node.type === 'gate')
            .map((node) => {
              const gatePhase = PHASE_ORDER.find((p) => p === node.phase);
              if (!gatePhase) return null;

              const config = PHASE_CONFIG[gatePhase];
              const gatePhaseIndex = PHASE_ORDER.indexOf(gatePhase);
              const isReachable = gatePhaseIndex <= currentPhaseIndex;

              return (
                <g key={`gate-${gatePhase}`}>
                  {/* Outer ring */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r="22"
                    fill="#0f172a"
                    stroke={config.color}
                    strokeWidth="2"
                    style={{
                      cursor: isReachable ? 'pointer' : 'default',
                      opacity: isReachable ? 1 : 0.4,
                    }}
                    onClick={() => {
                      if (isReachable && onPhaseGateClick) {
                        onPhaseGateClick(gatePhase);
                      }
                    }}
                  />

                  {/* Inner ring */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r="18"
                    fill="#0f172a"
                    stroke={config.color}
                    strokeWidth="1"
                    style={{
                      cursor: isReachable ? 'pointer' : 'default',
                      opacity: isReachable ? 0.6 : 0.2,
                    }}
                    onClick={() => {
                      if (isReachable && onPhaseGateClick) {
                        onPhaseGateClick(gatePhase);
                      }
                    }}
                  />

                  {/* Phase emoji */}
                  <text
                    x={node.x}
                    y={node.y}
                    textAnchor="middle"
                    dy="0.3em"
                    fontSize="16"
                    style={{
                      pointerEvents: 'none',
                      userSelect: 'none',
                    }}
                  >
                    {config.emoji}
                  </text>

                  {/* Phase label below gate */}
                  <text
                    x={node.x}
                    y={node.y + 36}
                    textAnchor="middle"
                    fontSize="11"
                    fill={config.glowColor}
                    style={{
                      fontWeight: 'bold',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      pointerEvents: 'none',
                      userSelect: 'none',
                    }}
                  >
                    {config.label}
                  </text>
                </g>
              );
            })}

          {/* Student marker at active node */}
          {layout.nodes.map((node) => {
            if (node.id === activeNodeId) {
              return (
                <StudentMarker
                  key="student-marker"
                  x={node.x}
                  y={node.y}
                  mentorColor={mentorColor}
                />
              );
            }
            return null;
          })}
        </svg>
      </div>

      {/* Phase transition overlay */}
      {showTransition && (
        <PhaseTransition
          phase={showTransition}
          isVisible={!!showTransition}
          onComplete={onTransitionComplete}
        />
      )}
    </div>
  );
}
