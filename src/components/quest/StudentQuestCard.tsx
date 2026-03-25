'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import type { QuestPhase, MentorId, HelpIntensity, HealthScore } from '@/lib/quest/types';
import { PHASE_LABELS } from '@/lib/quest/types';
import { getHealthColor } from '@/lib/quest/health';
import { getMentor } from '@/lib/quest/mentors';

interface JourneyWithMeta {
  id: string;
  student_id: string;
  phase: QuestPhase;
  mentor_id: MentorId | null;
  help_intensity: HelpIntensity;
  health_score: HealthScore;
  started_at: string;
  updated_at: string;
  students: { id: string; display_name: string };
  milestone_progress: { total: number; completed: number };
  pending_evidence_count: number;
}

interface StudentQuestCardProps {
  journey: JourneyWithMeta;
  onSelect?: (journeyId: string) => void;
  onQuickAction?: (action: string, journeyId: string) => void;
  isSelected?: boolean;
}

const PHASE_COLORS: Record<QuestPhase, string> = {
  not_started: '#6B7280',
  discovery: '#F59E0B',
  planning: '#6366F1',
  working: '#10B981',
  sharing: '#8B5CF6',
  completed: '#22C55E',
};

function calculateDaysActive(startedAt: string): number {
  const start = new Date(startedAt);
  const now = new Date();
  return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function countRedHealthDots(healthScore: HealthScore): number {
  const dots = [healthScore.momentum, healthScore.engagement, healthScore.quality, healthScore.self_awareness];
  return dots.filter(d => d === 'red').length;
}

function countRedOrAmberHealthDots(healthScore: HealthScore): number {
  const dots = [healthScore.momentum, healthScore.engagement, healthScore.quality, healthScore.self_awareness];
  return dots.filter(d => d === 'red' || d === 'amber').length;
}

export function StudentQuestCard({
  journey,
  onSelect,
  onQuickAction,
  isSelected = false,
}: StudentQuestCardProps) {
  const [isHovering, setIsHovering] = useState(false);
  const phaseColor = PHASE_COLORS[journey.phase];
  const daysActive = calculateDaysActive(journey.started_at);
  const redDotCount = countRedHealthDots(journey.health_score);
  const needsAttention = redDotCount >= 2 || journey.pending_evidence_count >= 5;
  const mentor = getMentor(journey.mentor_id);

  const progressPercent = journey.milestone_progress.total > 0
    ? (journey.milestone_progress.completed / journey.milestone_progress.total) * 100
    : 0;

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    backgroundColor: '#111827',
    border: isSelected ? `2px solid ${phaseColor}` : '1px solid #1e293b',
    borderRadius: '12px',
    padding: '0',
    overflow: 'hidden',
    cursor: 'pointer',
    boxShadow: isSelected ? `0 0 20px ${phaseColor}40` : '0 2px 8px #00000030',
    transition: 'all 0.2s ease-out',
  };

  const accentStripStyle: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '4px',
    backgroundColor: phaseColor,
  };

  const contentStyle: React.CSSProperties = {
    padding: '16px',
    paddingLeft: '12px',
  };

  const headerRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px',
    gap: '12px',
  };

  const studentNameStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 600,
    color: '#ffffff',
    flex: 1,
    minWidth: 0,
  };

  const phasePillStyle: React.CSSProperties = {
    display: 'inline-block',
    fontSize: '12px',
    fontWeight: 600,
    color: '#ffffff',
    backgroundColor: phaseColor,
    paddingLeft: '10px',
    paddingRight: '10px',
    paddingTop: '4px',
    paddingBottom: '4px',
    borderRadius: '16px',
    whiteSpace: 'nowrap',
  };

  const healthDotsContainerStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    marginBottom: '12px',
    alignItems: 'center',
    minHeight: '20px',
    backgroundColor: redDotCount > 0 ? '#7f1d1d30' : 'transparent',
    paddingLeft: '8px',
    borderRadius: '6px',
    transition: 'background-color 0.2s ease-out',
  };

  const healthDotStyle = (color: string): React.CSSProperties => ({
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: color,
    flex: 'none',
  });

  const progressBarStyle: React.CSSProperties = {
    height: '6px',
    backgroundColor: '#0f172a',
    borderRadius: '3px',
    overflow: 'hidden',
    marginBottom: '12px',
  };

  const progressFillStyle: React.CSSProperties = {
    height: '100%',
    width: `${progressPercent}%`,
    backgroundColor: phaseColor,
    transition: 'width 0.3s ease-out',
  };

  const progressLabelStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#94a3b8',
    marginTop: '4px',
  };

  const statsRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: '12px',
    color: '#cbd5e1',
  };

  const mentorCircleStyle: React.CSSProperties = {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: mentor?.primaryColor || '#6B7280',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    fontWeight: 700,
    color: '#ffffff',
    flex: 'none',
  };

  const helpBadgeStyle: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 600,
    backgroundColor: '#1e293b',
    color: '#cbd5e1',
    paddingLeft: '8px',
    paddingRight: '8px',
    paddingTop: '3px',
    paddingBottom: '3px',
    borderRadius: '4px',
  };

  const pendingBadgeStyle: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 600,
    backgroundColor: '#92400e',
    color: '#fef3c7',
    paddingLeft: '8px',
    paddingRight: '8px',
    paddingTop: '3px',
    paddingBottom: '3px',
    borderRadius: '4px',
  };

  const attentionIndicatorStyle: React.CSSProperties = {
    position: 'absolute',
    top: '12px',
    right: '12px',
    fontSize: '16px',
    opacity: 0.8,
  };

  const quickActionsContainerStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid #1e293b',
  };

  const buttonBaseStyle: React.CSSProperties = {
    flex: 1,
    padding: '8px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s ease-out',
  };

  const viewButtonStyle: React.CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: phaseColor,
    color: '#ffffff',
  };

  const approveButtonStyle: React.CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: journey.pending_evidence_count > 0 ? '#92400e' : '#1e293b',
    color: journey.pending_evidence_count > 0 ? '#fef3c7' : '#64748b',
    cursor: journey.pending_evidence_count > 0 ? 'pointer' : 'default',
    opacity: journey.pending_evidence_count > 0 ? 1 : 0.5,
  };

  const mentorLetterLetter = mentor ? mentor.name.charAt(0).toUpperCase() : '?';

  return (
    <motion.div
      style={containerStyle}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onClick={() => onSelect?.(journey.id)}
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      {/* Accent strip */}
      <div style={accentStripStyle} />

      {/* Attention indicator */}
      {needsAttention && <div style={attentionIndicatorStyle}>⚠️</div>}

      {/* Main content */}
      <div style={contentStyle}>
        {/* Header row */}
        <div style={headerRowStyle}>
          <div style={studentNameStyle} title={journey.students.display_name}>
            {journey.students.display_name}
          </div>
          <div style={phasePillStyle}>
            {PHASE_LABELS[journey.phase]}
          </div>
        </div>

        {/* Health dots */}
        <motion.div style={healthDotsContainerStyle}>
          <motion.div
            style={healthDotStyle(getHealthColor(journey.health_score.momentum))}
            animate={journey.health_score.momentum === 'red' ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 0.8, repeat: Infinity }}
            title="Momentum"
          />
          <motion.div
            style={healthDotStyle(getHealthColor(journey.health_score.engagement))}
            animate={journey.health_score.engagement === 'red' ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 0.8, repeat: Infinity }}
            title="Engagement"
          />
          <motion.div
            style={healthDotStyle(getHealthColor(journey.health_score.quality))}
            animate={journey.health_score.quality === 'red' ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 0.8, repeat: Infinity }}
            title="Quality"
          />
          <motion.div
            style={healthDotStyle(getHealthColor(journey.health_score.self_awareness))}
            animate={journey.health_score.self_awareness === 'red' ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 0.8, repeat: Infinity }}
            title="Self-Awareness"
          />
        </motion.div>

        {/* Progress bar */}
        <div style={progressBarStyle}>
          <motion.div
            style={progressFillStyle}
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ type: 'spring', stiffness: 100, damping: 15 }}
          />
        </div>
        <div style={progressLabelStyle}>
          {journey.milestone_progress.completed}/{journey.milestone_progress.total} milestones
        </div>

        {/* Stats row */}
        <div style={statsRowStyle}>
          {/* Mentor circle */}
          <div style={mentorCircleStyle} title={mentor?.name || 'No mentor'}>
            {mentorLetterLetter}
          </div>

          {/* Help intensity badge */}
          <div style={helpBadgeStyle}>
            {journey.help_intensity.charAt(0).toUpperCase() + journey.help_intensity.slice(1)}
          </div>

          {/* Days active */}
          <div style={{ flex: 1 }} title="Days since started">
            {daysActive}d
          </div>

          {/* Pending evidence badge */}
          {journey.pending_evidence_count > 0 && (
            <div style={pendingBadgeStyle}>
              {journey.pending_evidence_count} pending
            </div>
          )}
        </div>

        {/* Quick action buttons — revealed on hover */}
        {isHovering && (
          <motion.div
            style={quickActionsContainerStyle}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <button
              style={viewButtonStyle}
              onClick={(e) => {
                e.stopPropagation();
                onSelect?.(journey.id);
              }}
            >
              View
            </button>
            {journey.pending_evidence_count > 0 && (
              <button
                style={approveButtonStyle}
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickAction?.('approve_evidence', journey.id);
                }}
              >
                Approve ({journey.pending_evidence_count})
              </button>
            )}
            <button
              style={{
                ...buttonBaseStyle,
                backgroundColor: '#1e293b',
                color: '#cbd5e1',
              }}
              onClick={(e) => {
                e.stopPropagation();
                // Open menu for more actions
              }}
            >
              ⋯
            </button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

export default StudentQuestCard;
