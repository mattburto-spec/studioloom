'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useToolSession } from '@/hooks/useToolSession';

type EffortLevel = 'low' | 'medium' | 'high';

/* ─── Brainstorm Web Round Data ─── */
const ROUNDS = [
  {
    round: 1,
    title: 'Initial Burst',
    color: '#ec4899',
    glow: 'rgba(236,72,153,0.15)',
    desc: 'Rapid-fire ideas with no filtering. Quantity over quality. Aim for 10+ ideas.',
    prompt: 'What are ALL the ideas that come to mind, even wild or impossible ones?',
    icon: '💥',
  },
  {
    round: 2,
    title: 'Build & Combine',
    color: '#ec4899',
    glow: 'rgba(236,72,153,0.15)',
    desc: 'Take ideas you already have and build on them, combine them, or remix them.',
    prompt: 'How can you combine, merge, or build on your existing ideas?',
    icon: '🔄',
  },
  {
    round: 3,
    title: 'Wild Ideas',
    color: '#ec4899',
    glow: 'rgba(236,72,153,0.15)',
    desc: 'Push for impossible or absurd ideas, then find the kernel of possibility.',
    prompt: 'What\'s the most outrageous idea you can imagine?',
    icon: '🚀',
  },
];

/* ─── Effort Assessment ─── */
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

const MICRO_FEEDBACK: Record<EffortLevel, { emoji: string; messages: string[] }> = {
  high: { emoji: '✦', messages: ['Deep thinking!', 'Great idea!', 'Strong concept!'] },
  medium: { emoji: '→', messages: ['Good idea!', 'Keep going!', 'Building momentum!'] },
  low: { emoji: '↑', messages: ['Try adding more detail', 'Can you be more specific?'] },
};

/* ─── API ─── */
async function fetchAI(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch('/api/tools/brainstorm-web', {
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

/* ─── Main Component ─── */
export function BrainstormWebTool(props: { mode: 'public' | 'embedded' | 'standalone'; challenge?: string; onComplete?: (data: any) => void; studentId?: string; unitId?: string; pageId?: string } = { mode: 'public' }) {
  const [stage, setStage] = useState<'intro' | 'working' | 'summary'>('intro');
  const [challenge, setChallenge] = useState(props.challenge || '');
  const [currentRound, setCurrentRound] = useState(0);
  const [ideas, setIdeas] = useState<Record<number, string[]>>({ 0: [], 1: [], 2: [] });
  const [currentIdea, setCurrentIdea] = useState('');
  const [microFeedback, setMicroFeedback] = useState<{ effort: EffortLevel; message: string } | null>(null);
  const microFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loadingNudge, setLoadingNudge] = useState(false);
  const [nudge, setNudge] = useState('');
  const [summary, setSummary] = useState('');
  const [loadingSummary, setLoadingSummary] = useState(false);

  const { session, updateState: updateToolSession } = useToolSession({
    toolId: 'brainstorm-web',
    studentId: props.studentId,
    mode: props.mode === 'public' ? 'standalone' : (props.mode as 'embedded' | 'standalone'),
    challenge: challenge,
    unitId: props.unitId,
    pageId: props.pageId,
  });

  /* ─── Sync state to session ─── */
  useEffect(() => {
    if (props.studentId && props.mode !== 'public') {
      updateToolSession({
        stage,
        challenge,
        currentRound,
        ideas,
      });
    }
  }, [stage, challenge, currentRound, ideas, props.studentId, props.mode, updateToolSession]);

  /* ─── Micro-feedback auto-dismiss ─── */
  useEffect(() => {
    if (microFeedback) {
      microFeedbackTimerRef.current = setTimeout(() => setMicroFeedback(null), 3000);
      return () => {
        if (microFeedbackTimerRef.current) clearTimeout(microFeedbackTimerRef.current);
      };
    }
  }, [microFeedback]);

  /* ─── Fetch nudge ─── */
  const fetchNudge = useCallback(async () => {
    setLoadingNudge(true);
    setNudge('');
    try {
      const roundInfo = ROUNDS[currentRound];
      const data = await fetchAI({
        action: 'nudge',
        round: currentRound + 1,
        challenge: challenge.trim(),
        currentIdeas: ideas[currentRound],
        roundPrompt: roundInfo.prompt,
      });
      if (data.nudge) {
        setNudge(data.nudge as string);
      }
    } catch (err) {
      console.warn('[brainstorm] Nudge unavailable:', err);
    } finally {
      setLoadingNudge(false);
    }
  }, [challenge, ideas, currentRound]);

  /* ─── Fetch summary ─── */
  const fetchSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const allIdeas = [...(ideas[0] || []), ...(ideas[1] || []), ...(ideas[2] || [])];
      const data = await fetchAI({
        action: 'summary',
        challenge: challenge.trim(),
        allIdeas,
        ideasByRound: ideas,
      });
      if (data.summary) {
        setSummary(data.summary as string);
      }
    } catch (err) {
      console.warn('[brainstorm] Summary unavailable:', err);
    } finally {
      setLoadingSummary(false);
    }
  }, [challenge, ideas]);

  /* ─── Event Handlers ─── */
  const handleAddIdea = () => {
    if (!currentIdea.trim()) return;

    const effort = assessEffort(currentIdea);
    const feedback = MICRO_FEEDBACK[effort];
    setMicroFeedback({
      effort,
      message: feedback.messages[Math.floor(Math.random() * feedback.messages.length)],
    });

    const newIdeas = { ...ideas };
    newIdeas[currentRound] = [...(newIdeas[currentRound] || []), currentIdea.trim()];
    setIdeas(newIdeas);
    setCurrentIdea('');
    fetchNudge();
  };

  const handleMoveToSummary = () => {
    const totalIdeas = Object.values(ideas).reduce((sum, roundIdeas) => sum + roundIdeas.length, 0);
    if (totalIdeas === 0) {
      alert('Please add at least one idea.');
      return;
    }
    fetchSummary();
    setStage('summary');
  };

  /* ─── Intro Stage ─── */
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
            <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>💡</div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: '900', margin: '0 0 0.5rem 0' }}>Brainstorm Web</h1>
            <p style={{ color: '#d4d4d8', fontSize: '1rem', margin: 0, lineHeight: '1.6' }}>
              Rapid ideation across three rounds: burst, build, and wild ideas. Generate volume, then refine.
            </p>
          </div>

          <div style={{ background: 'rgba(236, 72, 153, 0.08)', border: '1px solid rgba(236, 72, 153, 0.3)', borderRadius: '1rem', padding: '1.5rem', marginBottom: '2rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#ec4899', marginBottom: '0.5rem' }}>
              What's the design challenge?
            </label>
            <textarea
              value={challenge}
              onChange={e => setChallenge(e.target.value)}
              placeholder="E.g., 'Improve classroom engagement' or 'Design a sustainable packaging solution'"
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(236, 72, 153, 0.4)',
                borderRadius: '0.5rem',
                color: '#fff',
                fontFamily: 'Inter, sans-serif',
                fontSize: '0.95rem',
                resize: 'vertical',
                minHeight: '80px',
                outline: 'none',
              }}
            />
          </div>

          <button
            onClick={() => setStage('working')}
            disabled={!challenge.trim()}
            style={{
              width: '100%',
              padding: '0.875rem',
              background: challenge.trim() ? 'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)' : 'rgba(236, 72, 153, 0.4)',
              border: 'none',
              borderRadius: '0.75rem',
              color: '#fff',
              fontWeight: '600',
              fontSize: '1rem',
              cursor: challenge.trim() ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
            }}
          >
            Start: Begin Brainstorming
          </button>
        </div>
      </div>
    );
  }

  /* ─── Working Stage ─── */
  if (stage === 'working') {
    const roundInfo = ROUNDS[currentRound];
    const roundIdeas = ideas[currentRound] || [];
    const totalIdeas = Object.values(ideas).reduce((sum, arr) => sum + arr.length, 0);

    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0c24 0%, #1a0818 100%)', padding: '2rem', fontFamily: 'Inter, sans-serif', color: '#fff' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: '900', margin: '0 0 0.5rem 0', color: '#ec4899' }}>
              {roundInfo.icon} {roundInfo.title}
            </h1>
            <p style={{ color: '#f472b6', margin: 0, fontSize: '0.9rem' }}>
              {roundInfo.desc}
            </p>
          </div>

          {/* Round Navigation Pills */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
            {ROUNDS.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentRound(i)}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: currentRound === i ? 'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)' : 'rgba(236, 72, 153, 0.15)',
                  border: `1px solid ${currentRound === i ? 'rgba(236, 72, 153, 0.8)' : 'rgba(236, 72, 153, 0.3)'}`,
                  borderRadius: '0.5rem',
                  color: '#fff',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                {ROUNDS[i].icon} Round {i + 1}
              </button>
            ))}
          </div>

          {/* Input Area */}
          <div style={{ background: 'rgba(236, 72, 153, 0.08)', border: '1px solid rgba(236, 72, 153, 0.3)', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '2rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#ec4899', marginBottom: '0.5rem' }}>
              {roundInfo.prompt}
            </label>
            <textarea
              value={currentIdea}
              onChange={e => setCurrentIdea(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && e.ctrlKey && currentIdea.trim()) {
                  handleAddIdea();
                }
              }}
              placeholder="Type your idea here..."
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(236, 72, 153, 0.4)',
                borderRadius: '0.5rem',
                color: '#fff',
                fontFamily: 'Inter, sans-serif',
                fontSize: '0.95rem',
                resize: 'vertical',
                minHeight: '80px',
                outline: 'none',
                marginBottom: '0.75rem',
              }}
            />

            {currentIdea.trim() && (
              <button
                onClick={handleAddIdea}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: 'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)',
                  border: 'none',
                  borderRadius: '0.5rem',
                  color: '#fff',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                Add Idea
              </button>
            )}
          </div>

          {/* AI Nudge */}
          {nudge && (
            <div style={{ background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.4)', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1.5rem' }}>
              <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.5', fontStyle: 'italic', color: '#e0d5ff' }}>
                {nudge}
              </p>
            </div>
          )}

          {/* Ideas List */}
          {roundIdeas.length > 0 && (
            <div style={{ background: 'rgba(236, 72, 153, 0.08)', border: '1px solid rgba(236, 72, 153, 0.3)', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '2rem' }}>
              <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#ec4899', textTransform: 'uppercase', margin: '0 0 1rem 0', letterSpacing: '0.05em' }}>
                This Round ({roundIdeas.length})
              </p>
              <ol style={{ margin: 0, paddingLeft: '1.5rem' }}>
                {roundIdeas.map((idea, i) => (
                  <li key={i} style={{ color: '#d4d4d8', marginBottom: '0.5rem', fontSize: '0.9rem', lineHeight: '1.4' }}>
                    {idea}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Micro-feedback */}
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
              }}
            >
              {MICRO_FEEDBACK[microFeedback.effort].emoji} {microFeedback.message}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => {
                if (currentRound > 0) {
                  setCurrentRound(currentRound - 1);
                } else {
                  setStage('intro');
                }
              }}
              style={{
                flex: 1,
                padding: '0.875rem',
                background: 'rgba(236, 72, 153, 0.3)',
                border: '1px solid rgba(236, 72, 153, 0.5)',
                borderRadius: '0.75rem',
                color: '#fff',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '0.95rem',
              }}
            >
              {currentRound > 0 ? 'Previous Round' : 'Back'}
            </button>
            {currentRound < ROUNDS.length - 1 ? (
              <button
                onClick={() => setCurrentRound(currentRound + 1)}
                disabled={roundIdeas.length === 0}
                style={{
                  flex: 1,
                  padding: '0.875rem',
                  background: roundIdeas.length > 0 ? 'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)' : 'rgba(236, 72, 153, 0.4)',
                  border: 'none',
                  borderRadius: '0.75rem',
                  color: '#fff',
                  fontWeight: '600',
                  cursor: roundIdeas.length > 0 ? 'pointer' : 'not-allowed',
                  fontSize: '0.95rem',
                }}
              >
                Next Round
              </button>
            ) : (
              <button
                onClick={handleMoveToSummary}
                disabled={totalIdeas === 0}
                style={{
                  flex: 1,
                  padding: '0.875rem',
                  background: totalIdeas > 0 ? 'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)' : 'rgba(236, 72, 153, 0.4)',
                  border: 'none',
                  borderRadius: '0.75rem',
                  color: '#fff',
                  fontWeight: '600',
                  cursor: totalIdeas > 0 ? 'pointer' : 'not-allowed',
                  fontSize: '0.95rem',
                }}
              >
                View Summary
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ─── Summary Stage ─── */
  const totalIdeas = Object.values(ideas).reduce((sum, arr) => sum + arr.length, 0);
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0c24 0%, #1a0818 100%)', padding: '2rem', fontFamily: 'Inter, sans-serif', color: '#fff' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ marginBottom: '3rem' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '900', margin: '0 0 0.5rem 0' }}>Brainstorm Summary</h1>
          <p style={{ color: '#f472b6', margin: 0, fontSize: '0.95rem' }}>
            {totalIdeas} ideas generated across {ROUNDS.length} rounds
          </p>
        </div>

        {/* Ideas by Round */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          {ROUNDS.map((round, roundIdx) => (
            ideas[roundIdx] && ideas[roundIdx].length > 0 && (
              <div key={roundIdx} style={{ background: 'rgba(236, 72, 153, 0.08)', border: '1px solid rgba(236, 72, 153, 0.3)', borderRadius: '1rem', padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#ec4899', margin: '0 0 1rem 0' }}>
                  {round.icon} {round.title}
                </h3>
                <ol style={{ margin: 0, paddingLeft: '1.5rem' }}>
                  {ideas[roundIdx].map((idea, i) => (
                    <li key={i} style={{ color: '#d4d4d8', marginBottom: '0.5rem', fontSize: '0.9rem', lineHeight: '1.4' }}>
                      {idea}
                    </li>
                  ))}
                </ol>
              </div>
            )
          ))}
        </div>

        {/* AI Summary */}
        {summary && (
          <div style={{ background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.4)', borderRadius: '1rem', padding: '1.5rem', marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#a78bfa', margin: '0 0 1rem 0' }}>
              Key Patterns & Themes
            </h3>
            <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.6', color: '#e0d5ff', whiteSpace: 'pre-wrap' }}>
              {summary}
            </p>
          </div>
        )}

        {loadingSummary && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: '#f472b6', fontSize: '0.95rem' }}>Analyzing your ideas...</p>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => setStage('working')}
            style={{
              flex: 1,
              padding: '0.875rem',
              background: 'rgba(236, 72, 153, 0.3)',
              border: '1px solid rgba(236, 72, 153, 0.5)',
              borderRadius: '0.75rem',
              color: '#fff',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '0.95rem',
            }}
          >
            Add More Ideas
          </button>
          <button
            onClick={() => window.print()}
            style={{
              flex: 1,
              padding: '0.875rem',
              background: 'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)',
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
