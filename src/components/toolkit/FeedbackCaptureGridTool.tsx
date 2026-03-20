'use client';

import { useState, useRef } from 'react';

type StageType = 'intro' | 'working' | 'summary';
type EffortLevel = 'low' | 'medium' | 'high';
type QuadrantType = 'likes' | 'wishes' | 'questions' | 'ideas';

const QUADRANTS = {
  likes: {
    emoji: '👍',
    label: 'Likes',
    instruction: 'What works well?',
    placeholder: 'e.g., "The color is really appealing", "It feels comfortable to hold"',
    guidance: 'Be specific. What works and WHY does it work?',
    color: '#10b981',
    glow: 'rgba(16,185,129,0.15)',
  },
  wishes: {
    emoji: '✨',
    label: 'Wishes',
    instruction: 'What could be better?',
    placeholder: 'e.g., "I wish the button was easier to press", "The instructions could be clearer"',
    guidance: 'Frame as wishes, not complaints. "I wish..." is more constructive than "it sucks..."',
    color: '#f59e0b',
    glow: 'rgba(245,158,11,0.15)',
  },
  questions: {
    emoji: '❓',
    label: 'Questions',
    instruction: 'What\'s unclear?',
    placeholder: 'e.g., "How do you replace the battery?", "What\'s it made of?"',
    guidance: 'What would you need to know before using or buying this?',
    color: '#3b82f6',
    glow: 'rgba(59,130,246,0.15)',
  },
  ideas: {
    emoji: '💡',
    label: 'Ideas',
    instruction: 'What could make it even better?',
    placeholder: 'e.g., "What if it came in different colors?", "Add a light-up feature"',
    guidance: 'New ideas, features, materials, or uses. Anything they haven\'t considered.',
    color: '#8b5cf6',
    glow: 'rgba(139,92,246,0.15)',
  },
};

interface QuadrantData {
  likes: string;
  wishes: string;
  questions: string;
  ideas: string;
}

interface ToolState {
  stage: StageType;
  prototypeDescription: string;
  feedback: QuadrantData;
  currentQuadrant: QuadrantType;
  efforts: Record<QuadrantType, EffortLevel>;
}

interface ToolResponse {
  toolId: string;
  prototypeDescription: string;
  stage: StageType;
  feedback: QuadrantData;
  metadata: {
    timeSpentMs: number;
  };
}

function assessEffort(text: string): EffortLevel {
  const words = text.trim().split(/\s+/).length;
  const hasSpecifics = /\b(because|so|which|that|this|example|like|such as)\b/i.test(text);
  const hasDetail = words >= 12;

  if (words < 5) return 'low';
  if ((hasDetail && hasSpecifics) || (words >= 10 && hasSpecifics)) return 'high';
  if (words >= 8 || hasSpecifics) return 'medium';
  return 'low';
}

function getDepthInfo(effort: EffortLevel): { dots: 1 | 2 | 3; label: string; color: string } {
  if (effort === 'high') return { dots: 3, label: 'Detailed', color: '#a78bfa' };
  if (effort === 'medium') return { dots: 2, label: 'Good start', color: '#60a5fa' };
  return { dots: 1, label: 'Go deeper', color: '#f59e0b' };
}

export function FeedbackCaptureGridTool({
  toolId = 'feedback-capture-grid',
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
  const [prototypeDescription, setPrototypeDescription] = useState(initialChallenge);
  const [feedback, setFeedback] = useState<QuadrantData>({
    likes: '',
    wishes: '',
    questions: '',
    ideas: '',
  });
  const [currentQuadrant, setCurrentQuadrant] = useState<QuadrantType>('likes');
  const [efforts, setEfforts] = useState<Record<QuadrantType, EffortLevel>>({
    likes: 'low',
    wishes: 'low',
    questions: 'low',
    ideas: 'low',
  });
  const [sessionId] = useState(() => initialSessionId || Math.random().toString(36).slice(2) + Date.now().toString(36));
  const [aiSynthesis, setAiSynthesis] = useState<string>('');
  const [loadingSynthesis, setLoadingSynthesis] = useState(false);
  const [showExample, setShowExample] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const startTimeRef = useRef(Date.now());

  const quad = QUADRANTS[currentQuadrant];
  const quadValue = feedback[currentQuadrant];
  const effort = efforts[currentQuadrant];
  const depthInfo = getDepthInfo(effort);

  const handlePrototypeSubmit = (value: string) => {
    if (value.trim()) {
      setPrototypeDescription(value);
      setStage('working');
    }
  };

  const handleQuadrantInput = (quadrant: QuadrantType, value: string) => {
    const newEffort = assessEffort(value);
    const newEfforts = { ...efforts };
    newEfforts[quadrant] = newEffort;
    setEfforts(newEfforts);

    const newFeedback = { ...feedback };
    newFeedback[quadrant] = value;
    setFeedback(newFeedback);

    if (value.trim()) {
      const messages: Record<EffortLevel, string> = {
        low: 'Add more detail',
        medium: 'Good — keep going!',
        high: 'Thoughtful feedback!',
      };
      setToastMessage(messages[newEffort]);
      setTimeout(() => setToastMessage(''), 3000);
    }
  };

  const handleGenerateSynthesis = async () => {
    const filled = Object.values(feedback).filter((f) => f.trim()).length;
    if (filled < 2) {
      setAiSynthesis('Please fill in at least 2 quadrants before generating synthesis.');
      return;
    }

    setLoadingSynthesis(true);
    try {
      const response = await fetch('/api/tools/feedback-capture-grid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'synthesize',
          sessionId,
          prototypeDescription,
          feedback,
        }),
      });

      if (!response.ok) throw new Error('Failed to get AI synthesis');
      const data = await response.json();
      setAiSynthesis(data.synthesis || '');
    } catch (error) {
      setAiSynthesis('Could not generate synthesis. Try again.');
      console.error(error);
    } finally {
      setLoadingSynthesis(false);
    }
  };

  const handleComplete = () => {
    const timeSpent = Date.now() - startTimeRef.current;
    const response: ToolResponse = {
      toolId,
      prototypeDescription,
      stage,
      feedback,
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
          <h1 style={{ fontSize: '36px', marginBottom: '20px', textAlign: 'center', fontWeight: 'bold' }}>Feedback Capture Grid</h1>
          <p style={{ fontSize: '16px', color: '#d0d0d0', marginBottom: '40px', textAlign: 'center', lineHeight: '1.6' }}>
            Collect feedback in four quadrants: what works, what could improve, what's unclear, and new ideas.
          </p>
          <p style={{ fontSize: '14px', color: '#a0a0a0', marginBottom: '30px', fontStyle: 'italic', textAlign: 'center' }}>
            Structured feedback is more useful than "it's nice." Tell me specifically.
          </p>
          <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '12px', padding: '30px', marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '15px', fontSize: '14px', fontWeight: '600' }}>
              What are you getting feedback on?
            </label>
            <textarea
              placeholder="e.g., 'A water bottle prototype', 'A website redesign', 'My app wireframes'"
              value={prototypeDescription}
              onChange={(e) => setPrototypeDescription(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.5)', background: 'rgba(0,0,0,0.3)', color: '#ffffff', fontSize: '14px', fontFamily: 'inherit', minHeight: '100px', resize: 'none' }}
            />
            <button
              onClick={() => handlePrototypeSubmit(prototypeDescription)}
              style={{ width: '100%', padding: '12px 20px', marginTop: '20px', background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', transition: 'all 0.2s' }}
            >
              Start Gathering Feedback
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
        <div style={{ maxWidth: '900px', margin: '0 auto' }} className="tool-screen">
          <div style={{ marginBottom: '40px' }}>
            <p style={{ fontSize: '12px', color: '#a0a0a0', marginBottom: '8px', fontWeight: '600' }}>FEEDBACK ON</p>
            <h2 style={{ fontSize: '24px', margin: '0', fontWeight: 'bold' }}>{prototypeDescription}</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '40px' }}>
            {(Object.keys(QUADRANTS) as QuadrantType[]).map((key) => {
              const q = QUADRANTS[key];
              const isActive = currentQuadrant === key;
              return (
                <button
                  key={key}
                  onClick={() => setCurrentQuadrant(key)}
                  style={{ padding: '20px', background: isActive ? q.color : 'rgba(139,92,246,0.2)', border: `2px solid ${isActive ? q.color : 'transparent'}`, borderRadius: '12px', color: '#ffffff', cursor: 'pointer', fontSize: '14px', fontWeight: '600', transition: 'all 0.2s', textAlign: 'left' }}
                >
                  <div style={{ fontSize: '20px', marginBottom: '8px' }}>{q.emoji}</div>
                  {q.label}
                </button>
              );
            })}
          </div>

          <div style={{ background: `linear-gradient(135deg, ${quad.glow} 0%, rgba(139,92,246,0.05) 100%)`, border: `1px solid ${quad.color}33`, borderRadius: '12px', padding: '30px', marginBottom: '40px', animation: 'toolFadeIn 0.3s ease-out' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '10px', fontWeight: 'bold' }}>
              {quad.emoji} {quad.label}
            </h3>
            <p style={{ fontSize: '14px', color: '#d0d0d0', marginBottom: '20px' }}>
              {quad.instruction}
            </p>

            <textarea
              placeholder={quad.placeholder}
              value={quadValue}
              onChange={(e) => handleQuadrantInput(currentQuadrant, e.target.value)}
              style={{ width: '100%', padding: '14px', borderRadius: '8px', border: `1px solid ${quad.color}66`, background: 'rgba(0,0,0,0.4)', color: '#ffffff', fontSize: '14px', fontFamily: 'inherit', minHeight: '140px', resize: 'none', marginBottom: '15px' }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <p style={{ fontSize: '12px', color: '#a0a0a0', margin: '0' }}>
                {quad.guidance}
              </p>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    style={{ width: '8px', height: '8px', borderRadius: '50%', background: i < depthInfo.dots ? quad.color : 'rgba(139,92,246,0.2)' }}
                  />
                ))}
              </div>
            </div>

            <button
              onClick={() => setShowExample(!showExample)}
              style={{ background: 'none', border: 'none', color: quad.color, cursor: 'pointer', fontSize: '12px', fontWeight: '600', padding: '0', textAlign: 'left' }}
            >
              {showExample ? '▼ Hide example' : '▶ See an example'}
            </button>

            {showExample && (
              <div style={{ background: 'rgba(139,92,246,0.1)', border: `1px solid ${quad.color}44`, borderRadius: '8px', padding: '12px', marginTop: '12px', fontSize: '13px', color: '#e0e0e0' }}>
                {quad.placeholder}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between', marginBottom: '40px' }}>
            <button
              onClick={() => {
                const keys: QuadrantType[] = ['likes', 'wishes', 'questions', 'ideas'];
                const currentIndex = keys.indexOf(currentQuadrant);
                if (currentIndex > 0) {
                  setCurrentQuadrant(keys[currentIndex - 1]);
                }
              }}
              disabled={currentQuadrant === 'likes'}
              style={{ padding: '10px 16px', background: currentQuadrant === 'likes' ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.4)', border: 'none', borderRadius: '8px', color: '#ffffff', cursor: currentQuadrant === 'likes' ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: '600', transition: 'all 0.2s' }}
            >
              ← Back
            </button>
            <button
              onClick={() => {
                const keys: QuadrantType[] = ['likes', 'wishes', 'questions', 'ideas'];
                const currentIndex = keys.indexOf(currentQuadrant);
                if (currentIndex < keys.length - 1) {
                  setCurrentQuadrant(keys[currentIndex + 1]);
                }
              }}
              disabled={currentQuadrant === 'ideas'}
              style={{ padding: '10px 16px', background: currentQuadrant === 'ideas' ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.4)', border: 'none', borderRadius: '8px', color: '#ffffff', cursor: currentQuadrant === 'ideas' ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: '600', transition: 'all 0.2s' }}
            >
              Next →
            </button>
          </div>

          {Object.values(feedback).filter((f) => f.trim()).length >= 2 && (
            <button
              onClick={() => {
                handleGenerateSynthesis();
                setStage('summary');
              }}
              style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)', color: '#ffffff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', marginBottom: '20px', transition: 'all 0.2s' }}
            >
              See Summary
            </button>
          )}
        </div>

        {toastMessage && (
          <div style={{ position: 'fixed', bottom: '20px', right: '20px', background: 'rgba(16,185,129,0.9)', color: '#ffffff', padding: '12px 20px', borderRadius: '8px', fontSize: '13px', animation: 'toolFadeIn 0.2s ease-in' }}>
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
        <div style={{ maxWidth: '900px', margin: '0 auto' }} className="tool-screen">
          <h1 style={{ fontSize: '28px', marginBottom: '10px', textAlign: 'center', fontWeight: 'bold' }}>Feedback Summary</h1>
          <p style={{ fontSize: '14px', color: '#a0a0a0', marginBottom: '40px', textAlign: 'center' }}>
            Your feedback grid and AI-synthesized action items:
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '40px' }}>
            {(Object.entries(QUADRANTS) as Array<[QuadrantType, typeof QUADRANTS['likes']]>).map(([key, q]) => (
              <div
                key={key}
                style={{ background: `linear-gradient(135deg, ${q.glow} 0%, rgba(139,92,246,0.05) 100%)`, border: `2px solid ${q.color}33`, borderRadius: '12px', padding: '20px' }}
              >
                <h3 style={{ fontSize: '14px', color: q.color, marginBottom: '12px', fontWeight: '600' }}>
                  {q.emoji} {q.label.toUpperCase()}
                </h3>
                <p style={{ fontSize: '13px', color: '#e0e0e0', lineHeight: '1.6', margin: '0' }}>
                  {feedback[key] || '(none)'}
                </p>
              </div>
            ))}
          </div>

          <div style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.4)', borderRadius: '12px', padding: '20px', marginBottom: '30px' }}>
            <h3 style={{ fontSize: '14px', marginBottom: '12px', color: '#8b5cf6', fontWeight: '600' }}>Top 3 Action Items</h3>
            {loadingSynthesis ? (
              <p style={{ fontSize: '13px', color: '#a0a0a0', margin: '0' }}>Synthesizing feedback...</p>
            ) : (
              <p style={{ fontSize: '13px', color: '#e0e0e0', lineHeight: '1.6', margin: '0' }}>
                {aiSynthesis}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={() => setStage('working')}
              style={{ padding: '12px 24px', background: 'rgba(16,185,129,0.3)', border: '1px solid rgba(16,185,129,0.6)', borderRadius: '8px', color: '#ffffff', cursor: 'pointer', fontSize: '13px', fontWeight: '600', transition: 'all 0.2s' }}
            >
              Edit
            </button>
            <button
              onClick={handleComplete}
              style={{ padding: '12px 24px', background: '#10b981', border: 'none', borderRadius: '8px', color: '#ffffff', cursor: 'pointer', fontSize: '13px', fontWeight: '600', transition: 'all 0.2s' }}
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
