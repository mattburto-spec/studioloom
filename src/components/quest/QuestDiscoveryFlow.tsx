'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { MentorId } from '@/lib/quest/types';
import { getMentor } from '@/lib/quest/mentors';
import MentorAvatar from './MentorAvatar';

// Step configuration with headers, icons, and opening provocations
const DISCOVERY_STEPS = [
  {
    id: 'strengths',
    title: 'Your Strengths',
    icon: '💪',
    color: '#fbbf24', // amber
    scene: 'strengths-scene',
    provocation: 'Imagine your best friend calls you in a panic — big project due tomorrow, only 2 hours left. What do you actually DO? Not what you\'d say — what\'s your instinct?',
    profile_key: 'strengths',
  },
  {
    id: 'interests',
    title: 'Your Interests',
    icon: '🔥',
    color: '#3b82f6', // blue
    scene: 'interests-scene',
    provocation: 'What annoys you? Seriously — what\'s something in the world that bugs you every time you see it?',
    profile_key: 'interests',
  },
  {
    id: 'needs',
    title: 'What Needs Fixing',
    icon: '🤝',
    color: '#10b981', // emerald
    scene: 'needs-scene',
    provocation: 'Look around your school, your neighbourhood, your community. Who\'s struggling? What\'s broken that nobody\'s fixing?',
    profile_key: 'needs',
  },
  {
    id: 'narrowing',
    title: 'Focus Your Idea',
    icon: '🎯',
    color: '#8b5cf6', // violet
    scene: 'narrowing-scene',
    provocation: 'OK, you\'ve told me a lot. I\'m going to push you: if you could only work on ONE thing for the next few weeks, and it had to actually help someone — what would it be?',
    profile_key: 'narrowing_notes',
  },
  {
    id: 'commitment',
    title: 'Your Commitment',
    icon: '🚀',
    color: '#ef4444', // red
    scene: 'commitment-scene',
    provocation: 'Last step. Tell me in one paragraph: what are you going to build/do/create, who is it for, and how will you know when it\'s done?',
    profile_key: 'project_idea',
  },
];

interface DiscoveryMessage {
  role: 'mentor' | 'student';
  content: string;
  step: string;
  timestamp: number;
}

interface DiscoveredProfile {
  strengths: string[];
  interests: string[];
  needs: string[];
  narrowing_notes: string;
  project_idea: string;
  archetype: string | null;
}

interface QuestDiscoveryFlowProps {
  journeyId: string;
  mentorId: MentorId;
  existingProfile?: DiscoveredProfile | null;
  onComplete: (profile: DiscoveredProfile) => void;
  onStepChange?: (step: string) => void;
}

export default function QuestDiscoveryFlow({
  journeyId,
  mentorId,
  existingProfile,
  onComplete,
  onStepChange,
}: QuestDiscoveryFlowProps) {
  const mentor = getMentor(mentorId);

  // State management
  const [currentStepIndex, setCurrentStepIndex] = useState(existingProfile ? 5 : 0);
  const [messages, setMessages] = useState<DiscoveryMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [discoveredProfile, setDiscoveredProfile] = useState<DiscoveredProfile>(
    existingProfile || {
      strengths: [],
      interests: [],
      needs: [],
      narrowing_notes: '',
      project_idea: '',
      archetype: null,
    }
  );
  const [showSummary, setShowSummary] = useState(existingProfile !== null && existingProfile !== undefined);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentStep = DISCOVERY_STEPS[currentStepIndex];

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Notify parent when step changes
  useEffect(() => {
    onStepChange?.(currentStep?.id || 'complete');
  }, [currentStepIndex, currentStep, onStepChange]);

  // Send message to mentor AI
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const studentMessage: DiscoveryMessage = {
      role: 'student',
      content: inputValue,
      step: currentStep.id,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, studentMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/student/quest/mentor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          journeyId,
          message: inputValue,
          interactionType: 'discovery_step',
          step: currentStep.id,
          mentorId,
          conversationHistory: messages.filter((m) => m.step === currentStep.id),
        }),
      });

      if (!response.ok) throw new Error('Failed to get mentor response');

      const data = await response.json();
      const mentorMessage: DiscoveryMessage = {
        role: 'mentor',
        content: data.response,
        step: currentStep.id,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, mentorMessage]);

      // Extract profile data if provided in response
      if (data.extracted_profile) {
        setDiscoveredProfile((prev) => ({
          ...prev,
          ...data.extracted_profile,
        }));
      }
    } catch (error) {
      console.error('Error getting mentor response:', error);
      const errorMessage: DiscoveryMessage = {
        role: 'mentor',
        content: `I got a bit confused there. Could you tell me more about that?`,
        step: currentStep.id,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Check if student has sent enough messages to advance
  const stepMessages = messages.filter((m) => m.step === currentStep.id);
  const studentMessagesInStep = stepMessages.filter((m) => m.role === 'student').length;
  const canAdvance = studentMessagesInStep >= 2;

  const handleAdvanceStep = () => {
    if (currentStepIndex < DISCOVERY_STEPS.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
      // Don't add new messages when advancing — they naturally appear in the new step
    } else {
      // Reached final step, show summary
      setShowSummary(true);
    }
  };

  const handleComplete = () => {
    onComplete(discoveredProfile);
  };

  // Render summary screen
  if (showSummary) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{
          backgroundColor: '#0f172a',
          color: '#f1f5f9',
          padding: '2rem',
          borderRadius: '12px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          minHeight: '600px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '2rem',
        }}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          style={{
            textAlign: 'center',
          }}
        >
          <h2 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            Your Design Quest Awaits ✨
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '1.1rem' }}>
            Here's what we discovered about you
          </p>
        </motion.div>

        {/* Strengths */}
        {discoveredProfile.strengths && discoveredProfile.strengths.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            style={{
              width: '100%',
              maxWidth: '500px',
            }}
          >
            <label style={{ color: '#fbbf24', fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>
              💪 Your Strengths
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {discoveredProfile.strengths.map((tag, i) => (
                <span
                  key={i}
                  style={{
                    backgroundColor: 'rgba(251, 191, 36, 0.2)',
                    border: '1px solid #fbbf24',
                    color: '#fbbf24',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '20px',
                    fontSize: '0.9rem',
                    fontWeight: '500',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* Interests */}
        {discoveredProfile.interests && discoveredProfile.interests.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            style={{
              width: '100%',
              maxWidth: '500px',
            }}
          >
            <label style={{ color: '#3b82f6', fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>
              🔥 Your Interests
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {discoveredProfile.interests.map((tag, i) => (
                <span
                  key={i}
                  style={{
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    border: '1px solid #3b82f6',
                    color: '#3b82f6',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '20px',
                    fontSize: '0.9rem',
                    fontWeight: '500',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* Needs */}
        {discoveredProfile.needs && discoveredProfile.needs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            style={{
              width: '100%',
              maxWidth: '500px',
            }}
          >
            <label style={{ color: '#10b981', fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>
              🤝 What Needs Fixing
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {discoveredProfile.needs.map((tag, i) => (
                <span
                  key={i}
                  style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    border: '1px solid #10b981',
                    color: '#10b981',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '20px',
                    fontSize: '0.9rem',
                    fontWeight: '500',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* Project Idea */}
        {discoveredProfile.project_idea && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            style={{
              width: '100%',
              maxWidth: '500px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '2px solid #ef4444',
              borderRadius: '8px',
              padding: '1rem',
            }}
          >
            <label style={{ color: '#ef4444', fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>
              🚀 Your Project
            </label>
            <p style={{ color: '#f1f5f9', lineHeight: '1.6' }}>
              {discoveredProfile.project_idea}
            </p>
          </motion.div>
        )}

        {/* Begin Planning Button */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          onClick={handleComplete}
          style={{
            backgroundColor: '#7c3aed',
            color: 'white',
            padding: '1rem 2rem',
            fontSize: '1.1rem',
            fontWeight: 'bold',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            marginTop: '1rem',
            transition: 'background-color 0.2s',
          }}
          whileHover={{ backgroundColor: '#6d28d9' }}
          whileTap={{ scale: 0.98 }}
        >
          Begin Planning →
        </motion.button>
      </motion.div>
    );
  }

  // Main discovery flow
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        backgroundColor: '#0f172a',
        color: '#f1f5f9',
        borderRadius: '12px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        minHeight: '800px',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {/* Progress dots */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '0.75rem',
          padding: '1.5rem',
          borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
        }}
      >
        {DISCOVERY_STEPS.map((step, idx) => (
          <motion.div
            key={step.id}
            animate={{
              backgroundColor: idx === currentStepIndex ? step.color : '#475569',
              scale: idx === currentStepIndex ? 1.2 : 1,
            }}
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              cursor: 'pointer',
            }}
          />
        ))}
      </motion.div>

      {/* Step header */}
      <motion.div
        key={currentStep.id}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          backgroundColor: currentStep.color,
          color: '#0f172a',
          padding: '1.5rem',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{currentStep.icon}</div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>
          {currentStep.title}
        </h2>
        <p style={{ margin: '0.5rem 0 0 0', opacity: 0.85, fontSize: '0.95rem' }}>
          Step {currentStepIndex + 1} of {DISCOVERY_STEPS.length}
        </p>
      </motion.div>

      {/* Messages area */}
      <motion.div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <AnimatePresence mode="popLayout">
          {messages
            .filter((m) => m.step === currentStep.id)
            .map((message, idx) => (
              <motion.div
                key={`${message.step}-${idx}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                layout
              >
                {message.role === 'mentor' ? (
                  // Mentor message (comic panel style)
                  <div
                    style={{
                      display: 'flex',
                      gap: '1rem',
                      alignItems: 'flex-start',
                    }}
                  >
                    <div style={{ flex: '0 0 60px', marginTop: '0.25rem' }}>
                      <MentorAvatar mentorId={mentorId} size={40} />
                    </div>
                    <div
                      style={{
                        flex: 1,
                        backgroundColor: '#1e293b',
                        border: '3px solid #475569',
                        borderRadius: '12px',
                        padding: '1rem',
                        position: 'relative',
                      }}
                    >
                      {/* Comic bubble tail */}
                      <div
                        style={{
                          position: 'absolute',
                          left: '-12px',
                          top: '1rem',
                          width: 0,
                          height: 0,
                          borderLeft: '12px solid transparent',
                          borderTop: '6px solid #1e293b',
                          borderBottom: '6px solid #1e293b',
                        }}
                      />
                      <p
                        style={{
                          margin: 0,
                          color: '#e2e8f0',
                          lineHeight: '1.6',
                          fontSize: '0.95rem',
                        }}
                      >
                        {message.content}
                      </p>
                    </div>
                  </div>
                ) : (
                  // Student message
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                    }}
                  >
                    <div
                      style={{
                        backgroundColor: 'rgba(59, 130, 246, 0.2)',
                        border: `3px solid ${currentStep.color}`,
                        borderRadius: '12px',
                        padding: '1rem',
                        maxWidth: '80%',
                        position: 'relative',
                      }}
                    >
                      {/* Comic bubble tail */}
                      <div
                        style={{
                          position: 'absolute',
                          right: '-12px',
                          top: '1rem',
                          width: 0,
                          height: 0,
                          borderRight: '12px solid transparent',
                          borderTop: `6px solid rgba(59, 130, 246, 0.2)`,
                          borderBottom: `6px solid rgba(59, 130, 246, 0.2)`,
                        }}
                      />
                      <p
                        style={{
                          margin: 0,
                          color: '#e2e8f0',
                          lineHeight: '1.6',
                          fontSize: '0.95rem',
                        }}
                      >
                        {message.content}
                      </p>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
        </AnimatePresence>

        {/* Initial provocation if no messages yet */}
        {stepMessages.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              display: 'flex',
              gap: '1rem',
              alignItems: 'flex-start',
              marginBottom: '1rem',
            }}
          >
            <div style={{ flex: '0 0 60px', marginTop: '0.25rem' }}>
              <MentorAvatar mentorId={mentorId} size={40} />
            </div>
            <div
              style={{
                flex: 1,
                backgroundColor: '#1e293b',
                border: '3px solid #475569',
                borderRadius: '12px',
                padding: '1rem',
                position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: '-12px',
                  top: '1rem',
                  width: 0,
                  height: 0,
                  borderLeft: '12px solid transparent',
                  borderTop: '6px solid #1e293b',
                  borderBottom: '6px solid #1e293b',
                }}
              />
              <p
                style={{
                  margin: 0,
                  color: '#e2e8f0',
                  lineHeight: '1.6',
                  fontSize: '0.95rem',
                  fontStyle: 'italic',
                }}
              >
                {currentStep.provocation}
              </p>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </motion.div>

      {/* Input area */}
      <motion.div
        style={{
          borderTop: '1px solid rgba(148, 163, 184, 0.2)',
          padding: '1.5rem',
          display: 'flex',
          gap: '1rem',
        }}
      >
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          placeholder="Share your thoughts..."
          disabled={isLoading}
          style={{
            flex: 1,
            backgroundColor: '#1e293b',
            border: `2px solid ${currentStep.color}`,
            borderRadius: '8px',
            padding: '0.75rem',
            color: '#f1f5f9',
            fontSize: '0.95rem',
            fontFamily: 'inherit',
            resize: 'vertical',
            minHeight: '80px',
            opacity: isLoading ? 0.6 : 1,
            cursor: isLoading ? 'not-allowed' : 'text',
          }}
        />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            justifyContent: 'flex-end',
          }}
        >
          <motion.button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={{
              backgroundColor: currentStep.color,
              color: '#0f172a',
              padding: '0.75rem 1rem',
              fontWeight: 'bold',
              border: 'none',
              borderRadius: '8px',
              cursor: !inputValue.trim() || isLoading ? 'not-allowed' : 'pointer',
              opacity: !inputValue.trim() || isLoading ? 0.5 : 1,
            }}
          >
            {isLoading ? '...' : 'Send'}
          </motion.button>
          {canAdvance && (
            <motion.button
              onClick={handleAdvanceStep}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              style={{
                backgroundColor: 'rgba(139, 92, 246, 0.8)',
                color: '#f1f5f9',
                padding: '0.75rem 1rem',
                fontWeight: 'bold',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              Next →
            </motion.button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
