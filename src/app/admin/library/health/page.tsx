"use client";

import { useState, useEffect } from "react";
import type {
  SourceTypeCount,
  CategoryCount,
  StaleBlock,
  DuplicateSuspect,
  LowEfficacyBlock,
  OrphanBlock,
  EmbeddingHealth,
  CoverageCell,
} from "@/lib/admin/library-health-queries";

interface HealthData {
  sourceTypes: SourceTypeCount[];
  categories: CategoryCount[];
  staleBlocks: StaleBlock[];
  duplicates: DuplicateSuspect[];
  lowEfficacy: LowEfficacyBlock[];
  orphans: OrphanBlock[];
  embeddingHealth: EmbeddingHealth;
  coverage: CoverageCell[];
}

export default function LibraryHealthPage() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/library/health");
      if (!res.ok) throw new Error("Failed to fetch health data");
      const result: HealthData = await res.json();
      setData(result);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error("Error fetching library health data:", err);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getSourceTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      community: "bg-blue-500",
      curated: "bg-green-500",
      extracted: "bg-amber-500",
      teaching_move: "bg-purple-500",
      unknown: "bg-gray-400",
    };
    return colors[type] || colors.unknown;
  };

  const getEmbeddingGaugeColor = (): string => {
    if (!data?.embeddingHealth) return "bg-gray-100";
    const percent =
      (data.embeddingHealth.healthy / data.embeddingHealth.total) * 100;
    if (percent === 100) return "bg-green-100";
    if (percent >= 90) return "bg-amber-100";
    return "bg-red-100";
  };

  const getEmbeddingGaugeBorderColor = (): string => {
    if (!data?.embeddingHealth) return "border-gray-300";
    const percent =
      (data.embeddingHealth.healthy / data.embeddingHealth.total) * 100;
    if (percent === 100) return "border-green-300";
    if (percent >= 90) return "border-amber-300";
    return "border-red-300";
  };

  const getCoverageHeatmapColor = (count: number): string => {
    if (count < 3) return "bg-red-200";
    if (count <= 5) return "bg-amber-200";
    return "bg-green-200";
  };

  if (loading && !data) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-6">
        <h2 className="text-lg font-bold text-gray-900 mb-6">
          Library Health Dashboard
        </h2>
        <div className="text-gray-400 text-sm py-8 text-center">
          Loading library health metrics...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-gray-900">
          Library Health Dashboard
        </h2>
        <div className="flex items-center gap-3">
          {lastRefreshed && (
            <span className="text-xs text-gray-500">
              Last refreshed: {lastRefreshed.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchHealth}
            disabled={loading}
            className="px-3 py-1.5 bg-brand-purple text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {!data ? (
        <div className="text-gray-400 text-sm py-8 text-center">
          No health data available
        </div>
      ) : (
        <div className="space-y-6">
          {/* 1. Blocks by Source Type */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Blocks by Source Type
            </h3>
            {data.sourceTypes.length === 0 ? (
              <p className="text-sm text-gray-500">No blocks found</p>
            ) : (
              <div className="space-y-2">
                {data.sourceTypes.map((item) => {
                  const maxCount = Math.max(...data.sourceTypes.map((s) => s.count));
                  const width = (item.count / maxCount) * 100;
                  return (
                    <div key={item.source_type} className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-700 font-medium">
                          {item.source_type}
                        </span>
                        <span className="text-xs text-gray-500">
                          {item.count}
                        </span>
                      </div>
                      <div className="h-6 bg-gray-100 rounded overflow-hidden flex">
                        <div
                          className={`${getSourceTypeColor(item.source_type)} h-full transition-all`}
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. Category Distribution */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Category Distribution
            </h3>
            {data.categories.length === 0 ? (
              <p className="text-sm text-gray-500">No categories found</p>
            ) : (
              <div className="space-y-2">
                {data.categories.map((item) => {
                  const maxCount = Math.max(...data.categories.map((c) => c.count));
                  const width = (item.count / maxCount) * 100;
                  return (
                    <div key={item.activity_category} className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-700 font-medium">
                          {item.activity_category}
                        </span>
                        <span className="text-xs text-gray-500">
                          {item.count}
                        </span>
                      </div>
                      <div className="h-6 bg-gray-100 rounded overflow-hidden">
                        <div
                          className="bg-cyan-500 h-full transition-all"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. Stale Blocks */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Stale Blocks (90+ days unused)
            </h3>
            {data.staleBlocks.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">
                No stale blocks detected
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 font-medium text-gray-700">
                        Title
                      </th>
                      <th className="text-left py-2 px-3 font-medium text-gray-700">
                        Last Used
                      </th>
                      <th className="text-left py-2 px-3 font-medium text-gray-700">
                        Times Used
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.staleBlocks.map((block) => (
                      <tr
                        key={block.id}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="py-2 px-3 text-gray-900 truncate">
                          {block.title}
                        </td>
                        <td className="py-2 px-3 text-gray-600">
                          {formatDate(block.last_used_at)}
                        </td>
                        <td className="py-2 px-3 text-gray-600">
                          {block.times_used}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 4. Duplicate Suspects */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Duplicate Suspects
            </h3>
            {data.duplicates.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">
                No duplicates detected
              </p>
            ) : (
              <div className="space-y-3">
                {data.duplicates.map((dup) => (
                  <div
                    key={`${dup.block_a_id}-${dup.block_b_id}`}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 font-medium truncate">
                        {dup.title_a}
                      </p>
                      <p className="text-xs text-gray-500">
                        ID: {dup.block_a_id}
                      </p>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        className="text-gray-400"
                      >
                        <path
                          d="M5 8h6M10 6l2 2-2 2"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                        {(dup.similarity * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="flex-1 min-w-0 text-right">
                      <p className="text-sm text-gray-700 font-medium truncate">
                        {dup.title_b}
                      </p>
                      <p className="text-xs text-gray-500">
                        ID: {dup.block_b_id}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 5. Low Efficacy Blocks */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Low Efficacy Blocks (Below 40)
            </h3>
            {data.lowEfficacy.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">
                No low efficacy blocks found
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 font-medium text-gray-700">
                        Title
                      </th>
                      <th className="text-left py-2 px-3 font-medium text-gray-700">
                        Efficacy
                      </th>
                      <th className="text-left py-2 px-3 font-medium text-gray-700">
                        Times Used
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.lowEfficacy.map((block) => (
                      <tr
                        key={block.id}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="py-2 px-3 text-gray-900 truncate">
                          {block.title}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                              block.efficacy_score < 20
                                ? "bg-red-100 text-red-700"
                                : "bg-orange-100 text-orange-700"
                            }`}
                          >
                            {block.efficacy_score}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-gray-600">
                          {block.times_used}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 6. Orphan Blocks */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Orphan Blocks (Missing Required Fields)
            </h3>
            {data.orphans.length === 0 ? (
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    className="text-green-600"
                  >
                    <path
                      d="M13 4l-7.5 8L3 8"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <p className="text-sm text-green-700 font-medium">
                  All blocks are healthy (0 orphans)
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.orphans.map((block) => (
                  <div
                    key={block.id}
                    className="p-3 bg-red-50 rounded-lg border border-red-200"
                  >
                    <p className="text-sm font-medium text-gray-900">
                      {block.title}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {block.missing_fields.map((field) => (
                        <span
                          key={field}
                          className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded"
                        >
                          Missing: {field}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 7. Embedding Health */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Embedding Health
            </h3>
            <div className={`${getEmbeddingGaugeColor()} ${getEmbeddingGaugeBorderColor()} border-2 rounded-lg p-6 text-center`}>
              <div className="text-3xl font-bold text-gray-900 mb-2">
                {data.embeddingHealth.healthy} / {data.embeddingHealth.total}
              </div>
              <p className="text-sm text-gray-700 mb-3">blocks have embeddings</p>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    (data.embeddingHealth.healthy / data.embeddingHealth.total) === 1
                      ? "bg-green-500"
                      : (data.embeddingHealth.healthy / data.embeddingHealth.total) >= 0.9
                      ? "bg-amber-500"
                      : "bg-red-500"
                  }`}
                  style={{
                    width: `${(data.embeddingHealth.healthy / data.embeddingHealth.total) * 100}%`,
                  }}
                />
              </div>
              <p className="text-xs text-gray-600 mt-3">
                {(
                  (data.embeddingHealth.healthy /
                    data.embeddingHealth.total) *
                  100
                ).toFixed(1)}
                % coverage
              </p>
            </div>
          </div>

          {/* 8. Coverage Heatmap */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Coverage Heatmap (Phase × Category)
            </h3>
            {data.coverage.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">No coverage data</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr>
                      <th className="border border-gray-300 bg-gray-50 p-2 text-left font-semibold text-gray-700">
                        Phase
                      </th>
                      {Array.from(
                        new Set(data.coverage.map((c) => c.activity_category))
                      )
                        .sort()
                        .map((cat) => (
                          <th
                            key={cat}
                            className="border border-gray-300 bg-gray-50 p-2 text-center font-semibold text-gray-700 min-w-20"
                          >
                            {cat}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(new Set(data.coverage.map((c) => c.phase)))
                      .sort()
                      .map((phase) => (
                        <tr key={phase}>
                          <td className="border border-gray-300 bg-gray-50 p-2 font-medium text-gray-700">
                            {phase}
                          </td>
                          {Array.from(
                            new Set(data.coverage.map((c) => c.activity_category))
                          )
                            .sort()
                            .map((cat) => {
                              const cell = data.coverage.find(
                                (c) => c.phase === phase && c.activity_category === cat
                              );
                              const count = cell?.count ?? 0;
                              return (
                                <td
                                  key={`${phase}-${cat}`}
                                  className={`border border-gray-300 p-2 text-center font-medium ${getCoverageHeatmapColor(count)}`}
                                >
                                  {count > 0 ? count : "—"}
                                </td>
                              );
                            })}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-4 flex gap-6 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-200 border border-red-300 rounded" />
                <span className="text-gray-700">Low (&lt;3)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-amber-200 border border-amber-300 rounded" />
                <span className="text-gray-700">Medium (3–5)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-200 border border-green-300 rounded" />
                <span className="text-gray-700">High (&gt;5)</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
