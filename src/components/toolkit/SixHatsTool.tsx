'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useToolSession } from '@/hooks/useToolSession';

interface ToolkitToolProps {
  toolId?: string;
  mode: 'public' | 'embedded' | 'standalone';
  challenge?: string;
  sessionId?: string;
  studentId?: string;
  unitId?: string;
  pageId?: string;
  onSave?: (state: ToolState) => void;
  onComplete?: (data: ToolResponse) => void;
}

interface ToolState {
  stage: 'intro' | 'working' | 'summary';
  challenge: string;
  currentHat: number;
  ideas: string[][];
  ideaEfforts: Record<number, EffortLevel[]>;
}

interface ToolResponse {
  toolId: string;
  challenge: string;
  stage: 'intro' | 'working' | 'summary';
  ideas: string[][];
  metadata: {
    totalIdeas: number;
    timeSpentMs: number;
  };
}

type EffortLevel = 'low' | 'medium' | 'high';

const HATS = [
  {
    color: 'White',
    emoji: '⬜',
    hatColor: '#94a3b8',
    glow: 'rgba(148,163,184,0.15)',
    focus: 'Facts & Information',
    desc: 'What do you know? What data, facts, and information do you have — and what do you still need to find out?',
    fallbackPrompts: [
      'What facts do you already know about this challenge?',
      'What data or research would help you understand this better?',
      'What assumptions are you making that haven\'t been verified?',
      'What information is missing that you\'d need before deciding?',
    ],
    example: 'We know 60% of students walk to school. We don\'t know how many carry heavy bags. We need data on average backpack weight.',
    verb: 'gathering facts and data about',
  },
  {
    color: 'Red',
    emoji: '🟥',
    hatColor: '#ef4444',
    glow: 'rgba(239,68,68,0.15)',
    focus: 'Feelings & Intuitions',
    desc: 'What\'s your gut feeling? What emotions come up? Feelings don\'t need justification here — just honesty.',
    fallbackPrompts: [
      'What\'s your first emotional reaction to this challenge?',
      'What excites you most about solving this?',
      'What worries or frustrates you about it?',
      'How would users emotionally respond to your ideas so far?',
    ],
    example: 'I feel excited about the creativity, but nervous about the deadline. Users might feel frustrated by the current design.',
    verb: 'exploring feelings and intuitions about',
  },
  {
    color: 'Black',
    emoji: '⬛',
    hatColor: '#334155',
    glow: 'rgba(51,65,85,0.15)',
    focus: 'Critical Analysis',
    desc: 'What could go wrong? What are the weaknesses, flaws, and risks? Focus on problems, not solutions.',
    fallbackPrompts: [
      'What are the biggest risks with this approach?',
      'Where might this idea fail or break down?',
      'What\'s the worst-case scenario if this doesn\'t work?',
      'Who might this idea disadvantage or harm?',
    ],
    example: 'This design ignores accessibility — users with visual impairments won\'t be able to use it.',
    verb: 'analysing risks and problems with',
  },
  {
    color: 'Yellow',
    emoji: '🟨',
    hatColor: '#eab308',
    glow: 'rgba(234,179,8,0.15)',
    focus: 'Optimistic Thinking',
    desc: 'What are the benefits? What\'s the best-case scenario? Why will this work? Be positive and opportunistic.',
    fallbackPrompts: [
      'What\'s the biggest benefit of this idea?',
      'Who would be positively impacted by this?',
      'What new possibilities does this open up?',
      'How could this solve multiple problems at once?',
    ],
    example: 'This could reduce study time by 40%, free up time for sports and hobbies, and boost student confidence.',
    verb: 'exploring opportunities with',
  },
  {
    color: 'Green',
    emoji: '🟩',
    hatColor: '#10b981',
    glow: 'rgba(16,185,129,0.15)',
    focus: 'Creativity & Possibilities',
    desc: 'What if? Let\'s generate ideas, alternatives, and new directions. Anything goes — be imaginative.',
    fallbackPrompts: [
      'What are completely different approaches to this problem?',
      'What if you removed the biggest constraint?',
      'How would someone from a different field solve this?',
      'What wildly creative idea would no one else think of?',
    ],
    example: 'What if students could vote on which assignments to complete, or design their own learning path?',
    verb: 'generating creative alternatives for',
  },
  {
    color: 'Blue',
    emoji: '🔵',
    hatColor: '#3b82f6',
    glow: 'rgba(59,130,246,0.15)',
    focus: 'Process Control',
    desc: 'How do we proceed? What\'s the big picture? Let\'s stay organized, manage the thinking process, and focus.',
    fallbackPrompts: [
      'What\'s the most important thing to focus on right now?',
      'What are the next three steps we should take?',
      'How have we used each color hat so far? What\'s missing?',
      'What question should we explore next?',
    ],
    example: 'We\'ve done a lot of creative thinking. Now we need to focus on feasibility — which ideas can we actually build?',
    verb: 'organizing and directing our thinking about',
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

export function SixHatsTool({
  mode = 'public',
  challenge: initialChallenge = '',
  sessionId: initialSessionId,
  studentId,
  unitId,
  pageId,
  onSave,
  onComplete,
}: ToolkitToolProps) {
  const [stage, setStage] = useState<'intro' | 'working' | 'summary'>(
    initialChallenge ? 'working' : 'intro'
  );
  const [challenge, setChallenge] = useState(initialChallenge);
  const [currentHat, setCurrentHat] = useState(0);
  const [ideas, setIdeas] = useState<string[][]>(() => HATS.map(() => []));
  const [currentIdea, setCurrentIdea] = useState('');

  const [sessionId] = useState(() => initialSessionId || Math.random().toString(36).slice(2) + Date.now().toString(36));
  const [microFeedback, setMicroFeedback] = useState<{ effort: EffortLevel; message: string } | null>(null);
  const [ideaEfforts, setIdeaEfforts] = useState<Record<number, EffortLevel[]>>({});
  const [nudge, setNudge] = useState('');
  const [nudgeLoading, setNudgeLoading] = useState(false);
  const [insights, setInsights] = useState('');
  const [loadingInsights, setLoadingInsights] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const challengeRef = useRef<HTMLTextAreaElement>(null);
  const microFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tool session persistence (gracefully disabled in public mode)
  const { session, updateState: updateToolSession } = useToolSession({
    toolId: 'six-thinking-hats',
    studentId,
    mode: mode === 'public' ? 'standalone' : (mode as 'embedded' | 'standalone'),
    challenge: initialChallenge,
    unitId,
    pageId,
  });

  const hat = HATS[currentHat];
  const totalIdeas = ideas.reduce((sum, arr) => sum + arr.length, 0);

  useEffect(() => {
    if (mode !== 'public' && onSave) {
      const timer = setTimeout(() => {
        const state: ToolState = { stage, challenge, currentHat, ideas, ideaEfforts };
        onSave(state);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [stage, challenge, currentHat, ideas, ideaEfforts, mode, onSave]);

  // Sync state to useToolSession for persistence
  useEffect(() => {
    const state = { stage, challenge, currentHat, ideas, ideaEfforts };
    updateToolSession(state);
  }, [stage, challenge, currentHat, ideas, ideaEfforts, updateToolSession]);

  const fetchAI = useCallback(async (body: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const res = await fetch('/api/tools/six-hats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }, []);

  useEffect(() => {
    if (stage === 'working' && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 350);
    }
  }, [currentHat, stage]);

  useEffect(() => {
    if (stage === 'intro' && challengeRef.current) {
      setTimeout(() => challengeRef.current?.focus(), 500);
    }
  }, [stage]);

  useEffect(() => {
    if (stage === 'summary' && !insights && totalIdeas > 0) {
      setLoadingInsights(true);
      fetchAI({
        action: 'insights',
        challenge,
        allIdeas: HATS.map((h, i) => ({ hat: h.color, ideas: ideas[i] })),
      }).then((data) => {
        if (data.insights) setInsights(data.insights as string);
      }).catch(() => {})
      .finally(() => setLoadingInsights(false));
    }
  }, [stage]);

  const addIdea = useCallback(() => {
    if (!currentIdea.trim()) return;
    const newIdea = currentIdea.trim();
    const effort = assessEffort(newIdea);

    setIdeas(prev => {
      const next = [...prev];
      next[currentHat] = [...next[currentHat], newIdea];
      return next;
    });

    setIdeaEfforts(prev => ({
      ...prev,
      [currentHat]: [...(prev[currentHat] || []), effort],
    }));

    const feedbackPool = MICRO_FEEDBACK[effort];
    const message = feedbackPool.messages[Math.floor(Math.random() * feedbackPool.messages.length)];
    setMicroFeedback({ effort, message });

    if (microFeedbackTimerRef.current) clearTimeout(microFeedbackTimerRef.current);
    microFeedbackTimerRef.current = setTimeout(() => setMicroFeedback(null), 3000);

    setCurrentIdea('');
    setNudge('');
    textareaRef.current?.focus();

    // Fetch AI nudge
    fetchAI({
      action: 'nudge',
      challenge,
      hat: hat.color,
      hatRules: hat.verb,
      idea: newIdea,
      effortLevel: effort,
      previousIdeas: ideas[currentHat],
      ideaCount: ideas[currentHat].length + 1,
    }).then((data) => {
      if (data.nudge) {
        setNudge(data.nudge as string);
      }
    }).catch(() => {});
  }, [currentIdea, currentHat, challenge, hat, ideas, fetchAI]);

  const goToHat = (idx: number) => {
    if (idx === currentHat) return;
    setCurrentHat(idx);
    setCurrentIdea('');
    setNudge('');
  };

  const nextHat = () => {
    if (currentHat < 5) goToHat(currentHat + 1);
    else {
      setInsights('');
      setStage('summary');
      if (onComplete) {
        onComplete({
          toolId: 'six-thinking-hats',
          challenge,
          stage: 'summary',
          ideas,
          metadata: { totalIdeas, timeSpentMs: 0 },
        });
      }
    }
  };

  const prevHat = () => {
    if (currentHat > 0) goToHat(currentHat - 1);
  };

  const startOver = () => {
    setStage('intro');
    setChallenge('');
    setCurrentHat(0);
    setIdeas(HATS.map(() => []));
    setCurrentIdea('');
    setNudge('');
    setInsights('');
    setIdeaEfforts({});
    setMicroFeedback(null);
  };

  const handlePrint = () => window.print();

  if (stage === 'intro') {
    return (
      <div style={{
        background: '#06060f',
        color: '#e8eaf0',
        minHeight: '100vh',
        fontFamily: 'Inter, -apple-system, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        position: 'relative',
        overflow: 'hidden',
      }}>
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
        <style>{`
          @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
          @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
          @media print { .no-print { display: none !important; } }
        `}</style>

        <div style={{
          display: 'flex',
          gap: 'clamp(8px, 2vw, 20px)',
          marginBottom: '48px',
          animation: 'float 6s ease-in-out infinite',
        }}>
          {HATS.map((h) => (
            <div key={h.color} style={{
              width: 'clamp(40px, 8vw, 64px)',
              height: 'clamp(40px, 8vw, 64px)',
              borderRadius: '16px',
              background: `linear-gradient(135deg, ${h.hatColor}20, ${h.hatColor}08)`,
              border: `2px solid ${h.hatColor}40`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 'clamp(20px, 5vw, 36px)',
            }}>
              {h.emoji}
            </div>
          ))}
        </div>

        <h1 style={{
          fontSize: 'clamp(32px, 8vw, 56px)',
          fontWeight: '700',
          marginBottom: '16px',
          textAlign: 'center',
          animation: 'fadeInUp 0.8s ease-out',
        }}>
          Six Thinking Hats
        </h1>

        <p style={{
          fontSize: 'clamp(16px, 3vw, 20px)',
          color: '#a8aac4',
          marginBottom: '48px',
          maxWidth: '500px',
          textAlign: 'center',
          animation: 'fadeInUp 0.8s ease-out 0.1s both',
        }}>
          Look at a problem from six different perspectives. Think with clarity and focus.
        </p>

        <div style={{
          width: '100%',
          maxWidth: '500px',
          marginBottom: '32px',
          animation: 'fadeInUp 0.8s ease-out 0.2s both',
        }}>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '600',
            color: '#d8dce6',
            marginBottom: '12px',
          }}>
            What are you thinking about?
          </label>
          <textarea
            ref={challengeRef}
            value={challenge}
            onChange={(e) => setChallenge(e.target.value)}
            placeholder="E.g., How to make our school more sustainable..."
            style={{
              width: '100%',
              padding: '16px',
              fontSize: '16px',
              fontFamily: 'inherit',
              borderRadius: '12px',
              border: '2px solid #2a2d3a',
              background: '#0f1119',
              color: '#e8eaf0',
              resize: 'vertical',
              minHeight: '120px',
              transition: 'border-color 0.3s, box-shadow 0.3s',
            }}
            onFocus={(e) => {
              (e.currentTarget as HTMLTextAreaElement).style.borderColor = '#3b82f6';
              (e.currentTarget as HTMLTextAreaElement).style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)';
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLTextAreaElement).style.borderColor = '#2a2d3a';
              (e.currentTarget as HTMLTextAreaElement).style.boxShadow = 'none';
            }}
          />
        </div>

        <button
          onClick={() => setStage('working')}
          disabled={!challenge.trim()}
          style={{
            padding: '14px 40px',
            fontSize: '16px',
            fontWeight: '600',
            borderRadius: '10px',
            border: 'none',
            background: challenge.trim() ? '#3b82f6' : '#5a5d6f',
            color: '#fff',
            cursor: challenge.trim() ? 'pointer' : 'not-allowed',
            transition: 'all 0.3s',
            animation: 'fadeInUp 0.8s ease-out 0.3s both',
          }}
          onMouseEnter={(e) => {
            if (challenge.trim()) {
              (e.currentTarget as HTMLButtonElement).style.background = '#2563eb';
            }
          }}
          onMouseLeave={(e) => {
            if (challenge.trim()) {
              (e.currentTarget as HTMLButtonElement).style.background = '#3b82f6';
            }
          }}
        >
          Start Thinking →
        </button>
      </div>
    );
  }

  if (stage === 'working') {
    return (
      <div style={{
        background: '#06060f',
        color: '#e8eaf0',
        minHeight: '100vh',
        fontFamily: 'Inter, -apple-system, sans-serif',
        padding: '40px 24px',
      }}>
        <style>{`
          @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
          @media print { .no-print { display: none !important; } }
        `}</style>

        <div className="no-print" style={{ maxWidth: '800px', margin: '0 auto', marginBottom: '40px' }}>
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '32px',
            flexWrap: 'wrap',
          }}>
            {HATS.map((h, idx) => (
              <button
                key={idx}
                onClick={() => goToHat(idx)}
                style={{
                  padding: '10px 16px',
                  fontSize: '13px',
                  fontWeight: '600',
                  borderRadius: '8px',
                  border: '2px solid',
                  borderColor: idx === currentHat ? h.hatColor : '#2a2d3a',
                  background: idx === currentHat ? `${h.hatColor}20` : 'transparent',
                  color: idx === currentHat ? h.hatColor : '#a8aac4',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                }}
              >
                {h.emoji} {h.color}
              </button>
            ))}
          </div>

          <div style={{ marginBottom: '32px' }}>
            <h2 style={{
              fontSize: '28px',
              fontWeight: '700',
              marginBottom: '12px',
              color: hat.hatColor,
            }}>
              {hat.color} Hat: {hat.focus}
            </h2>
            <p style={{
              fontSize: '16px',
              color: '#a8aac4',
              lineHeight: '1.6',
            }}>
              {hat.desc}
            </p>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <textarea
              ref={textareaRef}
              value={currentIdea}
              onChange={(e) => setCurrentIdea(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.ctrlKey) addIdea();
              }}
              placeholder="Share your thoughts..."
              style={{
                width: '100%',
                padding: '16px',
                fontSize: '16px',
                fontFamily: 'inherit',
                borderRadius: '12px',
                border: '2px solid #2a2d3a',
                background: '#0f1119',
                color: '#e8eaf0',
                resize: 'vertical',
                minHeight: '100px',
                transition: 'all 0.3s',
              }}
              onFocus={(e) => {
                (e.currentTarget as HTMLTextAreaElement).style.borderColor = hat.hatColor;
              }}
              onBlur={(e) => {
                (e.currentTarget as HTMLTextAreaElement).style.borderColor = '#2a2d3a';
              }}
            />
          </div>

          <button
            onClick={addIdea}
            disabled={!currentIdea.trim()}
            style={{
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: '600',
              borderRadius: '8px',
              border: 'none',
              background: currentIdea.trim() ? hat.hatColor : '#5a5d6f',
              color: '#fff',
              cursor: currentIdea.trim() ? 'pointer' : 'not-allowed',
              marginBottom: '24px',
            }}
          >
            Add Idea
          </button>

          {(ideas[currentHat] || []).length > 0 && (
            <div style={{
              marginBottom: '32px',
              padding: '20px',
              borderRadius: '12px',
              background: '#0f1119',
              border: `2px solid ${hat.hatColor}20`,
            }}>
              <h3 style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#a8aac4',
                marginBottom: '16px',
              }}>
                Your Ideas ({ideas[currentHat].length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {ideas[currentHat].map((idea, idx) => (
                  <div key={idx} style={{
                    padding: '12px',
                    borderRadius: '8px',
                    background: '#1a1d2a',
                    border: `1px solid ${hat.hatColor}30`,
                  }}>
                    <p style={{
                      fontSize: '14px',
                      color: '#e8eaf0',
                      margin: 0,
                      lineHeight: '1.5',
                    }}>
                      {idea}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {microFeedback && (
            <div style={{
              position: 'fixed',
              bottom: '40px',
              right: '24px',
              padding: '14px 20px',
              borderRadius: '24px',
              background: microFeedback.effort === 'high' ? '#a78bfa' : microFeedback.effort === 'medium' ? '#60a5fa' : '#f59e0b',
              color: '#fff',
              fontWeight: '600',
              fontSize: '14px',
              boxShadow: '0 8px 16px rgba(0,0,0,0.4)',
              zIndex: 50,
            }}>
              {MICRO_FEEDBACK[microFeedback.effort].emoji} {microFeedback.message}
            </div>
          )}
        </div>

        <div className="no-print" style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'center',
          maxWidth: '800px',
          margin: '0 auto',
        }}>
          <button
            onClick={prevHat}
            disabled={currentHat === 0}
            style={{
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: '600',
              borderRadius: '8px',
              border: 'none',
              background: currentHat === 0 ? '#5a5d6f' : '#2a2d3a',
              color: '#e8eaf0',
              cursor: currentHat === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            ← Back
          </button>

          <button
            onClick={nextHat}
            style={{
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: '600',
              borderRadius: '8px',
              border: 'none',
              background: hat.hatColor,
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            {currentHat === 5 ? 'Finish →' : 'Next →'}
          </button>

          <button
            onClick={handlePrint}
            style={{
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: '600',
              borderRadius: '8px',
              border: 'none',
              background: '#2a2d3a',
              color: '#e8eaf0',
              cursor: 'pointer',
            }}
          >
            Print
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: '#06060f',
      color: '#e8eaf0',
      minHeight: '100vh',
      fontFamily: 'Inter, -apple-system, sans-serif',
      padding: '40px 24px',
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h2 style={{
          fontSize: '32px',
          fontWeight: '700',
          marginBottom: '24px',
          textAlign: 'center',
        }}>
          Six Hats Summary
        </h2>

        <p style={{
          fontSize: '16px',
          color: '#a8aac4',
          marginBottom: '32px',
          textAlign: 'center',
        }}>
          Challenge: <strong style={{ color: '#e8eaf0' }}>{challenge}</strong>
        </p>

        {(() => {
          const hatCounts = ideas.map(h => h.length);
          const maxCount = Math.max(...hatCounts);
          const hasImbalance = hatCounts.some((count, idx) => count > 0 && count < maxCount * 0.25);
          const imbalanceHat = HATS.findIndex((_, idx) => hatCounts[idx] > 0 && hatCounts[idx] < maxCount * 0.25);

          return (
            <div style={{
              padding: '24px',
              borderRadius: '12px',
              background: '#0f1119',
              border: '2px solid #3b82f640',
              marginBottom: '32px',
            }}>
              <h3 style={{
                fontSize: '16px',
                fontWeight: '700',
                color: '#3b82f6',
                marginTop: 0,
                marginBottom: '16px',
              }}>
                Thinking Balance
              </h3>

              <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {HATS.map((hat, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '70px', fontSize: '12px', fontWeight: '600', color: '#a8aac4' }}>
                      {hat.emoji} {hat.color}
                    </div>
                    <div style={{
                      flex: 1,
                      height: '24px',
                      background: '#1a1d2a',
                      borderRadius: '6px',
                      overflow: 'hidden',
                      border: `1px solid ${hat.hatColor}30`,
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${maxCount > 0 ? (ideas[idx].length / maxCount) * 100 : 0}%`,
                        background: hat.hatColor,
                        transition: 'width 0.3s ease',
                      }} />
                    </div>
                    <div style={{ width: '30px', fontSize: '12px', fontWeight: '600', color: '#a8aac4', textAlign: 'right' }}>
                      {ideas[idx].length}
                    </div>
                  </div>
                ))}
              </div>

              {hasImbalance && imbalanceHat >= 0 && (
                <div style={{
                  padding: '12px',
                  borderRadius: '8px',
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  fontSize: '13px',
                  color: '#fbbf24',
                  lineHeight: '1.5',
                }}>
                  💡 You wrote <strong>{hatCounts[imbalanceHat]}</strong> {HATS[imbalanceHat].color} idea{hatCounts[imbalanceHat] !== 1 ? 's' : ''} but <strong>{maxCount}</strong> {HATS[hatCounts.indexOf(maxCount)].color} — consider more {imbalanceHat === 2 ? 'critical thinking' : imbalanceHat === 0 ? 'fact-finding' : 'creative ideas'}.
                </div>
              )}
            </div>
          );
        })()}

        {HATS.map((h, hatIdx) => (
          ideas[hatIdx] && ideas[hatIdx].length > 0 && (
            <div key={hatIdx} style={{ marginBottom: '32px' }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '700',
                color: h.hatColor,
                marginBottom: '16px',
              }}>
                {h.emoji} {h.color} Hat ({ideas[hatIdx].length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {ideas[hatIdx].map((idea, ideaIdx) => (
                  <div key={ideaIdx} style={{
                    padding: '12px',
                    borderRadius: '8px',
                    background: '#0f1119',
                    border: `2px solid ${h.hatColor}40`,
                    lineHeight: '1.6',
                    color: '#e8eaf0',
                  }}>
                    {idea}
                  </div>
                ))}
              </div>
            </div>
          )
        ))}

        <div style={{
          padding: '20px',
          borderRadius: '12px',
          background: '#0f1119',
          border: '2px solid #3b82f620',
          marginBottom: '32px',
          textAlign: 'center',
        }}>
          <p style={{
            fontSize: '18px',
            fontWeight: '700',
            color: '#3b82f6',
            margin: 0,
          }}>
            Total Ideas: {totalIdeas}
          </p>
        </div>

        {insights && (
          <div style={{
            padding: '20px',
            borderRadius: '12px',
            background: '#0f1119',
            border: '2px solid #8b5cf640',
            marginBottom: '32px',
            lineHeight: '1.8',
            color: '#d8dce6',
          }}>
            <h4 style={{ color: '#8b5cf6', marginTop: 0 }}>AI Insights</h4>
            {insights}
          </div>
        )}

        {loadingInsights && (
          <p style={{ color: '#a8aac4', textAlign: 'center' }}>Generating insights...</p>
        )}

        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'center',
        }}>
          <button
            onClick={startOver}
            style={{
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: '600',
              borderRadius: '8px',
              border: 'none',
              background: '#2a2d3a',
              color: '#e8eaf0',
              cursor: 'pointer',
            }}
          >
            Start Over
          </button>

          <button
            onClick={handlePrint}
            style={{
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: '600',
              borderRadius: '8px',
              border: 'none',
              background: '#3b82f6',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Print Results
          </button>
        </div>
      </div>
    </div>
  );
}
