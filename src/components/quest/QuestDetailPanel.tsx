'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useCallback } from 'react';
import { getHealthColor } from '@/lib/quest/health';
import { getMentor } from '@/lib/quest/mentors';
import type {
  QuestJourney,
  QuestMilestone,
  QuestEvidence,
  HelpIntensity,
  MilestoneStatus,
  EvidenceType,
} from '@/lib/quest/types';

interface QuestDetailPanelProps {
  journey: QuestJourney & { students: { display_name: string } };
  milestones: QuestMilestone[];
  evidence: QuestEvidence[];
  isOpen: boolean;
  onClose: () => void;
  onApproveEvidence?: (evidenceId: string, feedback?: string) => void;
  onRejectEvidence?: (evidenceId: string, feedback: string) => void;
  onUpdateHelpIntensity?: (journeyId: string, level: HelpIntensity) => void;
  onAddMilestoneNote?: (milestoneId: string, note: string) => void;
  onAdjustMilestoneDate?: (milestoneId: string, newDate: string) => void;
}

const PHASE_COLORS: Record<string, string> = {
  not_started: '#6b7280',
  discovery: '#f59e0b',
  planning: '#3b82f6',
  working: '#10b981',
  sharing: '#8b5cf6',
  completed: '#06b6d4',
};

const HEALTH_COLORS_MAP: Record<string, string> = {
  green: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
};

const EVIDENCE_ICONS: Record<EvidenceType, string> = {
  photo: '📷',
  voice: '🎤',
  text: '📝',
  file: '📎',
  link: '🔗',
  reflection: '💭',
  tool_session: '⚙️',
  ai_conversation: '🤖',
};

const PHASE_LABELS: Record<string, string> = {
  not_started: 'Not Started',
  discovery: 'Discovery',
  planning: 'Planning',
  working: 'Working',
  sharing: 'Sharing',
  completed: 'Completed',
};

const MILESTONE_STATUS_ICONS: Record<MilestoneStatus, { icon: string; color: string }> = {
  upcoming: { icon: '○', color: '#9ca3af' },
  active: { icon: '●', color: '#f59e0b' },
  completed: { icon: '✓', color: '#10b981' },
  skipped: { icon: '–', color: '#9ca3af' },
  overdue: { icon: '⚠', color: '#ef4444' },
};

function HealthGauge({ level, label }: { level: string; label: string }) {
  const color = HEALTH_COLORS_MAP[level] || '#9ca3af';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
      <div
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          backgroundColor: color,
          opacity: 0.2,
          border: `2px solid ${color}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: color,
          }}
        />
      </div>
      <div style={{ fontSize: '12px', color: '#a1a5b1', fontWeight: 500 }}>{label}</div>
    </div>
  );
}

function OverviewTab({ journey, onUpdateHelpIntensity }: { journey: QuestDetailPanelProps['journey']; onUpdateHelpIntensity?: (journeyId: string, level: HelpIntensity) => void }) {
  const health = journey.health_score;
  const mentor = journey.mentor_id ? getMentor(journey.mentor_id) : null;
  const daysActive = journey.started_at
    ? Math.floor((new Date().getTime() - new Date(journey.started_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <div style={{ padding: '16px' }}>
      {/* Health Score */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#e5e7eb', marginBottom: '12px' }}>
          Health Score
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
          <HealthGauge level={health.momentum} label="Momentum" />
          <HealthGauge level={health.engagement} label="Engagement" />
          <HealthGauge level={health.quality} label="Quality" />
          <HealthGauge level={health.self_awareness} label="Self-Aware" />
        </div>
        <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '8px' }}>
          Check-in interval: {health.check_in_interval_minutes} min
        </div>
      </div>

      {/* Help Intensity */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#e5e7eb', marginBottom: '12px' }}>
          Help Intensity
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['explorer', 'guided', 'supported', 'auto'] as const).map((level) => (
            <button
              key={level}
              onClick={() => onUpdateHelpIntensity?.(journey.id, level)}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: journey.help_intensity === level ? `2px solid #3b82f6` : '1px solid #374151',
                backgroundColor: journey.help_intensity === level ? '#1e40af' : '#1e293b',
                color: '#e5e7eb',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 500,
                transition: 'all 0.2s',
              }}
            >
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Mentor */}
      {mentor && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#e5e7eb', marginBottom: '8px' }}>
            Mentor
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: '#6366f1',
                opacity: 0.3,
                border: `2px solid #6366f1`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
              }}
            >
              🌟
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: '#e5e7eb' }}>{mentor.name}</div>
              <div style={{ fontSize: '11px', color: '#9ca3af' }}>{mentor.archetype}</div>
            </div>
          </div>
        </div>
      )}

      {/* Discovery Profile */}
      {journey.discovery_profile && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#e5e7eb', marginBottom: '12px' }}>
            Profile
          </div>
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', color: '#a1a5b1', marginBottom: '6px' }}>Strengths</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {journey.discovery_profile.strengths.map((s, i) => (
                <span
                  key={i}
                  style={{
                    backgroundColor: '#064e3b',
                    color: '#10b981',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 500,
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', color: '#a1a5b1', marginBottom: '6px' }}>Interests</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {journey.discovery_profile.interests.map((s, i) => (
                <span
                  key={i}
                  style={{
                    backgroundColor: '#1e3a8a',
                    color: '#3b82f6',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 500,
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', color: '#a1a5b1', marginBottom: '6px' }}>Needs</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {journey.discovery_profile.needs.map((s, i) => (
                <span
                  key={i}
                  style={{
                    backgroundColor: '#78350f',
                    color: '#f59e0b',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 500,
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
          {journey.discovery_profile.archetype && (
            <div
              style={{
                backgroundColor: '#5b21b6',
                color: '#c4b5fd',
                padding: '8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 500,
                marginTop: '8px',
              }}
            >
              Archetype: {journey.discovery_profile.archetype}
            </div>
          )}
          {journey.discovery_profile.project_idea && (
            <div
              style={{
                backgroundColor: '#1e293b',
                border: '1px solid #374151',
                borderLeft: `3px solid #8b5cf6`,
                color: '#e5e7eb',
                padding: '8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontStyle: 'italic',
                marginTop: '8px',
              }}
            >
              "{journey.discovery_profile.project_idea}"
            </div>
          )}
        </div>
      )}

      {/* Contract Summary */}
      {journey.contract && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#e5e7eb', marginBottom: '12px' }}>
            Project Contract
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '11px' }}>
            <div>
              <div style={{ color: '#a1a5b1', marginBottom: '4px' }}>What</div>
              <div style={{ color: '#e5e7eb', fontWeight: 500 }}>{journey.contract.what}</div>
            </div>
            <div>
              <div style={{ color: '#a1a5b1', marginBottom: '4px' }}>For Whom</div>
              <div style={{ color: '#e5e7eb', fontWeight: 500 }}>{journey.contract.who_for}</div>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ color: '#a1a5b1', marginBottom: '4px' }}>Done Looks Like</div>
              <div style={{ color: '#e5e7eb', fontWeight: 500 }}>{journey.contract.done_looks_like}</div>
            </div>
            <div>
              <div style={{ color: '#a1a5b1', marginBottom: '4px' }}>Help Needed</div>
              <div style={{ color: '#e5e7eb', fontWeight: 500 }}>{journey.contract.help_needed}</div>
            </div>
            <div>
              <div style={{ color: '#a1a5b1', marginBottom: '4px' }}>Success Criteria</div>
              <div style={{ color: '#e5e7eb', fontWeight: 500 }}>{journey.contract.success_criteria}</div>
            </div>
          </div>
          <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '8px' }}>
            Confirmed {new Date(journey.contract.confirmed_at).toLocaleDateString()}
          </div>
        </div>
      )}

      {/* Stats */}
      <div>
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#e5e7eb', marginBottom: '12px' }}>
          Activity
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            fontSize: '12px',
          }}
        >
          <div style={{ backgroundColor: '#1e293b', padding: '8px', borderRadius: '6px' }}>
            <div style={{ color: '#a1a5b1', marginBottom: '4px' }}>Days Active</div>
            <div style={{ color: '#06b6d4', fontWeight: 600, fontSize: '16px' }}>{daysActive}</div>
          </div>
          <div style={{ backgroundColor: '#1e293b', padding: '8px', borderRadius: '6px' }}>
            <div style={{ color: '#a1a5b1', marginBottom: '4px' }}>Sessions</div>
            <div style={{ color: '#06b6d4', fontWeight: 600, fontSize: '16px' }}>{journey.total_sessions}</div>
          </div>
          <div style={{ backgroundColor: '#1e293b', padding: '8px', borderRadius: '6px' }}>
            <div style={{ color: '#a1a5b1', marginBottom: '4px' }}>Evidence Items</div>
            <div style={{ color: '#06b6d4', fontWeight: 600, fontSize: '16px' }}>{journey.total_evidence_count}</div>
          </div>
          <div style={{ backgroundColor: '#1e293b', padding: '8px', borderRadius: '6px' }}>
            <div style={{ color: '#a1a5b1', marginBottom: '4px' }}>Phase</div>
            <div style={{ color: PHASE_COLORS[journey.phase] || '#9ca3af', fontWeight: 600, fontSize: '13px' }}>
              {PHASE_LABELS[journey.phase]}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MilestonesTab({
  milestones,
  onAddMilestoneNote,
  onAdjustMilestoneDate,
}: {
  milestones: QuestMilestone[];
  onAddMilestoneNote?: (milestoneId: string, note: string) => void;
  onAdjustMilestoneDate?: (milestoneId: string, newDate: string) => void;
}) {
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
  const [editingDateId, setEditingDateId] = useState<string | null>(null);

  const sorted = [...milestones].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div style={{ padding: '16px' }}>
      {sorted.length === 0 ? (
        <div style={{ color: '#9ca3af', fontSize: '12px', textAlign: 'center', paddingTop: '32px' }}>
          No milestones defined yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {sorted.map((ms) => {
            const statusIcon = MILESTONE_STATUS_ICONS[ms.status];
            return (
              <div
                key={ms.id}
                style={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  padding: '12px',
                  fontSize: '12px',
                }}
              >
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <div
                    style={{
                      color: statusIcon.color,
                      fontSize: '16px',
                      fontWeight: 'bold',
                      minWidth: '20px',
                    }}
                  >
                    {statusIcon.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#e5e7eb', fontWeight: 600, marginBottom: '2px' }}>
                      {ms.title}
                    </div>
                    {ms.description && (
                      <div style={{ color: '#9ca3af', fontSize: '11px', marginBottom: '6px' }}>
                        {ms.description}
                      </div>
                    )}
                    {(ms.specific || ms.measurable) && (
                      <div style={{ color: '#6b7280', fontSize: '10px', fontStyle: 'italic', marginBottom: '6px' }}>
                        {ms.specific && `✓ Specific: ${ms.specific}`}
                        {ms.specific && ms.measurable && ' | '}
                        {ms.measurable && `✓ Measurable: ${ms.measurable}`}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                      {editingDateId === ms.id ? (
                        <input
                          type="date"
                          defaultValue={ms.target_date?.split('T')[0] || ''}
                          onBlur={(e) => {
                            if (e.target.value) {
                              onAdjustMilestoneDate?.(ms.id, e.target.value);
                            }
                            setEditingDateId(null);
                          }}
                          autoFocus
                          style={{
                            padding: '4px',
                            borderRadius: '4px',
                            border: '1px solid #374151',
                            backgroundColor: '#0f172a',
                            color: '#e5e7eb',
                            fontSize: '11px',
                          }}
                        />
                      ) : (
                        <button
                          onClick={() => setEditingDateId(ms.id)}
                          style={{
                            fontSize: '11px',
                            color: ms.target_date ? '#a1a5b1' : '#6b7280',
                            cursor: 'pointer',
                            border: 'none',
                            background: 'none',
                            padding: 0,
                          }}
                        >
                          📅 {ms.target_date ? new Date(ms.target_date).toLocaleDateString() : 'No date'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Teacher note */}
                <textarea
                  placeholder="Add teacher note..."
                  value={noteInputs[ms.id] || ms.teacher_note || ''}
                  onChange={(e) => setNoteInputs({ ...noteInputs, [ms.id]: e.target.value })}
                  onBlur={(e) => {
                    if (e.target.value !== (ms.teacher_note || '')) {
                      onAddMilestoneNote?.(ms.id, e.target.value);
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '6px',
                    borderRadius: '4px',
                    border: '1px solid #374151',
                    backgroundColor: '#0f172a',
                    color: '#e5e7eb',
                    fontSize: '11px',
                    minHeight: '48px',
                    resize: 'none',
                    fontFamily: 'inherit',
                  }}
                />

                {ms.completion_note && (
                  <div
                    style={{
                      backgroundColor: '#0f172a',
                      border: '1px solid #374151',
                      borderLeft: `3px solid ${HEALTH_COLORS_MAP.green}`,
                      padding: '6px',
                      borderRadius: '4px',
                      marginTop: '8px',
                      fontSize: '10px',
                      color: '#9ca3af',
                      fontStyle: 'italic',
                    }}
                  >
                    Student: "{ms.completion_note}"
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EvidenceTab({
  evidence,
  milestones,
  onApproveEvidence,
  onRejectEvidence,
}: {
  evidence: QuestEvidence[];
  milestones: QuestMilestone[];
  onApproveEvidence?: (evidenceId: string, feedback?: string) => void;
  onRejectEvidence?: (evidenceId: string, feedback: string) => void;
}) {
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved'>('all');
  const [approvalFeedback, setApprovalFeedback] = useState<Record<string, string>>({});
  const [rejectionFeedback, setRejectionFeedback] = useState<Record<string, string>>({});
  const [showRejectForm, setShowRejectForm] = useState<string | null>(null);

  const filtered = evidence.filter((e) => {
    if (filterStatus === 'pending') return !e.approved_by_teacher;
    if (filterStatus === 'approved') return e.approved_by_teacher;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const getMilestoneTitle = (milestoneId: string | null) => {
    if (!milestoneId) return null;
    return milestones.find((m) => m.id === milestoneId)?.title;
  };

  const contentPreview = (e: QuestEvidence) => {
    if (e.type === 'file' || e.type === 'link') {
      return e.file_url || '(no link)';
    }
    if (e.content) {
      return e.content.substring(0, 100) + (e.content.length > 100 ? '...' : '');
    }
    return '(empty)';
  };

  return (
    <div style={{ padding: '16px' }}>
      {/* Filter pills */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
        {(['all', 'pending', 'approved'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            style={{
              padding: '6px 10px',
              borderRadius: '4px',
              border: filterStatus === status ? '1px solid #3b82f6' : '1px solid #374151',
              backgroundColor: filterStatus === status ? '#1e40af' : '#1e293b',
              color: '#e5e7eb',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 500,
            }}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Evidence list */}
      {sorted.length === 0 ? (
        <div style={{ color: '#9ca3af', fontSize: '12px', textAlign: 'center', paddingTop: '32px' }}>
          No evidence items in this filter.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <AnimatePresence>
            {sorted.map((e) => {
              const icon = EVIDENCE_ICONS[e.type] || '📎';
              const isRejecting = showRejectForm === e.id;

              return (
                <motion.div
                  key={e.id}
                  initial={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 520 }}
                  transition={{ duration: 0.3 }}
                  style={{
                    backgroundColor: '#1e293b',
                    border: e.approved_by_teacher ? '1px solid #10b981' : '1px solid #374151',
                    borderRadius: '8px',
                    padding: '12px',
                    fontSize: '12px',
                  }}
                >
                  {/* Header */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: '16px' }}>{icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#e5e7eb', fontWeight: 500, marginBottom: '2px' }}>
                        {e.type.charAt(0).toUpperCase() + e.type.slice(1).replace('_', ' ')}
                      </div>
                      <div style={{ color: '#9ca3af', fontSize: '11px', marginBottom: '4px' }}>
                        {contentPreview(e)}
                      </div>
                      <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '4px' }}>
                        {new Date(e.created_at).toLocaleDateString()}
                        {getMilestoneTitle(e.milestone_id) && ` • ${getMilestoneTitle(e.milestone_id)}`}
                      </div>
                      <div style={{ fontSize: '10px', color: e.approved_by_teacher ? '#10b981' : '#f59e0b' }}>
                        {e.approved_by_teacher ? '✓ Approved' : '⏳ Pending'}
                      </div>
                    </div>
                  </div>

                  {/* Approval controls */}
                  {!e.approved_by_teacher && !isRejecting && (
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                      <button
                        onClick={() => {
                          onApproveEvidence?.(e.id, approvalFeedback[e.id]);
                          setApprovalFeedback({ ...approvalFeedback, [e.id]: '' });
                        }}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '4px',
                          backgroundColor: '#065f46',
                          color: '#10b981',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: 500,
                        }}
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={() => setShowRejectForm(e.id)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '4px',
                          backgroundColor: 'transparent',
                          color: '#ef4444',
                          border: '1px solid #ef4444',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: 500,
                        }}
                      >
                        ✕ Reject
                      </button>
                    </div>
                  )}

                  {/* Rejection form */}
                  {isRejecting && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <textarea
                        placeholder="Rejection feedback (required)..."
                        value={rejectionFeedback[e.id] || ''}
                        onChange={(evt) => setRejectionFeedback({ ...rejectionFeedback, [e.id]: evt.currentTarget.value })}
                        style={{
                          padding: '6px',
                          borderRadius: '4px',
                          border: '1px solid #374151',
                          backgroundColor: '#0f172a',
                          color: '#e5e7eb',
                          fontSize: '11px',
                          minHeight: '48px',
                          resize: 'none',
                          fontFamily: 'inherit',
                        }}
                      />
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => {
                            if (rejectionFeedback[e.id]) {
                              onRejectEvidence?.(e.id, rejectionFeedback[e.id]);
                              setRejectionFeedback({ ...rejectionFeedback, [e.id]: '' });
                              setShowRejectForm(null);
                            }
                          }}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '4px',
                            backgroundColor: '#7f1d1d',
                            color: '#ef4444',
                            border: 'none',
                            cursor: rejectionFeedback[e.id] ? 'pointer' : 'not-allowed',
                            fontSize: '11px',
                            fontWeight: 500,
                            opacity: rejectionFeedback[e.id] ? 1 : 0.5,
                          }}
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => setShowRejectForm(null)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '4px',
                            backgroundColor: '#1e293b',
                            color: '#9ca3af',
                            border: '1px solid #374151',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 500,
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Teacher feedback */}
                  {e.teacher_feedback && (
                    <div
                      style={{
                        backgroundColor: '#0f172a',
                        border: '1px solid #374151',
                        borderLeft: `3px solid ${e.approved_by_teacher ? HEALTH_COLORS_MAP.green : '#ef4444'}`,
                        padding: '6px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        color: '#9ca3af',
                        fontStyle: 'italic',
                      }}
                    >
                      Teacher: "{e.teacher_feedback}"
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function HistoryTab() {
  return (
    <div style={{ padding: '16px', textAlign: 'center', color: '#6b7280' }}>
      <div style={{ fontSize: '32px', marginBottom: '8px' }}>📅</div>
      <div style={{ fontSize: '12px' }}>Coming soon</div>
      <div style={{ fontSize: '11px', color: '#4b5563', marginTop: '4px' }}>
        Mentor interaction history and timeline
      </div>
    </div>
  );
}

export function QuestDetailPanel({
  journey,
  milestones,
  evidence,
  isOpen,
  onClose,
  onApproveEvidence,
  onRejectEvidence,
  onUpdateHelpIntensity,
  onAddMilestoneNote,
  onAdjustMilestoneDate,
}: QuestDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'milestones' | 'evidence' | 'history'>('overview');
  const phaseColor = PHASE_COLORS[journey.phase] || '#9ca3af';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 40,
            }}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: 520 }}
            animate={{ x: 0 }}
            exit={{ x: 520 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{
              position: 'fixed',
              right: 0,
              top: 0,
              bottom: 0,
              width: '520px',
              backgroundColor: '#0f172a',
              borderLeft: '1px solid #1e293b',
              zIndex: 50,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.4)',
            }}
          >
            {/* Sticky Header */}
            <div
              style={{
                padding: '16px',
                borderBottom: '1px solid #1e293b',
                backgroundColor: '#0f172a',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#e5e7eb', marginBottom: '6px' }}>
                    {journey.students.display_name}
                  </div>
                  <div
                    style={{
                      display: 'inline-block',
                      backgroundColor: phaseColor,
                      color: '#0f172a',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                    }}
                  >
                    {PHASE_LABELS[journey.phase]}
                  </div>
                </div>
                <button
                  onClick={onClose}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: '#9ca3af',
                    fontSize: '20px',
                    cursor: 'pointer',
                    padding: '0',
                    width: '24px',
                    height: '24px',
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Tab Bar */}
            <div
              style={{
                display: 'flex',
                borderBottom: '1px solid #1e293b',
                backgroundColor: '#0f172a',
                padding: '0 12px',
                flexShrink: 0,
              }}
            >
              {(['overview', 'milestones', 'evidence', 'history'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: activeTab === tab ? '#e5e7eb' : '#9ca3af',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: activeTab === tab ? 600 : 500,
                    borderBottom: activeTab === tab ? `2px solid ${phaseColor}` : 'none',
                    marginBottom: '-1px',
                    transition: 'all 0.2s',
                  }}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <AnimatePresence mode="wait">
                {activeTab === 'overview' && (
                  <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <OverviewTab journey={journey} onUpdateHelpIntensity={onUpdateHelpIntensity} />
                  </motion.div>
                )}
                {activeTab === 'milestones' && (
                  <motion.div key="milestones" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <MilestonesTab
                      milestones={milestones}
                      onAddMilestoneNote={onAddMilestoneNote}
                      onAdjustMilestoneDate={onAdjustMilestoneDate}
                    />
                  </motion.div>
                )}
                {activeTab === 'evidence' && (
                  <motion.div key="evidence" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <EvidenceTab
                      evidence={evidence}
                      milestones={milestones}
                      onApproveEvidence={onApproveEvidence}
                      onRejectEvidence={onRejectEvidence}
                    />
                  </motion.div>
                )}
                {activeTab === 'history' && (
                  <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <HistoryTab />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default QuestDetailPanel;
