'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QuestJourney, QuestMilestone, QuestEvidence, DiscoveryProfile, StudentContract } from '@/lib/quest/types';
import { PHASE_COLORS } from '@/lib/quest/color-system';
import { getMentor } from '@/lib/quest/mentors';

export interface FinalReflectionData {
  goals_vs_reality: string;
  biggest_challenge: string;
  proudest_moment: string;
  what_id_change: string;
  growth_areas: string[];
  mentor_feedback: string;
  overall_satisfaction: 1 | 2 | 3 | 4 | 5;
}

interface FinalReflectionProps {
  journey: QuestJourney;
  milestones: QuestMilestone[];
  evidence: QuestEvidence[];
  onSubmit: (reflection: FinalReflectionData) => Promise<void>;
  onCancel: () => void;
}

const GROWTH_OPTIONS = [
  'Time management',
  'Research skills',
  'Creative thinking',
  'Technical skills',
  'Communication',
  'Perseverance',
  'Collaboration',
  'Self-awareness',
];

const FILLER_WORDS = new Set([
  'i', 'the', 'a', 'an', 'is', 'was', 'it', 'to', 'and', 'of', 'in', 'for', 'on', 'my', 'we', 'so', 'do', 'be',
  'he', 'she', 'but', 'or', 'if', 'at', 'by', 'up', 'no', 'me', 'that', 'this', 'with', 'are', 'as', 'been', 'have', 'has',
]);

function countMeaningfulWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0 && !FILLER_WORDS.has(w.toLowerCase())).length;
}

function effortGateStatus(count: number, required: number): 'low' | 'medium' | 'high' {
  if (count < Math.floor(required * 0.5)) return 'low';
  if (count < required) return 'medium';
  return 'high';
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function FinalReflection({ journey, milestones, evidence, onSubmit, onCancel }: FinalReflectionProps) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<FinalReflectionData>({
    goals_vs_reality: '',
    biggest_challenge: '',
    proudest_moment: '',
    what_id_change: '',
    growth_areas: [],
    mentor_feedback: '',
    overall_satisfaction: 3,
  });

  const mentor = useMemo(() => getMentor(journey.mentor_id), [journey.mentor_id]);

  // Calculate effort gate statuses
  const effortStatus = useMemo(
    () => ({
      goals: effortGateStatus(countMeaningfulWords(formData.goals_vs_reality), 20),
      challenge: effortGateStatus(countMeaningfulWords(formData.biggest_challenge), 15),
      proud: effortGateStatus(countMeaningfulWords(formData.proudest_moment), 15),
      change: effortGateStatus(countMeaningfulWords(formData.what_id_change), 10),
      mentor: effortGateStatus(countMeaningfulWords(formData.mentor_feedback), 10),
    }),
    [formData]
  );

  // Check if all fields pass gates
  const allFieldsValid = useMemo(
    () =>
      effortStatus.goals === 'high' &&
      effortStatus.challenge === 'high' &&
      effortStatus.proud === 'high' &&
      effortStatus.change === 'high' &&
      effortStatus.mentor === 'high' &&
      formData.growth_areas.length >= 1 &&
      formData.growth_areas.length <= 3,
    [effortStatus, formData.growth_areas]
  );

  const handleFieldChange = (field: keyof FinalReflectionData, value: string | number | string[]) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleGrowthToggle = (area: string) => {
    setFormData((prev) => {
      const current = prev.growth_areas.includes(area)
        ? prev.growth_areas.filter((a) => a !== area)
        : [...prev.growth_areas, area];
      return { ...prev, growth_areas: current };
    });
  };

  const handleSubmit = async () => {
    if (!allFieldsValid) return;
    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepVariants = {
    enter: { opacity: 0, x: 20 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  };

  const mentor_satisfaction_emoji = ['😕', '🤔', '👌', '😊', '🌟'];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(10, 10, 15, 0.95)',
        backdropFilter: 'blur(8px)',
        zIndex: 50,
        overflow: 'auto',
      }}
    >
      <motion.div
        style={{
          maxWidth: '720px',
          margin: '0 auto',
          padding: '48px 24px',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <motion.div style={{ marginBottom: '32px' }}>
          <h2
            style={{
              fontSize: '28px',
              fontWeight: '700',
              color: '#fff',
              marginBottom: '16px',
            }}
          >
            Your Quest Reflection
          </h2>
          <p
            style={{
              fontSize: '14px',
              color: '#a0aec0',
              marginBottom: '24px',
            }}
          >
            Take a moment to reflect on your journey and the growth you've experienced.
          </p>

          {/* Step Indicator */}
          <div
            style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center',
            }}
          >
            {([1, 2, 3] as const).map((step) => (
              <motion.button
                key={step}
                onClick={() => setCurrentStep(step)}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  border: 'none',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  background: currentStep === step ? '#8B5CF6' : currentStep > step ? '#10B981' : '#2d3748',
                  color: '#fff',
                  transition: 'all 200ms',
                }}
              >
                {currentStep > step ? '✓' : step}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Step 1: Look Back */}
        <AnimatePresence mode="wait">
          {currentStep === 1 && (
            <motion.div
              key="step1"
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2 }}
            >
              <div
                style={{
                  background: '#1a1a2e',
                  borderRadius: '12px',
                  padding: '24px',
                  marginBottom: '24px',
                  border: '1px solid #2d3748',
                }}
              >
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#fff', marginBottom: '16px' }}>
                  📖 Look Back
                </h3>

                {/* Journey Timeline */}
                <div
                  style={{
                    marginBottom: '24px',
                    padding: '16px',
                    background: '#0a0a0f',
                    borderRadius: '8px',
                    borderLeft: `4px solid ${PHASE_COLORS.Discovery || '#8B5CF6'}`,
                  }}
                >
                  <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#cbd5e0', marginBottom: '12px' }}>
                    Your Journey Summary
                  </h4>
                  <div style={{ fontSize: '13px', color: '#a0aec0', lineHeight: '1.6' }}>
                    <p>🌟 Quest: {journey.project_title}</p>
                    <p>📅 Started: {formatDate(journey.created_at)}</p>
                    <p>🎯 Milestones completed: {milestones.filter((m) => m.completed_at).length} / {milestones.length}</p>
                    <p>📸 Evidence collected: {evidence.length}</p>
                  </div>
                </div>

                {/* Reflection Prompt */}
                <label style={{ display: 'block', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#cbd5e0' }}>
                    Compare where you started to where you ended. What changed?
                  </span>
                </label>
                <textarea
                  value={formData.goals_vs_reality}
                  onChange={(e) => handleFieldChange('goals_vs_reality', e.target.value)}
                  placeholder="Reflect on your starting point and how you've grown..."
                  style={{
                    width: '100%',
                    minHeight: '120px',
                    padding: '12px',
                    background: '#0a0a0f',
                    border: `1px solid ${effortStatus.goals === 'high' ? '#10B981' : effortStatus.goals === 'medium' ? '#F59E0B' : '#4a5568'}`,
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '13px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    marginBottom: '8px',
                  }}
                />
                <div
                  style={{
                    fontSize: '12px',
                    color: effortStatus.goals === 'high' ? '#10B981' : effortStatus.goals === 'medium' ? '#F59E0B' : '#718096',
                  }}
                >
                  {countMeaningfulWords(formData.goals_vs_reality)} meaningful words (min 20)
                </div>
              </div>

              {/* Navigation */}
              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                  justifyContent: 'space-between',
                }}
              >
                <button
                  onClick={onCancel}
                  style={{
                    padding: '10px 16px',
                    background: '#2d3748',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => setCurrentStep(2)}
                  disabled={effortStatus.goals !== 'high'}
                  style={{
                    padding: '10px 16px',
                    background: effortStatus.goals === 'high' ? '#8B5CF6' : '#4a5568',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: effortStatus.goals === 'high' ? 'pointer' : 'not-allowed',
                    opacity: effortStatus.goals === 'high' ? 1 : 0.6,
                  }}
                >
                  Continue
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 2: Dig Deep */}
          {currentStep === 2 && (
            <motion.div
              key="step2"
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2 }}
            >
              <div
                style={{
                  background: '#1a1a2e',
                  borderRadius: '12px',
                  padding: '24px',
                  marginBottom: '24px',
                  border: '1px solid #8B5CF6',
                }}
              >
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#fff', marginBottom: '20px' }}>
                  🔍 Dig Deep
                </h3>

                {/* Biggest Challenge */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#cbd5e0' }}>
                      What was your biggest challenge?
                    </span>
                  </label>
                  <textarea
                    value={formData.biggest_challenge}
                    onChange={(e) => handleFieldChange('biggest_challenge', e.target.value)}
                    placeholder="What did you struggle with?"
                    style={{
                      width: '100%',
                      minHeight: '100px',
                      padding: '12px',
                      background: '#0a0a0f',
                      border: `1px solid ${effortStatus.challenge === 'high' ? '#10B981' : effortStatus.challenge === 'medium' ? '#F59E0B' : '#4a5568'}`,
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '13px',
                      fontFamily: 'inherit',
                      resize: 'vertical',
                      marginBottom: '4px',
                    }}
                  />
                  <div
                    style={{
                      fontSize: '12px',
                      color: effortStatus.challenge === 'high' ? '#10B981' : effortStatus.challenge === 'medium' ? '#F59E0B' : '#718096',
                      marginBottom: '20px',
                    }}
                  >
                    {countMeaningfulWords(formData.biggest_challenge)} meaningful words (min 15)
                  </div>
                </div>

                {/* Proudest Moment */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#cbd5e0' }}>
                      What's your proudest moment from this quest?
                    </span>
                  </label>
                  <textarea
                    value={formData.proudest_moment}
                    onChange={(e) => handleFieldChange('proudest_moment', e.target.value)}
                    placeholder="What are you most proud of?"
                    style={{
                      width: '100%',
                      minHeight: '100px',
                      padding: '12px',
                      background: '#0a0a0f',
                      border: `1px solid ${effortStatus.proud === 'high' ? '#10B981' : effortStatus.proud === 'medium' ? '#F59E0B' : '#4a5568'}`,
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '13px',
                      fontFamily: 'inherit',
                      resize: 'vertical',
                      marginBottom: '4px',
                    }}
                  />
                  <div
                    style={{
                      fontSize: '12px',
                      color: effortStatus.proud === 'high' ? '#10B981' : effortStatus.proud === 'medium' ? '#F59E0B' : '#718096',
                      marginBottom: '20px',
                    }}
                  >
                    {countMeaningfulWords(formData.proudest_moment)} meaningful words (min 15)
                  </div>
                </div>

                {/* What I'd Change */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#cbd5e0' }}>
                      If you could do it again, what would you change?
                    </span>
                  </label>
                  <textarea
                    value={formData.what_id_change}
                    onChange={(e) => handleFieldChange('what_id_change', e.target.value)}
                    placeholder="What would you approach differently?"
                    style={{
                      width: '100%',
                      minHeight: '100px',
                      padding: '12px',
                      background: '#0a0a0f',
                      border: `1px solid ${effortStatus.change === 'high' ? '#10B981' : effortStatus.change === 'medium' ? '#F59E0B' : '#4a5568'}`,
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '13px',
                      fontFamily: 'inherit',
                      resize: 'vertical',
                      marginBottom: '4px',
                    }}
                  />
                  <div
                    style={{
                      fontSize: '12px',
                      color: effortStatus.change === 'high' ? '#10B981' : effortStatus.change === 'medium' ? '#F59E0B' : '#718096',
                      marginBottom: '20px',
                    }}
                  >
                    {countMeaningfulWords(formData.what_id_change)} meaningful words (min 10)
                  </div>
                </div>

                {/* Growth Areas */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#cbd5e0' }}>
                      Select 1-3 areas where you've grown
                    </span>
                  </label>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                  >
                    {GROWTH_OPTIONS.map((area) => (
                      <motion.button
                        key={area}
                        onClick={() => handleGrowthToggle(area)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.98 }}
                        style={{
                          padding: '8px 12px',
                          background: formData.growth_areas.includes(area) ? '#8B5CF6' : '#2d3748',
                          color: '#fff',
                          border: '1px solid ' + (formData.growth_areas.includes(area) ? '#8B5CF6' : '#4a5568'),
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '500',
                          cursor: 'pointer',
                          transition: 'all 200ms',
                        }}
                      >
                        {area}
                      </motion.button>
                    ))}
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: formData.growth_areas.length >= 1 && formData.growth_areas.length <= 3 ? '#10B981' : '#F59E0B',
                      marginTop: '8px',
                    }}
                  >
                    {formData.growth_areas.length} / 3 selected
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                  justifyContent: 'space-between',
                }}
              >
                <button
                  onClick={() => setCurrentStep(1)}
                  style={{
                    padding: '10px 16px',
                    background: '#2d3748',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Back
                </button>
                <button
                  onClick={() => setCurrentStep(3)}
                  disabled={
                    effortStatus.challenge !== 'high' ||
                    effortStatus.proud !== 'high' ||
                    effortStatus.change !== 'high' ||
                    formData.growth_areas.length === 0 ||
                    formData.growth_areas.length > 3
                  }
                  style={{
                    padding: '10px 16px',
                    background:
                      effortStatus.challenge === 'high' &&
                      effortStatus.proud === 'high' &&
                      effortStatus.change === 'high' &&
                      formData.growth_areas.length >= 1 &&
                      formData.growth_areas.length <= 3
                        ? '#8B5CF6'
                        : '#4a5568',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor:
                      effortStatus.challenge === 'high' &&
                      effortStatus.proud === 'high' &&
                      effortStatus.change === 'high' &&
                      formData.growth_areas.length >= 1 &&
                      formData.growth_areas.length <= 3
                        ? 'pointer'
                        : 'not-allowed',
                    opacity:
                      effortStatus.challenge === 'high' &&
                      effortStatus.proud === 'high' &&
                      effortStatus.change === 'high' &&
                      formData.growth_areas.length >= 1 &&
                      formData.growth_areas.length <= 3
                        ? 1
                        : 0.6,
                  }}
                >
                  Continue
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Look Forward */}
          {currentStep === 3 && (
            <motion.div
              key="step3"
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2 }}
            >
              <div
                style={{
                  background: '#1a1a2e',
                  borderRadius: '12px',
                  padding: '24px',
                  marginBottom: '24px',
                  border: '1px solid #8B5CF6',
                }}
              >
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#fff', marginBottom: '20px' }}>
                  🚀 Look Forward
                </h3>

                {/* Mentor Farewell */}
                <div
                  style={{
                    background: '#0a0a0f',
                    borderRadius: '8px',
                    padding: '16px',
                    marginBottom: '20px',
                    borderLeft: `4px solid ${mentor?.color || '#8B5CF6'}`,
                  }}
                >
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '32px' }}>{mentor?.emoji || '🌟'}</span>
                    <div>
                      <p style={{ fontSize: '13px', color: '#cbd5e0', marginBottom: '8px', fontStyle: 'italic' }}>
                        "{mentor?.farewell_message || 'You did incredible work. Keep going!'}"
                      </p>
                      <p style={{ fontSize: '12px', color: '#a0aec0' }}>— {mentor?.name || 'Your Mentor'}</p>
                    </div>
                  </div>
                </div>

                {/* Mentor Feedback */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#cbd5e0' }}>
                      What would you tell your mentor?
                    </span>
                  </label>
                  <textarea
                    value={formData.mentor_feedback}
                    onChange={(e) => handleFieldChange('mentor_feedback', e.target.value)}
                    placeholder="Thank you for... or I learned that..."
                    style={{
                      width: '100%',
                      minHeight: '100px',
                      padding: '12px',
                      background: '#0a0a0f',
                      border: `1px solid ${effortStatus.mentor === 'high' ? '#10B981' : effortStatus.mentor === 'medium' ? '#F59E0B' : '#4a5568'}`,
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '13px',
                      fontFamily: 'inherit',
                      resize: 'vertical',
                      marginBottom: '4px',
                    }}
                  />
                  <div
                    style={{
                      fontSize: '12px',
                      color: effortStatus.mentor === 'high' ? '#10B981' : effortStatus.mentor === 'medium' ? '#F59E0B' : '#718096',
                      marginBottom: '20px',
                    }}
                  >
                    {countMeaningfulWords(formData.mentor_feedback)} meaningful words (min 10)
                  </div>
                </div>

                {/* Satisfaction Rating */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '12px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#cbd5e0' }}>
                      How satisfied are you with your quest?
                    </span>
                  </label>
                  <div
                    style={{
                      display: 'flex',
                      gap: '12px',
                      justifyContent: 'center',
                    }}
                  >
                    {([1, 2, 3, 4, 5] as const).map((rating) => (
                      <motion.button
                        key={rating}
                        onClick={() => handleFieldChange('overall_satisfaction', rating)}
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.95 }}
                        style={{
                          fontSize: '32px',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '8px',
                          borderRadius: '8px',
                          background: formData.overall_satisfaction === rating ? '#8B5CF6' : 'transparent',
                          opacity: formData.overall_satisfaction === rating ? 1 : 0.5,
                          transition: 'all 200ms',
                        }}
                      >
                        {mentor_satisfaction_emoji[rating - 1]}
                      </motion.button>
                    ))}
                  </div>
                  <p style={{ fontSize: '12px', color: '#a0aec0', marginTop: '8px', textAlign: 'center' }}>
                    {formData.overall_satisfaction === 1 && "I'd do things differently"}
                    {formData.overall_satisfaction === 2 && "It was okay"}
                    {formData.overall_satisfaction === 3 && "I'm satisfied with my work"}
                    {formData.overall_satisfaction === 4 && "I'm really happy with it"}
                    {formData.overall_satisfaction === 5 && "This was incredible!"}
                  </p>
                </div>
              </div>

              {/* Validation message */}
              {!allFieldsValid && (
                <div
                  style={{
                    background: '#7C2D12',
                    border: '1px solid #DC2626',
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '16px',
                    fontSize: '12px',
                    color: '#FCA5A5',
                  }}
                >
                  📋 Complete all sections with thoughtful reflections before submitting
                </div>
              )}

              {/* Navigation */}
              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                  justifyContent: 'space-between',
                }}
              >
                <button
                  onClick={() => setCurrentStep(2)}
                  style={{
                    padding: '10px 16px',
                    background: '#2d3748',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Back
                </button>
                <motion.button
                  onClick={handleSubmit}
                  disabled={!allFieldsValid || isSubmitting}
                  whileHover={allFieldsValid && !isSubmitting ? { boxShadow: '0 0 20px rgba(139, 92, 246, 0.5)' } : undefined}
                  style={{
                    padding: '10px 16px',
                    background: allFieldsValid && !isSubmitting ? '#8B5CF6' : '#4a5568',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: allFieldsValid && !isSubmitting ? 'pointer' : 'not-allowed',
                    opacity: allFieldsValid && !isSubmitting ? 1 : 0.6,
                    transition: 'all 200ms',
                  }}
                >
                  {isSubmitting ? 'Submitting...' : 'Complete Quest'}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

export default FinalReflection;
