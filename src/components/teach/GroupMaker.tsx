'use client';

import React, { useState, useCallback } from 'react';

interface Student {
  id: string;
  name: string;
}

interface GroupMakerProps {
  students: Student[];
  onProjectToScreen?: (data: { type: 'groups'; groups: string[][] }) => void;
}

const GROUP_COLORS = [
  { accent: '#7C3AED', light: '#5B21B6' }, // Purple
  { accent: '#10B981', light: '#047857' }, // Green
  { accent: '#F59E0B', light: '#D97706' }, // Amber
  { accent: '#EF4444', light: '#DC2626' }, // Red
  { accent: '#06B6D4', light: '#0891B2' }, // Cyan
  { accent: '#8B5CF6', light: '#7C3AED' }, // Violet
  { accent: '#EC4899', light: '#DB2777' }, // Pink
  { accent: '#14B8A6', light: '#0D9488' }, // Teal
];

export default function GroupMaker({ students, onProjectToScreen }: GroupMakerProps) {
  const [groupSize, setGroupSize] = useState<number>(0);
  const [groups, setGroups] = useState<string[][]>([]);

  const makeGroups = useCallback((size: number) => {
    if (size <= 0 || students.length === 0) return;

    const shuffled = [...students].sort(() => Math.random() - 0.5);
    const newGroups: string[][] = [];

    // Calculate how many groups and how to distribute remainder
    const numFullGroups = Math.floor(shuffled.length / size);
    const remainder = shuffled.length % size;

    let studentIndex = 0;

    // Create full groups first
    for (let i = 0; i < numFullGroups; i++) {
      const group: string[] = [];
      for (let j = 0; j < size; j++) {
        group.push(shuffled[studentIndex].name);
        studentIndex++;
      }
      newGroups.push(group);
    }

    // Distribute remainder students one by one into existing groups
    if (remainder > 0) {
      for (let i = 0; i < remainder; i++) {
        newGroups[i].push(shuffled[studentIndex].name);
        studentIndex++;
      }
    }

    setGroupSize(size);
    setGroups(newGroups);

    if (onProjectToScreen) {
      onProjectToScreen({ type: 'groups', groups: newGroups });
    }
  }, [students, onProjectToScreen]);

  const handlePresetClick = (size: number) => {
    makeGroups(size);
  };

  const handleShuffle = () => {
    if (groupSize > 0) {
      makeGroups(groupSize);
    }
  };

  const styles = {
    container: {
      background: '#1E1E2E',
      color: '#FFFFFF',
      borderRadius: '12px',
      padding: '16px',
      width: '100%',
      maxWidth: '340px',
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
    sizeRow: {
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap' as const,
    } as React.CSSProperties,
    sizeBtn: {
      flex: 1,
      minWidth: '48px',
      padding: '10px 8px',
      background: '#2A2A3E',
      color: '#FFFFFF',
      border: '1px solid #404050',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: '600',
      transition: 'all 0.2s ease',
    } as React.CSSProperties,
    sizeBtnActive: {
      background: '#7C3AED',
      borderColor: '#7C3AED',
    } as React.CSSProperties,
    groupsContainer: {
      maxHeight: '280px',
      overflowY: 'auto' as const,
      paddingRight: '4px',
    } as React.CSSProperties,
    groupCard: {
      padding: '12px',
      background: '#2A2A3E',
      borderRadius: '8px',
      marginBottom: '8px',
      borderLeft: '4px solid',
    } as React.CSSProperties,
    groupHeader: {
      fontSize: '12px',
      fontWeight: '600',
      marginBottom: '6px',
      opacity: 0.8,
    } as React.CSSProperties,
    groupMembers: {
      fontSize: '13px',
      lineHeight: '1.4',
      opacity: 0.9,
    } as React.CSSProperties,
    shuffleBtn: {
      width: '100%',
      padding: '10px 12px',
      background: '#7C3AED',
      color: '#FFFFFF',
      border: 'none',
      borderRadius: '8px',
      fontSize: '13px',
      fontWeight: '600',
      cursor: 'pointer',
      marginTop: '8px',
      transition: 'all 0.2s ease',
    } as React.CSSProperties,
    summary: {
      fontSize: '12px',
      opacity: 0.7,
      marginTop: '8px',
      textAlign: 'center' as const,
    } as React.CSSProperties,
  };

  return (
    <div style={styles.container}>
      {/* Size selector */}
      <div style={styles.section}>
        <div style={styles.label}>Group size</div>
        <div style={styles.sizeRow}>
          {[2, 3, 4, 5].map((size) => (
            <button
              key={size}
              onClick={() => handlePresetClick(size)}
              style={{
                ...styles.sizeBtn,
                ...(groupSize === size ? styles.sizeBtnActive : {}),
              }}
              onMouseEnter={(e) => {
                if (groupSize !== size) {
                  (e.target as HTMLElement).style.background = '#404050';
                  (e.target as HTMLElement).style.borderColor = '#7C3AED';
                }
              }}
              onMouseLeave={(e) => {
                if (groupSize !== size) {
                  (e.target as HTMLElement).style.background = '#2A2A3E';
                  (e.target as HTMLElement).style.borderColor = '#404050';
                }
              }}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {/* Groups display */}
      {groups.length > 0 && (
        <div style={styles.section}>
          <div style={styles.label}>Groups ({groups.length})</div>
          <div style={styles.groupsContainer}>
            {groups.map((group, idx) => (
              <div
                key={idx}
                style={{
                  ...styles.groupCard,
                  borderColor: GROUP_COLORS[idx % GROUP_COLORS.length].accent,
                  background: GROUP_COLORS[idx % GROUP_COLORS.length].light + '22',
                }}
              >
                <div
                  style={{
                    ...styles.groupHeader,
                    color: GROUP_COLORS[idx % GROUP_COLORS.length].accent,
                  }}
                >
                  Group {idx + 1} ({group.length})
                </div>
                <div style={styles.groupMembers}>
                  {group.map((name, nameIdx) => (
                    <div key={nameIdx}>• {name}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div style={styles.summary}>
            {students.length} students in {groups.length} groups
          </div>

          {/* Shuffle button */}
          <button
            onClick={handleShuffle}
            style={styles.shuffleBtn}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.background = '#6D28D9';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.background = '#7C3AED';
            }}
          >
            Shuffle
          </button>
        </div>
      )}
    </div>
  );
}
