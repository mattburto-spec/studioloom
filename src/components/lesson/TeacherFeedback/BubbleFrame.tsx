/**
 * BubbleFrame — single-SVG bubble outline with integrated tail.
 *
 * Replaces the original "div with border + separately-positioned
 * SpeechBubbleTail SVG" pattern. Pass A v1's separate-SVG approach
 * left a visible seam at the tail base — the bubble's CSS top border
 * drew a continuous horizontal line UNDERNEATH the tail's two "feet",
 * so the tail looked glued ON TOP of the bubble rather than as part of
 * the same outline. Matt's smoke (10 May 2026) flagged it.
 *
 * Fix: draw the WHOLE bubble outline (rounded body + tail dip) as one
 * SVG path. The tail integrates into the top edge as a single
 * continuous stroke. No CSS border on the bubble — the SVG IS the
 * border.
 *
 * Sizing: the SVG matches the inner content's measured dimensions via
 * ResizeObserver. The path is recomputed whenever the content's width
 * or height changes (text wrapping, height-animated reply box opening,
 * etc.). Sub-pixel widths are rounded to integers to avoid the SVG
 * stroke rendering at fractional pixel offsets which would look
 * blurry on non-Retina displays.
 *
 * Why ResizeObserver and not preserveAspectRatio="none": stretching a
 * single SVG path across a variable-width container distorts the
 * rounded corners + tail proportions. Recomputing the path from real
 * dimensions keeps the corners crisp at any width.
 */

"use client";

import * as React from "react";

const RADIUS = 24; // matches Tailwind rounded-3xl
const TAIL_HEIGHT = 22; // distance from bubble top to tail tip
const TAIL_HALF_WIDTH = 24; // half of the tail's base width (48 / 2)
const STROKE_WIDTH = 2;

/** Visual tokens per voice. Inline RGB strings (not CSS variables) so
 *  the SVG renders correctly on first paint with no FOUC. */
const TOKENS = {
  teacher: {
    fill: "rgb(236 253 245)", // tailwind emerald-50 — mint bubble bg
    stroke: "rgb(16 185 129)", // tailwind emerald-500
  },
  student: {
    fill: "rgb(250 245 255)", // tailwind purple-50
    stroke: "rgb(168 85 247)", // tailwind purple-500
  },
} as const;

type BubbleVariant = keyof typeof TOKENS;

export interface BubbleFrameProps {
  children: React.ReactNode;
  /** Outer wrapper class (margin, max-width, motion props target). */
  className?: string;
  /** Inner content class — apply padding here, NOT on the wrapper.
   *  The wrapper has margin-top reserved for the tail's vertical
   *  reach, so padding on it would push the bubble down. */
  contentClassName?: string;
  /** Tail anchor x (px from bubble left edge). The tail's TIP sits at
   *  this x; the base spans tailX±TAIL_HALF_WIDTH. Must be ≥ RADIUS +
   *  TAIL_HALF_WIDTH so the base doesn't sit INSIDE the rounded
   *  corner (which produces a backward L-segment that reads as a
   *  second peak). The component clamps to enforce this — passing a
   *  smaller value lifts it to the minimum.
   *
   *  Default 56 (matches the original SpeechBubbleTail anchor of
   *  left:28 in the bubble's coordinate space — the tail tip sat at
   *  x=28+24=52 with a 48px-wide base. Bumped to 56 here so the base
   *  has a tiny breathing margin past the corner end). */
  tailX?: number;
  showTail?: boolean;
  variant?: BubbleVariant;
  /** Optional data-state for downstream e2e + the existing static
   *  tests that grep for state attributes. */
  dataState?: string;
}

/** Minimum legal tailX so the tail's left base stays clear of the
 *  rounded corner. With RADIUS=24 and TAIL_HALF_WIDTH=24, the minimum
 *  is 48 (corner end + half-base = the corner ends at x=24, the
 *  base needs to start at >=24, so tip x = base_left + tw >= 48).
 *  We add a 4px safety margin so the base sits cleanly past the
 *  corner's curve. */
const TAIL_X_MIN = RADIUS + TAIL_HALF_WIDTH + 4;
const TAIL_X_DEFAULT = 56;

export function BubbleFrame({
  children,
  className,
  contentClassName,
  tailX = TAIL_X_DEFAULT,
  showTail = true,
  variant = "teacher",
  dataState,
}: BubbleFrameProps) {
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState<{ w: number; h: number }>({ w: 0, h: 0 });

  React.useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      // Round to integer pixels to avoid sub-pixel stroke blur. The
      // path is recomputed every resize so this isn't a perf issue.
      setSize({ w: Math.round(r.width), h: Math.round(r.height) });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const tokens = TOKENS[variant];
  const tailReach = showTail ? TAIL_HEIGHT : 0;
  // Clamp tailX so the tail's left base is always clear of the
  // rounded corner. Without this clamp, a small tailX produces a
  // backward L-segment from the corner end to the base, which renders
  // as a phantom second peak ("M-shape") instead of a clean drip.
  // Matt smoke caught this on PR #160; the clamp pins it.
  const clampedTailX = Math.max(tailX, TAIL_X_MIN);
  const path = buildBubblePath(size.w, size.h, showTail ? clampedTailX : null);

  return (
    <div
      className={["relative", className].filter(Boolean).join(" ")}
      style={{ marginTop: tailReach }}
      data-bubble-frame={variant}
    >
      {/* SVG outline — drawn behind content via DOM order + the
          content's z-index. Pointer-events disabled so clicks pass
          through to the content layer. The SVG covers both the tail
          area (above the content) AND the content area (the bubble
          body), so the path can include both. */}
      {size.w > 0 && size.h > 0 && (
        <svg
          width={size.w}
          height={size.h + tailReach}
          viewBox={`0 0 ${size.w} ${size.h + tailReach}`}
          style={{
            position: "absolute",
            top: -tailReach,
            left: 0,
            pointerEvents: "none",
            // Lets the 2px stroke extend past the SVG's viewBox without
            // getting half-clipped at the edges. Without this, strokes
            // along the bubble's left edge (x=0), right edge (x=w), and
            // bottom edge (y=h+tailReach) render at 1px while the top
            // edge (at internal y=tailReach with clearance) renders at
            // 2px — visible inconsistency Matt smoke caught (10 May
            // 2026, post-#166).
            overflow: "visible",
          }}
          aria-hidden="true"
        >
          <path
            d={path}
            fill={tokens.fill}
            stroke={tokens.stroke}
            strokeWidth={STROKE_WIDTH}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      )}

      {/* Content layer. Transparent bg (the SVG provides the fill).
          z-index keeps clicks routed correctly above the SVG. */}
      <div
        ref={contentRef}
        className={["relative", contentClassName].filter(Boolean).join(" ")}
        data-state={dataState}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Build the SVG path string for the bubble outline.
 *
 * Coordinate system: SVG origin at top-left. Bubble body sits at
 * y >= TAIL_HEIGHT when the tail is shown (the tail occupies y < t).
 *
 * The tail integrates INTO the top edge — the path goes along the top
 * border, dips up for the tail (M-shape), continues along the top
 * border. No separate "tail SVG" with a seam to mask. The tail's left
 * and right "feet" share continuity with the bubble's top border line.
 */
function buildBubblePath(w: number, h: number, tailX: number | null): string {
  if (w === 0 || h === 0) return "";
  const r = RADIUS;
  const t = TAIL_HEIGHT;
  const tw = TAIL_HALF_WIDTH;
  // Origin: top-left of SVG. Body's top edge sits at y = t when the
  // tail is shown, y = 0 otherwise.
  const top = tailX !== null ? t : 0;

  const segs: string[] = [];

  // Start at top-left after the rounded corner.
  segs.push(`M ${r} ${top}`);

  if (tailX !== null) {
    // Top edge straight to the tail base (left side).
    segs.push(`L ${tailX - tw} ${top}`);
    // Tail rising — left side. Mirrors the original SpeechBubbleTail
    // path's curvature, translated into the bubble's coordinate frame.
    segs.push(
      `C ${tailX - tw + 6} ${top}, ${tailX - tw + 10} ${top - 4}, ${tailX - tw + 14} ${top - 12}`,
    );
    // Tail tip.
    segs.push(
      `C ${tailX - tw + 18} ${top - 20}, ${tailX - tw + 22} ${top - t}, ${tailX} ${top - t}`,
    );
    // Tail descending — right side, mirror.
    segs.push(
      `C ${tailX + tw - 22} ${top - t}, ${tailX + tw - 18} ${top - 20}, ${tailX + tw - 14} ${top - 12}`,
    );
    segs.push(
      `C ${tailX + tw - 10} ${top - 4}, ${tailX + tw - 6} ${top}, ${tailX + tw} ${top}`,
    );
  }

  // Top edge — continue to the right corner.
  segs.push(`L ${w - r} ${top}`);
  // Top-right corner.
  segs.push(`A ${r} ${r} 0 0 1 ${w} ${top + r}`);
  // Right edge.
  segs.push(`L ${w} ${top + h - r}`);
  // Bottom-right corner.
  segs.push(`A ${r} ${r} 0 0 1 ${w - r} ${top + h}`);
  // Bottom edge.
  segs.push(`L ${r} ${top + h}`);
  // Bottom-left corner.
  segs.push(`A ${r} ${r} 0 0 1 0 ${top + h - r}`);
  // Left edge.
  segs.push(`L 0 ${top + r}`);
  // Top-left corner — closes the path back to the start.
  segs.push(`A ${r} ${r} 0 0 1 ${r} ${top}`);
  segs.push("Z");

  return segs.join(" ");
}
