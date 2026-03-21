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

/**
 * StatsStrip component displays 5 key stats in a horizontal strip.
 * Shows pages completed, time invested, tools used, and badges earned.
 */
export function StatsStrip({ stats }: StatsStripProps) {
  // Convert milliseconds to hours
  const hours = (stats.totalTimeMs / (1000 * 60 * 60)).toFixed(1);

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-4">
      {/* Pages Complete */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
        <div className="text-3xl font-bold text-purple-600">
          {stats.totalPagesComplete}
        </div>
        <div className="text-xs text-gray-600 font-medium mt-1 uppercase tracking-wide">
          Pages Complete
        </div>
      </div>

      {/* Time Invested */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
        <div className="text-3xl font-bold text-blue-600">
          {hours}
        </div>
        <div className="text-xs text-gray-600 font-medium mt-1 uppercase tracking-wide">
          Hours Invested
        </div>
      </div>

      {/* Tools Used */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
        <div className="text-3xl font-bold text-green-600">
          {stats.totalToolsUsed}
        </div>
        <div className="text-xs text-gray-600 font-medium mt-1 uppercase tracking-wide">
          Tools Used
        </div>
      </div>

      {/* Badges Earned */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
        <div className="text-3xl font-bold text-amber-600">
          {stats.badgesEarned}
          <span className="text-xl text-gray-400">/{stats.badgesTotal}</span>
        </div>
        <div className="text-xs text-gray-600 font-medium mt-1 uppercase tracking-wide">
          Badges Earned
        </div>
      </div>
    </div>
  );
}
