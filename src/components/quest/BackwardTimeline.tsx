'use client';

import React, { useState, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QuestMilestone } from '@/lib/quest/types';

interface BackwardTimelineProps {
  milestones: QuestMilestone[];
  endDate: string | null;
  startDate?: string | null;
  onMilestoneClick?: (milestone: QuestMilestone) => void;
  onDateChange?: (milestoneId: string, newDate: string) => void;
  readOnly?: boolean;
}

const PHASE_COLORS: Record<string, string> = {
  planning: '#6366F1',
  working: '#10B981',
  sharing: '#8B5CF6',
  discovery: '#EC4899',
  not_started: '#9CA3AF',
  completed: '#10B981',
};

const STATUS_COLORS: Record<string, string> = {
  upcoming: '#9CA3AF',
  active: '#6366F1',
  completed: '#10B981',
  skipped: '#6B7280',
  overdue: '#F59E0B',
};

export function BackwardTimeline({
  milestones,
  endDate,
  startDate,
  onMilestoneClick,
  onDateChange,
  readOnly = false,
}: BackwardTimelineProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<SVGSVGElement>(null);
  const [draggedMilestone, setDraggedMilestone] = useState<string | null>(null);
  const [tooltipDate, setTooltipDate] = useState<string | null>(null);
  const [tooltipX, setTooltipX] = useState(0);

  // Calculate date range
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDateObj = startDate ? new Date(startDate) : today;
  const endDateObj = endDate ? new Date(endDate) : null;

  const daysRange = endDateObj
    ? Math.max(1, Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)))
    : 60;

  const daysRemaining = endDateObj
    ? Math.max(0, Math.ceil((endDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  // Separate scheduled and unscheduled milestones
  const { scheduled, unscheduled } = useMemo(() => {
    const scheduled: QuestMilestone[] = [];
    const unscheduled: QuestMilestone[] = [];
    milestones.forEach((m) => {
      if (m.target_date) {
        scheduled.push(m);
      } else {
        unscheduled.push(m);
      }
    });
    return { scheduled, unscheduled };
  }, [milestones]);

  // Calculate pixel position from date
  const getPixelForDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const days = Math.ceil((date.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24));
    const pixelsPerDay = 800 / daysRange;
    return Math.max(0, Math.min(800, days * pixelsPerDay));
  };

  // Convert pixel position to date
  const getDateForPixel = (pixel: number) => {
    const pixelsPerDay = 800 / daysRange;
    const days = Math.round(pixel / pixelsPerDay);
    const newDate = new Date(startDateObj);
    newDate.setDate(newDate.getDate() + days);
    return newDate.toISOString().split('T')[0];
  };

  // Handle pointer down on milestone
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, milestoneId: string) => {
      if (readOnly) return;
      setDraggedMilestone(milestoneId);
      e.preventDefault();
    },
    [readOnly]
  );

  // Handle pointer move on container
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggedMilestone || !scrollContainerRef.current || !timelineRef.current) return;

      const rect = scrollContainerRef.current.getBoundingClientRect();
      const containerScrollLeft = scrollContainerRef.current.scrollLeft;
      const relativeX = e.clientX - rect.left + containerScrollLeft;

      // Clamp to timeline bounds
      const clampedX = Math.max(0, Math.min(800, relativeX - 40)); // 40px left padding
      setTooltipX(relativeX);

      const newDate = getDateForPixel(clampedX);
      setTooltipDate(newDate);
    },
    [draggedMilestone]
  );

  // Handle pointer up
  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggedMilestone || !tooltipDate) return;

      onDateChange?.(draggedMilestone, tooltipDate);
      setDraggedMilestone(null);
      setTooltipDate(null);
    },
    [draggedMilestone, tooltipDate, onDateChange]
  );

  if (milestones.length === 0) {
    return (
      <div
        style={{
          backgroundColor: '#111827',
          border: '1px solid #1e293b',
          borderRadius: '12px',
          padding: '24px',
          textAlign: 'center',
          color: '#9CA3AF',
          fontFamily: 'system-ui, sans-serif',
          fontSize: '14px',
        }}
      >
        Add milestones to see your timeline
      </div>
    );
  }

  // Summary stats
  const milestonesWithoutDates = unscheduled.length;
  const completedCount = milestones.filter((m) => m.status === 'completed').length;

  // Week labels
  const weekLabels = [];
  for (let i = 0; i <= Math.ceil(daysRange / 7); i++) {
    weekLabels.push(i);
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* Summary Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          padding: '12px 0',
          borderBottom: '1px solid #1e293b',
        }}
      >
        <div style={{ display: 'flex', gap: '24px', fontSize: '13px' }}>
          <div style={{ color: '#9CA3AF' }}>
            <span style={{ fontWeight: 600, color: '#E5E7EB' }}>{milestones.length}</span> milestones
          </div>
          {daysRemaining !== null && (
            <div style={{ color: '#9CA3AF' }}>
              <span style={{ fontWeight: 600, color: '#E5E7EB' }}>{daysRemaining}</span> days remaining
            </div>
          )}
          <div style={{ color: '#9CA3AF' }}>
            <span style={{ fontWeight: 600, color: '#E5E7EB' }}>{completedCount}</span> completed
          </div>
        </div>
        {milestonesWithoutDates > 0 && (
          <div style={{ color: '#F59E0B', fontSize: '13px', fontWeight: 500 }}>
            ⚠ {milestonesWithoutDates} milestone{milestonesWithoutDates !== 1 ? 's' : ''} without dates
          </div>
        )}
      </div>

      {/* Timeline Container */}
      <div
        ref={scrollContainerRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          if (draggedMilestone) {
            setDraggedMilestone(null);
            setTooltipDate(null);
          }
        }}
        style={{
          backgroundColor: '#111827',
          border: '1px solid #1e293b',
          borderRadius: '12px',
          padding: '24px 40px',
          overflowX: 'auto',
          overflowY: 'hidden',
          cursor: draggedMilestone ? 'grabbing' : 'grab',
          userSelect: 'none',
        }}
      >
        <svg
          ref={timelineRef}
          width={Math.max(800, scheduled.length * 100 + 200)}
          height={280}
          style={{ display: 'block', minWidth: '800px' }}
        >
          {/* Timeline axis */}
          <line x1="0" y1="140" x2={800} y2="140" stroke="#374151" strokeWidth="2" />

          {/* Week tick marks and labels */}
          {weekLabels.map((week) => {
            const x = (week / Math.ceil(daysRange / 7)) * 800;
            return (
              <g key={`week-${week}`}>
                <line x1={x} y1="135" x2={x} y2="145" stroke="#4B5563" strokeWidth="1" />
                <text
                  x={x}
                  y="165"
                  textAnchor="middle"
                  fill="#6B7280"
                  fontSize="12"
                  fontFamily="system-ui, sans-serif"
                >
                  Week {week}
                </text>
              </g>
            );
          })}

          {/* Today marker */}
          <line x1="0" y1="100" x2="0" y2="180" stroke="#8B5CF6" strokeWidth="2" strokeDasharray="4" />
          <text x="0" y="95" textAnchor="middle" fill="#8B5CF6" fontSize="11" fontFamily="system-ui, sans-serif">
            Today
          </text>

          {/* End date marker */}
          {endDateObj && (
            <>
              <line x1="800" y1="100" x2="800" y2="180" stroke="#EF4444" strokeWidth="2" />
              <text x="800" y="95" textAnchor="middle" fill="#EF4444" fontSize="11" fontFamily="system-ui, sans-serif">
                Due
              </text>
            </>
          )}

          {/* Scheduled milestones */}
          {scheduled.map((milestone) => {
            const x = getPixelForDate(milestone.target_date) ?? 0;
            const color = STATUS_COLORS[milestone.status] || PHASE_COLORS[milestone.phase];
            const isActive = milestone.status === 'active';
            const isCompleted = milestone.status === 'completed';

            return (
              <g key={`milestone-${milestone.id}`}>
                {/* Glow for active */}
                {isActive && (
                  <motion.circle
                    cx={x}
                    cy="140"
                    r="20"
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    opacity="0.5"
                    animate={{ r: [20, 28, 20] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                )}

                {/* Main circle */}
                <circle
                  cx={x}
                  cy="140"
                  r="14"
                  fill={isCompleted ? color : 'none'}
                  stroke={color}
                  strokeWidth={isCompleted ? 0 : 2}
                  style={{
                    cursor: !readOnly ? 'pointer' : 'default',
                  }}
                  onPointerDown={(e) => handlePointerDown(e as any, milestone.id)}
                  onClick={() => onMilestoneClick?.(milestone)}
                />

                {/* Checkmark for completed */}
                {isCompleted && (
                  <text
                    x={x}
                    y="145"
                    textAnchor="middle"
                    fill="white"
                    fontSize="10"
                    fontWeight="bold"
                    fontFamily="system-ui, sans-serif"
                  >
                    ✓
                  </text>
                )}

                {/* Label */}
                <text
                  x={x}
                  y="115"
                  textAnchor="middle"
                  fill="#E5E7EB"
                  fontSize="12"
                  fontFamily="system-ui, sans-serif"
                  style={{
                    transform: 'rotate(-30deg)',
                    transformOrigin: `${x}px 115px`,
                    maxWidth: '40px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {milestone.title.length > 20 ? `${milestone.title.substring(0, 17)}...` : milestone.title}
                </text>

                {/* Date label */}
                <text x={x} y="190" textAnchor="middle" fill="#9CA3AF" fontSize="11" fontFamily="system-ui, sans-serif">
                  {milestone.target_date
                    ? new Date(milestone.target_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })
                    : ''}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Tooltip during drag */}
        <AnimatePresence>
          {draggedMilestone && tooltipDate && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{
                position: 'absolute',
                left: `${tooltipX}px`,
                top: '8px',
                backgroundColor: '#1F2937',
                border: '1px solid #6366F1',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '12px',
                color: '#E5E7EB',
                fontWeight: 500,
                pointerEvents: 'none',
                zIndex: 50,
                transform: 'translateX(-50%)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
              }}
            >
              {new Date(tooltipDate).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Unscheduled milestones zone */}
      {unscheduled.length > 0 && (
        <div
          style={{
            marginTop: '16px',
            padding: '16px',
            backgroundColor: '#0F172A',
            border: '1px dashed #1e293b',
            borderRadius: '8px',
          }}
        >
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: '#F59E0B',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            ⚠ Unscheduled ({unscheduled.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {unscheduled.map((milestone) => (
              <motion.button
                key={`unscheduled-${milestone.id}`}
                onClick={() => onMilestoneClick?.(milestone)}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '6px',
                  color: '#E5E7EB',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontFamily: 'system-ui, sans-serif',
                }}
                whileHover={{ backgroundColor: '#374151' }}
              >
                {milestone.title}
              </motion.button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default BackwardTimeline;
