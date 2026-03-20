'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

interface QuickTimerProps {
  onProjectToScreen?: (data: { type: 'timer'; seconds: number; label: string }) => void;
}

const PRESETS = [
  { label: '30s', seconds: 30 },
  { label: '1m', seconds: 60 },
  { label: '2m', seconds: 120 },
  { label: '3m', seconds: 180 },
  { label: '5m', seconds: 300 },
  { label: '10m', seconds: 600 },
];

export default function QuickTimer({ onProjectToScreen }: QuickTimerProps) {
  const [totalSeconds, setTotalSeconds] = useState<number>(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [isRunning, setIsRunning] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const flashTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Timer countdown logic
  useEffect(() => {
    if (!isRunning || remainingSeconds <= 0) return;

    intervalRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          setIsRunning(false);
          setIsComplete(true);
          clearInterval(intervalRef.current!);
          // Flash effect for 1 second
          flashTimeoutRef.current = setTimeout(() => {
            setIsComplete(false);
          }, 1000);
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, remainingSeconds]);

  const startTimer = useCallback((seconds: number, label?: string) => {
    setTotalSeconds(seconds);
    setRemainingSeconds(seconds);
    setIsRunning(true);
    setIsComplete(false);
    if (label && onProjectToScreen) {
      onProjectToScreen({ type: 'timer', seconds, label });
    }
  }, [onProjectToScreen]);

  const handlePresetClick = (seconds: number, label: string) => {
    startTimer(seconds, label);
  };

  const handleCustomStart = () => {
    const minutes = parseInt(customMinutes, 10);
    if (isNaN(minutes) || minutes <= 0) return;
    const seconds = minutes * 60;
    startTimer(seconds, `${minutes}m`);
    setCustomMinutes('');
  };

  const handlePause = () => {
    setIsRunning(!isRunning);
  };

  const handleReset = () => {
    setIsRunning(false);
    setRemainingSeconds(totalSeconds);
    setIsComplete(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isWarning = remainingSeconds > 0 && remainingSeconds <= 60 && isRunning;
  const progress = totalSeconds > 0 ? (remainingSeconds / totalSeconds) * 100 : 0;

  const styles = {
    container: {
      background: '#1E1E2E',
      color: '#FFFFFF',
      borderRadius: '12px',
      padding: '16px',
      width: '100%',
      maxWidth: '320px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    } as React.CSSProperties,
    section: {
      marginBottom: '14px',
    } as React.CSSProperties,
    label: {
      fontSize: '12px',
      fontWeight: '600',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.5px',
      opacity: 0.7,
      marginBottom: '8px',
    } as React.CSSProperties,
    presetRow: {
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap' as const,
    } as React.CSSProperties,
    presetBtn: {
      padding: '8px 12px',
      background: '#2A2A3E',
      color: '#FFFFFF',
      border: '1px solid #404050',
      borderRadius: '20px',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: '500',
      transition: 'all 0.2s ease',
      '&:hover': {
        background: '#7C3AED',
        borderColor: '#7C3AED',
      },
    } as React.CSSProperties,
    customInputRow: {
      display: 'flex',
      gap: '8px',
      alignItems: 'center',
    } as React.CSSProperties,
    customInput: {
      flex: 1,
      padding: '8px 12px',
      background: '#2A2A3E',
      color: '#FFFFFF',
      border: '1px solid #404050',
      borderRadius: '8px',
      fontSize: '14px',
    } as React.CSSProperties,
    customBtn: {
      padding: '8px 16px',
      background: '#7C3AED',
      color: '#FFFFFF',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: '600',
      transition: 'all 0.2s ease',
    } as React.CSSProperties,
    timerDisplay: {
      textAlign: 'center' as const,
      fontSize: isWarning ? '48px' : '56px',
      fontWeight: '700',
      fontFamily: 'monospace',
      letterSpacing: '2px',
      marginBottom: '12px',
      color: isWarning ? '#FBBF24' : isComplete ? '#10B981' : '#FFFFFF',
      animation: isWarning ? 'pulse 0.6s ease-in-out infinite' : 'none',
      '@keyframes pulse': {
        '0%, 100%': { opacity: 1 },
        '50%': { opacity: 0.6 },
      },
    } as React.CSSProperties,
    progressRing: {
      marginBottom: '12px',
    } as React.CSSProperties,
    controlRow: {
      display: 'flex',
      gap: '8px',
      justifyContent: 'center',
    } as React.CSSProperties,
    controlBtn: {
      flex: 1,
      padding: '10px',
      background: '#2A2A3E',
      color: '#FFFFFF',
      border: '1px solid #404050',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: '600',
      transition: 'all 0.2s ease',
    } as React.CSSProperties,
  };

  // Simple progress ring SVG
  const ringRadius = 45;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringStrokeOffset = ringCircumference - (progress / 100) * ringCircumference;

  return (
    <div style={styles.container}>
      {/* Preset buttons */}
      <div style={styles.section}>
        <div style={styles.label}>Quick presets</div>
        <div style={styles.presetRow}>
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => handlePresetClick(preset.seconds, preset.label)}
              style={{
                ...styles.presetBtn,
                background: isRunning ? '#2A2A3E' : '#2A2A3E',
              }}
              onMouseEnter={(e) => {
                if (!isRunning) {
                  (e.target as HTMLElement).style.background = '#7C3AED';
                  (e.target as HTMLElement).style.borderColor = '#7C3AED';
                }
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.background = '#2A2A3E';
                (e.target as HTMLElement).style.borderColor = '#404050';
              }}
              disabled={isRunning}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom input */}
      <div style={styles.section}>
        <div style={styles.label}>Custom</div>
        <div style={styles.customInputRow}>
          <input
            type="number"
            min="1"
            max="60"
            value={customMinutes}
            onChange={(e) => setCustomMinutes(e.target.value)}
            placeholder="Minutes"
            style={styles.customInput}
            disabled={isRunning}
          />
          <button
            onClick={handleCustomStart}
            style={styles.customBtn}
            disabled={isRunning}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.background = '#6D28D9';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.background = '#7C3AED';
            }}
          >
            Start
          </button>
        </div>
      </div>

      {/* Timer display */}
      {totalSeconds > 0 && (
        <div style={styles.section}>
          <div style={styles.timerDisplay}>
            {formatTime(remainingSeconds)}
          </div>

          {/* Progress ring */}
          <div style={styles.progressRing}>
            <svg width="120" height="120" style={{ display: 'block', margin: '0 auto' }}>
              <circle
                cx="60"
                cy="60"
                r={ringRadius}
                fill="none"
                stroke="#404050"
                strokeWidth="4"
              />
              <circle
                cx="60"
                cy="60"
                r={ringRadius}
                fill="none"
                stroke={isWarning ? '#FBBF24' : isComplete ? '#10B981' : '#7C3AED'}
                strokeWidth="4"
                strokeDasharray={ringCircumference}
                strokeDashoffset={ringStrokeOffset}
                strokeLinecap="round"
                style={{
                  transform: 'rotate(-90deg)',
                  transformOrigin: '60px 60px',
                  transition: 'stroke-dashoffset 0.3s linear, stroke 0.3s ease',
                }}
              />
            </svg>
          </div>

          {/* Control buttons */}
          <div style={styles.controlRow}>
            <button
              onClick={handlePause}
              style={styles.controlBtn}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.background = '#7C3AED';
                (e.target as HTMLElement).style.borderColor = '#7C3AED';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.background = '#2A2A3E';
                (e.target as HTMLElement).style.borderColor = '#404050';
              }}
            >
              {isRunning ? 'Pause' : 'Resume'}
            </button>
            <button
              onClick={handleReset}
              style={styles.controlBtn}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.background = '#7C3AED';
                (e.target as HTMLElement).style.borderColor = '#7C3AED';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.background = '#2A2A3E';
                (e.target as HTMLElement).style.borderColor = '#404050';
              }}
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
