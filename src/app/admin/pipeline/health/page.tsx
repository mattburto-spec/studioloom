"use client";

import { useState, useEffect } from "react";

interface Summary {
  totalRuns: number;
  completed: number;
  failed: number;
  running: number;
  successRate: number;
  avgTimeMs: number;
  p95TimeMs: number;
  avgCost: number;
}

interface CostPeriods {
  dayUsd: number;
  weekUsd: number;
  monthUsd: number;
}

interface Alert {
  id: string;
  alert_type: string;
  severity: string;
  payload: Record<string, any>;
  acknowledged: boolean;
  created_at: string;
}

interface FailedRun {
  id: string;
  stage: number;
  error: string | null;
  created_at: string;
}

interface HealthData {
  summary: Summary;
  costPeriods: CostPeriods;
  stageFailures: Record<number, number>;
  alerts: Alert[];
  qualityAlerts: Array<{ payload: Record<string, any>; created_at: string }>;
  failedRuns: FailedRun[];
  latestCostAlert: Alert | null;
}

const STAGE_NAMES = ["Retrieve", "Assemble", "Gap-Fill", "Polish", "Timing", "Scoring", "Delivery"];

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function SuccessRateGauge({ rate }: { rate: number }) {
  let color = "text-red-600";
  let bgColor = "bg-red-100";
  if (rate >= 0.95) {
    color = "text-emerald-600";
    bgColor = "bg-emerald-100";
  } else if (rate >= 0.8) {
    color = "text-amber-600";
    bgColor = "bg-amber-100";
  }

  const percentage = Math.round(rate * 100);
  return (
    <div>
      <div className={`text-2xl font-bold ${color}`}>{percentage}%</div>
      <div className={`w-full h-2 ${bgColor} rounded-full mt-2 overflow-hidden`}>
        <div className={`h-full ${color.replace("text-", "bg-")} rounded-full`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

function StageFailureHeatmap({ failures }: { failures: Record<number, number> }) {
  return (
    <div className="grid grid-cols-7 gap-2">
      {STAGE_NAMES.map((name, stage) => {
        const count = failures[stage] || 0;
        let bgColor = "bg-gray-100";
        if (count >= 3) bgColor = "bg-red-200";
        else if (count >= 1) bgColor = "bg-amber-200";

        return (
          <div key={stage} className={`${bgColor} rounded-lg p-3 text-center`}>
            <div className="text-lg font-bold text-gray-900">{count}</div>
            <div className="text-xs text-gray-600 mt-1">{name}</div>
          </div>
        );
      })}
    </div>
  );
}

function CostAlertStrip({ alert }: { alert: Alert | null }) {
  if (!alert) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
        <div className="text-sm font-semibold text-emerald-700">No cost alerts</div>
      </div>
    );
  }

  let bgColor = "bg-amber-50";
  let borderColor = "border-amber-200";
  let textColor = "text-amber-700";

  if (alert.severity === "critical") {
    bgColor = "bg-red-50";
    borderColor = "border-red-200";
    textColor = "text-red-700";
  } else if (alert.severity === "info") {
    bgColor = "bg-blue-50";
    borderColor = "border-blue-200";
    textColor = "text-blue-700";
  }

  return (
    <div className={`${bgColor} border ${borderColor} rounded-lg p-4`}>
      <div className={`text-sm font-semibold ${textColor}`}>{alert.alert_type}</div>
      <div className={`text-xs ${textColor} mt-1`}>{formatTime(alert.created_at)}</div>
      {alert.payload && (
        <div className={`text-xs ${textColor} mt-2 opacity-75`}>
          {typeof alert.payload === "object" ? JSON.stringify(alert.payload).slice(0, 100) : String(alert.payload)}
        </div>
      )}
    </div>
  );
}

function ErrorLog({ runs }: { runs: FailedRun[] }) {
  if (runs.length === 0) {
    return (
      <div className="text-gray-400 text-sm py-8 text-center">No failed runs in last 24h</div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left py-2 px-3 font-semibold text-gray-700">Time</th>
            <th className="text-left py-2 px-3 font-semibold text-gray-700">Stage</th>
            <th className="text-left py-2 px-3 font-semibold text-gray-700">Error</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="py-2 px-3 text-gray-600">{formatTime(run.created_at)}</td>
              <td className="py-2 px-3 text-gray-600">{STAGE_NAMES[run.stage] || `Stage ${run.stage}`}</td>
              <td className="py-2 px-3 text-gray-600 truncate">{run.error || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QualityDriftIndicator({ alerts }: { alerts: Array<{ payload: Record<string, any>; created_at: string }> }) {
  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <div className="text-lg font-bold text-gray-600">—</div>
        <div className="text-sm text-gray-500">No quality alerts</div>
      </div>
    );
  }

  const latest = alerts[0];
  const trend = latest.payload?.trend || "flat";

  let icon = "→";
  let color = "text-gray-600";
  if (trend === "up") {
    icon = "↑";
    color = "text-emerald-600";
  } else if (trend === "down") {
    icon = "↓";
    color = "text-red-600";
  }

  return (
    <div className="flex items-center gap-2">
      <div className={`text-2xl font-bold ${color}`}>{icon}</div>
      <div className="text-sm text-gray-700">{trend.charAt(0).toUpperCase() + trend.slice(1)}</div>
      <div className="text-xs text-gray-500">{formatTime(latest.created_at)}</div>
    </div>
  );
}

function RecentAlerts({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) {
    return (
      <div className="text-gray-400 text-sm py-4 text-center">No recent alerts</div>
    );
  }

  return (
    <div className="space-y-2 max-h-72 overflow-y-auto">
      {alerts.map((alert) => {
        let badge = "bg-blue-100 text-blue-700";
        if (alert.severity === "critical") {
          badge = "bg-red-100 text-red-700";
        } else if (alert.severity === "warning") {
          badge = "bg-amber-100 text-amber-700";
        }

        return (
          <div key={alert.id} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${badge}`}>
                    {alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1)}
                  </span>
                  <span className="text-xs text-gray-500">{formatTime(alert.created_at)}</span>
                </div>
                <div className="text-sm text-gray-700 font-medium mt-1">{alert.alert_type}</div>
                {alert.payload && (
                  <div className="text-xs text-gray-600 mt-1 line-clamp-2">
                    {typeof alert.payload === "object" ? JSON.stringify(alert.payload).slice(0, 80) : String(alert.payload)}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function PipelineHealthPage() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch("/api/admin/pipeline/health")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((err) => {
        console.error("[pipeline/health] fetch error:", err);
        setError(err.message || "Failed to load pipeline health");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="text-gray-400 text-sm py-8 text-center">Loading pipeline health...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-sm text-red-700">Error: {error || "Unable to load data"}</div>
        </div>
      </div>
    );
  }

  const { summary, costPeriods, stageFailures, alerts, qualityAlerts, failedRuns, latestCostAlert } = data;

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      <h2 className="text-lg font-bold text-gray-900 mb-6">Pipeline Health Dashboard</h2>

      {/* 1. 24h Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider">Total Runs</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{summary.totalRuns}</div>
          <div className="text-xs text-gray-400 mt-2">
            {summary.completed} completed, {summary.failed} failed
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider">Success Rate</div>
          <div className="mt-1">
            <SuccessRateGauge rate={summary.successRate} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider">Avg Time</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{formatMs(summary.avgTimeMs)}</div>
          <div className="text-xs text-gray-400 mt-2">p95: {formatMs(summary.p95TimeMs)}</div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider">Avg Cost</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">${summary.avgCost.toFixed(4)}</div>
          <div className="text-xs text-gray-400 mt-2">per run</div>
        </div>
      </div>

      {/* Cost Periods */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider">24h Spend</div>
          <div className="text-xl font-bold text-gray-900 mt-1">${costPeriods.dayUsd.toFixed(2)}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider">7d Spend</div>
          <div className="text-xl font-bold text-gray-900 mt-1">${costPeriods.weekUsd.toFixed(2)}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider">30d Spend</div>
          <div className="text-xl font-bold text-gray-900 mt-1">${costPeriods.monthUsd.toFixed(2)}</div>
        </div>
      </div>

      {/* 2. Stage Failure Heatmap */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Stage Failure Breakdown (24h)</h3>
        <StageFailureHeatmap failures={stageFailures} />
        <div className="text-xs text-gray-500 mt-3">
          Red: 3+ failures · Amber: 1-2 · Grey: 0
        </div>
      </div>

      {/* 3. Cost Alert Strip */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Cost Alert</h3>
        <CostAlertStrip alert={latestCostAlert} />
      </div>

      {/* 4. Error Log */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Error Log (Last 20 Failures)</h3>
        <ErrorLog runs={failedRuns} />
      </div>

      {/* 5. Quality Drift */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Quality Drift</h3>
        <QualityDriftIndicator alerts={qualityAlerts} />
      </div>

      {/* 6. Recent Alerts */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent System Alerts (Last 20)</h3>
        <RecentAlerts alerts={alerts} />
      </div>
    </div>
  );
}
