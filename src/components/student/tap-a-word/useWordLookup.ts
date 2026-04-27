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
 * Phase 1A returns { definition, exampleSentence }. Phase 2 will extend
 * to L1 translation, audio, image — the API contract evolves but the
 * hook's surface stays string-based.
 */

export type LookupState = "idle" | "loading" | "loaded" | "error";

export interface LookupResult {
  state: LookupState;
  word: string | null;
  definition: string | null;
  exampleSentence: string | null;
  errorMessage: string | null;
  lookup: (word: string, contextSentence?: string) => void;
  reset: () => void;
}

interface CachedEntry {
  definition: string;
  exampleSentence: string | null;
}

const DEBOUNCE_MS = 250;

export function useWordLookup(): LookupResult {
  const [state, setState] = useState<LookupState>("idle");
  const [word, setWord] = useState<string | null>(null);
  const [definition, setDefinition] = useState<string | null>(null);
  const [exampleSentence, setExampleSentence] = useState<string | null>(null);
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
    setErrorMessage(null);
  }, []);

  const lookup = useCallback((rawWord: string, contextSentence?: string) => {
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
      setErrorMessage(null);
      return;
    }

    setState("loading");
    setDefinition(null);
    setExampleSentence(null);
    setErrorMessage(null);

    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      inFlightRef.current = controller;
      try {
        const res = await fetch("/api/student/word-lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ word: normalized, contextSentence }),
          signal: controller.signal,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: "lookup failed" }));
          setState("error");
          setErrorMessage(typeof body?.error === "string" ? body.error : "lookup failed");
          return;
        }
        const data = (await res.json()) as { definition?: unknown; exampleSentence?: unknown };
        const def = typeof data?.definition === "string" ? data.definition : "";
        const ex = typeof data?.exampleSentence === "string" ? data.exampleSentence : null;
        if (!def) {
          setState("error");
          setErrorMessage("no definition returned");
          return;
        }
        cacheRef.current.set(normalized, { definition: def, exampleSentence: ex });
        setState("loaded");
        setDefinition(def);
        setExampleSentence(ex);
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
  }, []);

  // Clean up on unmount.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (inFlightRef.current) inFlightRef.current.abort();
    };
  }, []);

  return { state, word, definition, exampleSentence, errorMessage, lookup, reset };
}
