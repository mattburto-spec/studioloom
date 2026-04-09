"use client";

interface StageStats {
  [stageName: string]: { total: number; avgMs: number; errors: number };
}

interface Run {
  id: string;
  status: string;
  unit_id?: string;
  teacher_id?: string;
  total_time_ms?: number;
  total_cost?: { totalUSD?: number } | number;
  error_message?: string;
  created_at: string;
  stage_results?: Record<string, unknown>;
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function getCost(run: Run): string {
  if (!run.total_cost) return "-";
  if (typeof run.total_cost === "number") return `$${run.total_cost.toFixed(4)}`;
  return `$${(run.total_cost.totalUSD || 0).toFixed(4)}`;
}

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
  running: "bg-blue-100 text-blue-700",
  pending: "bg-gray-100 text-gray-600",
};

export default function RunHistory({ runs, stageStats }: { runs: Run[]; stageStats: StageStats }) {
  return (
    <div className="space-y-6">
      {/* Per-stage performance cards */}
      {Object.keys(stageStats).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.entries(stageStats).map(([name, stats]) => (
            <div key={name} className="bg-white rounded-lg border border-gray-100 shadow-sm p-3">
              <div className="text-xs text-gray-500 truncate">{name}</div>
              <div className="text-lg font-bold text-gray-900">{stats.total} runs</div>
              <div className="text-xs text-gray-400">
                avg {formatMs(stats.avgMs)} · {stats.errors} errors
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Runs table */}
      {runs.length === 0 ? (
        <div className="text-gray-400 text-sm py-8 text-center">No generation runs yet</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Status</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Time</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Cost</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Error</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Date</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[run.status] || "bg-gray-100 text-gray-600"}`}>
                      {run.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-600">{run.total_time_ms ? formatMs(run.total_time_ms) : "-"}</td>
                  <td className="px-4 py-2 text-gray-600">{getCost(run)}</td>
                  <td className="px-4 py-2 text-red-600 text-xs truncate max-w-[200px]">{run.error_message || "-"}</td>
                  <td className="px-4 py-2 text-gray-400 text-xs">{new Date(run.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
