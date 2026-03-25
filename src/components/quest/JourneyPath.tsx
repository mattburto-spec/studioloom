'use client';

interface JourneyPathProps {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  phase: string;
  isTraversed: boolean;
  isActive: boolean;
}

const PHASE_COLORS: Record<string, string> = {
  discovery: '#F59E0B',
  planning: '#6366F1',
  working: '#10B981',
  sharing: '#8B5CF6',
  not_started: '#64748b',
  completed: '#EC4899',
};

export function JourneyPath({
  fromX,
  fromY,
  toX,
  toY,
  phase,
  isTraversed,
  isActive,
}: JourneyPathProps) {
  const dx = toX - fromX;
  const dy = toY - fromY;

  // Cubic bezier curve with gentle S-curve control points
  const cp1x = fromX + dx * 0.4;
  const cp1y = fromY;
  const cp2x = toX - dx * 0.4;
  const cp2y = toY;

  const pathD = `M ${fromX},${fromY} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${toX},${toY}`;

  const phaseColor = PHASE_COLORS[phase] || '#64748b';

  let stroke = '#475569';
  let strokeWidth = 2;
  let strokeOpacity = 0.3;
  let strokeDasharray = '6 4';

  if (isTraversed) {
    stroke = phaseColor;
    strokeOpacity = 0.8;
    strokeDasharray = 'none';
  }

  if (isActive) {
    strokeOpacity = 1;
  }

  return (
    <g>
      {/* Main path */}
      <path
        d={pathD}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeOpacity={strokeOpacity}
        strokeDasharray={strokeDasharray}
        strokeLinecap="round"
        style={{
          transition: 'all 0.3s ease',
          pointerEvents: 'none',
        }}
      />

      {/* Traveling dot animation for active paths */}
      {isActive && isTraversed && (
        <>
          <defs>
            <style>
              {`
                @keyframes travel-along-path {
                  0% {
                    offset-distance: 0%;
                  }
                  100% {
                    offset-distance: 100%;
                  }
                }
              `}
            </style>
          </defs>
          <circle
            cx={0}
            cy={0}
            r={3}
            fill={phaseColor}
            fillOpacity={0.8}
            style={{
              offsetPath: `path('${pathD}')`,
              offsetDistance: '0%',
              animation: 'travel-along-path 2s ease-in-out infinite',
              pointerEvents: 'none',
              filter: `drop-shadow(0 0 4px ${phaseColor})`,
            }}
          />
        </>
      )}
    </g>
  );
}

export default JourneyPath;
