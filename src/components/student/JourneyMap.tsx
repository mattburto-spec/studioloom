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

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #1a1025, #0f1728)',
        borderRadius: '16px',
        padding: '20px 24px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        color: '#fff',
      }}
      className="w-full"
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-base font-semibold opacity-90">{unitTitle}</h3>
          <p className="text-xs opacity-50 mt-0.5">
            {completedPages} of {totalPages} pages complete
          </p>
        </div>
      </div>

      {isEmpty ? (
        <div className="text-center py-8 opacity-40">
          <p className="text-sm">Your design journey begins here</p>
        </div>
      ) : (
        /* Horizontal zone cards */
        <div className="grid grid-cols-4 gap-3">
          {zones.map((zone) => {
            const hasProgress = zone.pagesComplete > 0;
            const isComplete = zone.pagesTotal > 0 && zone.pagesComplete === zone.pagesTotal;
            const progress = zone.pagesTotal > 0 ? (zone.pagesComplete / zone.pagesTotal) * 100 : 0;
            const hasPages = zone.pagesTotal > 0;

            return (
              <div
                key={zone.criterion}
                className="relative rounded-xl p-3 text-center transition-all duration-300"
                style={{
                  background: hasProgress
                    ? `linear-gradient(135deg, ${zone.color}18, ${zone.color}08)`
                    : 'rgba(255, 255, 255, 0.03)',
                  border: zone.isCurrent
                    ? `2px solid ${zone.color}80`
                    : '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                {/* Student avatar on current zone */}
                {zone.isCurrent && (
                  <div
                    className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-lg"
                    style={{ backgroundColor: zone.color }}
                  >
                    {studentInitial}
                  </div>
                )}

                {/* Criterion letter */}
                <div
                  className="text-2xl font-bold mb-0.5"
                  style={{
                    color: zone.color,
                    opacity: hasPages ? (hasProgress ? 1 : 0.5) : 0.2,
                  }}
                >
                  {zone.criterion}
                </div>

                {/* Name */}
                <div
                  className="text-[10px] font-medium mb-2 leading-tight"
                  style={{ opacity: hasPages ? 0.7 : 0.3 }}
                >
                  {zone.name.length > 12 ? zone.name.split(' ')[0] : zone.name}
                </div>

                {/* Progress bar */}
                {hasPages ? (
                  <>
                    <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden mb-1.5">
                      {progress > 0 && (
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${progress}%`, backgroundColor: zone.color }}
                        />
                      )}
                    </div>
                    <div className="text-[10px] font-medium" style={{ opacity: 0.5 }}>
                      {zone.pagesComplete}/{zone.pagesTotal}
                    </div>
                  </>
                ) : (
                  <div className="text-[10px] opacity-20 mt-1">—</div>
                )}

                {/* Checkmark for completed zones */}
                {isComplete && (
                  <div
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                    style={{ backgroundColor: zone.color }}
                  >
                    ✓
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
