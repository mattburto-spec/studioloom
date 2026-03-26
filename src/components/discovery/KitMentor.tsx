"use client";

import { useState, useEffect } from "react";
import type { DiscoveryStation, KitExpression } from "@/lib/discovery/types";
import { KIT_EXPRESSIONS, checkImageExists } from "@/lib/discovery/assets";

/**
 * KitMentor — Kit's floating character display.
 *
 * v1: Emoji avatar (fallback when images not generated)
 * v2: Another World flat-polygon portrait images
 * v3 (future): Rive animated character
 *
 * Kit is a "smart older cousin who's been through the design thing
 * and came out the other side." Warm brown skin, short tousled hair,
 * paint-stained apron, rolled sleeves.
 *
 * @see docs/specs/discovery-engine-ux-design.md Part 4
 * @see docs/specs/discovery-engine-image-prompts.md Batch 1
 */

interface KitMentorProps {
  expression: KitExpression;
  station: DiscoveryStation;
  message?: string | null;
}

const EXPRESSION_EMOJI: Record<KitExpression, string> = {
  neutral: "😊",
  curious: "🤔",
  excited: "😄",
  thoughtful: "🧐",
  empathetic: "😌",
  proud: "🤩",
};

// Map KitExpression → closest image key
const EXPRESSION_TO_IMAGE: Record<KitExpression, string> = {
  neutral: "neutral",
  curious: "thinking",
  excited: "excited",
  thoughtful: "thinking",
  empathetic: "gentle",
  proud: "excited",
};

const STATION_ACCENT: Record<number, string> = {
  0: "#7B2FF2", // purple
  1: "#F97316", // orange
  2: "#F59E0B", // amber
  3: "#14B8A6", // teal
  4: "#3B82F6", // blue
  5: "#10B981", // emerald
  6: "#8B5CF6", // violet
  7: "#F43F5E", // rose
};

export function KitMentor({ expression, station, message }: KitMentorProps) {
  const emoji = EXPRESSION_EMOJI[expression];
  const accent = STATION_ACCENT[station] ?? "#7B2FF2";
  const imageKey = EXPRESSION_TO_IMAGE[expression] ?? "neutral";
  const imagePath = KIT_EXPRESSIONS[imageKey];

  const [hasImage, setHasImage] = useState(false);

  useEffect(() => {
    if (!imagePath) return;
    checkImageExists(imagePath).then(setHasImage);
  }, [imagePath]);

  return (
    <div className="absolute bottom-24 left-6 z-40 flex items-end gap-3 max-w-md">
      {/* Kit's avatar */}
      <div
        className="w-24 h-24 rounded-full flex items-center justify-center shrink-0 shadow-xl overflow-hidden"
        style={{
          background: hasImage ? "transparent" : `linear-gradient(135deg, ${accent}44, ${accent}88)`,
          border: `3px solid ${accent}aa`,
        }}
      >
        {hasImage ? (
          <img
            src={imagePath}
            alt={`Kit — ${expression}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-5xl">{emoji}</span>
        )}
      </div>

      {/* Speech bubble */}
      {message && (
        <div
          className="relative bg-white/10 backdrop-blur-md rounded-2xl rounded-bl-sm px-4 py-3 text-base text-white/90 leading-relaxed"
          style={{ border: `1px solid ${accent}33` }}
        >
          {message}
          {/* Tail pointing to Kit */}
          <div
            className="absolute -bottom-1 left-0 w-3 h-3"
            style={{
              background: "rgba(255,255,255,0.1)",
              borderRadius: "0 0 0 8px",
              borderLeft: `1px solid ${accent}33`,
              borderBottom: `1px solid ${accent}33`,
            }}
          />
        </div>
      )}
    </div>
  );
}
