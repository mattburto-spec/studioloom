"use client";

import { useState, useCallback, useRef } from "react";
import type { ActivitySection } from "@/types";
import { BLOCK_LIBRARY } from "./BlockPalette";

export interface AISuggestion {
  id: string;
  blockId: string;
  activity: ActivitySection;
  label: string;
  icon: string;
  reason: string;
  phase: "opening" | "miniLesson" | "workTime" | "debrief";
}

interface UseAISuggestionsProps {
  unitId: string;
  classId: string;
}

interface UseAISuggestionsReturn {
  suggestions: AISuggestion[];
  loading: boolean;
  error: string | null;
  fetchSuggestions: (context: SuggestionContext) => void;
  dismissSuggestion: (id: string) => void;
  acceptSuggestion: (id: string) => AISuggestion | undefined;
  clearSuggestions: () => void;
  /** Block IDs that AI recommends for the palette highlight */
  suggestedBlockIds: string[];
}

export interface SuggestionContext {
  lessonTitle: string;
  learningGoal: string;
  existingActivities: ActivitySection[];
  workshopPhases?: {
    opening?: { hook?: string };
    miniLesson?: { focus?: string };
    debrief?: { protocol?: string; prompt?: string };
  };
}

/**
 * useAISuggestions — Fetches AI-generated ghost block suggestions
 * based on the current lesson context.
 *
 * Calls /api/teacher/lesson-editor/suggest which uses Haiku 4.5
 * for fast, cheap suggestions.
 */
export function useAISuggestions({
  unitId,
  classId,
}: UseAISuggestionsProps): UseAISuggestionsReturn {
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchSuggestions = useCallback(
    async (context: SuggestionContext) => {
      // Abort any in-flight request
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/teacher/lesson-editor/suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ unitId, classId, context }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to get suggestions");
        }

        const data = await res.json();

        // Map AI response to AISuggestion objects
        const mapped: AISuggestion[] = (data.suggestions || [])
          .map((s: { blockId: string; reason: string; phase: string; promptOverride?: string }) => {
            const blockDef = BLOCK_LIBRARY.find((b) => b.id === s.blockId);
            if (!blockDef) return null;

            const activity = blockDef.create();
            if (s.promptOverride) {
              activity.prompt = s.promptOverride;
            }

            return {
              id: `suggestion-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              blockId: s.blockId,
              activity,
              label: blockDef.label,
              icon: blockDef.icon,
              reason: s.reason,
              phase: s.phase as AISuggestion["phase"],
            };
          })
          .filter(Boolean) as AISuggestion[];

        setSuggestions(mapped);
      } catch (err: unknown) {
        if ((err as Error).name === "AbortError") return;
        setError((err as Error).message || "Failed to get suggestions");
      } finally {
        setLoading(false);
      }
    },
    [unitId, classId]
  );

  const dismissSuggestion = useCallback((id: string) => {
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const acceptSuggestion = useCallback(
    (id: string) => {
      const suggestion = suggestions.find((s) => s.id === id);
      if (suggestion) {
        setSuggestions((prev) => prev.filter((s) => s.id !== id));
      }
      return suggestion;
    },
    [suggestions]
  );

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
  }, []);

  const suggestedBlockIds = suggestions.map((s) => s.blockId);

  return {
    suggestions,
    loading,
    error,
    fetchSuggestions,
    dismissSuggestion,
    acceptSuggestion,
    clearSuggestions,
    suggestedBlockIds,
  };
}
