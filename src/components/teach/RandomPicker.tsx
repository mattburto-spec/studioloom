'use client';

import React, { useState, useRef, useCallback } from 'react';

interface Student {
  id: string;
  name: string;
}

interface RandomPickerProps {
  students: Student[];
  onProjectToScreen?: (data: { type: 'picker'; studentName: string }) => void;
}

export default function RandomPicker({ students, onProjectToScreen }: RandomPickerProps) {
  const [availableStudents, setAvailableStudents] = useState<Student[]>(students);
  const [satOut, setSatOut] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const spinIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const celebrationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handlePick = useCallback(() => {
    if (availableStudents.length === 0) return;

    setIsSpinning(true);
    setDisplayName('');

    // Slot machine animation: cycle through names
    let cycleCount = 0;
    spinIntervalRef.current = setInterval(() => {
      const randomStudent =
        availableStudents[Math.floor(Math.random() * availableStudents.length)];
      setDisplayName(randomStudent.name);
      cycleCount++;

      // Stop after ~2 seconds (20 cycles at 100ms)
      if (cycleCount >= 20) {
        clearInterval(spinIntervalRef.current!);
        const finalStudent =
          availableStudents[Math.floor(Math.random() * availableStudents.length)];
        setSelectedStudent(finalStudent);
        setDisplayName(finalStudent.name);
        setIsSpinning(false);

        if (onProjectToScreen) {
          onProjectToScreen({ type: 'picker', studentName: finalStudent.name });
        }

        // Clear celebration effect after 3 seconds
        celebrationTimeoutRef.current = setTimeout(() => {
          setDisplayName('');
        }, 3000);
      }
    }, 100);
  }, [availableStudents, onProjectToScreen]);

  const handlePickAgain = useCallback(() => {
    if (availableStudents.length === 0) return;
    setDisplayName('');
    setSelectedStudent(null);
    handlePick();
  }, [availableStudents, handlePick]);

  const handleRemoveFromPool = useCallback(() => {
    if (!selectedStudent) return;
    setAvailableStudents((prev) => prev.filter((s) => s.id !== selectedStudent.id));
    setSatOut((prev) => [...prev, selectedStudent]);
    setSelectedStudent(null);
    setDisplayName('');
  }, [selectedStudent]);

  const handleResetAll = () => {
    setAvailableStudents(students);
    setSatOut([]);
    setSelectedStudent(null);
    setDisplayName('');
  };

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
    label: {
      fontSize: '12px',
      fontWeight: '600',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.5px',
      opacity: 0.7,
      marginBottom: '8px',
    } as React.CSSProperties,
    pickBtn: {
      width: '100%',
      padding: '12px 16px',
      background: '#7C3AED',
      color: '#FFFFFF',
      border: 'none',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      marginBottom: '16px',
      transition: 'all 0.2s ease',
    } as React.CSSProperties,
    displayArea: {
      minHeight: '120px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column' as const,
      marginBottom: '16px',
      padding: '16px',
      background: '#2A2A3E',
      borderRadius: '8px',
      border: '2px solid #404050',
    } as React.CSSProperties,
    selectedName: {
      fontSize: '32px',
      fontWeight: '700',
      textAlign: 'center' as const,
      color: '#10B981',
      marginBottom: '8px',
      animation: 'scaleUp 0.3s ease-out',
      '@keyframes scaleUp': {
        '0%': { transform: 'scale(0.8)', opacity: 0 },
        '100%': { transform: 'scale(1)', opacity: 1 },
      },
    } as React.CSSProperties,
    cyclingName: {
      fontSize: '18px',
      fontWeight: '600',
      textAlign: 'center' as const,
      color: '#7C3AED',
      fontFamily: 'monospace',
      minHeight: '28px',
    } as React.CSSProperties,
    counter: {
      fontSize: '12px',
      opacity: 0.7,
      textAlign: 'center' as const,
      marginTop: '8px',
    } as React.CSSProperties,
    controlRow: {
      display: 'flex',
      gap: '8px',
      marginBottom: '12px',
    } as React.CSSProperties,
    controlBtn: {
      flex: 1,
      padding: '10px 12px',
      background: '#2A2A3E',
      color: '#FFFFFF',
      border: '1px solid #404050',
      borderRadius: '8px',
      fontSize: '12px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    } as React.CSSProperties,
    satOutSection: {
      marginTop: '12px',
      paddingTop: '12px',
      borderTop: '1px solid #404050',
    } as React.CSSProperties,
    satOutLabel: {
      fontSize: '11px',
      fontWeight: '600',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.5px',
      opacity: 0.6,
      marginBottom: '6px',
    } as React.CSSProperties,
    satOutList: {
      display: 'flex',
      flexWrap: 'wrap' as const,
      gap: '6px',
      marginBottom: '8px',
    } as React.CSSProperties,
    satOutChip: {
      padding: '4px 8px',
      background: '#404050',
      borderRadius: '4px',
      fontSize: '11px',
      opacity: 0.8,
    } as React.CSSProperties,
    resetBtn: {
      width: '100%',
      padding: '8px 12px',
      background: '#2A2A3E',
      color: '#FFFFFF',
      border: '1px solid #404050',
      borderRadius: '6px',
      fontSize: '11px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    } as React.CSSProperties,
  };

  return (
    <div style={styles.container}>
      {/* Pick button */}
      <button
        onClick={handlePick}
        disabled={isSpinning || availableStudents.length === 0}
        style={{
          ...styles.pickBtn,
          opacity: availableStudents.length === 0 ? 0.5 : 1,
          cursor: availableStudents.length === 0 ? 'not-allowed' : 'pointer',
        }}
        onMouseEnter={(e) => {
          if (availableStudents.length > 0 && !isSpinning) {
            (e.target as HTMLElement).style.background = '#6D28D9';
          }
        }}
        onMouseLeave={(e) => {
          (e.target as HTMLElement).style.background = '#7C3AED';
        }}
      >
        {availableStudents.length === 0 ? 'No students left' : 'Pick a student'}
      </button>

      {/* Display area */}
      <div style={styles.displayArea}>
        {isSpinning ? (
          <div style={styles.cyclingName}>{displayName}</div>
        ) : selectedStudent ? (
          <>
            <div style={styles.selectedName}>{selectedStudent.name}</div>
            <div style={styles.counter}>
              {availableStudents.length} of {students.length} remaining
            </div>
          </>
        ) : (
          <div style={{ opacity: 0.5, fontSize: '13px' }}>Click "Pick a student"</div>
        )}
      </div>

      {/* Control buttons */}
      {selectedStudent && (
        <div style={styles.controlRow}>
          <button
            onClick={handlePickAgain}
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
            Pick again
          </button>
          <button
            onClick={handleRemoveFromPool}
            style={styles.controlBtn}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.background = '#EF4444';
              (e.target as HTMLElement).style.borderColor = '#EF4444';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.background = '#2A2A3E';
              (e.target as HTMLElement).style.borderColor = '#404050';
            }}
          >
            Remove from pool
          </button>
        </div>
      )}

      {/* Sat out list */}
      {satOut.length > 0 && (
        <div style={styles.satOutSection}>
          <div style={styles.satOutLabel}>Sat out ({satOut.length})</div>
          <div style={styles.satOutList}>
            {satOut.map((student) => (
              <div key={student.id} style={styles.satOutChip}>
                {student.name}
              </div>
            ))}
          </div>
          <button
            onClick={handleResetAll}
            style={styles.resetBtn}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.background = '#404050';
              (e.target as HTMLElement).style.borderColor = '#404050';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.background = '#2A2A3E';
              (e.target as HTMLElement).style.borderColor = '#404050';
            }}
          >
            Reset all
          </button>
        </div>
      )}
    </div>
  );
}
