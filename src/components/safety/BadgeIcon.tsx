"use client";

import type { JSX } from "react";

/**
 * BadgeIcon — renders a badge icon from its icon_name.
 *
 * Supports two formats:
 * 1. Named icons (e.g. "shield-check", "wrench") → renders SVG
 * 2. Emoji (e.g. "🔥", "🥽") → renders as-is
 *
 * When adding new badges, either use an emoji for icon_name
 * or add the SVG mapping here.
 */

const SVG_ICONS: Record<string, (props: { size: number; color: string }) => JSX.Element> = {
  "shield-check": ({ size, color }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  wrench: ({ size, color }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  ),
  "tree-pine": ({ size, color }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 14l3 3.3a1 1 0 01-.7 1.7H4.7a1 1 0 01-.7-1.7L7 14" />
      <path d="M17 9l2.3 2.3a1 1 0 01-.7 1.7H5.4a1 1 0 01-.7-1.7L7 9" />
      <path d="M17 4l1.7 1.7a1 1 0 01-.7 1.7H6a1 1 0 01-.7-1.7L7 4" />
      <line x1="12" y1="22" x2="12" y2="13" />
    </svg>
  ),
  flame: ({ size, color }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z" />
    </svg>
  ),
  "flask-conical": ({ size, color }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2v7.527a2 2 0 01-.211.896L4.72 20.55a1 1 0 00.9 1.45h12.76a1 1 0 00.9-1.45l-5.069-10.127A2 2 0 0114 9.527V2" />
      <path d="M8.5 2h7" />
      <path d="M7 16h10" />
    </svg>
  ),
  cpu: ({ size, color }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2" />
    </svg>
  ),
};

/** Check if a string is an emoji (starts with a non-ASCII character) */
function isEmoji(str: string): boolean {
  return /^[\u{1F000}-\u{1FFFF}]|^[\u{2600}-\u{27BF}]|^[\u{FE00}-\u{FEFF}]/u.test(str);
}

interface BadgeIconProps {
  iconName: string;
  /** Icon size in pixels (default 24) */
  size?: number;
  /** SVG stroke color (default "currentColor") — ignored for emoji */
  color?: string;
  className?: string;
}

export function BadgeIcon({ iconName, size = 24, color = "currentColor", className }: BadgeIconProps) {
  const SvgIcon = SVG_ICONS[iconName];

  if (SvgIcon) {
    return (
      <span className={className} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
        <SvgIcon size={size} color={color} />
      </span>
    );
  }

  // Emoji or unknown — render as text at appropriate font size
  return (
    <span
      className={className}
      style={{ fontSize: size * 0.85, lineHeight: 1, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
    >
      {iconName}
    </span>
  );
}
