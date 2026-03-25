'use client';

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { StudentContract, MentorId } from '@/lib/quest/types';

interface ContractFormProps {
  contract: Partial<StudentContract> | null;
  mentorId?: MentorId | null;
  onFieldUpdate: (field: keyof StudentContract, value: string) => void;
  onConfirm: () => void;
  isConfirmed: boolean;
}

const FILLER_WORDS = new Set([
  'i',
  'the',
  'a',
  'an',
  'is',
  'was',
  'it',
  'my',
  'to',
  'and',
  'or',
  'of',
  'in',
  'for',
  'that',
  'this',
  'with',
  'be',
  'are',
  'am',
]);

const FIELDS: Array<{
  key: keyof StudentContract;
  label: string;
  placeholder: string;
  tip: string;
}> = [
  {
    key: 'what',
    label: 'What will you create or do?',
    placeholder: 'Describe your project in 2-3 sentences...',
    tip: 'Be specific — "make a poster" is too vague. What KIND of poster? About what?',
  },
  {
    key: 'who_for',
    label: 'Who is this for?',
    placeholder: 'Who will benefit from your project?',
    tip: 'Real audiences make for better projects. Who will actually see or use this?',
  },
  {
    key: 'done_looks_like',
    label: "What does 'done' look like?",
    placeholder:
      'Describe what a successful finished project looks like...',
    tip: "Close your eyes and imagine presenting this. What does the audience see?",
  },
  {
    key: 'milestones_summary',
    label: 'What are the key steps?',
    placeholder: "List the major milestones you'll need to hit...",
    tip: 'Think backwards from your final product. What has to happen first?',
  },
  {
    key: 'help_needed',
    label: 'What help do you need?',
    placeholder:
      'What resources, people, or skills do you need?',
    tip: "It's not weak to need help — it's smart to plan for it.",
  },
  {
    key: 'success_criteria',
    label: 'How will you know it\'s good?',
    placeholder:
      'What specific criteria will you use to judge quality?',
    tip: 'Good criteria are specific enough that someone else could judge your work by them.',
  },
];

const mentorColors: Record<MentorId, string> = {
  kit: '#F59E0B',
  sage: '#8B5CF6',
  river: '#06B6D4',
  spark: '#EC4899',
  haven: '#10B981',
};

function countMeaningfulWords(text: string): number {
  if (!text) return 0;
  const words = text
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 0);
  return words.filter((w) => !FILLER_WORDS.has(w)).length;
}

function getEffortLevel(meaningfulWords: number): {
  level: 'low' | 'medium' | 'high';
  label: string;
  color: string;
} {
  if (meaningfulWords < 4) {
    return { level: 'low', label: 'Keep going...', color: '#EF4444' };
  }
  if (meaningfulWords < 8) {
    return {
      level: 'medium',
      label: 'Getting there...',
      color: '#F59E0B',
    };
  }
  return { level: 'high', label: 'Good detail!', color: '#10B981' };
}

function isMeaningfulEnough(text: string): boolean {
  return countMeaningfulWords(text) >= 8;
}

export function ContractForm({
  contract,
  mentorId = null,
  onFieldUpdate,
  onConfirm,
  isConfirmed,
}: ContractFormProps) {
  const accentColor = mentorId
    ? mentorColors[mentorId]
    : '#A78BFA';

  // Calculate which fields are complete
  const fieldCompleteness = useMemo(() => {
    const completion: Record<keyof StudentContract, boolean> = {
      what: isMeaningfulEnough(contract?.what || ''),
      who_for: isMeaningfulEnough(contract?.who_for || ''),
      done_looks_like: isMeaningfulEnough(
        contract?.done_looks_like || ''
      ),
      milestones_summary: isMeaningfulEnough(
        contract?.milestones_summary || ''
      ),
      help_needed: isMeaningfulEnough(contract?.help_needed || ''),
      success_criteria: isMeaningfulEnough(
        contract?.success_criteria || ''
      ),
      confirmed_at: true,
    };
    return completion;
  }, [contract]);

  const allFieldsComplete = FIELDS.every(
    (f) => fieldCompleteness[f.key]
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        maxWidth: '700px',
        margin: '0 auto',
      }}
    >
      {/* Confirmed Banner */}
      <AnimatePresence>
        {isConfirmed && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            style={{
              background:
                'linear-gradient(135deg, #10B981 0%, #059669 100%)',
              padding: '16px',
              borderRadius: '8px',
              color: 'white',
              fontWeight: 500,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
            }}
          >
            <span>✓ Contract Confirmed</span>
            {contract?.confirmed_at && (
              <span style={{ fontSize: '12px', opacity: 0.9 }}>
                {new Date(contract.confirmed_at).toLocaleDateString()}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contract Fields */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {FIELDS.map((field, index) => {
          const value = contract?.[field.key] || '';
          const isComplete = fieldCompleteness[field.key];
          const meaningfulWords = countMeaningfulWords(value);
          const effort = getEffortLevel(meaningfulWords);

          return (
            <motion.div
              key={field.key}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.3,
                delay: index * 0.08,
              }}
              style={{
                background: '#111827',
                border: `1px solid ${isComplete ? accentColor : '#1e293b'}`,
                borderLeft: `4px solid ${
                  isComplete ? '#10B981' : '#64748b'
                }`,
                borderRadius: '12px',
                padding: '16px',
                boxShadow:
                  !isConfirmed && !isComplete
                    ? `0 0 16px ${accentColor}22`
                    : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              {/* Field Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  marginBottom: '8px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    background: accentColor,
                    color: '#000',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    flexShrink: 0,
                  }}
                >
                  {index + 1}
                </div>
                <label
                  style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#F1F5F9',
                    margin: 0,
                    flex: 1,
                  }}
                >
                  {field.label}
                </label>
              </div>

              {/* Textarea or Read-Only Text */}
              {isConfirmed ? (
                <div
                  style={{
                    fontSize: '13px',
                    color: '#CBD5E1',
                    lineHeight: '1.6',
                    padding: '12px',
                    background: 'rgba(15, 23, 42, 0.5)',
                    borderRadius: '8px',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {value || '(empty)'}
                </div>
              ) : (
                <textarea
                  value={value}
                  onChange={(e) =>
                    onFieldUpdate(field.key, e.target.value)
                  }
                  placeholder={field.placeholder}
                  style={{
                    width: '100%',
                    minHeight: '80px',
                    padding: '12px',
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: `1px solid ${accentColor}33`,
                    borderRadius: '8px',
                    color: '#F1F5F9',
                    fontSize: '13px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    outline: 'none',
                    transition: 'all 0.2s ease',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = accentColor;
                    e.currentTarget.style.background =
                      'rgba(15, 23, 42, 0.95)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = `${accentColor}33`;
                    e.currentTarget.style.background =
                      'rgba(15, 23, 42, 0.8)';
                  }}
                />
              )}

              {/* Mentor Tip */}
              {!isConfirmed && (
                <div
                  style={{
                    fontSize: '12px',
                    color: '#94A3B8',
                    marginTop: '8px',
                    paddingLeft: '36px',
                    fontStyle: 'italic',
                  }}
                >
                  💡 {field.tip}
                </div>
              )}

              {/* Effort Tag */}
              <AnimatePresence>
                {!isConfirmed && value && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginTop: '8px',
                      paddingLeft: '36px',
                      fontSize: '11px',
                      fontWeight: '500',
                      color: effort.color,
                    }}
                  >
                    <span
                      style={{
                        width: '4px',
                        height: '4px',
                        borderRadius: '50%',
                        background: effort.color,
                      }}
                    />
                    {effort.label}
                    <span style={{ color: '#64748b' }}>
                      ({meaningfulWords} words)
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Confirm Button */}
      {!isConfirmed && (
        <motion.button
          onClick={onConfirm}
          disabled={!allFieldsComplete}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.48 }}
          style={{
            padding: '14px 24px',
            marginTop: '8px',
            borderRadius: '8px',
            border: 'none',
            background: allFieldsComplete
              ? `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}dd 100%)`
              : '#374151',
            color: allFieldsComplete ? '#000' : '#9CA3AF',
            fontWeight: '600',
            fontSize: '14px',
            cursor: allFieldsComplete ? 'pointer' : 'not-allowed',
            opacity: allFieldsComplete ? 1 : 0.5,
            transition: 'all 0.2s ease',
            boxShadow: allFieldsComplete
              ? `0 8px 16px ${accentColor}44`
              : 'none',
          }}
          whileHover={
            allFieldsComplete
              ? { scale: 1.02, boxShadow: `0 12px 24px ${accentColor}55` }
              : {}
          }
          whileTap={allFieldsComplete ? { scale: 0.98 } : {}}
        >
          Confirm My Contract ✓
        </motion.button>
      )}
    </div>
  );
}

export default ContractForm;
