'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { HealthScore, MentorId } from '@/lib/quest/types';
import { getHealthColor, getHealthSummary } from '@/lib/quest/health';
import { getMentor } from '@/lib/quest/mentors';
import MentorAvatar from './MentorAvatar';

interface ChatMessage {
  type: 'student' | 'mentor';
  content: string;
  timestamp: Date;
  interactionType?: 'check_in' | 'help_request';
}

interface CheckInPanelProps {
  journeyId: string;
  healthScore: HealthScore;
  mentorId: MentorId | null;
  mentorName?: string;
  mentorColor?: string;
  onCheckInComplete?: () => void;
}

export function CheckInPanel({
  journeyId,
  healthScore,
  mentorId,
  mentorName,
  mentorColor = '#A78BFA',
  onCheckInComplete,
}: CheckInPanelProps) {
  const mentor = mentorId ? getMentor(mentorId) : null;
  const displayName = mentorName || mentor?.name || 'Mentor';
  const displayColor = mentor?.primaryColor || mentorColor;

  // Session management
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [workingMinutes, setWorkingMinutes] = useState(0);
  const [checkInCountdown, setCheckInCountdown] = useState(
    healthScore.check_in_interval_minutes * 60
  );

  // UI state
  const [isCheckInOpen, setIsCheckInOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [showChatHistory, setShowChatHistory] = useState(false);

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [currentResponse, setCurrentResponse] = useState('');
  const [studentMessage, setStudentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pulseSelected, setPulseSelected] = useState<string | null>(null);

  // Refs
  const sessionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const helpCollapseTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize session timer
  useEffect(() => {
    setSessionStartTime(new Date());

    sessionTimerRef.current = setInterval(() => {
      setWorkingMinutes((prev) => prev + 1);
    }, 60000);

    return () => {
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
    };
  }, []);

  // Countdown timer
  useEffect(() => {
    countdownTimerRef.current = setInterval(() => {
      setCheckInCountdown((prev) => {
        if (prev <= 1) {
          setIsCheckInOpen(true);
          return healthScore.check_in_interval_minutes * 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [healthScore.check_in_interval_minutes]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      if (helpCollapseTimerRef.current) clearTimeout(helpCollapseTimerRef.current);
    };
  }, []);

  // Handle check-in submission
  const handleCheckInSubmit = async (pulseValue?: string) => {
    let messageToSend = studentMessage;
    if (pulseValue) {
      const pulseMap: Record<string, string> = {
        crushing_it: 'Crushing it 🔥',
        okay: 'Doing okay 👌',
        stuck: 'Stuck 😕',
        lost: 'Lost 😶',
      };
      messageToSend = pulseMap[pulseValue] || pulseValue;
      setPulseSelected(pulseValue);
    }

    if (!messageToSend.trim()) return;

    setIsLoading(true);
    const newStudentMsg: ChatMessage = {
      type: 'student',
      content: messageToSend,
      timestamp: new Date(),
      interactionType: 'check_in',
    };

    setChatMessages((prev) => [...prev, newStudentMsg]);
    setStudentMessage('');

    try {
      const response = await fetch('/api/student/quest/mentor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          journeyId,
          message: messageToSend,
          interactionType: 'check_in',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const mentorMsg: ChatMessage = {
          type: 'mentor',
          content: data.mentorResponse || '',
          timestamp: new Date(),
          interactionType: 'check_in',
        };
        setChatMessages((prev) => [...prev, mentorMsg]);
        setCurrentResponse(data.mentorResponse || '');
      } else {
        const fallbackMsg: ChatMessage = {
          type: 'mentor',
          content: `Thanks for sharing that. I can see where you're at. Let's keep moving forward.`,
          timestamp: new Date(),
          interactionType: 'check_in',
        };
        setChatMessages((prev) => [...prev, fallbackMsg]);
        setCurrentResponse(fallbackMsg.content);
      }
    } catch (error) {
      console.error('Check-in submission failed:', error);
      const errorMsg: ChatMessage = {
        type: 'mentor',
        content: `I'm here for you. Take your time and share what's on your mind.`,
        timestamp: new Date(),
        interactionType: 'check_in',
      };
      setChatMessages((prev) => [...prev, errorMsg]);
      setCurrentResponse(errorMsg.content);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle help request
  const handleHelpRequest = async () => {
    if (!studentMessage.trim()) return;

    setIsLoading(true);
    const newStudentMsg: ChatMessage = {
      type: 'student',
      content: studentMessage,
      timestamp: new Date(),
      interactionType: 'help_request',
    };

    setChatMessages((prev) => [...prev, newStudentMsg]);
    setStudentMessage('');

    try {
      const response = await fetch('/api/student/quest/mentor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          journeyId,
          message: studentMessage,
          interactionType: 'help_request',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const mentorMsg: ChatMessage = {
          type: 'mentor',
          content: data.mentorResponse || '',
          timestamp: new Date(),
          interactionType: 'help_request',
        };
        setChatMessages((prev) => [...prev, mentorMsg]);
        setCurrentResponse(data.mentorResponse || '');
      }
    } catch (error) {
      console.error('Help request failed:', error);
    } finally {
      setIsLoading(false);

      // Auto-collapse after 10 seconds
      if (helpCollapseTimerRef.current) clearTimeout(helpCollapseTimerRef.current);
      helpCollapseTimerRef.current = setTimeout(() => {
        setIsHelpOpen(false);
      }, 10000);
    }
  };

  const countdownMinutes = Math.floor(checkInCountdown / 60);
  const countdownSeconds = checkInCountdown % 60;
  const countdownPercent = (
    ((healthScore.check_in_interval_minutes * 60 - checkInCountdown) /
      (healthScore.check_in_interval_minutes * 60)) *
    100
  );

  // Color scheme
  const DARK_BG = '#0f172a';
  const DARK_BORDER = '#1e293b';
  const DARK_SECONDARY = '#111827';
  const TEXT_PRIMARY = '#f1f5f9';
  const TEXT_SECONDARY = '#cbd5e1';
  const GRAY_SUBTLE = '#334155';

  return (
    <div
      style={{
        backgroundColor: DARK_BG,
        borderRadius: '12px',
        padding: '16px',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: DARK_BORDER,
        marginBottom: '16px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Health Dashboard */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          backgroundColor: DARK_SECONDARY,
          borderRadius: '10px',
          padding: '12px',
          marginBottom: '12px',
        }}
      >
        {/* Health Gauges */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '8px',
            marginBottom: '12px',
          }}
        >
          {[
            { label: 'Momentum', value: healthScore.momentum },
            { label: 'Engagement', value: healthScore.engagement },
            { label: 'Quality', value: healthScore.quality },
            { label: 'Self-Aware', value: healthScore.self_awareness },
          ].map(({ label, value }) => (
            <motion.div
              key={label}
              whileHover={{ scale: 1.08 }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <motion.div
                animate={{
                  boxShadow: `0 0 12px ${getHealthColor(value)}40`,
                }}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: getHealthColor(value),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              />
              <span
                style={{
                  fontSize: '10px',
                  color: TEXT_SECONDARY,
                  textAlign: 'center',
                }}
              >
                {label}
              </span>
            </motion.div>
          ))}
        </div>

        {/* Health Summary */}
        <p
          style={{
            fontSize: '13px',
            color: TEXT_PRIMARY,
            margin: '0',
            lineHeight: '1.4',
          }}
        >
          {getHealthSummary(healthScore)}
        </p>
      </motion.div>

      {/* Session Timer & Countdown */}
      <motion.div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
          paddingBottom: '8px',
          borderBottomWidth: '1px',
          borderBottomStyle: 'solid',
          borderBottomColor: DARK_BORDER,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '14px' }}>⏱️</span>
          <span
            style={{
              fontSize: '13px',
              color: TEXT_SECONDARY,
            }}
          >
            Working for {workingMinutes}m
          </span>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              fontSize: '12px',
              color: TEXT_SECONDARY,
              marginBottom: '2px',
            }}
          >
            Check-in in {countdownMinutes}:{String(countdownSeconds).padStart(2, '0')}
          </div>
          <div
            style={{
              width: '80px',
              height: '2px',
              backgroundColor: GRAY_SUBTLE,
              borderRadius: '1px',
              overflow: 'hidden',
            }}
          >
            <motion.div
              initial={{ width: '0%' }}
              animate={{ width: `${countdownPercent}%` }}
              transition={{ duration: 0.5 }}
              style={{
                height: '100%',
                backgroundColor: displayColor,
              }}
            />
          </div>
        </div>
      </motion.div>

      {/* Check-In Conversation */}
      <AnimatePresence>
        {isCheckInOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            style={{
              backgroundColor: DARK_SECONDARY,
              borderRadius: '10px',
              padding: '12px',
              marginBottom: '12px',
              borderLeftWidth: '3px',
              borderLeftStyle: 'solid',
              borderLeftColor: displayColor,
            }}
          >
            {/* Mentor Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '12px',
              }}
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: displayColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: '#fff',
                }}
              >
                {displayName[0].toUpperCase()}
              </div>
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: '500',
                  color: TEXT_PRIMARY,
                }}
              >
                {displayName} Check-In
              </span>
            </div>

            {/* Chat History */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                marginBottom: '12px',
                maxHeight: '200px',
                overflowY: 'auto',
              }}
            >
              {chatMessages
                .filter((msg) => msg.interactionType === 'check_in')
                .map((msg, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: msg.type === 'student' ? 8 : -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    style={{
                      display: 'flex',
                      justifyContent: msg.type === 'student' ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <div
                      style={{
                        maxWidth: '85%',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        lineHeight: '1.4',
                        backgroundColor:
                          msg.type === 'student'
                            ? `${displayColor}25`
                            : DARK_BORDER,
                        color: TEXT_PRIMARY,
                        borderWidth: msg.type === 'student' ? '1px' : '0',
                        borderStyle: 'solid',
                        borderColor:
                          msg.type === 'student' ? displayColor : 'transparent',
                      }}
                    >
                      {msg.content}
                    </div>
                  </motion.div>
                ))}
            </div>

            {/* Response Input or Pulse Buttons */}
            {!currentResponse && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <textarea
                  value={studentMessage}
                  onChange={(e) => setStudentMessage(e.target.value)}
                  placeholder="Share how you're feeling..."
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '6px',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: DARK_BORDER,
                    backgroundColor: DARK_BG,
                    color: TEXT_PRIMARY,
                    fontSize: '12px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    minHeight: '60px',
                  }}
                />

                {/* Pulse Buttons */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '6px',
                  }}
                >
                  {[
                    { value: 'crushing_it', label: 'Crushing it 🔥' },
                    { value: 'okay', label: 'Doing okay 👌' },
                    { value: 'stuck', label: 'Stuck 😕' },
                    { value: 'lost', label: 'Lost 😶' },
                  ].map(({ value, label }) => (
                    <motion.button
                      key={value}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleCheckInSubmit(value)}
                      disabled={isLoading}
                      style={{
                        padding: '6px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '500',
                        borderWidth: '1px',
                        borderStyle: 'solid',
                        borderColor:
                          pulseSelected === value ? displayColor : GRAY_SUBTLE,
                        backgroundColor:
                          pulseSelected === value ? `${displayColor}20` : DARK_BG,
                        color: TEXT_PRIMARY,
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        opacity: isLoading ? 0.6 : 1,
                        transition: 'all 0.2s',
                      }}
                    >
                      {label}
                    </motion.button>
                  ))}
                </div>

                {/* Send Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleCheckInSubmit()}
                  disabled={isLoading || !studentMessage.trim()}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '600',
                    borderWidth: '0',
                    backgroundColor: displayColor,
                    color: '#fff',
                    cursor:
                      isLoading || !studentMessage.trim()
                        ? 'not-allowed'
                        : 'pointer',
                    opacity: isLoading || !studentMessage.trim() ? 0.5 : 1,
                  }}
                >
                  {isLoading ? 'Sending...' : 'Send'}
                </motion.button>
              </div>
            )}

            {/* Continue Working Button */}
            {currentResponse && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setIsCheckInOpen(false);
                  setCurrentResponse('');
                  onCheckInComplete?.();
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: displayColor,
                  backgroundColor: 'transparent',
                  color: displayColor,
                  cursor: 'pointer',
                }}
              >
                Continue Working
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Help Button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => {
          setIsHelpOpen(!isHelpOpen);
          if (helpCollapseTimerRef.current) {
            clearTimeout(helpCollapseTimerRef.current);
          }
        }}
        style={{
          width: '100%',
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '12px',
          fontWeight: '600',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: displayColor,
          backgroundColor: isHelpOpen ? `${displayColor}15` : 'transparent',
          color: displayColor,
          cursor: 'pointer',
          marginBottom: '12px',
          transition: 'all 0.2s',
        }}
      >
        Ask {displayName}
      </motion.button>

      {/* Help Input */}
      <AnimatePresence>
        {isHelpOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              marginBottom: '12px',
              padding: '10px',
              backgroundColor: DARK_SECONDARY,
              borderRadius: '8px',
            }}
          >
            <textarea
              value={studentMessage}
              onChange={(e) => setStudentMessage(e.target.value)}
              placeholder="What do you need help with?"
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '6px',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: DARK_BORDER,
                backgroundColor: DARK_BG,
                color: TEXT_PRIMARY,
                fontSize: '12px',
                fontFamily: 'inherit',
                resize: 'vertical',
                minHeight: '50px',
              }}
            />
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleHelpRequest}
              disabled={isLoading}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '600',
                borderWidth: '0',
                backgroundColor: displayColor,
                color: '#fff',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.6 : 1,
              }}
            >
              {isLoading ? 'Getting help...' : 'Get Help'}
            </motion.button>

            {/* Help Response */}
            {currentResponse && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{
                  padding: '10px',
                  borderRadius: '6px',
                  backgroundColor: `${displayColor}15`,
                  borderLeftWidth: '3px',
                  borderLeftStyle: 'solid',
                  borderLeftColor: displayColor,
                  fontSize: '12px',
                  color: TEXT_PRIMARY,
                  lineHeight: '1.5',
                }}
              >
                {currentResponse}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat History Toggle */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        onClick={() => setShowChatHistory(!showChatHistory)}
        style={{
          width: '100%',
          padding: '6px 10px',
          borderRadius: '6px',
          fontSize: '11px',
          fontWeight: '500',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: GRAY_SUBTLE,
          backgroundColor: 'transparent',
          color: TEXT_SECONDARY,
          cursor: 'pointer',
        }}
      >
        {showChatHistory ? 'Hide' : 'Show'} Recent Conversations ({chatMessages.length})
      </motion.button>

      {/* Chat History List */}
      <AnimatePresence>
        {showChatHistory && chatMessages.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              marginTop: '8px',
              paddingTop: '8px',
              borderTopWidth: '1px',
              borderTopStyle: 'solid',
              borderTopColor: DARK_BORDER,
            }}
          >
            {chatMessages.slice(-3).map((msg, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  padding: '8px',
                  marginBottom: '6px',
                  backgroundColor: DARK_SECONDARY,
                  borderRadius: '6px',
                  fontSize: '11px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    gap: '4px',
                    marginBottom: '3px',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 6px',
                      backgroundColor:
                        msg.interactionType === 'check_in'
                          ? `${displayColor}30`
                          : '#4b5563',
                      color: TEXT_SECONDARY,
                      borderRadius: '3px',
                      fontSize: '9px',
                      fontWeight: '600',
                    }}
                  >
                    {msg.interactionType === 'check_in' ? 'Check-in' : 'Help'}
                  </span>
                  <span
                    style={{
                      color: TEXT_SECONDARY,
                      fontSize: '9px',
                    }}
                  >
                    {msg.timestamp.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div
                  style={{
                    color: TEXT_PRIMARY,
                    marginBottom: '3px',
                    lineHeight: '1.3',
                  }}
                >
                  <strong>{msg.type === 'student' ? 'You:' : `${displayName}:`}</strong>{' '}
                  {msg.content.substring(0, 80)}
                  {msg.content.length > 80 ? '...' : ''}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default CheckInPanel;
