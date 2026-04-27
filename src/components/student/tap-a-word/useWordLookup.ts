"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Hook for tap-a-word: fetches definitions from /api/student/word-lookup.
 *
 * - In-memory cache scoped per hook instance (page-session). Same word
 *   tapped twice never re-fetches.
 * - Debounced (250ms) so accidental rapid taps coalesce.
 * - State machine: idle → loading → loaded | error
 *
 * Phase 1A: { definition, exampleSentence }.
 * Phase 2A: + { l1Translation, l1Target } — server resolves l1Target from
 * the student's learning_profile, so the client just renders what comes back.
 * Phase 2B/2C will add audio (browser SpeechSynthesis) + image (static dict).
 */

export type LookupState = "idle" | "loading" | "loaded" | "error";

export interface LookupResult {
  state: LookupState;
  word: string | null;
  definition: string | null;
  exampleSentence: string | null;
  l1Translation: string | null;
  l1Target: string | null;
  errorMessage: string | null;
  lookup: (word: string, contextSentence?: string) => void;
  reset: () => void;
}

interface CachedEntry {
  definition: string;
  exampleSentence: string | null;
  l1Translation: string | null;
  l1Target: string | null;
}

const DEBOUNCE_MS = 250;

export interface UseWordLookupOpts {
  /**
   * Phase 2.5: optional class context. When provided, the route's resolver
   * applies per-class overrides (l1_target_override, tap_a_word_enabled).
   * When omitted, only per-student overrides apply.
   */
  classId?: string;
}

export function useWordLookup(opts: UseWordLookupOpts = {}): LookupResult {
  const { classId } = opts;
  const [state, setState] = useState<LookupState>("idle");
  const [word, setWord] = useState<string | null>(null);
  const [definition, setDefinition] = useState<string | null>(null);
  const [exampleSentence, setExampleSentence] = useState<string | null>(null);
  const [l1Translation, setL1Translation] = useState<string | null>(null);
  const [l1Target, setL1Target] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cacheRef = useRef<Map<string, CachedEntry>>(new Map());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (inFlightRef.current) {
      inFlightRef.current.abort();
      inFlightRef.current = null;
    }
    setState("idle");
    setWord(null);
    setDefinition(null);
    setExampleSentence(null);
    setL1Translation(null);
    setL1Target(null);
    setErrorMessage(null);
  }, []);

  const lookup = useCallback((rawWord: string, contextSentence?: string) => {
    // Note: classId is captured from the closure (re-renders create a new
    // lookup callback when classId changes — useCallback dep below).
    const normalized = rawWord.trim().toLowerCase();
    if (!normalized || normalized.length < 2) {
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (inFlightRef.current) {
      inFlightRef.current.abort();
      inFlightRef.current = null;
    }

    setWord(normalized);

    // Cache hit: skip the network round-trip entirely.
    const cached = cacheRef.current.get(normalized);
    if (cached) {
      setState("loaded");
      setDefinition(cached.definition);
      setExampleSentence(cached.exampleSentence);
      setL1Translation(cached.l1Translation);
      setL1Target(cached.l1Target);
      setErrorMessage(null);
      return;
    }

    setState("loading");
    setDefinition(null);
    setExampleSentence(null);
    setL1Translation(null);
    setL1Target(null);
    setErrorMessage(null);

    // Capture classId at lookup() invocation time so the value used in the
    // debounced fetch matches the value the user saw when they tapped.
    const currentClassId = classId;
    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      inFlightRef.current = controller;
      try {
        const res = await fetch("/api/student/word-lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ word: normalized, contextSentence, classId: currentClassId }),
          signal: controller.signal,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: "lookup failed" }));
          setState("error");
          setErrorMessage(typeof body?.error === "string" ? body.error : "lookup failed");
          return;
        }
        const data = (await res.json()) as {
          definition?: unknown;
          exampleSentence?: unknown;
          l1Translation?: unknown;
          l1Target?: unknown;
        };
        const def = typeof data?.definition === "string" ? data.definition : "";
        const ex = typeof data?.exampleSentence === "string" ? data.exampleSentence : null;
        const l1t = typeof data?.l1Translation === "string" ? data.l1Translation : null;
        const l1tgt = typeof data?.l1Target === "string" ? data.l1Target : null;
        if (!def) {
          setState("error");
          setErrorMessage("no definition returned");
          return;
        }
        cacheRef.current.set(normalized, {
          definition: def,
          exampleSentence: ex,
          l1Translation: l1t,
          l1Target: l1tgt,
        });
        setState("loaded");
        setDefinition(def);
        setExampleSentence(ex);
        setL1Translation(l1t);
        setL1Target(l1tgt);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setState("error");
        setErrorMessage(err instanceof Error ? err.message : "network error");
      } finally {
        if (inFlightRef.current === controller) {
          inFlightRef.current = null;
        }
      }
    }, DEBOUNCE_MS);
  }, [classId]);

  // Clean up on unmount.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (inFlightRef.current) inFlightRef.current.abort();
    };
  }, []);

  return {
    state,
    word,
    definition,
    exampleSentence,
    l1Translation,
    l1Target,
    errorMessage,
    lookup,
    reset,
  };
}
