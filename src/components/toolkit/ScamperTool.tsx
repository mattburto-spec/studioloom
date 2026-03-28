'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { useToolSession } from '@/hooks/useToolSession';
import { assessEffort as sharedAssessEffort, getRandomMicroFeedback, type ELLTier } from '@/lib/toolkit';

/* ═══════════════════════════════════════════════════════════════════
   SCAMPER v2 — World-class reference implementation
   Framer Motion springs, glassmorphism, AI typing, depth indicators
   ═══════════════════════════════════════════════════════════════════ */

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
  studentId?: string;
  unitId?: string;
  pageId?: string;
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
  metadata: { totalIdeas: number; timeSpentMs: number };
}

// ── Animation configs ────────────────────────────────
const spring = { type: 'spring' as const, stiffness: 300, damping: 30 };
const springGentle = { type: 'spring' as const, stiffness: 200, damping: 25 };
const springBouncy = { type: 'spring' as const, stiffness: 400, damping: 20 };

function assessEffort(idea: string, ellTier: ELLTier = 3): EffortLevel {
  return sharedAssessEffort(idea, ellTier);
}

// ── Depth dots component ─────────────────────────────
function DepthDots({ effort }: { effort: EffortLevel }) {
  const count = effort === 'high' ? 3 : effort === 'medium' ? 2 : 1;
  const color = effort === 'high' ? '#a78bfa' : effort === 'medium' ? '#60a5fa' : '#f59e0b';
  return (
    <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
      {[1, 2, 3].map(i => (
        <motion.div
          key={i}
          initial={{ scale: 0 }}
          animate={{ scale: i <= count ? 1 : 0.4, opacity: i <= count ? 1 : 0.2 }}
          transition={{ ...springBouncy, delay: i * 0.05 }}
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: i <= count ? color : '#3a3d4a',
          }}
        />
      ))}
    </div>
  );
}

// ── Circular timer for card dealing ──────────────────
function ThinkingTimer({ duration, onComplete, color }: { duration: number; onComplete: () => void; color: string }) {
  const [elapsed, setElapsed] = useState(0);
  const progress = Math.min(elapsed / duration, 1);
  const circumference = 2 * Math.PI * 18;
  const dashOffset = circumference * (1 - progress);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(prev => {
        if (prev >= duration) {
          clearInterval(interval);
          onComplete();
          return prev;
        }
        return prev + 0.1;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [duration, onComplete]);

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
    >
      <svg width="40" height="40" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="18" fill="none" stroke="#2a2d3a" strokeWidth="2.5" />
        <motion.circle
          cx="20" cy="20" r="18"
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 20 20)"
          style={{ transition: 'stroke-dashoffset 0.1s linear' }}
        />
        <text x="20" y="24" textAnchor="middle" fontSize="12" fontWeight="700" fill={color}>
          {Math.ceil(duration - elapsed)}
        </text>
      </svg>
      <span style={{ fontSize: '12px', color: '#a8aac4', fontWeight: 500 }}>Think first...</span>
    </motion.div>
  );
}

// ── Typewriter text for AI responses ─────────────────
function TypewriterText({ text, speed = 20, color }: { text: string; speed?: number; color?: string }) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed('');
    setDone(false);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(interval);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);

  return (
    <span style={{ color: color || '#d4d4e8' }}>
      {displayed}
      {!done && (
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity }}
          style={{ color: color || '#a855f7' }}
        >
          |
        </motion.span>
      )}
    </span>
  );
}

// ── Glass card wrapper ───────────────────────────────
function GlassCard({ children, color, style, ...props }: {
  children: React.ReactNode;
  color?: string;
  style?: React.CSSProperties;
  [key: string]: unknown;
}) {
  return (
    <div
      style={{
        borderRadius: '16px',
        background: 'rgba(15, 17, 25, 0.7)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: `1px solid ${color ? color + '25' : 'rgba(255,255,255,0.06)'}`,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}


// ═══════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════

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

  const [sessionId] = useState(() => initialSessionId || Math.random().toString(36).slice(2) + Date.now().toString(36));
  const [aiPrompts, setAiPrompts] = useState<Record<number, string[]>>({});
  const [nudge, setNudge] = useState('');
  const [nudgeVisible, setNudgeVisible] = useState(false);
  const [loadingNudge, setLoadingNudge] = useState(false);
  const [insights, setInsights] = useState('');
  const [loadingInsights, setLoadingInsights] = useState(false);

  const [dealtCards, setDealtCards] = useState<Record<number, number>>({});
  const [showTimer, setShowTimer] = useState(false);

  const [ideaEfforts, setIdeaEfforts] = useState<Record<number, EffortLevel[]>>({});
  const [microFeedback, setMicroFeedback] = useState<{ effort: EffortLevel; message: string } | null>(null);
  const [nudgeAcknowledgment, setNudgeAcknowledgment] = useState('');
  const [selectedBestIdeas, setSelectedBestIdeas] = useState<Set<string>>(new Set());
  const [bestIdeasReasoning, setBestIdeasReasoning] = useState('');
  const [showExample, setShowExample] = useState(false);
  const microFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const challengeRef = useRef<HTMLTextAreaElement>(null);

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

  // ── Persistence ────────────────────────────────────
  useEffect(() => {
    if (mode !== 'public' && onSave) {
      const timer = setTimeout(() => {
        onSave({ stage, challenge, currentStep, ideas, ideaEfforts, dealtCards });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [stage, challenge, currentStep, ideas, ideaEfforts, dealtCards, mode, onSave]);

  useEffect(() => {
    updateToolSession({ stage, challenge, currentStep, ideas, ideaEfforts, dealtCards } as any);
  }, [stage, challenge, currentStep, ideas, ideaEfforts, dealtCards, updateToolSession]);

  // ── API helper ─────────────────────────────────────
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

  // ── Focus management ───────────────────────────────
  useEffect(() => {
    if (stage === 'working' && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 400);
    }
  }, [currentStep, stage]);

  useEffect(() => {
    if (stage === 'intro' && challengeRef.current) {
      setTimeout(() => challengeRef.current?.focus(), 600);
    }
  }, [stage]);

  // ── Fetch AI prompts per step ──────────────────────
  useEffect(() => {
    if (stage === 'working' && !aiPrompts[currentStep]) {
      fetchAI({
        action: 'prompts',
        challenge,
        sessionId: 'public',
        stepIndex: currentStep,
        existingIdeas: ideas[currentStep],
      }).then((data) => {
        if (data.prompts && Array.isArray(data.prompts)) {
          setAiPrompts(prev => ({ ...prev, [currentStep]: data.prompts as string[] }));
        }
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, currentStep]);

  // ── Fetch AI insights on summary ───────────────────
  useEffect(() => {
    if (stage === 'summary' && !insights) {
      setLoadingInsights(true);
      const total = ideas.reduce((sum, arr) => sum + arr.length, 0);
      if (total > 0) {
        fetchAI({
          action: 'insights',
          challenge,
          sessionId: 'public',
          allIdeas: ideas,
        }).then((data) => {
          if (data.insights) setInsights(data.insights as string);
        }).catch(() => {}).finally(() => setLoadingInsights(false));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // ── Core actions ───────────────────────────────────
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

    const feedbackOptions = getRandomMicroFeedback(effort);
    const message = feedbackOptions?.message || 'Idea added!';
    setMicroFeedback({ effort, message });
    if (microFeedbackTimerRef.current) clearTimeout(microFeedbackTimerRef.current);
    microFeedbackTimerRef.current = setTimeout(() => setMicroFeedback(null), 3000);

    setCurrentIdea('');
    textareaRef.current?.focus();

    // Fetch AI nudge
    setLoadingNudge(true);
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
        setNudgeAcknowledgment((data.acknowledgment as string) || '');
        setNudgeVisible(true);
      }
    }).catch(() => {}).finally(() => setLoadingNudge(false));
  }, [currentIdea, currentStep, ideas, challenge, fetchAI, ellTier]);

  const goToStep = (idx: StepIndex) => {
    if (idx === currentStep) return;
    setNudge('');
    setNudgeVisible(false);
    setShowExample(false);
    setCurrentStep(idx);
    setCurrentIdea('');
  };

  const nextStep = () => {
    if (currentStep < 6) {
      goToStep((currentStep + 1) as StepIndex);
    } else {
      setInsights('');
      setStage('summary');
      const summary = { bestIdeas: Array.from(selectedBestIdeas), bestIdeasReasoning };
      completeSession(summary);
      if (onComplete) {
        onComplete({
          toolId: 'scamper',
          challenge,
          stage: 'summary',
          ideas,
          metadata: { totalIdeas, timeSpentMs: 0 },
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
    setSelectedBestIdeas(new Set());
    setBestIdeasReasoning('');
    setShowExample(false);
  };

  const dealCard = () => {
    setShowTimer(true);
  };

  const onTimerComplete = useCallback(() => {
    setShowTimer(false);
    setDealtCards(prev => ({ ...prev, [currentStep]: (prev[currentStep] || 0) + 1 }));
  }, [currentStep]);

  useEffect(() => {
    return () => {
      if (microFeedbackTimerRef.current) clearTimeout(microFeedbackTimerRef.current);
    };
  }, []);

  // ── Shared styles ──────────────────────────────────
  const baseStyle: React.CSSProperties = {
    background: '#06060f',
    color: '#e8eaf0',
    minHeight: '100vh',
    fontFamily: 'Inter, -apple-system, sans-serif',
  };

  // ═══════════════════════════════════════════════════
  // INTRO SCREEN
  // ═══════════════════════════════════════════════════
  if (stage === 'intro') {
    return (
      <div style={{
        ...baseStyle,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <style>{`@media print { .no-print { display: none !important; } }`}</style>

        {/* Background glow */}
        <div style={{
          position: 'absolute',
          top: '15%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '700px',
          height: '700px',
          background: 'radial-gradient(circle, rgba(168,85,247,0.06) 0%, transparent 60%)',
          pointerEvents: 'none',
        }} />

        {/* Letter badges with staggered spring animation */}
        <motion.div
          style={{ display: 'flex', gap: 'clamp(8px, 2vw, 16px)', marginBottom: '48px' }}
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.06 } },
          }}
        >
          {STEPS.map((s) => (
            <motion.div
              key={s.letter}
              variants={{
                hidden: { opacity: 0, y: 30, scale: 0.5 },
                visible: { opacity: 1, y: 0, scale: 1 },
              }}
              transition={springBouncy}
              whileHover={{ scale: 1.12, y: -4 }}
              style={{
                width: 'clamp(40px, 8vw, 60px)',
                height: 'clamp(40px, 8vw, 60px)',
                borderRadius: '14px',
                background: `linear-gradient(135deg, ${s.color}18, ${s.color}08)`,
                border: `2px solid ${s.color}35`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 'clamp(20px, 5vw, 32px)',
                fontWeight: '700',
                color: s.color,
                cursor: 'default',
              }}
            >
              {s.letter}
            </motion.div>
          ))}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springGentle, delay: 0.3 }}
          style={{
            fontSize: 'clamp(36px, 8vw, 56px)',
            fontWeight: '800',
            marginBottom: '16px',
            textAlign: 'center',
            letterSpacing: '-0.02em',
            background: 'linear-gradient(135deg, #a855f7, #6366f1, #ec4899)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          SCAMPER
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springGentle, delay: 0.4 }}
          style={{
            fontSize: 'clamp(16px, 3vw, 20px)',
            color: '#8b8da8',
            marginBottom: '48px',
            maxWidth: '480px',
            textAlign: 'center',
            lineHeight: '1.6',
          }}
        >
          Seven creative techniques to transform your ideas. Think like an innovator.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springGentle, delay: 0.5 }}
          style={{ width: '100%', maxWidth: '500px', marginBottom: '32px' }}
        >
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '600',
            color: '#c8cce0',
            marginBottom: '12px',
          }}>
            What are you designing or improving?
          </label>
          <textarea
            ref={challengeRef}
            value={challenge}
            onChange={(e) => setChallenge(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) startWorking();
            }}
            placeholder="E.g., A better water bottle, a new classroom experience, a way to reduce plastic waste..."
            style={{
              width: '100%',
              padding: '16px',
              fontSize: '16px',
              fontFamily: 'inherit',
              borderRadius: '14px',
              border: '2px solid #2a2d3a',
              background: 'rgba(15,17,25,0.8)',
              backdropFilter: 'blur(12px)',
              color: '#e8eaf0',
              resize: 'vertical',
              minHeight: '120px',
              transition: 'border-color 0.3s, box-shadow 0.3s',
              boxSizing: 'border-box',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#a855f7';
              e.currentTarget.style.boxShadow = '0 0 0 4px rgba(168,85,247,0.08)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#2a2d3a';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </motion.div>

        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springGentle, delay: 0.6 }}
          whileHover={challenge.trim() ? { scale: 1.04 } : {}}
          whileTap={challenge.trim() ? { scale: 0.97 } : {}}
          onClick={startWorking}
          disabled={!challenge.trim()}
          style={{
            padding: '14px 40px',
            fontSize: '16px',
            fontWeight: '600',
            borderRadius: '12px',
            border: 'none',
            background: challenge.trim()
              ? 'linear-gradient(135deg, #a855f7, #8b5cf6)'
              : '#3a3d4a',
            color: challenge.trim() ? '#fff' : '#888',
            cursor: challenge.trim() ? 'pointer' : 'not-allowed',
            transition: 'background 0.3s',
          }}
        >
          Start Brainstorming
        </motion.button>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════
  // WORKING SCREEN
  // ═══════════════════════════════════════════════════
  if (stage === 'working') {
    return (
      <div style={{ ...baseStyle, padding: 'clamp(20px, 4vw, 40px) clamp(16px, 3vw, 24px)' }}>
        <style>{`@media print { .no-print { display: none !important; } }`}</style>

        <div className="no-print" style={{ maxWidth: '800px', margin: '0 auto' }}>

          {/* ── Step navigation ───────────────────── */}
          <div style={{
            display: 'flex',
            gap: '6px',
            marginBottom: '32px',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}>
            {STEPS.map((s, idx) => {
              const isActive = idx === currentStep;
              const hasIdeas = (ideas[idx] || []).length > 0;
              return (
                <motion.button
                  key={idx}
                  onClick={() => goToStep(idx as StepIndex)}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.95 }}
                  style={{
                    padding: '8px 14px',
                    fontSize: '13px',
                    fontWeight: '700',
                    borderRadius: '10px',
                    border: 'none',
                    background: isActive
                      ? `linear-gradient(135deg, ${s.color}, ${s.color}cc)`
                      : hasIdeas ? `${s.color}18` : 'rgba(255,255,255,0.04)',
                    color: isActive ? '#fff' : hasIdeas ? s.color : '#6b6e82',
                    cursor: 'pointer',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {s.letter}
                  {hasIdeas && !isActive && (
                    <span style={{
                      fontSize: '10px',
                      background: `${s.color}30`,
                      padding: '1px 5px',
                      borderRadius: '8px',
                    }}>
                      {ideas[idx].length}
                    </span>
                  )}
                  {isActive && (
                    <motion.div
                      layoutId="activeStepIndicator"
                      style={{
                        position: 'absolute',
                        bottom: '-4px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: '16px',
                        height: '3px',
                        borderRadius: '2px',
                        background: '#fff',
                      }}
                      transition={spring}
                    />
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* ── Step content with AnimatePresence ──── */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ ...spring, duration: 0.3 }}
            >
              {/* Step header */}
              <div style={{ marginBottom: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                  <motion.span
                    key={`icon-${currentStep}`}
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={springBouncy}
                    style={{
                      fontSize: '28px',
                      width: '48px',
                      height: '48px',
                      borderRadius: '14px',
                      background: `${step.color}15`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {step.icon}
                  </motion.span>
                  <div>
                    <h2 style={{
                      fontSize: 'clamp(24px, 5vw, 32px)',
                      fontWeight: '800',
                      color: step.color,
                      margin: 0,
                      letterSpacing: '-0.01em',
                    }}>
                      {step.word}
                    </h2>
                    <span style={{ fontSize: '12px', color: '#6b6e82', fontWeight: 500 }}>
                      Step {currentStep + 1} of 7
                    </span>
                  </div>
                </div>
                <p style={{
                  fontSize: '15px',
                  color: '#a0a4b8',
                  lineHeight: '1.6',
                  margin: 0,
                }}>
                  {step.desc}
                </p>
              </div>

              {/* ── Textarea (primary action) ──────── */}
              <GlassCard color={step.color} style={{ padding: '2px', marginBottom: '16px' }}>
                <textarea
                  ref={textareaRef}
                  value={currentIdea}
                  onChange={(e) => setCurrentIdea(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addIdea();
                  }}
                  placeholder="Type your idea..."
                  style={{
                    width: '100%',
                    padding: '16px',
                    fontSize: '16px',
                    fontFamily: 'inherit',
                    borderRadius: '14px',
                    border: 'none',
                    background: 'transparent',
                    color: '#e8eaf0',
                    resize: 'vertical',
                    minHeight: '90px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </GlassCard>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap' }}>
                <motion.button
                  onClick={addIdea}
                  disabled={!currentIdea.trim()}
                  whileHover={currentIdea.trim() ? { scale: 1.04 } : {}}
                  whileTap={currentIdea.trim() ? { scale: 0.96 } : {}}
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: '600',
                    borderRadius: '10px',
                    border: 'none',
                    background: currentIdea.trim()
                      ? `linear-gradient(135deg, ${step.color}, ${step.color}cc)`
                      : '#2a2d3a',
                    color: currentIdea.trim() ? '#fff' : '#6b6e82',
                    cursor: currentIdea.trim() ? 'pointer' : 'not-allowed',
                  }}
                >
                  Add Idea
                </motion.button>

                <span style={{ fontSize: '12px', color: '#5a5d6f' }}>
                  {navigator?.platform?.includes('Mac') ? '⌘' : 'Ctrl'}+Enter
                </span>

                {/* Example toggle */}
                <button
                  onClick={() => setShowExample(!showExample)}
                  style={{
                    marginLeft: 'auto',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: '500',
                    borderRadius: '8px',
                    border: '1px solid #2a2d3a',
                    background: 'transparent',
                    color: '#8b8da8',
                    cursor: 'pointer',
                  }}
                >
                  {showExample ? 'Hide example' : 'See an example'}
                </button>
              </div>

              {/* Example (collapsible) */}
              <AnimatePresence>
                {showExample && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    style={{ overflow: 'hidden', marginBottom: '20px' }}
                  >
                    <div style={{
                      padding: '14px 16px',
                      borderRadius: '12px',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      fontSize: '13px',
                      color: '#8b8da8',
                      lineHeight: '1.6',
                      fontStyle: 'italic',
                    }}>
                      {step.example}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── AI Nudge ──────────────────────── */}
              <AnimatePresence>
                {loadingNudge && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    style={{
                      marginBottom: '16px',
                      padding: '14px 18px',
                      borderRadius: '14px',
                      background: `${step.color}08`,
                      border: `1px solid ${step.color}20`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      style={{
                        width: 16, height: 16, borderRadius: '50%',
                        border: `2px solid ${step.color}40`,
                        borderTopColor: step.color,
                      }}
                    />
                    <span style={{ fontSize: '13px', color: '#8b8da8' }}>Thinking...</span>
                  </motion.div>
                )}

                {nudge && nudgeVisible && !loadingNudge && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={springGentle}
                    style={{
                      marginBottom: '16px',
                      padding: '14px 18px',
                      borderRadius: '14px',
                      background: `${step.color}08`,
                      border: `1px solid ${step.color}20`,
                      fontSize: '14px',
                      lineHeight: '1.6',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: `${step.color}20`,
                        color: step.color,
                        letterSpacing: '0.5px',
                      }}>
                        AI
                      </span>
                    </div>
                    <TypewriterText text={nudge} speed={18} color="#c8cce0" />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Deal Cards (soft-gated prompts) ── */}
              {(ideas[currentStep] || []).length > 0 && currentPrompts.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{
                    display: 'flex',
                    gap: '8px',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                  }}>
                    <AnimatePresence>
                      {currentPrompts.slice(0, cardsDealt).map((prompt, pi) => (
                        <motion.div
                          key={`prompt-${currentStep}-${pi}`}
                          initial={{ opacity: 0, scale: 0.8, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          transition={{ ...springBouncy, delay: 0.05 }}
                          style={{
                            padding: '10px 14px',
                            borderRadius: '10px',
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            fontSize: '13px',
                            color: '#a0a4b8',
                            maxWidth: '280px',
                            fontStyle: 'italic',
                            lineHeight: '1.5',
                          }}
                        >
                          {prompt}
                        </motion.div>
                      ))}
                    </AnimatePresence>

                    {/* Deal button or timer */}
                    {cardsDealt < currentPrompts.length && (
                      <AnimatePresence mode="wait">
                        {showTimer ? (
                          <ThinkingTimer
                            key="timer"
                            duration={8}
                            onComplete={onTimerComplete}
                            color={step.color}
                          />
                        ) : (
                          <motion.button
                            key="deal-btn"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            whileHover={{ scale: 1.06 }}
                            whileTap={{ scale: 0.94 }}
                            onClick={dealCard}
                            style={{
                              padding: '10px 16px',
                              borderRadius: '10px',
                              background: `${step.color}15`,
                              border: `1px solid ${step.color}30`,
                              fontSize: '13px',
                              fontWeight: 600,
                              color: step.color,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            <span style={{ fontSize: '16px' }}>🃏</span> Deal a Card
                          </motion.button>
                        )}
                      </AnimatePresence>
                    )}
                  </div>
                </div>
              )}

              {/* ── Ideas list with depth dots ──────── */}
              <AnimatePresence>
                {(ideas[currentStep] || []).length > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{ marginBottom: '32px' }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '12px',
                    }}>
                      <h3 style={{
                        fontSize: '13px',
                        fontWeight: '600',
                        color: '#8b8da8',
                        margin: 0,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}>
                        Your Ideas ({ideas[currentStep].length})
                      </h3>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {ideas[currentStep].map((idea, idx) => (
                        <motion.div
                          key={`idea-${currentStep}-${idx}`}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ ...spring, delay: idx * 0.03 }}
                          style={{
                            padding: '12px 16px',
                            borderRadius: '12px',
                            background: 'rgba(255,255,255,0.02)',
                            border: `1px solid ${step.color}18`,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '12px',
                          }}
                        >
                          <p style={{
                            fontSize: '14px',
                            color: '#e0e2f0',
                            margin: 0,
                            flex: 1,
                            lineHeight: '1.5',
                          }}>
                            {idea}
                          </p>
                          {ideaEfforts[currentStep]?.[idx] && (
                            <DepthDots effort={ideaEfforts[currentStep][idx]} />
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </AnimatePresence>

          {/* ── Navigation ────────────────────────── */}
          <div className="no-print" style={{
            display: 'flex',
            gap: '10px',
            justifyContent: 'center',
            paddingTop: '16px',
            borderTop: '1px solid rgba(255,255,255,0.04)',
          }}>
            <motion.button
              onClick={prevStep}
              disabled={currentStep === 0}
              whileHover={currentStep > 0 ? { scale: 1.04 } : {}}
              whileTap={currentStep > 0 ? { scale: 0.96 } : {}}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: '600',
                borderRadius: '10px',
                border: 'none',
                background: currentStep === 0 ? '#1a1d2a' : '#2a2d3a',
                color: currentStep === 0 ? '#4a4d5a' : '#e8eaf0',
                cursor: currentStep === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              ← Back
            </motion.button>

            <motion.button
              onClick={nextStep}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              style={{
                padding: '10px 24px',
                fontSize: '14px',
                fontWeight: '600',
                borderRadius: '10px',
                border: 'none',
                background: `linear-gradient(135deg, ${step.color}, ${step.color}cc)`,
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              {currentStep === 6 ? 'See Results →' : 'Next Step →'}
            </motion.button>
          </div>
        </div>

        {/* ── Micro-feedback toast ─────────────────── */}
        <AnimatePresence>
          {microFeedback && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              transition={springBouncy}
              style={{
                position: 'fixed',
                bottom: '32px',
                right: '24px',
                padding: '12px 20px',
                borderRadius: '14px',
                background: microFeedback.effort === 'high'
                  ? 'linear-gradient(135deg, #7c3aed, #a855f7)'
                  : microFeedback.effort === 'medium'
                    ? 'linear-gradient(135deg, #3b82f6, #60a5fa)'
                    : 'linear-gradient(135deg, #d97706, #f59e0b)',
                color: '#fff',
                fontWeight: '600',
                fontSize: '14px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                zIndex: 50,
              }}
            >
              {microFeedback.message}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Save status */}
        <AnimatePresence>
          {session.saveStatus !== 'idle' && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'fixed',
                top: '16px',
                right: '16px',
                fontSize: '12px',
                fontWeight: '500',
                padding: '6px 10px',
                borderRadius: '8px',
                zIndex: 1000,
                background: session.saveStatus === 'error' ? '#dc26261a' : '#10b98114',
                color: session.saveStatus === 'error' ? '#ef4444' : '#10b981',
              }}
            >
              {session.saveStatus === 'saving' && '⟳ Saving...'}
              {session.saveStatus === 'saved' && '✓ Saved'}
              {session.saveStatus === 'error' && '✕ Save failed'}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════
  // SUMMARY SCREEN
  // ═══════════════════════════════════════════════════
  return (
    <div style={{ ...baseStyle, padding: 'clamp(20px, 4vw, 40px) clamp(16px, 3vw, 24px)' }}>
      {/* Save status */}
      {session.saveStatus !== 'idle' && (
        <div style={{
          position: 'fixed', top: '16px', right: '16px',
          fontSize: '12px', fontWeight: '500', padding: '6px 10px', borderRadius: '8px', zIndex: 1000,
          background: session.saveStatus === 'error' ? '#dc26261a' : '#10b98114',
          color: session.saveStatus === 'error' ? '#ef4444' : '#10b981',
        }}>
          {session.saveStatus === 'saving' && '⟳ Saving...'}
          {session.saveStatus === 'saved' && '✓ Saved'}
          {session.saveStatus === 'error' && '✕ Save failed'}
        </div>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        style={{ maxWidth: '800px', margin: '0 auto' }}
      >
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springGentle}
          style={{ textAlign: 'center', marginBottom: '40px' }}
        >
          <h2 style={{
            fontSize: 'clamp(28px, 6vw, 36px)',
            fontWeight: '800',
            marginBottom: '12px',
            background: 'linear-gradient(135deg, #a855f7, #ec4899)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            Your SCAMPER Ideas
          </h2>
          <p style={{ fontSize: '16px', color: '#8b8da8' }}>
            Challenge: <strong style={{ color: '#c8cce0' }}>{challenge}</strong>
          </p>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ...springBouncy, delay: 0.2 }}
            style={{
              display: 'inline-flex',
              gap: '24px',
              marginTop: '20px',
              padding: '12px 28px',
              borderRadius: '14px',
              background: 'rgba(168,85,247,0.08)',
              border: '1px solid rgba(168,85,247,0.15)',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#a855f7' }}>{totalIdeas}</div>
              <div style={{ fontSize: '11px', color: '#8b8da8', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ideas</div>
            </div>
            <div style={{ width: '1px', background: 'rgba(168,85,247,0.2)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#a855f7' }}>
                {STEPS.filter((_, i) => (ideas[i] || []).length > 0).length}
              </div>
              <div style={{ fontSize: '11px', color: '#8b8da8', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Steps used</div>
            </div>
          </motion.div>
        </motion.div>

        {/* ── Pick Best Ideas ──────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springGentle, delay: 0.15 }}
        >
          <GlassCard color="#a855f7" style={{ padding: '24px', marginBottom: '32px' }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '700',
              color: '#a855f7',
              marginTop: 0,
              marginBottom: '12px',
            }}>
              Pick Your Best Ideas
            </h3>
            <p style={{ fontSize: '14px', color: '#8b8da8', marginBottom: '16px' }}>
              Star your top 3 ideas — the ones with the most potential.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
              {STEPS.map((s, stepIdx) =>
                ideas[stepIdx] && ideas[stepIdx].length > 0 && (
                  <div key={stepIdx}>
                    <p style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      color: s.color,
                      marginBottom: '8px',
                      marginTop: 0,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}>
                      {s.word}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {ideas[stepIdx].map((idea, ideaIdx) => {
                        const ideaId = `${stepIdx}-${ideaIdx}`;
                        const isSelected = selectedBestIdeas.has(ideaId);
                        return (
                          <motion.div
                            key={ideaId}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            onClick={() => {
                              const newSet = new Set(selectedBestIdeas);
                              if (newSet.has(ideaId)) newSet.delete(ideaId);
                              else if (newSet.size < 3) newSet.add(ideaId);
                              setSelectedBestIdeas(newSet);
                            }}
                            style={{
                              padding: '12px 14px',
                              borderRadius: '10px',
                              background: isSelected ? `${s.color}15` : 'rgba(255,255,255,0.02)',
                              border: isSelected ? `2px solid ${s.color}` : '1px solid rgba(255,255,255,0.06)',
                              display: 'flex',
                              gap: '12px',
                              alignItems: 'center',
                              cursor: 'pointer',
                              transition: 'border-color 0.2s, background 0.2s',
                            }}
                          >
                            <motion.span
                              animate={{ scale: isSelected ? [1, 1.3, 1] : 1 }}
                              transition={{ duration: 0.3 }}
                              style={{
                                fontSize: '18px',
                                color: isSelected ? s.color : '#4a4d5a',
                                flexShrink: 0,
                              }}
                            >
                              {isSelected ? '★' : '☆'}
                            </motion.span>
                            <p style={{ margin: 0, fontSize: '14px', color: '#e0e2f0', flex: 1, lineHeight: '1.5' }}>
                              {idea}
                            </p>
                            {ideaEfforts[stepIdx]?.[ideaIdx] && (
                              <DepthDots effort={ideaEfforts[stepIdx][ideaIdx]} />
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )
              )}
            </div>

            <AnimatePresence>
              {selectedBestIdeas.size === 3 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  style={{ overflow: 'hidden' }}
                >
                  <label style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#c8cce0',
                    marginBottom: '8px',
                  }}>
                    Why did you choose these 3?
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
                      borderRadius: '10px',
                      border: '1px solid rgba(168,85,247,0.25)',
                      background: 'rgba(15,17,25,0.6)',
                      color: '#e8eaf0',
                      resize: 'vertical',
                      minHeight: '80px',
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {selectedBestIdeas.size < 3 && (
              <p style={{ fontSize: '13px', color: '#6b6e82', fontStyle: 'italic', margin: 0 }}>
                Select {3 - selectedBestIdeas.size} more idea{selectedBestIdeas.size === 2 ? '' : 's'}
              </p>
            )}
          </GlassCard>
        </motion.div>

        {/* ── Per-step idea listing ───────────────── */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.08 } },
          }}
        >
          {STEPS.map((s, stepIdx) =>
            ideas[stepIdx] && ideas[stepIdx].length > 0 && (
              <motion.div
                key={stepIdx}
                variants={{
                  hidden: { opacity: 0, y: 16 },
                  visible: { opacity: 1, y: 0 },
                }}
                transition={springGentle}
                style={{ marginBottom: '24px' }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '10px',
                }}>
                  <span style={{
                    fontSize: '14px',
                    fontWeight: '700',
                    color: s.color,
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    background: `${s.color}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {s.letter}
                  </span>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: '700',
                    color: s.color,
                    margin: 0,
                  }}>
                    {s.word}
                    <span style={{ fontSize: '13px', color: '#6b6e82', fontWeight: 500, marginLeft: '8px' }}>
                      ({ideas[stepIdx].length})
                    </span>
                  </h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {ideas[stepIdx].map((idea, ideaIdx) => (
                    <div key={ideaIdx} style={{
                      padding: '12px 16px',
                      borderRadius: '10px',
                      background: 'rgba(255,255,255,0.02)',
                      border: `1px solid ${s.color}12`,
                      lineHeight: '1.6',
                      color: '#d8dce6',
                      fontSize: '14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px',
                    }}>
                      <span style={{ flex: 1 }}>{idea}</span>
                      {ideaEfforts[stepIdx]?.[ideaIdx] && (
                        <DepthDots effort={ideaEfforts[stepIdx][ideaIdx]} />
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )
          )}
        </motion.div>

        {/* ── AI Insights ─────────────────────────── */}
        <AnimatePresence>
          {loadingInsights && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                textAlign: 'center',
                padding: '24px',
                marginBottom: '24px',
              }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                style={{
                  width: 24, height: 24, borderRadius: '50%',
                  border: '2px solid #a855f740',
                  borderTopColor: '#a855f7',
                  margin: '0 auto 12px',
                }}
              />
              <span style={{ fontSize: '14px', color: '#8b8da8' }}>Generating insights...</span>
            </motion.div>
          )}

          {insights && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={springGentle}
            >
              <GlassCard color="#8b5cf6" style={{
                padding: '24px',
                marginBottom: '32px',
                lineHeight: '1.8',
                color: '#c8cce0',
                fontSize: '14px',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '12px',
                }}>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: '8px',
                    background: 'rgba(139,92,246,0.15)',
                    color: '#8b5cf6',
                    letterSpacing: '0.5px',
                  }}>
                    AI INSIGHTS
                  </span>
                </div>
                <TypewriterText text={insights} speed={12} color="#c8cce0" />
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Actions ─────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'center',
          }}
        >
          <motion.button
            onClick={startOver}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            style={{
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: '600',
              borderRadius: '10px',
              border: 'none',
              background: '#2a2d3a',
              color: '#e8eaf0',
              cursor: 'pointer',
            }}
          >
            Start Over
          </motion.button>

          <motion.button
            onClick={() => window.print()}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            style={{
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: '600',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(135deg, #a855f7, #8b5cf6)',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Print Results
          </motion.button>
        </motion.div>
      </motion.div>
    </div>
  );
}
