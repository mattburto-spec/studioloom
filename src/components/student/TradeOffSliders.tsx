"use client";

import { useState, useEffect, useMemo } from "react";

interface Dimension {
  name: string;
  leftLabel: string;
  rightLabel: string;
  value: number; // 0-100
}

interface TradeOffData {
  dimensions: Dimension[];
  summary: string;
}

interface TradeOffSlidersProps {
  value: string;
  onChange: (value: string) => void;
}

const DEFAULT_DIMENSIONS: Dimension[] = [
  { name: "Cost", leftLabel: "Low Cost", rightLabel: "High Quality", value: 50 },
  { name: "Time", leftLabel: "Quick", rightLabel: "Thorough", value: 50 },
  { name: "Complexity", leftLabel: "Simple", rightLabel: "Feature-Rich", value: 50 },
];

const COLORS = ["#2E86AB", "#2DA05E", "#E86F2C", "#8B2FC9", "#E8396F", "#1B3A5C"];

function emptyData(): TradeOffData {
  return {
    dimensions: DEFAULT_DIMENSIONS.map((d) => ({ ...d })),
    summary: "",
  };
}

function parseValue(value: string): TradeOffData {
  if (!value) return emptyData();
  try {
    return JSON.parse(value);
  } catch {
    return emptyData();
  }
}

export function TradeOffSliders({ value, onChange }: TradeOffSlidersProps) {
  const [data, setData] = useState<TradeOffData>(() => parseValue(value));

  useEffect(() => {
    onChange(JSON.stringify(data));
  }, [data, onChange]);

  // Radar chart points
  const radarPoints = useMemo(() => {
    const dims = data.dimensions;
    const n = dims.length;
    if (n < 3) return null;

    const cx = 80;
    const cy = 80;
    const r = 65;

    const points = dims.map((dim, i) => {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      const dist = (dim.value / 100) * r;
      return {
        x: cx + dist * Math.cos(angle),
        y: cy + dist * Math.sin(angle),
        labelX: cx + (r + 16) * Math.cos(angle),
        labelY: cy + (r + 16) * Math.sin(angle),
        name: dim.name,
      };
    });

    const polygon = points.map((p) => `${p.x},${p.y}`).join(" ");
    const gridLevels = [0.25, 0.5, 0.75, 1];
    const gridPolygons = gridLevels.map((level) =>
      dims
        .map((_, i) => {
          const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
          const dist = level * r;
          return `${cx + dist * Math.cos(angle)},${cy + dist * Math.sin(angle)}`;
        })
        .join(" ")
    );
    const axes = dims.map((_, i) => {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      return { x2: cx + r * Math.cos(angle), y2: cy + r * Math.sin(angle) };
    });

    return { points, polygon, gridPolygons, axes, cx, cy };
  }, [data.dimensions]);

  function updateDimension(index: number, field: keyof Dimension, val: string | number) {
    setData((prev) => {
      const dims = [...prev.dimensions];
      dims[index] = { ...dims[index], [field]: val };
      return { ...prev, dimensions: dims };
    });
  }

  function addDimension() {
    if (data.dimensions.length >= 6) return;
    setData((prev) => ({
      ...prev,
      dimensions: [
        ...prev.dimensions,
        { name: "", leftLabel: "Less", rightLabel: "More", value: 50 },
      ],
    }));
  }

  function removeDimension(index: number) {
    if (data.dimensions.length <= 2) return;
    setData((prev) => ({
      ...prev,
      dimensions: prev.dimensions.filter((_, i) => i !== index),
    }));
  }

  return (
    <div className="space-y-4">
      <div className="text-xs font-semibold text-brand-purple flex items-center gap-1.5 mb-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07" />
        </svg>
        Trade-Off Sliders
      </div>

      {/* Dimension sliders */}
      <div className="space-y-3">
        {data.dimensions.map((dim, i) => (
          <div key={i} className="border border-border rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              <input
                type="text"
                value={dim.name}
                onChange={(e) => updateDimension(i, "name", e.target.value)}
                placeholder="Dimension name"
                className="flex-1 px-2 py-0.5 text-xs font-medium border border-border rounded focus:outline-none focus:ring-1 focus:ring-brand-purple/30"
              />
              {data.dimensions.length > 2 && (
                <button
                  onClick={() => removeDimension(i)}
                  className="text-text-secondary hover:text-red-500 transition"
                  title="Remove"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={dim.leftLabel}
                onChange={(e) => updateDimension(i, "leftLabel", e.target.value)}
                className="w-24 px-1.5 py-0.5 text-[10px] text-right border border-border rounded focus:outline-none focus:ring-1 focus:ring-brand-purple/30"
              />
              <div className="flex-1 relative">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={dim.value}
                  onChange={(e) => updateDimension(i, "value", Number(e.target.value))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, ${COLORS[i % COLORS.length]}40 0%, ${COLORS[i % COLORS.length]} ${dim.value}%, #e2e8f0 ${dim.value}%, #e2e8f0 100%)`,
                  }}
                />
                <div
                  className="absolute -top-5 text-[10px] font-bold transform -translate-x-1/2"
                  style={{
                    left: `${dim.value}%`,
                    color: COLORS[i % COLORS.length],
                  }}
                >
                  {dim.value}%
                </div>
              </div>
              <input
                type="text"
                value={dim.rightLabel}
                onChange={(e) => updateDimension(i, "rightLabel", e.target.value)}
                className="w-24 px-1.5 py-0.5 text-[10px] border border-border rounded focus:outline-none focus:ring-1 focus:ring-brand-purple/30"
              />
            </div>
          </div>
        ))}
      </div>

      {data.dimensions.length < 6 && (
        <button
          onClick={addDimension}
          className="px-3 py-1.5 text-xs border border-dashed border-border rounded-lg hover:bg-gray-50 transition"
        >
          + Add Dimension
        </button>
      )}

      {/* Radar chart visualization */}
      {radarPoints && (
        <div className="bg-surface-alt rounded-xl p-3">
          <div className="text-xs font-semibold text-text-secondary mb-2">
            Trade-Off Profile
          </div>
          <div className="flex justify-center">
            <svg width="160" height="160" viewBox="0 0 160 160">
              {/* Grid polygons */}
              {radarPoints.gridPolygons.map((poly, gi) => (
                <polygon
                  key={gi}
                  points={poly}
                  fill="none"
                  stroke="#e2e8f0"
                  strokeWidth="0.5"
                />
              ))}
              {/* Axes */}
              {radarPoints.axes.map((axis, ai) => (
                <line
                  key={ai}
                  x1={radarPoints.cx}
                  y1={radarPoints.cy}
                  x2={axis.x2}
                  y2={axis.y2}
                  stroke="#e2e8f0"
                  strokeWidth="0.5"
                />
              ))}
              {/* Data polygon */}
              <polygon
                points={radarPoints.polygon}
                fill="#7B2FF220"
                stroke="#7B2FF2"
                strokeWidth="1.5"
              />
              {/* Data points */}
              {radarPoints.points.map((pt, pi) => (
                <circle
                  key={pi}
                  cx={pt.x}
                  cy={pt.y}
                  r="3"
                  fill={COLORS[pi % COLORS.length]}
                />
              ))}
              {/* Labels */}
              {radarPoints.points.map((pt, pi) => (
                <text
                  key={`label-${pi}`}
                  x={pt.labelX}
                  y={pt.labelY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="text-[7px] fill-text-secondary"
                >
                  {pt.name || `Dim ${pi + 1}`}
                </text>
              ))}
            </svg>
          </div>
        </div>
      )}

      {/* Summary */}
      <div>
        <label className="text-xs text-text-secondary">
          Explain your trade-off choices
        </label>
        <textarea
          value={data.summary}
          onChange={(e) => setData((prev) => ({ ...prev, summary: e.target.value }))}
          placeholder="Why did you position each slider where you did? What are you prioritising and why?"
          rows={3}
          className="w-full mt-1 px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-purple/30 resize-none"
        />
      </div>
    </div>
  );
}
