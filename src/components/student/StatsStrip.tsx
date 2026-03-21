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
    { value: String(stats.totalPagesComplete), label: "Pages Done", color: "#7C3AED" },
    { value: hours, label: "Hours", color: "#3B82F6" },
    { value: String(stats.totalToolsUsed), label: "Tools Used", color: "#10B981" },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="bg-white rounded-xl border border-gray-200/60 py-3 px-2 text-center"
        >
          <div className="text-2xl font-bold" style={{ color: item.color }}>
            {item.value}
          </div>
          <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mt-0.5">
            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
}
