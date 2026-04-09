"use client";

interface HealthLight {
  label: string;
  status: "green" | "amber" | "red";
  detail?: string;
}

const STATUS_COLORS = {
  green: { bg: "#dcfce7", ring: "#22c55e", dot: "#16a34a" },
  amber: { bg: "#fef9c3", ring: "#eab308", dot: "#ca8a04" },
  red: { bg: "#fee2e2", ring: "#ef4444", dot: "#dc2626" },
};

export default function HealthStrip({ lights }: { lights: HealthLight[] }) {
  return (
    <div className="flex gap-3 flex-wrap">
      {lights.map((l) => {
        const c = STATUS_COLORS[l.status];
        return (
          <div
            key={l.label}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm"
            style={{ background: c.bg, borderColor: c.ring + "40" }}
            title={l.detail}
          >
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: c.dot, boxShadow: `0 0 6px ${c.dot}60` }}
            />
            <span className="font-medium text-gray-700">{l.label}</span>
          </div>
        );
      })}
    </div>
  );
}
