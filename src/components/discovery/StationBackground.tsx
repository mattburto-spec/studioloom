"use client";

import { useState, useEffect } from "react";
import type { DiscoveryStation } from "@/lib/discovery/types";
import { STATION_BACKGROUNDS, checkImageExists, preloadStationAssets } from "@/lib/discovery/assets";

/**
 * StationBackground — per-station atmosphere.
 *
 * v1: CSS gradients (current — always renders as base layer).
 * v2: ChatGPT-generated images in Another World flat-polygon style
 *     layered ON TOP of the gradient. Gradient shows during load.
 *
 * When images exist in /public/discovery/bg-sN.webp, they fade in
 * over the gradient. When they don't, gradient-only renders.
 *
 * @see docs/specs/discovery-engine-ux-design.md
 * @see docs/specs/discovery-engine-image-prompts.md
 */

interface StationBackgroundProps {
  station: DiscoveryStation;
  isTransition: boolean;
}

const STATION_GRADIENTS: Record<number, string> = {
  0: "linear-gradient(135deg, #1a0533 0%, #2d1b69 40%, #1e1145 100%)", // Purple — Identity
  1: "linear-gradient(135deg, #2d1306 0%, #7c2d12 40%, #431407 100%)", // Orange/amber — Campfire
  2: "linear-gradient(135deg, #1c1a05 0%, #78350f 40%, #451a03 100%)", // Amber — Workshop
  3: "linear-gradient(135deg, #042f2e 0%, #134e4a 40%, #0f302c 100%)", // Teal — Collection Wall
  4: "linear-gradient(135deg, #0c1929 0%, #1e3a5f 40%, #0f172a 100%)", // Blue — Window
  5: "linear-gradient(135deg, #052e16 0%, #14532d 40%, #0a2818 100%)", // Emerald — Toolkit
  6: "linear-gradient(135deg, #1e0a3e 0%, #4c1d95 40%, #2e1065 100%)", // Violet — Crossroads
  7: "linear-gradient(135deg, #2a0a1e 0%, #881337 40%, #4c0519 100%)", // Rose — Launchpad
};

const TRANSITION_GRADIENT =
  "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 40%, #0a0a0a 100%)";

export function StationBackground({
  station,
  isTransition,
}: StationBackgroundProps) {
  const gradient = isTransition
    ? TRANSITION_GRADIENT
    : STATION_GRADIENTS[station] ?? STATION_GRADIENTS[0];

  const [bgImageLoaded, setBgImageLoaded] = useState(false);
  const [bgImageSrc, setBgImageSrc] = useState<string | null>(null);

  // Check if image exists for this station
  useEffect(() => {
    setBgImageLoaded(false);
    setBgImageSrc(null);
    if (isTransition) return;

    const imgPath = STATION_BACKGROUNDS[station];
    if (!imgPath) return;

    checkImageExists(imgPath).then((exists) => {
      if (exists) {
        setBgImageSrc(imgPath);
        // Small delay to allow CSS transition
        requestAnimationFrame(() => setBgImageLoaded(true));
      }
    });
  }, [station, isTransition]);

  // Preload next station's background
  useEffect(() => {
    if (!isTransition && station < 7) {
      preloadStationAssets(station + 1);
    }
  }, [station, isTransition]);

  return (
    <div className="absolute inset-0 transition-all duration-1000 ease-in-out">
      {/* Layer 0: CSS gradient (always visible, instant) */}
      <div
        className="absolute inset-0 transition-all duration-1000 ease-in-out"
        style={{ background: gradient }}
      />

      {/* Layer 1: Image (fades in when loaded) */}
      {bgImageSrc && (
        <div
          className="absolute inset-0 transition-opacity duration-700 ease-in-out"
          style={{
            backgroundImage: `url(${bgImageSrc})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: bgImageLoaded ? 1 : 0,
          }}
        />
      )}

      {/* Subtle noise texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Subtle radial glow */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(255,255,255,0.03) 0%, transparent 70%)",
        }}
      />
    </div>
  );
}
