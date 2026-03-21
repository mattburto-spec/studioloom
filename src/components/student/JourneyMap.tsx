'use client';

import React from 'react';

interface JourneyMapProps {
  zones: Array<{
    criterion: 'A' | 'B' | 'C' | 'D';
    name: string;
    color: string;
    pagesComplete: number;
    pagesTotal: number;
    isCurrent: boolean;
  }>;
  studentName: string;
  unitTitle: string;
}

export function JourneyMap({ zones, studentName, unitTitle }: JourneyMapProps) {
  const totalPages = zones.reduce((sum, z) => sum + z.pagesTotal, 0);
  const completedPages = zones.reduce((sum, z) => sum + z.pagesComplete, 0);
  const isEmpty = totalPages === 0;
  const studentInitial = studentName.charAt(0).toUpperCase();
  const currentZone = zones.find(z => z.isCurrent);

  // SVG silhouettes for each zone
  const silhouettes = {
    A: (
      <svg viewBox="0 0 60 40" className="w-12 h-8" preserveAspectRatio="xMidYMid meet">
        <path d="M 10 35 L 30 5 L 50 35" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 25 25 L 35 25" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    B: (
      <svg viewBox="0 0 60 40" className="w-12 h-8" preserveAspectRatio="xMidYMid meet">
        <rect x="12" y="15" width="36" height="20" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="30" cy="25" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M 22 28 L 25 22 M 38 22 L 35 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    C: (
      <svg viewBox="0 0 60 40" className="w-12 h-8" preserveAspectRatio="xMidYMid meet">
        <rect x="10" y="12" width="40" height="22" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M 18 16 L 18 32 M 30 16 L 30 32 M 42 16 L 42 32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="12" y1="24" x2="48" y2="24" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      </svg>
    ),
    D: (
      <svg viewBox="0 0 60 40" className="w-12 h-8" preserveAspectRatio="xMidYMid meet">
        <circle cx="30" cy="22" r="12" fill="none" stroke="currentColor" strokeWidth="2" />
        <line x1="30" y1="10" x2="30" y2="34" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
        <line x1="18" y1="22" x2="42" y2="22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
        <circle cx="30" cy="22" r="3" fill="currentColor" />
      </svg>
    ),
  };

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #1a1025, #0f1728)',
        borderRadius: '12px',
        padding: '24px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        color: '#fff',
      }}
      className="w-full"
    >
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold">{unitTitle}</h3>
        <p className="text-sm opacity-70 mt-1">
          {completedPages} of {totalPages} pages complete
        </p>
      </div>

      {/* Empty state */}
      {isEmpty ? (
        <div className="text-center py-12 opacity-50">
          <p className="text-sm">Your design journey begins here</p>
          <p className="text-xs opacity-70 mt-2">Complete pages to progress through the zones</p>
        </div>
      ) : (
        <>
          {/* Journey Map SVG */}
          <div className="relative mb-6 overflow-x-auto">
            <svg
              viewBox="0 0 1000 200"
              className="w-full h-auto min-w-full"
              style={{ filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3))' }}
            >
              {/* Connecting path */}
              <defs>
                <style>{`
                  @keyframes pulse-glow {
                    0%, 100% { r: 20px; opacity: 0.8; }
                    50% { r: 26px; opacity: 0.4; }
                  }
                  @keyframes fade-in {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                  }
                  .zone-container {
                    animation: fade-in 0.6s ease-out forwards;
                  }
                  .current-glow {
                    animation: pulse-glow 2s ease-in-out infinite;
                  }
                `}</style>
                <linearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgba(255, 255, 255, 0.1)" />
                  <stop offset="50%" stopColor="rgba(255, 255, 255, 0.3)" />
                  <stop offset="100%" stopColor="rgba(255, 255, 255, 0.1)" />
                </linearGradient>
              </defs>

              {/* Connecting dotted line */}
              <line x1="100" y1="100" x2="900" y2="100" stroke="url(#pathGradient)" strokeWidth="2" strokeDasharray="8,4" />

              {/* Zones */}
              {zones.map((zone, idx) => {
                const xPos = 100 + (idx * 250);
                const hasProgress = zone.pagesComplete > 0;
                const isComplete = zone.pagesComplete === zone.pagesTotal;
                const progress = zone.pagesTotal > 0 ? (zone.pagesComplete / zone.pagesTotal) * 100 : 0;

                return (
                  <g key={zone.criterion} className="zone-container">
                    {/* Zone box */}
                    <rect
                      x={xPos - 45}
                      y="35"
                      width="90"
                      height="130"
                      rx="8"
                      fill={hasProgress ? zone.color : '#3f3f46'}
                      opacity={hasProgress ? 0.15 : 0.08}
                      stroke={hasProgress ? zone.color : 'rgba(255, 255, 255, 0.1)'}
                      strokeWidth="2"
                    />

                    {/* Silhouette */}
                    <g
                      transform={`translate(${xPos - 24}, 50)`}
                      style={{ color: zone.color }}
                      opacity={hasProgress ? 1 : 0.4}
                    >
                      {silhouettes[zone.criterion]}
                    </g>

                    {/* Criterion letter + name */}
                    <text
                      x={xPos}
                      y="110"
                      textAnchor="middle"
                      style={{
                        fontSize: '16px',
                        fontWeight: 'bold',
                        fill: zone.color,
                        opacity: hasProgress ? 1 : 0.5,
                      }}
                    >
                      {zone.criterion}
                    </text>
                    <text
                      x={xPos}
                      y="130"
                      textAnchor="middle"
                      style={{
                        fontSize: '11px',
                        fill: 'rgba(255, 255, 255, 0.8)',
                        opacity: hasProgress ? 1 : 0.4,
                      }}
                    >
                      {zone.name.split(' ')[0]}
                    </text>

                    {/* Progress bar */}
                    <rect
                      x={xPos - 40}
                      y="140"
                      width="80"
                      height="4"
                      rx="2"
                      fill="rgba(255, 255, 255, 0.1)"
                    />
                    {progress > 0 && (
                      <rect
                        x={xPos - 40}
                        y="140"
                        width={(80 * progress) / 100}
                        height="4"
                        rx="2"
                        fill={zone.color}
                      />
                    )}

                    {/* Checkmark for completed zones */}
                    {isComplete && (
                      <circle cx={xPos + 35} cy="55" r="14" fill={zone.color} opacity="0.9" />
                    )}
                    {isComplete && (
                      <text
                        x={xPos + 35}
                        y="62"
                        textAnchor="middle"
                        style={{
                          fontSize: '16px',
                          fontWeight: 'bold',
                          fill: '#fff',
                        }}
                      >
                        ✓
                      </text>
                    )}

                    {/* Current zone pulse */}
                    {zone.isCurrent && (
                      <circle
                        cx={xPos}
                        cy="100"
                        r="20"
                        fill="none"
                        stroke={zone.color}
                        strokeWidth="2"
                        opacity="0.8"
                        className="current-glow"
                      />
                    )}
                  </g>
                );
              })}

              {/* Student avatar at current zone */}
              {currentZone && (
                <g transform={`translate(${100 + (zones.findIndex(z => z.isCurrent) * 250)}, 100)`}>
                  <circle
                    cx="0"
                    cy="0"
                    r="18"
                    fill={currentZone.color}
                    opacity="0.9"
                    style={{ filter: 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.4))' }}
                  />
                  <text
                    x="0"
                    y="6"
                    textAnchor="middle"
                    style={{
                      fontSize: '14px',
                      fontWeight: 'bold',
                      fill: '#fff',
                    }}
                  >
                    {studentInitial}
                  </text>
                </g>
              )}
            </svg>
          </div>

          {/* Zone progress summary */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
            {zones.map((zone) => (
              <div key={zone.criterion} className="text-center">
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: zone.color,
                    margin: '0 auto 4px',
                    opacity: zone.pagesComplete > 0 ? 1 : 0.3,
                  }}
                />
                <p style={{ opacity: 0.8 }}>
                  {zone.pagesComplete}/{zone.pagesTotal}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
