'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { QuestPhase } from '@/lib/quest/types';

interface PhaseTransitionProps {
  phase: QuestPhase;
  isVisible: boolean;
  onComplete?: () => void;
}

const PHASE_CONFIG: Record<
  QuestPhase,
  {
    emoji: string;
    label: string;
    subtitle: string;
    baseColor: string;
    glowColor: string;
  }
> = {
  not_started: {
    emoji: '🌟',
    label: 'Quest Begins',
    subtitle: 'Your Journey Awaits',
    baseColor: '#6B7280',
    glowColor: '#D1D5DB',
  },
  discovery: {
    emoji: '🔍',
    label: 'Discovery',
    subtitle: 'Find Your Path',
    baseColor: '#F59E0B',
    glowColor: '#FCD34D',
  },
  planning: {
    emoji: '📋',
    label: 'Planning',
    subtitle: 'Chart Your Course',
    baseColor: '#6366F1',
    glowColor: '#A5B4FC',
  },
  working: {
    emoji: '⚡',
    label: 'Working',
    subtitle: 'Build Your Vision',
    baseColor: '#10B981',
    glowColor: '#6EE7B7',
  },
  sharing: {
    emoji: '🎤',
    label: 'Sharing',
    subtitle: 'Show The World',
    baseColor: '#8B5CF6',
    glowColor: '#C4B5FD',
  },
  completed: {
    emoji: '🏆',
    label: 'Quest Complete',
    subtitle: 'Journey Complete!',
    baseColor: '#EC4899',
    glowColor: '#F9A8D4',
  },
};

export default function PhaseTransition({
  phase,
  isVisible,
  onComplete,
}: PhaseTransitionProps) {
  const config = PHASE_CONFIG[phase];

  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onComplete?.();
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="phase-transition"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 50,
            backgroundColor: `rgba(0, 0, 0, 0.7)`,
            backdropFilter: 'blur(8px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '24px',
          }}
        >
          {/* Phase icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{
              type: 'spring',
              stiffness: 200,
              damping: 15,
            }}
            style={{
              fontSize: '80px',
              filter: `drop-shadow(0 0 20px ${config.baseColor}80)`,
            }}
          >
            {config.emoji}
          </motion.div>

          {/* Phase label */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            style={{
              textAlign: 'center',
            }}
          >
            <h2
              style={{
                fontSize: '28px',
                fontWeight: 'bold',
                color: config.glowColor,
                margin: 0,
                textTransform: 'uppercase',
                letterSpacing: '0.2em',
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              {config.label}
            </h2>
            <p
              style={{
                fontSize: '16px',
                color: '#cbd5e1',
                margin: '8px 0 0 0',
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              {config.subtitle}
            </p>
          </motion.div>

          {/* Color burst particles */}
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const angle = (i / 6) * Math.PI * 2;
            const distance = 100;
            const x = Math.cos(angle) * distance;
            const y = Math.sin(angle) * distance;

            return (
              <motion.div
                key={`burst-${i}`}
                initial={{
                  x: 0,
                  y: 0,
                  opacity: 1,
                  scale: 1,
                }}
                animate={{
                  x,
                  y,
                  opacity: 0,
                  scale: 0,
                }}
                transition={{
                  delay: 0.4,
                  duration: 1.2,
                  ease: 'easeOut',
                }}
                style={{
                  position: 'absolute',
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: config.glowColor,
                  pointerEvents: 'none',
                }}
              />
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
