'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useToolSession } from '@/hooks/useToolSession';

type EffortLevel = 'low' | 'medium' | 'high';

/* ─── Mind Map Step Data ─── */
const STEPS = [
  {
    step: 1,
    title: 'Main Branches',
    color: '#818cf8',
    glow: 'rgba(129,140,248,0.15)',
    desc: 'Brainstorm 4–8 main topics or themes that branch from your central concept.',
    prompt: 'What are the key themes, angles, or categories related to your central concept?',
    icon: '🌳',
  },
  {
    step: 2,
    title: 'Sub-Branches',
    color: '#818cf8',
    glow: 'rgba(129,140,248,0.15)',
    desc: 'For each main branch, add 2–4 sub-ideas that explore that theme deeper.',
    prompt: 'For each branch, what specific ideas or details belong under it?',
    icon: '🌿',
  },
  {
    step: 3,
    title: 'Connections',
    color: '#818cf8',
    glow: 'rgba(129,140,248,0.15)',
    desc: 'Look for unexpected connections, overlaps, or patterns between branches.',
    prompt: 'What unexpected links exist between different branches?',
    icon: '🔗',
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
  high: { emoji: '✦', messages: ['Deep thinking!', 'Great insight!', 'Strong connections!'] },
  medium: { emoji: '→', messages: ['Good branch!', 'Keep going!', 'Building the map!'] },
  low: { emoji: '↑', messages: ['Try adding more detail', 'Can you be more specific?'] },
};

/* ─── API ─── */
async function fetchAI(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch('/api/tools/mind-map', {
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
export function MindMapTool(props: { mode: 'public' | 'embedded' | 'standalone'; challenge?: string; studentId?: string; unitId?: string; pageId?: string; onComplete?: (data: any) => void } = { mode: 'public' }) {
  const [stage, setStage] = useState<'intro' | 'working' | 'summary'>('intro');
  const [centerConcept, setCenterConcept] = useState(props.challenge || '');
  const [currentStep, setCurrentStep] = useState(0);
  const [branches, setBranches] = useState<Array<{ id: string; title: string; depth: 1 | 2; parentId?: string; ideas: string[] }>>([]);
  const [currentIdea, setCurrentIdea] = useState('');
  const [microFeedback, setMicroFeedback] = useState<{ effort: EffortLevel; message: string } | null>(null);
  const microFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loadingNudge, setLoadingNudge] = useState(false);
  const [nudge, setNudge] = useState('');
  const [timerActive, setTimerActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [summary, setSummary] = useState('');
  const [loadingSummary, setLoadingSummary] = useState(false);

  const { session, updateState: updateToolSession, completeSession } = useToolSession({
    toolId: 'mind-map',
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
        centerConcept,
        currentStep,
        branches,
      });
    }
  }, [stage, centerConcept, currentStep, branches, props.mode, updateToolSession]);

  /* ─── Micro-feedback auto-dismiss ─── */
  useEffect(() => {
    if (microFeedback) {
      microFeedbackTimerRef.current = setTimeout(() => setMicroFeedback(null), 3000);
      return () => {
        if (microFeedbackTimerRef.current) clearTimeout(microFeedbackTimerRef.current);
      };
    }
  }, [microFeedback]);

  /* ─── 10-second thinking timer ─── */
  useEffect(() => {
    if (!timerActive) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
  }, [timerActive]);

  /* ─── Fetch nudge ─── */
  const fetchNudge = useCallback(async () => {
    setLoadingNudge(true);
    setNudge('');
    try {
      const stepInfo = STEPS[currentStep];
      const data = await fetchAI({
        action: 'nudge',
        step: currentStep + 1,
        centerConcept: centerConcept.trim(),
        currentBranches: branches,
        stepPrompt: stepInfo.prompt,
      });
      if (data.nudge) {
        setNudge(data.nudge as string);
      }
    } catch (err) {
      console.warn('[mindmap] Nudge unavailable:', err);
    } finally {
      setLoadingNudge(false);
    }
  }, [centerConcept, branches, currentStep]);

  /* ─── Fetch summary ─── */
  const fetchSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const data = await fetchAI({
        action: 'summary',
        centerConcept: centerConcept.trim(),
        branches,
      });
      if (data.summary) {
        setSummary(data.summary as string);
      }
    } catch (err) {
      console.warn('[mindmap] Summary unavailable:', err);
    } finally {
      setLoadingSummary(false);
    }
  }, [centerConcept, branches]);

  /* ─── Event Handlers ─── */
  const handleAddIdea = () => {
    if (!currentIdea.trim()) return;

    const effort = assessEffort(currentIdea);
    const feedback = MICRO_FEEDBACK[effort];
    setMicroFeedback({
      effort,
      message: feedback.messages[Math.floor(Math.random() * feedback.messages.length)],
    });

    const isBranch = currentStep === 0;
    const isSubBranch = currentStep === 1;

    const newBranch: { id: string; title: string; depth: 1 | 2; parentId?: string; ideas: string[] } = {
      id: `branch-${Date.now()}`,
      title: currentIdea.trim(),
      depth: (isBranch ? 1 : 2) as 1 | 2,
      ideas: [],
    };

    if (isSubBranch) {
      const mainBranch = branches.find(b => b.depth === 1);
      if (mainBranch) {
        newBranch.parentId = mainBranch.id;
      }
    }

    setBranches([...branches, newBranch]);
    setCurrentIdea('');
    fetchNudge();
  };

  const handleMoveToSummary = () => {
    if (branches.length === 0) {
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
            <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🗺️</div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: '900', margin: '0 0 0.5rem 0' }}>Mind Map</h1>
            <p style={{ color: '#d4d4d8', fontSize: '1rem', margin: 0, lineHeight: '1.6' }}>
              Build a radial brainstorm. Start with a central concept and branch outward with related ideas and connections.
            </p>
          </div>

          <div style={{ background: 'rgba(129, 140, 248, 0.08)', border: '1px solid rgba(129, 140, 248, 0.3)', borderRadius: '1rem', padding: '1.5rem', marginBottom: '2rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#818cf8', marginBottom: '0.5rem' }}>
              Central concept or question
            </label>
            <textarea
              value={centerConcept}
              onChange={e => setCenterConcept(e.target.value)}
              placeholder="E.g., 'Sustainable transportation' or 'Ways to improve user experience'"
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
                minHeight: '80px',
                outline: 'none',
              }}
            />
          </div>

          <button
            onClick={() => setStage('working')}
            disabled={!centerConcept.trim()}
            style={{
              width: '100%',
              padding: '0.875rem',
              background: centerConcept.trim() ? 'linear-gradient(135deg, #818cf8 0%, #a5b4fc 100%)' : 'rgba(129, 140, 248, 0.4)',
              border: 'none',
              borderRadius: '0.75rem',
              color: '#fff',
              fontWeight: '600',
              fontSize: '1rem',
              cursor: centerConcept.trim() ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
            }}
          >
            Start: Begin Mapping
          </button>
        </div>
      </div>
    );
  }

  /* ─── Working Stage ─── */
  if (stage === 'working') {
    const stepInfo = STEPS[currentStep];
    const branchesForStep = branches.filter(b => b.depth === (currentStep === 0 ? 1 : 2));

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
            <h1 style={{ fontSize: '2rem', fontWeight: '900', margin: '0 0 0.5rem 0', color: '#818cf8' }}>
              {stepInfo.icon} {stepInfo.title}
            </h1>
            <p style={{ color: '#a5b4fc', margin: 0, fontSize: '0.9rem' }}>
              {stepInfo.desc}
            </p>
          </div>

          {/* Step Navigation Pills */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: currentStep === i ? 'linear-gradient(135deg, #818cf8 0%, #a5b4fc 100%)' : 'rgba(129, 140, 248, 0.15)',
                  border: `1px solid ${currentStep === i ? 'rgba(129, 140, 248, 0.8)' : 'rgba(129, 140, 248, 0.3)'}`,
                  borderRadius: '0.5rem',
                  color: '#fff',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                {STEPS[i].icon} {STEPS[i].title}
              </button>
            ))}
          </div>

          {/* Input Area */}
          <div style={{ background: 'rgba(129, 140, 248, 0.08)', border: '1px solid rgba(129, 140, 248, 0.3)', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '2rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#818cf8', marginBottom: '0.5rem' }}>
              {stepInfo.prompt}
            </label>
            <textarea
              value={currentIdea}
              onChange={e => setCurrentIdea(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && e.ctrlKey && currentIdea.trim()) {
                  handleAddIdea();
                }
              }}
              placeholder={`E.g., add a ${currentStep === 0 ? 'main branch' : 'sub-idea'}`}
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
                  background: 'linear-gradient(135deg, #818cf8 0%, #a5b4fc 100%)',
                  border: 'none',
                  borderRadius: '0.5rem',
                  color: '#fff',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                Add to Map
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
          {branchesForStep.length > 0 && (
            <div style={{ background: 'rgba(129, 140, 248, 0.08)', border: '1px solid rgba(129, 140, 248, 0.3)', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '2rem' }}>
              <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#818cf8', textTransform: 'uppercase', margin: '0 0 1rem 0', letterSpacing: '0.05em' }}>
                Your Ideas ({branchesForStep.length})
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                {branchesForStep.map((branch, i) => (
                  <div key={branch.id} style={{ background: 'rgba(129, 140, 248, 0.15)', borderRadius: '0.5rem', padding: '0.75rem', border: '1px solid rgba(129, 140, 248, 0.3)' }}>
                    <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', fontWeight: '600', color: '#a5b4fc' }}>
                      {i + 1}. {branch.title}
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
                background: 'rgba(129, 140, 248, 0.3)',
                border: '1px solid rgba(129, 140, 248, 0.5)',
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
                onClick={() => setCurrentStep(currentStep + 1)}
                disabled={branchesForStep.length === 0}
                style={{
                  flex: 1,
                  padding: '0.875rem',
                  background: branchesForStep.length > 0 ? 'linear-gradient(135deg, #818cf8 0%, #a5b4fc 100%)' : 'rgba(129, 140, 248, 0.4)',
                  border: 'none',
                  borderRadius: '0.75rem',
                  color: '#fff',
                  fontWeight: '600',
                  cursor: branchesForStep.length > 0 ? 'pointer' : 'not-allowed',
                  fontSize: '0.95rem',
                }}
              >
                Next Step
              </button>
            ) : (
              <button
                onClick={handleMoveToSummary}
                disabled={branches.length === 0}
                style={{
                  flex: 1,
                  padding: '0.875rem',
                  background: branches.length > 0 ? 'linear-gradient(135deg, #818cf8 0%, #a5b4fc 100%)' : 'rgba(129, 140, 248, 0.4)',
                  border: 'none',
                  borderRadius: '0.75rem',
                  color: '#fff',
                  fontWeight: '600',
                  cursor: branches.length > 0 ? 'pointer' : 'not-allowed',
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
          <h1 style={{ fontSize: '2.5rem', fontWeight: '900', margin: '0 0 0.5rem 0' }}>Mind Map Summary</h1>
          <p style={{ color: '#a5b4fc', margin: 0, fontSize: '0.95rem' }}>
            {branches.length} ideas mapped from "{centerConcept}"
          </p>
        </div>

        {/* Central Concept */}
        <div style={{ background: 'linear-gradient(135deg, #818cf8 0%, #a5b4fc 100%)', borderRadius: '1rem', padding: '2rem', marginBottom: '2rem', textAlign: 'center' }}>
          <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fff', textTransform: 'uppercase', margin: '0 0 0.5rem 0', letterSpacing: '0.05em', opacity: 0.9 }}>
            Central Concept
          </p>
          <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: '900', color: '#fff' }}>
            {centerConcept}
          </p>
        </div>

        {/* Ideas Grid */}
        <div style={{ background: 'rgba(129, 140, 248, 0.08)', border: '1px solid rgba(129, 140, 248, 0.3)', borderRadius: '1rem', padding: '2rem', marginBottom: '2rem' }}>
          <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#818cf8', textTransform: 'uppercase', margin: '0 0 1.5rem 0', letterSpacing: '0.05em' }}>
            All Ideas
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {branches.map((branch, i) => (
              <div key={branch.id} style={{ background: 'rgba(129, 140, 248, 0.15)', border: '1px solid rgba(129, 140, 248, 0.3)', borderRadius: '0.75rem', padding: '1rem' }}>
                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.75rem', fontWeight: '600', color: '#818cf8', textTransform: 'uppercase' }}>
                  {branch.depth === 1 ? 'Main Branch' : 'Sub-Branch'}
                </p>
                <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: '600', color: '#fff', lineHeight: '1.4' }}>
                  {branch.title}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* AI Summary */}
        {summary && (
          <div style={{ background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.4)', borderRadius: '1rem', padding: '1.5rem', marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#a78bfa', margin: '0 0 1rem 0' }}>
              Map Insights
            </h3>
            <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.6', color: '#e0d5ff', whiteSpace: 'pre-wrap' }}>
              {summary}
            </p>
          </div>
        )}

        {loadingSummary && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: '#a5b4fc', fontSize: '0.95rem' }}>Analyzing your map...</p>
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
            Add More Ideas
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
