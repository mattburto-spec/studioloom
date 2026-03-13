"use client";

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import type { UnitWizardInput } from "@/types";

export interface Suggestions {
  globalContext?: string[];
  keyConcept?: string[];
  relatedConcepts?: string[];
  statementOfInquiry?: string;
  criteriaEmphasis?: { criterion: string; direction: string; reason: string }[];
}

export type SuggestionStatus = "idle" | "loading" | "done" | "error";

export function useWizardSuggestions(input: UnitWizardInput) {
  const [rawSuggestions, setRawSuggestions] = useState<Suggestions>({});
  const [status, setStatus] = useState<SuggestionStatus>("idle");
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTopicRef = useRef<string>("");

  // Use a ref to always have the latest input without re-triggering effects
  const inputRef = useRef(input);
  inputRef.current = input;

  const doFetch = useCallback(async (tier: 1 | 2 | 3) => {
    const current = inputRef.current;
    const context = {
      topic: current.topic,
      title: current.title || undefined,
      gradeLevel: current.gradeLevel || undefined,
      globalContext: current.globalContext || undefined,
      keyConcept: current.keyConcept || undefined,
      relatedConcepts: current.relatedConcepts.length > 0 ? current.relatedConcepts : undefined,
      statementOfInquiry: current.statementOfInquiry || undefined,
    };

    // Cancel in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("loading");

    try {
      const res = await fetch("/api/teacher/wizard-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, context }),
        signal: controller.signal,
      });

      if (!res.ok) {
        setStatus("error");
        return;
      }

      const data = await res.json();
      setRawSuggestions((prev) => ({ ...prev, ...(data.suggestions || {}) }));
      setStatus("done");
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setStatus("error");
    }
  }, []);

  // Dismiss a specific suggestion
  const dismiss = useCallback((key: string, value?: string) => {
    setDismissedKeys((prev) => new Set(prev).add(`${key}:${value || ""}`));
  }, []);

  // Clear a field's suggestions (called after accepting)
  const clearField = useCallback((field: keyof Suggestions) => {
    setRawSuggestions((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  // Clear dismissed when topic changes
  useEffect(() => {
    if (input.topic !== lastTopicRef.current) {
      lastTopicRef.current = input.topic;
      setDismissedKeys(new Set());
    }
  }, [input.topic]);

  // --- Tier 1: topic/title/grade changes (debounce 800ms) ---
  useEffect(() => {
    if (input.topic.trim().length < 10) {
      setRawSuggestions({});
      setStatus("idle");
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doFetch(1), 800);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [input.topic, input.title, input.gradeLevel, doFetch]);

  // --- Tier 2: globalContext selected (debounce 150ms) ---
  useEffect(() => {
    if (!input.globalContext || input.topic.trim().length < 10) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doFetch(2), 150);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [input.globalContext, input.topic, doFetch]);

  // --- Tier 3: keyConcept selected (debounce 150ms) ---
  useEffect(() => {
    if (!input.keyConcept || !input.globalContext || input.topic.trim().length < 10) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doFetch(3), 150);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [input.keyConcept, input.globalContext, input.topic, doFetch]);

  // Filter out already-selected values and dismissed suggestions
  const suggestions = useMemo(() => {
    const s = { ...rawSuggestions };

    if (input.globalContext && s.globalContext) {
      s.globalContext = s.globalContext.filter((v) => v !== input.globalContext);
      if (s.globalContext.length === 0) delete s.globalContext;
    }

    if (input.keyConcept && s.keyConcept) {
      s.keyConcept = s.keyConcept.filter((v) => v !== input.keyConcept);
      if (s.keyConcept.length === 0) delete s.keyConcept;
    }

    if (s.relatedConcepts) {
      s.relatedConcepts = s.relatedConcepts.filter((v) => !input.relatedConcepts.includes(v));
      if (s.relatedConcepts.length === 0) delete s.relatedConcepts;
    }

    if (input.statementOfInquiry?.trim() && s.statementOfInquiry) {
      delete s.statementOfInquiry;
    }

    // Filter dismissed
    if (s.globalContext) {
      s.globalContext = s.globalContext.filter((v) => !dismissedKeys.has(`globalContext:${v}`));
      if (s.globalContext.length === 0) delete s.globalContext;
    }
    if (s.keyConcept) {
      s.keyConcept = s.keyConcept.filter((v) => !dismissedKeys.has(`keyConcept:${v}`));
      if (s.keyConcept.length === 0) delete s.keyConcept;
    }
    if (s.relatedConcepts) {
      s.relatedConcepts = s.relatedConcepts.filter((v) => !dismissedKeys.has(`relatedConcepts:${v}`));
      if (s.relatedConcepts.length === 0) delete s.relatedConcepts;
    }
    if (s.statementOfInquiry && dismissedKeys.has("statementOfInquiry:")) {
      delete s.statementOfInquiry;
    }
    if (s.criteriaEmphasis) {
      s.criteriaEmphasis = s.criteriaEmphasis.filter(
        (e) => !dismissedKeys.has(`criteriaEmphasis:${e.criterion}`)
      );
      if (s.criteriaEmphasis.length === 0) delete s.criteriaEmphasis;
    }

    return s;
  }, [rawSuggestions, input.globalContext, input.keyConcept, input.relatedConcepts, input.statementOfInquiry, dismissedKeys]);

  return { suggestions, status, dismiss, clearField };
}
