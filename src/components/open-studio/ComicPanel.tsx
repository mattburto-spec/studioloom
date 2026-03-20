"use client";

import { motion } from "framer-motion";
import React, { type ReactNode } from "react";

/**
 * ComicPanel — visual comic strip panels for Open Studio Discovery.
 *
 * Inspired by Scott McCloud's "Understanding Comics" + the UX storyboard
 * style (illustrated scenes with speech bubbles and chapter headers).
 *
 * Each step in the Discovery journey has:
 * - A unique SVG scene illustration (background environment)
 * - Two characters: a guide/mentor and the student
 * - Proper comic panel borders (thick black/dark, rounded corners)
 * - Speech bubbles positioned over the scene
 * - Progressive reveal with spring animations
 */

// ─── Step Scene Config ───────────────────────────────────────────────
export const STEP_SCENES: Record<string, {
  bg: string;
  accent: string;
  sceneEmoji: string;
  headerBg: string;
}> = {
  strengths: {
    bg: "linear-gradient(180deg, #1a1035 0%, #2d1b69 50%, #1a1035 100%)",
    accent: "#a78bfa",
    sceneEmoji: "🗺️",
    headerBg: "#2d1b69",
  },
  interests: {
    bg: "linear-gradient(180deg, #0f2027 0%, #203a43 50%, #0f2027 100%)",
    accent: "#60a5fa",
    sceneEmoji: "🧭",
    headerBg: "#203a43",
  },
  needs: {
    bg: "linear-gradient(180deg, #0a2e1a 0%, #1b4d3e 50%, #0a2e1a 100%)",
    accent: "#34d399",
    sceneEmoji: "🔭",
    headerBg: "#1b4d3e",
  },
  narrowing: {
    bg: "linear-gradient(180deg, #2a1a0a 0%, #5a3d1a 50%, #2a1a0a 100%)",
    accent: "#f97316",
    sceneEmoji: "🔦",
    headerBg: "#5a3d1a",
  },
  commitment: {
    bg: "linear-gradient(180deg, #1a0a2e 0%, #4c1d95 50%, #1a0a2e 100%)",
    accent: "#c084fc",
    sceneEmoji: "🚀",
    headerBg: "#4c1d95",
  },
  complete: {
    bg: "linear-gradient(180deg, #1a1035 0%, #7c3aed 50%, #1a1035 100%)",
    accent: "#a78bfa",
    sceneEmoji: "🏆",
    headerBg: "#7c3aed",
  },
};

// ─── SVG Scene Illustrations ─────────────────────────────────────────
// Each step gets a unique background scene drawn as inline SVG.
// These are abstract/atmospheric — mountains, paths, stars, compass, etc.

function StrengthsScene() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", top: 0, left: 0, opacity: 0.15 }}>
      {/* Mountains */}
      <polygon points="0,200 80,60 160,200" fill="#a78bfa" />
      <polygon points="100,200 200,40 300,200" fill="#7c3aed" />
      <polygon points="240,200 340,80 400,200" fill="#a78bfa" />
      {/* Stars */}
      <circle cx="50" cy="30" r="2" fill="#e9d5ff" />
      <circle cx="150" cy="20" r="1.5" fill="#e9d5ff" />
      <circle cx="280" cy="25" r="2.5" fill="#e9d5ff" />
      <circle cx="350" cy="15" r="1.8" fill="#e9d5ff" />
      <circle cx="380" cy="40" r="1" fill="#e9d5ff" />
      {/* Treasure chest */}
      <rect x="170" y="150" width="60" height="40" rx="4" fill="#f59e0b" opacity="0.6" />
      <rect x="170" y="145" width="60" height="12" rx="4" fill="#fbbf24" opacity="0.6" />
    </svg>
  );
}

function InterestsScene() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", top: 0, left: 0, opacity: 0.15 }}>
      {/* Ocean waves */}
      <path d="M0,160 Q50,140 100,160 Q150,180 200,160 Q250,140 300,160 Q350,180 400,160 L400,200 L0,200 Z" fill="#60a5fa" />
      <path d="M0,175 Q60,155 120,175 Q180,195 240,175 Q300,155 360,175 Q380,185 400,175 L400,200 L0,200 Z" fill="#3b82f6" />
      {/* Compass */}
      <circle cx="200" cy="80" r="40" fill="none" stroke="#60a5fa" strokeWidth="2" />
      <circle cx="200" cy="80" r="35" fill="none" stroke="#60a5fa" strokeWidth="1" />
      <line x1="200" y1="45" x2="200" y2="55" stroke="#f59e0b" strokeWidth="3" />
      <line x1="200" y1="105" x2="200" y2="115" stroke="#60a5fa" strokeWidth="2" />
      <polygon points="200,50 195,80 205,80" fill="#f59e0b" />
      <polygon points="200,110 195,80 205,80" fill="#60a5fa" opacity="0.6" />
      {/* Stars */}
      <circle cx="60" cy="40" r="2" fill="#bfdbfe" />
      <circle cx="340" cy="30" r="1.5" fill="#bfdbfe" />
    </svg>
  );
}

function NeedsScene() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", top: 0, left: 0, opacity: 0.15 }}>
      {/* Trees / forest */}
      <polygon points="40,200 60,80 80,200" fill="#34d399" />
      <polygon points="90,200 120,60 150,200" fill="#10b981" />
      <polygon points="300,200 330,70 360,200" fill="#34d399" />
      <polygon points="340,200 370,90 400,200" fill="#10b981" />
      {/* Telescope */}
      <line x1="180" y1="160" x2="220" y2="80" stroke="#6ee7b7" strokeWidth="4" strokeLinecap="round" />
      <circle cx="225" cy="72" r="12" fill="none" stroke="#6ee7b7" strokeWidth="3" />
      {/* Ground */}
      <ellipse cx="200" cy="190" rx="180" ry="20" fill="#064e3b" opacity="0.5" />
    </svg>
  );
}

function NarrowingScene() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", top: 0, left: 0, opacity: 0.15 }}>
      {/* Spotlight cone */}
      <polygon points="200,20 100,200 300,200" fill="#f97316" opacity="0.3" />
      <circle cx="200" cy="20" r="15" fill="#f97316" />
      {/* Scattered dots narrowing */}
      <circle cx="80" cy="60" r="4" fill="#fdba74" opacity="0.3" />
      <circle cx="320" cy="50" r="3" fill="#fdba74" opacity="0.3" />
      <circle cx="60" cy="100" r="3" fill="#fdba74" opacity="0.2" />
      <circle cx="340" cy="110" r="4" fill="#fdba74" opacity="0.2" />
      <circle cx="160" cy="130" r="5" fill="#fb923c" opacity="0.5" />
      <circle cx="240" cy="140" r="5" fill="#fb923c" opacity="0.5" />
      <circle cx="200" cy="160" r="8" fill="#f97316" opacity="0.7" />
    </svg>
  );
}

function CommitmentScene() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", top: 0, left: 0, opacity: 0.15 }}>
      {/* Launchpad */}
      <rect x="175" y="160" width="50" height="8" rx="2" fill="#7c3aed" />
      <rect x="185" y="100" width="30" height="60" rx="4" fill="#a78bfa" />
      {/* Rocket */}
      <polygon points="200,40 185,100 215,100" fill="#c084fc" />
      <circle cx="200" cy="55" r="5" fill="#e9d5ff" />
      {/* Exhaust flame */}
      <polygon points="190,160 200,190 210,160" fill="#f97316" opacity="0.7" />
      <polygon points="193,160 200,180 207,160" fill="#fbbf24" opacity="0.8" />
      {/* Stars */}
      <circle cx="50" cy="30" r="2" fill="#e9d5ff" />
      <circle cx="120" cy="50" r="1.5" fill="#e9d5ff" />
      <circle cx="300" cy="25" r="2.5" fill="#e9d5ff" />
      <circle cx="350" cy="60" r="1.8" fill="#e9d5ff" />
      <circle cx="80" cy="80" r="1" fill="#e9d5ff" />
    </svg>
  );
}

const SCENE_COMPONENTS: Record<string, () => React.JSX.Element> = {
  strengths: StrengthsScene,
  interests: InterestsScene,
  needs: NeedsScene,
  narrowing: NarrowingScene,
  commitment: CommitmentScene,
  complete: CommitmentScene,
};

// ─── Character SVGs (more detailed than before) ─────────────────────

export function MentorCharacter({ size = 60 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" fill="none">
      {/* Body */}
      <rect x="18" y="36" width="24" height="20" rx="4" fill="#7c3aed" />
      {/* Head */}
      <circle cx="30" cy="22" r="14" fill="#fbbf24" />
      {/* Explorer hat */}
      <path d="M14 18 L30 6 L46 18" stroke="#7c3aed" strokeWidth="3" fill="#7c3aed" opacity="0.8" />
      <rect x="20" y="16" width="20" height="4" rx="2" fill="#5b21b6" />
      {/* Eyes */}
      <circle cx="24" cy="22" r="2.5" fill="white" />
      <circle cx="36" cy="22" r="2.5" fill="white" />
      <circle cx="25" cy="22" r="1.2" fill="#1a1035" />
      <circle cx="37" cy="22" r="1.2" fill="#1a1035" />
      {/* Smile */}
      <path d="M24 28 Q30 34, 36 28" stroke="#1a1035" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {/* Arms */}
      <line x1="18" y1="40" x2="10" y2="48" stroke="#7c3aed" strokeWidth="3" strokeLinecap="round" />
      <line x1="42" y1="40" x2="50" y2="48" stroke="#7c3aed" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function StudentCharacter({ size = 60 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" fill="none">
      {/* Body */}
      <rect x="18" y="36" width="24" height="20" rx="4" fill="#3b82f6" />
      {/* Head */}
      <circle cx="30" cy="22" r="14" fill="#fde68a" />
      {/* Hair */}
      <path d="M16 18 C16 8, 44 8, 44 18" fill="#92400e" />
      {/* Eyes */}
      <circle cx="24" cy="22" r="2.5" fill="white" />
      <circle cx="36" cy="22" r="2.5" fill="white" />
      <circle cx="25" cy="22" r="1.2" fill="#1e293b" />
      <circle cx="37" cy="22" r="1.2" fill="#1e293b" />
      {/* Thinking mouth */}
      <ellipse cx="30" cy="29" rx="3" ry="2" fill="#1e293b" opacity="0.4" />
      {/* Arms */}
      <line x1="18" y1="40" x2="10" y2="48" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />
      <line x1="42" y1="40" x2="50" y2="48" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ─── Comic Panel Components ──────────────────────────────────────────

interface ComicPanelProps {
  speaker: "mentor" | "student";
  children: ReactNode;
  step: string;
  index: number;
  isStepStart?: boolean;
  stepLabel?: string;
  stepIcon?: string;
}

/**
 * ScenePanel — a wide comic panel with a background scene illustration,
 * a character, and a speech bubble. Used for AI mentor messages.
 * This is what makes it feel like a REAL comic strip.
 */
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
  const SceneComponent = SCENE_COMPONENTS[step] || SCENE_COMPONENTS.strengths;

  return (
    <>
      {/* Chapter header for first panel */}
      {isStepStart && stepLabel && (
        <motion.div
          initial={{ opacity: 0, scaleX: 0.3 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          style={{
            background: scene.headerBg,
            border: `3px solid ${scene.accent}`,
            borderRadius: "8px",
            padding: "10px 20px",
            textAlign: "center",
            fontFamily: "'Arial Black', 'Impact', sans-serif",
            fontSize: "13px",
            fontWeight: 900,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#fff",
            marginBottom: "4px",
          }}
        >
          {stepIcon} {stepLabel}
        </motion.div>
      )}

      {/* The comic panel */}
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          type: "spring",
          stiffness: 220,
          damping: 22,
          delay: Math.min(index * 0.06, 0.6),
        }}
        style={{
          position: "relative",
          border: `3px solid ${isMentor ? scene.accent + "88" : "#47556988"}`,
          borderRadius: "12px",
          overflow: "hidden",
          minHeight: isMentor ? "140px" : "80px",
          background: isMentor ? scene.bg : "#0f172a",
        }}
      >
        {/* Scene background (mentor panels only) */}
        {isMentor && <SceneComponent />}

        {/* Panel content */}
        <div
          style={{
            position: "relative",
            zIndex: 2,
            display: "flex",
            flexDirection: isMentor ? "row" : "row-reverse",
            alignItems: "flex-end",
            padding: isMentor ? "16px" : "12px 16px",
            gap: "12px",
            minHeight: isMentor ? "140px" : undefined,
          }}
        >
          {/* Character */}
          <motion.div
            initial={{ scale: 0, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: "spring", delay: Math.min(index * 0.06 + 0.1, 0.7) }}
            style={{
              flexShrink: 0,
              alignSelf: "flex-end",
            }}
          >
            {isMentor ? <MentorCharacter size={56} /> : <StudentCharacter size={48} />}
          </motion.div>

          {/* Speech bubble */}
          <motion.div
            initial={{ opacity: 0, x: isMentor ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(index * 0.06 + 0.15, 0.75) }}
            style={{
              position: "relative",
              background: isMentor ? "rgba(255,255,255,0.95)" : "rgba(59,130,246,0.15)",
              color: isMentor ? "#1a1035" : "#e0e8f0",
              padding: "12px 16px",
              borderRadius: "12px",
              border: isMentor ? "2px solid #e5e7eb" : `1.5px solid #3b82f644`,
              fontSize: "14px",
              lineHeight: "1.6",
              flex: 1,
              maxWidth: "80%",
              boxShadow: isMentor ? "2px 3px 0 rgba(0,0,0,0.15)" : "none",
            }}
          >
            {/* Bubble tail */}
            <div
              style={{
                position: "absolute",
                bottom: "12px",
                [isMentor ? "left" : "right"]: "-10px",
                width: 0,
                height: 0,
                borderTop: "8px solid transparent",
                borderBottom: "8px solid transparent",
                [isMentor ? "borderRight" : "borderLeft"]: `10px solid ${isMentor ? "rgba(255,255,255,0.95)" : "rgba(59,130,246,0.15)"}`,
              }}
            />
            {children}
          </motion.div>
        </div>
      </motion.div>
    </>
  );
}

/**
 * StepTransition — full-width cinematic panel showing both characters
 * arriving at a new location on their journey. Comic-book chapter break.
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
  const SceneComponent = SCENE_COMPONENTS[step] || SCENE_COMPONENTS.strengths;

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scaleY: 0.85 }}
      animate={{ opacity: 1, y: 0, scaleY: 1 }}
      transition={{ type: "spring", stiffness: 180, damping: 18 }}
      style={{
        position: "relative",
        background: scene.bg,
        borderRadius: "16px",
        border: `3px solid ${scene.accent}`,
        padding: "40px 24px",
        textAlign: "center",
        overflow: "hidden",
        margin: "12px 0",
        minHeight: "180px",
      }}
    >
      {/* Scene illustration */}
      <SceneComponent />

      {/* Characters walking together */}
      <motion.div
        initial={{ x: -80, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: "spring", delay: 0.3, stiffness: 120 }}
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "8px",
          marginBottom: "16px",
          position: "relative",
          zIndex: 2,
        }}
      >
        <MentorCharacter size={50} />
        <StudentCharacter size={50} />
      </motion.div>

      {/* Chapter header — bold comic style */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        style={{ position: "relative", zIndex: 2 }}
      >
        <div
          style={{
            display: "inline-block",
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(8px)",
            padding: "8px 24px",
            borderRadius: "8px",
            border: `2px solid ${scene.accent}66`,
          }}
        >
          <div style={{ fontSize: "28px", marginBottom: "4px" }}>{stepIcon}</div>
          <h3
            style={{
              fontFamily: "'Arial Black', 'Impact', sans-serif",
              fontSize: "16px",
              fontWeight: 900,
              color: scene.accent,
              margin: "0 0 2px 0",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {stepLabel}
          </h3>
          <p style={{ fontSize: "12px", color: "#a0a0b0", margin: 0 }}>
            {stepSubtitle}
          </p>
        </div>
      </motion.div>

      {/* Dotted journey path */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        style={{
          position: "absolute",
          bottom: "16px",
          left: "8%",
          right: "8%",
          height: "3px",
          background: `repeating-linear-gradient(90deg, ${scene.accent}55 0, ${scene.accent}55 8px, transparent 8px, transparent 16px)`,
          zIndex: 1,
        }}
      />
    </motion.div>
  );
}

/**
 * ProfileReveal — a compact comic panel that shows newly discovered
 * profile items (strengths, interests, etc.) as visual cards.
 * Appears inline in the comic strip when the AI identifies something.
 */
export function ProfileReveal({
  label,
  icon,
  items,
  accentColor,
}: {
  label: string;
  icon: string;
  items: { title: string; detail: string }[];
  accentColor: string;
}) {
  if (items.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 200 }}
      style={{
        border: `2px solid ${accentColor}44`,
        borderRadius: "12px",
        background: `linear-gradient(135deg, ${accentColor}11, ${accentColor}05)`,
        padding: "12px 16px",
        margin: "4px 0",
      }}
    >
      <div style={{ fontSize: "11px", fontWeight: 700, color: accentColor, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>
        {icon} {label}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        {items.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            style={{
              padding: "6px 12px",
              background: `${accentColor}22`,
              borderRadius: "6px",
              border: `1px solid ${accentColor}33`,
            }}
          >
            <div style={{ fontSize: "12px", fontWeight: 600, color: "#e0e0e8" }}>{item.title}</div>
            {item.detail && (
              <div style={{ fontSize: "10px", color: "#a0a0b0", marginTop: "2px" }}>{item.detail}</div>
            )}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
