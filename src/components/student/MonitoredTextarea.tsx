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
  lastActiveTime: number;
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
  const snapshotIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const wordCountIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSnapshotTextRef = useRef<string>("");
  const visibilityListenerRef = useRef<((e: Event) => void) | null>(null);

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
   * Handle keydown: track deletions and count all keystrokes
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      metricsRef.current.keystrokeCount++;
      metricsRef.current.lastActiveTime = Date.now();

      // Count deletions (backspace = 8, delete = 46)
      if (e.key === "Backspace" || e.key === "Delete") {
        metricsRef.current.deletionCount++;
      }
    },
    []
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
   * Set up 30-second snapshot interval
   */
  const setupSnapshotInterval = useCallback(() => {
    snapshotIntervalRef.current = setInterval(() => {
      if (textareaRef.current && textareaRef.current.value !== lastSnapshotTextRef.current) {
        const now = Date.now();
        metricsRef.current.snapshots.push({
          text: textareaRef.current.value,
          timestamp: now,
        });
        lastSnapshotTextRef.current = textareaRef.current.value;
      }
    }, 30000);
  }, []);

  /**
   * Set up 10-second word count history interval
   */
  const setupWordCountInterval = useCallback(() => {
    wordCountIntervalRef.current = setInterval(() => {
      if (textareaRef.current) {
        const wordCount = countWords(textareaRef.current.value);
        const now = Date.now();
        metricsRef.current.wordCountHistory.push({
          timestamp: now,
          wordCount,
        });
      }
    }, 10000);
  }, [countWords]);

  /**
   * Initialize monitoring on mount
   */
  useEffect(() => {
    metricsRef.current.startTime = Date.now();
    metricsRef.current.lastActiveTime = Date.now();
    lastSnapshotTextRef.current = value;

    setupVisibilityListener();
    setupSnapshotInterval();
    setupWordCountInterval();

    return () => {
      // Cleanup: accumulate any remaining focus time
      if (focusStartRef.current !== null) {
        const focusTime = (Date.now() - focusStartRef.current) / 1000;
        metricsRef.current.totalTimeActive += focusTime;
        focusStartRef.current = null;
      }

      // Clear intervals
      if (snapshotIntervalRef.current) clearInterval(snapshotIntervalRef.current);
      if (wordCountIntervalRef.current) clearInterval(wordCountIntervalRef.current);

      // Remove visibility listener
      if (visibilityListenerRef.current) {
        document.removeEventListener(
          "visibilitychange",
          visibilityListenerRef.current
        );
      }
    };
  }, [setupVisibilityListener, setupSnapshotInterval, setupWordCountInterval, value]);

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
