"use client";

import { useMemo } from "react";

interface UnitThumbnailProps {
  thumbnailUrl: string | null;
  title: string;
  className?: string;
}

// Gradient palette: 6 gradient pairs (light to vibrant)
const GRADIENT_PALETTE = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", // purple-violet
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)", // pink-rose
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)", // blue-cyan
  "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)", // green-teal
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)", // rose-amber
  "linear-gradient(135deg, #30cfd0 0%, #330867 100%)", // cyan-indigo
  "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)", // teal-pink
  "linear-gradient(135deg, #ff9a56 0%, #ff6a88 100%)", // orange-rose
];

// Simple hash function to deterministically pick a gradient based on title
function hashTitle(title: string): number {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    const char = title.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash) % GRADIENT_PALETTE.length;
}

export function UnitThumbnail({
  thumbnailUrl,
  title,
  className = "",
}: UnitThumbnailProps) {
  const gradientIndex = useMemo(() => hashTitle(title), [title]);
  const gradient = GRADIENT_PALETTE[gradientIndex];

  if (thumbnailUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={thumbnailUrl}
        alt=""
        className={`w-full h-full object-cover ${className}`}
        loading="lazy"
      />
    );
  }

  // Gradient background with # logo
  return (
    <div
      className={`w-full h-full flex items-center justify-center ${className}`}
      style={{
        background: gradient,
      }}
    >
      {/* StudioLoom # logo */}
      <svg
        width="80"
        height="80"
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ opacity: 0.4 }}
      >
        {/* Left vertical line */}
        <line x1="30" y1="20" x2="30" y2="80" stroke="white" strokeWidth="8" strokeLinecap="round" />
        {/* Right vertical line */}
        <line x1="70" y1="20" x2="70" y2="80" stroke="white" strokeWidth="8" strokeLinecap="round" />
        {/* Top horizontal line */}
        <line x1="20" y1="40" x2="80" y2="40" stroke="white" strokeWidth="8" strokeLinecap="round" />
        {/* Bottom horizontal line */}
        <line x1="20" y1="60" x2="80" y2="60" stroke="white" strokeWidth="8" strokeLinecap="round" />
      </svg>
    </div>
  );
}
