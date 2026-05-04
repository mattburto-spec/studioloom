"use client";

import { useState } from "react";
import {
  ONBOARDING_IMAGES,
  computeMentorSuggestion,
  type Motif,
} from "@/lib/student/onboarding-images";
import type { MentorId } from "@/lib/student/mentors";

const MIN_PICKS = 2;
const MAX_PICKS = 3;

interface Props {
  onComplete: (result: { pickedIds: string[]; suggested: MentorId }) => void;
}

export function VisualPicksScreen({ onComplete }: Props) {
  const [picked, setPicked] = useState<string[]>([]);

  const togglePick = (id: string) => {
    setPicked((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= MAX_PICKS) return prev;
      return [...prev, id];
    });
  };

  const canContinue = picked.length >= MIN_PICKS;

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-12 animate-fadeIn">
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
          Which of these speak to you?
        </h1>
        <p className="text-white/60 text-base">
          Pick {MIN_PICKS}–{MAX_PICKS}. There are no wrong answers — go with your gut.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 md:gap-4">
        {ONBOARDING_IMAGES.map((img) => {
          const isSelected = picked.includes(img.id);
          const isDisabled = !isSelected && picked.length >= MAX_PICKS;
          const orderNum = picked.indexOf(img.id) + 1;
          return (
            <button
              key={img.id}
              type="button"
              onClick={() => togglePick(img.id)}
              disabled={isDisabled}
              aria-label={`${img.label} — ${isSelected ? "selected" : "not selected"}`}
              aria-pressed={isSelected}
              className="relative rounded-2xl overflow-hidden transition-all duration-300 aspect-[3/4] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                border: isSelected
                  ? "3px solid white"
                  : "3px solid rgba(255,255,255,0.10)",
                transform: isSelected ? "scale(1.02)" : "scale(1)",
                boxShadow: isSelected
                  ? "0 12px 32px rgba(0,0,0,0.45)"
                  : "0 2px 8px rgba(0,0,0,0.2)",
              }}
            >
              <MotifTile motif={img.motif} />

              {/* Label band */}
              <div
                className="absolute bottom-0 left-0 right-0 px-3 py-2"
                style={{
                  background:
                    "linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0) 100%)",
                }}
              >
                <p className="text-xs md:text-sm font-bold text-white drop-shadow">
                  {img.label}
                </p>
              </div>

              {/* Pick-order badge */}
              {isSelected && (
                <div
                  className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{
                    background: "white",
                    color: "#0F0F1A",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                  }}
                >
                  {orderNum}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col items-center gap-3 mt-8">
        <button
          type="button"
          onClick={() => {
            if (!canContinue) return;
            onComplete({
              pickedIds: picked,
              suggested: computeMentorSuggestion(picked),
            });
          }}
          disabled={!canContinue}
          className="px-8 py-3 rounded-xl font-bold text-sm transition-all duration-300 disabled:cursor-not-allowed"
          style={{
            background: canContinue ? "white" : "rgba(255,255,255,0.15)",
            color: canContinue ? "#0F0F1A" : "rgba(255,255,255,0.4)",
            boxShadow: canContinue ? "0 4px 20px rgba(255,255,255,0.18)" : "none",
          }}
        >
          {canContinue ? "Continue" : `Pick at least ${MIN_PICKS}`}
        </button>
        <p className="text-white/40 text-xs">
          {picked.length} of {MAX_PICKS} selected
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Motif renderers — pure SVG/CSS, no photo dependency. Each motif is one of
// the 9 aesthetic vibes mapped to mentor weights in onboarding-images.ts.
// ============================================================================

function MotifTile({ motif }: { motif: Motif }) {
  switch (motif) {
    case "warm-wood":
      return (
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, #F4E5C2 0%, #D9A55C 50%, #8B5A2B 100%)",
          }}
        >
          <svg
            viewBox="0 0 100 100"
            className="w-full h-full"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M0 25 Q25 18, 50 25 T100 25"
              stroke="#5C3A1A"
              strokeWidth="0.8"
              fill="none"
              opacity="0.45"
            />
            <path
              d="M0 50 Q25 42, 50 50 T100 50"
              stroke="#5C3A1A"
              strokeWidth="0.8"
              fill="none"
              opacity="0.4"
            />
            <path
              d="M0 75 Q25 67, 50 75 T100 75"
              stroke="#5C3A1A"
              strokeWidth="0.8"
              fill="none"
              opacity="0.35"
            />
          </svg>
        </div>
      );

    case "pencil-sketch":
      return (
        <div className="absolute inset-0" style={{ background: "#F0E8D4" }}>
          <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
            <circle
              cx="50"
              cy="50"
              r="30"
              stroke="#1A1A1A"
              strokeWidth="1.4"
              fill="none"
              strokeDasharray="2.5 1.2"
              opacity="0.75"
            />
            <circle
              cx="50"
              cy="50"
              r="22"
              stroke="#5A4A2B"
              strokeWidth="0.7"
              fill="none"
              strokeDasharray="3 2"
              opacity="0.45"
            />
            <path
              d="M30 70 L 35 75 M40 65 L 48 73 M55 67 L 62 75"
              stroke="#1A1A1A"
              strokeWidth="0.6"
              opacity="0.35"
            />
          </svg>
        </div>
      );

    case "textile-weave":
      return (
        <div
          className="absolute inset-0"
          style={{
            background: "#A87959",
            backgroundImage:
              "repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0 3px, transparent 3px 6px), repeating-linear-gradient(90deg, rgba(255,255,255,0.18) 0 3px, transparent 3px 6px)",
          }}
        />
      );

    case "soft-minimal":
      return (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: "#F8F7F4" }}
        >
          <div
            style={{
              width: "60%",
              height: 1,
              background: "#C4A87A",
              boxShadow: "0 0 0 0.5px rgba(196,168,122,0.2)",
            }}
          />
        </div>
      );

    case "bauhaus-grid":
      return (
        <div className="absolute inset-0" style={{ background: "#F2EDE3" }}>
          <div
            className="absolute"
            style={{
              top: 0,
              left: 0,
              width: "50%",
              height: "50%",
              background: "#E63946",
            }}
          />
          <div
            className="absolute"
            style={{
              top: "10%",
              right: "10%",
              width: "30%",
              height: "30%",
              background: "#FFD60A",
              borderRadius: "50%",
            }}
          />
          <div
            className="absolute"
            style={{
              bottom: 0,
              right: 0,
              width: "55%",
              height: "55%",
              background: "#1D3557",
              borderTopLeftRadius: "100%",
            }}
          />
        </div>
      );

    case "ink-brush":
      return (
        <div className="absolute inset-0" style={{ background: "#FAFAF7" }}>
          <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
            <path
              d="M18 62 C 28 38, 52 33, 62 50 S 88 72, 80 84"
              stroke="#0A0A0A"
              strokeWidth="7"
              strokeLinecap="round"
              fill="none"
              opacity="0.95"
            />
            <circle cx="84" cy="86" r="2.4" fill="#0A0A0A" opacity="0.8" />
          </svg>
        </div>
      );

    case "memphis-pop":
      return (
        <div className="absolute inset-0" style={{ background: "#FF3D7F" }}>
          <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
            <circle cx="20" cy="22" r="6" fill="#FFEC44" />
            <circle cx="78" cy="35" r="4" fill="#FFEC44" />
            <circle cx="32" cy="80" r="5" fill="#FFEC44" />
            <circle cx="78" cy="78" r="3" fill="#FFEC44" />
            <path d="M52 22 L 80 50 L 52 78 L 24 50 Z" fill="#0A0A0A" opacity="0.88" />
            <path
              d="M5 90 L 95 5"
              stroke="#0A0A0A"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.7"
            />
          </svg>
        </div>
      );

    case "vibrant-chaos":
      return (
        <div className="absolute inset-0" style={{ background: "#FFFFFF" }}>
          <div
            className="absolute"
            style={{
              top: "5%",
              left: "8%",
              width: "55%",
              height: "55%",
              background: "#06D6A0",
              borderRadius: "50%",
              filter: "blur(3px)",
              mixBlendMode: "multiply",
            }}
          />
          <div
            className="absolute"
            style={{
              top: "28%",
              right: "5%",
              width: "60%",
              height: "55%",
              background: "#FFD60A",
              borderRadius: "50%",
              filter: "blur(3px)",
              mixBlendMode: "multiply",
            }}
          />
          <div
            className="absolute"
            style={{
              bottom: "5%",
              left: "18%",
              width: "60%",
              height: "60%",
              background: "#EF476F",
              borderRadius: "50%",
              filter: "blur(3px)",
              mixBlendMode: "multiply",
            }}
          />
        </div>
      );

    case "cyber-neon":
      return (
        <div className="absolute inset-0" style={{ background: "#0A0A0A" }}>
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(0deg, transparent 92%, rgba(57,255,20,0.85) 100%), linear-gradient(90deg, transparent 92%, rgba(57,255,20,0.85) 100%)",
              backgroundSize: "16px 16px",
              opacity: 0.55,
            }}
          />
          <div
            className="absolute"
            style={{
              top: "38%",
              left: "28%",
              width: "44%",
              height: "24%",
              background: "#39FF14",
              filter: "blur(20px)",
              opacity: 0.55,
            }}
          />
        </div>
      );
  }
}
