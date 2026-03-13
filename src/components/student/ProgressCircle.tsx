interface ProgressCircleProps {
  status: "not_started" | "in_progress" | "complete" | "locked";
  size?: number;
  color?: string;
}

export function ProgressCircle({ status, size = 20, color = "#6B7280" }: ProgressCircleProps) {
  const r = (size - 4) / 2;
  const cx = size / 2;
  const cy = size / 2;

  if (status === "locked") {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
        <circle cx={cx} cy={cy} r={r} fill="#E5E7EB" stroke="#D1D5DB" strokeWidth="1.5" />
        <path
          d={`M${cx - 2.5} ${cy + 0.5}h5v3a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-3z`}
          fill="#9CA3AF"
        />
        <path
          d={`M${cx - 1.5} ${cy + 0.5}v-1.5a1.5 1.5 0 0 1 3 0v1.5`}
          fill="none"
          stroke="#9CA3AF"
          strokeWidth="1"
        />
      </svg>
    );
  }

  if (status === "complete") {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
        <circle cx={cx} cy={cy} r={r} fill={color} />
        <path
          d={`M${cx - 3} ${cy}l2 2 4-4`}
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (status === "in_progress") {
    // Half-filled circle
    const circumference = 2 * Math.PI * r;
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E5E7EB" strokeWidth="2" />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * 0.5}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      </svg>
    );
  }

  // not_started — empty ring
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#D1D5DB" strokeWidth="1.5" />
    </svg>
  );
}
