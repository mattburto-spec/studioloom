'use client';

/**
 * Structural SVG thumbnail components for the toolkit redesign.
 * Each thumbnail shows the tool's OUTPUT SHAPE, not generic icons.
 * Phase-colored based on the design thinking phase (discover/define/ideate/prototype/test).
 */

interface ToolkitThumbnailProps {
  toolId: string;
  phase: string;
  className?: string;
}

const PHASE_COLORS = {
  discover: { a: '#60a5fa', b: '#3b82f6' },
  define: { a: '#a78bfa', b: '#8b5cf6' },
  ideate: { a: '#34d399', b: '#10b981' },
  prototype: { a: '#fbbf24', b: '#f59e0b' },
  test: { a: '#f472b6', b: '#ec4899' },
};

type PhaseKey = keyof typeof PHASE_COLORS;

function getPhaseColors(phase: string) {
  const key = phase.toLowerCase() as PhaseKey;
  return PHASE_COLORS[key] || PHASE_COLORS.ideate;
}

// Individual thumbnail components

function MindMapThumbnail({ a, b }: { a: string; b: string }) {
  return (
    <svg viewBox="0 0 200 140" className="w-full h-full">
      {/* Central circle */}
      <circle cx="100" cy="70" r="14" fill={a} stroke={b} strokeWidth="2" />

      {/* 6 main radiating lines */}
      {[0, 60, 120, 180, 240, 300].map((angle) => {
        const rad = (angle * Math.PI) / 180;
        const x1 = 100 + Math.cos(rad) * 14;
        const y1 = 70 + Math.sin(rad) * 14;
        const x2 = 100 + Math.cos(rad) * 50;
        const y2 = 70 + Math.sin(rad) * 50;
        return (
          <g key={`main-${angle}`}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={a} strokeWidth="1.5" />
            <circle cx={x2} cy={y2} r="8" fill={b} fillOpacity="0.7" stroke={a} strokeWidth="1" />

            {/* Sub-branches (3 per main branch) */}
            {[30, 0, -30].map((subAngle) => {
              const subRad = ((angle + subAngle) * Math.PI) / 180;
              const sx1 = x2 + Math.cos(subRad) * 2;
              const sy1 = y2 + Math.sin(subRad) * 2;
              const sx2 = x2 + Math.cos(subRad) * 20;
              const sy2 = y2 + Math.sin(subRad) * 20;
              return (
                <g key={`sub-${angle}-${subAngle}`}>
                  <line x1={sx1} y1={sy1} x2={sx2} y2={sy2} stroke={a} strokeWidth="1" strokeOpacity="0.5" />
                  <circle cx={sx2} cy={sy2} r="5" fill={a} fillOpacity="0.5" />
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

function EmpathyMapThumbnail({ a, b }: { a: string; b: string }) {
  const labels = [
    { text: 'SAYS', x: 50, y: 35 },
    { text: 'THINKS', x: 150, y: 35 },
    { text: 'DOES', x: 50, y: 105 },
    { text: 'FEELS', x: 150, y: 105 },
  ];

  return (
    <svg viewBox="0 0 200 140" className="w-full h-full">
      {/* 4 quadrants */}
      {[
        { x: 20, y: 20 },
        { x: 110, y: 20 },
        { x: 20, y: 90 },
        { x: 110, y: 90 },
      ].map((pos, idx) => (
        <rect
          key={`quad-${idx}`}
          x={pos.x}
          y={pos.y}
          width="60"
          height="50"
          fill={idx % 2 === 0 ? a : b}
          fillOpacity="0.2"
          stroke={idx % 2 === 0 ? a : b}
          strokeWidth="1.5"
          rx="3"
        />
      ))}

      {/* Center circle with face */}
      <circle cx="100" cy="70" r="12" fill="none" stroke={a} strokeWidth="1.5" />
      <circle cx="97" cy="67" r="1.5" fill={a} />
      <circle cx="103" cy="67" r="1.5" fill={a} />
      <path d="M 97 71 Q 100 73 103 71" stroke={a} strokeWidth="1" fill="none" />

      {/* Labels */}
      {labels.map((label, idx) => (
        <text
          key={`label-${idx}`}
          x={label.x}
          y={label.y}
          fontSize="9"
          fontWeight="bold"
          fill={a}
          textAnchor="middle"
        >
          {label.text}
        </text>
      ))}
    </svg>
  );
}

function SWOTThumbnail() {
  return (
    <svg viewBox="0 0 200 140" className="w-full h-full">
      {/* S - top-left - green */}
      <rect x="20" y="20" width="70" height="55" fill="#34d399" fillOpacity="0.3" stroke="#34d399" strokeWidth="2" />
      <text x="55" y="55" fontSize="28" fontWeight="bold" fill="#34d399" textAnchor="middle">
        S
      </text>

      {/* W - top-right - pink */}
      <rect x="110" y="20" width="70" height="55" fill="#f472b6" fillOpacity="0.3" stroke="#f472b6" strokeWidth="2" />
      <text x="145" y="55" fontSize="28" fontWeight="bold" fill="#f472b6" textAnchor="middle">
        W
      </text>

      {/* O - bottom-left - blue */}
      <rect x="20" y="85" width="70" height="55" fill="#60a5fa" fillOpacity="0.3" stroke="#60a5fa" strokeWidth="2" />
      <text x="55" y="120" fontSize="28" fontWeight="bold" fill="#60a5fa" textAnchor="middle">
        O
      </text>

      {/* T - bottom-right - yellow */}
      <rect x="110" y="85" width="70" height="55" fill="#fbbf24" fillOpacity="0.3" stroke="#fbbf24" strokeWidth="2" />
      <text x="145" y="120" fontSize="28" fontWeight="bold" fill="#fbbf24" textAnchor="middle">
        T
      </text>
    </svg>
  );
}

function DecisionMatrixThumbnail({ a, b }: { a: string; b: string }) {
  const criteria = ['C1', 'C2', 'C3'];
  const options = ['Opt1', 'Opt2', 'Opt3', 'Opt4'];

  return (
    <svg viewBox="0 0 200 140" className="w-full h-full">
      {/* Header row */}
      <line x1="35" y1="25" x2="180" y2="25" stroke={a} strokeWidth="1.5" />
      {criteria.map((c, i) => (
        <text
          key={`header-${i}`}
          x={70 + i * 35}
          y="22"
          fontSize="8"
          fontWeight="bold"
          fill={a}
          textAnchor="middle"
        >
          {c}
        </text>
      ))}

      {/* Data rows with dots */}
      {options.map((opt, rowIdx) => {
        const y = 40 + rowIdx * 25;
        return (
          <g key={`row-${rowIdx}`}>
            <text x="32" y={y + 8} fontSize="8" fontWeight="bold" fill={a} textAnchor="end">
              {opt}
            </text>
            <line x1="35" y1={y} x2="180" y2={y} stroke={a} strokeWidth="1" strokeOpacity="0.3" />

            {/* Column lines and dots */}
            {criteria.map((_, colIdx) => {
              const cx = 70 + colIdx * 35;
              const opacity = [1, 0.6, 0.3][Math.floor(Math.random() * 3)];
              return (
                <g key={`dot-${rowIdx}-${colIdx}`}>
                  <line x1={cx} y1={y} x2={cx} y2={y + 20} stroke={a} strokeWidth="0.5" strokeOpacity="0.2" />
                  <circle cx={cx} cy={y + 10} r="3" fill={b} fillOpacity={opacity} />
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

function PMIThumbnail({ a, b }: { a: string; b: string }) {
  const columns = [
    { label: '+', color: '#34d399', x: 35 },
    { label: '−', color: '#f472b6', x: 100 },
    { label: '?', color: '#a78bfa', x: 165 },
  ];

  return (
    <svg viewBox="0 0 200 140" className="w-full h-full">
      {columns.map((col) => (
        <g key={col.label}>
          {/* Column background */}
          <rect x={col.x - 25} y="25" width="50" height="100" fill={col.color} fillOpacity="0.15" stroke={col.color} strokeWidth="1.5" rx="2" />

          {/* Label */}
          <text x={col.x} y="35" fontSize="14" fontWeight="bold" fill={col.color} textAnchor="middle">
            {col.label}
          </text>

          {/* Data bars inside */}
          {[40, 70, 100].map((yBar, idx) => (
            <rect
              key={`bar-${col.label}-${idx}`}
              x={col.x - 15}
              y={yBar}
              width={10 + idx * 4}
              height="12"
              fill={col.color}
              fillOpacity="0.6"
              rx="1"
            />
          ))}
        </g>
      ))}
    </svg>
  );
}

function FiveWhysThumbnail({ a, b }: { a: string; b: string }) {
  const widths = [30, 45, 60, 75, 90];
  const heights = [18, 16, 14, 12, 10];

  return (
    <svg viewBox="0 0 200 140" className="w-full h-full">
      {widths.map((w, idx) => {
        const y = 20 + idx * 24;
        const x = 100 - w / 2;
        return (
          <g key={`why-${idx}`}>
            <rect x={x} y={y} width={w} height={heights[idx]} fill={a} fillOpacity={0.7 - idx * 0.1} stroke={b} strokeWidth="1.5" rx="2" />
            <text x="100" y={y + 11} fontSize="9" fontWeight="bold" fill="white" textAnchor="middle">
              Why?
            </text>

            {/* Connector line */}
            {idx < widths.length - 1 && <line x1="100" y1={y + heights[idx]} x2="100" y2={y + 24} stroke={a} strokeWidth="1" />}
          </g>
        );
      })}

      {/* Root cause label at bottom */}
      <rect x="65" y="138" width="70" height="14" fill="none" stroke={b} strokeWidth="2" strokeDasharray="2,2" rx="1" />
      <text x="100" y="148" fontSize="7" fontWeight="bold" fill={b} textAnchor="middle">
        ROOT
      </text>
    </svg>
  );
}

function SCAPERThumbnail({ a, b }: { a: string; b: string }) {
  const letters = ['S', 'C', 'A', 'M', 'P', 'E', 'R'];

  return (
    <svg viewBox="0 0 200 140" className="w-full h-full">
      {letters.map((letter, idx) => {
        const x = 40 + idx * 18;
        const y = 30 + idx * 14;
        return (
          <g key={letter}>
            <rect x={x - 8} y={y} width="16" height="16" fill={a} fillOpacity={0.5 + idx * 0.07} stroke={b} strokeWidth="1.5" rx="2" />
            <text x={x} y={y + 12} fontSize="12" fontWeight="bold" fill="white" textAnchor="middle">
              {letter}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function LotusDiagramThumbnail({ a, b }: { a: string; b: string }) {
  const positions = [
    { x: 50, y: 50 },
    { x: 100, y: 30 },
    { x: 150, y: 50 },
    { x: 170, y: 70 },
    { x: 150, y: 90 },
    { x: 100, y: 110 },
    { x: 50, y: 90 },
    { x: 30, y: 70 },
  ];

  return (
    <svg viewBox="0 0 200 140" className="w-full h-full">
      {/* Center emphasized cell */}
      <rect x="80" y="60" width="40" height="20" fill={b} stroke={a} strokeWidth="2" rx="2" />

      {/* Surrounding cells */}
      {positions.map((pos, idx) => (
        <rect
          key={`lotus-${idx}`}
          x={pos.x - 15}
          y={pos.y - 10}
          width="30"
          height="20"
          fill={a}
          fillOpacity="0.4"
          stroke={a}
          strokeWidth="1.5"
          rx="2"
        />
      ))}
    </svg>
  );
}

function SixHatsThumbnail() {
  const hats = [
    { color: '#f5f5f5', label: 'W', x: 20 },
    { color: '#ef4444', label: 'R', x: 50 },
    { color: '#1a1a1a', label: 'B', x: 80 },
    { color: '#fbbf24', label: 'Y', x: 110 },
    { color: '#34d399', label: 'G', x: 140 },
    { color: '#60a5fa', label: 'U', x: 170 },
  ];

  return (
    <svg viewBox="0 0 200 140" className="w-full h-full">
      {hats.map((hat) => (
        <g key={hat.label}>
          {/* Hat shape: rounded top */}
          <path
            d={`M ${hat.x - 8} ${50} Q ${hat.x} ${35} ${hat.x + 8} ${50}`}
            fill={hat.color}
            stroke={hat.color}
            strokeWidth="1.5"
          />
          {/* Brim */}
          <rect x={hat.x - 10} y="50" width="20" height="6" fill={hat.color} stroke={hat.color} strokeWidth="1.5" rx="1" />
          {/* Label */}
          <text x={hat.x} y="75" fontSize="9" fontWeight="bold" fill={hat.color} textAnchor="middle">
            {hat.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

function FishboneThumbnail({ a, b }: { a: string; b: string }) {
  return (
    <svg viewBox="0 0 200 140" className="w-full h-full">
      {/* Horizontal spine */}
      <line x1="20" y1="70" x2="170" y2="70" stroke={a} strokeWidth="2" />

      {/* Arrow head */}
      <polygon points="170,70 160,65 160,75" fill={a} />

      {/* 4 bone pairs (up and down) */}
      {[1, 2, 3, 4].map((i) => {
        const x = 50 + i * 30;
        return (
          <g key={`bone-${i}`}>
            {/* Top bone */}
            <line x1={x} y1="70" x2={x + 15} y2="40" stroke={a} strokeWidth="1.5" />
            <circle cx={x + 15} cy="40" r="3" fill={b} />

            {/* Bottom bone */}
            <line x1={x} y1="70" x2={x + 15} y2="100" stroke={a} strokeWidth="1.5" />
            <circle cx={x + 15} cy="100" r="3" fill={b} />
          </g>
        );
      })}
    </svg>
  );
}

function AffinityThumbnail({ a, b }: { a: string; b: string }) {
  const colors = [a, b, '#f472b6', '#fbbf24'];
  const positions = [
    { x: 25, y: 30 },
    { x: 70, y: 25 },
    { x: 110, y: 50 },
    { x: 35, y: 70 },
    { x: 85, y: 85 },
    { x: 140, y: 60 },
    { x: 50, y: 105 },
    { x: 145, y: 105 },
  ];

  return (
    <svg viewBox="0 0 200 140" className="w-full h-full">
      {/* Dashed separators */}
      <line x1="80" y1="20" x2="80" y2="130" stroke={a} strokeWidth="1" strokeDasharray="3,2" strokeOpacity="0.4" />
      <line x1="20" y1="65" x2="160" y2="65" stroke={a} strokeWidth="1" strokeDasharray="3,2" strokeOpacity="0.4" />

      {/* Sticky notes */}
      {positions.map((pos, idx) => {
        const color = colors[idx % colors.length];
        return (
          <g key={`note-${idx}`}>
            <rect x={pos.x - 12} y={pos.y - 10} width="24" height="20" fill={color} fillOpacity="0.6" stroke={color} strokeWidth="1" rx="1" />
            <line x1={pos.x - 10} y1={pos.y - 3} x2={pos.x + 10} y2={pos.y - 3} stroke={color} strokeWidth="0.5" strokeOpacity="0.4" />
            <line x1={pos.x - 10} y1={pos.y + 3} x2={pos.x + 10} y2={pos.y + 3} stroke={color} strokeWidth="0.5" strokeOpacity="0.4" />
          </g>
        );
      })}
    </svg>
  );
}

function JourneyMapThumbnail({ a, b }: { a: string; b: string }) {
  return (
    <svg viewBox="0 0 200 140" className="w-full h-full">
      {/* Timeline base */}
      <line x1="30" y1="95" x2="170" y2="95" stroke={a} strokeWidth="1.5" />

      {/* Timeline dots */}
      {[30, 65, 100, 135, 170].map((x) => (
        <circle key={`dot-${x}`} cx={x} cy="95" r="4" fill={b} stroke={a} strokeWidth="1.5" />
      ))}

      {/* Emotion curve */}
      <path
        d="M 30 80 Q 65 40 100 65 Q 135 50 170 75"
        stroke={a}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />

      {/* Vertical connectors to curve */}
      {[30, 65, 100, 135, 170].map((x) => (
        <line key={`connect-${x}`} x1={x} y1="95" x2={x} y2="50" stroke={a} strokeWidth="0.5" strokeDasharray="2,2" strokeOpacity="0.4" />
      ))}
    </svg>
  );
}

function StakeholderMapThumbnail({ a, b }: { a: string; b: string }) {
  return (
    <svg viewBox="0 0 200 140" className="w-full h-full">
      {/* 3 concentric circles */}
      <circle cx="100" cy="70" r="50" fill="none" stroke={a} strokeWidth="1.5" strokeOpacity="0.5" />
      <circle cx="100" cy="70" r="35" fill="none" stroke={a} strokeWidth="1.5" strokeOpacity="0.6" />
      <circle cx="100" cy="70" r="20" fill="none" stroke={a} strokeWidth="1.5" strokeOpacity="0.8" />

      {/* Dots distributed by distance (more important = closer) */}
      {/* Outer ring */}
      {[0, 90, 180, 270].map((angle) => {
        const rad = (angle * Math.PI) / 180;
        const x = 100 + Math.cos(rad) * 42;
        const y = 70 + Math.sin(rad) * 42;
        return <circle key={`outer-${angle}`} cx={x} cy={y} r="2" fill={a} fillOpacity="0.4" />;
      })}

      {/* Middle ring (more dots) */}
      {[0, 60, 120, 180, 240, 300].map((angle) => {
        const rad = (angle * Math.PI) / 180;
        const x = 100 + Math.cos(rad) * 28;
        const y = 70 + Math.sin(rad) * 28;
        return <circle key={`mid-${angle}`} cx={x} cy={y} r="2.5" fill={a} fillOpacity="0.6" />;
      })}

      {/* Inner ring (many dots = most important) */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
        const rad = (angle * Math.PI) / 180;
        const x = 100 + Math.cos(rad) * 15;
        const y = 70 + Math.sin(rad) * 15;
        return <circle key={`inner-${angle}`} cx={x} cy={y} r="2" fill={b} fillOpacity="0.8" />;
      })}
    </svg>
  );
}

function HowMightWeThumbnail({ a, b }: { a: string; b: string }) {
  return (
    <svg viewBox="0 0 200 140" className="w-full h-full">
      {/* Large "HMW" text */}
      <text x="100" y="50" fontSize="32" fontWeight="bold" fill={a} textAnchor="middle">
        HMW
      </text>

      {/* Descending bars below */}
      {[3, 2, 1].map((i) => {
        const width = 70 - i * 15;
        return (
          <rect
            key={`bar-${i}`}
            x={100 - width / 2}
            y={60 + i * 18}
            width={width}
            height="10"
            fill={b}
            fillOpacity="0.5"
            rx="2"
          />
        );
      })}

      {/* Reframe arrows above */}
      {[-30, 30].map((offset) => (
        <g key={`arrow-${offset}`}>
          <path
            d={`M ${100 + offset - 10} 20 Q ${100 + offset} 10 ${100 + offset + 10} 20`}
            stroke={a}
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
          />
          <polygon points={`${100 + offset + 10},20 ${100 + offset + 8},25 ${100 + offset + 12},23`} fill={a} />
        </g>
      ))}
    </svg>
  );
}

function ReverseBrainstormThumbnail({ a, b }: { a: string; b: string }) {
  return (
    <svg viewBox="0 0 200 140" className="w-full h-full">
      {/* Left side - down arrows (pink) */}
      {[35, 70, 105].map((y) => (
        <g key={`down-${y}`}>
          <line x1="40" y1={y} x2="40" y2={y + 20} stroke="#f472b6" strokeWidth="2" strokeLinecap="round" />
          <polygon points="40,80 35,70 45,70" fill="#f472b6" />
        </g>
      ))}

      {/* Center flip connector */}
      <line x1="60" y1="70" x2="140" y2="70" stroke={a} strokeWidth="1.5" strokeDasharray="3,2" />
      <text x="100" y="65" fontSize="10" fontWeight="bold" fill={a} textAnchor="middle">
        FLIP
      </text>

      {/* Right side - up arrows (phase color) */}
      {[35, 70, 105].map((y) => (
        <g key={`up-${y}`}>
          <line x1="160" y1={y + 20} x2="160" y2={y} stroke={b} strokeWidth="2" strokeLinecap="round" />
          <polygon points="160,35 155,45 165,45" fill={b} />
        </g>
      ))}
    </svg>
  );
}

function MorphologicalThumbnail({ a, b }: { a: string; b: string }) {
  const categories = ['A', 'B', 'C', 'D'];

  return (
    <svg viewBox="0 0 200 140" className="w-full h-full">
      {/* Category column on left */}
      {['Cat1', 'Cat2', 'Cat3', 'Cat4'].map((cat, idx) => (
        <text
          key={`cat-${idx}`}
          x="20"
          y={35 + idx * 28}
          fontSize="8"
          fontWeight="bold"
          fill={a}
          textAnchor="end"
        >
          {cat}
        </text>
      ))}

      {/* Grid of options (4 columns × 4 rows) */}
      {categories.map((_, colIdx) =>
        [0, 1, 2, 3].map((rowIdx) => {
          const x = 35 + colIdx * 40;
          const y = 25 + rowIdx * 28;
          const isSelected = colIdx === rowIdx; // Diagonal selection
          return (
            <rect
              key={`cell-${colIdx}-${rowIdx}`}
              x={x}
              y={y}
              width="32"
              height="20"
              fill={isSelected ? b : a}
              fillOpacity={isSelected ? 0.6 : 0.2}
              stroke={a}
              strokeWidth={isSelected ? 1.5 : 1}
              rx="2"
            />
          );
        })
      )}

      {/* Dashed path through selected options */}
      <path
        d="M 51 35 L 91 63 L 131 91"
        stroke={b}
        strokeWidth="1.5"
        strokeDasharray="3,2"
        fill="none"
      />
    </svg>
  );
}

function DotVotingThumbnail({ a, b }: { a: string; b: string }) {
  return (
    <svg viewBox="0 0 200 140" className="w-full h-full">
      {/* 5 horizontal bars with varying dot counts */}
      {[3, 2, 4, 1, 0].map((dotCount, barIdx) => {
        const y = 25 + barIdx * 22;
        return (
          <g key={`bar-${barIdx}`}>
            {/* Bar background */}
            <rect x="20" y={y} width="100" height="16" fill={a} fillOpacity="0.2" stroke={a} strokeWidth="1" rx="2" />

            {/* Dots beside bar */}
            {Array.from({ length: dotCount }).map((_, dotIdx) => (
              <circle
                key={`dot-${barIdx}-${dotIdx}`}
                cx={130 + dotIdx * 15}
                cy={y + 8}
                r="4"
                fill={b}
                stroke={a}
                strokeWidth="1"
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

function PersonaThumbnail({ a, b }: { a: string; b: string }) {
  return (
    <svg viewBox="0 0 200 140" className="w-full h-full">
      {/* User silhouette on left */}
      <circle cx="45" cy="40" r="12" fill={a} fillOpacity="0.6" stroke={a} strokeWidth="1.5" />
      <path d="M 30 55 Q 45 65 60 55 L 58 75 Q 45 85 32 75 Z" fill={a} fillOpacity="0.6" stroke={a} strokeWidth="1.5" />

      {/* Data blocks on right */}
      {[
        { y: 30, width: 50, label: 'Goal' },
        { y: 55, width: 60, label: 'Behavior' },
        { y: 80, width: 45, label: 'Pain' },
        { y: 105, width: 55, label: 'Context' },
      ].map((block, idx) => (
        <g key={`data-${idx}`}>
          <rect
            x={100}
            y={block.y}
            width={block.width}
            height="14"
            fill={b}
            fillOpacity="0.5"
            stroke={a}
            strokeWidth="1"
            rx="2"
          />
          <text x={102} y={block.y + 10} fontSize="7" fontWeight="bold" fill={a}>
            {block.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

function ImpactEffortThumbnail() {
  return (
    <svg viewBox="0 0 200 140" className="w-full h-full">
      {/* 2×2 matrix */}
      <line x1="100" y1="20" x2="100" y2="120" stroke="#333" strokeWidth="2" />
      <line x1="20" y1="70" x2="180" y2="70" stroke="#333" strokeWidth="2" />

      {/* Axis labels */}
      <text x="160" y="135" fontSize="9" fontWeight="bold" fill="#333">
        EFFORT →
      </text>
      <text x="10" y="45" fontSize="9" fontWeight="bold" fill="#333">
        IMPACT ↑
      </text>

      {/* Quadrant labels */}
      <text x="55" y="50" fontSize="10" fontWeight="bold" fill="#34d399">
        DO FIRST
      </text>
      <text x="135" y="50" fontSize="10" fontWeight="bold" fill="#fbbf24">
        PLAN
      </text>
      <text x="55" y="110" fontSize="10" fontWeight="bold" fill="#f472b6">
        SKIP
      </text>
      <text x="135" y="110" fontSize="10" fontWeight="bold" fill="#60a5fa">
        QUICK WIN
      </text>

      {/* Scattered dots */}
      {[
        { x: 50, y: 45, color: '#34d399' },
        { x: 140, y: 60, color: '#fbbf24' },
        { x: 60, y: 95, color: '#f472b6' },
        { x: 130, y: 80, color: '#60a5fa' },
      ].map((dot, idx) => (
        <circle key={`dot-${idx}`} cx={dot.x} cy={dot.y} r="3" fill={dot.color} fillOpacity="0.7" />
      ))}
    </svg>
  );
}

function FeedbackGridThumbnail() {
  const quadrants = [
    { label: 'LIKES', x: 50, y: 40, color: '#34d399' },
    { label: 'WISHES', x: 150, y: 40, color: '#f472b6' },
    { label: 'QUESTIONS', x: 50, y: 100, color: '#60a5fa' },
    { label: 'IDEAS', x: 150, y: 100, color: '#fbbf24' },
  ];

  return (
    <svg viewBox="0 0 200 140" className="w-full h-full">
      {/* 2×2 grid lines */}
      <line x1="100" y1="25" x2="100" y2="125" stroke="#999" strokeWidth="2" />
      <line x1="25" y1="70" x2="175" y2="70" stroke="#999" strokeWidth="2" />

      {/* Quadrants */}
      {quadrants.map((quad) => (
        <g key={quad.label}>
          <rect x={quad.x - 30} y={quad.y - 25} width="60" height="50" fill={quad.color} fillOpacity="0.15" />
          <text x={quad.x} y={quad.y} fontSize="10" fontWeight="bold" fill={quad.color} textAnchor="middle">
            {quad.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

function BrainstormWebThumbnail({ a, b }: { a: string; b: string }) {
  return (
    <svg viewBox="0 0 200 140" className="w-full h-full">
      {/* Central circle - larger */}
      <circle cx="100" cy="70" r="16" fill={b} stroke={a} strokeWidth="2" />

      {/* 5 outer circles */}
      {[0, 72, 144, 216, 288].map((angle) => {
        const rad = (angle * Math.PI) / 180;
        const x = 100 + Math.cos(rad) * 55;
        const y = 70 + Math.sin(rad) * 55;
        return (
          <g key={`outer-${angle}`}>
            <line x1={100 + Math.cos(rad) * 16} y1={70 + Math.sin(rad) * 16} x2={x} y2={y} stroke={a} strokeWidth="1.5" />
            <circle cx={x} cy={y} r="10" fill={a} fillOpacity="0.5" stroke={a} strokeWidth="1" />
          </g>
        );
      })}

      {/* One cross-connection */}
      <line x1={100 + 55} y1="70" x2={100 - 55} y2="70" stroke={a} strokeWidth="1" strokeDasharray="2,2" strokeOpacity="0.5" />
    </svg>
  );
}

function ComparisonThumbnail({ a, b }: { a: string; b: string }) {
  return (
    <svg viewBox="0 0 200 140" className="w-full h-full">
      {/* Left rectangle - Option A */}
      <rect x="25" y="40" width="45" height="60" fill={a} fillOpacity="0.3" stroke={a} strokeWidth="1.5" rx="3" />
      <text x="47" y="75" fontSize="12" fontWeight="bold" fill={a} textAnchor="middle">
        A
      </text>

      {/* Right rectangle - Option B */}
      <rect x="130" y="40" width="45" height="60" fill={b} fillOpacity="0.3" stroke={b} strokeWidth="1.5" rx="3" />
      <text x="152" y="75" fontSize="12" fontWeight="bold" fill={b} textAnchor="middle">
        B
      </text>

      {/* Bidirectional arrows between */}
      <path d="M 75 70 L 95 65 M 95 75 L 75 70" stroke={a} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M 125 70 L 105 75 M 105 65 L 125 70" stroke={b} strokeWidth="1.5" fill="none" strokeLinecap="round" />

      {/* "vs" label */}
      <text x="100" y="120" fontSize="11" fontWeight="bold" fill={a} textAnchor="middle">
        vs
      </text>
    </svg>
  );
}

function SketchThumbnail({ a, b }: { a: string; b: string }) {
  return (
    <svg viewBox="0 0 200 140" className="w-full h-full">
      {/* Canvas rectangle */}
      <rect x="25" y="25" width="150" height="90" fill="white" stroke={a} strokeWidth="2" rx="3" />

      {/* Freeform curve */}
      <path d="M 40 80 Q 60 50 80 70 T 120 60" stroke={b} strokeWidth="2" fill="none" strokeLinecap="round" />

      {/* Circle */}
      <circle cx="60" cy="45" r="12" fill="none" stroke={a} strokeWidth="1.5" />

      {/* Smaller rectangle */}
      <rect x="110" y="65" width="30" height="25" fill={a} fillOpacity="0.3" stroke={a} strokeWidth="1.5" rx="2" />
    </svg>
  );
}

function StoryboardThumbnail({ a, b }: { a: string; b: string }) {
  return (
    <svg viewBox="0 0 200 140" className="w-full h-full">
      {/* 4 film frames in a row */}
      {[1, 2, 3, 4].map((frame) => {
        const x = 20 + (frame - 1) * 40;
        return (
          <g key={`frame-${frame}`}>
            {/* Frame border */}
            <rect x={x} y="25" width="32" height="40" fill="white" stroke={a} strokeWidth="1.5" rx="2" />

            {/* Film sprocket holes */}
            <circle cx={x + 4} cy="20" r="2" fill={a} />
            <circle cx={x + 28} cy="20" r="2" fill={a} />
            <circle cx={x + 4} cy="70" r="2" fill={a} />
            <circle cx={x + 28} cy="70" r="2" fill={a} />

            {/* Content - simple shapes */}
            <circle cx={x + 16} cy="35" r="4" fill={b} fillOpacity="0.5" />
            <line x1={x + 8} y1="45" x2={x + 24} y2="45" stroke={a} strokeWidth="1" />

            {/* Frame number */}
            <text x={x + 16} y="68" fontSize="8" fontWeight="bold" fill={a} textAnchor="middle">
              {frame}
            </text>
          </g>
        );
      })}

      {/* Timeline bar at bottom */}
      <rect x="20" y="130" width="130" height="4" fill={a} fillOpacity="0.3" rx="2" />
    </svg>
  );
}

function MoodboardThumbnail({ a, b }: { a: string; b: string }) {
  const colors = [a, b, '#f472b6', '#fbbf24', '#34d399'];

  return (
    <svg viewBox="0 0 200 140" className="w-full h-full">
      {/* Asymmetric collage of rectangles */}
      {[
        { x: 20, y: 20, w: 50, h: 40 },
        { x: 80, y: 20, w: 40, h: 35 },
        { x: 130, y: 20, w: 45, h: 50 },
        { x: 20, y: 65, w: 35, h: 45 },
        { x: 65, y: 65, w: 50, h: 45 },
        { x: 130, y: 75, w: 45, h: 35 },
      ].map((rect, idx) => (
        <rect
          key={`tile-${idx}`}
          x={rect.x}
          y={rect.y}
          width={rect.w}
          height={rect.h}
          fill={colors[idx % colors.length]}
          fillOpacity="0.5"
          stroke={colors[idx % colors.length]}
          strokeWidth="1.5"
          rx="2"
        />
      ))}
    </svg>
  );
}

function ValuePropThumbnail({ a, b }: { a: string; b: string }) {
  return (
    <svg viewBox="0 0 200 140" className="w-full h-full">
      {/* Circle (customer) - left */}
      <circle cx="60" cy="70" r="35" fill={a} fillOpacity="0.2" stroke={a} strokeWidth="2" />
      <text x="45" y="65" fontSize="9" fontWeight="bold" fill={a}>
        JOBS
      </text>
      <text x="45" y="78" fontSize="9" fontWeight="bold" fill={a}>
        PAINS
      </text>
      <text x="45" y="91" fontSize="9" fontWeight="bold" fill={a}>
        GAINS
      </text>

      {/* Rectangle (product) - right */}
      <rect x="100" y="35" width="70" height="70" fill={b} fillOpacity="0.2" stroke={b} strokeWidth="2" rx="3" />
      <text x="135" y="57" fontSize="8" fontWeight="bold" fill={b}>
        FEATURES
      </text>
      <text x="135" y="70" fontSize="8" fontWeight="bold" fill={b}>
        RELIEVERS
      </text>
      <text x="135" y="83" fontSize="8" fontWeight="bold" fill={b}>
        CREATORS
      </text>

      {/* Overlap indicator */}
      <text x="100" y="125" fontSize="9" fontWeight="bold" fill={a} textAnchor="middle">
        FIT
      </text>
    </svg>
  );
}

function FallbackThumbnail({ toolId, phase }: { toolId: string; phase: string }) {
  const { a, b } = getPhaseColors(phase);
  const initials = toolId
    .split('-')
    .slice(0, 3)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
    .slice(0, 3);

  return (
    <svg viewBox="0 0 200 140" className="w-full h-full">
      <rect x="25" y="25" width="150" height="90" fill={a} fillOpacity="0.1" stroke={a} strokeWidth="2" rx="5" />
      <text x="100" y="75" fontSize="28" fontWeight="bold" fill={b} textAnchor="middle">
        {initials}
      </text>
    </svg>
  );
}

// Main export component

export function ToolkitThumbnail({ toolId, phase, className = '' }: ToolkitThumbnailProps) {
  const colors = getPhaseColors(phase);

  const renderThumbnail = () => {
    switch (toolId) {
      case 'mind-map':
        return <MindMapThumbnail a={colors.a} b={colors.b} />;
      case 'empathy-map':
        return <EmpathyMapThumbnail a={colors.a} b={colors.b} />;
      case 'swot':
        return <SWOTThumbnail />;
      case 'decision-matrix':
        return <DecisionMatrixThumbnail a={colors.a} b={colors.b} />;
      case 'pmi':
        return <PMIThumbnail a={colors.a} b={colors.b} />;
      case 'five-whys':
        return <FiveWhysThumbnail a={colors.a} b={colors.b} />;
      case 'scamper':
        return <SCAPERThumbnail a={colors.a} b={colors.b} />;
      case 'lotus':
        return <LotusDiagramThumbnail a={colors.a} b={colors.b} />;
      case 'six-hats':
        return <SixHatsThumbnail />;
      case 'fishbone':
        return <FishboneThumbnail a={colors.a} b={colors.b} />;
      case 'affinity':
        return <AffinityThumbnail a={colors.a} b={colors.b} />;
      case 'journey-map':
        return <JourneyMapThumbnail a={colors.a} b={colors.b} />;
      case 'stakeholder-map':
        return <StakeholderMapThumbnail a={colors.a} b={colors.b} />;
      case 'how-might-we':
        return <HowMightWeThumbnail a={colors.a} b={colors.b} />;
      case 'reverse-brainstorm':
        return <ReverseBrainstormThumbnail a={colors.a} b={colors.b} />;
      case 'morphological':
        return <MorphologicalThumbnail a={colors.a} b={colors.b} />;
      case 'dot-voting':
        return <DotVotingThumbnail a={colors.a} b={colors.b} />;
      case 'persona':
        return <PersonaThumbnail a={colors.a} b={colors.b} />;
      case 'impact-effort':
        return <ImpactEffortThumbnail />;
      case 'feedback-grid':
        return <FeedbackGridThumbnail />;
      case 'brainstorm-web':
        return <BrainstormWebThumbnail a={colors.a} b={colors.b} />;
      case 'comparison':
        return <ComparisonThumbnail a={colors.a} b={colors.b} />;
      case 'sketch':
        return <SketchThumbnail a={colors.a} b={colors.b} />;
      case 'storyboard':
        return <StoryboardThumbnail a={colors.a} b={colors.b} />;
      case 'moodboard':
        return <MoodboardThumbnail a={colors.a} b={colors.b} />;
      case 'value-prop':
        return <ValuePropThumbnail a={colors.a} b={colors.b} />;
      case 'biomimicry':
        return <FallbackThumbnail toolId={toolId} phase={phase} />;
      case 'systems-map':
        return <FallbackThumbnail toolId={toolId} phase={phase} />;
      case 'point-of-view':
        return <FallbackThumbnail toolId={toolId} phase={phase} />;
      case 'design-spec':
        return <FallbackThumbnail toolId={toolId} phase={phase} />;
      default:
        return <FallbackThumbnail toolId={toolId} phase={phase} />;
    }
  };

  return <div className={`w-full h-full ${className}`}>{renderThumbnail()}</div>;
}
