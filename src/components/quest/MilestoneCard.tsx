'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { QuestMilestone, QuestEvidence, MilestoneStatus } from '@/lib/quest/types';

export interface MilestoneCardProps {
  milestone: QuestMilestone;
  evidence: QuestEvidence[];
  isActive?: boolean;
  mentorColor?: string;
  onStatusChange?: (milestoneId: string, status: MilestoneStatus, note?: string) => void;
  onAddEvidence?: (milestoneId: string) => void;
  onClick?: (milestone: QuestMilestone) => void;
}

const STATUS_ICON: Record<MilestoneStatus, string> = {
  upcoming: '⏳',
  active: '🔵',
  completed: '✅',
  skipped: '⏭️',
  overdue: '⚠️',
};

const STATUS_BORDER: Record<MilestoneStatus, string> = {
  active: 'solid',
  completed: 'solid',
  upcoming: 'solid',
  overdue: 'solid',
  skipped: 'dashed',
};

const STATUS_COLOR: Record<MilestoneStatus, string> = {
  active: '#A78BFA', // mentorColor
  completed: '#10B981',
  upcoming: '#4B5563',
  overdue: '#F59E0B',
  skipped: '#6B7280',
};

const SOURCE_BADGE_COLOR: Record<string, { bg: string; text: string; label: string }> = {
  template: { bg: '#1E40AF', text: '#93C5FD', label: 'Template' },
  student: { bg: '#5B21B6', text: '#D8B4FE', label: 'Student' },
  teacher: { bg: '#065F46', text: '#6EE7B7', label: 'Teacher' },
  ai_suggested: { bg: '#78350F', text: '#FCD34D', label: 'AI' },
};

export function MilestoneCard({
  milestone,
  evidence,
  isActive = false,
  mentorColor = '#A78BFA',
  onStatusChange,
  onAddEvidence,
  onClick,
}: MilestoneCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionNote, setCompletionNote] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const borderColor = milestone.status === 'active' ? mentorColor : STATUS_COLOR[milestone.status];

  // Calculate days remaining / overdue
  const getDateStatus = () => {
    if (!milestone.target_date) return null;
    const target = new Date(milestone.target_date);
    const now = new Date();
    const daysLeft = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) {
      return { text: `${Math.abs(daysLeft)} days overdue`, color: '#EF4444' };
    } else if (daysLeft === 0) {
      return { text: 'Today!', color: '#FBBF24' };
    } else {
      return { text: `${daysLeft} days left`, color: '#10B981' };
    }
  };

  const dateStatus = getDateStatus();
  const wordCount = completionNote.trim().split(/\s+/).length;
  const isCompletionValid = wordCount >= 5;

  const handleMarkComplete = () => {
    if (isCompletionValid && onStatusChange) {
      onStatusChange(milestone.id, 'completed', completionNote);
      setCompletionNote('');
      setShowCompletionModal(false);
    }
  };

  const handleSkip = () => {
    if (onStatusChange) {
      onStatusChange(milestone.id, 'skipped');
      setShowMenu(false);
    }
  };

  const truncatedDescription = showMore || !milestone.description
    ? milestone.description
    : milestone.description.substring(0, 120) + (milestone.description.length > 120 ? '...' : '');

  const sourceBadge = SOURCE_BADGE_COLOR[milestone.source];

  return (
    <motion.div
      onClick={() => onClick?.(milestone)}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        backgroundColor: '#111827',
        borderRadius: '12px',
        padding: '16px',
        borderLeft: `${STATUS_BORDER[milestone.status] === 'dashed' ? '2px dashed' : '3px solid'} ${borderColor}`,
        boxShadow: isActive ? `0 0 12px ${borderColor}40` : '0 2px 8px rgba(0,0,0,0.3)',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
      }}
      whileHover={{ boxShadow: `0 4px 12px ${borderColor}50` }}
    >
      {/* Header Row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        <div style={{ fontSize: '20px' }}>
          {milestone.status === 'active' ? (
            <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
              {STATUS_ICON[milestone.status]}
            </motion.span>
          ) : (
            STATUS_ICON[milestone.status]
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h3
            style={{
              color: '#F3F4F6',
              fontSize: '14px',
              fontWeight: '600',
              margin: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '240px',
            }}
          >
            {milestone.title}
          </h3>
        </div>

        {/* Source Badge */}
        <div
          style={{
            backgroundColor: sourceBadge.bg,
            color: sourceBadge.text,
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: '600',
            whiteSpace: 'nowrap',
          }}
        >
          {sourceBadge.label}
        </div>

        {/* Three-Dot Menu */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#9CA3AF',
              cursor: 'pointer',
              fontSize: '18px',
              padding: '0',
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ⋮
          </button>

          <AnimatePresence>
            {showMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                style={{
                  position: 'absolute',
                  top: '24px',
                  right: '0',
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  zIndex: 50,
                  minWidth: '140px',
                }}
              >
                {(milestone.status === 'upcoming' || milestone.status === 'active') && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCompletionModal(true);
                      setShowMenu(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#10B981',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '13px',
                      borderBottom: '1px solid #374151',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#374151')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    ✓ Mark Complete
                  </button>
                )}
                {(milestone.status === 'upcoming' || milestone.status === 'active') && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSkip();
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#9CA3AF',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '13px',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#374151')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    ⏭️ Skip
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Description */}
      {milestone.description && (
        <div style={{ marginBottom: '12px' }}>
          <p
            style={{
              color: '#D1D5DB',
              fontSize: '13px',
              margin: 0,
              lineHeight: '1.4',
              maxHeight: showMore ? 'none' : '2.8em',
              overflow: 'hidden',
            }}
          >
            {truncatedDescription}
          </p>
          {milestone.description && milestone.description.length > 120 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMore(!showMore);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: mentorColor,
                cursor: 'pointer',
                fontSize: '12px',
                marginTop: '4px',
                fontWeight: '500',
              }}
            >
              {showMore ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      )}

      {/* SMART Goal Details (Collapsible) */}
      {(milestone.specific || milestone.measurable || milestone.target_date) && (
        <div style={{ marginBottom: '12px' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDetails(!showDetails);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#E5E7EB',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '600',
              padding: '0',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '8px',
            }}
          >
            <span style={{ transition: 'transform 0.2s', transform: showDetails ? 'rotate(90deg)' : '' }}>
              ›
            </span>
            Goal Details
          </button>

          <AnimatePresence>
            {showDetails && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{
                  backgroundColor: '#0F1419',
                  borderRadius: '8px',
                  padding: '10px',
                  marginTop: '8px',
                  fontSize: '12px',
                }}
              >
                {milestone.specific && (
                  <div style={{ marginBottom: '8px' }}>
                    <span style={{ color: '#9CA3AF' }}>S Specific: </span>
                    <span style={{ color: '#E5E7EB' }}>{milestone.specific}</span>
                  </div>
                )}
                {!milestone.specific && (
                  <div style={{ marginBottom: '8px' }}>
                    <span style={{ color: '#9CA3AF' }}>S Specific: </span>
                    <span style={{ color: '#6B7280', fontStyle: 'italic' }}>Not set</span>
                  </div>
                )}

                {milestone.measurable && (
                  <div style={{ marginBottom: '8px' }}>
                    <span style={{ color: '#9CA3AF' }}>M Measurable: </span>
                    <span style={{ color: '#E5E7EB' }}>{milestone.measurable}</span>
                  </div>
                )}
                {!milestone.measurable && (
                  <div style={{ marginBottom: '8px' }}>
                    <span style={{ color: '#9CA3AF' }}>M Measurable: </span>
                    <span style={{ color: '#6B7280', fontStyle: 'italic' }}>Not set</span>
                  </div>
                )}

                {milestone.target_date && dateStatus && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: dateStatus.color }}>
                    📅 {new Date(milestone.target_date).toLocaleDateString()} — {dateStatus.text}
                  </div>
                )}

                {milestone.teacher_adjusted_date && milestone.teacher_adjusted_date !== milestone.target_date && (
                  <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#374151', borderRadius: '6px', borderLeft: '2px solid #F59E0B' }}>
                    <span style={{ color: '#FCD34D', fontSize: '11px', fontWeight: '600' }}>📝 Teacher adjusted: </span>
                    <span style={{ color: '#FCD34D', fontSize: '12px' }}>{new Date(milestone.teacher_adjusted_date).toLocaleDateString()}</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Evidence Strip */}
      <div style={{ marginBottom: '12px' }}>
        {evidence.length > 0 ? (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', overflowX: 'auto', paddingBottom: '4px' }}>
            {evidence.map((ev) => {
              const relativeTime = new Date(ev.created_at);
              const now = new Date();
              const hoursAgo = Math.floor((now.getTime() - relativeTime.getTime()) / (1000 * 60 * 60));
              const timeLabel = hoursAgo === 0 ? 'Just now' : hoursAgo < 24 ? `${hoursAgo}h ago` : `${Math.floor(hoursAgo / 24)}d ago`;

              return (
                <div
                  key={ev.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 10px',
                    backgroundColor: '#1F2937',
                    borderRadius: '6px',
                    fontSize: '11px',
                    color: '#D1D5DB',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  <span>{ev.type === 'photo' ? '🖼️' : ev.type === 'voice' ? '🎙️' : ev.type === 'text' ? '📝' : ev.type === 'file' ? '📎' : ev.type === 'link' ? '🔗' : ev.type === 'reflection' ? '💭' : ev.type === 'tool_session' ? '🛠️' : '💬'}</span>
                  <span>{timeLabel}</span>
                  {ev.approved_by_teacher && <span style={{ color: '#10B981' }}>✓</span>}
                  {!ev.approved_by_teacher && <span style={{ color: '#6B7280' }}>◦</span>}
                  {ev.teacher_feedback && <span>💬</span>}
                </div>
              );
            })}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddEvidence?.(milestone.id);
              }}
              style={{
                padding: '6px 12px',
                backgroundColor: 'transparent',
                border: `1px solid ${mentorColor}80`,
                borderRadius: '6px',
                color: mentorColor,
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '500',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = `${mentorColor}20`)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              + Add
            </button>
          </div>
        ) : (
          <div
            style={{
              padding: '10px',
              backgroundColor: '#0F1419',
              borderRadius: '6px',
              color: '#6B7280',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>📁</span>
            <span>No evidence yet — add your first!</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddEvidence?.(milestone.id);
              }}
              style={{
                marginLeft: 'auto',
                padding: '4px 10px',
                backgroundColor: 'transparent',
                border: `1px solid ${mentorColor}60`,
                borderRadius: '4px',
                color: mentorColor,
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: '500',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = `${mentorColor}15`)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              Add Evidence
            </button>
          </div>
        )}
      </div>

      {/* Teacher Note */}
      {milestone.teacher_note && (
        <div
          style={{
            padding: '10px',
            backgroundColor: '#78350F30',
            borderLeft: '2px solid #FBBF24',
            borderRadius: '6px',
            marginBottom: '12px',
            fontSize: '12px',
          }}
        >
          <div style={{ color: '#FCD34D', fontWeight: '600', marginBottom: '4px' }}>📝 From your teacher</div>
          <div style={{ color: '#E5E7EB' }}>{milestone.teacher_note}</div>
        </div>
      )}

      {/* Action Buttons Row */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {(milestone.status === 'upcoming' || milestone.status === 'active' || milestone.status === 'overdue') && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowCompletionModal(true);
              }}
              style={{
                flex: 1,
                padding: '8px 12px',
                backgroundColor: '#10B981',
                border: 'none',
                borderRadius: '6px',
                color: '#FFFFFF',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#059669')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#10B981')}
            >
              ✓ Mark Complete
            </button>
          </>
        )}

        {milestone.status === 'completed' && (
          <div
            style={{
              padding: '8px 12px',
              backgroundColor: '#10B98120',
              borderRadius: '6px',
              color: '#10B981',
              fontSize: '12px',
              fontWeight: '600',
              flex: 1,
            }}
          >
            ✓ Completed {milestone.completed_at ? new Date(milestone.completed_at).toLocaleDateString() : ''}
          </div>
        )}

        {milestone.status === 'skipped' && (
          <div
            style={{
              padding: '8px 12px',
              backgroundColor: '#6B728020',
              borderRadius: '6px',
              color: '#9CA3AF',
              fontSize: '12px',
              fontWeight: '600',
              flex: 1,
            }}
          >
            ⏭️ Skipped
          </div>
        )}

        {milestone.status === 'overdue' && (
          <div
            style={{
              padding: '8px 12px',
              backgroundColor: '#F59E0B20',
              borderRadius: '6px',
              color: '#F59E0B',
              fontSize: '12px',
              fontWeight: '600',
              flex: 1,
            }}
          >
            ⚠️ Overdue
          </div>
        )}
      </div>

      {/* Completion Modal */}
      <AnimatePresence>
        {showCompletionModal && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            style={{
              marginTop: '12px',
              padding: '12px',
              backgroundColor: '#1F2937',
              borderRadius: '8px',
              border: `1px solid ${mentorColor}60`,
            }}
          >
            <label
              style={{
                display: 'block',
                color: '#E5E7EB',
                fontSize: '12px',
                fontWeight: '600',
                marginBottom: '6px',
              }}
            >
              What did you accomplish? What did you learn?
            </label>
            <textarea
              value={completionNote}
              onChange={(e) => setCompletionNote(e.target.value)}
              placeholder="Describe your work, learnings, and reflection..."
              style={{
                width: '100%',
                minHeight: '80px',
                padding: '8px',
                backgroundColor: '#111827',
                border: `1px solid #374151`,
                borderRadius: '6px',
                color: '#E5E7EB',
                fontSize: '12px',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                marginBottom: '8px',
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ fontSize: '11px', color: '#9CA3AF' }}>
                {wordCount} words {isCompletionValid ? <span style={{ color: '#10B981' }}>✓</span> : <span style={{ color: '#EF4444' }}>— minimum 5 words</span>}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleMarkComplete();
                }}
                disabled={!isCompletionValid}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  backgroundColor: isCompletionValid ? '#10B981' : '#6B7280',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#FFFFFF',
                  cursor: isCompletionValid ? 'pointer' : 'not-allowed',
                  fontSize: '12px',
                  fontWeight: '600',
                }}
                onMouseEnter={(e) => {
                  if (isCompletionValid) e.currentTarget.style.backgroundColor = '#059669';
                }}
                onMouseLeave={(e) => {
                  if (isCompletionValid) e.currentTarget.style.backgroundColor = '#10B981';
                }}
              >
                Complete Milestone
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCompletionModal(false);
                  setCompletionNote('');
                }}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  backgroundColor: 'transparent',
                  border: '1px solid #374151',
                  borderRadius: '6px',
                  color: '#D1D5DB',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '600',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#374151')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default MilestoneCard;
