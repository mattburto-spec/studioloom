/* Shared icon component for the Bold teacher dashboard.
 * Named `I` to match the source mock (`teacher_bold.jsx`).
 */

import type { JSX } from "react";

export type IconName =
  | "arrow"
  | "play"
  | "check"
  | "chev"
  | "chevR"
  | "plus"
  | "more"
  | "bell"
  | "search"
  | "gear";

interface IProps {
  name: IconName;
  size?: number;
  /** Stroke width. Pass 0 for filled glyphs (play). */
  s?: number;
}

const SHAPES: Record<IconName, JSX.Element> = {
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  play: <path d="M6 4l14 8-14 8z" fill="currentColor" stroke="none" />,
  check: <path d="M20 6L9 17l-5-5" />,
  chev: <path d="M6 9l6 6 6-6" />,
  chevR: <path d="M9 6l6 6-6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="19" cy="12" r="1.5" fill="currentColor" />
    </>
  ),
  bell: (
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>
  ),
};

export function I({ name, size = 16, s = 2 }: IProps) {
  const fillDirectly = name === "play";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={fillDirectly ? "none" : "currentColor"}
      strokeWidth={s}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {SHAPES[name]}
    </svg>
  );
}
