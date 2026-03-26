'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useToolSession } from '@/hooks/useToolSession';

type EffortLevel = 'low' | 'medium' | 'high';

const STEPS = [
  {
    id: 'center',
    label: 'Central Theme',
    color: '#a855f7',
    desc: 'Define the core concept or challenge you want to expand from.',
  },
  {
    id: 'petals',
    label: '8 Petals',
    color: '#d946ef',
    desc: 'Generate 8 diverse sub-themes radiating from your central idea.',
  },
  {
    id: 'bloom',
    label: 'Bloom Each Petal',
    color: '#ec4899',
    desc: 'Develop ideas within each petal. Explore one petal at a time.',
  },
];

function assessEffort(text: string): EffortLevel {
  const words = text.trim().split(/\s+/).length;
  const hasReasoning = /\b(because|since|so that|in order to|this would|this could|which means|that way)\b/i.test(text);
  const hasSpecifics = /\b(for example|such as|like|using|made of|instead of|rather than|compared to)\b/i.test(text);
  const hasDetail = words >= 15;

  if (words < 6) return 'low';
  if ((hasDetail && hasSpecifics) || (hasDetail && hasReasoning) || (hasSpecifics && hasReasoning)) return 'high';
  if (words >= 10 || hasSpecifics || hasReasoning) return 'medium';
  return 'low';
}

function getDepthInfo(effort: EffortLevel): { dots: 1 | 2 | 3; label: string; color: string } {
  if (effort === 'high') return { dots: 3, label: 'Detailed', color: '#a78bfa' };
  if (effort === 'medium') return { dots: 2, label: 'Good start', color: '#60a5fa' };
  return { dots: 1, label: 'Go deeper', color: '#f59e0b' };
}

const MICRO_FEEDBACK: Record<EffortLevel, { emoji: string; messages: string[] }> = {
  high: {
    emoji: '✦',
    messages: ['Deep thinking!', 'Great detail!', 'Strong reasoning!', 'Specific and clear!', 'Well thought out!'],
  },
  medium: {
    emoji: '→',
    messages: ['Good — keep pushing!', 'Nice start!', 'Getting there!', 'Building momentum!'],
  },
  low: {
    emoji: '↑',
    messages: ['Try adding more detail', 'Can you be more specific?', 'What exactly would that look like?'],
  },
};

async function fetchAI(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch('/api/tools/lotus-diagram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export function LotusDiagramTool(props: { toolId?: string; mode: 'public' | 'embedded' | 'standalone'; challenge?: string; sessionId?: string; onSave?: (state: any) => void; onComplete?: (data: any) => void; studentId?: string; unitId?: string; pageId?: string } = { mode: 'public' }) {
  const [stage, setStage] = useState<'intro' | 'working' | 'summary'>('intro');
  const [theme, setTheme] = useState('');
  const [petals, setPetals] = useState<string[]>(Array(8).fill(''));
  const [selectedPetal, setSelectedPetal] = useState<number>(0);
  const [petalIdeas, setPetalIdeas] = useState<string[][]>(Array(8).fill(null).map(() => []));
  const [currentIdea, setCurrentIdea] = useState('');

  const [sessionId] = useState(() => Math.random().toString(36).slice(2) + Date.now().toString(36));
  const [aiPrompts, setAiPrompts] = useState<Record<string, string[]>>({});
  const [loadingPrompts, setLoadingPrompts] = useState(false);
  const [nudge, setNudge] = useState('');
  const [nudgeVisible, setNudgeVisible] = useState(false);
  const [loadingNudge, setLoadingNudge] = useState(false);
  const [nudgeAcknowledgment, setNudgeAcknowledgment] = useState('');
  const [insights, setInsights] = useState('');
  const [loadingInsights, setLoadingInsights] = useState(false);

  const [dealtCards, setDealtCards] = useState<Record<string, number>>({});
  const [thinkingTimeLeft, setThinkingTimeLeft] = useState(0);
  const [microFeedback, setMicroFeedback] = useState<{ effort: EffortLevel; message: string } | null>(null);
  const thinkingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const microFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const themeRef = useRef<HTMLTextAreaElement>(null);

  const { session, updateState: updateToolSession, completeSession } = useToolSession({
    toolId: 'lotus-diagram',
    studentId: props.studentId,
    mode: (props.mode || 'public') === 'public' ? 'standalone' : ((props.mode || 'public') as 'embedded' | 'standalone'),
    challenge: theme || props.challenge,
    unitId: props.unitId,
    pageId: props.pageId,
  });

  const totalIdeas = petalIdeas.reduce((sum, arr) => sum + arr.length, 0);
  const petalName = `petal-${selectedPetal}`;
  const currentPetalIdeas = petalIdeas[selectedPetal] || [];
  const currentPrompts = aiPrompts[petalName] || [];
  const cardsDealt = dealtCards[petalName] || 0;

  const fetchPrompts = useCallback(async (petalIdx: number, existingIdeas: string[] = []) => {
    if (!theme.trim() || !petals[petalIdx] || !petals[petalIdx].trim()) return;
    setLoadingPrompts(true);
    try {
      const data = await fetchAI({
        action: 'prompts',
        theme: theme.trim(),
        petalTheme: petals[petalIdx].trim(),
        petalIndex: petalIdx,
        sessionId,
        existingIdeas,
      });
      if (data.prompts && Array.isArray(data.prompts)) {
        setAiPrompts(prev => ({ ...prev, [`petal-${petalIdx}`]: data.prompts as string[] }));
      }
    } catch (err) {
      console.warn('[lotus-diagram] Prompts unavailable:', err);
    } finally {
      setLoadingPrompts(false);
    }
  }, [theme, petals, sessionId]);

  const fetchNudge = useCallback(async (idea: string, petalIdx: number, allIdeas: string[], effort: EffortLevel) => {
    setLoadingNudge(true);
    setNudgeVisible(true);
    setNudgeAcknowledgment('');
    try {
      const data = await fetchAI({
        action: 'nudge',
        theme: theme.trim(),
        petalTheme: petals[petalIdx].trim(),
        petalIndex: petalIdx,
        idea,
        sessionId,
        existingIdeas: allIdeas,
        effortLevel: effort,
      });
      if (data.nudge) {
        setNudge(data.nudge as string);
      }
      if (data.acknowledgment) {
        setNudgeAcknowledgment(data.acknowledgment as string);
      }
    } catch (err) {
      console.warn('[lotus-diagram] Nudge unavailable:', err);
      setNudgeVisible(false);
    } finally {
      setLoadingNudge(false);
    }
  }, [theme, petals, sessionId]);

  const fetchInsights = useCallback(async () => {
    if (totalIdeas === 0) return;
    setLoadingInsights(true);
    try {
      const data = await fetchAI({
        action: 'insights',
        theme: theme.trim(),
        petals,
        allIdeas: petalIdeas,
        sessionId,
      });
      if (data.insights) {
        setInsights(data.insights as string);
      }
    } catch (err) {
      console.warn('[lotus-diagram] Insights unavailable:', err);
    } finally {
      setLoadingInsights(false);
    }
  }, [theme, petals, petalIdeas, totalIdeas, sessionId]);

  useEffect(() => {
    if (stage === 'working' && textareaRef.current && petals[selectedPetal]) {
      setTimeout(() => textareaRef.current?.focus(), 350);
    }
  }, [selectedPetal, stage, petals]);

  useEffect(() => {
    if (stage === 'intro' && themeRef.current) {
      setTimeout(() => themeRef.current?.focus(), 500);
    }
  }, [stage]);

  useEffect(() => {
    const state = { stage, theme, petals, selectedPetal, petalIdeas, currentIdea };
    updateToolSession(state);
  }, [stage, theme, petals, selectedPetal, petalIdeas, currentIdea, updateToolSession]);

  useEffect(() => {
    if (stage === 'working' && !aiPrompts[petalName] && theme && petals[selectedPetal]) {
      fetchPrompts(selectedPetal, petalIdeas[selectedPetal]);
    }
  }, [stage, selectedPetal, aiPrompts, theme, petals, petalIdeas, petalName, fetchPrompts]);

  useEffect(() => {
    if (thinkingTimeLeft > 0) {
      thinkingTimerRef.current = setInterval(() => {
        setThinkingTimeLeft(t => t - 1);
      }, 1000);
      return () => {
        if (thinkingTimerRef.current) clearInterval(thinkingTimerRef.current);
      };
    }
  }, [thinkingTimeLeft]);

  useEffect(() => {
    if (microFeedback) {
      microFeedbackTimerRef.current = setTimeout(() => setMicroFeedback(null), 3000);
      return () => {
        if (microFeedbackTimerRef.current) clearTimeout(microFeedbackTimerRef.current);
      };
    }
  }, [microFeedback]);

  const handleAddIdea = () => {
    if (!currentIdea.trim()) return;

    const effort = assessEffort(currentIdea);
    const newIdeas = [...petalIdeas];
    newIdeas[selectedPetal] = [...currentPetalIdeas, currentIdea];
    setPetalIdeas(newIdeas);

    const feedback = MICRO_FEEDBACK[effort];
    setMicroFeedback({
      effort,
      message: feedback.messages[Math.floor(Math.random() * feedback.messages.length)],
    });

    fetchNudge(currentIdea, selectedPetal, newIdeas[selectedPetal], effort);
    setCurrentIdea('');
  };

  const handleDealCard = () => {
    if (currentPetalIdeas.length === 0) {
      return;
    }

    const newDealt = cardsDealt + 1;
    if (newDealt <= 4) {
      setDealtCards(prev => ({ ...prev, [petalName]: newDealt }));
      setThinkingTimeLeft(10);
    }
  };

  const handleContinuePetals = () => {
    if (petals.filter(p => p.trim()).length < 8) {
      alert('Please fill in all 8 petals before continuing.');
      return;
    }
    setStage('working');
  };

  const handleMovePetal = (idx: number) => {
    setSelectedPetal(idx);
    setCurrentIdea('');
    setNudgeVisible(false);
  };

  const handleFinish = () => {
    fetchInsights();
    setStage('summary');
  };

  if (stage === 'intro') {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0c24 0%, #1a0818 100%)', padding: '2rem', fontFamily: 'Inter, sans-serif', color: '#fff' }}>
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
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🌸</div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: '900', margin: '0 0 0.5rem 0' }}>Lotus Diagram</h1>
            <p style={{ color: '#d4d4d8', fontSize: '1rem', margin: 0, lineHeight: '1.6' }}>
              Expand one idea into 64 variations. Start with a central theme, branch into 8 sub-themes, then develop ideas within each petal.
            </p>
          </div>

          <div style={{ background: 'rgba(168, 85, 247, 0.08)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '1rem', padding: '1.5rem', marginBottom: '2rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#a78bfa', marginBottom: '0.5rem' }}>
              What's your central theme or challenge?
            </label>
            <textarea
              ref={themeRef}
              value={theme}
              onChange={e => setTheme(e.target.value)}
              placeholder="E.g., 'Design a sustainable water bottle' or 'Ways to reduce classroom noise'"
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(168, 85, 247, 0.4)',
                borderRadius: '0.5rem',
                color: '#fff',
                fontFamily: 'Inter, sans-serif',
                fontSize: '0.95rem',
                resize: 'vertical',
                minHeight: '80px',
                outline: 'none',
              }}
              onFocus={e => (e.currentTarget.style.background = 'rgba(0, 0, 0, 0.5)')}
              onBlur={e => (e.currentTarget.style.background = 'rgba(0, 0, 0, 0.3)')}
            />
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#a78bfa', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Define 8 sub-themes (diverse categories)
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
              {petals.map((petal, i) => (
                <input
                  key={i}
                  value={petal}
                  onChange={e => {
                    const newPetals = [...petals];
                    newPetals[i] = e.target.value;
                    setPetals(newPetals);
                  }}
                  placeholder={`Sub-theme ${i + 1}`}
                  style={{
                    padding: '0.75rem',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: `1px solid rgba(217, 70, 239, ${0.2 + i * 0.05})`,
                    borderRadius: '0.5rem',
                    color: '#fff',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                  onFocus={e => (e.currentTarget.style.background = 'rgba(0, 0, 0, 0.5)')}
                  onBlur={e => (e.currentTarget.style.background = 'rgba(0, 0, 0, 0.3)')}
                />
              ))}
            </div>
          </div>

          <button
            onClick={handleContinuePetals}
            disabled={!theme.trim() || petals.filter(p => p.trim()).length < 8}
            style={{
              width: '100%',
              padding: '0.875rem',
              background: theme.trim() && petals.filter(p => p.trim()).length === 8 ? 'linear-gradient(135deg, #d946ef 0%, #ec4899 100%)' : 'rgba(217, 70, 239, 0.4)',
              border: 'none',
              borderRadius: '0.75rem',
              color: '#fff',
              fontWeight: '600',
              fontSize: '1rem',
              cursor: theme.trim() && petals.filter(p => p.trim()).length === 8 ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
            }}
          >
            Continue: Develop Ideas
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'working') {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0c24 0%, #1a0818 100%)', padding: '2rem', fontFamily: 'Inter, sans-serif', color: '#fff' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: '900', margin: '0 0 0.5rem 0', color: '#d946ef' }}>
              {petals[selectedPetal] || 'Loading...'}
            </h1>
            <p style={{ color: '#a78bfa', margin: '0', fontSize: '0.9rem' }}>
              Central theme: <strong>{theme}</strong>
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '2rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
              {petals.map((petal, i) => (
                <button
                  key={i}
                  onClick={() => handleMovePetal(i)}
                  style={{
                    padding: '0.75rem',
                    background: i === selectedPetal ? '#ec4899' : 'rgba(217, 70, 239, 0.2)',
                    border: '1px solid rgba(217, 70, 239, 0.5)',
                    borderRadius: '0.5rem',
                    color: i === selectedPetal ? '#fff' : '#d4d4d8',
                    fontWeight: i === selectedPetal ? '600' : '500',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    transition: 'all 0.2s',
                    textAlign: 'left',
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    position: 'relative',
                  }}
                  title={petal}
                >
                  {petal.substring(0, 12)}...
                  {petalIdeas[i].length > 0 && (
                    <span style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.7rem', background: i === selectedPetal ? 'rgba(255, 255, 255, 0.3)' : 'rgba(217, 70, 239, 0.4)', padding: '0.1rem 0.4rem', borderRadius: '999px' }}>
                      {petalIdeas[i].length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div>
              {currentPetalIdeas.length > 0 && (
                <div style={{ marginBottom: '2rem', maxHeight: '300px', overflowY: 'auto' }}>
                  <p style={{ fontSize: '0.8rem', fontWeight: '600', color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                    Ideas ({currentPetalIdeas.length})
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {currentPetalIdeas.map((idea, i) => {
                      const effort = assessEffort(idea);
                      const depthInfo = getDepthInfo(effort);
                      return (
                        <div key={i} style={{ padding: '0.75rem', background: 'rgba(217, 70, 239, 0.1)', border: '1px solid rgba(217, 70, 239, 0.3)', borderRadius: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                          <p style={{ margin: 0, fontSize: '0.9rem', flex: 1, lineHeight: '1.4' }}>{idea}</p>
                          <div style={{ display: 'flex', gap: '0.25rem', whiteSpace: 'nowrap' }}>
                            {Array(depthInfo.dots).fill(0).map((_, j) => (
                              <div key={j} style={{ width: '4px', height: '4px', borderRadius: '50%', background: depthInfo.color }} />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ marginBottom: '1.5rem', background: 'rgba(217, 70, 239, 0.08)', border: '1px solid rgba(217, 70, 239, 0.3)', borderRadius: '0.75rem', padding: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#a78bfa', marginBottom: '0.5rem' }}>
                  Add an idea for this petal
                </label>
                <textarea
                  ref={textareaRef}
                  value={currentIdea}
                  onChange={e => setCurrentIdea(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && e.ctrlKey && currentIdea.trim()) {
                      handleAddIdea();
                    }
                  }}
                  placeholder="Type your idea... (Ctrl+Enter to submit)"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(217, 70, 239, 0.4)',
                    borderRadius: '0.5rem',
                    color: '#fff',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '0.95rem',
                    resize: 'vertical',
                    minHeight: '60px',
                    outline: 'none',
                    marginBottom: '0.75rem',
                  }}
                  onFocus={e => (e.currentTarget.style.background = 'rgba(0, 0, 0, 0.5)')}
                  onBlur={e => (e.currentTarget.style.background = 'rgba(0, 0, 0, 0.3)')}
                />

                {currentIdea.trim() && (
                  <button
                    onClick={handleAddIdea}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: 'linear-gradient(135deg, #d946ef 0%, #ec4899 100%)',
                      border: 'none',
                      borderRadius: '0.5rem',
                      color: '#fff',
                      fontWeight: '600',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      transition: 'all 0.2s',
                    }}
                  >
                    Add Idea
                  </button>
                )}
              </div>

              {currentPetalIdeas.length > 0 && currentPrompts.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <button
                    onClick={handleDealCard}
                    disabled={thinkingTimeLeft > 0}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: thinkingTimeLeft > 0 ? 'rgba(217, 70, 239, 0.3)' : 'rgba(217, 70, 239, 0.5)',
                      border: 'none',
                      borderRadius: '0.5rem',
                      color: '#fff',
                      fontWeight: '600',
                      cursor: thinkingTimeLeft > 0 ? 'not-allowed' : 'pointer',
                      fontSize: '0.9rem',
                      transition: 'all 0.2s',
                      marginBottom: '0.75rem',
                    }}
                  >
                    {thinkingTimeLeft > 0 ? `Think... ${thinkingTimeLeft}s` : 'Deal Me a Card'}
                  </button>

                  {cardsDealt > 0 && (
                    <div style={{ background: 'rgba(139, 92, 246, 0.15)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '0.5rem', padding: '1rem' }}>
                      <p style={{ fontSize: '0.8rem', color: '#a78bfa', fontWeight: '600', textTransform: 'uppercase', margin: '0 0 0.5rem 0', letterSpacing: '0.05em' }}>
                        Prompt {cardsDealt}
                      </p>
                      <p style={{ fontSize: '0.95rem', lineHeight: '1.5', margin: 0, fontStyle: 'italic', color: '#e0d5ff' }}>
                        {currentPrompts[Math.min(cardsDealt - 1, currentPrompts.length - 1)]}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {nudgeVisible && (
                <div style={{ background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.4)', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1.5rem' }}>
                  {loadingNudge ? (
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#d4d4d8' }}>Thinking...</p>
                  ) : (
                    <>
                      {nudgeAcknowledgment && (
                        <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', fontWeight: '600', color: '#d946ef' }}>
                          ✦ {nudgeAcknowledgment}
                        </p>
                      )}
                      <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.5', fontStyle: 'italic', color: '#e0d5ff' }}>
                        {nudge}
                      </p>
                    </>
                  )}
                </div>
              )}

              {microFeedback && (
                <div
                  style={{
                    position: 'fixed',
                    bottom: '2rem',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: microFeedback.effort === 'high' ? '#a78bfa' : microFeedback.effort === 'medium' ? '#60a5fa' : '#f59e0b',
                    color: '#000',
                    padding: '0.75rem 1.5rem',
                    borderRadius: '999px',
                    fontWeight: '600',
                    fontSize: '0.9rem',
                    zIndex: 50,
                    animation: 'fadeInUp 0.3s ease-out',
                  }}
                >
                  {MICRO_FEEDBACK[microFeedback.effort].emoji} {microFeedback.message}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '2rem' }}>
                {selectedPetal < 7 && (
                  <button
                    onClick={() => {
                      setSelectedPetal(selectedPetal + 1);
                      setCurrentIdea('');
                      setNudgeVisible(false);
                    }}
                    style={{
                      flex: 1,
                      padding: '0.875rem',
                      background: 'rgba(217, 70, 239, 0.3)',
                      border: '1px solid rgba(217, 70, 239, 0.5)',
                      borderRadius: '0.75rem',
                      color: '#fff',
                      fontWeight: '600',
                      cursor: 'pointer',
                      fontSize: '0.95rem',
                      transition: 'all 0.2s',
                    }}
                  >
                    Next Petal
                  </button>
                )}
                <button
                  onClick={handleFinish}
                  style={{
                    flex: 1,
                    padding: '0.875rem',
                    background: 'linear-gradient(135deg, #d946ef 0%, #ec4899 100%)',
                    border: 'none',
                    borderRadius: '0.75rem',
                    color: '#fff',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontSize: '0.95rem',
                    transition: 'all 0.2s',
                  }}
                >
                  View Summary
                </button>
              </div>
            </div>
          </div>
        </div>

        <style>{`
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateX(-50%) translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateX(-50%) translateY(0);
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0c24 0%, #1a0818 100%)', padding: '2rem', fontFamily: 'Inter, sans-serif', color: '#fff' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ marginBottom: '3rem' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '900', margin: '0 0 0.5rem 0' }}>Your Lotus Bloom</h1>
          <p style={{ color: '#a78bfa', margin: 0, fontSize: '0.95rem' }}>
            {totalIdeas} ideas across 8 petals
          </p>
        </div>

        <div style={{ background: 'rgba(217, 70, 239, 0.08)', border: '1px solid rgba(217, 70, 239, 0.3)', borderRadius: '1rem', padding: '2rem', marginBottom: '2rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
            {petals.map((petal, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '0.8rem', fontWeight: '600', color: '#a78bfa', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  {petal}
                </p>
                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ec4899' }}>
                  {petalIdeas[i].length}
                </div>
              </div>
            ))}
          </div>

          {totalIdeas > 0 && (
          <div style={{ background: 'rgba(217, 70, 239, 0.08)', border: '1px solid rgba(217, 70, 239, 0.3)', borderRadius: '1rem', padding: '2rem', marginBottom: '2rem' }}>
            <p style={{ fontSize: '0.8rem', fontWeight: '600', color: '#a78bfa', textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '0.05em' }}>
              All Ideas
            </p>
            {petals.map((petal, petalIdx) => (
              petalIdeas[petalIdx].length > 0 && (
                <div key={petalIdx} style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#ec4899', margin: '0 0 0.75rem 0' }}>
                    {petal}
                  </h3>
                  <ul style={{ margin: 0, paddingLeft: '1.5rem', listStyleType: 'disc' }}>
                    {petalIdeas[petalIdx].map((idea, i) => (
                      <li key={i} style={{ color: '#d4d4d8', marginBottom: '0.5rem', fontSize: '0.9rem', lineHeight: '1.4' }}>
                        {idea}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            ))}
          </div>
        )}
        </div>

        {insights && (
          <div style={{ background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.4)', borderRadius: '1rem', padding: '1.5rem', marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#a78bfa', margin: '0 0 1rem 0' }}>
              AI Insights
            </h3>
            <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.6', color: '#e0d5ff', whiteSpace: 'pre-wrap' }}>
              {insights}
            </p>
          </div>
        )}

        {loadingInsights && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: '#a78bfa', fontSize: '0.95rem' }}>Synthesizing patterns...</p>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => {
              setStage('working');
              setSelectedPetal(0);
              setCurrentIdea('');
              setNudgeVisible(false);
            }}
            style={{
              flex: 1,
              padding: '0.875rem',
              background: 'rgba(217, 70, 239, 0.3)',
              border: '1px solid rgba(217, 70, 239, 0.5)',
              borderRadius: '0.75rem',
              color: '#fff',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '0.95rem',
            }}
          >
            Back to Working
          </button>
          <button
            onClick={() => window.print()}
            style={{
              flex: 1,
              padding: '0.875rem',
              background: 'linear-gradient(135deg, #d946ef 0%, #ec4899 100%)',
              border: 'none',
              borderRadius: '0.75rem',
              color: '#fff',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '0.95rem',
            }}
          >
            Print
          </button>
        </div>
      </div>
    </div>
  );
}
