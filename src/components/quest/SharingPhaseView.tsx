'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { QuestJourney, QuestMilestone, QuestEvidence } from '@/lib/quest/types';
import { PHASE_COLORS } from '@/lib/quest/color-system';
import { getMentor } from '@/lib/quest/mentors';
import { SHARING_MILESTONES } from '@/lib/quest/milestone-templates';

interface SharingPhaseViewProps {
  journey: QuestJourney;
  milestones: QuestMilestone[];
  evidence: QuestEvidence[];
  onAdvancePhase: () => void;
  onEvidenceSubmit: (evidence: { type: string; content: string; milestone_id?: string }) => Promise<void>;
  onMilestoneComplete: (milestoneId: string, note: string) => Promise<void>;
}

/**
 * Count meaningful words (excluding filler words)
 */
function countMeaningfulWords(text: string): number {
  const filler = new Set([
    'i', 'the', 'a', 'an', 'is', 'was', 'it', 'to', 'and', 'of', 'in', 'for', 'on',
    'my', 'we', 'so', 'do', 'be', 'he', 'she', 'but', 'or', 'if', 'at', 'by', 'up', 'no', 'me',
  ]);
  return text
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 0 && !filler.has(w.toLowerCase())).length;
}

/**
 * Get effort level from word count
 */
function getEffortLevel(meaningfulWords: number): 'low' | 'medium' | 'high' {
  if (meaningfulWords >= 20) return 'high';
  if (meaningfulWords >= 12) return 'medium';
  return 'low';
}

/**
 * Confetti particle animation (simple CSS implementation)
 */
const ConfettiParticle = ({ delay }: { delay: number }) => {
  const particleStyle: React.CSSProperties = {
    position: 'fixed',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    pointerEvents: 'none',
    zIndex: 50,
  };

  const colors = ['#8B5CF6', '#C4B5FD', '#DDD6FE', '#EDE9FE', '#A78BFA'];
  const randomColor = colors[Math.floor(Math.random() * colors.length)];

  return (
    <motion.div
      style={{
        ...particleStyle,
        backgroundColor: randomColor,
        left: '50%',
        top: '50%',
      }}
      initial={{ opacity: 1, x: 0, y: 0 }}
      animate={{
        opacity: 0,
        x: (Math.random() - 0.5) * 200,
        y: (Math.random() - 0.5) * 200 - 100,
      }}
      transition={{ duration: 1.2, delay, ease: 'easeOut' }}
    />
  );
};

/**
 * SharingPhaseView Component
 * Orchestrates the Sharing phase with presentation prep, evidence gallery, and journey completion
 */
export function SharingPhaseView({
  journey,
  milestones,
  evidence,
  onAdvancePhase,
  onEvidenceSubmit,
  onMilestoneComplete,
}: SharingPhaseViewProps) {
  // State
  const [isDesktop, setIsDesktop] = useState(true);
  const [storyText, setStoryText] = useState('');
  const [keyMomentsText, setKeyMomentsText] = useState('');
  const [learnedText, setLearnedText] = useState('');
  const [completionNotes, setCompletionNotes] = useState<Record<string, string>>({});
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isSubmittingEvidence, setIsSubmittingEvidence] = useState(false);
  const [localEvidence, setLocalEvidence] = useState<QuestEvidence[]>(evidence);
  const [evidenceFilter, setEvidenceFilter] = useState<'all' | 'discovery' | 'planning' | 'working'>('all');

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);

  // Mentor info
  const mentor = getMentor(journey.mentor_id);
  const mentorColor = mentor?.primaryColor || '#8B5CF6';
  const phaseColor = PHASE_COLORS.sharing;

  // Responsive detection
  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update local evidence when prop changes
  useEffect(() => {
    setLocalEvidence(evidence);
  }, [evidence]);

  // Filter sharing milestones (only from this phase)
  const sharingMilestones = useMemo(
    () => milestones.filter(m => m.phase === 'sharing').sort((a, b) => a.sort_order - b.sort_order),
    [milestones]
  );

  // Count milestones by status
  const completedCount = sharingMilestones.filter(m => m.status === 'completed').length;
  const totalCount = sharingMilestones.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // Filter evidence
  const filteredEvidence = useMemo(() => {
    if (evidenceFilter === 'all') return localEvidence;
    return localEvidence.filter(e => e.phase === evidenceFilter);
  }, [localEvidence, evidenceFilter]);

  // Calculate stats
  const journeyStats = useMemo(() => {
    const startDate = new Date(journey.started_at);
    const daysOnJourney = Math.floor(
      (new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      totalEvidence: localEvidence.length,
      completedMilestones: completedCount,
      daysOnJourney,
      sessions: journey.total_sessions,
    };
  }, [localEvidence, completedCount, journey]);

  // Calculate effort levels for text inputs
  const storyEffort = useMemo(() => getEffortLevel(countMeaningfulWords(storyText)), [storyText]);
  const learnedEffort = useMemo(() => getEffortLevel(countMeaningfulWords(learnedText)), [learnedText]);

  // Check if story and learned meet minimum effort
  const storyReady = countMeaningfulWords(storyText) >= 20;
  const learnedReady = countMeaningfulWords(learnedText) >= 15;

  // Check if all sharing milestones are complete and we have evidence
  const canCompleteJourney =
    sharingMilestones.length > 0 &&
    sharingMilestones.every(m => m.status === 'completed' || m.status === 'skipped') &&
    localEvidence.length > 0;

  // Handlers
  const handleMilestoneComplete = useCallback(
    async (milestoneId: string) => {
      const note = completionNotes[milestoneId] || '';
      if (note.trim().length < 5) {
        alert('Please write at least 5 words to complete this milestone');
        return;
      }

      setIsCompleting(true);
      try {
        await onMilestoneComplete(milestoneId, note);
        setCompletionNotes(prev => ({ ...prev, [milestoneId]: '' }));
        setSelectedMilestoneId(null);
      } catch (err) {
        console.error('Failed to complete milestone:', err);
        alert('Failed to complete milestone. Please try again.');
      } finally {
        setIsCompleting(false);
      }
    },
    [completionNotes, onMilestoneComplete]
  );

  const handleCompleteJourney = useCallback(async () => {
    if (!canCompleteJourney) return;

    setIsCompleting(true);
    try {
      // Fire completion toast with confetti
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 1500);

      // Call parent to advance phase
      onAdvancePhase();
    } catch (err) {
      console.error('Failed to complete journey:', err);
      alert('Failed to complete journey. Please try again.');
    } finally {
      setIsCompleting(false);
    }
  }, [canCompleteJourney, onAdvancePhase]);

  const handleEvidenceSubmit = useCallback(
    async (type: string, content: string) => {
      setIsSubmittingEvidence(true);
      try {
        await onEvidenceSubmit({ type, content, milestone_id: selectedMilestoneId ?? undefined });
      } catch (err) {
        console.error('Failed to submit evidence:', err);
        alert('Failed to submit evidence. Please try again.');
      } finally {
        setIsSubmittingEvidence(false);
      }
    },
    [onEvidenceSubmit, selectedMilestoneId]
  );

  // Styles
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: isDesktop ? 'row' : 'column',
    gap: '32px',
    padding: '24px',
    backgroundColor: '#0a0a0f',
    borderRadius: '12px',
    minHeight: '100vh',
  };

  const leftColumnStyle: React.CSSProperties = {
    flex: isDesktop ? '1.5' : '1',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  };

  const rightColumnStyle: React.CSSProperties = {
    flex: isDesktop ? '1' : '1',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  };

  const headerStyle: React.CSSProperties = {
    background: `linear-gradient(135deg, ${phaseColor.baseColor}20 0%, ${phaseColor.baseColor}10 100%)`,
    borderLeft: `4px solid ${phaseColor.baseColor}`,
    padding: '24px',
    borderRadius: '8px',
    marginBottom: '8px',
  };

  const headerTitleStyle: React.CSSProperties = {
    fontSize: '28px',
    fontWeight: '700',
    color: phaseColor.baseColor,
    marginBottom: '8px',
  };

  const headerSubtitleStyle: React.CSSProperties = {
    fontSize: '14px',
    color: '#94A3B8',
  };

  const milestonesContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  };

  const milestoneCardStyle: React.CSSProperties = {
    backgroundColor: '#1a1a2e',
    border: '1px solid #374151',
    borderRadius: '8px',
    padding: '16px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  };

  const builderSectionStyle: React.CSSProperties = {
    backgroundColor: '#1a1a2e',
    border: '1px solid #374151',
    borderRadius: '8px',
    padding: '20px',
  };

  const textareaStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px',
    backgroundColor: '#12121f',
    border: '1px solid #374151',
    borderRadius: '6px',
    color: '#E2E8F0',
    fontSize: '14px',
    fontFamily: 'system-ui',
    resize: 'vertical',
    minHeight: '100px',
  };

  const effortIndicatorStyle = (effort: 'low' | 'medium' | 'high'): React.CSSProperties => {
    const colors = {
      low: { bg: '#991B1B', text: '#FEE2E2' },
      medium: { bg: '#92400E', text: '#FEF3C7' },
      high: { bg: '#065F46', text: '#D1FAE5' },
    };
    return {
      display: 'inline-block',
      padding: '4px 12px',
      backgroundColor: colors[effort].bg,
      color: colors[effort].text,
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: '600',
      marginTop: '8px',
    };
  };

  const galleryGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: isDesktop ? 'repeat(2, 1fr)' : '1fr',
    gap: '12px',
  };

  const galleryCardStyle: React.CSSProperties = {
    backgroundColor: '#1a1a2e',
    border: '1px solid #374151',
    borderRadius: '8px',
    padding: '12px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  };

  const statsContainerStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px',
  };

  const statCardStyle: React.CSSProperties = {
    backgroundColor: '#1a1a2e',
    border: '1px solid #374151',
    borderRadius: '8px',
    padding: '12px',
    textAlign: 'center',
  };

  const statValueStyle: React.CSSProperties = {
    fontSize: '24px',
    fontWeight: '700',
    color: mentorColor,
  };

  const statLabelStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#94A3B8',
    marginTop: '4px',
  };

  const progressBarStyle: React.CSSProperties = {
    height: '6px',
    backgroundColor: '#374151',
    borderRadius: '3px',
    overflow: 'hidden',
    marginTop: '8px',
  };

  const progressFillStyle: React.CSSProperties = {
    height: '100%',
    width: `${progressPercent}%`,
    backgroundColor: mentorColor,
    transition: 'width 0.3s ease',
  };

  const completeJourneyButtonStyle: React.CSSProperties = {
    padding: '12px 20px',
    backgroundColor: canCompleteJourney ? mentorColor : '#4B5563',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: canCompleteJourney ? 'pointer' : 'not-allowed',
    opacity: canCompleteJourney ? 1 : 0.6,
    transition: 'all 0.2s ease',
    width: '100%',
    animation: canCompleteJourney ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none',
  };

  const mentorQuoteStyle: React.CSSProperties = {
    backgroundColor: '#1a1a2e',
    borderLeft: `3px solid ${mentorColor}`,
    padding: '12px 16px',
    borderRadius: '6px',
    fontSize: '13px',
    fontStyle: 'italic',
    color: '#CBD5E1',
    marginBottom: '16px',
  };

  // Render

  return (
    <div ref={containerRef} style={containerStyle}>
      {/* Confetti particles */}
      <AnimatePresence>
        {showConfetti && (
          <>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <ConfettiParticle key={i} delay={i * 0.1} />
            ))}
          </>
        )}
      </AnimatePresence>

      {/* Global pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>

      {/* LEFT COLUMN */}
      <div style={leftColumnStyle}>
        {/* Header */}
        <motion.div
          style={headerStyle}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div style={headerTitleStyle}>🎬 Share Your Story</div>
          <div style={headerSubtitleStyle}>
            {mentor?.celebrationStyle
              ? mentor.celebrationStyle.split('.')[0] + '.'
              : 'Share your journey and celebrate what you created.'}
          </div>
        </motion.div>

        {/* Mentor quote */}
        {mentor && (
          <div style={mentorQuoteStyle}>
            "{mentor.tagline}"
            <br />
            <span style={{ fontSize: '12px', marginTop: '4px', display: 'block' }}>— {mentor.name}</span>
          </div>
        )}

        {/* Milestones */}
        <div style={milestonesContainerStyle}>
          {sharingMilestones.map((milestone, idx) => (
            <motion.div
              key={milestone.id}
              style={{
                ...milestoneCardStyle,
                borderColor:
                  milestone.status === 'completed'
                    ? mentorColor
                    : milestone.status === 'active'
                      ? mentorColor + '60'
                      : '#374151',
                backgroundColor:
                  milestone.status === 'completed' ? mentorColor + '15' : '#1a1a2e',
              }}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.1 }}
              onClick={() =>
                selectedMilestoneId === milestone.id
                  ? setSelectedMilestoneId(null)
                  : setSelectedMilestoneId(milestone.id)
              }
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: '#E2E8F0' }}>
                    {milestone.title}
                  </div>
                  <div style={{ fontSize: '13px', color: '#94A3B8', marginTop: '4px' }}>
                    {milestone.description}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    backgroundColor:
                      milestone.status === 'completed'
                        ? '#065F46'
                        : milestone.status === 'active'
                          ? '#92400E'
                          : '#374151',
                    color:
                      milestone.status === 'completed'
                        ? '#D1FAE5'
                        : milestone.status === 'active'
                          ? '#FEF3C7'
                          : '#9CA3AF',
                  }}
                >
                  {milestone.status === 'completed' ? '✓' : milestone.status === 'active' ? '⚡' : '○'}
                </div>
              </div>

              {/* Completion form */}
              <AnimatePresence>
                {selectedMilestoneId === milestone.id && milestone.status !== 'completed' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #374151' }}
                  >
                    <textarea
                      placeholder="Write 5+ words about how you completed this milestone..."
                      value={completionNotes[milestone.id] || ''}
                      onChange={(e) =>
                        setCompletionNotes(prev => ({
                          ...prev,
                          [milestone.id]: e.target.value,
                        }))
                      }
                      style={{
                        ...textareaStyle,
                        minHeight: '80px',
                      }}
                    />
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                      <motion.button
                        onClick={() => handleMilestoneComplete(milestone.id)}
                        disabled={isCompleting}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          backgroundColor: mentorColor,
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '13px',
                          fontWeight: '600',
                          cursor: isCompleting ? 'not-allowed' : 'pointer',
                          opacity: isCompleting ? 0.6 : 1,
                        }}
                      >
                        {isCompleting ? 'Completing...' : 'Mark Complete'}
                      </motion.button>
                      <button
                        onClick={() => setSelectedMilestoneId(null)}
                        style={{
                          padding: '8px 12px',
                          backgroundColor: '#374151',
                          color: '#E2E8F0',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '13px',
                          fontWeight: '600',
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>

        {/* Progress bar */}
        <div style={{ backgroundColor: '#1a1a2e', borderRadius: '8px', padding: '12px' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#E2E8F0' }}>
            Sharing Progress
          </div>
          <div style={progressBarStyle}>
            <div style={progressFillStyle} />
          </div>
          <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px' }}>
            {completedCount} of {totalCount} milestones
          </div>
        </div>

        {/* Presentation Builder */}
        <div style={builderSectionStyle}>
          <div style={{ fontSize: '16px', fontWeight: '600', color: '#E2E8F0', marginBottom: '16px' }}>
            📖 Build Your Presentation
          </div>

          {/* Story */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#E2E8F0', marginBottom: '8px' }}>
              What's your story?
            </label>
            <textarea
              placeholder="Tell the before-and-after of your project. What did you start with? What changed?"
              value={storyText}
              onChange={(e) => setStoryText(e.target.value)}
              style={textareaStyle}
            />
            <div style={effortIndicatorStyle(storyEffort)}>
              {storyEffort === 'low'
                ? '✏️ Keep going'
                : storyEffort === 'medium'
                  ? '✓ Good reflection'
                  : '⭐ Deep thinking'}
              {' — '}
              {countMeaningfulWords(storyText)} meaningful words
            </div>
          </div>

          {/* What I Learned */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#E2E8F0', marginBottom: '8px' }}>
              What did you learn?
            </label>
            <textarea
              placeholder="What surprised you? What would you do differently? What will you carry forward?"
              value={learnedText}
              onChange={(e) => setLearnedText(e.target.value)}
              style={textareaStyle}
            />
            <div style={effortIndicatorStyle(learnedEffort)}>
              {learnedEffort === 'low'
                ? '✏️ Keep going'
                : learnedEffort === 'medium'
                  ? '✓ Good reflection'
                  : '⭐ Deep thinking'}
              {' — '}
              {countMeaningfulWords(learnedText)} meaningful words
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN */}
      <div style={rightColumnStyle}>
        {/* Evidence Gallery */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          style={{ backgroundColor: '#1a1a2e', borderRadius: '8px', padding: '16px' }}
        >
          <div style={{ fontSize: '15px', fontWeight: '600', color: '#E2E8F0', marginBottom: '12px' }}>
            📸 Evidence Gallery
          </div>

          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
            {['all', 'discovery', 'planning', 'working'].map((phase) => (
              <button
                key={phase}
                onClick={() =>
                  setEvidenceFilter(phase as 'all' | 'discovery' | 'planning' | 'working')
                }
                style={{
                  padding: '6px 12px',
                  backgroundColor:
                    evidenceFilter === phase ? mentorColor : 'transparent',
                  color: '#E2E8F0',
                  border: `1px solid ${evidenceFilter === phase ? mentorColor : '#374151'}`,
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                {phase === 'all' ? '📦 All' : phase === 'discovery' ? '🔍' : phase === 'planning' ? '📋' : '⚒️'}
                {' '}
                {phase.charAt(0).toUpperCase() + phase.slice(1)}
              </button>
            ))}
          </div>

          {/* Gallery grid */}
          {filteredEvidence.length > 0 ? (
            <motion.div style={galleryGridStyle} layout>
              <AnimatePresence>
                {filteredEvidence.map((item, idx) => (
                  <motion.div
                    key={item.id}
                    style={galleryCardStyle}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2, delay: idx * 0.05 }}
                    whileHover={{ scale: 1.05, borderColor: mentorColor }}
                  >
                    <div style={{ fontSize: '20px' }}>
                      {item.type === 'photo'
                        ? '📷'
                        : item.type === 'voice'
                          ? '🎙️'
                          : item.type === 'text'
                            ? '📝'
                            : item.type === 'file'
                              ? '📄'
                              : item.type === 'reflection'
                                ? '💭'
                                : item.type === 'tool_session'
                                  ? '🎮'
                                  : '🔗'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '6px' }}>
                      {item.type}
                    </div>
                    {item.created_at && (
                      <div style={{ fontSize: '10px', color: '#64748B', marginTop: '4px' }}>
                        {new Date(item.created_at).toLocaleDateString()}
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          ) : (
            <div style={{ textAlign: 'center', padding: '24px 12px', color: '#64748B' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>📭</div>
              <div style={{ fontSize: '13px' }}>No evidence yet</div>
            </div>
          )}
        </motion.div>

        {/* Journey Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          style={{ backgroundColor: '#1a1a2e', borderRadius: '8px', padding: '16px' }}
        >
          <div style={{ fontSize: '15px', fontWeight: '600', color: '#E2E8F0', marginBottom: '12px' }}>
            📊 Journey Stats
          </div>

          <div style={statsContainerStyle}>
            <div style={statCardStyle}>
              <div style={statValueStyle}>{journeyStats.totalEvidence}</div>
              <div style={statLabelStyle}>Evidence Items</div>
            </div>
            <div style={statCardStyle}>
              <div style={statValueStyle}>{journeyStats.completedMilestones}</div>
              <div style={statLabelStyle}>Milestones</div>
            </div>
            <div style={statCardStyle}>
              <div style={statValueStyle}>{journeyStats.daysOnJourney}</div>
              <div style={statLabelStyle}>Days</div>
            </div>
            <div style={statCardStyle}>
              <div style={statValueStyle}>{journeyStats.sessions}</div>
              <div style={statLabelStyle}>Sessions</div>
            </div>
          </div>
        </motion.div>

        {/* Complete Journey Button */}
        <motion.button
          onClick={handleCompleteJourney}
          disabled={!canCompleteJourney || isCompleting}
          whileHover={canCompleteJourney ? { scale: 1.02 } : {}}
          whileTap={canCompleteJourney ? { scale: 0.98 } : {}}
          style={{
            ...completeJourneyButtonStyle,
            marginTop: '8px',
          }}
        >
          {isCompleting ? '🎊 Completing...' : '🎊 Complete Journey'}
        </motion.button>

        {!canCompleteJourney && (
          <div
            style={{
              backgroundColor: '#1a1a2e',
              border: '1px solid #374151',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '12px',
              color: '#94A3B8',
              textAlign: 'center',
            }}
          >
            {sharingMilestones.length === 0 || sharingMilestones.some(m => m.status !== 'completed' && m.status !== 'skipped')
              ? '⚡ Complete all milestones to finish'
              : '📸 Add evidence from your journey'}
          </div>
        )}
      </div>
    </div>
  );
}

export default SharingPhaseView;
