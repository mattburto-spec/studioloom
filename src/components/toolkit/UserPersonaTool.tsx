'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface ToolkitToolProps {
  toolId?: string;
  mode: 'public' | 'embedded' | 'standalone';
  challenge?: string;
  sessionId?: string;
  onSave?: (state: ToolState) => void;
  onComplete?: (data: ToolResponse) => void;
}

interface ToolState {
  stage: 'intro' | 'working' | 'summary';
  challenge: string;
  currentStep: number;
  ideas: Record<string, string>;
}

interface ToolResponse {
  toolId: string;
  challenge: string;
  stage: 'intro' | 'working' | 'summary';
  ideas: Record<string, string>;
  metadata: {
    totalIdeas: number;
    timeSpentMs: number;
  };
}

const SECTIONS = [
  {
    key: 'demographics',
    name: 'Demographics',
    emoji: '👤',
    color: '#8b5cf6',
    glow: 'rgba(139,92,246,0.15)',
    desc: 'Name, age, occupation, location, family status, education.',
    aiRule: 'Be specific, not generic. A real person with a real life, not a stereotype or placeholder.',
    placeholder: 'e.g., Sarah, 34, project manager at a tech startup, lives in Austin, married with two kids...',
  },
  {
    key: 'goals',
    name: 'Goals & Motivations',
    emoji: '🎯',
    color: '#f59e0b',
    glow: 'rgba(245,158,11,0.15)',
    desc: 'What do they want? What drives them? What matters to them?',
    aiRule: 'Dig deeper than surface goals. What\'s the underlying motivation? What would success look like for them?',
    placeholder: 'e.g., Wants to save time on emails but really needs to feel less overwhelmed and more in control...',
  },
  {
    key: 'frustrations',
    name: 'Frustrations & Pain Points',
    emoji: '😤',
    color: '#ef4444',
    glow: 'rgba(239,68,68,0.15)',
    desc: 'What annoys them? What fails them? What have they given up on?',
    aiRule: 'What workarounds do they use? What have they stopped trying? What makes them angry or sad?',
    placeholder: 'e.g., Workarounds for missing information, gives up on perfect inbox organization, frustrated by notifications...',
  },
  {
    key: 'daylife',
    name: 'A Day in Their Life',
    emoji: '⏰',
    color: '#06b6d4',
    glow: 'rgba(6,182,212,0.15)',
    desc: 'Walk through a typical day. When and where would they use your product?',
    aiRule: 'Describe a realistic day with specific times, tasks, and context. Where does your design fit into their routine?',
    placeholder: 'e.g., 7am wake up, 8am commute (emails), 9am-5pm meetings, 6pm pickup from school...',
  },
  {
    key: 'quote',
    name: 'Quote',
    emoji: '💬',
    color: '#10b981',
    glow: 'rgba(16,185,129,0.15)',
    desc: 'One sentence this persona would say that captures their essence.',
    aiRule: 'Make it sound like them — authentic, conversational. One sentence that reveals personality and needs.',
    placeholder: 'e.g., "I just need my inbox to not make me feel guilty all the time."',
  },
];

function assessEffort(text: string): 'low' | 'medium' | 'high' {
  const words = text.trim().split(/\s+/).length;
  const hasDetail = words >= 15;
  const hasQuotes = /"[^"]*"/.test(text) || /'[^']*'/.test(text);
  const hasSpecifics = /\b(e\.g\.|for example|such as|like|because|so|which means)\b/i.test(text);

  if (words < 8) return 'low';
  if ((hasDetail && hasQuotes) || (hasDetail && hasSpecifics)) return 'high';
  if (words >= 12 || hasQuotes || hasSpecifics) return 'medium';
  return 'low';
}

const MICRO_FEEDBACK: Record<'low' | 'medium' | 'high', { emoji: string; messages: string[] }> = {
  high: { emoji: '✦', messages: ['Authentic!', 'Great specificity!', 'Really clear!', 'Love it!'] },
  medium: { emoji: '→', messages: ['Getting there!', 'More detail?', 'Keep going!', 'Building persona!'] },
  low: { emoji: '↑', messages: ['Add more?', 'Be specific?', 'More detail?', 'Paint a picture?'] },
};

export function UserPersonaTool({
  mode = 'public',
  challenge: initialChallenge = '',
  sessionId: initialSessionId,
  onSave,
  onComplete,
}: ToolkitToolProps) {
  const [stage, setStage] = useState<'intro' | 'working' | 'summary'>(initialChallenge ? 'working' : 'intro');
  const [challenge, setChallenge] = useState(initialChallenge);
  const [currentStep, setCurrentStep] = useState(0);
  const [ideas, setIdeas] = useState<Record<string, string>>({
    demographics: '',
    goals: '',
    frustrations: '',
    daylife: '',
    quote: '',
  });
  const [sessionId] = useState(() => initialSessionId || Math.random().toString(36).slice(2) + Date.now().toString(36));
  const [microFeedback, setMicroFeedback] = useState<{ msg: string; level: 'low' | 'medium' | 'high' } | null>(null);
  const [nudge, setNudge] = useState('');
  const [nudgeLoading, setNudgeLoading] = useState(false);
  const [implications, setImplications] = useState('');
  const [loadingImplications, setLoadingImplications] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const microFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const section = SECTIONS[currentStep];

  useEffect(() => {
    if (mode !== 'public' && onSave) {
      const timer = setTimeout(() => {
        const state: ToolState = { stage, challenge, currentStep, ideas };
        onSave(state);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [stage, challenge, currentStep, ideas, mode, onSave]);

  const fetchAI = useCallback(async (body: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const res = await fetch('/api/tools/user-persona', {
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
  };

  const handleUpdateSection = (value: string) => {
    const effort = assessEffort(value);
    const feedback = MICRO_FEEDBACK[effort];

    if (effort !== 'low' && ideas[section.key] !== value) {
      setMicroFeedback({ msg: feedback.messages[Math.floor(Math.random() * feedback.messages.length)], level: effort });
      if (microFeedbackTimerRef.current) clearTimeout(microFeedbackTimerRef.current);
      microFeedbackTimerRef.current = setTimeout(() => setMicroFeedback(null), 2000);
    }

    const newIdeas = { ...ideas };
    newIdeas[section.key] = value;
    setIdeas(newIdeas);
  };

  const handleRequestNudge = async () => {
    if (nudgeLoading) return;
    setNudgeLoading(true);
    try {
      const res = await fetchAI({
        action: 'nudge',
        challenge,
        sessionId,
        section: section.name,
        currentText: ideas[section.key],
      });
      setNudge(res.nudge as string);
    } catch (error) {
      console.error('Nudge error:', error);
    } finally {
      setNudgeLoading(false);
    }
  };

  const handleNextSection = () => {
    if (currentStep < SECTIONS.length - 1) {
      setCurrentStep(currentStep + 1);
      setNudge('');
      if (inputRef.current) inputRef.current.focus();
    } else {
      generateImplications();
    }
  };

  const handlePrevSection = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setNudge('');
      if (inputRef.current) inputRef.current.focus();
    }
  };

  const generateImplications = async () => {
    setLoadingImplications(true);
    try {
      const res = await fetchAI({
        action: 'implications',
        challenge,
        sessionId,
        allSections: ideas,
      });
      setImplications(res.implications as string);
      setStage('summary');
    } catch (error) {
      console.error('Implications error:', error);
    } finally {
      setLoadingImplications(false);
    }
  };

  if (stage === 'intro') {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(to bottom right, #2a1a4a, #1a0a2e)', padding: '60px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <style>{`
          @keyframes toolFadeIn {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .tool-screen { animation: toolFadeIn 0.3s ease-out; }
        `}</style>
        <div style={{ maxWidth: '500px', width: '100%' }} className="tool-screen">
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h1 style={{ fontSize: '36px', fontWeight: 'bold', color: '#fff', marginBottom: '8px' }}>User Persona Card</h1>
            <p style={{ fontSize: '16px', color: '#d1d5db', lineHeight: '1.6' }}>Build a detailed persona for the person you're designing for.</p>
          </div>

          <div style={{ background: 'rgba(88, 28, 135, 0.2)', backdropFilter: 'blur(8px)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '12px', padding: '32px', marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#e5e7eb', marginBottom: '12px' }}>Who are you designing for?</label>
            <textarea
              value={challenge}
              onChange={(e) => setChallenge(e.target.value)}
              placeholder="e.g., Busy working parents, college students, healthcare workers, etc."
              style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(139, 92, 246, 0.5)', color: '#fff', fontSize: '14px', fontFamily: 'inherit', minHeight: '100px', resize: 'none' }}
              rows={3}
            />
            <button
              onClick={handleIntroStart}
              disabled={!challenge.trim()}
              style={{ width: '100%', marginTop: '20px', padding: '12px 20px', background: challenge.trim() ? '#8b5cf6' : '#6b7280', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: challenge.trim() ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}
            >
              Create Persona
            </button>
          </div>

          <div style={{ background: 'rgba(88, 28, 135, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '8px', padding: '20px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#e5e7eb', marginBottom: '12px' }}>What you'll create:</h3>
            <ul style={{ margin: '0', paddingLeft: '20px', fontSize: '13px', color: '#9ca3af', lineHeight: '1.6' }}>
              <li><strong>Demographics:</strong> Age, job, location, family</li>
              <li><strong>Goals:</strong> What they want to achieve</li>
              <li><strong>Frustrations:</strong> What fails them</li>
              <li><strong>Day in Life:</strong> When they'd use your design</li>
              <li><strong>Quote:</strong> One sentence that captures them</li>
              <li><strong>Design Implications:</strong> What this means for your design</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'working') {
    const sectionValue = ideas[section.key];

    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(to bottom right, #2a1a4a, #1a0a2e)', padding: '40px 24px', fontFamily: 'Inter, system-ui, sans-serif' }}>
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
            <h2 style={{ fontSize: '28px', fontWeight: 'bold', color: '#fff', marginBottom: '8px' }}>{section.emoji} {section.name}</h2>
            <p style={{ fontSize: '16px', color: '#d1d5db' }}>{section.desc}</p>
          </div>

          <div style={{ background: 'rgba(88, 28, 135, 0.2)', backdropFilter: 'blur(8px)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
            <textarea
              ref={inputRef}
              value={sectionValue}
              onChange={(e) => handleUpdateSection(e.target.value)}
              placeholder={section.placeholder}
              style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(139, 92, 246, 0.5)', color: '#fff', fontSize: '14px', fontFamily: 'inherit', minHeight: '120px', resize: 'none', marginBottom: '12px' }}
              rows={6}
            />
            <button
              onClick={handleRequestNudge}
              disabled={nudgeLoading || !sectionValue.trim()}
              style={{ padding: '10px 20px', background: nudgeLoading || !sectionValue.trim() ? '#6b7280' : '#4b5563', color: nudgeLoading || !sectionValue.trim() ? '#9ca3af' : '#e5e7eb', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: nudgeLoading || !sectionValue.trim() ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}
            >
              {nudgeLoading ? '...' : 'Get Advice'}
            </button>
          </div>

          {microFeedback && (
            <div style={{ marginBottom: '20px', padding: '12px 16px', borderRadius: '8px', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)', color: '#d8b4fe', fontSize: '13px', fontWeight: '600', animation: 'toolFadeIn 0.3s ease-out' }}>
              {microFeedback.msg}
            </div>
          )}

          {nudge && (
            <div style={{ marginBottom: '20px', padding: '12px 16px', borderRadius: '8px', background: 'rgba(55, 65, 81, 0.6)', border: '1px solid rgba(75, 85, 99, 0.3)', color: '#d1d5db', fontSize: '13px' }}>
              <strong style={{ color: '#e5e7eb' }}>Suggestion:</strong> {nudge}
            </div>
          )}

          {sectionValue && (
            <div style={{ marginBottom: '24px', fontSize: '12px', color: '#9ca3af' }}>
              <strong>{sectionValue.length}</strong> characters · <strong>{sectionValue.split(/\s+/).length}</strong> words
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
            <button
              onClick={handlePrevSection}
              disabled={currentStep === 0}
              style={{ padding: '10px 20px', background: currentStep === 0 ? '#6b7280' : '#4b5563', color: '#e5e7eb', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: currentStep === 0 ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}
            >
              ← Back
            </button>
            {currentStep < SECTIONS.length - 1 ? (
              <button
                onClick={handleNextSection}
                style={{ padding: '10px 20px', background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                Next →
              </button>
            ) : (
              <button
                onClick={handleNextSection}
                disabled={loadingImplications || !sectionValue.trim()}
                style={{ padding: '10px 20px', background: loadingImplications || !sectionValue.trim() ? '#6b7280' : '#10b981', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: loadingImplications || !sectionValue.trim() ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}
              >
                {loadingImplications ? 'Analyzing...' : 'Generate Insights'}
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
            {SECTIONS.map((s, idx) => (
              <div
                key={idx}
                style={{ height: '6px', borderRadius: '3px', transition: 'all 0.3s', background: idx === currentStep ? section.color : '#6b7280', width: idx === currentStep ? '24px' : '6px' }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(to bottom right, #2a1a4a, #1a0a2e)', padding: '40px 24px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <style>{`
        @keyframes toolFadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .tool-screen { animation: toolFadeIn 0.3s ease-out; }
      `}</style>
      <div style={{ maxWidth: '700px', margin: '0 auto' }} className="tool-screen">
        <h2 style={{ fontSize: '28px', fontWeight: 'bold', color: '#fff', marginBottom: '8px' }}>Persona Complete</h2>
        <p style={{ color: '#d1d5db', marginBottom: '32px' }}>Here's your complete user persona card.</p>

        <div style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(55, 65, 81, 0.3))', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '12px', padding: '32px', marginBottom: '32px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {SECTIONS.map((s) => (
              <div key={s.key} style={{ borderLeft: `3px solid ${s.color}`, paddingLeft: '16px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#d1d5db', marginBottom: '8px' }}>{s.emoji} {s.name}</h3>
                <p style={{ color: '#d1d5db', fontSize: '13px', lineHeight: '1.6', margin: '0', whiteSpace: 'pre-wrap' }}>{ideas[s.key] || '—'}</p>
              </div>
            ))}
          </div>
        </div>

        {implications && (
          <div style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(55, 65, 81, 0.3))', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '12px', padding: '24px', marginBottom: '32px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#d1d5db', marginBottom: '12px' }}>Design Implications</h3>
            <p style={{ color: '#d1d5db', fontSize: '13px', lineHeight: '1.6', margin: '0', whiteSpace: 'pre-wrap' }}>{implications}</p>
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => {
              setStage('working');
              setCurrentStep(0);
              setNudge('');
            }}
            style={{ padding: '10px 20px', background: '#4b5563', color: '#e5e7eb', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            ← Edit Persona
          </button>
          <button
            onClick={() => {
              if (onComplete) {
                onComplete({
                  toolId: 'user-persona',
                  challenge,
                  stage: 'summary',
                  ideas,
                  metadata: { totalIdeas: Object.values(ideas).filter(v => v).length, timeSpentMs: 0 },
                });
              }
            }}
            style={{ padding: '10px 20px', background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            Save Persona
          </button>
        </div>
      </div>
    </div>
  );
}
