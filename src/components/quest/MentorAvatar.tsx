"use client";

import React from "react";
import type { MentorId } from "@/lib/quest/types";

interface MentorAvatarProps {
  mentorId: MentorId;
  size?: number;
}

// Kit (The Maker) — amber/gold workshop mentor
const KitAvatar: React.FC<{ size: number }> = ({ size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Head */}
    <circle cx="50" cy="35" r="18" fill="#F59E0B" />
    {/* Hair */}
    <path d="M 32 28 Q 32 15 50 15 Q 68 15 68 28" fill="#D97706" />
    {/* Face */}
    <circle cx="45" cy="33" r="2.5" fill="#1a1a1a" />
    <circle cx="55" cy="33" r="2.5" fill="#1a1a1a" />
    {/* Smile */}
    <path d="M 45 40 Q 50 43 55 40" stroke="#1a1a1a" strokeWidth="2" fill="none" />
    {/* Body - apron */}
    <rect x="35" y="55" width="30" height="30" rx="2" fill="#92400E" />
    {/* Apron pockets */}
    <rect x="40" y="62" width="8" height="10" fill="#78350F" />
    <rect x="52" y="62" width="8" height="10" fill="#78350F" />
    {/* Arms with rolled sleeves */}
    <rect x="22" y="50" width="8" height="25" rx="4" fill="#F59E0B" />
    <rect x="70" y="50" width="8" height="25" rx="4" fill="#F59E0B" />
    {/* Tool belt */}
    <rect x="35" y="82" width="30" height="4" fill="#78350F" />
    {/* Wrench on belt */}
    <g transform="translate(42, 84)">
      <rect x="0" y="0" width="10" height="3" rx="1.5" fill="#6B7280" />
      <circle cx="10" cy="1.5" r="2" fill="#6B7280" />
    </g>
    {/* Legs */}
    <rect x="42" y="87" width="5" height="10" fill="#1a1a1a" />
    <rect x="53" y="87" width="5" height="10" fill="#1a1a1a" />
  </svg>
);

// Sage (The Questioner) — indigo academic mentor
const SageAvatar: React.FC<{ size: number }> = ({ size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Head */}
    <circle cx="50" cy="35" r="18" fill="#C7D2FE" />
    {/* Hair */}
    <path d="M 32 28 Q 32 15 50 15 Q 68 15 68 28 Q 68 20 50 18 Q 32 20 32 28" fill="#818CF8" />
    {/* Glasses */}
    <circle cx="43" cy="32" r="6" fill="none" stroke="#6366F1" strokeWidth="1.5" />
    <circle cx="57" cy="32" r="6" fill="none" stroke="#6366F1" strokeWidth="1.5" />
    <line x1="49" y1="32" x2="51" y2="32" stroke="#6366F1" strokeWidth="1.5" />
    {/* Face */}
    <circle cx="43" cy="32" r="2" fill="#1a1a1a" />
    <circle cx="57" cy="32" r="2" fill="#1a1a1a" />
    {/* Smile */}
    <path d="M 45 40 Q 50 42 55 40" stroke="#1a1a1a" strokeWidth="1.5" fill="none" />
    {/* Body - shirt */}
    <rect x="35" y="55" width="30" height="28" rx="2" fill="#6366F1" />
    {/* Collar */}
    <polygon points="42,55 50,52 58,55" fill="#6366F1" />
    {/* Book under arm */}
    <rect x="28" y="60" width="6" height="15" rx="1" fill="#DC2626" />
    {/* Arms */}
    <rect x="22" y="50" width="7" height="25" rx="3.5" fill="#C7D2FE" />
    <rect x="71" y="50" width="7" height="25" rx="3.5" fill="#C7D2FE" />
    {/* Legs */}
    <rect x="42" y="85" width="5" height="12" fill="#1a1a1a" />
    <rect x="53" y="85" width="5" height="12" fill="#1a1a1a" />
  </svg>
);

// River (The Storyteller) — emerald warm mentor
const RiverAvatar: React.FC<{ size: number }> = ({ size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Head */}
    <circle cx="50" cy="35" r="18" fill="#D1FAE5" />
    {/* Flowing hair */}
    <path d="M 32 30 Q 25 35 28 50 Q 30 40 32 28 Q 32 15 50 15 Q 68 15 68 28 Q 70 40 72 50 Q 75 35 68 30" fill="#059669" />
    {/* Face - warm expression */}
    <circle cx="45" cy="33" r="2.5" fill="#1a1a1a" />
    <circle cx="55" cy="33" r="2.5" fill="#1a1a1a" />
    {/* Warm smile */}
    <path d="M 44 40 Q 50 43 56 40" stroke="#1a1a1a" strokeWidth="2" fill="none" />
    {/* Eyebrows - open/welcoming */}
    <path d="M 42 29 Q 45 27 48 28" stroke="#1a1a1a" strokeWidth="1.5" fill="none" />
    <path d="M 52 28 Q 55 27 58 29" stroke="#1a1a1a" strokeWidth="1.5" fill="none" />
    {/* Body - flowing clothes */}
    <ellipse cx="50" cy="65" rx="18" ry="22" fill="#10B981" />
    {/* Arms open/welcoming gesture */}
    <rect x="18" y="55" width="8" height="28" rx="4" fill="#D1FAE5" transform="rotate(-25 22 65)" />
    <rect x="74" y="55" width="8" height="28" rx="4" fill="#D1FAE5" transform="rotate(25 78 65)" />
    {/* Legs */}
    <rect x="42" y="85" width="5" height="12" fill="#1a1a1a" />
    <rect x="53" y="85" width="5" height="12" fill="#1a1a1a" />
  </svg>
);

// Spark (The Provocateur) — red energetic mentor
const SparkAvatar: React.FC<{ size: number }> = ({ size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Head */}
    <circle cx="50" cy="35" r="18" fill="#FCA5A5" />
    {/* Spiky hair */}
    <polygon points="35,20 33,8 40,18 45,5 50,15 55,5 60,18 67,8 65,20" fill="#DC2626" />
    {/* Face - confident */}
    <circle cx="45" cy="33" r="2.5" fill="#1a1a1a" />
    <circle cx="55" cy="33" r="2.5" fill="#1a1a1a" />
    {/* Determined smirk */}
    <path d="M 44 40 Q 50 42 55 39" stroke="#1a1a1a" strokeWidth="2" fill="none" />
    {/* Body */}
    <rect x="35" y="55" width="30" height="28" rx="2" fill="#EF4444" />
    {/* Lightning bolt on chest */}
    <polygon points="50,60 48,65 52,65 50,72" fill="#FCD34D" />
    {/* Arms - confident pose */}
    <rect x="22" y="52" width="7" height="24" rx="3.5" fill="#FCA5A5" />
    <rect x="71" y="52" width="7" height="24" rx="3.5" fill="#FCA5A5" />
    {/* Legs */}
    <rect x="42" y="85" width="5" height="12" fill="#1a1a1a" />
    <rect x="53" y="85" width="5" height="12" fill="#1a1a1a" />
  </svg>
);

// Haven (The Quiet Builder) — violet soft mentor
const HavenAvatar: React.FC<{ size: number }> = ({ size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Head */}
    <circle cx="50" cy="35" r="18" fill="#E9D5FF" />
    {/* Soft hair */}
    <path d="M 32 28 Q 32 15 50 15 Q 68 15 68 28 L 68 32 Q 68 25 50 22 Q 32 25 32 32 Z" fill="#A78BFA" />
    {/* Gentle face */}
    <circle cx="45" cy="34" r="2" fill="#1a1a1a" />
    <circle cx="55" cy="34" r="2" fill="#1a1a1a" />
    {/* Soft smile */}
    <path d="M 45 41 Q 50 42 55 41" stroke="#1a1a1a" strokeWidth="1.5" fill="none" />
    {/* Body - cozy sweater */}
    <rect x="35" y="55" width="30" height="28" rx="4" fill="#8B5CF6" />
    {/* Sweater pattern - small plant motif */}
    <g transform="translate(50, 68)">
      <line x1="0" y1="2" x2="0" y2="8" stroke="#E9D5FF" strokeWidth="1" />
      <circle cx="-2" cy="5" r="1.5" fill="#E9D5FF" />
      <circle cx="2" cy="5" r="1.5" fill="#E9D5FF" />
      <circle cx="-2" cy="7" r="1" fill="#E9D5FF" />
      <circle cx="2" cy="7" r="1" fill="#E9D5FF" />
    </g>
    {/* Arms - holding something gently */}
    <rect x="22" y="55" width="7" height="24" rx="3.5" fill="#E9D5FF" />
    <rect x="71" y="55" width="7" height="24" rx="3.5" fill="#E9D5FF" />
    {/* Legs */}
    <rect x="42" y="85" width="5" height="12" fill="#1a1a1a" />
    <rect x="53" y="85" width="5" height="12" fill="#1a1a1a" />
  </svg>
);

export const MentorAvatar: React.FC<MentorAvatarProps> = ({
  mentorId,
  size = 80,
}) => {
  const mentorComponents: Record<MentorId, React.FC<{ size: number }>> = {
    kit: KitAvatar,
    sage: SageAvatar,
    river: RiverAvatar,
    spark: SparkAvatar,
    haven: HavenAvatar,
  };

  const Component = mentorComponents[mentorId];
  return <Component size={size} />;
};

export default MentorAvatar;
