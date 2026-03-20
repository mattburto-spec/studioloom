'use client';

import { useState, useRef } from 'react';

type StageType = 'intro' | 'working' | 'summary';
type EffortLevel = 'low' | 'medium' | 'high';

const POV_STEPS = [
  {
    label: 'User',
    emoji: '👤',
    instruction: 'Describe the specific user.',
    placeholder: 'e.g., "A 14-year-old girl who loves gaming but struggles with hand fatigue"',
    guidance: 'Not "people" — give them a name, age, context, and one personal detail.',
    color: '#6366f1',
    glow: 'rgba(99,102,241,0.15)',
  },
  {
    label: 'Need',
    emoji: '🎯',
    instruction: 'What does this user need?',
    placeholder: 'e.g., "needs to feel confident trying new things"',
    guidance: 'Use a verb (needs to DO, FEEL, LEARN). Not a thing — a need.',
    color: '#8b5cf6',
    glow: 'rgba(139,92,246,0.15)',
  },
  {
    label: 'Insight',
    emoji: '💡',
    instruction: 'The surprising insight.',
    placeholder: 'e.g., "because they equate failure with personal weakness, not learning opportunity"',
    guidance: 'The "why" that reframes the problem. What\'s the non-obvious reason?',
    color: '#d946ef',
    glow: 'rgba(217,70,239,0.15)',
  },
];

interface ToolState {
  stage: StageType;
  challenge: string;
  userDescription: string;
  needDescription: string;
  insightDescription: string;
  currentStep: number;
  efforts: EffortLevel[];
}

interface ToolResponse {
  toolId: string;
  challenge: string;
  stage: StageType;
  userDescription: string;
  needDescription: string;
  insightDescription: string;
  metadata: {
    timeSpentMs: number;
  };
}

function assessEffort(text: string): EffortLevel {
  const words = text.trim().split(/\s+/).length;
  const hasContext = /\b(age|year|school|home|work|because|since|who|which)\b/i.test(text);
  const hasDetail = words >= 12;
  const hasPersonal = /\b(loves|enjoys|struggles|frustrated|worried|wants|dreams)\b/i.test(text);

  if (words < 5) return 'low';
  if ((hasDetail && hasContext) || (hasPersonal && hasDetail)) return 'high';
  if (words >= 8 || hasContext) return 'medium';
  return 'low';
}

function getDepthInfo(effort: EffortLevel): { dots: 1 | 2 | 3; label: string; color: string } {
  if (effort === 'high') return { dots: 3, label: 'Detailed', color: '#a78bfa' };
  if (effort === 'medium') return { dots: 2, label: 'Good start', color: '#60a5fa' };
  return { dots: 1, label: 'Go deeper', color: '#f59e0b' };
}

export function PointOfViewTool({
  toolId = 'pov-statement',
  mode = 'public',
  challenge: initialChallenge = '',
  sessionId: initialSessionId,
  onSave,
  onComplete,
}: {
  toolId?: string;
  mode: 'public' | 'embedded' | 'standalone';
  challenge?: string;
  sessionId?: string;
  onSave?: (state: ToolState) => void;
  onComplete?: (data: ToolResponse) => void;
}) {
  const [stage, setStage] = useState<StageType>(initialChallenge ? 'working' : 'intro');
  const [challenge, setChallenge] = useState(initialChallenge);
  const [userDescription, setUserDescription] = useState('');
  const [needDescription, setNeedDescription] = useState('');
  const [insightDescription, setInsightDescription] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [efforts, setEfforts] = useState<EffortLevel[]>(['low', 'low', 'low']);
  const [sessionId] = useState(() => initialSessionId || Math.random().toString(36).slice(2) + Date.now().toString(36));
  const [aiEvaluation, setAiEvaluation] = useState<string>('');
  const [loadingEvaluation, setLoadingEvaluation] = useState(false);
  const [showExample, setShowExample] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const startTimeRef = useRef(Date.now());

  const descriptions = [userDescription, needDescription, insightDescription];
  const step = POV_STEPS[currentStep];
  const stepValue = descriptions[currentStep];
  const effort = efforts[currentStep];
  const depthInfo = getDepthInfo(effort);

  const handleChallengeSubmit = (value: string) => {
    if (value.trim()) {
      setChallenge(value);
      setStage('working');
    }
  };

  const handleStepInput = (stepIndex: number, value: string) => {
    const newEffort = assessEffort(value);
    const newEfforts = [...efforts];
    newEfforts[stepIndex] = newEffort;
    setEfforts(newEfforts);

    if (stepIndex === 0) setUserDescription(value);
    if (stepIndex === 1) setNeedDescription(value);
    if (stepIndex === 2) setInsightDescription(value);

    if (value.trim()) {
      const messages: Record<EffortLevel, string> = {
        low: 'Try adding more detail',
        medium: 'Good — keep building!',
        high: 'Detailed thinking!',
      };
      setToastMessage(messages[newEffort]);
      setTimeout(() => setToastMessage(''), 3000);
    }
  };

  const handleGenerateEvaluation = async () => {
    if (!userDescription.trim() || !needDescription.trim() || !insightDescription.trim()) {
      setAiEvaluation('Please fill in all three fields first.');
      return;
    }

    setLoadingEvaluation(true);
    try {
      const response = await fetch('/api/tools/pov-statement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'evaluate',
          sessionId,
          userDescription,
          needDescription,
          insightDescription,
        }),
      });

      if (!response.ok) throw new Error('Failed to get AI evaluation');
      const data = await response.json();
      setAiEvaluation(data.evaluation || '');
    } catch (error) {
      setAiEvaluation('Could not generate evaluation. Try again.');
      console.error(error);
    } finally {
      setLoadingEvaluation(false);
    }
  };

  const handleComplete = () => {
    const timeSpent = Date.now() - startTimeRef.current;
    const response: ToolResponse = {
      toolId,
      challenge,
      stage,
      userDescription,
      needDescription,
      insightDescription,
      metadata: { timeSpentMs: timeSpent },
    };
    onComplete?.(response);
  };

  if (stage === 'intro') {
    return (
      <div style={{ background: 'linear-gradient(135deg, #0c0c24 0%, #1a0c2e 100%)', color: '#ffffff', minHeight: '100vh', padding: '60px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
        <style>{`
          @keyframes toolFadeIn {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .tool-screen { animation: toolFadeIn 0.3s ease-out; }
        `}</style>
        <div style={{ maxWidth: '500px', width: '100%' }} className="tool-screen">
          <h1 style={{ fontSize: '36px', marginBottom: '20px', textAlign: 'center', fontWeight: 'bold' }}>Point of View Statement</h1>
          <p style={{ fontSize: '16px', color: '#d0d0d0', marginBottom: '40px', textAlign: 'center', lineHeight: '1.6' }}>
            Define your design challenge by building a POV statement. This reframes your problem from a user-centered lens.
          </p>
          <p style={{ fontSize: '14px', color: '#a0a0a0', marginBottom: '30px', fontStyle: 'italic', textAlign: 'center' }}>
            "A Point of View Statement is a way of framing a design challenge through the eyes of the user." — Stanford d.school
          </p>
          <div style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '12px', padding: '30px', marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '15px', fontSize: '14px', fontWeight: '600' }}>
              What design challenge are you exploring?
            </label>
            <textarea
              placeholder="e.g., 'How to help teenagers build digital literacy' or 'Designing a tool for remote team collaboration'"
              value={challenge}
              onChange={(e) => setChallenge(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(139,92,246,0.5)', background: 'rgba(0,0,0,0.3)', color: '#ffffff', fontSize: '14px', fontFamily: 'inherit', minHeight: '100px', resize: 'none' }}
            />
            <button
              onClick={() => handleChallengeSubmit(challenge)}
              style={{ width: '100%', padding: '12px 20px', marginTop: '20px', background: '#8b5cf6', color: '#ffffff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', transition: 'all 0.2s' }}
            >
              Start Building POV
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'working') {
    return (
      <div style={{ background: 'linear-gradient(135deg, #0c0c24 0%, #1a0c2e 100%)', color: '#ffffff', minHeight: '100vh', padding: '40px 20px', fontFamily: 'Inter, sans-serif' }}>
        <style>{`
          @keyframes toolFadeIn {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .tool-screen { animation: toolFadeIn 0.3s ease-out; }
        `}</style>
        <div style={{ maxWidth: '700px', margin: '0 auto' }} className="tool-screen">
          <div style={{ marginBottom: '40px' }}>
            <p style={{ fontSize: '12px', color: '#a0a0a0', marginBottom: '8px', fontWeight: '600' }}>CHALLENGE</p>
            <h2 style={{ fontSize: '24px', margin: '0', fontWeight: 'bold' }}>{challenge}</h2>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '40px', justifyContent: 'center' }}>
            {POV_STEPS.map((s, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStep(idx)}
                style={{ padding: '12px 16px', background: currentStep === idx ? s.color : 'rgba(139,92,246,0.2)', border: 'none', borderRadius: '8px', color: '#ffffff', cursor: 'pointer', fontSize: '14px', fontWeight: '600', transition: 'all 0.2s' }}
              >
                {s.emoji} {s.label}
              </button>
            ))}
          </div>

          <div style={{ background: `linear-gradient(135deg, ${step.glow} 0%, rgba(139,92,246,0.05) 100%)`, border: `1px solid ${step.color}33`, borderRadius: '12px', padding: '30px', marginBottom: '40px', animation: 'toolFadeIn 0.3s ease-out' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '10px', fontWeight: 'bold' }}>
              {step.emoji} {step.label}
            </h3>
            <p style={{ fontSize: '14px', color: '#d0d0d0', marginBottom: '20px' }}>
              {step.instruction}
            </p>

            <textarea
              placeholder={step.placeholder}
              value={stepValue}
              onChange={(e) => handleStepInput(currentStep, e.target.value)}
              style={{ width: '100%', padding: '14px', borderRadius: '8px', border: `1px solid ${step.color}66`, background: 'rgba(0,0,0,0.4)', color: '#ffffff', fontSize: '14px', fontFamily: 'inherit', minHeight: '100px', resize: 'none', marginBottom: '15px' }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <p style={{ fontSize: '12px', color: '#a0a0a0', margin: '0' }}>
                {step.guidance}
              </p>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    style={{ width: '8px', height: '8px', borderRadius: '50%', background: i < depthInfo.dots ? step.color : 'rgba(139,92,246,0.2)' }}
                  />
                ))}
              </div>
            </div>

            <button
              onClick={() => setShowExample(!showExample)}
              style={{ background: 'none', border: 'none', color: step.color, cursor: 'pointer', fontSize: '12px', fontWeight: '600', padding: '0', textAlign: 'left' }}
            >
              {showExample ? '▼ Hide example' : '▶ See an example'}
            </button>

            {showExample && (
              <div style={{ background: 'rgba(139,92,246,0.1)', border: `1px solid ${step.color}44`, borderRadius: '8px', padding: '12px', marginTop: '12px', fontSize: '13px', color: '#e0e0e0' }}>
                {step.placeholder}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between', marginBottom: '40px' }}>
            <button
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
              style={{ padding: '10px 16px', background: currentStep === 0 ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.4)', border: 'none', borderRadius: '8px', color: '#ffffff', cursor: currentStep === 0 ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: '600', transition: 'all 0.2s' }}
            >
              ← Back
            </button>
            <button
              onClick={() => setCurrentStep(Math.min(2, currentStep + 1))}
              disabled={currentStep === 2}
              style={{ padding: '10px 16px', background: currentStep === 2 ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.4)', border: 'none', borderRadius: '8px', color: '#ffffff', cursor: currentStep === 2 ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: '600', transition: 'all 0.2s' }}
            >
              Next →
            </button>
          </div>

          {userDescription.trim() && needDescription.trim() && insightDescription.trim() && (
            <button
              onClick={() => {
                handleGenerateEvaluation();
                setStage('summary');
              }}
              style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)', color: '#ffffff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', marginBottom: '20px', transition: 'all 0.2s' }}
            >
              See Summary
            </button>
          )}
        </div>

        {toastMessage && (
          <div style={{ position: 'fixed', bottom: '20px', right: '20px', background: 'rgba(139,92,246,0.9)', color: '#ffffff', padding: '12px 20px', borderRadius: '8px', fontSize: '13px', animation: 'toolFadeIn 0.2s ease-in' }}>
            {toastMessage}
          </div>
        )}
      </div>
    );
  }

  if (stage === 'summary') {
    return (
      <div style={{ background: 'linear-gradient(135deg, #0c0c24 0%, #1a0c2e 100%)', color: '#ffffff', minHeight: '100vh', padding: '40px 20px', fontFamily: 'Inter, sans-serif' }}>
        <style>{`
          @keyframes toolFadeIn {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .tool-screen { animation: toolFadeIn 0.3s ease-out; }
        `}</style>
        <div style={{ maxWidth: '700px', margin: '0 auto' }} className="tool-screen">
          <h1 style={{ fontSize: '28px', marginBottom: '10px', textAlign: 'center', fontWeight: 'bold' }}>Your POV Statement</h1>
          <p style={{ fontSize: '14px', color: '#a0a0a0', marginBottom: '40px', textAlign: 'center' }}>
            Here's your completed Point of View statement and AI evaluation:
          </p>

          <div style={{ background: 'rgba(139,92,246,0.1)', border: '2px solid #8b5cf6', borderRadius: '12px', padding: '30px', marginBottom: '30px' }}>
            <p style={{ fontSize: '14px', color: '#d0d0d0', marginBottom: '20px', lineHeight: '1.8' }}>
              <strong>{userDescription}</strong> needs <strong>{needDescription}</strong> because{' '}
              <strong>{insightDescription}</strong>.
            </p>
          </div>

          <div style={{ background: 'rgba(217,70,239,0.1)', border: '1px solid rgba(217,70,239,0.4)', borderRadius: '12px', padding: '20px', marginBottom: '30px' }}>
            <h3 style={{ fontSize: '14px', marginBottom: '12px', color: '#d946ef', fontWeight: '600' }}>AI Evaluation</h3>
            {loadingEvaluation ? (
              <p style={{ fontSize: '13px', color: '#a0a0a0' }}>Analyzing your statement...</p>
            ) : (
              <p style={{ fontSize: '13px', color: '#e0e0e0', lineHeight: '1.6', margin: '0' }}>
                {aiEvaluation}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={() => setStage('working')}
              style={{ padding: '12px 24px', background: 'rgba(139,92,246,0.3)', border: '1px solid rgba(139,92,246,0.6)', borderRadius: '8px', color: '#ffffff', cursor: 'pointer', fontSize: '13px', fontWeight: '600', transition: 'all 0.2s' }}
            >
              Edit
            </button>
            <button
              onClick={handleComplete}
              style={{ padding: '12px 24px', background: '#8b5cf6', border: 'none', borderRadius: '8px', color: '#ffffff', cursor: 'pointer', fontSize: '13px', fontWeight: '600', transition: 'all 0.2s' }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
