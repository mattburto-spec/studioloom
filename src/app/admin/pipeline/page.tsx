"use client";

import { useState, useEffect } from "react";
import RunHistory from "@/components/admin/pipeline/RunHistory";

export default function PipelinePage() {
  const [data, setData] = useState<{ runs: any[]; stageStats: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/pipeline?status=${statusFilter}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ runs: [], stageStats: {} }))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-gray-900">Pipeline Health</h2>
        <div className="flex gap-2">
          {["all", "completed", "failed", "running"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-xs px-3 py-1 rounded-full ${
                statusFilter === s
                  ? "bg-purple-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="text-gray-400 text-sm py-8 text-center">Loading...</div>
      ) : data ? (
        <RunHistory runs={data.runs} stageStats={data.stageStats} />
      ) : null}
    </div>
  );
}
