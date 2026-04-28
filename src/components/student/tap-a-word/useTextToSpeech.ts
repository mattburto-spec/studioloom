"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useTextToSpeech — wraps the browser's SpeechSynthesis API.
 *
 * Phase 2B of language-scaffolding-redesign. Used by WordPopover to
 * pronounce the English word + the L1 translation (separate buttons,
 * each in the correct language so the voice + text actually match).
 *
 * Free (no API spend, no network). Browser handles voice selection.
 *
 * Voice selection: prefer a voice whose `lang` starts with the requested
 * BCP-47 prefix (e.g. lang="zh" matches "zh-CN", "zh-TW"). If no match,
 * uses the browser default. Per spec §3 Phase 2B stop-trigger: if a
 * required L1 voice is missing on the school's Chromebook fleet, the
 * popover should DISABLE the L1 audio button (don't break the popover) —
 * caller checks `voiceAvailable(lang)` before rendering the button.
 *
 * State machine: idle → speaking → idle | error
 *
 * Cancel-on-unmount + cancel-previous-on-new-speak so multiple taps
 * don't pile up audio.
 */

export type TtsState = "idle" | "speaking" | "error";

export interface TextToSpeechResult {
  state: TtsState;
  speak: (text: string, lang?: string) => void;
  cancel: () => void;
  /** Returns true if a voice exists matching the BCP-47 lang prefix. */
  voiceAvailable: (lang: string) => boolean;
  /** True if the browser supports speechSynthesis at all. */
  supported: boolean;
}

/**
 * Pure voice-selection helper. Exported for testing — the hook's only
 * complex logic is voice matching, and the rest is small enough that
 * visual smoke + the live E2E gate cover it.
 *
 * Match priority: exact lang code > lang-prefix-with-region > bare prefix.
 */
export function pickVoice<V extends { lang: string }>(
  voices: V[],
  lang: string
): V | null {
  const prefix = lang.toLowerCase();
  // Prefer exact match (e.g. "zh-CN" when lang="zh-CN")
  const exact = voices.find((v) => v.lang.toLowerCase() === prefix);
  if (exact) return exact;
  // Then prefix-with-region match (e.g. lang="zh" matches "zh-CN")
  const prefixed = voices.find((v) =>
    v.lang.toLowerCase().startsWith(prefix + "-")
  );
  if (prefixed) return prefixed;
  // Then bare prefix match (handles oddities like lang="es" matching "es")
  const bare = voices.find((v) => v.lang.toLowerCase().startsWith(prefix));
  return bare ?? null;
}

export function useTextToSpeech(): TextToSpeechResult {
  const [state, setState] = useState<TtsState>("idle");
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  // Cache of available voices, populated on mount + voiceschanged event.
  // Some browsers populate voices asynchronously after pageload.
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  const supported =
    typeof window !== "undefined" && typeof window.speechSynthesis !== "undefined";

  useEffect(() => {
    if (!supported) return;
    const refresh = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };
    refresh();
    // Some browsers (Chromium) fire voiceschanged after page load
    window.speechSynthesis.addEventListener("voiceschanged", refresh);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", refresh);
    };
  }, [supported]);

  const cancel = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setState("idle");
  }, [supported]);

  const speak = useCallback(
    (text: string, lang?: string) => {
      if (!supported || !text) return;
      // Cancel any in-flight speech before starting a new one
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      if (lang) {
        utterance.lang = lang;
        const voice = pickVoice(voicesRef.current, lang);
        if (voice) utterance.voice = voice;
      }
      utterance.onstart = () => setState("speaking");
      utterance.onend = () => {
        if (utteranceRef.current === utterance) {
          utteranceRef.current = null;
          setState("idle");
        }
      };
      utterance.onerror = () => {
        if (utteranceRef.current === utterance) {
          utteranceRef.current = null;
          setState("error");
        }
      };
      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [supported]
  );

  const voiceAvailable = useCallback(
    (lang: string): boolean => {
      if (!supported) return false;
      return pickVoice(voicesRef.current, lang) !== null;
    },
    [supported]
  );

  // Cancel any in-flight speech on unmount.
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return { state, speak, cancel, voiceAvailable, supported };
}
