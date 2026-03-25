'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ProfileBuilderProps {
  strengths: string[];
  interests: string[];
  needs: string[];
  archetype?: string | null;
  projectIdea?: string | null;
  compact?: boolean;
}

const categoryConfig = {
  strengths: {
    label: 'Strengths',
    color: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.2)',
  },
  interests: {
    label: 'Interests',
    color: '#60A5FA',
    bgColor: 'rgba(96, 165, 250, 0.2)',
  },
  needs: {
    label: 'Needs',
    color: '#34D399',
    bgColor: 'rgba(52, 211, 153, 0.2)',
  },
};

const archetypeConfig: Record<
  string,
  { color: string; icon: string; label: string }
> = {
  maker: {
    color: '#EC4899',
    icon: '🔨',
    label: 'The Maker',
  },
  thinker: {
    color: '#8B5CF6',
    icon: '💭',
    label: 'The Thinker',
  },
  connector: {
    color: '#06B6D4',
    icon: '🤝',
    label: 'The Connector',
  },
  leader: {
    color: '#F59E0B',
    icon: '👑',
    label: 'The Leader',
  },
  explorer: {
    color: '#10B981',
    icon: '🧭',
    label: 'The Explorer',
  },
};

export function ProfileBuilder({
  strengths,
  interests,
  needs,
  archetype,
  projectIdea,
  compact,
}: ProfileBuilderProps) {
  if (compact) {
    return (
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          alignItems: 'center',
        }}
      >
        <AnimatePresence>
          {strengths.map((item, idx) => (
            <motion.div
              key={`strength-${idx}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{
                type: 'spring',
                stiffness: 400,
                damping: 30,
                delay: idx * 0.05,
              }}
              style={{
                backgroundColor: categoryConfig.strengths.bgColor,
                color: categoryConfig.strengths.color,
                padding: '4px 12px',
                borderRadius: '16px',
                fontSize: '12px',
                fontWeight: '500',
                border: `1px solid ${categoryConfig.strengths.color}`,
              }}
            >
              {item}
            </motion.div>
          ))}
          {interests.map((item, idx) => (
            <motion.div
              key={`interest-${idx}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{
                type: 'spring',
                stiffness: 400,
                damping: 30,
                delay: (strengths.length + idx) * 0.05,
              }}
              style={{
                backgroundColor: categoryConfig.interests.bgColor,
                color: categoryConfig.interests.color,
                padding: '4px 12px',
                borderRadius: '16px',
                fontSize: '12px',
                fontWeight: '500',
                border: `1px solid ${categoryConfig.interests.color}`,
              }}
            >
              {item}
            </motion.div>
          ))}
          {needs.map((item, idx) => (
            <motion.div
              key={`need-${idx}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{
                type: 'spring',
                stiffness: 400,
                damping: 30,
                delay: (strengths.length + interests.length + idx) * 0.05,
              }}
              style={{
                backgroundColor: categoryConfig.needs.bgColor,
                color: categoryConfig.needs.color,
                padding: '4px 12px',
                borderRadius: '16px',
                fontSize: '12px',
                fontWeight: '500',
                border: `1px solid ${categoryConfig.needs.color}`,
              }}
            >
              {item}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    );
  }

  // Full view (non-compact)
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      style={{
        backgroundColor: '#1a1035',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        padding: '24px',
        color: '#fff',
      }}
    >
      {/* Archetype badge */}
      {archetype && archetypeConfig[archetype] && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '16px',
            padding: '8px 16px',
            borderRadius: '20px',
            backgroundColor: archetypeConfig[archetype].color,
            color: '#fff',
            fontSize: '14px',
            fontWeight: '600',
          }}
        >
          <span>{archetypeConfig[archetype].icon}</span>
          {archetypeConfig[archetype].label}
        </motion.div>
      )}

      {/* Strengths section */}
      <div style={{ marginBottom: '24px' }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: categoryConfig.strengths.color,
            marginBottom: '12px',
            opacity: 0.8,
          }}
        >
          {categoryConfig.strengths.label}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <AnimatePresence>
            {strengths.map((item, idx) => (
              <motion.div
                key={`strength-${idx}`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{
                  type: 'spring',
                  stiffness: 400,
                  damping: 30,
                  delay: idx * 0.05,
                }}
                style={{
                  backgroundColor: categoryConfig.strengths.bgColor,
                  color: categoryConfig.strengths.color,
                  padding: '6px 14px',
                  borderRadius: '18px',
                  fontSize: '13px',
                  fontWeight: '500',
                  border: `1px solid ${categoryConfig.strengths.color}`,
                }}
              >
                {item}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Interests section */}
      <div style={{ marginBottom: '24px' }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: categoryConfig.interests.color,
            marginBottom: '12px',
            opacity: 0.8,
          }}
        >
          {categoryConfig.interests.label}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <AnimatePresence>
            {interests.map((item, idx) => (
              <motion.div
                key={`interest-${idx}`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{
                  type: 'spring',
                  stiffness: 400,
                  damping: 30,
                  delay: (strengths.length + idx) * 0.05,
                }}
                style={{
                  backgroundColor: categoryConfig.interests.bgColor,
                  color: categoryConfig.interests.color,
                  padding: '6px 14px',
                  borderRadius: '18px',
                  fontSize: '13px',
                  fontWeight: '500',
                  border: `1px solid ${categoryConfig.interests.color}`,
                }}
              >
                {item}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Needs section */}
      <div style={{ marginBottom: '24px' }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: categoryConfig.needs.color,
            marginBottom: '12px',
            opacity: 0.8,
          }}
        >
          {categoryConfig.needs.label}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <AnimatePresence>
            {needs.map((item, idx) => (
              <motion.div
                key={`need-${idx}`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{
                  type: 'spring',
                  stiffness: 400,
                  damping: 30,
                  delay: (strengths.length + interests.length + idx) * 0.05,
                }}
                style={{
                  backgroundColor: categoryConfig.needs.bgColor,
                  color: categoryConfig.needs.color,
                  padding: '6px 14px',
                  borderRadius: '18px',
                  fontSize: '13px',
                  fontWeight: '500',
                  border: `1px solid ${categoryConfig.needs.color}`,
                }}
              >
                {item}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Project idea quote block */}
      {projectIdea && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            type: 'spring',
            stiffness: 300,
            damping: 30,
            delay: 0.2,
          }}
          style={{
            borderLeft: '3px solid rgba(96, 165, 250, 0.6)',
            paddingLeft: '16px',
            marginTop: '16px',
            color: 'rgba(255, 255, 255, 0.85)',
            fontSize: '14px',
            fontStyle: 'italic',
            lineHeight: '1.6',
          }}
        >
          "{projectIdea}"
        </motion.div>
      )}
    </motion.div>
  );
}
