'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useToolSession } from '@/hooks/useToolSession';
import { assessEffort as sharedAssessEffort, getRandomMicroFeedback, type ELLTier } from '@/lib/toolkit';

const STEPS = [
  {
    letter: 'S',
    word: 'Substitute',
    color: '#6366f1',
    glow: 'rgba(99,102,241,0.15)',
    desc: 'What components, materials, people, or processes could you swap out for something else?',
    fallbackPrompts: [
      'What materials or resources could you swap?',
      'Can you replace one part with a different one?',
      'What if you used a different process or method?',
      'Could a different person or group be involved?',
    ],
    example: 'Instead of wood, what if you used recycled plastic? Instead of buttons, what about gesture controls?',
    icon: '⇄',
  },
  {
    letter: 'C',
    word: 'Combine',
    color: '#8b5cf6',
    glow: 'rgba(139,92,246,0.15)',
    desc: 'What ideas, features, or elements could you merge together to create something new?',
    fallbackPrompts: [
      'Can you merge two features into one?',
      'What if you combined this with another product?',
      'Could you blend different materials or ideas?',
      'What happens if you mix purposes?',
    ],
    example: 'A phone + camera + GPS = smartphone. A chair + storage = ottoman with compartments.',
    icon: '⊕',
  },
  {
    letter: 'A',
    word: 'Adapt',
    color: '#a855f7',
    glow: 'rgba(168,85,247,0.15)',
    desc: 'What could you copy, borrow, or adapt from elsewhere? What else is like this?',
    fallbackPrompts: [
      'What idea from another field could you borrow?',
      'How has this problem been solved in nature?',
      'What existing solution could you tweak to fit?',
      'What if you adapted this for a different audience?',
    ],
    example: 'Velcro was adapted from burrs sticking to dog fur. Bullet trains adapted their nose shape from kingfisher beaks.',
    icon: '↻',
  },
  {
    letter: 'M',
    word: 'Modify',
    color: '#d946ef',
    glow: 'rgba(217,70,239,0.15)',
    desc: 'What could you make bigger, smaller, stronger, lighter, or change in shape, colour, or form?',
    fallbackPrompts: [
      'What if you made it twice as big? Half as small?',
      'Can you change the shape, colour, or texture?',
      'What if you exaggerated one feature?',
      'Could you make it stronger, lighter, or faster?',
    ],
    example: 'Making a phone thinner led to new battery tech. Exaggerating a shoe sole created platform sneakers.',
    icon: '◇',
  },
  {
    letter: 'P',
    word: 'Put to other use',
    color: '#ec4899',
    glow: 'rgba(236,72,153,0.15)',
    desc: 'What else could this be used for? In a new context, who else might find it valuable?',
    fallbackPrompts: [
      'Who else could benefit from this?',
      'What if you used it in a completely different context?',
      'Could the waste or by-product be useful?',
      'What other problem does this accidentally solve?',
    ],
    example: 'Bubble wrap was originally sold as textured wallpaper. Play-Doh started as wallpaper cleaner.',
    icon: '↗',
  },
  {
    letter: 'E',
    word: 'Eliminate',
    color: '#f43f5e',
    glow: 'rgba(244,63,94,0.15)',
    desc: 'What could you remove, simplify, or reduce? What\'s not actually necessary?',
    fallbackPrompts: [
      'What features could you strip away?',
      'What would happen if you removed one step?',
      'Can you simplify the design dramatically?',
      'What\'s the absolute minimum version?',
    ],
    example: 'Removing the keyboard gave us touchscreen phones. Removing the cashier gave us self-checkout.',
    icon: '⊖',
  },
  {
    letter: 'R',
    word: 'Reverse',
    color: '#fb923c',
    glow: 'rgba(251,146,60,0.15)',
    desc: 'What if you turned it inside out, upside down, or backwards? What if you did the opposite?',
    fallbackPrompts: [
      'What if you reversed the order?',
      'Can you turn it upside down or inside out?',
      'What if the user became the creator?',
      'What if you did the exact opposite?',
    ],
    example: 'Wikipedia reversed who writes the encyclopedia. Airbnb reversed who provides accommodation.',
    icon: '↺',
  },
] as const;

type StepIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;
type EffortLevel = 'low' | 'medium' | 'high';

interface ScamperToolProps {
  toolId?: string;
  mode: 'public' | 'embedded' | 'standalone';
  challenge?: string;
  sessionId?: string;
  studentId?: string; // Optional — undefined in public mode
  unitId?: string;
  pageId?: string;
  /** ELL tier for language-aware effort thresholds (1=beginning, 2=developing, 3=proficient). Defaults to 3. */
  ellTier?: ELLTier;
  onSave?: (state: ToolState) => void;
  onComplete?: (data: ToolResponse) => void;
}

interface ToolState {
  stage: 'intro' | 'working' | 'summary';
  challenge: string;
  currentStep: StepIndex;
  ideas: string[][];
  ideaEfforts: Record<number, EffortLevel[]>;
  dealtCards: Record<number, number>;
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

/**
 * Language-tier-aware effort assessment.
 * Uses shared assessEffort from @/lib/toolkit/effort-assessment.
 * ELL Tier defaults to 3 (proficient) — pass student's tier for adjusted thresholds.
 * See docs/research/student-influence-factors.md for research basis.
 */
function assessEffort(idea: string, ellTier: ELLTier = 3): EffortLevel {
  return sharedAssessEffort(idea, ellTier);
}

export function ScamperTool({
  mode = 'public',
  challenge: initialChallenge = '',
  sessionId: initialSessionId,
  studentId,
  unitId,
  pageId,
  ellTier = 3,
  onSave,
  onComplete,
}: ScamperToolProps) {
  const [stage, setStage] = useState<'intro' | 'working' | 'summary'>(initialChallenge ? 'working' : 'intro');
  const [challenge, setChallenge] = useState(initialChallenge);
  const [currentStep, setCurrentStep] = useState<StepIndex>(0);
  const [ideas, setIdeas] = useState<string[][]>(() => STEPS.map(() => []));
  const [currentIdea, setCurrentIdea] = useState('');
  const [animatingStep, setAnimatingStep] = useState(false);

  const [sessionId] = useState(() => initialSessionId || Math.random().toString(36).slice(2) + Date.now().toString(36));
  const [aiPrompts, setAiPrompts] = useState<Record<number, string[]>>({});
  const [nudge, setNudge] = useState('');
  const [nudgeVisible, setNudgeVisible] = useState(false);
  const [loadingNudge, setLoadingNudge] = useState(false);
  const [insights, setInsights] = useState('');
  const [loadingInsights, setLoadingInsights] = useState(false);

  const [dealtCards, setDealtCards] = useState<Record<number, number>>({});
  const [thinkingTimeLeft, setThinkingTimeLeft] = useState(0);
  const [dealingAnimation, setDealingAnimation] = useState(false);
  const thinkingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [ideaEfforts, setIdeaEfforts] = useState<Record<number, EffortLevel[]>>({});
  const [microFeedback, setMicroFeedback] = useState<{ effort: EffortLevel; message: string } | null>(null);
  const [nudgeAcknowledgment, setNudgeAcknowledgment] = useState('');
  const [selectedBestIdeas, setSelectedBestIdeas] = useState<Set<string>>(new Set());
  const [bestIdeasReasoning, setBestIdeasReasoning] = useState('');
  const microFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const challengeRef = useRef<HTMLTextAreaElement>(null);

  // Initialize tool session persistence (gracefully disabled in public mode)
  const { session, updateState: updateToolSession, completeSession } = useToolSession({
    toolId: 'scamper',
    studentId,
    mode: mode === 'public' ? 'standalone' : (mode as 'embedded' | 'standalone'),
    challenge: initialChallenge,
    unitId,
    pageId,
  });

  const step = STEPS[currentStep];
  const totalIdeas = ideas.reduce((sum, arr) => sum + arr.length, 0);
  const currentPrompts = aiPrompts[currentStep] || step.fallbackPrompts;
  const cardsDealt = dealtCards[currentStep] || 0;

  // Sync state to legacy onSave callback (if provided)
  useEffect(() => {
    if (mode !== 'public' && onSave) {
      const timer = setTimeout(() => {
        const state: ToolState = {
          stage,
          challenge,
          currentStep,
          ideas,
          ideaEfforts,
          dealtCards,
        };
        onSave(state);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [stage, challenge, currentStep, ideas, ideaEfforts, dealtCards, mode, onSave]);

  // Sync state to useToolSession hook (for persistence when authenticated)
  useEffect(() => {
    const state: ToolState = {
      stage,
      challenge,
      currentStep,
      ideas,
      ideaEfforts,
      dealtCards,
    };
    updateToolSession(state);
  }, [stage, challenge, currentStep, ideas, ideaEfforts, dealtCards, updateToolSession]);

  const fetchAI = useCallback(async (body: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const res = await fetch('/api/tools/scamper', {
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
  }, [currentStep, stage]);

  useEffect(() => {
    if (stage === 'intro' && challengeRef.current) {
      setTimeout(() => challengeRef.current?.focus(), 500);
    }
  }, [stage]);

  // Fetch AI prompts when entering a new step (if not cached)
  useEffect(() => {
    if (stage === 'working' && !aiPrompts[currentStep]) {
      fetchAI({
        action: 'prompts',
        challenge,
        sessionId: 'public',
        stepIndex: currentStep,
      }).then((data) => {
        if (data.prompts && Array.isArray(data.prompts)) {
          setAiPrompts(prev => ({ ...prev, [currentStep]: data.prompts as string[] }));
        }
      }).catch(() => {/* fallback prompts will be used */});
    }
  }, [stage, currentStep]);

  // Fetch AI insights when entering summary
  useEffect(() => {
    if (stage === 'summary' && !insights) {
      const totalIdeas = ideas.reduce((sum, arr) => sum + arr.length, 0);
      if (totalIdeas > 0) {
        fetchAI({
          action: 'insights',
          challenge,
          sessionId: 'public',
          allIdeas: ideas,
        }).then((data) => {
          if (data.insights) {
            setInsights(data.insights as string);
          }
        }).catch(() => {/* insights are enhancement */});
      }
    }
  }, [stage]);

  const startWorking = () => {
    if (!challenge.trim()) return;
    setStage('working');
  };

  const addIdea = useCallback(() => {
    if (!currentIdea.trim()) return;
    const newIdea = currentIdea.trim();
    const effort = assessEffort(newIdea, ellTier);

    setIdeas(prev => {
      const next = [...prev];
      next[currentStep] = [...next[currentStep], newIdea];
      return next;
    });

    setIdeaEfforts(prev => ({
      ...prev,
      [currentStep]: [...(prev[currentStep] || []), effort],
    }));

    const feedbackPool = MICRO_FEEDBACK[effort];
    const message = feedbackPool.messages[Math.floor(Math.random() * feedbackPool.messages.length)];
    setMicroFeedback({ effort, message });

    if (microFeedbackTimerRef.current) clearTimeout(microFeedbackTimerRef.current);
    microFeedbackTimerRef.current = setTimeout(() => setMicroFeedback(null), 3000);

    setCurrentIdea('');
    textareaRef.current?.focus();

    // Fetch AI nudge for the submitted idea
    fetchAI({
      action: 'nudge',
      challenge,
      sessionId: 'public',
      stepIndex: currentStep,
      idea: newIdea,
      effortLevel: effort,
      existingIdeas: ideas[currentStep],
    }).then((data) => {
      if (data.nudge) {
        setNudge(data.nudge as string);
        setNudgeVisible(true);
      }
    }).catch(() => {
      // AI nudge is enhancement, not requirement
    });
  }, [currentIdea, currentStep, ideas, challenge, fetchAI]);

  const goToStep = (idx: StepIndex) => {
    if (idx === currentStep) return;
    setAnimatingStep(true);
    setNudge('');
    setNudgeVisible(false);
    setTimeout(() => {
      setCurrentStep(idx);
      setCurrentIdea('');
      setTimeout(() => setAnimatingStep(false), 50);
    }, 200);
  };

  const nextStep = () => {
    if (currentStep < 6) goToStep((currentStep + 1) as StepIndex);
    else {
      setInsights('');
      setStage('summary');

      // Mark session as complete in the persistence layer
      const summary = {
        bestIdeas: Array.from(selectedBestIdeas),
        bestIdeasReasoning,
      };
      completeSession(summary);

      if (onComplete) {
        onComplete({
          toolId: 'scamper',
          challenge,
          stage: 'summary',
          ideas,
          metadata: {
            totalIdeas,
            timeSpentMs: 0,
          },
        });
      }
    }
  };

  const prevStep = () => {
    if (currentStep > 0) goToStep((currentStep - 1) as StepIndex);
  };

  const startOver = () => {
    setStage('intro');
    setChallenge('');
    setCurrentStep(0);
    setIdeas(STEPS.map(() => []));
    setCurrentIdea('');
    setAiPrompts({});
    setNudge('');
    setNudgeVisible(false);
    setNudgeAcknowledgment('');
    setInsights('');
    setIdeaEfforts({});
    setMicroFeedback(null);
    setDealtCards({});
  };

  const handlePrint = () => window.print();

  useEffect(() => {
    return () => {
      if (thinkingTimerRef.current) clearInterval(thinkingTimerRef.current);
      if (microFeedbackTimerRef.current) clearTimeout(microFeedbackTimerRef.current);
    };
  }, []);

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
        <style>{`
          @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
          @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
          @media print { .no-print { display: none !important; } }
        `}</style>

        <div style={{
          position: 'absolute',
          top: '20%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(168,85,247,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{
          display: 'flex',
          gap: 'clamp(8px, 2vw, 20px)',
          marginBottom: '48px',
          animation: 'float 6s ease-in-out infinite',
        }}>
          {STEPS.map((s) => (
            <div key={s.letter} style={{
              width: 'clamp(40px, 8vw, 64px)',
              height: 'clamp(40px, 8vw, 64px)',
              borderRadius: '16px',
              background: `linear-gradient(135deg, ${s.color}20, ${s.color}08)`,
              border: `2px solid ${s.color}40`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 'clamp(20px, 5vw, 36px)',
              fontWeight: '700',
              color: s.color,
            }}>
              {s.letter}
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
          SCAMPER
        </h1>

        <p style={{
          fontSize: 'clamp(16px, 3vw, 20px)',
          color: '#a8aac4',
          marginBottom: '48px',
          maxWidth: '500px',
          textAlign: 'center',
          animation: 'fadeInUp 0.8s ease-out 0.1s both',
        }}>
          Seven creative techniques to transform your ideas. Think like an innovator.
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
            What are you designing or improving?
          </label>
          <textarea
            ref={challengeRef}
            value={challenge}
            onChange={(e) => setChallenge(e.target.value)}
            placeholder="E.g., A better water bottle, a new classroom experience, a way to reduce plastic waste..."
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
              e.currentTarget.style.borderColor = '#a855f7';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(168,85,247,0.1)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#2a2d3a';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>

        <button
          onClick={startWorking}
          disabled={!challenge.trim()}
          style={{
            padding: '14px 40px',
            fontSize: '16px',
            fontWeight: '600',
            borderRadius: '10px',
            border: 'none',
            background: challenge.trim() ? '#a855f7' : '#5a5d6f',
            color: '#fff',
            cursor: challenge.trim() ? 'pointer' : 'not-allowed',
            transition: 'all 0.3s',
            animation: 'fadeInUp 0.8s ease-out 0.3s both',
          }}
          onMouseEnter={(e) => {
            if (challenge.trim()) {
              (e.currentTarget as HTMLButtonElement).style.background = '#9333ea';
            }
          }}
          onMouseLeave={(e) => {
            if (challenge.trim()) {
              (e.currentTarget as HTMLButtonElement).style.background = '#a855f7';
            }
          }}
        >
          Start Brainstorming
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
            {STEPS.map((s, idx) => (
              <button
                key={idx}
                onClick={() => goToStep(idx as StepIndex)}
                disabled={animatingStep}
                style={{
                  padding: '10px 16px',
                  fontSize: '13px',
                  fontWeight: '600',
                  borderRadius: '8px',
                  border: '2px solid',
                  borderColor: idx === currentStep ? s.color : '#2a2d3a',
                  background: idx === currentStep ? `${s.color}20` : 'transparent',
                  color: idx === currentStep ? s.color : '#a8aac4',
                  cursor: animatingStep ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s',
                  opacity: animatingStep ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  if (idx !== currentStep && !animatingStep) {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = s.color;
                    (e.currentTarget as HTMLButtonElement).style.color = s.color;
                  }
                }}
                onMouseLeave={(e) => {
                  if (idx !== currentStep) {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = '#2a2d3a';
                    (e.currentTarget as HTMLButtonElement).style.color = '#a8aac4';
                  }
                }}
              >
                {s.letter}
              </button>
            ))}
          </div>

          <div style={{ marginBottom: '32px' }}>
            <h2 style={{
              fontSize: '28px',
              fontWeight: '700',
              marginBottom: '12px',
              color: step.color,
            }}>
              {step.word}
            </h2>
            <p style={{
              fontSize: '16px',
              color: '#a8aac4',
              lineHeight: '1.6',
            }}>
              {step.desc}
            </p>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <textarea
              ref={textareaRef}
              value={currentIdea}
              onChange={(e) => setCurrentIdea(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.ctrlKey) {
                  addIdea();
                }
              }}
              placeholder="Type your idea..."
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
                (e.currentTarget as HTMLTextAreaElement).style.borderColor = step.color;
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
              background: currentIdea.trim() ? step.color : '#5a5d6f',
              color: '#fff',
              cursor: currentIdea.trim() ? 'pointer' : 'not-allowed',
              marginBottom: '24px',
            }}
          >
            Add Idea
          </button>

          {/* AI Nudge */}
          {nudge && nudgeVisible && (
            <div style={{
              marginBottom: '16px',
              padding: '14px 18px',
              borderRadius: '12px',
              background: `${step.color}15`,
              border: `1px solid ${step.color}30`,
              fontSize: '14px',
              lineHeight: '1.6',
              color: '#d4d4e8',
            }}>
              <span style={{ color: step.color, fontWeight: 600, marginRight: '8px' }}>AI:</span>
              {nudge}
            </div>
          )}

          {/* AI Prompts (deal cards) */}
          {(ideas[currentStep] || []).length > 0 && currentPrompts.length > 0 && (
            <div style={{
              marginBottom: '16px',
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap',
            }}>
              {currentPrompts.slice(0, dealtCards[currentStep] || 0).map((prompt, pi) => (
                <div key={pi} style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: '#1a1d2e',
                  border: '1px solid #2a2d3a',
                  fontSize: '13px',
                  color: '#a0a4b8',
                  maxWidth: '300px',
                  fontStyle: 'italic',
                }}>
                  {prompt}
                </div>
              ))}
              {(dealtCards[currentStep] || 0) < currentPrompts.length && (
                <button
                  onClick={() => setDealtCards(prev => ({ ...prev, [currentStep]: (prev[currentStep] || 0) + 1 }))}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '10px',
                    background: `${step.color}20`,
                    border: `1px solid ${step.color}40`,
                    fontSize: '13px',
                    fontWeight: 600,
                    color: step.color,
                    cursor: 'pointer',
                  }}
                >
                  Deal a Card
                </button>
              )}
            </div>
          )}

          {(ideas[currentStep] || []).length > 0 && (
            <div style={{
              marginBottom: '32px',
              padding: '20px',
              borderRadius: '12px',
              background: '#0f1119',
              border: `2px solid ${step.color}20`,
            }}>
              <h3 style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#a8aac4',
                marginBottom: '16px',
              }}>
                Your Ideas ({ideas[currentStep].length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {ideas[currentStep].map((idea, idx) => (
                  <div key={idx} style={{
                    padding: '12px',
                    borderRadius: '8px',
                    background: '#1a1d2a',
                    border: `1px solid ${step.color}30`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '12px',
                  }}>
                    <p style={{
                      fontSize: '14px',
                      color: '#e8eaf0',
                      margin: 0,
                      flex: 1,
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
            onClick={prevStep}
            disabled={currentStep === 0 || animatingStep}
            style={{
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: '600',
              borderRadius: '8px',
              border: 'none',
              background: currentStep === 0 ? '#5a5d6f' : '#2a2d3a',
              color: '#e8eaf0',
              cursor: currentStep === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            ← Back
          </button>

          <button
            onClick={nextStep}
            disabled={animatingStep}
            style={{
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: '600',
              borderRadius: '8px',
              border: 'none',
              background: step.color,
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            {currentStep === 6 ? 'Finish →' : 'Next →'}
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
      {/* Save status indicator */}
      {session.saveStatus !== 'idle' && (
        <div style={{
          position: 'fixed',
          top: '16px',
          right: '16px',
          fontSize: '13px',
          fontWeight: '500',
          padding: '8px 12px',
          borderRadius: '6px',
          zIndex: 1000,
          opacity: session.saveStatus === 'saved' ? 1 : 0.8,
          background: session.saveStatus === 'error' ? '#dc26261a' : '#10b98114',
          color: session.saveStatus === 'error' ? '#ef4444' : '#10b981',
        }}>
          {session.saveStatus === 'saving' && '⟳ Saving...'}
          {session.saveStatus === 'saved' && '✓ Saved'}
          {session.saveStatus === 'error' && '✕ Save failed'}
        </div>
      )}

      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h2 style={{
          fontSize: '32px',
          fontWeight: '700',
          marginBottom: '24px',
          textAlign: 'center',
        }}>
          Your SCAMPER Ideas
        </h2>

        <p style={{
          fontSize: '16px',
          color: '#a8aac4',
          marginBottom: '32px',
          textAlign: 'center',
        }}>
          Challenge: <strong style={{ color: '#e8eaf0' }}>{challenge}</strong>
        </p>

        <div style={{
          padding: '24px',
          borderRadius: '12px',
          background: '#0f1119',
          border: '2px solid #a855f740',
          marginBottom: '32px',
        }}>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '700',
            color: '#a855f7',
            marginTop: 0,
            marginBottom: '16px',
          }}>
            Pick Your Best Ideas
          </h3>
          <p style={{
            fontSize: '14px',
            color: '#a8aac4',
            marginBottom: '16px',
          }}>
            Click the star next to your top 3 ideas. This forces convergent thinking — choose the ones with the most potential.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
            {STEPS.map((s, stepIdx) =>
              ideas[stepIdx] && ideas[stepIdx].length > 0 && (
                <div key={stepIdx}>
                  <p style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    color: s.color,
                    marginBottom: '8px',
                    marginTop: 0,
                  }}>
                    {s.word}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {ideas[stepIdx].map((idea, ideaIdx) => {
                      const ideaId = `${stepIdx}-${ideaIdx}`;
                      const isSelected = selectedBestIdeas.has(ideaId);
                      return (
                        <div key={ideaId} style={{
                          padding: '12px',
                          borderRadius: '8px',
                          background: isSelected ? `${s.color}20` : '#1a1d2a',
                          border: isSelected ? `2px solid ${s.color}` : `1px solid ${s.color}30`,
                          display: 'flex',
                          gap: '12px',
                          alignItems: 'flex-start',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                          onClick={() => {
                            const newSet = new Set(selectedBestIdeas);
                            if (newSet.has(ideaId)) {
                              newSet.delete(ideaId);
                            } else if (newSet.size < 3) {
                              newSet.add(ideaId);
                            }
                            setSelectedBestIdeas(newSet);
                          }}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const newSet = new Set(selectedBestIdeas);
                              if (newSet.has(ideaId)) {
                                newSet.delete(ideaId);
                              } else if (newSet.size < 3) {
                                newSet.add(ideaId);
                              }
                              setSelectedBestIdeas(newSet);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              fontSize: '20px',
                              cursor: 'pointer',
                              padding: 0,
                              color: isSelected ? '#a855f7' : '#4a4d5a',
                              transition: 'all 0.2s',
                            }}
                          >
                            {isSelected ? '★' : '☆'}
                          </button>
                          <p style={{
                            margin: 0,
                            fontSize: '14px',
                            color: '#e8eaf0',
                            flex: 1,
                            lineHeight: '1.5',
                          }}>
                            {idea}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            )}
          </div>

          {selectedBestIdeas.size === 3 && (
            <div style={{ marginTop: '16px' }}>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '600',
                color: '#d8dce6',
                marginBottom: '8px',
              }}>
                Why did you choose these 3? (minimum 2 sentences)
              </label>
              <textarea
                value={bestIdeasReasoning}
                onChange={(e) => setBestIdeasReasoning(e.target.value)}
                placeholder="Explain what makes these ideas stand out..."
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  borderRadius: '8px',
                  border: '2px solid #a855f740',
                  background: '#0f1119',
                  color: '#e8eaf0',
                  resize: 'vertical',
                  minHeight: '80px',
                  boxSizing: 'border-box',
                }}
              />
              <p style={{
                fontSize: '12px',
                color: bestIdeasReasoning.trim().split(/\.\s+/).length >= 2 ? '#10b981' : '#f59e0b',
                marginTop: '6px',
                margin: 0,
              }}>
                {bestIdeasReasoning.trim().split(/\.\s+/).filter(s => s.trim()).length} sentence{bestIdeasReasoning.trim().split(/\.\s+/).filter(s => s.trim()).length !== 1 ? 's' : ''}
              </p>
            </div>
          )}

          {selectedBestIdeas.size < 3 && (
            <p style={{
              fontSize: '13px',
              color: '#a8aac4',
              fontStyle: 'italic',
              margin: 0,
            }}>
              Select {3 - selectedBestIdeas.size} more idea{selectedBestIdeas.size === 2 ? '' : 's'}
            </p>
          )}
        </div>

        {STEPS.map((s, stepIdx) => (
          ideas[stepIdx] && ideas[stepIdx].length > 0 && (
            <div key={stepIdx} style={{ marginBottom: '32px' }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '700',
                color: s.color,
                marginBottom: '16px',
              }}>
                {s.word} ({ideas[stepIdx].length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {ideas[stepIdx].map((idea, ideaIdx) => (
                  <div key={ideaIdx} style={{
                    padding: '12px',
                    borderRadius: '8px',
                    background: '#0f1119',
                    border: `2px solid ${s.color}40`,
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
          border: '2px solid #a855f720',
          marginBottom: '32px',
          textAlign: 'center',
        }}>
          <p style={{
            fontSize: '18px',
            fontWeight: '700',
            color: '#a855f7',
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
              background: '#a855f7',
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
