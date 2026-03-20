'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

interface Lap {
  lapNumber: number;
  time: number;
}

interface StopwatchProps {
  onProjectToScreen?: (data: { type: 'stopwatch'; seconds: number }) => void;
}

export default function Stopwatch({ onProjectToScreen }: StopwatchProps) {
  const [totalMs, setTotalMs] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [laps, setLaps] = useState<Lap[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const accumulatedMsRef = useRef<number>(0);

  // Main timer loop
  useEffect(() => {
    if (!isRunning) return;

    startTimeRef.current = Date.now() - accumulatedMsRef.current;

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      setTotalMs(elapsed);
      accumulatedMsRef.current = elapsed;
    }, 100); // Update every 100ms for deciseconds

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  const handleStart = useCallback(() => {
    setIsRunning(true);
  }, []);

  const handleStop = useCallback(() => {
    setIsRunning(false);
  }, []);

  const handleReset = useCallback(() => {
    setIsRunning(false);
    setTotalMs(0);
    setLaps([]);
    accumulatedMsRef.current = 0;
  }, []);

  const handleLap = useCallback(() => {
    if (isRunning) {
      const newLap: Lap = {
        lapNumber: laps.length + 1,
        time: totalMs,
      };
      setLaps((prev) => [...prev, newLap]);
    }
  }, [isRunning, totalMs, laps.length]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const deciseconds = Math.floor((ms % 1000) / 100);

    return {
      display: `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${deciseconds}`,
      minutes,
      seconds,
      deciseconds,
    };
  };

  const { display } = formatTime(totalMs);

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
    display: {
      textAlign: 'center' as const,
      fontSize: '48px',
      fontFamily: 'monospace',
      fontWeight: '700',
      letterSpacing: '2px',
      marginBottom: '16px',
      color: isRunning ? '#10B981' : '#FFFFFF',
      transition: 'color 0.2s ease',
    } as React.CSSProperties,
    controlRow: {
      display: 'flex',
      gap: '8px',
      marginBottom: '14px',
    } as React.CSSProperties,
    btn: {
      flex: 1,
      padding: '10px 12px',
      background: '#2A2A3E',
      color: '#FFFFFF',
      border: '1px solid #404050',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: '600',
      transition: 'all 0.2s ease',
    } as React.CSSProperties,
    btnStart: {
      background: '#10B981',
      borderColor: '#10B981',
    } as React.CSSProperties,
    btnStop: {
      background: '#EF4444',
      borderColor: '#EF4444',
    } as React.CSSProperties,
    btnPrimary: {
      background: '#7C3AED',
      borderColor: '#7C3AED',
    } as React.CSSProperties,
    lapSection: {
      marginTop: '14px',
      paddingTop: '12px',
      borderTop: '1px solid #404050',
    } as React.CSSProperties,
    lapLabel: {
      fontSize: '12px',
      fontWeight: '600',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.5px',
      opacity: 0.7,
      marginBottom: '8px',
    } as React.CSSProperties,
    lapList: {
      maxHeight: '160px',
      overflowY: 'auto' as const,
      paddingRight: '4px',
    } as React.CSSProperties,
    lapItem: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '8px 10px',
      background: '#2A2A3E',
      borderRadius: '6px',
      marginBottom: '6px',
      fontSize: '13px',
      fontFamily: 'monospace',
    } as React.CSSProperties,
    lapNumber: {
      fontWeight: '600',
      opacity: 0.8,
    } as React.CSSProperties,
    lapTime: {
      color: '#7C3AED',
      fontWeight: '600',
    } as React.CSSProperties,
  };

  return (
    <div style={styles.container}>
      {/* Time display */}
      <div style={styles.display}>{display}</div>

      {/* Control buttons */}
      <div style={styles.controlRow}>
        {!isRunning ? (
          <button
            onClick={handleStart}
            style={{ ...styles.btn, ...styles.btnStart }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.background = '#059669';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.background = '#10B981';
            }}
          >
            Start
          </button>
        ) : (
          <button
            onClick={handleStop}
            style={{ ...styles.btn, ...styles.btnStop }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.background = '#DC2626';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.background = '#EF4444';
            }}
          >
            Stop
          </button>
        )}
        <button
          onClick={handleReset}
          style={{ ...styles.btn, ...styles.btnPrimary }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.background = '#6D28D9';
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.background = '#7C3AED';
          }}
        >
          Reset
        </button>
      </div>

      {/* Lap button */}
      {isRunning && (
        <button
          onClick={handleLap}
          style={{
            width: '100%',
            padding: '10px 12px',
            background: '#404050',
            color: '#FFFFFF',
            border: '1px solid #505060',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '600',
            marginBottom: '12px',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.background = '#505060';
            (e.target as HTMLElement).style.borderColor = '#606070';
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.background = '#404050';
            (e.target as HTMLElement).style.borderColor = '#505060';
          }}
        >
          Lap
        </button>
      )}

      {/* Lap list */}
      {laps.length > 0 && (
        <div style={styles.lapSection}>
          <div style={styles.lapLabel}>Laps ({laps.length})</div>
          <div style={styles.lapList}>
            {laps.map((lap) => {
              const { display: lapDisplay } = formatTime(lap.time);
              return (
                <div key={lap.lapNumber} style={styles.lapItem}>
                  <span style={styles.lapNumber}>Lap {lap.lapNumber}</span>
                  <span style={styles.lapTime}>{lapDisplay}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
