"use client";

interface StatCard {
  label: string;
  value: number | string;
  sparkline?: number[];
}

function MiniSparkline({ data }: { data: number[] }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const w = 60;
  const h = 20;
  const points = data.map((v, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * w;
    const y = h - (v / max) * (h - 2) - 1;
    return `${x},${y}`;
  });
  return (
    <svg width={w} height={h} className="ml-auto">
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="#7B2FF2"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function QuickStats({ stats }: { stats: StatCard[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {stats.map((s) => (
        <div key={s.label} className="bg-white rounded-lg border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-gray-900">{s.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
            {s.sparkline && <MiniSparkline data={s.sparkline} />}
          </div>
        </div>
      ))}
    </div>
  );
}
