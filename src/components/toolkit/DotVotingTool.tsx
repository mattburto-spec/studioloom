'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToolSession } from '@/hooks/useToolSession';

interface Option {
  id: string;
  label: string;
  votes: number;
}

interface DotVotingState {
  stage: 'intro' | 'voting' | 'results';
  challenge: string;
  options: Option[];
  dotsPerVoter: number;
  dotsRemaining: number;
  dotsAllocated: Record<string, number>;
  totalVoters: number;
}

interface ToolkitToolProps {
  toolId?: string;
  mode: 'public' | 'embedded' | 'standalone';
  challenge?: string;
  sessionId?: string;
  studentId?: string;
  unitId?: string;
  pageId?: string;
  onSave?: (state: any) => void;
  onComplete?: (data: any) => void;
}

const defaultState: DotVotingState = {
  stage: 'intro',
  challenge: '',
  options: [],
  dotsPerVoter: 3,
  dotsRemaining: 3,
  dotsAllocated: {},
  totalVoters: 1,
};

// SVG Icons
const PlusIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const TrashIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const DotIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const CheckIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export function DotVotingTool({
  toolId = 'dot-voting',
  mode,
  challenge: initialChallenge = '',
  studentId,
  unitId,
  pageId,
  onComplete,
}: ToolkitToolProps) {
  const [state, setState] = useState<DotVotingState>({
    ...defaultState,
    challenge: initialChallenge,
  });
  const [newOptionInput, setNewOptionInput] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const saveTimeoutRef = useRef<NodeJS.Timeout>(undefined);

  const { session: toolSession, updateState: updateToolSession } = useToolSession({
    toolId,
    studentId,
    mode: mode === 'public' ? 'standalone' : mode,
    challenge: state.challenge,
    unitId,
    pageId,
  });

  // Load persisted state
  useEffect(() => {
    if (toolSession?.state && typeof toolSession.state === 'object') {
      setState(toolSession.state as DotVotingState);
    }
  }, [toolSession?.id]);

  // Save state
  const saveState = (newState: DotVotingState) => {
    setSaveStatus('saving');
    clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        if (mode !== 'public' && updateToolSession) {
          await updateToolSession(newState);
        }
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (error) {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 2000);
      }
    }, 500);

    setState(newState);
  };

  const addOption = () => {
    if (newOptionInput.trim()) {
      const newOption: Option = {
        id: `opt-${Date.now()}`,
        label: newOptionInput.trim(),
        votes: 0,
      };
      const newState = {
        ...state,
        options: [...state.options, newOption],
      };
      saveState(newState);
      setNewOptionInput('');
    }
  };

  const removeOption = (id: string) => {
    const newState = {
      ...state,
      options: state.options.filter((opt) => opt.id !== id),
    };
    saveState(newState);
  };

  const startVoting = () => {
    if (state.options.length < 2) return;

    const newState = {
      ...state,
      stage: 'voting' as const,
      dotsRemaining: state.dotsPerVoter,
      dotsAllocated: {},
    };
    saveState(newState);
  };

  const addDot = (optionId: string) => {
    if (state.dotsRemaining <= 0) return;

    const currentVotes = state.dotsAllocated[optionId] || 0;
    const maxPerOption = Math.ceil(state.dotsPerVoter / 2); // Can place max half of total dots on one option

    if (currentVotes >= maxPerOption) return;

    const newAllocated = {
      ...state.dotsAllocated,
      [optionId]: currentVotes + 1,
    };

    const newState = {
      ...state,
      dotsRemaining: state.dotsRemaining - 1,
      dotsAllocated: newAllocated,
      options: state.options.map((opt) =>
        opt.id === optionId ? { ...opt, votes: opt.votes + 1 } : opt
      ),
    };
    saveState(newState);
  };

  const removeDot = (optionId: string) => {
    const currentVotes = state.dotsAllocated[optionId] || 0;
    if (currentVotes <= 0) return;

    const newAllocated = {
      ...state.dotsAllocated,
      [optionId]: currentVotes - 1,
    };

    const newState = {
      ...state,
      dotsRemaining: state.dotsRemaining + 1,
      dotsAllocated: newAllocated,
      options: state.options.map((opt) =>
        opt.id === optionId ? { ...opt, votes: opt.votes - 1 } : opt
      ),
    };
    saveState(newState);
  };

  const finishVoting = () => {
    const totalVotes = Object.values(state.dotsAllocated).reduce((a, b) => a + b, 0);
    const newState = {
      ...state,
      stage: 'results' as const,
      totalVoters: totalVotes > 0 ? 1 : 0,
    };
    saveState(newState);

    if (onComplete) {
      onComplete({
        challenge: state.challenge,
        options: state.options,
        dotsPerVoter: state.dotsPerVoter,
        totalVotes,
      });
    }
  };

  const resetVoting = () => {
    const newState = {
      ...state,
      stage: 'voting' as const,
      dotsRemaining: state.dotsPerVoter,
      dotsAllocated: {},
      options: state.options.map((opt) => ({ ...opt, votes: 0 })),
    };
    saveState(newState);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addOption();
    }
  };

  // Render Intro Screen
  if (state.stage === 'intro') {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #0c0c1a 0%, #12122a 100%)',
          padding: '2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: '"Inter", sans-serif',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            width: '100%',
            maxWidth: '600px',
            background: '#12122a',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px',
            padding: '2.5rem',
          }}
        >
          {/* Header */}
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{ color: '#e8eaf0', fontSize: '28px', fontWeight: 700, margin: '0 0 0.5rem' }}>
              Dot Voting
            </h1>
            <p style={{ color: '#6b7394', fontSize: '14px', margin: 0 }}>
              A collaborative evaluation tool for prioritizing ideas
            </p>
          </div>

          {/* Save Status */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: saveStatus !== 'idle' ? 1 : 0 }}
            style={{
              position: 'fixed',
              top: '1.5rem',
              right: '1.5rem',
              fontSize: '13px',
              color: saveStatus === 'saved' ? '#22c55e' : saveStatus === 'error' ? '#ef4444' : '#7b2ff2',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            {saveStatus === 'saving' && <span>⟳ Saving...</span>}
            {saveStatus === 'saved' && (
              <>
                <CheckIcon size={16} />
                <span>Saved</span>
              </>
            )}
            {saveStatus === 'error' && <span>✕ Save failed</span>}
          </motion.div>

          {/* Challenge Input */}
          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', color: '#e8eaf0', fontSize: '14px', fontWeight: 600, marginBottom: '0.75rem' }}>
              What are you voting on?
            </label>
            <input
              type="text"
              placeholder="E.g., Which design should we prototype?"
              value={state.challenge}
              onChange={(e) => saveState({ ...state, challenge: e.target.value })}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px',
                color: '#e8eaf0',
                fontSize: '14px',
                boxSizing: 'border-box',
                transition: 'all 200ms ease',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'rgba(123,47,242,0.4)')}
              onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
            />
          </div>

          {/* Options Input */}
          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', color: '#e8eaf0', fontSize: '14px', fontWeight: 600, marginBottom: '0.75rem' }}>
              Add voting options
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <input
                type="text"
                placeholder="Option name"
                value={newOptionInput}
                onChange={(e) => setNewOptionInput(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '8px',
                  color: '#e8eaf0',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
              <button
                onClick={addOption}
                style={{
                  padding: '0.75rem 1rem',
                  background: '#7b2ff2',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '14px',
                  fontWeight: 600,
                  transition: 'all 200ms ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#6a24d9')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#7b2ff2')}
              >
                <PlusIcon size={18} />
              </button>
            </div>

            {/* Options List */}
            <AnimatePresence>
              {state.options.map((option, idx) => (
                <motion.div
                  key={option.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: idx * 0.05 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px',
                    marginBottom: '0.5rem',
                  }}
                >
                  <span style={{ color: '#e8eaf0', fontSize: '14px' }}>{option.label}</span>
                  <button
                    onClick={() => removeOption(option.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#6b7394',
                      cursor: 'pointer',
                      padding: '0.25rem',
                      transition: 'color 200ms ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#6b7394')}
                  >
                    <TrashIcon size={18} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Effort Gate */}
          <AnimatePresence>
            {state.options.length < 2 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                style={{
                  padding: '0.75rem',
                  background: 'rgba(249,115,22,0.1)',
                  border: '1px solid rgba(249,115,22,0.3)',
                  borderRadius: '8px',
                  marginBottom: '1.5rem',
                  fontSize: '13px',
                  color: '#fb923c',
                }}
              >
                Add at least 2 options to begin voting
              </motion.div>
            )}
          </AnimatePresence>

          {/* CTA Button */}
          <button
            onClick={startVoting}
            disabled={state.options.length < 2}
            style={{
              width: '100%',
              padding: '0.875rem',
              background: state.options.length < 2 ? '#3f3f52' : '#7b2ff2',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '15px',
              fontWeight: 600,
              cursor: state.options.length < 2 ? 'not-allowed' : 'pointer',
              opacity: state.options.length < 2 ? 0.5 : 1,
              transition: 'all 200ms ease',
            }}
            onMouseEnter={(e) => {
              if (state.options.length >= 2) {
                e.currentTarget.style.background = '#6a24d9';
              }
            }}
            onMouseLeave={(e) => {
              if (state.options.length >= 2) {
                e.currentTarget.style.background = '#7b2ff2';
              }
            }}
          >
            Start Voting →
          </button>
        </motion.div>
      </div>
    );
  }

  // Render Voting Screen
  if (state.stage === 'voting') {
    const sortedOptions = [...state.options].sort((a, b) => b.votes - a.votes);
    const maxVotes = Math.max(...state.options.map((o) => o.votes), 1);

    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #0c0c1a 0%, #12122a 100%)',
          padding: '2rem',
          fontFamily: '"Inter", sans-serif',
        }}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            maxWidth: '700px',
            margin: '0 auto',
          }}
        >
          {/* Header */}
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{ color: '#e8eaf0', fontSize: '28px', fontWeight: 700, margin: '0 0 0.5rem' }}>
              {state.challenge}
            </h1>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div
                style={{
                  padding: '0.5rem 1rem',
                  background: 'rgba(123,47,242,0.1)',
                  border: '1px solid rgba(123,47,242,0.3)',
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: '#b4a5f2',
                  fontWeight: 600,
                }}
              >
                {state.dotsRemaining} dots left
              </div>
            </div>
          </div>

          {/* Save Status */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: saveStatus !== 'idle' ? 1 : 0 }}
            style={{
              position: 'fixed',
              top: '1.5rem',
              right: '1.5rem',
              fontSize: '13px',
              color: saveStatus === 'saved' ? '#22c55e' : saveStatus === 'error' ? '#ef4444' : '#7b2ff2',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            {saveStatus === 'saving' && <span>⟳ Saving...</span>}
            {saveStatus === 'saved' && (
              <>
                <CheckIcon size={16} />
                <span>Saved</span>
              </>
            )}
            {saveStatus === 'error' && <span>✕ Save failed</span>}
          </motion.div>

          {/* Options Cards */}
          <AnimatePresence>
            {sortedOptions.map((option, idx) => {
              const percentage = (option.votes / maxVotes) * 100;
              const allocated = state.dotsAllocated[option.id] || 0;
              const maxPerOption = Math.ceil(state.dotsPerVoter / 2);

              return (
                <motion.div
                  key={option.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ delay: idx * 0.08 }}
                  style={{
                    marginBottom: '1.5rem',
                    background: '#12122a',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '12px',
                    padding: '1.5rem',
                  }}
                >
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                      <span style={{ color: '#e8eaf0', fontSize: '15px', fontWeight: 600 }}>{option.label}</span>
                      <span style={{ color: '#6b7394', fontSize: '13px' }}>{option.votes} votes</span>
                    </div>

                    {/* Bar Chart */}
                    <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                        style={{
                          height: '100%',
                          background: `linear-gradient(90deg, #7b2ff2, #a78bfa)`,
                          borderRadius: '4px',
                        }}
                      />
                    </div>
                  </div>

                  {/* Dot Controls */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button
                      onClick={() => removeDot(option.id)}
                      disabled={allocated <= 0}
                      style={{
                        padding: '0.5rem',
                        background: allocated > 0 ? 'rgba(123,47,242,0.2)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${allocated > 0 ? 'rgba(123,47,242,0.3)' : 'rgba(255,255,255,0.08)'}`,
                        borderRadius: '6px',
                        color: '#7b2ff2',
                        cursor: allocated > 0 ? 'pointer' : 'not-allowed',
                        fontSize: '12px',
                        opacity: allocated > 0 ? 1 : 0.5,
                        transition: 'all 200ms ease',
                      }}
                    >
                      −
                    </button>

                    {/* Dot Display */}
                    <div style={{ display: 'flex', gap: '0.5rem', flex: 1, minHeight: '32px', alignItems: 'center' }}>
                      <AnimatePresence>
                        {Array.from({ length: allocated }).map((_, i) => (
                          <motion.div
                            key={i}
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            exit={{ scale: 0, rotate: 180 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                            style={{
                              width: '24px',
                              height: '24px',
                              background: '#7b2ff2',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '12px',
                              color: '#fff',
                              fontWeight: 700,
                            }}
                          >
                            {i + 1}
                          </motion.div>
                        ))}
                      </AnimatePresence>
                      {allocated === 0 && <span style={{ color: '#6b7394', fontSize: '13px' }}>No votes</span>}
                    </div>

                    <button
                      onClick={() => addDot(option.id)}
                      disabled={state.dotsRemaining <= 0 || allocated >= maxPerOption}
                      style={{
                        padding: '0.5rem',
                        background:
                          state.dotsRemaining > 0 && allocated < maxPerOption ? 'rgba(123,47,242,0.2)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${
                          state.dotsRemaining > 0 && allocated < maxPerOption ? 'rgba(123,47,242,0.3)' : 'rgba(255,255,255,0.08)'
                        }`,
                        borderRadius: '6px',
                        color: '#7b2ff2',
                        cursor: state.dotsRemaining > 0 && allocated < maxPerOption ? 'pointer' : 'not-allowed',
                        fontSize: '12px',
                        opacity: state.dotsRemaining > 0 && allocated < maxPerOption ? 1 : 0.5,
                        transition: 'all 200ms ease',
                      }}
                    >
                      +
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
            <button
              onClick={resetVoting}
              style={{
                flex: 1,
                padding: '0.875rem',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px',
                color: '#e8eaf0',
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 200ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
              }}
            >
              Reset
            </button>
            <button
              onClick={finishVoting}
              disabled={state.dotsRemaining === state.dotsPerVoter}
              style={{
                flex: 1,
                padding: '0.875rem',
                background: state.dotsRemaining === state.dotsPerVoter ? '#3f3f52' : '#7b2ff2',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '15px',
                fontWeight: 600,
                cursor: state.dotsRemaining === state.dotsPerVoter ? 'not-allowed' : 'pointer',
                opacity: state.dotsRemaining === state.dotsPerVoter ? 0.5 : 1,
                transition: 'all 200ms ease',
              }}
              onMouseEnter={(e) => {
                if (state.dotsRemaining < state.dotsPerVoter) {
                  e.currentTarget.style.background = '#6a24d9';
                }
              }}
              onMouseLeave={(e) => {
                if (state.dotsRemaining < state.dotsPerVoter) {
                  e.currentTarget.style.background = '#7b2ff2';
                }
              }}
            >
              See Results →
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Render Results Screen
  if (state.stage === 'results') {
    const sortedOptions = [...state.options].sort((a, b) => b.votes - a.votes);
    const totalVotes = state.options.reduce((sum, opt) => sum + opt.votes, 0);
    const winner = sortedOptions[0];

    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #0c0c1a 0%, #12122a 100%)',
          padding: '2rem',
          fontFamily: '"Inter", sans-serif',
        }}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            maxWidth: '700px',
            margin: '0 auto',
          }}
        >
          {/* Header */}
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{ color: '#e8eaf0', fontSize: '28px', fontWeight: 700, margin: '0 0 0.5rem' }}>Results</h1>
            <p style={{ color: '#6b7394', fontSize: '14px', margin: 0 }}>{state.challenge}</p>
          </div>

          {/* Save Status */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: saveStatus !== 'idle' ? 1 : 0 }}
            style={{
              position: 'fixed',
              top: '1.5rem',
              right: '1.5rem',
              fontSize: '13px',
              color: saveStatus === 'saved' ? '#22c55e' : saveStatus === 'error' ? '#ef4444' : '#7b2ff2',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            {saveStatus === 'saving' && <span>⟳ Saving...</span>}
            {saveStatus === 'saved' && (
              <>
                <CheckIcon size={16} />
                <span>Saved</span>
              </>
            )}
            {saveStatus === 'error' && <span>✕ Save failed</span>}
          </motion.div>

          {/* Winner Card */}
          {winner && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5 }}
              style={{
                background: 'linear-gradient(135deg, rgba(251,191,36,0.1) 0%, rgba(123,47,242,0.1) 100%)',
                border: '2px solid rgba(251,191,36,0.3)',
                borderRadius: '12px',
                padding: '1.5rem',
                marginBottom: '2rem',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '13px', color: '#fbbf24', fontWeight: 600, marginBottom: '0.5rem' }}>🏆 WINNER</div>
              <h2 style={{ color: '#fbbf24', fontSize: '24px', fontWeight: 700, margin: '0 0 0.5rem' }}>{winner.label}</h2>
              <p style={{ color: '#b4a5f2', fontSize: '15px', margin: 0 }}>
                {winner.votes} {winner.votes === 1 ? 'vote' : 'votes'} ({((winner.votes / totalVotes) * 100).toFixed(0)}%)
              </p>
            </motion.div>
          )}

          {/* Results List */}
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ color: '#e8eaf0', fontSize: '14px', fontWeight: 600, marginBottom: '1rem', textTransform: 'uppercase' }}>
              All Results
            </h3>
            <AnimatePresence>
              {sortedOptions.map((option, idx) => {
                const percentage = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0;

                return (
                  <motion.div
                    key={option.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: idx * 0.1 }}
                    style={{
                      padding: '1rem',
                      background: idx === 0 ? 'rgba(251,191,36,0.05)' : '#12122a',
                      border: `1px solid ${idx === 0 ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: '8px',
                      marginBottom: '0.75rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '13px', color: '#6b7394', fontWeight: 600, minWidth: '20px' }}>#{idx + 1}</span>
                      <span style={{ flex: 1, color: '#e8eaf0', fontSize: '14px', fontWeight: 600 }}>{option.label}</span>
                      <span style={{ color: '#b4a5f2', fontSize: '13px', fontWeight: 700 }}>
                        {option.votes} {option.votes === 1 ? 'vote' : 'votes'}
                      </span>
                    </div>

                    {/* Bar Chart */}
                    <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut', delay: idx * 0.1 + 0.2 }}
                        style={{
                          height: '100%',
                          background:
                            idx === 0 ? 'linear-gradient(90deg, #fbbf24, #f59e0b)' : 'linear-gradient(90deg, #7b2ff2, #a78bfa)',
                          borderRadius: '3px',
                        }}
                      />
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Summary Stats */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1rem',
              marginBottom: '2rem',
            }}
          >
            <div
              style={{
                background: '#12122a',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px',
                padding: '1rem',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '13px', color: '#6b7394', marginBottom: '0.5rem' }}>Total Votes</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#7b2ff2' }}>{totalVotes}</div>
            </div>
            <div
              style={{
                background: '#12122a',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px',
                padding: '1rem',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '13px', color: '#6b7394', marginBottom: '0.5rem' }}>Options</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#7b2ff2' }}>{state.options.length}</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={() => saveState({ ...state, stage: 'voting', dotsRemaining: state.dotsPerVoter, dotsAllocated: {} })}
              style={{
                flex: 1,
                padding: '0.875rem',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px',
                color: '#e8eaf0',
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 200ms ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
            >
              Vote Again
            </button>
            <button
              onClick={() => saveState({ ...state, stage: 'intro', challenge: '', options: [], dotsRemaining: state.dotsPerVoter })}
              style={{
                flex: 1,
                padding: '0.875rem',
                background: '#7b2ff2',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 200ms ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#6a24d9')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#7b2ff2')}
            >
              New Vote
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return null;
}
