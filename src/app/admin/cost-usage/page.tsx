"use client";

import { useEffect, useMemo, useState } from "react";

type Period = "today" | "7d" | "30d" | "all";
type AttributionType = "student" | "teacher" | "anonymous" | "lib";

interface EndpointRow {
  endpoint: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUSD: number;
  attributionType: AttributionType;
  topModel: string;
}

interface CostData {
  period: Period;
  totals: {
    calls: number;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUSD: number;
  };
  byEndpoint: EndpointRow[];
  byAttribution: Record<AttributionType, number>;
  truncated?: boolean;
}

const PERIOD_LABEL: Record<Period, string> = {
  today: "Today",
  "7d": "7 days",
  "30d": "30 days",
  all: "All time",
};

const ATTR_STYLE: Record<AttributionType, { bg: string; text: string; label: string }> = {
  student: { bg: "bg-blue-50", text: "text-blue-700", label: "student" },
  teacher: { bg: "bg-purple-50", text: "text-purple-700", label: "teacher" },
  anonymous: { bg: "bg-amber-50", text: "text-amber-800", label: "anonymous" },
  lib: { bg: "bg-gray-100", text: "text-gray-700", label: "lib" },
};

type SortKey = "calls" | "inputTokens" | "outputTokens" | "estimatedCostUSD";

export default function CostUsagePage() {
  const [data, setData] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("7d");
  const [sortKey, setSortKey] = useState<SortKey>("calls");

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/admin/cost-usage?period=${period}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [period]);

  const sortedRows = useMemo(() => {
    if (!data) return [];
    return [...data.byEndpoint].sort((a, b) => b[sortKey] - a[sortKey]);
  }, [data, sortKey]);

  const topEndpoint = data?.byEndpoint[0]?.endpoint ?? "—";
  const totalTokens = data ? data.totals.inputTokens + data.totals.outputTokens : 0;
  const attrTotal = data
    ? Object.values(data.byAttribution).reduce((s, n) => s + n, 0)
    : 0;

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Cost & Usage</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Spend by endpoint across all attribution types — students, teachers, anonymous free-tool
            users, and lib-internal calls (ingestion, pipeline). Source: <code className="text-[11px]">ai_usage_log</code>.
          </p>
        </div>
        <div className="flex gap-1 shrink-0">
          {(["today", "7d", "30d", "all"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                period === p
                  ? "bg-purple-100 text-purple-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="text-gray-400 text-sm text-center py-12">Loading cost data…</div>
      )}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          Error: {error}
        </div>
      )}

      {data && !loading && !error && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Total Calls" value={data.totals.calls.toLocaleString()} />
            <KpiCard label="Total Tokens" value={totalTokens.toLocaleString()} />
            <KpiCard
              label="Est Cost"
              value={`$${data.totals.estimatedCostUSD.toFixed(4)}`}
            />
            <KpiCard label="Top Endpoint" value={topEndpoint} mono />
          </div>

          {/* Attribution split */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Tokens by attribution
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(Object.keys(ATTR_STYLE) as AttributionType[]).map((a) => {
                const tokens = data.byAttribution[a] || 0;
                const pct = attrTotal > 0 ? Math.round((tokens / attrTotal) * 100) : 0;
                const style = ATTR_STYLE[a];
                return (
                  <div
                    key={a}
                    className={`rounded-lg border border-gray-200 px-4 py-3 ${style.bg}`}
                  >
                    <div className={`text-[10px] uppercase tracking-wider ${style.text}`}>
                      {style.label}
                    </div>
                    <div className="text-xl font-bold text-gray-900 mt-0.5">
                      {tokens.toLocaleString()}
                    </div>
                    <div className="text-[11px] text-gray-500">{pct}% of tokens</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Endpoint table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700">
                Endpoints ({data.byEndpoint.length})
              </h3>
              {data.truncated && (
                <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                  row cap reached — totals are partial
                </span>
              )}
            </div>
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-2 text-left">Endpoint</th>
                    <th className="px-4 py-2 text-left">Attribution</th>
                    <SortHeader k="calls" current={sortKey} setSort={setSortKey}>
                      Calls
                    </SortHeader>
                    <SortHeader k="inputTokens" current={sortKey} setSort={setSortKey}>
                      Input
                    </SortHeader>
                    <SortHeader k="outputTokens" current={sortKey} setSort={setSortKey}>
                      Output
                    </SortHeader>
                    <SortHeader k="estimatedCostUSD" current={sortKey} setSort={setSortKey}>
                      Est cost
                    </SortHeader>
                    <th className="px-4 py-2 text-left">Top model</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                        No usage data for this period yet.
                      </td>
                    </tr>
                  )}
                  {sortedRows.map((r) => {
                    const style = ATTR_STYLE[r.attributionType];
                    return (
                      <tr key={r.endpoint}>
                        <td className="px-4 py-2 font-mono text-xs text-gray-800">
                          {r.endpoint}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`inline-flex items-center text-[11px] px-2 py-0.5 rounded-full font-medium ${style.bg} ${style.text}`}
                          >
                            {style.label}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-gray-900">
                          {r.calls.toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-gray-700">
                          {r.inputTokens.toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-gray-700">
                          {r.outputTokens.toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-gray-900">
                          ${r.estimatedCostUSD.toFixed(4)}
                        </td>
                        <td className="px-4 py-2 font-mono text-[11px] text-gray-500">
                          {r.topModel}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="border border-gray-200 bg-white rounded-lg px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-gray-500">{label}</div>
      <div
        className={`mt-0.5 text-gray-900 font-bold ${mono ? "text-sm font-mono break-all" : "text-2xl"}`}
      >
        {value}
      </div>
    </div>
  );
}

function SortHeader({
  k,
  current,
  setSort,
  children,
}: {
  k: SortKey;
  current: SortKey;
  setSort: (k: SortKey) => void;
  children: React.ReactNode;
}) {
  const active = current === k;
  return (
    <th className="px-4 py-2 text-right">
      <button
        onClick={() => setSort(k)}
        className={`text-xs uppercase tracking-wider ${
          active ? "text-gray-900 font-semibold" : "text-gray-500 hover:text-gray-700"
        }`}
      >
        {children}
        {active && <span className="ml-1">↓</span>}
      </button>
    </th>
  );
}
