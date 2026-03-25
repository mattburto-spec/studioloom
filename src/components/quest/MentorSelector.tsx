"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MentorCard from "./MentorCard";
import type { MentorId } from "@/lib/quest/types";

interface MentorSelectorProps {
  onMentorSelected: (mentorId: MentorId) => void;
  selectedMentorId?: MentorId | null;
}

// Mentor options data
const MENTOR_OPTIONS = [
  {
    id: "kit" as MentorId,
    name: "Kit",
    tagline: "Let's build something real",
    archetype: "The Maker",
    description: "Practical, hands-on, gets straight to work. Loves tinkering and real problems.",
    primaryColor: "#F59E0B",
    accentColor: "#D97706",
  },
  {
    id: "sage" as MentorId,
    name: "Sage",
    tagline: "The questions matter more",
    archetype: "The Questioner",
    description:
      "Curious, thoughtful, asks the hard questions. Helps you think deeper.",
    primaryColor: "#6366F1",
    accentColor: "#4F46E5",
  },
  {
    id: "river" as MentorId,
    name: "River",
    tagline: "Your story is the design",
    archetype: "The Storyteller",
    description:
      "Warm, connected, sees the human side. Understands what really matters.",
    primaryColor: "#10B981",
    accentColor: "#059669",
  },
  {
    id: "spark" as MentorId,
    name: "Spark",
    tagline: "Be bold, be weird, be YOU",
    archetype: "The Provocateur",
    description:
      "Energetic, provocative, pushes boundaries. Challenges you to be braver.",
    primaryColor: "#EF4444",
    accentColor: "#DC2626",
  },
  {
    id: "haven" as MentorId,
    name: "Haven",
    tagline: "Small steps, big growth",
    archetype: "The Quiet Builder",
    description:
      "Gentle, grounded, patient. Creates space for you to grow at your pace.",
    primaryColor: "#8B5CF6",
    accentColor: "#7C3AED",
  },
];

// Campfire SVG scene
const CampfireScene: React.FC = () => (
  <svg
    width="100%"
    height="200"
    viewBox="0 0 400 200"
    xmlns="http://www.w3.org/2000/svg"
    style={{
      opacity: 0.6,
      marginBottom: "24px",
    }}
  >
    {/* Night sky gradient effect */}
    <defs>
      <linearGradient id="skyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" style={{ stopColor: "#1a1a2e", stopOpacity: 1 }} />
        <stop offset="100%" style={{ stopColor: "#16213e", stopOpacity: 1 }} />
      </linearGradient>
    </defs>
    <rect width="400" height="200" fill="url(#skyGradient)" />

    {/* Stars scattered */}
    <circle cx="40" cy="30" r="1.5" fill="#FBBF24" opacity="0.7" />
    <circle cx="120" cy="20" r="1" fill="#FBBF24" opacity="0.8" />
    <circle cx="200" cy="35" r="1.5" fill="#FBBF24" opacity="0.6" />
    <circle cx="300" cy="25" r="1" fill="#FBBF24" opacity="0.9" />
    <circle cx="360" cy="40" r="1.5" fill="#FBBF24" opacity="0.7" />
    <circle cx="80" cy="55" r="1" fill="#FBBF24" opacity="0.5" />
    <circle cx="340" cy="60" r="1" fill="#FBBF24" opacity="0.8" />

    {/* Logs (brown-gray) */}
    <rect x="170" y="140" width="60" height="12" rx="6" fill="#6B4423" opacity="0.8" />
    <rect x="150" y="148" width="100" height="8" rx="4" fill="#8B5A2B" opacity="0.7" />

    {/* Campfire flames */}
    <g>
      {/* Left flame */}
      <path
        d="M 180 130 Q 175 110 180 90 Q 185 100 180 130"
        fill="#FCD34D"
        opacity="0.9"
      />
      <path
        d="M 180 130 Q 172 105 175 85 Q 182 105 180 130"
        fill="#F59E0B"
        opacity="0.8"
      />
      {/* Center flame */}
      <path
        d="M 200 125 Q 195 100 200 75 Q 207 105 200 125"
        fill="#FDE047"
        opacity="0.95"
      />
      <path
        d="M 200 125 Q 190 95 195 65 Q 210 100 200 125"
        fill="#FBBF24"
        opacity="0.85"
      />
      {/* Right flame */}
      <path
        d="M 220 130 Q 225 105 220 85 Q 215 105 220 130"
        fill="#FCD34D"
        opacity="0.9"
      />
      <path
        d="M 220 130 Q 228 110 225 90 Q 218 105 220 130"
        fill="#F59E0B"
        opacity="0.8"
      />
    </g>

    {/* Sparks floating up */}
    <circle cx="185" cy="70" r="1.5" fill="#FCD34D" opacity="0.6" />
    <circle cx="210" cy="60" r="1" fill="#FBBF24" opacity="0.5" />
    <circle cx="195" cy="50" r="1.5" fill="#FDE047" opacity="0.7" />
    <circle cx="215" cy="80" r="1" fill="#FCD34D" opacity="0.4" />

    {/* Silhouette trees on sides */}
    <g opacity="0.4">
      {/* Left tree */}
      <polygon points="30,200 25,160 40,170 35,150 50,160 40,140 55,150 45,130 60,140 50,115 65,130 55,110 70,125 60,95 80,115 65,85 85,105 70,75 95,100 75,65 100,90 80,50 110,85 85,40 120,75 95,25 130,65 100,15" fill="#1a4d2e" />
      {/* Right tree */}
      <polygon points="370,200 375,160 360,170 365,150 350,160 360,140 345,150 355,130 340,140 350,115 335,130 345,110 330,125 340,95 320,115 335,85 315,105 330,75 305,100 325,65 300,90 320,50 290,85 315,40 280,75 305,25 270,65 300,15" fill="#1a4d2e" />
    </g>
  </svg>
);

export const MentorSelector: React.FC<MentorSelectorProps> = ({
  onMentorSelected,
  selectedMentorId = null,
}) => {
  const [selected, setSelected] = useState<MentorId | null>(selectedMentorId || null);

  const handleSelect = (mentorId: string) => {
    setSelected(mentorId as MentorId);
  };

  const handleConfirm = () => {
    if (selected) {
      onMentorSelected(selected);
    }
  };

  return (
    <div
      style={{
        backgroundColor: "#0f0a1a",
        minHeight: "100vh",
        padding: "40px 20px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Campfire Scene */}
      <CampfireScene />

      {/* Title */}
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.6 }}
        style={{
          fontSize: "clamp(28px, 5vw, 48px)",
          fontWeight: "800",
          color: "#ffffff",
          textAlign: "center",
          marginBottom: "12px",
          letterSpacing: "-1px",
        }}
      >
        Choose Your Mentor
      </motion.h1>

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        style={{
          fontSize: "clamp(14px, 2vw, 16px)",
          color: "#9CA3AF",
          textAlign: "center",
          marginBottom: "40px",
          maxWidth: "600px",
          lineHeight: "1.6",
        }}
      >
        Each mentor has a different style. Pick the one that feels right for you.
        You can&apos;t change later, so choose wisely!
      </motion.p>

      {/* Mentor Cards Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "20px",
          width: "100%",
          maxWidth: "1200px",
          marginBottom: "40px",
          justifyItems: "center",
        }}
      >
        {MENTOR_OPTIONS.map((mentor, index) => (
          <div key={mentor.id} style={{ width: "100%", maxWidth: "320px" }}>
            <MentorCard
              mentor={mentor}
              isSelected={selected === mentor.id}
              onSelect={handleSelect}
              index={index}
            />
          </div>
        ))}
      </div>

      {/* Confirm Button */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 120, damping: 15 }}
            style={{
              width: "100%",
              maxWidth: "300px",
            }}
          >
            <button
              onClick={handleConfirm}
              style={{
                width: "100%",
                padding: "16px 24px",
                backgroundColor: MENTOR_OPTIONS.find((m) => m.id === selected)
                  ?.primaryColor,
                color: "#1a1a1a",
                border: "none",
                borderRadius: "8px",
                fontSize: "16px",
                fontWeight: "700",
                cursor: "pointer",
                transition: "all 0.3s ease",
                boxShadow: `0 8px 20px ${
                  MENTOR_OPTIONS.find((m) => m.id === selected)?.primaryColor
                }40`,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
              onMouseEnter={(e) => {
                const target = e.currentTarget as HTMLButtonElement;
                target.style.transform = "translateY(-2px)";
                target.style.boxShadow = `0 12px 28px ${
                  MENTOR_OPTIONS.find((m) => m.id === selected)?.primaryColor
                }60`;
              }}
              onMouseLeave={(e) => {
                const target = e.currentTarget as HTMLButtonElement;
                target.style.transform = "translateY(0)";
                target.style.boxShadow = `0 8px 20px ${
                  MENTOR_OPTIONS.find((m) => m.id === selected)?.primaryColor
                }40`;
              }}
            >
              Confirm Choice
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Responsive spacing */}
      <div style={{ height: "40px" }} />
    </div>
  );
};

export default MentorSelector;
