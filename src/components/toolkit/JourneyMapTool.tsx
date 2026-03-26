'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useToolSession } from '@/hooks/useToolSession';

type EffortLevel = 'low' | 'medium' | 'high';

const PHASES = [
  {
    name: 'Before',
    emoji: '🔍',
    color: '#818cf8',
    desc: 'What triggers the need? How do they discover or become aware?',
  },
  {
    name: 'Arrival',
    emoji: '👋',
    color: '#06b6d4',
    desc: 'First impression. How do they feel when they first encounter it?',
  },
  {
    name: 'During',
    emoji: '⚡',
    color: '#f59e0b',
    desc: 'How do they interact? What are the key moments or pain points?',
  },
  {
    name: 'After',
    emoji: '🎯',
    color: '#10b981',
    desc: 'What happens next? How do they feel after the experience?',
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
  high: { emoji: '✦', messages: ['Deep empathy!', 'Great insight!', 'Strong observation!'] },
  medium: { emoji: '→', messages: ['Good observation!', 'Keep going!', 'Getting there!'] },
  low: { emoji: '↑', messages: ['Try adding more detail', 'Can you be more specific?'] },
};

/* ─── API ─── */
async function fetchAI(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch('/api/tools/journey-map', {
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
export function JourneyMapTool(props: { mode: 'public' | 'embedded' | 'standalone'; challenge?: string; onComplete?: (data: any) => void; studentId?: string; unitId?: string; pageId?: string } = { mode: 'public' }) {
  const [stage, setStage] = useState<'intro' | 'working' | 'summary'>('intro');
  const [experience, setExperience] = useState(props.challenge || '');
  const [persona, setPersona] = useState('');
  const [currentPhase, setCurrentPhase] = useState(0);
  const [ideas, setIdeas] = useState<string[][]>([[], [], [], []]);
  const [currentIdea, setCurrentIdea] = useState('');
  const [microFeedback, setMicroFeedback] = useState<{ effort: EffortLevel; message: string } | null>(null);
  const microFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loadingNudge, setLoadingNudge] = useState(false);
  const [nudge, setNudge] = useState('');
  const [summary, setSummary] = useState('');
  const [loadingSummary, setLoadingSummary] = useState(false);

  const { session, updateState: updateToolSession } = useToolSession({
    toolId: 'journey-map',
    studentId: props.studentId,
    mode: props.mode === 'public' ? 'standalone' : (props.mode as 'embedded' | 'standalone'),
    challenge: experience,
    unitId: props.unitId,
    pageId: props.pageId,
  });

  /* ─── Sync state to session ─── */
  useEffect(() => {
    if (props.studentId && props.mode !== 'public') {
      updateToolSession({
        stage,
        challenge: experience,
        currentPhase,
        ideas,
      });
    }
  }, [stage, experience, currentPhase, ideas, props.studentId, props.mode, updateToolSession]);

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
      const phase = PHASES[currentPhase];
      const data = await fetchAI({
        action: 'nudge',
        phase: phase.name,
        experience: experience.trim(),
        persona: persona.trim(),
        currentPhaseIdeas: ideas[currentPhase],
      });
      if (data.nudge) {
        setNudge(data.nudge as string);
      }
    } catch (err) {
      console.warn('[journey] Nudge unavailable:', err);
    } finally {
      setLoadingNudge(false);
    }
  }, [experience, persona, ideas, currentPhase]);

  /* ─── Fetch summary ─── */
  const fetchSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const data = await fetchAI({
        action: 'summary',
        experience: experience.trim(),
        persona: persona.trim(),
        journey: {
          before: ideas[0],
          arrival: ideas[1],
          during: ideas[2],
          after: ideas[3],
        },
      });
      if (data.summary) {
        setSummary(data.summary as string);
      }
    } catch (err) {
      console.warn('[journey] Summary unavailable:', err);
    } finally {
      setLoadingSummary(false);
    }
  }, [experience, persona, ideas]);

  /* ─── Event Handlers ─── */
  const handleAddIdea = () => {
    if (!currentIdea.trim()) return;

    const effort = assessEffort(currentIdea);
    const feedback = MICRO_FEEDBACK[effort];
    setMicroFeedback({
      effort,
      message: feedback.messages[Math.floor(Math.random() * feedback.messages.length)],
    });

    const newIdeas = ideas.map(arr => [...arr]);
    newIdeas[currentPhase].push(currentIdea.trim());
    setIdeas(newIdeas);
    setCurrentIdea('');
    fetchNudge();
  };

  const handleMoveToSummary = () => {
    const totalIdeas = ideas.reduce((sum, arr) => sum + arr.length, 0);
    if (totalIdeas === 0) {
      alert('Please add at least one observation.');
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
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🗺️</div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: '900', margin: '0 0 0.5rem 0' }}>Journey Map</h1>
            <p style={{ color: '#d4d4d8', fontSize: '1rem', margin: 0, lineHeight: '1.6' }}>
              Map the user experience across four phases: Before, Arrival, During, and After. Include emotions and key moments.
            </p>
          </div>

          <div style={{ background: 'rgba(129, 140, 248, 0.08)', border: '1px solid rgba(129, 140, 248, 0.3)', borderRadius: '1rem', padding: '1.5rem', marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#818cf8', marginBottom: '0.5rem' }}>
              What experience are you mapping?
            </label>
            <textarea
              value={experience}
              onChange={e => setExperience(e.target.value)}
              placeholder="E.g., 'Signing up for an online course' or 'Visiting a museum for the first time'"
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(129, 140, 248, 0.4)',
                borderRadius: '0.5rem',
                color: '#fff',
                fontFamily: 'Inter, sans-serif',
                fontSize: '0.95rem',
                resize: 'vertical',
                minHeight: '70px',
                outline: 'none',
                marginBottom: '1rem',
              }}
            />

            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#818cf8', marginBottom: '0.5rem' }}>
              Who is this user? (optional persona details)
            </label>
            <textarea
              value={persona}
              onChange={e => setPersona(e.target.value)}
              placeholder="E.g., 'Busy parent, tech-savvy but time-pressed, skeptical of new tools'"
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(129, 140, 248, 0.4)',
                borderRadius: '0.5rem',
                color: '#fff',
                fontFamily: 'Inter, sans-serif',
                fontSize: '0.95rem',
                resize: 'vertical',
                minHeight: '70px',
                outline: 'none',
              }}
            />
          </div>

          <button
            onClick={() => setStage('working')}
            disabled={!experience.trim()}
            style={{
              width: '100%',
              padding: '0.875rem',
              background: experience.trim() ? 'linear-gradient(135deg, #818cf8 0%, #a5b4fc 100%)' : 'rgba(129, 140, 248, 0.4)',
              border: 'none',
              borderRadius: '0.75rem',
              color: '#fff',
              fontWeight: '600',
              fontSize: '1rem',
              cursor: experience.trim() ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
            }}
          >
            Start: Map the Journey
          </button>
        </div>
      </div>
    );
  }

  /* ─── Working Stage ─── */
  if (stage === 'working') {
    const phase = PHASES[currentPhase];
    const phaseIdeas = ideas[currentPhase];

    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0c24 0%, #1a0818 100%)', padding: '2rem', fontFamily: 'Inter, sans-serif', color: '#fff' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: '900', margin: '0 0 0.5rem 0', color: phase.color }}>
              {phase.emoji} {phase.name}
            </h1>
            <p style={{ color: '#a78bfa', margin: 0, fontSize: '0.9rem' }}>
              {phase.desc}
            </p>
          </div>

          {/* Phase Navigation Pills */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
            {PHASES.map((p, i) => (
              <button
                key={i}
                onClick={() => setCurrentPhase(i)}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: currentPhase === i ? p.color : 'rgba(129, 140, 248, 0.15)',
                  border: `1px solid ${currentPhase === i ? p.color : 'rgba(129, 140, 248, 0.3)'}`,
                  borderRadius: '0.5rem',
                  color: '#fff',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
              >
                {p.emoji} {p.name}
              </button>
            ))}
          </div>

          {/* Input Area */}
          <div style={{ background: 'rgba(129, 140, 248, 0.08)', border: '1px solid rgba(129, 140, 248, 0.3)', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '2rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#818cf8', marginBottom: '0.5rem' }}>
              What happens during this phase? (thoughts, feelings, actions, pain points)
            </label>
            <textarea
              value={currentIdea}
              onChange={e => setCurrentIdea(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && e.ctrlKey && currentIdea.trim()) {
                  handleAddIdea();
                }
              }}
              placeholder={`Describe what the user experiences, feels, or does during the ${phase.name} phase...`}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(129, 140, 248, 0.4)',
                borderRadius: '0.5rem',
                color: '#fff',
                fontFamily: 'Inter, sans-serif',
                fontSize: '0.95rem',
                resize: 'vertical',
                minHeight: '100px',
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
                  background: 'linear-gradient(135deg, #818cf8 0%, #a5b4fc 100%)',
                  border: 'none',
                  borderRadius: '0.5rem',
                  color: '#fff',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                Add Observation
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
          {phaseIdeas.length > 0 && (
            <div style={{ background: 'rgba(129, 140, 248, 0.08)', border: '1px solid rgba(129, 140, 248, 0.3)', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '2rem' }}>
              <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#818cf8', textTransform: 'uppercase', margin: '0 0 1rem 0', letterSpacing: '0.05em' }}>
                Phase Observations ({phaseIdeas.length})
              </p>
              <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
                {phaseIdeas.map((idea, i) => (
                  <li key={i} style={{ color: '#d4d4d8', marginBottom: '0.5rem', fontSize: '0.9rem', lineHeight: '1.4' }}>
                    {idea}
                  </li>
                ))}
              </ul>
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
                if (currentPhase > 0) {
                  setCurrentPhase(currentPhase - 1);
                } else {
                  setStage('intro');
                }
              }}
              style={{
                flex: 1,
                padding: '0.875rem',
                background: 'rgba(129, 140, 248, 0.3)',
                border: '1px solid rgba(129, 140, 248, 0.5)',
                borderRadius: '0.75rem',
                color: '#fff',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '0.95rem',
              }}
            >
              {currentPhase > 0 ? 'Previous Phase' : 'Back'}
            </button>
            {currentPhase < PHASES.length - 1 ? (
              <button
                onClick={() => setCurrentPhase(currentPhase + 1)}
                style={{
                  flex: 1,
                  padding: '0.875rem',
                  background: 'linear-gradient(135deg, #818cf8 0%, #a5b4fc 100%)',
                  border: 'none',
                  borderRadius: '0.75rem',
                  color: '#fff',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                }}
              >
                Next Phase
              </button>
            ) : (
              <button
                onClick={handleMoveToSummary}
                disabled={ideas.every(arr => arr.length === 0)}
                style={{
                  flex: 1,
                  padding: '0.875rem',
                  background: ideas.some(arr => arr.length > 0) ? 'linear-gradient(135deg, #818cf8 0%, #a5b4fc 100%)' : 'rgba(129, 140, 248, 0.4)',
                  border: 'none',
                  borderRadius: '0.75rem',
                  color: '#fff',
                  fontWeight: '600',
                  cursor: ideas.some(arr => arr.length > 0) ? 'pointer' : 'not-allowed',
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
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0c24 0%, #1a0818 100%)', padding: '2rem', fontFamily: 'Inter, sans-serif', color: '#fff' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ marginBottom: '3rem' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '900', margin: '0 0 0.5rem 0' }}>Journey Map Summary</h1>
          <p style={{ color: '#a78bfa', margin: 0, fontSize: '0.95rem' }}>
            Mapping "{experience}" {persona && `for: ${persona}`}
          </p>
        </div>

        {/* Journey Phases */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          {PHASES.map((phase, i) => (
            <div key={i} style={{ background: `${phase.color}14`, border: `1px solid ${phase.color}40`, borderRadius: '1rem', padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '700', color: phase.color, margin: '0 0 1rem 0' }}>
                {phase.emoji} {phase.name}
              </h3>
              <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
                {ideas[i].map((idea, j) => (
                  <li key={j} style={{ color: '#d4d4d8', marginBottom: '0.5rem', fontSize: '0.9rem', lineHeight: '1.4' }}>
                    {idea}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* AI Summary */}
        {summary && (
          <div style={{ background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.4)', borderRadius: '1rem', padding: '1.5rem', marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#a78bfa', margin: '0 0 1rem 0' }}>
              Journey Insights
            </h3>
            <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.6', color: '#e0d5ff', whiteSpace: 'pre-wrap' }}>
              {summary}
            </p>
          </div>
        )}

        {loadingSummary && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: '#a78bfa', fontSize: '0.95rem' }}>Analyzing the journey...</p>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => setStage('working')}
            style={{
              flex: 1,
              padding: '0.875rem',
              background: 'rgba(129, 140, 248, 0.3)',
              border: '1px solid rgba(129, 140, 248, 0.5)',
              borderRadius: '0.75rem',
              color: '#fff',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '0.95rem',
            }}
          >
            Edit Map
          </button>
          <button
            onClick={() => window.print()}
            style={{
              flex: 1,
              padding: '0.875rem',
              background: 'linear-gradient(135deg, #818cf8 0%, #a5b4fc 100%)',
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
