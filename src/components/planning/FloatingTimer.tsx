"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface FloatingTimerProps {
  unitId: string;
  onTimeUpdate?: (seconds: number) => void;
}

export function FloatingTimer({ unitId, onTimeUpdate }: FloatingTimerProps) {
  const [expanded, setExpanded] = useState(false);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load saved time from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`timer_${unitId}`);
    if (saved) setElapsed(parseInt(saved, 10) || 0);
  }, [unitId]);

  // Save time to localStorage when it changes
  useEffect(() => {
    if (elapsed > 0) {
      localStorage.setItem(`timer_${unitId}`, String(elapsed));
    }
  }, [elapsed, unitId]);

  const tick = useCallback(() => {
    setElapsed((prev) => {
      const next = prev + 1;
      if (onTimeUpdate && next % 30 === 0) onTimeUpdate(next);
      return next;
    });
  }, [onTimeUpdate]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(tick, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, tick]);

  function formatTime(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function reset() {
    setRunning(false);
    setElapsed(0);
    localStorage.removeItem(`timer_${unitId}`);
  }

  return (
    <div className="fixed bottom-20 right-4 z-40">
      {expanded ? (
        <div className="bg-white rounded-xl shadow-lg border border-border p-4 w-56">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
              Timer
            </span>
            <button
              onClick={() => setExpanded(false)}
              className="text-text-secondary hover:text-text-primary text-xs"
            >
              ✕
            </button>
          </div>

          <div className="text-center mb-3">
            <p className="text-3xl font-mono font-bold text-text-primary">
              {formatTime(elapsed)}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setRunning(!running)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                running
                  ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                  : "bg-accent-green/10 text-accent-green hover:bg-accent-green/20"
              }`}
            >
              {running ? "⏸ Pause" : "▶ Start"}
            </button>
            <button
              onClick={reset}
              className="px-3 py-2 rounded-lg text-sm text-text-secondary border border-border hover:bg-surface-alt transition"
            >
              ↺
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setExpanded(true)}
          className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-white transition hover:scale-110 ${
            running
              ? "bg-amber-500 animate-pulse"
              : "bg-dark-blue hover:bg-dark-blue/90"
          }`}
          title="Timer"
        >
          {running ? (
            <span className="text-xs font-mono font-bold">
              {formatTime(elapsed).split(":").slice(-2).join(":")}
            </span>
          ) : (
            <span className="text-lg">⏱</span>
          )}
        </button>
      )}
    </div>
  );
}
