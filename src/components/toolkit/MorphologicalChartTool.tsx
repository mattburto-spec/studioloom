'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

type EffortLevel = 'low' | 'medium' | 'high';
type StageType = 'intro' | 'parameters' | 'options' | 'combinations' | 'summary';

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
  high: {
    emoji: '✦',
    messages: ['Deep thinking!', 'Great variety!', 'Strong reasoning!'],
  },
  medium: {
    emoji: '→',
    messages: ['Good ideas!', 'Keep going!', 'Building momentum!'],
  },
  low: {
    emoji: '↑',
    messages: ['Try adding more detail', 'Can you be more specific?'],
  },
};

/* ─── API ─── */
async function fetchAI(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch('/api/tools/morphological-chart', {
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

/* ─── Cartesian Product ─── */
function generateCombinations(optionsByParam: Record<string, string[]>): Array<Record<string, string>> {
  const params = Object.keys(optionsByParam);
  if (params.length === 0) return [];

  const combinations: Array<Record<string, string>> = [];
  const indices = Array(params.length).fill(0);

  while (true) {
    const combo: Record<string, string> = {};
    for (let i = 0; i < params.length; i++) {
      combo[params[i]] = optionsByParam[params[i]][indices[i]];
    }
    combinations.push(combo);

    let i = params.length - 1;
    while (i >= 0 && indices[i] === optionsByParam[params[i]].length - 1) {
      indices[i] = 0;
      i--;
    }
    if (i < 0) break;
    indices[i]++;
  }

  return combinations.slice(0, 12);
}

/* ─── Main Component ─── */
export function MorphologicalChartTool(props: { mode: 'public' | 'embedded' | 'standalone'; challenge?: string; onComplete?: (data: any) => void } = { mode: 'public' }) {
  const [stage, setStage] = useState<StageType>('intro');
  const [challenge, setChallenge] = useState(props.challenge || '');
  const [parameters, setParameters] = useState<string[]>([]);
  const [currentParam, setCurrentParam] = useState('');
  const [optionsByParam, setOptionsByParam] = useState<Record<string, string[]>>({});
  const [currentParamIdx, setCurrentParamIdx] = useState(0);
  const [currentOption, setCurrentOption] = useState('');
  const [combinations, setCombinations] = useState<Array<Record<string, string>>>([]);
  const [ideas, setIdeas] = useState<Record<string, string>>({});
  const [selectedComboIdx, setSelectedComboIdx] = useState(0);
  const [microFeedback, setMicroFeedback] = useState<{ effort: EffortLevel; message: string } | null>(null);
  const microFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loadingNudge, setLoadingNudge] = useState(false);
  const [nudge, setNudge] = useState('');
  const [summary, setSummary] = useState('');
  const [loadingSummary, setLoadingSummary] = useState(false);

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
    if (selectedComboIdx >= combinations.length) return;
    setLoadingNudge(true);
    setNudge('');
    try {
      const combo = combinations[selectedComboIdx];
      const data = await fetchAI({
        action: 'nudge',
        challenge: challenge.trim(),
        combination: combo,
        currentIdea: ideas[selectedComboIdx] || '',
      });
      if (data.nudge) {
        setNudge(data.nudge as string);
      }
    } catch (err) {
      console.warn('[morpho] Nudge unavailable:', err);
    } finally {
      setLoadingNudge(false);
    }
  }, [challenge, combinations, selectedComboIdx, ideas]);

  /* ─── Fetch summary ─── */
  const fetchSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const data = await fetchAI({
        action: 'summary',
        challenge: challenge.trim(),
        combinations,
        ideas,
      });
      if (data.summary) {
        setSummary(data.summary as string);
      }
    } catch (err) {
      console.warn('[morpho] Summary unavailable:', err);
    } finally {
      setLoadingSummary(false);
    }
  }, [challenge, combinations, ideas]);

  /* ─── Event Handlers ─── */
  const handleAddParameter = () => {
    if (!currentParam.trim()) return;
    if (parameters.includes(currentParam.trim())) return;
    const newParams = [...parameters, currentParam.trim()];
    setParameters(newParams);
    setOptionsByParam({ ...optionsByParam, [currentParam.trim()]: [] });
    setCurrentParam('');
  };

  const handleAddOption = () => {
    if (!currentOption.trim() || currentParamIdx >= parameters.length) return;
    const param = parameters[currentParamIdx];
    const newOptions = { ...optionsByParam };
    if (!newOptions[param]) newOptions[param] = [];
    newOptions[param].push(currentOption.trim());
    setOptionsByParam(newOptions);
    setCurrentOption('');

    const effort = assessEffort(currentOption);
    const feedback = MICRO_FEEDBACK[effort];
    setMicroFeedback({
      effort,
      message: feedback.messages[Math.floor(Math.random() * feedback.messages.length)],
    });
  };

  const handleMoveToCombinations = () => {
    const allParamsHaveOptions = parameters.every(p => (optionsByParam[p]?.length || 0) > 0);
    if (!allParamsHaveOptions) {
      alert('Each parameter must have at least one option.');
      return;
    }
    const combos = generateCombinations(optionsByParam);
    setCombinations(combos);
    setIdeas({});
    setSelectedComboIdx(0);
    setStage('combinations');
  };

  const handleUpdateIdea = (idx: number, idea: string) => {
    const newIdeas = { ...ideas };
    newIdeas[idx] = idea;
    setIdeas(newIdeas);
  };

  const handleFinish = () => {
    fetchSummary();
    setStage('summary');
  };

  /* ─── Intro Stage ─── */
  if (stage === 'intro') {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0c24 0%, #1a0818 100%)', padding: '2rem', fontFamily: 'Inter, sans-serif', color: '#fff' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🔳</div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: '900', margin: '0 0 0.5rem 0' }}>Morphological Chart</h1>
            <p style={{ color: '#d4d4d8', fontSize: '1rem', margin: 0, lineHeight: '1.6' }}>
              Define parameters and options. Explore all combinations systematically for fresh design ideas.
            </p>
          </div>

          <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '1rem', padding: '1.5rem', marginBottom: '2rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#3b82f6', marginBottom: '0.5rem' }}>
              What's the design challenge?
            </label>
            <textarea
              value={challenge}
              onChange={e => setChallenge(e.target.value)}
              placeholder="E.g., 'Design a water bottle for hikers' or 'Create a new type of classroom furniture'"
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(59, 130, 246, 0.4)',
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
            onClick={() => setStage('parameters')}
            disabled={!challenge.trim()}
            style={{
              width: '100%',
              padding: '0.875rem',
              background: challenge.trim() ? 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)' : 'rgba(59, 130, 246, 0.4)',
              border: 'none',
              borderRadius: '0.75rem',
              color: '#fff',
              fontWeight: '600',
              fontSize: '1rem',
              cursor: challenge.trim() ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
            }}
          >
            Start: Define Parameters
          </button>
        </div>
      </div>
    );
  }

  /* ─── Parameters Stage ─── */
  if (stage === 'parameters') {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0c24 0%, #1a0818 100%)', padding: '2rem', fontFamily: 'Inter, sans-serif', color: '#fff' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: '900', margin: '0 0 0.5rem 0', color: '#3b82f6' }}>
              Define Parameters
            </h1>
            <p style={{ color: '#60a5fa', margin: 0, fontSize: '0.9rem' }}>
              {parameters.length} parameter(s) added
            </p>
          </div>

          <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '2rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#3b82f6', marginBottom: '0.5rem' }}>
              Parameter name (e.g., "Material", "Size", "Function")
            </label>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <input
                value={currentParam}
                onChange={e => setCurrentParam(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && currentParam.trim()) {
                    handleAddParameter();
                  }
                }}
                placeholder="E.g., Material, Size, Function, Color, Mechanism"
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(59, 130, 246, 0.4)',
                  borderRadius: '0.5rem',
                  color: '#fff',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '0.95rem',
                  outline: 'none',
                }}
              />
              {currentParam.trim() && (
                <button
                  onClick={handleAddParameter}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)',
                    border: 'none',
                    borderRadius: '0.5rem',
                    color: '#fff',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                  }}
                >
                  Add
                </button>
              )}
            </div>
          </div>

          {/* Parameters List */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem', marginBottom: '2rem' }}>
            {parameters.map((param, i) => (
              <div
                key={i}
                onClick={() => setCurrentParamIdx(i)}
                style={{
                  padding: '0.75rem',
                  background: currentParamIdx === i ? 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)' : 'rgba(59, 130, 246, 0.15)',
                  border: `1px solid ${currentParamIdx === i ? 'rgba(59, 130, 246, 0.8)' : 'rgba(59, 130, 246, 0.3)'}`,
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textAlign: 'center',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  color: '#fff',
                }}
              >
                {param}
              </div>
            ))}
          </div>

          {/* Options for Current Parameter */}
          {parameters.length > 0 && (
            <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '2rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#3b82f6', marginBottom: '0.75rem' }}>
                Options for <strong>{parameters[currentParamIdx]}</strong>
              </label>
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                <input
                  value={currentOption}
                  onChange={e => setCurrentOption(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && currentOption.trim()) {
                      handleAddOption();
                    }
                  }}
                  placeholder={`E.g., option for ${parameters[currentParamIdx]}`}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(59, 130, 246, 0.4)',
                    borderRadius: '0.5rem',
                    color: '#fff',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '0.95rem',
                    outline: 'none',
                  }}
                />
                {currentOption.trim() && (
                  <button
                    onClick={handleAddOption}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)',
                      border: 'none',
                      borderRadius: '0.5rem',
                      color: '#fff',
                      fontWeight: '600',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                    }}
                  >
                    Add
                  </button>
                )}
              </div>

              {/* Current Options */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {(optionsByParam[parameters[currentParamIdx]] || []).map((opt, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '0.4rem 0.8rem',
                      background: 'rgba(59, 130, 246, 0.3)',
                      borderRadius: '999px',
                      fontSize: '0.8rem',
                      color: '#fff',
                    }}
                  >
                    {opt}
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
              onClick={() => setStage('intro')}
              style={{
                flex: 1,
                padding: '0.875rem',
                background: 'rgba(59, 130, 246, 0.3)',
                border: '1px solid rgba(59, 130, 246, 0.5)',
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
              onClick={handleMoveToCombinations}
              disabled={parameters.length === 0}
              style={{
                flex: 1,
                padding: '0.875rem',
                background: parameters.length > 0 ? 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)' : 'rgba(59, 130, 246, 0.4)',
                border: 'none',
                borderRadius: '0.75rem',
                color: '#fff',
                fontWeight: '600',
                cursor: parameters.length > 0 ? 'pointer' : 'not-allowed',
                fontSize: '0.95rem',
              }}
            >
              Next: Generate Combinations
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Combinations Stage ─── */
  if (stage === 'combinations') {
    const currentCombo = combinations[selectedComboIdx];
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0c24 0%, #1a0818 100%)', padding: '2rem', fontFamily: 'Inter, sans-serif', color: '#fff' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: '900', margin: '0 0 0.5rem 0', color: '#3b82f6' }}>
              Explore Combinations
            </h1>
            <p style={{ color: '#60a5fa', margin: 0, fontSize: '0.9rem' }}>
              {combinations.length} combination(s) • {Object.keys(ideas).length} idea(s) captured
            </p>
          </div>

          {/* Combination Navigation */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '0.5rem', marginBottom: '2rem' }}>
            {combinations.map((_, i) => (
              <button
                key={i}
                onClick={() => setSelectedComboIdx(i)}
                style={{
                  padding: '0.5rem',
                  background: selectedComboIdx === i ? 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)' : 'rgba(59, 130, 246, 0.15)',
                  border: `1px solid ${selectedComboIdx === i ? 'rgba(59, 130, 246, 0.8)' : 'rgba(59, 130, 246, 0.3)'}`,
                  borderRadius: '0.5rem',
                  color: '#fff',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                }}
              >
                {i + 1}
              </button>
            ))}
          </div>

          {/* Current Combination Display */}
          {currentCombo && (
            <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '2rem' }}>
              <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#3b82f6', textTransform: 'uppercase', margin: '0 0 1rem 0', letterSpacing: '0.05em' }}>
                Combination {selectedComboIdx + 1}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                {Object.entries(currentCombo).map(([param, value]) => (
                  <div key={param} style={{ background: 'rgba(59, 130, 246, 0.2)', borderRadius: '0.5rem', padding: '0.75rem' }}>
                    <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.75rem', fontWeight: '600', color: '#60a5fa', textTransform: 'uppercase' }}>
                      {param}
                    </p>
                    <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: '600', color: '#fff' }}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Idea Input */}
          <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '2rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#3b82f6', marginBottom: '0.5rem' }}>
              What idea or design could you create with this combination?
            </label>
            <textarea
              value={ideas[selectedComboIdx] || ''}
              onChange={e => handleUpdateIdea(selectedComboIdx, e.target.value)}
              placeholder="Describe the idea you'd create using this combination..."
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(59, 130, 246, 0.4)',
                borderRadius: '0.5rem',
                color: '#fff',
                fontFamily: 'Inter, sans-serif',
                fontSize: '0.95rem',
                resize: 'vertical',
                minHeight: '100px',
                outline: 'none',
                marginBottom: '1rem',
              }}
            />

            {nudge && (
              <div style={{ background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.4)', borderRadius: '0.5rem', padding: '0.75rem', marginBottom: '1rem' }}>
                <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.5', fontStyle: 'italic', color: '#e0d5ff' }}>
                  {nudge}
                </p>
              </div>
            )}

            <button
              onClick={fetchNudge}
              disabled={loadingNudge}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'rgba(59, 130, 246, 0.3)',
                border: '1px solid rgba(59, 130, 246, 0.5)',
                borderRadius: '0.5rem',
                color: '#fff',
                fontWeight: '600',
                cursor: loadingNudge ? 'not-allowed' : 'pointer',
                fontSize: '0.9rem',
              }}
            >
              {loadingNudge ? 'Thinking...' : 'Get Nudge'}
            </button>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => setStage('parameters')}
              style={{
                flex: 1,
                padding: '0.875rem',
                background: 'rgba(59, 130, 246, 0.3)',
                border: '1px solid rgba(59, 130, 246, 0.5)',
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
              style={{
                flex: 1,
                padding: '0.875rem',
                background: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)',
                border: 'none',
                borderRadius: '0.75rem',
                color: '#fff',
                fontWeight: '600',
                cursor: 'pointer',
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
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0c24 0%, #1a0818 100%)', padding: '2rem', fontFamily: 'Inter, sans-serif', color: '#fff' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ marginBottom: '3rem' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '900', margin: '0 0 0.5rem 0' }}>Morphological Summary</h1>
          <p style={{ color: '#60a5fa', margin: 0, fontSize: '0.95rem' }}>
            {combinations.length} combinations explored • {Object.keys(ideas).length} ideas captured
          </p>
        </div>

        {/* Ideas Grid */}
        <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '1rem', padding: '2rem', marginBottom: '2rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {combinations.map((combo, i) => (
              ideas[i] && (
                <div key={i} style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '0.75rem', padding: '1rem' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: '600', color: '#3b82f6', textTransform: 'uppercase', margin: '0 0 0.75rem 0', letterSpacing: '0.05em' }}>
                    Combo {i + 1}
                  </p>
                  <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.8rem', color: '#a5b4fc', marginBottom: '1rem' }}>
                    {Object.entries(combo).map(([param, value]) => (
                      <li key={param} style={{ marginBottom: '0.25rem' }}>
                        <strong>{param}:</strong> {value}
                      </li>
                    ))}
                  </ul>
                  <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.5', color: '#d4d4d8' }}>
                    {ideas[i]}
                  </p>
                </div>
              )
            ))}
          </div>
        </div>

        {/* AI Summary */}
        {summary && (
          <div style={{ background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.4)', borderRadius: '1rem', padding: '1.5rem', marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#a78bfa', margin: '0 0 1rem 0' }}>
              Insights & Patterns
            </h3>
            <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.6', color: '#e0d5ff', whiteSpace: 'pre-wrap' }}>
              {summary}
            </p>
          </div>
        )}

        {loadingSummary && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: '#60a5fa', fontSize: '0.95rem' }}>Analyzing your ideas...</p>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => setStage('combinations')}
            style={{
              flex: 1,
              padding: '0.875rem',
              background: 'rgba(59, 130, 246, 0.3)',
              border: '1px solid rgba(59, 130, 246, 0.5)',
              borderRadius: '0.75rem',
              color: '#fff',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '0.95rem',
            }}
          >
            Edit Ideas
          </button>
          <button
            onClick={() => window.print()}
            style={{
              flex: 1,
              padding: '0.875rem',
              background: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)',
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
