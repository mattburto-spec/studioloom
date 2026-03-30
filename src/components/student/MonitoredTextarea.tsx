"use client";

import {
  useRef,
  useCallback,
  useEffect,
} from "react";

/**
 * IntegrityMetadata: Academic integrity tracking data collected silently from textarea interactions.
 * These metrics enable detection of suspicious authorship patterns (heavy pasting, minimal focus time,
 * rapid composition with no deletions, etc.) without interfering with normal student writing.
 */
export interface IntegrityMetadata {
  /** Array of paste events with timestamp, length, and first 100 chars of content */
  pasteEvents: Array<{ timestamp: number; length: number; content: string }>;
  /** Total seconds the textarea was focused (excluding blur time) */
  totalTimeActive: number;
  /** Total keystroke count */
  keystrokeCount: number;
  /** Tab switches and focus loss events (indicates context-switching or possible cheating prep) */
  focusLossCount: number;
  /** Final character count of the text */
  characterCount: number;
  /** Total delete/backspace key presses */
  deletionCount: number;
  /** Snapshots of text every 30 seconds (or when changed) with timestamp */
  snapshots: Array<{ text: string; timestamp: number }>;
  /** Word count sampled every 10 seconds */
  wordCountHistory: Array<{ timestamp: number; wordCount: number }>;
  /** Timestamp when monitoring began */
  startTime: number;
  /** Timestamp of most recent activity */
  lastActiveTime?: number;
}

interface MonitoredTextareaProps {
  /** HTML id attribute for the textarea */
  id?: string;
  /** Current text value */
  value: string;
  /** Callback when text changes */
  onChange: (value: string) => void;
  /** Optional callback to receive integrity metadata updates */
  onIntegrityUpdate?: (metadata: IntegrityMetadata) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Number of visible rows */
  rows?: number;
  /** Additional Tailwind classes */
  className?: string;
  /** Disable the textarea */
  disabled?: boolean;
}

/**
 * MonitoredTextarea: A standard textarea that silently tracks writing behavior for academic integrity analysis.
 *
 * The component captures:
 * - Paste events (content length and first 100 chars)
 * - Focus time (cumulative seconds textarea had focus)
 * - Keystrokes (total count)
 * - Deletions (backspace/delete count)
 * - Focus losses (tab switches, blur events)
 * - Text snapshots (every 30 seconds if changed)
 * - Word count history (every 10 seconds)
 *
 * All tracking is silent — no UI indicators or feedback to the student.
 * The onIntegrityUpdate callback is called on paste, blur, and snapshot intervals.
 */
export function MonitoredTextarea({
  id,
  value,
  onChange,
  onIntegrityUpdate,
  placeholder = "Type your response here...",
  rows = 4,
  className = "",
  disabled = false,
}: MonitoredTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Mutable tracking state (useRef to avoid re-renders)
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

  const focusTimerRef = useRef<number | null>(null);
  const focusStartRef = useRef<number | null>(null);
  const tickIntervalRef = useRef<NodeJS.Timeout | null>(null); // Single interval replaces 2 separate ones
  const lastSnapshotTextRef = useRef<string>("");
  const visibilityListenerRef = useRef<((e: Event) => void) | null>(null);
  const keystrokeNotifyRef = useRef<NodeJS.Timeout | null>(null); // Debounced keystroke notify

  /** Max snapshots to keep (rolling window) — caps memory for long sessions */
  const MAX_SNAPSHOTS = 20;
  const MAX_WORD_COUNT_HISTORY = 60;

  /**
   * Count words in text (split on whitespace, filter empty)
   */
  const countWords = useCallback((text: string): number => {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }, []);

  /**
   * Update integrity metadata and optionally call callback
   */
  const updateMetrics = useCallback(
    (shouldNotify = false) => {
      if (textareaRef.current) {
        metricsRef.current.characterCount = textareaRef.current.value.length;
      }
      if (shouldNotify && onIntegrityUpdate) {
        onIntegrityUpdate({ ...metricsRef.current });
      }
    },
    [onIntegrityUpdate]
  );

  /**
   * Handle paste events: log content and length
   */
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const pastedText = e.clipboardData.getData("text/plain");
      const now = Date.now();

      metricsRef.current.pasteEvents.push({
        timestamp: now,
        length: pastedText.length,
        content: pastedText.substring(0, 100), // Store first 100 chars
      });

      metricsRef.current.lastActiveTime = now;
      updateMetrics(true); // Notify on paste
    },
    [updateMetrics]
  );

  /**
   * Handle keydown: track deletions and count all keystrokes.
   * Also debounce-notify the parent after 1.5s of inactivity so that
   * integrityMetadataRef is populated before the 2s auto-save fires.
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      metricsRef.current.keystrokeCount++;
      metricsRef.current.lastActiveTime = Date.now();

      // Count deletions (backspace = 8, delete = 46)
      if (e.key === "Backspace" || e.key === "Delete") {
        metricsRef.current.deletionCount++;
      }

      // Debounced notify: fire 1.5s after last keystroke so the parent ref
      // is populated before the 2s auto-save in usePageResponses
      if (keystrokeNotifyRef.current) clearTimeout(keystrokeNotifyRef.current);
      keystrokeNotifyRef.current = setTimeout(() => {
        updateMetrics(true);
      }, 1500);
    },
    [updateMetrics]
  );

  /**
   * Handle focus: start accumulating focus time
   */
  const handleFocus = useCallback(() => {
    focusStartRef.current = Date.now();
  }, []);

  /**
   * Handle blur: accumulate focus time and notify
   */
  const handleBlur = useCallback(() => {
    if (focusStartRef.current !== null) {
      const focusTime = (Date.now() - focusStartRef.current) / 1000; // Convert to seconds
      metricsRef.current.totalTimeActive += focusTime;
      focusStartRef.current = null;
    }
    metricsRef.current.lastActiveTime = Date.now();
    updateMetrics(true); // Notify on blur
  }, [updateMetrics]);

  /**
   * Handle visibility change (tab switch)
   */
  const setupVisibilityListener = useCallback(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab was switched away
        metricsRef.current.focusLossCount++;
        // Also blur if visible
        if (focusStartRef.current !== null) {
          const focusTime = (Date.now() - focusStartRef.current) / 1000;
          metricsRef.current.totalTimeActive += focusTime;
          focusStartRef.current = null;
        }
      } else {
        // Tab was switched back
        focusStartRef.current = Date.now();
      }
      metricsRef.current.lastActiveTime = Date.now();
    };

    visibilityListenerRef.current = handleVisibilityChange;
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  /**
   * Single 30-second tick handles both snapshots and word count history.
   * (Was 2 separate intervals: 30s for snapshots + 10s for word count.
   * Merged into 1 interval to reduce timer overhead. Word count at 30s
   * granularity is sufficient for integrity analysis.)
   */
  const setupMonitoringTick = useCallback(() => {
    tickIntervalRef.current = setInterval(() => {
      if (!textareaRef.current) return;
      const now = Date.now();
      const currentText = textareaRef.current.value;

      // Snapshot (only if text changed, capped at MAX_SNAPSHOTS)
      if (currentText !== lastSnapshotTextRef.current) {
        const snapshots = metricsRef.current.snapshots;
        snapshots.push({ text: currentText, timestamp: now });
        // Rolling window: drop oldest when over cap
        if (snapshots.length > MAX_SNAPSHOTS) {
          metricsRef.current.snapshots = snapshots.slice(-MAX_SNAPSHOTS);
        }
        lastSnapshotTextRef.current = currentText;
      }

      // Word count history (capped at MAX_WORD_COUNT_HISTORY)
      const wordCount = countWords(currentText);
      const wcHistory = metricsRef.current.wordCountHistory;
      wcHistory.push({ timestamp: now, wordCount });
      if (wcHistory.length > MAX_WORD_COUNT_HISTORY) {
        metricsRef.current.wordCountHistory = wcHistory.slice(-MAX_WORD_COUNT_HISTORY);
      }

      // Notify parent so auto-save can pick up integrity data
      // (without this, integrityMetadataRef stays null until blur/paste)
      updateMetrics(true);
    }, 30000);
  }, [countWords, updateMetrics]);

  /**
   * Initialize monitoring on mount
   */
  useEffect(() => {
    metricsRef.current.startTime = Date.now();
    metricsRef.current.lastActiveTime = Date.now();
    lastSnapshotTextRef.current = value;

    setupVisibilityListener();
    setupMonitoringTick();

    return () => {
      // Cleanup: accumulate any remaining focus time
      if (focusStartRef.current !== null) {
        const focusTime = (Date.now() - focusStartRef.current) / 1000;
        metricsRef.current.totalTimeActive += focusTime;
        focusStartRef.current = null;
      }

      // Clear single merged interval
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);

      // Clear debounced keystroke notify
      if (keystrokeNotifyRef.current) clearTimeout(keystrokeNotifyRef.current);

      // Remove visibility listener
      if (visibilityListenerRef.current) {
        document.removeEventListener(
          "visibilitychange",
          visibilityListenerRef.current
        );
      }
    };
  }, [setupVisibilityListener, setupMonitoringTick, value]);

  /**
   * Sync characterCount when value changes
   */
  useEffect(() => {
    metricsRef.current.characterCount = value.length;
  }, [value]);

  // Default Tailwind classes matching ResponseInput textarea
  const baseClassName =
    "w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent resize-y text-sm";
  const finalClassName = className ? `${baseClassName} ${className}` : baseClassName;

  return (
    <textarea
      ref={textareaRef}
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onPaste={handlePaste}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      className={finalClassName}
    />
  );
}
