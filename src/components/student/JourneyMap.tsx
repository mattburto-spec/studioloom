'use client';

import React from 'react';

interface JourneyMapProps {
  zones: Array<{
    criterion: string;
    name: string;
    color: string;
    pagesComplete: number;
    pagesTotal: number;
    isCurrent: boolean;
  }>;
}

/**
 * Compact, framework-agnostic progress visualization.
 * Shows design phases as equal segments of a ring — no implied linear order.
 * Phases can be worked on in any order; progress is shown per-phase.
 */
export function JourneyMap({ zones }: JourneyMapProps) {
  const activeZones = zones.filter(z => z.pagesTotal > 0);
  if (activeZones.length === 0) return null;

  const totalPages = activeZones.reduce((s, z) => s + z.pagesTotal, 0);
  const completedPages = activeZones.reduce((s, z) => s + z.pagesComplete, 0);
  const overallPercent = totalPages > 0 ? Math.round((completedPages / totalPages) * 100) : 0;

  // Ring geometry
  const size = 64;
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="flex items-center gap-4 flex-wrap">
      {/* Mini ring showing overall % */}
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#7C3AED"
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - overallPercent / 100)}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-purple-600">{overallPercent}%</span>
        </div>
      </div>

      {/* Phase pills */}
      <div className="flex gap-2 flex-wrap">
        {activeZones.map((zone) => {
          const percent = zone.pagesTotal > 0 ? (zone.pagesComplete / zone.pagesTotal) * 100 : 0;
          const isComplete = zone.pagesComplete === zone.pagesTotal;
          const hasProgress = zone.pagesComplete > 0;

          return (
            <div
              key={zone.criterion}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5"
              style={{
                background: hasProgress ? `${zone.color}10` : '#f9fafb',
                border: zone.isCurrent
                  ? `1.5px solid ${zone.color}60`
                  : '1px solid #e5e7eb',
              }}
            >
              {/* Tiny progress bar */}
              <div className="w-8 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${percent}%`,
                    backgroundColor: zone.color,
                  }}
                />
              </div>
              <span
                className="text-xs font-medium"
                style={{
                  color: hasProgress ? zone.color : '#9CA3AF',
                }}
              >
                {zone.name.split(' & ')[0].split(' ')[0]}
              </span>
              {isComplete && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill={zone.color}>
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                </svg>
              )}
              {zone.isCurrent && !isComplete && (
                <span
                  className="w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: zone.color }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
