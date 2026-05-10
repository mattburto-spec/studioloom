"use client";

/**
 * useIntegrityTracking — reusable academic-integrity metric collector
 * for plain `<textarea>` elements.
 *
 * Round 18 (6 May 2026). MonitoredTextarea bakes its tracking into a
 * RichTextEditor wrapper, which doesn't fit the per-prompt plain
 * textareas inside StructuredPromptsResponse. Extracting the metric
 * collection into a hook lets both surfaces share the SAME contract
 * (IntegrityMetadata shape, debounced notify, paste/blur/visibility
 * events) without coupling structured-prompts to rich-text rendering.
 *
 * Usage — bind the returned handlers to one or more `<textarea>`
 * elements that all contribute to a SINGLE IntegrityMetadata object:
 *
 *   const monitor = useIntegrityTracking({
 *     enabled,
 *     onIntegrityUpdate,
 *     getCombinedText: () => composeContent(prompts, responses),
 *   });
 *
 *   <textarea
 *     onPaste={monitor.handlers.onPaste}
 *     onKeyDown={monitor.handlers.onKeyDown}
 *     onFocus={monitor.handlers.onFocus}
 *     onBlur={monitor.handlers.onBlur}
 *     ...
 *   />
 *
 * The combined-text getter is supplied by the caller because
 * StructuredPromptsResponse aggregates across many fields. The hook
 * uses it on each notify so characterCount + snapshots reflect the
 * full composed value, not a single field.
 */

import { useCallback, useEffect, useRef } from "react";
import type { IntegrityMetadata } from "@/components/student/MonitoredTextarea";

interface UseIntegrityTrackingArgs {
  enabled: boolean;
  onIntegrityUpdate?: (metadata: IntegrityMetadata) => void;
  /** Returns the COMBINED text across all monitored fields. */
  getCombinedText: () => string;
}

const SNAPSHOT_INTERVAL_MS = 30_000;
const WORD_COUNT_INTERVAL_MS = 10_000;
const KEYSTROKE_NOTIFY_DEBOUNCE_MS = 1_500;
const MAX_SNAPSHOTS = 20;
const MAX_WORD_COUNT_HISTORY = 60;

export function useIntegrityTracking({
  enabled,
  onIntegrityUpdate,
  getCombinedText,
}: UseIntegrityTrackingArgs) {
  const metricsRef = useRef<IntegrityMetadata>({
    pasteEvents: [],
    totalTimeActive: 0,
    keystrokeCount: 0,
    focusLossCount: 0,
    characterCount: 0,
    deletionCount: 0,
    snapshots: [],
    wordCountHistory: [],
    startTime: Date.now(),
    lastActiveTime: Date.now(),
  });

  const focusStartRef = useRef<number | null>(null);
  const lastSnapshotTextRef = useRef<string>("");
  const tickIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const keystrokeNotifyRef = useRef<NodeJS.Timeout | null>(null);

  /** Refresh characterCount from current combined text + optionally notify. */
  const updateMetrics = useCallback(
    (shouldNotify = false) => {
      const text = getCombinedText();
      metricsRef.current.characterCount = text.length;
      if (shouldNotify && onIntegrityUpdate) {
        onIntegrityUpdate({ ...metricsRef.current });
      }
    },
    [getCombinedText, onIntegrityUpdate]
  );

  // Periodic ticks: snapshot every 30s, word-count every 10s.
  useEffect(() => {
    if (!enabled) return;
    let lastSnapshotAt = Date.now();
    let lastWordAt = Date.now();
    tickIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const text = getCombinedText();
      // Snapshot
      if (now - lastSnapshotAt >= SNAPSHOT_INTERVAL_MS) {
        if (text !== lastSnapshotTextRef.current) {
          metricsRef.current.snapshots.push({ timestamp: now, text });
          if (metricsRef.current.snapshots.length > MAX_SNAPSHOTS) {
            metricsRef.current.snapshots.shift();
          }
          lastSnapshotTextRef.current = text;
        }
        lastSnapshotAt = now;
      }
      // Word count
      if (now - lastWordAt >= WORD_COUNT_INTERVAL_MS) {
        const words = text.trim().split(/\s+/).filter(Boolean).length;
        metricsRef.current.wordCountHistory.push({ timestamp: now, wordCount: words });
        if (
          metricsRef.current.wordCountHistory.length > MAX_WORD_COUNT_HISTORY
        ) {
          metricsRef.current.wordCountHistory.shift();
        }
        lastWordAt = now;
      }
    }, 1_000);
    return () => {
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
    };
  }, [enabled, getCombinedText]);

  // Tab-visibility tracking
  useEffect(() => {
    if (!enabled) return;
    function onVis() {
      if (document.hidden) {
        metricsRef.current.focusLossCount++;
        updateMetrics(false);
      }
    }
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [enabled, updateMetrics]);

  // Notify on unmount so the parent's ref + autosave have a final
  // snapshot of the session.
  useEffect(() => {
    return () => {
      if (enabled && onIntegrityUpdate) {
        onIntegrityUpdate({ ...metricsRef.current });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Handlers — bind to each <textarea> ────────────────────────────

  // LIS.B — handlers typed for HTMLElement (the supertype of HTMLTextAreaElement
  // AND HTMLDivElement) so contenteditable div surfaces (RichTextResponse)
  // can use the same hook as plain textarea surfaces (StructuredPromptsResponse).
  // Function parameter contravariance: an HTMLElement handler is assignable
  // to slots typed for HTMLTextAreaElement or HTMLDivElement events.
  const onPaste = useCallback(
    (e: React.ClipboardEvent<HTMLElement>) => {
      if (!enabled) return;
      const pasted = e.clipboardData.getData("text/plain");
      const now = Date.now();
      metricsRef.current.pasteEvents.push({
        timestamp: now,
        length: pasted.length,
        content: pasted.substring(0, 100),
      });
      metricsRef.current.lastActiveTime = now;
      // Re-read combined text on next tick so React state has updated.
      setTimeout(() => updateMetrics(true), 0);
    },
    [enabled, updateMetrics]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (!enabled) return;
      metricsRef.current.keystrokeCount++;
      metricsRef.current.lastActiveTime = Date.now();
      if (e.key === "Backspace" || e.key === "Delete") {
        metricsRef.current.deletionCount++;
      }
      // Debounced notify so the parent ref is populated before the
      // 2s autosave fires.
      if (keystrokeNotifyRef.current) clearTimeout(keystrokeNotifyRef.current);
      keystrokeNotifyRef.current = setTimeout(() => {
        updateMetrics(true);
      }, KEYSTROKE_NOTIFY_DEBOUNCE_MS);
    },
    [enabled, updateMetrics]
  );

  const onFocus = useCallback(() => {
    if (!enabled) return;
    focusStartRef.current = Date.now();
  }, [enabled]);

  const onBlur = useCallback(() => {
    if (!enabled) return;
    if (focusStartRef.current !== null) {
      const focusTime = (Date.now() - focusStartRef.current) / 1000;
      metricsRef.current.totalTimeActive += focusTime;
      focusStartRef.current = null;
    }
    metricsRef.current.lastActiveTime = Date.now();
    updateMetrics(true);
  }, [enabled, updateMetrics]);

  return {
    handlers: {
      onPaste,
      onKeyDown,
      onFocus,
      onBlur,
    },
    /** Force a metric snapshot — use before explicit saves. */
    flush: useCallback(() => updateMetrics(true), [updateMetrics]),
  };
}
