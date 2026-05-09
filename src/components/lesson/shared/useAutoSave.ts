"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SaveState } from "./SaveIndicator";

type Options<V> = {
  /** Current value to watch. Auto-save fires when this changes. */
  value: V;
  /** Called once the debounce window closes. May be async. */
  onSave: (value: V) => void | Promise<void>;
  /** Debounce window before save fires. Default 700ms. */
  debounceMs?: number;
  /** Minimum time the "saving" state stays visible. Default 500ms. */
  savingDisplayMs?: number;
  /** Skip auto-save entirely (e.g. read-only states). */
  disabled?: boolean;
};

/**
 * Lesson-input auto-save hook.
 *
 * Lifecycle: idle → typing → saving → saved.
 * - 700ms after the last keystroke, transitions to "saving" + invokes onSave.
 * - "saving" stays visible for at least 500ms even if onSave returns sooner,
 *   so the indicator doesn't flicker.
 * - Returns to "saved" until the next keystroke flips it to "typing".
 */
export function useAutoSave<V>({
  value,
  onSave,
  debounceMs = 700,
  savingDisplayMs = 500,
  disabled = false,
}: Options<V>) {
  const [state, setState] = useState<SaveState>("idle");
  const lastSavedRef = useRef<V>(value);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const flush = useCallback(async (next: V) => {
    setState("saving");
    const startedAt = Date.now();
    try {
      await onSaveRef.current(next);
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, savingDisplayMs - elapsed);
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }
      lastSavedRef.current = next;
      setState("saved");
    } catch {
      setState("error");
    }
  }, [savingDisplayMs]);

  useEffect(() => {
    if (disabled) return;
    if (Object.is(value, lastSavedRef.current)) return;

    setState("typing");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void flush(value);
    }, debounceMs);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, debounceMs, disabled, flush]);

  /** Force-save now (e.g. on submit / unmount). */
  const flushNow = useCallback(async () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (Object.is(value, lastSavedRef.current)) return;
    await flush(value);
  }, [value, flush]);

  return { state, flushNow };
}
