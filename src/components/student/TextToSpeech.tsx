"use client";

import { useState, useRef, useCallback } from "react";

interface TextToSpeechProps {
  text: string;
  /** Optional size variant */
  size?: "sm" | "md";
}

/**
 * Small circular button with a speaker icon.
 * Click to hear the text read aloud via ElevenLabs TTS.
 * Click again while playing to stop.
 */
export function TextToSpeech({ text, size = "sm" }: TextToSpeechProps) {
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  async function handleClick() {
    // If playing, stop
    if (state === "playing") {
      cleanup();
      setState("idle");
      return;
    }

    // If loading, ignore
    if (state === "loading") return;

    // Start loading
    setState("loading");
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) throw new Error("TTS request failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        cleanup();
        setState("idle");
      };

      audio.onerror = () => {
        cleanup();
        setState("idle");
      };

      await audio.play();
      setState("playing");
    } catch (err) {
      console.error("TTS error:", err);
      cleanup();
      setState("idle");
    }
  }

  const sizeClasses =
    size === "sm" ? "w-7 h-7" : "w-8 h-8";
  const iconSize = size === "sm" ? 14 : 16;

  return (
    <button
      onClick={handleClick}
      disabled={state === "loading"}
      title={state === "playing" ? "Stop reading" : "Read aloud"}
      className={`${sizeClasses} rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
        state === "playing"
          ? "bg-accent-blue text-white shadow-md"
          : state === "loading"
          ? "bg-accent-blue/10 text-accent-blue animate-pulse"
          : "bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/20 hover:shadow-sm"
      }`}
    >
      {state === "playing" ? (
        /* Stop icon */
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
      ) : (
        /* Speaker icon */
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </svg>
      )}
    </button>
  );
}
