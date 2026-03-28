'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QuestJourney, QuestMilestone, QuestEvidence } from '@/lib/quest/types';
import { PHASE_COLORS } from '@/lib/quest/color-system';
import { getMentor } from '@/lib/quest/mentors';

interface QuestCompletionCelebrationProps {
  journey: QuestJourney;
  milestones: QuestMilestone[];
  evidence: QuestEvidence[];
  onClose: () => void;
  onViewPortfolio?: () => void;
}

// Counter animation hook
function useCountUp(target: number, duration: number = 1500): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setCount(Math.round(eased * target));
      if (progress >= 1) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return count;
}

// Confetti particle component
function ConfettiPiece({
  index,
  delay,
}: {
  index: number;
  delay: number;
}) {
  const colors = [
    PHASE_COLORS.discovery,
    PHASE_COLORS.planning,
    PHASE_COLORS.working,
    PHASE_COLORS.sharing,
    PHASE_COLORS.completed,
  ];
  const color = colors[index % colors.length];
  const startX = Math.random() * 100;
  const rotation = Math.random() * 720;
  const duration = 3 + Math.random() * 3;
  const size = 6 + Math.random() * 8;
  const isSquare = Math.random() > 0.5;

  return (
    <motion.div
      key={`confetti-${index}`}
      initial={{
        x: `${startX}vw`,
        y: '-20vh',
        opacity: 1,
        rotate: 0,
      }}
      animate={{
        y: '110vh',
        rotate: rotation,
        opacity: 0,
      }}
      transition={{
        duration,
        delay: 0.05 + delay * 0.02,
        ease: 'easeIn',
      }}
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        pointerEvents: 'none',
        zIndex: 100,
      }}
    >
      {isSquare ? (
        <div
          style={{
            width: `${size}px`,
            height: `${size}px`,
            backgroundColor: color.baseColor,
            borderRadius: '2px',
          }}
        />
      ) : (
        <div
          style={{
            width: `${size}px`,
            height: `${size}px`,
            backgroundColor: color.baseColor,
            borderRadius: '50%',
          }}
        />
      )}
    </motion.div>
  );
}

// Color burst background animation
function ColorBurstBackground() {
  const phaseSequence = [
    PHASE_COLORS.discovery,
    PHASE_COLORS.planning,
    PHASE_COLORS.working,
    PHASE_COLORS.sharing,
    PHASE_COLORS.completed,
  ];

  return (
    <motion.div
      initial={{
        background: `
          radial-gradient(
            circle at 50% 50%,
            rgba(0, 0, 0, 0.9) 0%,
            rgba(0, 0, 0, 1) 100%
          )
        `,
      }}
      animate={{
        background: `
          radial-gradient(
            circle at 50% 50%,
            rgba(139, 92, 246, 0.15) 0%,
            rgba(30, 144, 255, 0.1) 40%,
            rgba(0, 0, 0, 0.95) 100%
          )
        `,
      }}
      transition={{
        duration: 2,
        ease: 'easeOut',
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
      }}
    />
  );
}

// Stats card component
function StatCard({
  icon,
  label,
  value,
  delay,
}: {
  icon: string;
  label: string;
  value: number;
  delay: number;
}) {
  const displayValue = useCountUp(value, 1500);

  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 20,
        scale: 0.8,
      }}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
      }}
      transition={{
        delay: 2 + delay,
        duration: 0.6,
        ease: 'backOut',
      }}
      style={{
        backgroundColor: 'rgba(30, 27, 50, 0.8)',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        borderRadius: '12px',
        padding: '20px',
        textAlign: 'center',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div
        style={{
          fontSize: '32px',
          marginBottom: '8px',
        }}
      >
        {icon}
      </div>
      <div
        style={{
          fontSize: '32px',
          fontWeight: 'bold',
          color: '#fff',
          marginBottom: '8px',
        }}
      >
        {displayValue}
      </div>
      <div
        style={{
          fontSize: '12px',
          color: 'rgba(255, 255, 255, 0.7)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        {label}
      </div>
    </motion.div>
  );
}

// Mentor farewell section
function MentorFarewell({
  journey,
  onViewPortfolio,
  onClose,
}: {
  journey: QuestJourney;
  onViewPortfolio?: () => void;
  onClose: () => void;
}) {
  const mentor = getMentor(journey.mentor_id);
  const mentorColor = mentor?.primaryColor || '#8b5cf6';

  // Generate personalized farewell based on mentor's celebration style
  let farewell = '';
  const mentorName = mentor?.name || 'Guide';

  if (mentor?.celebrationStyle === 'maker') {
    farewell = `Look at what you made. Not just the final output—the whole journey. Every iteration, every decision, every moment you kept going when it was hard. That's the real creation here. ${mentorName} is genuinely proud.`;
  } else if (mentor?.celebrationStyle === 'questioner') {
    farewell = `Do you realize what you figured out? You didn't just complete a quest—you learned how YOU learn. Your instincts are sharper now. Your thinking is clearer. That's the breakthrough moment. ${mentorName} knew you'd get here.`;
  } else if (mentor?.celebrationStyle === 'storyteller') {
    farewell = `Remember where you started? Full of questions, uncertain which direction to go. Now look at where you are. You didn't just move—you transformed. Every chapter of your journey led here. That arc? That's *your* story. ${mentorName} is honored to have been part of it.`;
  } else if (mentor?.celebrationStyle === 'provocateur') {
    farewell = `THAT was brave. Not just the final push—all of it. The risks you took, the weird ideas you tried, the moments you could've quit but didn't. You didn't play it safe. And it paid off. ${mentorName} doesn't celebrate many things, but this? This is worth celebrating.`;
  } else {
    farewell = `Pause for a moment and just notice what happened here. The quiet work, the consistent effort, the small decisions that added up. You did this. Steady, thoughtful, real. ${mentorName} has been watching, and wants you to know: this matters.`;
  }

  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 40,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      transition={{
        delay: 5,
        duration: 0.8,
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '24px',
        marginTop: '40px',
      }}
    >
      {/* Mentor avatar */}
      <motion.div
        initial={{
          scale: 0,
          rotate: -180,
        }}
        animate={{
          scale: 1,
          rotate: 0,
        }}
        transition={{
          delay: 4.8,
          duration: 0.6,
          ease: 'backOut',
        }}
        style={{
          width: '80px',
          height: '80px',
          backgroundColor: mentorColor,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '32px',
          fontWeight: 'bold',
          color: '#fff',
          border: `3px solid ${mentorColor}`,
          boxShadow: `0 0 30px ${mentorColor}80`,
        }}
      >
        {mentor?.name.charAt(0) || '?'}
      </motion.div>

      {/* Mentor farewell message */}
      <motion.div
        initial={{
          opacity: 0,
        }}
        animate={{
          opacity: 1,
        }}
        transition={{
          delay: 5.2,
          duration: 0.8,
        }}
        style={{
          maxWidth: '600px',
          textAlign: 'center',
          fontSize: '16px',
          lineHeight: '1.6',
          color: 'rgba(255, 255, 255, 0.9)',
          fontStyle: 'italic',
          backgroundColor: 'rgba(30, 27, 50, 0.6)',
          padding: '24px',
          borderRadius: '12px',
          border: `1px solid ${mentorColor}40`,
        }}
      >
        {farewell}
      </motion.div>

      {/* Action buttons */}
      <motion.div
        initial={{
          opacity: 0,
          y: 20,
        }}
        animate={{
          opacity: 1,
          y: 0,
        }}
        transition={{
          delay: 5.6,
          duration: 0.6,
        }}
        style={{
          display: 'flex',
          gap: '16px',
          justifyContent: 'center',
          flexWrap: 'wrap',
          marginTop: '16px',
        }}
      >
        {onViewPortfolio && (
          <motion.button
            onClick={onViewPortfolio}
            whileHover={{
              scale: 1.05,
              boxShadow: `0 0 20px ${mentorColor}`,
            }}
            whileTap={{
              scale: 0.95,
            }}
            style={{
              padding: '12px 28px',
              backgroundColor: mentorColor,
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              transition: 'all 0.2s ease',
            }}
          >
            📚 View My Portfolio
          </motion.button>
        )}
        <motion.button
          onClick={onClose}
          whileHover={{
            scale: 1.05,
          }}
          whileTap={{
            scale: 0.95,
          }}
          style={{
            padding: '12px 28px',
            backgroundColor: 'transparent',
            color: mentorColor,
            border: `2px solid ${mentorColor}`,
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            transition: 'all 0.2s ease',
          }}
        >
          ← Back to Dashboard
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

export function QuestCompletionCelebration({
  journey,
  milestones,
  evidence,
  onClose,
  onViewPortfolio,
}: QuestCompletionCelebrationProps) {
  const mentor = getMentor(journey.mentor_id);
  const mentorColor = mentor?.primaryColor || '#8b5cf6';

  // Calculate days on journey
  const startDate = new Date(journey.started_at);
  const endDate = new Date();
  const daysOnJourney = Math.max(
    1,
    Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  );

  // Count completed milestones
  const completedCount = milestones.filter((m) => m.completed_at).length;

  // Get evidence count
  const evidenceCount = evidence.length;

  // Get total sessions (from journey or calculate from milestones)
  const totalSessions = journey.total_sessions || milestones.length || 1;

  return (
    <AnimatePresence>
      <motion.div
        initial={{
          opacity: 0,
        }}
        animate={{
          opacity: 1,
        }}
        exit={{
          opacity: 0,
        }}
        transition={{
          duration: 0.3,
        }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1000,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Background with color burst */}
        <ColorBurstBackground />

        {/* Confetti */}
        {Array.from({ length: 40 }).map((_, i) => (
          <ConfettiPiece key={`confetti-${i}`} index={i} delay={i} />
        ))}

        {/* Main content */}
        <motion.div
          initial={{
            opacity: 0,
            scale: 0.9,
          }}
          animate={{
            opacity: 1,
            scale: 1,
          }}
          transition={{
            delay: 1.5,
            duration: 0.8,
            ease: 'backOut',
          }}
          style={{
            position: 'relative',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 20px',
            maxWidth: '900px',
            maxHeight: '90vh',
            overflowY: 'auto',
          }}
        >
          {/* Title */}
          <motion.h1
            initial={{
              opacity: 0,
              y: -30,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              delay: 1.8,
              duration: 0.6,
            }}
            style={{
              fontSize: '48px',
              fontWeight: 'bold',
              color: '#fff',
              marginBottom: '8px',
              textAlign: 'center',
              background: `linear-gradient(135deg, ${mentorColor}, #ff1493)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Quest Complete!
          </motion.h1>

          {/* Mentor name */}
          <motion.p
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            transition={{
              delay: 2.1,
              duration: 0.5,
            }}
            style={{
              fontSize: '18px',
              color: 'rgba(255, 255, 255, 0.8)',
              marginBottom: '40px',
              fontStyle: 'italic',
            }}
          >
            with {mentor?.name || 'your guide'}
          </motion.p>

          {/* Stats grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '16px',
              width: '100%',
              marginBottom: '40px',
            }}
          >
            <StatCard icon="📅" label="Days on Quest" value={daysOnJourney} delay={0} />
            <StatCard icon="🎯" label="Milestones" value={completedCount} delay={0.15} />
            <StatCard icon="📸" label="Evidence" value={evidenceCount} delay={0.3} />
            <StatCard icon="💬" label="Conversations" value={totalSessions} delay={0.45} />
          </div>

          {/* Mentor farewell */}
          <MentorFarewell
            journey={journey}
            onViewPortfolio={onViewPortfolio}
            onClose={onClose}
          />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default QuestCompletionCelebration;
