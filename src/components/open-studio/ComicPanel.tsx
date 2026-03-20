"use client";

import { motion } from "framer-motion";
import { type ReactNode } from "react";

/**
 * ComicPanel — a single panel in the Open Studio Discovery comic strip.
 *
 * Design principles (from Scott McCloud's Understanding Comics):
 * - Panels = moments in time. The gutter (gap) between panels is where
 *   the reader fills in what happened. This "closure" makes the reader
 *   an active participant, not a passive viewer.
 * - Panel transitions: moment-to-moment (same scene, slight change),
 *   action-to-action (progressing), subject-to-subject (perspective shift).
 * - The comic format makes AI conversation feel like a JOURNEY the student
 *   is on, not a chat with a bot.
 *
 * Each panel has:
 * - A scene background (changes per Discovery step)
 * - A character avatar (mentor or student)
 * - A speech/thought bubble with content
 * - Sequential reveal animation (panels build the strip)
 */

interface ComicPanelProps {
  /** Who's speaking: the AI mentor or the student */
  speaker: "mentor" | "student";
  /** The message content */
  children: ReactNode;
  /** Which Discovery step this panel belongs to */
  step: string;
  /** Panel index in the conversation (for stagger timing) */
  index: number;
  /** Is this the first panel of a new step? Shows chapter divider */
  isStepStart?: boolean;
  /** Step label for chapter divider */
  stepLabel?: string;
  /** Step icon for chapter divider */
  stepIcon?: string;
}

// Scene backgrounds per step — gradients that evoke the journey stage
const STEP_SCENES: Record<string, { bg: string; accent: string; scene: string }> = {
  strengths: {
    bg: "linear-gradient(180deg, #1a1035 0%, #2d1b69 100%)",
    accent: "#a78bfa",
    scene: "🗺️", // treasure map — discovering what you have
  },
  interests: {
    bg: "linear-gradient(180deg, #1a2744 0%, #1e3a5f 100%)",
    accent: "#60a5fa",
    scene: "🧭", // compass — finding direction
  },
  needs: {
    bg: "linear-gradient(180deg, #1a3328 0%, #1b4d3e 100%)",
    accent: "#34d399",
    scene: "🔭", // telescope — looking outward
  },
  narrowing: {
    bg: "linear-gradient(180deg, #3b1a1a 0%, #5a2d2d 100%)",
    accent: "#f97316",
    scene: "🔦", // spotlight — focusing in
  },
  commitment: {
    bg: "linear-gradient(180deg, #2d1b69 0%, #4c1d95 100%)",
    accent: "#c084fc",
    scene: "🚀", // launch — ready to go
  },
  complete: {
    bg: "linear-gradient(180deg, #1a1035 0%, #7c3aed 100%)",
    accent: "#a78bfa",
    scene: "🏆",
  },
};

// Mentor character design
const MENTOR_AVATAR = (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
    {/* Circle face */}
    <circle cx="20" cy="20" r="18" fill="#7c3aed" stroke="#a78bfa" strokeWidth="2" />
    {/* Eyes */}
    <circle cx="14" cy="17" r="2.5" fill="white" />
    <circle cx="26" cy="17" r="2.5" fill="white" />
    <circle cx="14.5" cy="17" r="1.2" fill="#1a1035" />
    <circle cx="26.5" cy="17" r="1.2" fill="#1a1035" />
    {/* Smile */}
    <path d="M13 25 C16 29, 24 29, 27 25" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
    {/* Hat (explorer/guide) */}
    <path d="M8 14 L20 4 L32 14" stroke="#c084fc" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    <line x1="20" y1="4" x2="20" y2="1" stroke="#c084fc" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// Student character design
const STUDENT_AVATAR = (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
    {/* Circle face */}
    <circle cx="20" cy="20" r="18" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
    {/* Eyes */}
    <circle cx="14" cy="17" r="2.5" fill="white" />
    <circle cx="26" cy="17" r="2.5" fill="white" />
    <circle cx="15" cy="17" r="1.2" fill="#1e293b" />
    <circle cx="27" cy="17" r="1.2" fill="#1e293b" />
    {/* Neutral/thinking mouth */}
    <line x1="15" y1="26" x2="25" y2="26" stroke="white" strokeWidth="2" strokeLinecap="round" />
    {/* Hair */}
    <path d="M8 14 C8 6, 32 6, 32 14" fill="#475569" stroke="none" />
  </svg>
);

export function ComicPanel({
  speaker,
  children,
  step,
  index,
  isStepStart = false,
  stepLabel,
  stepIcon,
}: ComicPanelProps) {
  const scene = STEP_SCENES[step] || STEP_SCENES.strengths;
  const isMentor = speaker === "mentor";

  return (
    <>
      {/* Chapter divider for new steps */}
      {isStepStart && stepLabel && (
        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 25, delay: index * 0.08 }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "12px 0",
            margin: "8px 0",
          }}
        >
          <div style={{ flex: 1, height: "2px", background: scene.accent, opacity: 0.3 }} />
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: index * 0.08 + 0.1 }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 16px",
              background: `${scene.accent}22`,
              border: `1.5px solid ${scene.accent}44`,
              borderRadius: "20px",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ fontSize: "16px" }}>{stepIcon}</span>
            <span style={{ fontSize: "12px", fontWeight: 700, color: scene.accent, letterSpacing: "0.05em", textTransform: "uppercase" }}>
              {stepLabel}
            </span>
          </motion.div>
          <div style={{ flex: 1, height: "2px", background: scene.accent, opacity: 0.3 }} />
        </motion.div>
      )}

      {/* The comic panel itself */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          type: "spring",
          stiffness: 260,
          damping: 24,
          delay: index * 0.08,
        }}
        style={{
          display: "flex",
          flexDirection: isMentor ? "row" : "row-reverse",
          alignItems: "flex-start",
          gap: "12px",
          maxWidth: "85%",
          alignSelf: isMentor ? "flex-start" : "flex-end",
        }}
      >
        {/* Character avatar */}
        <motion.div
          initial={{ scale: 0, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", delay: index * 0.08 + 0.05 }}
          style={{
            flexShrink: 0,
            width: "44px",
            height: "44px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: `2px solid ${isMentor ? scene.accent : "#475569"}`,
            background: isMentor ? "#1a1035" : "#0f172a",
            boxShadow: `0 2px 8px ${isMentor ? scene.accent : "#475569"}33`,
          }}
        >
          {isMentor ? MENTOR_AVATAR : STUDENT_AVATAR}
        </motion.div>

        {/* Speech bubble — comic panel style */}
        <div
          style={{
            position: "relative",
            padding: "14px 18px",
            borderRadius: "16px",
            border: `2px solid ${isMentor ? scene.accent + "44" : "#47556944"}`,
            background: isMentor
              ? `linear-gradient(135deg, ${scene.accent}11, ${scene.accent}08)`
              : "linear-gradient(135deg, #1e293b88, #0f172a88)",
            fontSize: "14px",
            lineHeight: "1.6",
            color: "#e0e0e8",
            maxWidth: "100%",
            boxShadow: `0 4px 12px rgba(0,0,0,0.2)`,
          }}
        >
          {/* Speech bubble tail */}
          <div
            style={{
              position: "absolute",
              top: "14px",
              [isMentor ? "left" : "right"]: "-8px",
              width: "16px",
              height: "16px",
              background: isMentor
                ? `${scene.accent}11`
                : "#1e293b88",
              border: `2px solid ${isMentor ? scene.accent + "44" : "#47556944"}`,
              borderRight: isMentor ? "none" : undefined,
              borderTop: isMentor ? "none" : undefined,
              borderLeft: !isMentor ? "none" : undefined,
              borderBottom: !isMentor ? "none" : undefined,
              transform: "rotate(45deg)",
              clipPath: isMentor
                ? "polygon(0 0, 0 100%, 100% 100%)"
                : "polygon(100% 0, 0 0, 100% 100%)",
            }}
          />
          <div style={{ position: "relative", zIndex: 1 }}>
            {children}
          </div>
        </div>
      </motion.div>
    </>
  );
}

/**
 * StepTransition — full-width cinematic panel that appears
 * when the student moves to a new Discovery step.
 * Shows the two characters progressing on their journey.
 */
export function StepTransition({
  step,
  stepLabel,
  stepIcon,
  stepSubtitle,
}: {
  step: string;
  stepLabel: string;
  stepIcon: string;
  stepSubtitle: string;
}) {
  const scene = STEP_SCENES[step] || STEP_SCENES.strengths;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scaleY: 0.8 }}
      animate={{ opacity: 1, y: 0, scaleY: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      style={{
        background: scene.bg,
        borderRadius: "20px",
        border: `2px solid ${scene.accent}33`,
        padding: "32px 24px",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
        margin: "16px 0",
      }}
    >
      {/* Scene emoji as large background element */}
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", delay: 0.2 }}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          fontSize: "120px",
          opacity: 0.08,
          pointerEvents: "none",
        }}
      >
        {scene.scene}
      </motion.div>

      {/* Characters walking */}
      <motion.div
        initial={{ x: -60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: "spring", delay: 0.3 }}
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "16px",
          marginBottom: "16px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ transform: "scaleX(-1)" }}>{MENTOR_AVATAR}</div>
        {STUDENT_AVATAR}
      </motion.div>

      {/* Step info */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        style={{ position: "relative", zIndex: 1 }}
      >
        <div style={{ fontSize: "28px", marginBottom: "8px" }}>{stepIcon}</div>
        <h3
          style={{
            fontSize: "18px",
            fontWeight: 700,
            color: scene.accent,
            margin: "0 0 4px 0",
            letterSpacing: "0.02em",
          }}
        >
          {stepLabel}
        </h3>
        <p style={{ fontSize: "13px", color: "#a0a0b0", margin: 0 }}>
          {stepSubtitle}
        </p>
      </motion.div>

      {/* Dotted path below characters */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.5, duration: 0.6 }}
        style={{
          position: "absolute",
          bottom: "12px",
          left: "10%",
          right: "10%",
          height: "2px",
          background: `repeating-linear-gradient(90deg, ${scene.accent}44 0, ${scene.accent}44 6px, transparent 6px, transparent 12px)`,
        }}
      />
    </motion.div>
  );
}
