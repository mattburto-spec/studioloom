"use client";

import React from "react";

interface StatsStripProps {
  stats: {
    totalToolsUsed: number;
    totalPagesComplete: number;
    totalTimeMs: number;
    badgesEarned: number;
    badgesTotal: number;
  };
}

export function StatsStrip({ stats }: StatsStripProps) {
  const hours = (stats.totalTimeMs / (1000 * 60 * 60)).toFixed(1);

  const items = [
    { value: stats.totalPagesComplete, label: "Pages", color: "#7C3AED" },
    { value: hours, label: "Hours", color: "#3B82F6" },
    { value: stats.totalToolsUsed, label: "Tools", color: "#10B981" },
    { value: `${stats.badgesEarned}`, sub: `/${stats.badgesTotal}`, label: "Badges", color: "#F59E0B" },
  ];

  return (
    <div className="grid grid-cols-4 gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="bg-white rounded-xl border border-gray-200/60 py-3 px-2 text-center"
        >
          <div className="text-2xl font-bold" style={{ color: item.color }}>
            {item.value}
            {"sub" in item && item.sub && (
              <span className="text-lg text-gray-300">{item.sub}</span>
            )}
          </div>
          <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mt-0.5">
            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
}
