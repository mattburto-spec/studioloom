"use client";

/**
 * /admin/generation-sandbox — Phase 7C-2 (Dimensions3 Completion Spec §7.2)
 *
 * Real generation pipeline sandbox with step-through debugging.
 * Distinct from the Simulator (offline fixtures) and Ingestion Sandbox.
 *
 * Features:
 * - GenerationRequest form (same shape as wizard)
 * - Calls runPipeline() via POST /api/admin/generation-sandbox/run
 * - Per-stage view: output JSON, cost, duration, token counts
 * - History of past sandbox runs
 * - Download run as JSON
 */

import { useState, useEffect } from "react";

interface StageResult {
  output?: unknown;
  cost?: { inputTokens?: number; outputTokens?: number; totalUSD?: number };
  timeMs?: number;
}

interface RunResult {
  runId: string | null;
  stageTimings: Record<string, number>;
  qualityReport: unknown;
  costSummary: unknown;
  timedUnit: unknown;
}

interface PastRun {
  id: string;
  status: string;
  format_id: string;
  framework: string;
  total_time_ms: number | null;
  total_cost: unknown;
  stage_results: Record<string, StageResult>;
  quality_report: unknown;
  created_at: string;
  request: unknown;
  is_sandbox: boolean;
  sandbox_mode: boolean;
}

const STAGE_LABELS = [
  { id: 0, label: "Input Validation", icon: "✓" },
  { id: 1, label: "Block Retrieval", icon: "🔍" },
  { id: 2, label: "Sequence Assembly", icon: "📋" },
  { id: 3, label: "Gap Fill (AI)", icon: "🤖" },
  { id: 4, label: "Polish", icon: "✨" },
  { id: 5, label: "Timing", icon: "⏱" },
  { id: 6, label: "Quality Score", icon: "📊" },
];

const UNIT_TYPES = ["design", "service", "personal_project", "inquiry"];
const FRAMEWORKS = ["IB_MYP", "GCSE_DT", "A_LEVEL_DT", "IGCSE_DT", "ACARA_DT", "PLTW"];

export default function GenerationSandboxPage() {
  // Form state
  const [topic, setTopic] = useState("Sustainable Packaging Design");
  const [unitType, setUnitType] = useState("design");
  const [lessonCount, setLessonCount] = useState(6);
  const [gradeLevel, setGradeLevel] = useState("year-9");
  const [framework, setFramework] = useState("IB_MYP");
  const [periodMinutes, setPeriodMinutes] = useState(60);
  const [useSimulator, setUseSimulator] = useState(true);

  // Run state
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeStage, setActiveStage] = useState<number>(0);

  // History
  const [history, setHistory] = useState<PastRun[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [viewingRun, setViewingRun] = useState<PastRun | null>(null);

  // Load sandbox run history
  useEffect(() => {
    fetch("/api/admin/pipeline/health")
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => {
        // Filter to sandbox runs if available
        if (data.recentRuns) {
          setHistory(data.recentRuns.filter((r: PastRun) => r.is_sandbox || r.sandbox_mode));
        }
      })
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, []);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    setViewingRun(null);

    try {
      const res = await fetch("/api/admin/generation-sandbox/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationRequest: {
            topic,
            unitType,
            lessonCount,
            gradeLevel,
            framework,
            constraints: {
              availableResources: [],
              periodMinutes,
              workshopAccess: true,
              softwareAvailable: [],
            },
          },
          sandboxMode: useSimulator,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setResult(data);
      setActiveStage(6); // Show final stage
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pipeline failed");
    } finally {
      setRunning(false);
    }
  };

  const downloadJson = () => {
    const data = viewingRun || result;
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sandbox-run-${viewingRun?.id || result?.runId || "unknown"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const viewRun = async (runId: string) => {
    try {
      const res = await fetch(`/api/admin/generation-sandbox/${runId}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setViewingRun(data.run);
      setResult(null);
      setActiveStage(0);
    } catch {
      setError("Failed to load run details");
    }
  };

  // Compute what to display in the stage panel
  const stageData = viewingRun?.stage_results || null;
  const qualityData = viewingRun?.quality_report || result?.qualityReport || null;
  const timingsData = viewingRun
    ? Object.fromEntries(
        Object.entries(viewingRun.stage_results || {}).map(([k, v]) => [k, v.timeMs || 0])
      )
    : result?.stageTimings || null;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Generation Sandbox</h2>
        <p className="text-sm text-gray-500">
          Run the real generation pipeline with step-through debugging
        </p>
      </div>

      {/* Mode toggle */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-amber-800">
            {useSimulator ? "Simulator mode" : "Live AI mode"}
          </p>
          <p className="text-xs text-amber-700 mt-0.5">
            {useSimulator
              ? "Uses fixture data — zero AI calls, zero cost"
              : "Calls real AI models — incurs API costs"}
          </p>
        </div>
        <button
          onClick={() => setUseSimulator(!useSimulator)}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
            useSimulator
              ? "bg-amber-200 text-amber-800"
              : "bg-red-100 text-red-700"
          }`}
        >
          {useSimulator ? "Switch to Live" : "Switch to Simulator"}
        </button>
      </div>

      {/* Request form */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Generation Request</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-500 uppercase">Topic</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full mt-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500/30"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase">Unit Type</label>
            <select
              value={unitType}
              onChange={(e) => setUnitType(e.target.value)}
              className="w-full mt-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
            >
              {UNIT_TYPES.map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase">Framework</label>
            <select
              value={framework}
              onChange={(e) => setFramework(e.target.value)}
              className="w-full mt-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
            >
              {FRAMEWORKS.map((f) => (
                <option key={f} value={f}>{f.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase">Lessons</label>
            <input
              type="number"
              value={lessonCount}
              min={1}
              max={20}
              onChange={(e) => setLessonCount(parseInt(e.target.value) || 6)}
              className="w-full mt-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase">Period (min)</label>
            <input
              type="number"
              value={periodMinutes}
              min={30}
              max={120}
              onChange={(e) => setPeriodMinutes(parseInt(e.target.value) || 60)}
              className="w-full mt-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleRun}
            disabled={running || !topic.trim()}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg transition disabled:opacity-50"
            style={{ background: running ? "#9CA3AF" : "#7B2FF2" }}
          >
            {running ? "Running pipeline..." : "Run Pipeline"}
          </button>
          {(result || viewingRun) && (
            <button
              onClick={downloadJson}
              className="px-3 py-2 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
            >
              Download JSON
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Stage bar */}
      {(result || viewingRun) && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {STAGE_LABELS.map((stage) => {
              const timing = timingsData?.[String(stage.id)] || timingsData?.[`stage${stage.id}`];
              const isActive = activeStage === stage.id;
              return (
                <button
                  key={stage.id}
                  onClick={() => setActiveStage(stage.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                    isActive
                      ? "bg-purple-100 text-purple-700"
                      : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <span>{stage.icon}</span>
                  <span>{stage.label}</span>
                  {timing != null && (
                    <span className="text-[10px] opacity-60">
                      {typeof timing === "number" ? `${timing}ms` : ""}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Stage detail panel */}
      {(result || viewingRun) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: stage output */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">
              {STAGE_LABELS[activeStage]?.label || "Output"} — Stage {activeStage}
            </h3>
            <div className="bg-gray-50 rounded-lg p-3 overflow-auto max-h-96">
              <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                {activeStage === 6
                  ? JSON.stringify(qualityData, null, 2)
                  : stageData
                    ? JSON.stringify(stageData[String(activeStage)]?.output ?? stageData[String(activeStage)] ?? "No data for this stage", null, 2)
                    : result
                      ? activeStage <= 5
                        ? `Stage ${activeStage} completed in ${timingsData?.[String(activeStage)] || "?"}ms`
                        : JSON.stringify(result.qualityReport, null, 2)
                      : "No data"}
              </pre>
            </div>
          </div>

          {/* Right: quality report / cost summary */}
          <div className="space-y-4">
            {/* Cost summary */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Cost Summary</h3>
              <pre className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 overflow-auto max-h-40">
                {JSON.stringify(viewingRun?.total_cost || result?.costSummary || {}, null, 2)}
              </pre>
            </div>

            {/* Stage timings */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Stage Timings</h3>
              <div className="space-y-1">
                {STAGE_LABELS.map((stage) => {
                  const ms = timingsData?.[String(stage.id)] || timingsData?.[`stage${stage.id}`] || 0;
                  const msNum = typeof ms === "number" ? ms : 0;
                  const maxMs = Math.max(
                    ...Object.values(timingsData || {}).map((v) => (typeof v === "number" ? v : 0)),
                    1
                  );
                  return (
                    <div key={stage.id} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-28 truncate">{stage.label}</span>
                      <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(msNum / maxMs) * 100}%`,
                            background: stage.id === 3 ? "#F59E0B" : "#7B2FF2",
                          }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-16 text-right">{msNum}ms</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quality report summary */}
            {qualityData && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Quality Report</h3>
                <pre className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 overflow-auto max-h-40">
                  {JSON.stringify(qualityData, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Past sandbox runs */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Recent Sandbox Runs</h3>
        {loadingHistory ? (
          <p className="text-xs text-gray-400">Loading...</p>
        ) : history.length === 0 ? (
          <p className="text-xs text-gray-400">No sandbox runs yet</p>
        ) : (
          <div className="space-y-2">
            {history.map((run) => (
              <button
                key={run.id}
                onClick={() => viewRun(run.id)}
                className={`w-full text-left px-3 py-2 rounded-lg border transition ${
                  viewingRun?.id === run.id
                    ? "border-purple-300 bg-purple-50"
                    : "border-gray-100 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      run.status === "completed"
                        ? "bg-green-100 text-green-700"
                        : run.status === "failed"
                          ? "bg-red-100 text-red-700"
                          : "bg-gray-100 text-gray-600"
                    }`}>
                      {run.status}
                    </span>
                    <span className="text-xs text-gray-600">
                      {run.format_id} / {run.framework}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(run.created_at).toLocaleString()}
                  </span>
                </div>
                {run.total_time_ms && (
                  <p className="text-[10px] text-gray-400 mt-0.5">{run.total_time_ms}ms total</p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
