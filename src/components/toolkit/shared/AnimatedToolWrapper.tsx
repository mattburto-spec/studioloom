"use client";

import { motion } from "framer-motion";
import type { ReactNode, CSSProperties } from "react";

const screenSpring = { type: "spring" as const, stiffness: 400, damping: 28 };

/**
 * Wrap any tool screen's outermost container with animated entrance.
 * Drop-in replacement for a plain `<div>`:
 *
 *   Before: <div style={{ background: '#06060f', ... }}>
 *   After:  <AnimatedScreen screenKey="intro" style={{ background: '#06060f', ... }}>
 *
 * Each screen gets a smooth fade+slide transition.
 */
export function AnimatedScreen({
  children,
  screenKey,
  style,
  className,
}: {
  children: ReactNode;
  screenKey: string;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <motion.div
      key={screenKey}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={screenSpring}
      style={style}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Wrap idea/observation cards for spring-in animation.
 *
 *   Before: <div key={id} style={{ ... }}>idea content</div>
 *   After:  <AnimatedCard index={i} style={{ ... }}>idea content</AnimatedCard>
 */
export function AnimatedCard({
  children,
  index = 0,
  style,
  className,
}: {
  children: ReactNode;
  index?: number;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        type: "spring",
        stiffness: 500,
        damping: 24,
        delay: Math.min(index * 0.03, 0.12),
      }}
      whileHover={{ y: -1, transition: { duration: 0.15 } }}
      style={style}
      className={className}
      layout
    >
      {children}
    </motion.div>
  );
}

/**
 * Animated number that bounces when it changes.
 */
export function AnimatedNumber({
  value,
  style,
}: {
  value: number;
  style?: CSSProperties;
}) {
  return (
    <motion.span
      key={value}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 20 }}
      style={{ display: "inline-block", ...style }}
    >
      {value}
    </motion.span>
  );
}
