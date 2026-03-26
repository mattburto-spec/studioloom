'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useToolSession } from '@/hooks/useToolSession';

interface ToolkitToolProps {
  toolId?: string;
  mode: 'public' | 'embedded' | 'standalone';
  challenge?: string;
  sessionId?: string;
  studentId?: string;
  unitId?: string;
  pageId?: string;
  onSave?: (state: ToolState) => void;
  onComplete?: (data: ToolResponse) => void;
}

interface ToolState {
  stage: 'intro' | 'working' | 'summary';
  challenge: string;
  currentStep: number;
  ideas: string[][];
  ideaEfforts: Record<number, EffortLevel[]>;
}

interface ToolResponse {
  toolId: string;
  challenge: string;
  stage: 'intro' | 'working' | 'summary';
  ideas: string[][];
  metadata: {
    totalIdeas: number;
    timeSpentMs: number;
  };
}

type EffortLevel = 'low' | 'medium' | 'high';

const STEPS = [
  {
    name: 'Elements',
    emoji: '🔹',
    color: '#f59e0b',
    glow: 'rgba(245,158,11,0.15)',
    desc: 'List all the parts, actors, and things in this system.',
    aiRule: 'What else is part of this system? Think about hidden actors — regulations, social norms, supply chains, infrastructure.',
  },
  {
    name: 'Connections',
    emoji: '🔗',
    color: '#06b6d4',
    glow: 'rgba(6,182,212,0.15)',
    desc: 'Map relationships. Who affects whom? How do they influence each other?',
    aiRule: 'How does this element affect that one? Is the relationship positive, negative, or complex? What flows between them?',
  },
  {
    name: 'Feedback Loops',
    emoji: '🔄',
    color: '#10b981',
    glow: 'rgba(16,185,129,0.15)',
    desc: 'Find circular patterns where A leads to B leads back to A. These create systemic change.',
    aiRule: 'Where does A lead to B lead back to A? These are leverage points for systemic change. Find the reinforcing and balancing loops.',
  },
];

function assessEffort(text: string): EffortLevel {
  const words = text.trim().split(/\s+/).length;
  const hasReasoning = /\b(because|since|so that|this leads to|causes|affects|influences|impacts)\b/i.test(text);
  const hasSpecifics = /\b(for example|such as|like|including|between|from|to)\b/i.test(text);
  const hasDetail = words >= 15;

  if (words < 6) return 'low';
  if ((hasDetail && hasSpecifics) || (hasDetail && hasReasoning) || (hasSpecifics && hasReasoning)) return 'high';
  if (words >= 10 || hasSpecifics || hasReasoning) return 'medium';
  return 'low';
}

const MICRO_FEEDBACK: Record<EffortLevel, { emoji: string; messages: string[] }> = {
  high: { emoji: '✦', messages: ['Systemic thinking!', 'Great complexity!', 'Deep connection!', 'Clear relationship!'] },
  medium: { emoji: '→', messages: ['Good element!', 'Keep mapping!', 'Building system!', 'Getting there!'] },
  low: { emoji: '↑', messages: ['Add more?', 'What specifically?', 'Tell me more?', 'Be clearer?'] },
};

export function SystemsMapTool({
  mode = 'public',
  challenge: initialChallenge = '',
  sessionId: initialSessionId,
  studentId,
  unitId,
  pageId,
  onSave,
  onComplete,
}: ToolkitToolProps) {
  const [stage, setStage] = useState<'intro' | 'working' | 'summary'>(initialChallenge ? 'working' : 'intro');
  const [challenge, setChallenge] = useState(initialChallenge);
  const [currentStep, setCurrentStep] = useState(0);
  const [ideas, setIdeas] = useState<string[][]>([[], [], []]);
  const [inputValue, setInputValue] = useState('');
  const [sessionId] = useState(() => initialSessionId || Math.random().toString(36).slice(2) + Date.now().toString(36));
  const [microFeedback, setMicroFeedback] = useState<{ msg: string; level: EffortLevel } | null>(null);
  const [ideaEfforts, setIdeaEfforts] = useState<Record<number, EffortLevel[]>>({});
  const [nudge, setNudge] = useState('');
  const [nudgeLoading, setNudgeLoading] = useState(false);
  const [insights, setInsights] = useState('');
  const [loadingInsights, setLoadingInsights] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const microFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { session, updateState: updateToolSession, completeSession } = useToolSession({
    toolId: 'systems-map',
    studentId,
    mode: mode === 'public' ? 'standalone' : (mode as 'embedded' | 'standalone'),
    challenge: initialChallenge,
    unitId,
    pageId,
  });

  const step = STEPS[currentStep];
  const totalIdeas = ideas.reduce((sum, arr) => sum + arr.length, 0);

  useEffect(() => {
    if (mode !== 'public') {
      updateToolSession({
        stage,
        challenge,
        currentStep,
        ideas,
        ideaEfforts,
      });
    }
  }, [stage, challenge, currentStep, ideas, ideaEfforts, mode, updateToolSession]);

  useEffect(() => {
    if (mode !== 'public' && onSave) {
      const timer = setTimeout(() => {
        const state: ToolState = { stage, challenge, currentStep, ideas, ideaEfforts };
        onSave(state);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [stage, challenge, currentStep, ideas, ideaEfforts, mode, onSave]);

  const fetchAI = useCallback(async (body: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const res = await fetch('/api/tools/systems-map', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`AI fetch failed: ${res.status}`);
    return res.json();
  }, []);

  const handleIntroStart = async () => {
    if (!challenge.trim()) return;
    setStage('working');
    setCurrentStep(0);
    setInputValue('');
  };

  const handleAddIdea = () => {
    if (!inputValue.trim()) return;

    const effort = assessEffort(inputValue);
    const feedback = MICRO_FEEDBACK[effort];
    setMicroFeedback({ msg: feedback.messages[Math.floor(Math.random() * feedback.messages.length)], level: effort });

    const newIdeas = ideas.map(arr => [...arr]);
    newIdeas[currentStep].push(inputValue);
    setIdeas(newIdeas);

    const newEfforts = { ...ideaEfforts };
    if (!newEfforts[currentStep]) newEfforts[currentStep] = [];
    newEfforts[currentStep].push(effort);
    setIdeaEfforts(newEfforts);

    setInputValue('');

    if (microFeedbackTimerRef.current) clearTimeout(microFeedbackTimerRef.current);
    microFeedbackTimerRef.current = setTimeout(() => setMicroFeedback(null), 3000);

    if (inputRef.current) inputRef.current.focus();
  };

  const handleRequestNudge = async () => {
    if (nudgeLoading) return;
    setNudgeLoading(true);
    try {
      const res = await fetchAI({
        action: 'nudge',
        challenge,
        sessionId,
        stepIndex: currentStep,
        idea: inputValue,
        existingIdeas: ideas[currentStep],
        effortLevel: inputValue ? assessEffort(inputValue) : 'low',
        step: step.name,
      });
      setNudge(res.nudge as string);
    } catch (error) {
      console.error('Nudge error:', error);
    } finally {
      setNudgeLoading(false);
    }
  };

  const handleNextStep = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
      setInputValue('');
      setNudge('');
      if (inputRef.current) inputRef.current.focus();
    } else {
      generateInsights();
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setInputValue('');
      setNudge('');
      if (inputRef.current) inputRef.current.focus();
    }
  };

  const generateInsights = async () => {
    setLoadingInsights(true);
    try {
      const res = await fetchAI({
        action: 'insights',
        challenge,
        sessionId,
        allIdeas: ideas,
      });
      setInsights(res.insights as string);
      setStage('summary');
    } catch (error) {
      console.error('Insights error:', error);
    } finally {
      setLoadingInsights(false);
    }
  };

  const handleRemoveIdea = (stepIdx: number, ideaIdx: number) => {
    const newIdeas = ideas.map(arr => [...arr]);
    newIdeas[stepIdx].splice(ideaIdx, 1);
    setIdeas(newIdeas);

    const newEfforts = { ...ideaEfforts };
    if (newEfforts[stepIdx]) {
      newEfforts[stepIdx].splice(ideaIdx, 1);
    }
    setIdeaEfforts(newEfforts);
  };

  if (stage === 'intro') {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(to bottom right, #1f2937, #111827)', padding: '60px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, system-ui, sans-serif' }}>
        {session.saveStatus !== 'idle' && (
          <div style={{
            position: 'fixed', top: '16px', right: '16px', fontSize: '13px', fontWeight: '500',
            padding: '8px 12px', borderRadius: '6px', zIndex: 1000,
            opacity: session.saveStatus === 'saved' ? 1 : 0.8,
            background: session.saveStatus === 'error' ? '#dc26261a' : '#10b98114',
            color: session.saveStatus === 'error' ? '#ef4444' : '#10b981',
          }}>
            {session.saveStatus === 'saving' && '⟳ Saving...'}
            {session.saveStatus === 'saved' && '✓ Saved'}
            {session.saveStatus === 'error' && '✕ Save failed'}
          </div>
        )}
        <style>{`
          @keyframes toolFadeIn {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .tool-screen { animation: toolFadeIn 0.3s ease-out; }
        `}</style>
        <div style={{ maxWidth: '500px', width: '100%' }} className="tool-screen">
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h1 style={{ fontSize: '36px', fontWeight: 'bold', color: '#fff', marginBottom: '8px' }}>Systems Map</h1>
            <p style={{ fontSize: '16px', color: '#d1d5db', lineHeight: '1.6' }}>Map the ecosystem of your design. Show inputs, flows, and feedback loops.</p>
          </div>

          <div style={{ background: 'rgba(55, 65, 81, 0.6)', backdropFilter: 'blur(8px)', border: '1px solid rgba(75, 85, 99, 0.3)', borderRadius: '12px', padding: '32px', marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#e5e7eb', marginBottom: '12px' }}>What system are you analysing?</label>
            <textarea
              value={challenge}
              onChange={(e) => setChallenge(e.target.value)}
              placeholder="e.g., A school's grading system or a city's public transportation network"
              style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(75, 85, 99, 0.5)', color: '#fff', fontSize: '14px', fontFamily: 'inherit', minHeight: '100px', resize: 'none' }}
              rows={3}
            />
            <button
              onClick={handleIntroStart}
              disabled={!challenge.trim()}
              style={{ width: '100%', marginTop: '20px', padding: '12px 20px', background: challenge.trim() ? '#f59e0b' : '#6b7280', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: challenge.trim() ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}
            >
              Start Mapping
            </button>
          </div>

          <div style={{ background: 'rgba(55, 65, 81, 0.4)', border: '1px solid rgba(75, 85, 99, 0.3)', borderRadius: '8px', padding: '20px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#e5e7eb', marginBottom: '12px' }}>How it works:</h3>
            <ul style={{ margin: '0', paddingLeft: '20px', fontSize: '13px', color: '#9ca3af', lineHeight: '1.6' }}>
              <li><strong>Elements:</strong> All the parts and actors (people, tools, rules)</li>
              <li><strong>Connections:</strong> How do they influence each other?</li>
              <li><strong>Feedback Loops:</strong> Where does A→B→C→A? (Systemic leverage)</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'working') {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(to bottom right, #1f2937, #111827)', padding: '40px 24px', fontFamily: 'Inter, system-ui, sans-serif' }}>
        {session.saveStatus !== 'idle' && (
          <div style={{
            position: 'fixed', top: '16px', right: '16px', fontSize: '13px', fontWeight: '500',
            padding: '8px 12px', borderRadius: '6px', zIndex: 1000,
            opacity: session.saveStatus === 'saved' ? 1 : 0.8,
            background: session.saveStatus === 'error' ? '#dc26261a' : '#10b98114',
            color: session.saveStatus === 'error' ? '#ef4444' : '#10b981',
          }}>
            {session.saveStatus === 'saving' && '⟳ Saving...'}
            {session.saveStatus === 'saved' && '✓ Saved'}
            {session.saveStatus === 'error' && '✕ Save failed'}
          </div>
        )}
        <style>{`
          @keyframes toolFadeIn {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .tool-screen { animation: toolFadeIn 0.3s ease-out; }
        `}</style>
        <div style={{ maxWidth: '700px', margin: '0 auto' }} className="tool-screen">
          <div style={{ marginBottom: '32px' }}>
            <button
              onClick={() => setStage('intro')}
              style={{ color: '#9ca3af', fontSize: '14px', fontWeight: '600', marginBottom: '16px', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              ← Back
            </button>
            <h2 style={{ fontSize: '28px', fontWeight: 'bold', color: '#fff', marginBottom: '8px' }}>{step.emoji} {step.name}</h2>
            <p style={{ fontSize: '16px', color: '#d1d5db' }}>{step.desc}</p>
          </div>

          <div style={{ background: 'rgba(55, 65, 81, 0.6)', backdropFilter: 'blur(8px)', border: '1px solid rgba(75, 85, 99, 0.3)', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.ctrlKey) handleAddIdea();
              }}
              placeholder="Add an element, connection, or loop..."
              style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(75, 85, 99, 0.5)', color: '#fff', fontSize: '14px', fontFamily: 'inherit', minHeight: '100px', resize: 'none', marginBottom: '12px' }}
              rows={3}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleAddIdea}
                disabled={!inputValue.trim()}
                style={{ padding: '10px 20px', background: inputValue.trim() ? step.color : '#6b7280', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: inputValue.trim() ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}
              >
                Add Item
              </button>
              <button
                onClick={handleRequestNudge}
                disabled={nudgeLoading || !inputValue.trim()}
                style={{ padding: '10px 20px', background: nudgeLoading || !inputValue.trim() ? '#6b7280' : '#4b5563', color: nudgeLoading || !inputValue.trim() ? '#9ca3af' : '#e5e7eb', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: nudgeLoading || !inputValue.trim() ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}
              >
                {nudgeLoading ? '...' : 'Nudge'}
              </button>
            </div>
          </div>

          {microFeedback && (
            <div style={{ marginBottom: '20px', padding: '12px 16px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#fcd34d', fontSize: '13px', fontWeight: '600', animation: 'toolFadeIn 0.3s ease-out' }}>
              {microFeedback.msg}
            </div>
          )}

          {nudge && (
            <div style={{ marginBottom: '20px', padding: '12px 16px', borderRadius: '8px', background: 'rgba(55, 65, 81, 0.6)', border: '1px solid rgba(75, 85, 99, 0.3)', color: '#d1d5db', fontSize: '13px' }}>
              <strong style={{ color: '#e5e7eb' }}>Nudge:</strong> {nudge}
            </div>
          )}

          {ideas[currentStep].length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#e5e7eb', marginBottom: '12px' }}>Your {step.name.toLowerCase()}:</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {ideas[currentStep].map((idea, idx) => (
                  <div key={idx} style={{ padding: '12px 16px', borderRadius: '8px', background: 'rgba(55, 65, 81, 0.4)', border: '1px solid rgba(75, 85, 99, 0.3)', color: '#d1d5db', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                    <span>{idea}</span>
                    <button
                      onClick={() => handleRemoveIdea(currentStep, idx)}
                      style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
            <button
              onClick={handlePrevStep}
              disabled={currentStep === 0}
              style={{ padding: '10px 20px', background: currentStep === 0 ? '#6b7280' : '#4b5563', color: '#e5e7eb', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: currentStep === 0 ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}
            >
              ← Previous
            </button>
            {currentStep < STEPS.length - 1 ? (
              <button
                onClick={handleNextStep}
                style={{ padding: '10px 20px', background: step.color, color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                Next →
              </button>
            ) : (
              <button
                onClick={handleNextStep}
                disabled={loadingInsights}
                style={{ padding: '10px 20px', background: loadingInsights ? '#6b7280' : '#10b981', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: loadingInsights ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}
              >
                {loadingInsights ? 'Analyzing...' : 'See Summary'}
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
            {STEPS.map((s, idx) => (
              <div
                key={idx}
                style={{ height: '6px', borderRadius: '3px', transition: 'all 0.3s', background: idx === currentStep ? step.color : '#6b7280', width: idx === currentStep ? '24px' : '6px' }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(to bottom right, #1f2937, #111827)', padding: '40px 24px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {session.saveStatus !== 'idle' && (
        <div style={{
          position: 'fixed', top: '16px', right: '16px', fontSize: '13px', fontWeight: '500',
          padding: '8px 12px', borderRadius: '6px', zIndex: 1000,
          opacity: session.saveStatus === 'saved' ? 1 : 0.8,
          background: session.saveStatus === 'error' ? '#dc26261a' : '#10b98114',
          color: session.saveStatus === 'error' ? '#ef4444' : '#10b981',
        }}>
          {session.saveStatus === 'saving' && '⟳ Saving...'}
          {session.saveStatus === 'saved' && '✓ Saved'}
          {session.saveStatus === 'error' && '✕ Save failed'}
        </div>
      )}
      <style>{`
        @keyframes toolFadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .tool-screen { animation: toolFadeIn 0.3s ease-out; }
      `}</style>
      <div style={{ maxWidth: '700px', margin: '0 auto' }} className="tool-screen">
        <h2 style={{ fontSize: '28px', fontWeight: 'bold', color: '#fff', marginBottom: '8px' }}>Systems Map Complete</h2>
        <p style={{ color: '#d1d5db', marginBottom: '32px' }}>Here's your complete system analysis.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '32px' }}>
          {STEPS.map((s, stepIdx) => (
            <div key={stepIdx} style={{ background: 'rgba(55, 65, 81, 0.6)', border: '1px solid rgba(75, 85, 99, 0.3)', borderRadius: '12px', padding: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#fff', marginBottom: '12px' }}>{s.emoji} {s.name}</h3>
              {ideas[stepIdx].length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {ideas[stepIdx].map((idea, ideaIdx) => (
                    <div key={ideaIdx} style={{ color: '#d1d5db', fontSize: '13px', padding: '8px 12px', borderRadius: '6px', background: 'rgba(0, 0, 0, 0.2)', borderLeft: `3px solid ${s.color}` }}>
                      {idea}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: '#9ca3af', fontSize: '13px', fontStyle: 'italic', margin: '0' }}>No items added.</p>
              )}
            </div>
          ))}
        </div>

        {insights && (
          <div style={{ background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(55, 65, 81, 0.4))', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#d1d5db', marginBottom: '12px' }}>AI Synthesis: Key Leverage Points</h3>
            <p style={{ color: '#d1d5db', fontSize: '13px', lineHeight: '1.6', margin: '0' }}>{insights}</p>
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => {
              setStage('working');
              setCurrentStep(0);
              setInputValue('');
              setNudge('');
            }}
            style={{ padding: '10px 20px', background: '#4b5563', color: '#e5e7eb', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            ← Edit Map
          </button>
          <button
            onClick={() => {
              if (onComplete) {
                onComplete({
                  toolId: 'systems-map',
                  challenge,
                  stage: 'summary',
                  ideas,
                  metadata: { totalIdeas, timeSpentMs: 0 },
                });
              }
            }}
            style={{ padding: '10px 20px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            Save Systems Map
          </button>
        </div>
      </div>
    </div>
  );
}
