"use client";

import React, { useState, useEffect } from "react";

interface ClassClockProps {
  periodEndTime?: string; // HH:MM format, e.g. "10:45"
  onStartClass?: () => void;
}

export default function ClassClock({ periodEndTime, onStartClass }: ClassClockProps) {
  const [currentTime, setCurrentTime] = useState<string>("");
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [startTime, setStartTime] = useState<number | null>(null);

  // Update current time every second
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const period = now.getHours() >= 12 ? "PM" : "AM";
      const displayHours = now.getHours() % 12 || 12;
      setCurrentTime(`${displayHours}:${minutes} ${period}`);
    };

    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // Update elapsed time
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      if (startTime) {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setElapsedSeconds(elapsed);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isRunning, startTime]);

  const handleStart = () => {
    if (!isRunning) {
      setStartTime(Date.now());
      setElapsedSeconds(0);
      setIsRunning(true);
      onStartClass?.();
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    setStartTime(null);
    setElapsedSeconds(0);
  };

  // Calculate time remaining if periodEndTime provided
  let timeRemaining: number | null = null;
  if (periodEndTime && isRunning) {
    const [endHours, endMinutes] = periodEndTime.split(":").map(Number);
    const now = new Date();
    const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endHours, endMinutes);
    const remaining = Math.max(0, Math.floor((endDate.getTime() - Date.now()) / 1000));
    timeRemaining = remaining;
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getTimeRemainingText = (): string => {
    if (!timeRemaining && timeRemaining !== 0) return "";
    if (timeRemaining === 0) return "Time's up";
    const mins = Math.floor(timeRemaining / 60);
    return `${mins}m left`;
  };

  const isLowTime = timeRemaining !== null && timeRemaining < 300; // 5 minutes
  const isTimeUp = timeRemaining === 0;

  const textColor = isTimeUp ? "#ef4444" : isLowTime ? "#f59e0b" : "#e5e7eb";
  const displayText = isRunning
    ? `${currentTime} · ${formatTime(elapsedSeconds)}${timeRemaining !== null ? ` · ${getTimeRemainingText()}` : ""}`
    : currentTime;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        fontFamily: "'Menlo', 'Monaco', monospace",
        fontSize: "13px",
        fontWeight: 500,
        color: textColor,
        userSelect: "none",
        transition: "color 0.3s ease",
      }}
    >
      <span>⏱</span>
      <span>{displayText}</span>

      {!isRunning ? (
        <button
          onClick={handleStart}
          style={{
            background: "#6366f1",
            color: "#fff",
            border: "none",
            padding: "4px 10px",
            borderRadius: "4px",
            fontSize: "11px",
            fontWeight: 600,
            cursor: "pointer",
            transition: "background 0.2s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#4f46e5")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#6366f1")}
        >
          Start
        </button>
      ) : (
        <button
          onClick={handleReset}
          style={{
            background: "#ef4444",
            color: "#fff",
            border: "none",
            padding: "4px 10px",
            borderRadius: "4px",
            fontSize: "11px",
            fontWeight: 600,
            cursor: "pointer",
            transition: "background 0.2s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#dc2626")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#ef4444")}
        >
          Reset
        </button>
      )}
    </div>
  );
}
