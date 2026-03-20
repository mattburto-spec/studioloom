"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Shared Framer Motion animation wrappers for all toolkit tools.
 * Import these into any tool component to get consistent, premium animations.
 *
 * Usage:
 *   import { ScreenTransition, IdeaCard, StaggerList, MicroToast, ProgressRing } from "@/components/toolkit/shared/ToolAnimations";
 */

// ─── Spring configs ───
const snappy = { type: "spring" as const, stiffness: 400, damping: 28 };
const bouncy = { type: "spring" as const, stiffness: 500, damping: 22 };
const gentle = { type: "spring" as const, stiffness: 300, damping: 26 };

// ─── Screen Transition ───
// Wraps each screen (intro, working, summary) with a slide + fade
export function ScreenTransition({
  children,
  screenKey,
  direction = "forward",
}: {
  children: ReactNode;
  screenKey: string;
  direction?: "forward" | "backward";
}) {
  const dx = direction === "forward" ? 60 : -60;
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={screenKey}
        initial={{ opacity: 0, x: dx, filter: "blur(4px)" }}
        animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
        exit={{ opacity: 0, x: -dx, filter: "blur(4px)" }}
        transition={{ ...snappy, filter: { duration: 0.2 } }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Idea Card ───
// Wraps individual idea/entry cards with a spring-in animation
export function IdeaCard({
  children,
  index = 0,
  color,
  className = "",
}: {
  children: ReactNode;
  index?: number;
  color?: string;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, x: -20 }}
      transition={{ ...bouncy, delay: Math.min(index * 0.03, 0.15) }}
      whileHover={{
        y: -2,
        boxShadow: color
          ? `0 4px 16px ${color}25`
          : "0 4px 16px rgba(0,0,0,0.08)",
      }}
      className={className}
      layout
    >
      {children}
    </motion.div>
  );
}

// ─── Stagger List ───
// Container for a list of items that stagger in
export function StaggerList({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: { staggerChildren: 0.04 },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Stagger item (use inside StaggerList)
export function StaggerItem({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 12, scale: 0.97 },
        visible: { opacity: 1, y: 0, scale: 1 },
      }}
      transition={gentle}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Micro Toast ───
// Animated feedback toast that slides in and auto-dismisses
export function MicroToast({
  visible,
  children,
  color = "#7B2FF2",
}: {
  visible: boolean;
  children: ReactNode;
  color?: string;
}) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95 }}
          transition={bouncy}
          style={{
            background: `${color}12`,
            border: `1px solid ${color}25`,
            borderRadius: 12,
            padding: "8px 14px",
            fontSize: 13,
            color: color,
            fontWeight: 500,
          }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Progress Ring ───
// Animated circular progress indicator (SVG)
export function ProgressRing({
  progress,
  size = 48,
  strokeWidth = 4,
  color = "#7B2FF2",
  bgColor = "#E5E7EB",
}: {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  color?: string;
  bgColor?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (progress / 100) * circumference;

  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={bgColor}
        strokeWidth={strokeWidth}
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        animate={{ strokeDashoffset: circumference - filled }}
        transition={gentle}
      />
    </svg>
  );
}

// ─── Step Indicator ───
// Animated step navigation with a sliding highlight
export function StepIndicator({
  steps,
  currentStep,
  color = "#7B2FF2",
  onStepClick,
}: {
  steps: Array<{ label: string; count?: number }>;
  currentStep: number;
  color?: string;
  onStepClick?: (index: number) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 4, position: "relative" }}>
      {steps.map((step, i) => {
        const isActive = i === currentStep;
        const isComplete = i < currentStep;
        return (
          <motion.button
            key={i}
            onClick={() => onStepClick?.(i)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            animate={{
              background: isActive ? color : isComplete ? `${color}20` : "rgba(255,255,255,0.08)",
              color: isActive ? "#fff" : isComplete ? color : "rgba(255,255,255,0.5)",
            }}
            transition={{ duration: 0.2 }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 14px",
              borderRadius: 20,
              border: "none",
              cursor: onStepClick ? "pointer" : "default",
              fontSize: 12,
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            {step.label}
            {step.count !== undefined && step.count > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={bouncy}
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  background: isActive ? "rgba(255,255,255,0.25)" : `${color}15`,
                  borderRadius: 8,
                  padding: "1px 6px",
                  minWidth: 18,
                  textAlign: "center",
                }}
              >
                {step.count}
              </motion.span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

// ─── Summary Card ───
// A card wrapper for summary sections that reveals with a stagger
export function SummaryCard({
  children,
  index = 0,
  className = "",
}: {
  children: ReactNode;
  index?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...gentle, delay: index * 0.08 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Counter ───
// Animated number counter (for stats in summary screens)
export function AnimatedCounter({
  value,
  label,
  color = "#7B2FF2",
  size = "large",
}: {
  value: number;
  label: string;
  color?: string;
  size?: "small" | "large";
}) {
  return (
    <div style={{ textAlign: "center" }}>
      <motion.span
        key={value}
        initial={{ opacity: 0, y: -10, scale: 0.8 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={bouncy}
        style={{
          display: "block",
          fontSize: size === "large" ? 36 : 24,
          fontWeight: 800,
          color,
          lineHeight: 1,
        }}
      >
        {value}
      </motion.span>
      <span
        style={{
          fontSize: size === "large" ? 11 : 10,
          fontWeight: 600,
          color: "rgba(255,255,255,0.5)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginTop: 4,
          display: "block",
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ─── Depth Dots ───
// Animated quality indicator (1-3 dots)
export function DepthDots({
  depth,
  maxDepth = 3,
  color = "#7B2FF2",
}: {
  depth: number; // 1, 2, or 3
  maxDepth?: number;
  color?: string;
}) {
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
      {Array.from({ length: maxDepth }, (_, i) => (
        <motion.div
          key={i}
          animate={{
            scale: i < depth ? 1 : 0.6,
            background: i < depth ? color : "rgba(255,255,255,0.15)",
          }}
          transition={bouncy}
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
          }}
        />
      ))}
    </div>
  );
}
