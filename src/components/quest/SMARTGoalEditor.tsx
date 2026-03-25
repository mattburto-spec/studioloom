'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { QuestMilestone, PHASE_LABELS } from '@/lib/quest/types';

interface SMARTGoalEditorProps {
  milestone: QuestMilestone;
  onUpdate: (updates: {
    specific?: string;
    measurable?: string;
    target_date?: string;
    title?: string;
    description?: string;
  }) => void;
  onDelete?: () => void;
  readOnly?: boolean;
}

const PHASE_COLORS: Record<string, string> = {
  not_started: '#6B7280',
  discovery: '#3B82F6',
  planning: '#8B5CF6',
  working: '#EC4899',
  sharing: '#F59E0B',
  completed: '#10B981',
};

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  student: { label: 'You', color: '#8B5CF6' },
  ai_suggested: { label: 'AI Suggested', color: '#3B82F6' },
  template: { label: 'Template', color: '#6B7280' },
  teacher: { label: 'Teacher', color: '#10B981' },
};

export function SMARTGoalEditor({
  milestone,
  onUpdate,
  onDelete,
  readOnly = false,
}: SMARTGoalEditorProps) {
  const [showDelete, setShowDelete] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(milestone.title);

  const smartCount = [milestone.specific, milestone.measurable, milestone.target_date].filter(
    (v) => v && v.trim()
  ).length;

  const phaseColor = PHASE_COLORS[milestone.phase] || PHASE_COLORS.not_started;
  const sourceInfo = SOURCE_LABELS[milestone.source] || SOURCE_LABELS.template;

  const handleSaveTitle = () => {
    if (titleValue.trim() !== milestone.title) {
      onUpdate({ title: titleValue });
    }
    setEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSaveTitle();
    if (e.key === 'Escape') {
      setTitleValue(milestone.title);
      setEditingTitle(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      style={{
        backgroundColor: '#111827',
        border: '1px solid #1e293b',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '16px',
        position: 'relative',
      }}
    >
      {/* Header with Title and Phase Dot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <div
          style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: phaseColor,
            flexShrink: 0,
          }}
        />

        {editingTitle && !readOnly ? (
          <input
            autoFocus
            type="text"
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onBlur={handleSaveTitle}
            onKeyDown={handleTitleKeyDown}
            style={{
              flex: 1,
              fontSize: '16px',
              fontWeight: '600',
              backgroundColor: '#1F2937',
              color: '#F3F4F6',
              border: '2px solid #3B82F6',
              borderRadius: '6px',
              padding: '8px 12px',
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
        ) : (
          <h3
            onClick={() => !readOnly && setEditingTitle(true)}
            style={{
              flex: 1,
              fontSize: '16px',
              fontWeight: '600',
              color: '#F3F4F6',
              margin: 0,
              cursor: readOnly ? 'default' : 'pointer',
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => !readOnly && (e.currentTarget.style.color = '#9CA3AF')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#F3F4F6')}
          >
            {milestone.title}
          </h3>
        )}

        {/* Source Badge */}
        <div
          style={{
            backgroundColor: sourceInfo.color,
            opacity: 0.15,
            color: sourceInfo.color,
            fontSize: '12px',
            fontWeight: '600',
            padding: '4px 8px',
            borderRadius: '4px',
            whiteSpace: 'nowrap',
          }}
        >
          {sourceInfo.label}
        </div>

        {/* Delete Button */}
        {onDelete && !readOnly && (
          <motion.button
            onClick={() => setShowDelete(true)}
            style={{
              background: 'none',
              border: 'none',
              color: '#6B7280',
              cursor: 'pointer',
              fontSize: '18px',
              padding: '4px 8px',
              transition: 'color 0.2s',
            }}
            whileHover={{ color: '#EF4444' }}
            title="Delete milestone"
          >
            🗑️
          </motion.button>
        )}
      </div>

      {/* SMART Score Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <span style={{ fontSize: '12px', color: '#9CA3AF', fontWeight: '500' }}>SMART:</span>
        <div style={{ display: 'flex', gap: '6px' }}>
          {[0, 1, 2].map((idx) => (
            <motion.div
              key={idx}
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: idx * 0.1 }}
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: idx < smartCount ? phaseColor : '#374151',
                transition: 'background-color 0.3s',
              }}
            />
          ))}
        </div>
        <span
          style={{
            fontSize: '11px',
            color: '#9CA3AF',
            fontStyle: 'italic',
          }}
        >
          {smartCount === 0 && 'Getting started'}
          {smartCount === 1 && 'Getting started'}
          {smartCount === 2 && 'Almost there'}
          {smartCount === 3 && 'SMART goal!'}
        </span>
      </div>

      {/* Specific Field */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        style={{ marginBottom: '16px' }}
      >
        <label style={{ fontSize: '12px', fontWeight: '600', color: '#E5E7EB', display: 'block', marginBottom: '6px' }}>
          📌 Specific — What exactly will you do?
        </label>
        <textarea
          value={milestone.specific || ''}
          onChange={(e) => onUpdate({ specific: e.target.value })}
          readOnly={readOnly}
          placeholder="Describe precisely what this milestone involves..."
          rows={3}
          style={{
            width: '100%',
            padding: '10px 12px',
            fontSize: '14px',
            color: '#F3F4F6',
            backgroundColor: '#1F2937',
            border: '1px solid #374151',
            borderRadius: '6px',
            fontFamily: 'inherit',
            outline: 'none',
            transition: 'border-color 0.2s',
            cursor: readOnly ? 'default' : 'text',
            resize: 'vertical',
            minHeight: '60px',
          }}
          onFocus={(e) => !readOnly && (e.currentTarget.style.borderColor = '#3B82F6')}
          onBlur={(e) => (e.currentTarget.style.borderColor = '#374151')}
        />
        <p style={{ fontSize: '11px', color: '#9CA3AF', margin: '6px 0 0 0', fontStyle: 'italic' }}>
          💡 Replace vague words like "good" or "some" with exact details
        </p>
      </motion.div>

      {/* Measurable Field */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        style={{ marginBottom: '16px' }}
      >
        <label style={{ fontSize: '12px', fontWeight: '600', color: '#E5E7EB', display: 'block', marginBottom: '6px' }}>
          📊 Measurable — How will you know it's done?
        </label>
        <textarea
          value={milestone.measurable || ''}
          onChange={(e) => onUpdate({ measurable: e.target.value })}
          readOnly={readOnly}
          placeholder="What evidence will prove this is complete?"
          rows={2}
          style={{
            width: '100%',
            padding: '10px 12px',
            fontSize: '14px',
            color: '#F3F4F6',
            backgroundColor: '#1F2937',
            border: '1px solid #374151',
            borderRadius: '6px',
            fontFamily: 'inherit',
            outline: 'none',
            transition: 'border-color 0.2s',
            cursor: readOnly ? 'default' : 'text',
            resize: 'vertical',
            minHeight: '45px',
          }}
          onFocus={(e) => !readOnly && (e.currentTarget.style.borderColor = '#8B5CF6')}
          onBlur={(e) => (e.currentTarget.style.borderColor = '#374151')}
        />
        <p style={{ fontSize: '11px', color: '#9CA3AF', margin: '6px 0 0 0', fontStyle: 'italic' }}>
          💡 Think: what could you SHOW someone to prove this is finished?
        </p>
      </motion.div>

      {/* Target Date Field */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        style={{ marginBottom: '16px' }}
      >
        <label style={{ fontSize: '12px', fontWeight: '600', color: '#E5E7EB', display: 'block', marginBottom: '6px' }}>
          📅 Target Date — When will this be done?
        </label>
        <input
          type="date"
          value={milestone.target_date ? milestone.target_date.split('T')[0] : ''}
          onChange={(e) => onUpdate({ target_date: e.target.value || null })}
          readOnly={readOnly}
          style={{
            padding: '10px 12px',
            fontSize: '14px',
            color: '#F3F4F6',
            backgroundColor: '#1F2937',
            border: '1px solid #374151',
            borderRadius: '6px',
            fontFamily: 'inherit',
            outline: 'none',
            cursor: readOnly ? 'default' : 'pointer',
            transition: 'border-color 0.2s',
          }}
          onFocus={(e) => !readOnly && (e.currentTarget.style.borderColor = '#10B981')}
          onBlur={(e) => (e.currentTarget.style.borderColor = '#374151')}
        />
        <p style={{ fontSize: '11px', color: '#9CA3AF', margin: '6px 0 0 0', fontStyle: 'italic' }}>
          💡 Work backwards from your project due date. Be realistic!
        </p>
      </motion.div>

      {/* Completion Status Section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
      >
        {milestone.status === 'completed' && milestone.completed_at && (
          <div
            style={{
              backgroundColor: '#065F46',
              borderLeft: '4px solid #10B981',
              padding: '12px',
              borderRadius: '6px',
              marginBottom: '12px',
            }}
          >
            <p style={{ fontSize: '12px', color: '#D1FAE5', margin: '0 0 4px 0', fontWeight: '600' }}>
              ✅ Completed on {formatDate(milestone.completed_at)}
            </p>
            {milestone.completion_note && (
              <p style={{ fontSize: '12px', color: '#D1FAE5', margin: 0 }}>"{milestone.completion_note}"</p>
            )}
          </div>
        )}

        {milestone.teacher_note && (
          <div
            style={{
              backgroundColor: '#78350F',
              borderLeft: '4px solid #F59E0B',
              padding: '12px',
              borderRadius: '6px',
              marginBottom: '12px',
            }}
          >
            <p style={{ fontSize: '11px', color: '#FEF3C7', margin: '0 0 4px 0', fontWeight: '600' }}>
              👨‍🏫 Teacher Feedback
            </p>
            <p style={{ fontSize: '12px', color: '#FEF3C7', margin: 0 }}>{milestone.teacher_note}</p>
          </div>
        )}

        {milestone.teacher_adjusted_date && (
          <div
            style={{
              backgroundColor: '#1E40AF',
              borderLeft: '4px solid #3B82F6',
              padding: '12px',
              borderRadius: '6px',
              marginBottom: '12px',
            }}
          >
            <p style={{ fontSize: '11px', color: '#DBEAFE', margin: '0 0 4px 0', fontWeight: '600' }}>
              📅 Teacher Adjusted Deadline
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: '#DBEAFE' }}>
              <span style={{ textDecoration: 'line-through', opacity: 0.7 }}>
                {formatDate(milestone.target_date)}
              </span>
              <span>→</span>
              <span style={{ fontWeight: '600' }}>{formatDate(milestone.teacher_adjusted_date)}</span>
            </div>
          </div>
        )}

        {(milestone.status === 'upcoming' || milestone.status === 'active' || milestone.status === 'overdue') && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              color: '#9CA3AF',
              padding: '8px 0',
            }}
          >
            <span>Status:</span>
            <span
              style={{
                display: 'inline-block',
                backgroundColor:
                  milestone.status === 'overdue'
                    ? '#7F1D1D'
                    : milestone.status === 'active'
                      ? '#78350F'
                      : '#374151',
                color:
                  milestone.status === 'overdue'
                    ? '#FCA5A5'
                    : milestone.status === 'active'
                      ? '#FEF3C7'
                      : '#D1D5DB',
                padding: '4px 8px',
                borderRadius: '4px',
                fontWeight: '600',
              }}
            >
              {milestone.status === 'overdue' ? '⚠️ Overdue' : milestone.status === 'active' ? '🔄 Active' : '⏳ Upcoming'}
            </span>
          </div>
        )}
      </motion.div>

      {/* Delete Confirmation */}
      <AnimatePresence>
        {showDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}
            onClick={() => setShowDelete(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: '#111827',
                border: '1px solid #1e293b',
                borderRadius: '12px',
                padding: '20px',
                maxWidth: '400px',
              }}
            >
              <p style={{ fontSize: '14px', color: '#F3F4F6', margin: '0 0 16px 0', fontWeight: '600' }}>
                Delete this milestone?
              </p>
              <p style={{ fontSize: '13px', color: '#9CA3AF', margin: '0 0 20px 0' }}>
                This action cannot be undone. Any associated evidence will remain in the journey history.
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowDelete(false)}
                  style={{
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#E5E7EB',
                    backgroundColor: '#374151',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#4B5563')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#374151')}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowDelete(false);
                    onDelete?.();
                  }}
                  style={{
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#FEE2E2',
                    backgroundColor: '#7F1D1D',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#991B1B')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#7F1D1D')}
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default SMARTGoalEditor;
