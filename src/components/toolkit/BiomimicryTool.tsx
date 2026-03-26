'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useToolSession } from '@/hooks/useToolSession';

type EffortLevel = 'low' | 'medium' | 'high';

interface StepIdea {
  text: string;
  effort: EffortLevel;
}

const STEPS = [
  {
    label: 'Observe Nature',
    emoji: '🔍',
    color: '#10b981',
    instruction: 'What natural systems or organisms solve a similar problem?',
    hint: 'Think across all scales — bacteria, insects, plants, animals, ecosystems. What solves this in nature?',
    placeholder: 'E.g., "How do spider webs distribute stress while staying flexible?"',
  },
  {
    label: 'Extract Principle',
    emoji: '💡',
    color: '#f59e0b',
    instruction: 'What\'s the underlying principle or strategy you observed?',
    hint: 'Abstract the core mechanism. What general rule or pattern did you discover?',
    placeholder: 'E.g., "Distributed tension creates flexibility and strength without rigid structure"',
  },
  {
    label: 'Apply to Design',
    emoji: '🎨',
    color: '#8b5cf6',
    instruction: 'How could you apply this principle to your design challenge?',
    hint: 'How could your design copy or adapt this strategy?',
    placeholder: 'E.g., "Create a fabric with distributed fiber orientation instead of woven grid"',
  },
  {
    label: 'Evaluate Fit',
    emoji: '✅',
    color: '#ec4899',
    instruction: 'Does this solution actually work? What are the constraints or limitations?',
    hint: 'Be honest about what works and what doesn\'t. Where would this approach fail?',
    placeholder: 'E.g., "Pros: lighter, stronger. Cons: harder to manufacture at scale, cost?"',
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
  high: { emoji: '✦', messages: ['Deep observation!', 'Strong principle!', 'Creative adaptation!'] },
  medium: { emoji: '→', messages: ['Good idea!', 'Keep going!', 'Building on it!'] },
  low: { emoji: '↑', messages: ['Try adding more detail', 'Can you dig deeper?'] },
};

/* ─── API ─── */
async function fetchAI(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch('/api/tools/biomimicry', {
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
export function BiomimicryTool(props: { mode: 'public' | 'embedded' | 'standalone'; challenge?: string; studentId?: string; unitId?: string; pageId?: string; onComplete?: (data: any) => void } = { mode: 'public' }) {
  const [stage, setStage] = useState<'intro' | 'working' | 'summary'>('intro');
  const [challenge, setChallenge] = useState(props.challenge || '');
  const [currentStep, setCurrentStep] = useState(0);
  const [ideas, setIdeas] = useState<StepIdea[][]>([[], [], [], []]);
  const [currentIdea, setCurrentIdea] = useState('');
  const [microFeedback, setMicroFeedback] = useState<{ effort: EffortLevel; message: string } | null>(null);
  const microFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loadingNudge, setLoadingNudge] = useState(false);
  const [nudge, setNudge] = useState('');
  const [summary, setSummary] = useState('');
  const [loadingSummary, setLoadingSummary] = useState(false);

  const { session, updateState: updateToolSession, completeSession } = useToolSession({
    toolId: 'biomimicry',
    studentId: props.studentId,
    mode: props.mode === 'public' ? 'standalone' : (props.mode as 'embedded' | 'standalone'),
    challenge: props.challenge,
    unitId: props.unitId,
    pageId: props.pageId,
  });

  useEffect(() => {
    if (props.mode !== 'public') {
      updateToolSession({
        stage,
        challenge,
        currentStep,
        ideas,
      });
    }
  }, [stage, challenge, currentStep, ideas, props.mode, updateToolSession]);

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
      const step = STEPS[currentStep];
      const data = await fetchAI({
        action: 'nudge',
        step: currentStep,
        challenge: challenge.trim(),
        previousIdeas: ideas.slice(0, currentStep),
        stepInstruction: step.instruction,
      });
      if (data.nudge) {
        setNudge(data.nudge as string);
      }
    } catch (err) {
      console.warn('[biomimicry] Nudge unavailable:', err);
    } finally {
      setLoadingNudge(false);
    }
  }, [challenge, ideas, currentStep]);

  /* ─── Fetch summary ─── */
  const fetchSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const data = await fetchAI({
        action: 'summary',
        challenge: challenge.trim(),
        observations: ideas[0].map(i => i.text),
        principles: ideas[1].map(i => i.text),
        applications: ideas[2].map(i => i.text),
        evaluations: ideas[3].map(i => i.text),
      });
      if (data.summary) {
        setSummary(data.summary as string);
      }
    } catch (err) {
      console.warn('[biomimicry] Summary unavailable:', err);
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

    const newIdeas = ideas.map(arr => [...arr]);
    newIdeas[currentStep].push({ text: currentIdea.trim(), effort });
    setIdeas(newIdeas);
    setCurrentIdea('');
    fetchNudge();
  };

  const handleNext = () => {
    if (ideas[currentStep].length === 0) {
      alert(`Please answer step ${currentStep + 1} before moving forward.`);
      return;
    }
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleFinish = () => {
    if (ideas[currentStep].length === 0) {
      alert(`Please answer the final step.`);
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
            <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🌿</div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: '900', margin: '0 0 0.5rem 0' }}>Biomimicry</h1>
            <p style={{ color: '#d4d4d8', fontSize: '1rem', margin: 0, lineHeight: '1.6' }}>
              Learn from nature. Observe, extract principles, apply them to your design challenge, and evaluate the fit.
            </p>
          </div>

          <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '1rem', padding: '1.5rem', marginBottom: '2rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#10b981', marginBottom: '0.5rem' }}>
              What's your design challenge?
            </label>
            <textarea
              value={challenge}
              onChange={e => setChallenge(e.target.value)}
              placeholder="E.g., 'Create a stronger, lighter material for footwear' or 'Design a structure that survives extreme weather'"
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
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
              background: challenge.trim() ? 'linear-gradient(135deg, #10b981 0%, #34d399 100%)' : 'rgba(16, 185, 129, 0.4)',
              border: 'none',
              borderRadius: '0.75rem',
              color: '#fff',
              fontWeight: '600',
              fontSize: '1rem',
              cursor: challenge.trim() ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
            }}
          >
            Start: Observe Nature
          </button>
        </div>
      </div>
    );
  }

  /* ─── Working Stage ─── */
  if (stage === 'working') {
    const step = STEPS[currentStep];
    const stepIdeas = ideas[currentStep];

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
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: '900', margin: '0 0 0.5rem 0', color: step.color }}>
              {step.emoji} Step {currentStep + 1}: {step.label}
            </h1>
            <p style={{ color: '#a78bfa', margin: 0, fontSize: '0.9rem' }}>
              {step.instruction}
            </p>
          </div>

          {/* Step Progress Indicator */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
            {STEPS.map((_, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: '6px',
                  background: i < currentStep ? step.color : i === currentStep ? step.color : 'rgba(99,102,241,0.2)',
                  borderRadius: '3px',
                  transition: 'all 0.2s',
                }}
              />
            ))}
          </div>

          {/* Input Area */}
          <div style={{ background: `${step.color}14`, border: `1px solid ${step.color}40`, borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '2rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: step.color, marginBottom: '0.5rem' }}>
              {step.hint}
            </label>
            <textarea
              value={currentIdea}
              onChange={e => setCurrentIdea(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && e.ctrlKey && currentIdea.trim()) {
                  handleAddIdea();
                }
              }}
              placeholder={step.placeholder}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'rgba(0, 0, 0, 0.3)',
                border: `1px solid ${step.color}60`,
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
                  background: `linear-gradient(135deg, ${step.color} 0%, ${step.color}dd 100%)`,
                  border: 'none',
                  borderRadius: '0.5rem',
                  color: '#fff',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                Add Response
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
          {stepIdeas.length > 0 && (
            <div style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '2rem' }}>
              <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#6366f1', textTransform: 'uppercase', margin: '0 0 1rem 0', letterSpacing: '0.05em' }}>
                Your Response ({stepIdeas.length})
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {stepIdeas.map((idea, i) => (
                  <div key={i} style={{ background: 'rgba(99, 102, 241, 0.15)', borderRadius: '0.5rem', padding: '0.75rem', borderLeft: `3px solid ${step.color}` }}>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#d4d4d8', lineHeight: '1.4' }}>
                      {idea.text}
                    </p>
                  </div>
                ))}
              </div>
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
                if (currentStep > 0) {
                  setCurrentStep(currentStep - 1);
                } else {
                  setStage('intro');
                }
              }}
              style={{
                flex: 1,
                padding: '0.875rem',
                background: 'rgba(99, 102, 241, 0.3)',
                border: '1px solid rgba(99, 102, 241, 0.5)',
                borderRadius: '0.75rem',
                color: '#fff',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '0.95rem',
              }}
            >
              {currentStep > 0 ? 'Previous Step' : 'Back'}
            </button>
            {currentStep < STEPS.length - 1 ? (
              <button
                onClick={handleNext}
                disabled={stepIdeas.length === 0}
                style={{
                  flex: 1,
                  padding: '0.875rem',
                  background: stepIdeas.length > 0 ? `linear-gradient(135deg, ${step.color} 0%, ${step.color}dd 100%)` : 'rgba(99, 102, 241, 0.4)',
                  border: 'none',
                  borderRadius: '0.75rem',
                  color: '#fff',
                  fontWeight: '600',
                  cursor: stepIdeas.length > 0 ? 'pointer' : 'not-allowed',
                  fontSize: '0.95rem',
                }}
              >
                Next Step
              </button>
            ) : (
              <button
                onClick={handleFinish}
                disabled={stepIdeas.length === 0}
                style={{
                  flex: 1,
                  padding: '0.875rem',
                  background: stepIdeas.length > 0 ? `linear-gradient(135deg, ${step.color} 0%, ${step.color}dd 100%)` : 'rgba(99, 102, 241, 0.4)',
                  border: 'none',
                  borderRadius: '0.75rem',
                  color: '#fff',
                  fontWeight: '600',
                  cursor: stepIdeas.length > 0 ? 'pointer' : 'not-allowed',
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
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ marginBottom: '3rem' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '900', margin: '0 0 0.5rem 0' }}>Biomimicry Journey</h1>
          <p style={{ color: '#a78bfa', margin: 0, fontSize: '0.95rem' }}>
            Design challenge: "{challenge}"
          </p>
        </div>

        {/* Steps Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          {STEPS.map((step, i) => (
            <div key={i} style={{ background: `${step.color}14`, border: `1px solid ${step.color}40`, borderRadius: '1rem', padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '700', color: step.color, margin: '0 0 1rem 0' }}>
                {step.emoji} {step.label}
              </h3>
              <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
                {ideas[i].map((idea, j) => (
                  <li key={j} style={{ color: '#d4d4d8', marginBottom: '0.5rem', fontSize: '0.9rem', lineHeight: '1.4' }}>
                    {idea.text}
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
              Biomimicry Insights
            </h3>
            <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.6', color: '#e0d5ff', whiteSpace: 'pre-wrap' }}>
              {summary}
            </p>
          </div>
        )}

        {loadingSummary && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: '#a78bfa', fontSize: '0.95rem' }}>Analyzing your journey...</p>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => setStage('working')}
            style={{
              flex: 1,
              padding: '0.875rem',
              background: 'rgba(99, 102, 241, 0.3)',
              border: '1px solid rgba(99, 102, 241, 0.5)',
              borderRadius: '0.75rem',
              color: '#fff',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '0.95rem',
            }}
          >
            Review Answers
          </button>
          <button
            onClick={() => window.print()}
            style={{
              flex: 1,
              padding: '0.875rem',
              background: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
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
