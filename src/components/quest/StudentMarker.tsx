'use client';

interface StudentMarkerProps {
  x: number;
  y: number;
  mentorColor?: string;
}

export default function StudentMarker({
  x,
  y,
  mentorColor = '#A78BFA',
}: StudentMarkerProps) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <defs>
        <filter id="studentMarkerShadow">
          <feDropShadow
            dx="0"
            dy="2"
            stdDeviation="3"
            floodColor={mentorColor}
            floodOpacity="0.4"
          />
        </filter>
      </defs>

      {/* Outer pulsing ring (larger, subtle) */}
      <circle
        r="28"
        fill="none"
        stroke={mentorColor}
        strokeWidth="1"
        style={{
          opacity: 0.1,
          animation: 'pulse-outer 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        }}
      />

      {/* Middle pulsing ring */}
      <circle
        r="22"
        fill="none"
        stroke={mentorColor}
        strokeWidth="2"
        style={{
          opacity: 0.3,
          animation: 'pulse-middle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite 0.2s',
        }}
      />

      {/* Glow halo */}
      <circle r="14" fill={mentorColor} opacity="0.2" />

      {/* Inner filled circle */}
      <circle r="10" fill={mentorColor} filter="url(#studentMarkerShadow)" />

      {/* Center white dot */}
      <circle r="4" fill="white" />

      {/* CSS animations via inline style */}
      <style>{`
        @keyframes pulse-outer {
          0%, 100% { opacity: 0.1; r: 28; }
          50% { opacity: 0.2; r: 32; }
        }
        @keyframes pulse-middle {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </g>
  );
}
