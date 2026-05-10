"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { imageForWord } from "@/lib/tap-a-word/image-dictionary";
import { tapLog } from "./debug";

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
 * Phase 2B: audio handled by browser SpeechSynthesis directly in WordPopover (no hook state needed).
 * Phase 2C: + { imageUrl } — pure client-side lookup via static dictionary,
 * no extra network roundtrip; populated alongside the API response.
 */

export type LookupState = "idle" | "loading" | "loaded" | "error";

export interface LookupResult {
  state: LookupState;
  word: string | null;
  definition: string | null;
  exampleSentence: string | null;
  l1Translation: string | null;
  l1Target: string | null;
  imageUrl: string | null;
  errorMessage: string | null;
  lookup: (word: string, contextSentence?: string) => void;
  /** Re-run the last lookup. Used by the popover's error-state retry button. */
  retry: () => void;
  reset: () => void;
}

interface CachedEntry {
  definition: string;
  exampleSentence: string | null;
  l1Translation: string | null;
  l1Target: string | null;
  imageUrl: string | null;
}

const DEBOUNCE_MS = 250;
/**
 * Hard ceiling for the loading state. If the API doesn't respond within this
 * window, the popover should transition to error rather than displaying
 * "Looking up…" forever (or — given a parent re-render race — silently
 * vanishing). Vercel function timeout is 10s on hobby / 60s on pro; 15s
 * gives enough headroom for a slow Haiku call without leaving students
 * staring at a stalled popover.
 */
const LOADING_TIMEOUT_MS = 15000;

export interface UseWordLookupOpts {
  /**
   * Phase 2.5: optional class context. When provided, the route's resolver
   * applies per-class overrides (l1_target_override, tap_a_word_enabled).
   * When omitted, only per-student overrides apply.
   */
  classId?: string;
  /**
   * Bug 2 (28 Apr 2026): optional unit context. When passed without classId,
   * the server derives classId via class_units × class_students. classId
   * wins when both are sent.
   */
  unitId?: string;
}

export function useWordLookup(opts: UseWordLookupOpts = {}): LookupResult {
  const { classId, unitId } = opts;
  const [state, setState] = useState<LookupState>("idle");
  const [word, setWord] = useState<string | null>(null);
  const [definition, setDefinition] = useState<string | null>(null);
  const [exampleSentence, setExampleSentence] = useState<string | null>(null);
  const [l1Translation, setL1Translation] = useState<string | null>(null);
  const [l1Target, setL1Target] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cacheRef = useRef<Map<string, CachedEntry>>(new Map());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef<AbortController | null>(null);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Last lookup args — used by retry() to re-run the same word. */
  const lastArgsRef = useRef<{ word: string; contextSentence?: string } | null>(null);

  const reset = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
    if (inFlightRef.current) {
      inFlightRef.current.abort();
      inFlightRef.current = null;
    }
    lastArgsRef.current = null;
    setState("idle");
    setWord(null);
    setDefinition(null);
    setExampleSentence(null);
    setL1Translation(null);
    setL1Target(null);
    setImageUrl(null);
    setErrorMessage(null);
  }, []);

  const lookup = useCallback((rawWord: string, contextSentence?: string) => {
    // Note: classId is captured from the closure (re-renders create a new
    // lookup callback when classId changes — useCallback dep below).
    const normalized = rawWord.trim().toLowerCase();
    if (!normalized || normalized.length < 2) {
      return;
    }

    // Stash the args so retry() can re-run with the same input.
    lastArgsRef.current = { word: normalized, contextSentence };

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
    if (inFlightRef.current) {
      inFlightRef.current.abort();
      inFlightRef.current = null;
    }

    setWord(normalized);

    // Cache hit: skip the network round-trip entirely.
    const cached = cacheRef.current.get(normalized);
    if (cached) {
      tapLog("in-memory cache hit", { word: normalized });
      setState("loaded");
      setDefinition(cached.definition);
      setExampleSentence(cached.exampleSentence);
      setL1Translation(cached.l1Translation);
      setL1Target(cached.l1Target);
      setImageUrl(cached.imageUrl);
      setErrorMessage(null);
      return;
    }

    setState("loading");
    setDefinition(null);
    setExampleSentence(null);
    setL1Translation(null);
    setL1Target(null);
    setImageUrl(null);
    setErrorMessage(null);

    // Capture classId + unitId at lookup() invocation time so the values
    // used in the debounced fetch match what the user saw when they tapped.
    const currentClassId = classId;
    const currentUnitId = unitId;
    // Hard-cap the loading window. If neither response nor abort lands in
    // this window, force the popover to error state with a retry button.
    //
    // Round 24 (6 May 2026) — capture the timeout handle locally so the
    // fetch's finally block only clears OUR timeout, not whatever the
    // ref currently points at. Previous code: tapping word B while word
    // A's fetch was in flight aborted A → A's finally fired → A's
    // finally cleared loadingTimeoutRef.current, which by that point
    // was B's timeout. Result: B's loading window was uncapped. If B's
    // fetch hung, popover sat in "Looking up…" forever.
    const myTimeoutHandle = setTimeout(() => {
      if (inFlightRef.current) {
        inFlightRef.current.abort();
        inFlightRef.current = null;
      }
      setState("error");
      setErrorMessage("Lookup timed out. Tap retry to try again.");
    }, LOADING_TIMEOUT_MS);
    loadingTimeoutRef.current = myTimeoutHandle;

    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      inFlightRef.current = controller;
      const t0 =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      try {
        const res = await fetch("/api/student/word-lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            word: normalized,
            contextSentence,
            classId: currentClassId,
            unitId: currentUnitId,
          }),
          signal: controller.signal,
        });
        const elapsed = Math.round(
          (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0
        );
        tapLog("fetch resolved", {
          word: normalized,
          status: res.status,
          ok: res.ok,
          elapsed_ms: elapsed,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: "lookup failed" }));
          const code = typeof body?.error === "string" ? body.error : "lookup failed";
          // Round 24 — translate server reason codes to student-friendly
          // copy. Keeps the underlying code in console.warn for diagnosis
          // but shows something readable in the popover.
          const friendly =
            code === "budget_exceeded"
              ? "Your AI word-lookup limit is up for now. Try again later or ask your teacher."
              : code === "model_truncated"
                ? "The lookup got cut off. Tap retry."
                : code === "model did not return a tool_use block" ||
                    code === "model returned empty definition"
                  ? "Couldn't get a clean definition for this word. Tap retry."
                  : code === "ANTHROPIC_API_KEY not configured"
                    ? "The lookup service isn't set up. Tell your teacher."
                    : code === "Unauthorized"
                      ? "Your session expired. Refresh the page and try again."
                      : "Couldn't load the definition. Tap retry.";
          tapLog("server error", {
            word: normalized,
            status: res.status,
            code,
          });
          setState("error");
          setErrorMessage(friendly);
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
          setErrorMessage("Couldn't get a clean definition for this word. Tap retry.");
          return;
        }
        // Phase 2C: synchronous image lookup against the static dictionary.
        // No extra network call — populated alongside the API response.
        const img = imageForWord(normalized);
        cacheRef.current.set(normalized, {
          definition: def,
          exampleSentence: ex,
          l1Translation: l1t,
          l1Target: l1tgt,
          imageUrl: img,
        });
        setState("loaded");
        setDefinition(def);
        setExampleSentence(ex);
        setL1Translation(l1t);
        setL1Target(l1tgt);
        setImageUrl(img);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          tapLog("fetch aborted", { word: normalized });
          return;
        }
        tapLog("fetch failed", {
          word: normalized,
          error: err instanceof Error ? err.message : String(err),
        });
        setState("error");
        setErrorMessage(
          "Couldn't reach the lookup service. Check your connection and tap retry."
        );
      } finally {
        if (inFlightRef.current === controller) {
          inFlightRef.current = null;
        }
        // Round 24 — only clear OUR timeout. If a sibling lookup has
        // since stomped loadingTimeoutRef.current with its own timeout,
        // leave it alone — it's still arming the cap for the new fetch.
        clearTimeout(myTimeoutHandle);
        if (loadingTimeoutRef.current === myTimeoutHandle) {
          loadingTimeoutRef.current = null;
        }
      }
    }, DEBOUNCE_MS);
  }, [classId, unitId]);

  const retry = useCallback(() => {
    const args = lastArgsRef.current;
    if (!args) return;
    lookup(args.word, args.contextSentence);
  }, [lookup]);

  // Clean up on unmount.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
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
    imageUrl,
    errorMessage,
    lookup,
    retry,
    reset,
  };
}
