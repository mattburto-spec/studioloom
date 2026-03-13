"use client";

interface SliderInputProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  color: string;
  leftLabel?: string;
  rightLabel?: string;
  showValue?: boolean;
  onChange: (value: number) => void;
}

export function SliderInput({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  color,
  leftLabel,
  rightLabel,
  showValue = true,
  onChange,
}: SliderInputProps) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text-primary">{label}</span>
        {showValue && (
          <span
            className="text-xs font-bold tabular-nums"
            style={{ color }}
          >
            {value}
          </span>
        )}
      </div>
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, ${color} 0%, ${color} ${pct}%, #e2e8f0 ${pct}%, #e2e8f0 100%)`,
          }}
          aria-label={label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
        />
      </div>
      {(leftLabel || rightLabel) && (
        <div className="flex justify-between">
          <span className="text-[10px] text-text-secondary/60">{leftLabel}</span>
          <span className="text-[10px] text-text-secondary/60">{rightLabel}</span>
        </div>
      )}
    </div>
  );
}
