'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useToolSession } from '@/hooks/useToolSession';

type EffortLevel = 'low' | 'medium' | 'high';

interface ToolState {
  stage: 'intro' | 'working' | 'summary';
  challenge: string;
  currentCategory: number;
  causes: Record<string, string[]>;
}

const CATEGORIES = [
  {
    name: 'People',
    emoji: '👥',
    color: '#8b5cf6',
    instruction: 'What human factors, skills gaps, or training issues could cause this?',
    hint: 'Who is involved? What skills might be missing? Are there communication gaps?',
  },
  {
    name: 'Methods',
    emoji: '⚙️',
    color: '#6366f1',
    instruction: 'What process steps, procedures, or techniques could fail?',
    hint: 'Are the procedures clear? Is there a better way? Are instructions followed?',
  },
  {
    name: 'Materials',
    emoji: '📦',
    color: '#06b6d4',
    instruction: 'What supply chain, quality, or material issues could cause this?',
    hint: 'Is the material the right quality? Are supplies consistent? Is there waste?',
  },
  {
    name: 'Machines',
    emoji: '⚡',
    color: '#f59e0b',
    instruction: 'What equipment failures, maintenance issues, or technical problems could cause this?',
    hint: 'Is the equipment working properly? Is it maintained? Is it the right tool for the job?',
  },
  {
    name: 'Measurements',
    emoji: '📊',
    color: '#10b981',
    instruction: 'What measurement, testing, or feedback gaps could cause this?',
    hint: 'Are we measuring the right things? Is data accurate? Do we get timely feedback?',
  },
  {
    name: 'Environment',
    emoji: '🌍',
    color: '#ef4444',
    instruction: 'What external conditions, weather, or context could cause this?',
    hint: 'What external factors affect this? Is the environment suited to the task?',
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

const EFFORT_DISPLAY = {
  high: { symbol: '●', label: 'High effort' },
  medium: { symbol: '◐', label: 'Medium effort' },
  low: { symbol: '◯', label: 'Low effort' },
};

const MICRO_FEEDBACK: Record<EffortLevel, { emoji: string; messages: string[] }> = {
  high: { emoji: '✦', messages: ['Deep analysis!', 'Strong insight!', 'Root cause thinking!'] },
  medium: { emoji: '→', messages: ['Good cause!', 'Keep going!', 'Getting there!'] },
  low: { emoji: '↑', messages: ['Try adding more detail', 'Can you dig deeper?'] },
};

/* ─── API ─── */
async function fetchAI(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch('/api/tools/fishbone', {
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
export function FishboneTool(props: { mode: 'public' | 'embedded' | 'standalone'; challenge?: string; onComplete?: (data: any) => void; studentId?: string; unitId?: string; pageId?: string } = { mode: 'public' }) {
  const [stage, setStage] = useState<'intro' | 'working' | 'summary'>('intro');
  const [challenge, setChallenge] = useState(props.challenge || '');
  const [currentCategory, setCurrentCategory] = useState(0);
  const [causes, setCauses] = useState<Record<string, string[]>>({});
  const [causalEfforts, setCausalEfforts] = useState<Record<string, EffortLevel[]>>({});
  const [currentCause, setCurrentCause] = useState('');
  const [microFeedback, setMicroFeedback] = useState<{ effort: EffortLevel; message: string } | null>(null);
  const microFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loadingNudge, setLoadingNudge] = useState(false);
  const [nudge, setNudge] = useState('');
  const [summary, setSummary] = useState('');
  const [loadingSummary, setLoadingSummary] = useState(false);

  const { session, updateState: updateToolSession } = useToolSession({
    toolId: 'fishbone',
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
        currentCategory,
        causes,
      });
    }
  }, [stage, challenge, currentCategory, causes, props.studentId, props.mode, updateToolSession]);

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
      const category = CATEGORIES[currentCategory];
      const data = await fetchAI({
        action: 'nudge',
        challenge: challenge.trim(),
        category: category.name,
        currentCauses: causes[category.name] || [],
      });
      if (data.nudge) {
        setNudge(data.nudge as string);
      }
    } catch (err) {
      console.warn('[fishbone] Nudge unavailable:', err);
    } finally {
      setLoadingNudge(false);
    }
  }, [challenge, causes, currentCategory]);

  /* ─── Fetch summary ─── */
  const fetchSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const data = await fetchAI({
        action: 'summary',
        challenge: challenge.trim(),
        causes,
      });
      if (data.summary) {
        setSummary(data.summary as string);
      }
    } catch (err) {
      console.warn('[fishbone] Summary unavailable:', err);
    } finally {
      setLoadingSummary(false);
    }
  }, [challenge, causes]);

  /* ─── Event Handlers ─── */
  const handleAddCause = () => {
    if (!currentCause.trim()) return;

    const effort = assessEffort(currentCause);
    const category = CATEGORIES[currentCategory];

    const newCauses = { ...causes };
    newCauses[category.name] = [...(newCauses[category.name] || []), currentCause.trim()];
    setCauses(newCauses);

    const newEfforts = { ...causalEfforts };
    newEfforts[category.name] = [...(newEfforts[category.name] || []), effort];
    setCausalEfforts(newEfforts);

    const feedback = MICRO_FEEDBACK[effort];
    setMicroFeedback({
      effort,
      message: feedback.messages[Math.floor(Math.random() * feedback.messages.length)],
    });

    setCurrentCause('');
    fetchNudge();
  };

  const handleFinish = () => {
    const totalCauses = Object.values(causes).reduce((sum, arr) => sum + arr.length, 0);
    if (totalCauses === 0) {
      alert('Please add at least one cause.');
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
            <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🦴</div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: '900', margin: '0 0 0.5rem 0' }}>Fishbone Diagram</h1>
            <p style={{ color: '#d4d4d8', fontSize: '1rem', margin: 0, lineHeight: '1.6' }}>
              Analyze root causes across six categories: People, Methods, Materials, Machines, Measurements, and Environment.
            </p>
          </div>

          <div style={{ background: 'rgba(168, 85, 247, 0.08)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '1rem', padding: '1.5rem', marginBottom: '2rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#a78bfa', marginBottom: '0.5rem' }}>
              What's the problem you're analyzing?
            </label>
            <textarea
              value={challenge}
              onChange={e => setChallenge(e.target.value)}
              placeholder="E.g., 'High product defect rate' or 'Why students are not completing assignments'"
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
            />
          </div>

          <button
            onClick={() => setStage('working')}
            disabled={!challenge.trim()}
            style={{
              width: '100%',
              padding: '0.875rem',
              background: challenge.trim() ? 'linear-gradient(135deg, #a78bfa 0%, #ddd6fe 100%)' : 'rgba(168, 85, 247, 0.4)',
              border: 'none',
              borderRadius: '0.75rem',
              color: '#fff',
              fontWeight: '600',
              fontSize: '1rem',
              cursor: challenge.trim() ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
            }}
          >
            Start: Analyze Root Causes
          </button>
        </div>
      </div>
    );
  }

  /* ─── Working Stage ─── */
  if (stage === 'working') {
    const category = CATEGORIES[currentCategory];
    const categoryCauses = causes[category.name] || [];
    const categoryEfforts = causalEfforts[category.name] || [];

    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0c24 0%, #1a0818 100%)', padding: '2rem', fontFamily: 'Inter, sans-serif', color: '#fff' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: '900', margin: '0 0 0.5rem 0', color: category.color }}>
              {category.emoji} {category.name}
            </h1>
            <p style={{ color: '#a78bfa', margin: 0, fontSize: '0.9rem' }}>
              {category.instruction}
            </p>
          </div>

          {/* Category Navigation Pills */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
            {CATEGORIES.map((cat, i) => (
              <button
                key={i}
                onClick={() => setCurrentCategory(i)}
                style={{
                  padding: '0.75rem 1rem',
                  background: currentCategory === i ? cat.color : 'rgba(99,102,241,0.15)',
                  border: `1px solid ${currentCategory === i ? cat.color : 'rgba(99,102,241,0.3)'}`,
                  borderRadius: '0.5rem',
                  color: '#fff',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  transition: 'all 0.2s',
                }}
              >
                {cat.emoji} {cat.name}
              </button>
            ))}
          </div>

          {/* Input Area */}
          <div style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '2rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#6366f1', marginBottom: '0.5rem' }}>
              {category.hint}
            </label>
            <textarea
              value={currentCause}
              onChange={e => setCurrentCause(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && e.ctrlKey && currentCause.trim()) {
                  handleAddCause();
                }
              }}
              placeholder={`Add a root cause under ${category.name}...`}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(99, 102, 241, 0.4)',
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

            {currentCause.trim() && (
              <button
                onClick={handleAddCause}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
                  border: 'none',
                  borderRadius: '0.5rem',
                  color: '#fff',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                Add Cause
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

          {/* Causes List */}
          {categoryCauses.length > 0 && (
            <div style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '2rem' }}>
              <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#6366f1', textTransform: 'uppercase', margin: '0 0 1rem 0', letterSpacing: '0.05em' }}>
                Causes ({categoryCauses.length})
              </p>
              <ol style={{ margin: 0, paddingLeft: '1.5rem' }}>
                {categoryCauses.map((cause, i) => (
                  <li key={i} style={{ color: '#d4d4d8', marginBottom: '0.75rem', fontSize: '0.9rem', lineHeight: '1.4' }}>
                    <span style={{ marginRight: '0.5rem', color: categoryEfforts[i] === 'high' ? '#a78bfa' : categoryEfforts[i] === 'medium' ? '#60a5fa' : '#f59e0b' }}>
                      {EFFORT_DISPLAY[categoryEfforts[i]].symbol}
                    </span>
                    {cause}
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
              onClick={() => setStage('intro')}
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
              Back
            </button>
            <button
              onClick={handleFinish}
              disabled={Object.values(causes).every(arr => arr.length === 0)}
              style={{
                flex: 1,
                padding: '0.875rem',
                background: Object.values(causes).some(arr => arr.length > 0) ? 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)' : 'rgba(99, 102, 241, 0.4)',
                border: 'none',
                borderRadius: '0.75rem',
                color: '#fff',
                fontWeight: '600',
                cursor: Object.values(causes).some(arr => arr.length > 0) ? 'pointer' : 'not-allowed',
                fontSize: '0.95rem',
              }}
            >
              View Summary
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Summary Stage ─── */
  const totalCauses = Object.values(causes).reduce((sum, arr) => sum + arr.length, 0);
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0c24 0%, #1a0818 100%)', padding: '2rem', fontFamily: 'Inter, sans-serif', color: '#fff' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ marginBottom: '3rem' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '900', margin: '0 0 0.5rem 0' }}>Fishbone Analysis</h1>
          <p style={{ color: '#a78bfa', margin: 0, fontSize: '0.95rem' }}>
            {totalCauses} root causes identified for: "{challenge}"
          </p>
        </div>

        {/* Causes by Category */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          {CATEGORIES.map((cat) => (
            causes[cat.name] && causes[cat.name].length > 0 && (
              <div key={cat.name} style={{ background: `${cat.color}14`, border: `1px solid ${cat.color}40`, borderRadius: '1rem', padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '700', color: cat.color, margin: '0 0 1rem 0' }}>
                  {cat.emoji} {cat.name}
                </h3>
                <ol style={{ margin: 0, paddingLeft: '1.5rem' }}>
                  {causes[cat.name].map((cause, i) => (
                    <li key={i} style={{ color: '#d4d4d8', marginBottom: '0.5rem', fontSize: '0.9rem', lineHeight: '1.4' }}>
                      {cause}
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
              Root Cause Insights
            </h3>
            <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.6', color: '#e0d5ff', whiteSpace: 'pre-wrap' }}>
              {summary}
            </p>
          </div>
        )}

        {loadingSummary && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: '#a78bfa', fontSize: '0.95rem' }}>Analyzing causes...</p>
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
            Add More Causes
          </button>
          <button
            onClick={() => window.print()}
            style={{
              flex: 1,
              padding: '0.875rem',
              background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
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
