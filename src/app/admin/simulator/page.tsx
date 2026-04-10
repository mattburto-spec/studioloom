"use client";

import { useState } from "react";
import type { GenerationRequest, QualityReport } from "@/types/activity-blocks";
import { runSimulatedPipeline, type PipelineResult } from "@/lib/pipeline/pipeline";

const STAGE_LABELS = [
  "Stage 0: Input",
  "Stage 1: Retrieve",
  "Stage 2: Assemble",
  "Stage 3: Gap-Fill",
  "Stage 4: Polish",
  "Stage 5: Timing",
  "Stage 6: Score",
];

const DEFAULT_REQUEST: GenerationRequest = {
  topic: "Sustainable Packaging Design",
  unitType: "design",
  lessonCount: 6,
  gradeLevel: "year-9",
  framework: "IB_MYP",
  constraints: {
    availableResources: ["cardboard", "recycled materials"],
    periodMinutes: 60,
    workshopAccess: true,
    softwareAvailable: [],
  },
};

export default function SimulatorPage() {
  const [request, setRequest] = useState<GenerationRequest>(DEFAULT_REQUEST);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [activeStage, setActiveStage] = useState<number | null>(null);
  const [running, setRunning] = useState(false);

  function runPipeline() {
    setRunning(true);
    setResult(null);
    setActiveStage(null);

    // Simulate stage-by-stage progression
    setTimeout(() => {
      const res = runSimulatedPipeline(request);
      setResult(res);
      setActiveStage(6);
      setRunning(false);
    }, 300);
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Fixture-data banner (Phase 0.3, 10 Apr 2026) */}
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
        <p className="text-sm text-yellow-800">
          This simulator uses hardcoded fixture data. It does not generate real units.
        </p>
      </div>
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pipeline Simulator (offline)</h1>
        <p className="text-sm text-gray-500 mt-1">
          Offline fixture-based simulator. Validates pipeline wiring. Zero AI calls. For live
          generation debugging, use Generation Sandbox (built in Phase 7).
        </p>
      </div>

      {/* Top bar: controls */}
      <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex-1 grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase">Topic</label>
            <input
              type="text"
              value={request.topic}
              onChange={(e) => setRequest({ ...request, topic: e.target.value })}
              className="w-full mt-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase">Unit Type</label>
            <select
              value={request.unitType}
              onChange={(e) => setRequest({ ...request, unitType: e.target.value })}
              className="w-full mt-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="design">Design</option>
              <option value="service">Service</option>
              <option value="personal_project">Personal Project</option>
              <option value="inquiry">Inquiry</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase">Lessons</label>
            <input
              type="number"
              value={request.lessonCount}
              min={1}
              max={20}
              onChange={(e) => setRequest({ ...request, lessonCount: parseInt(e.target.value) || 6 })}
              className="w-full mt-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>
        <button
          onClick={runPipeline}
          disabled={running}
          className="px-6 py-2.5 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
        >
          {running ? "Running..." : "Run Pipeline"}
        </button>
      </div>

      {/* Stage pipeline visualization */}
      <div className="flex items-center gap-1 p-3 bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        {STAGE_LABELS.map((label, i) => (
          <button
            key={i}
            onClick={() => result && setActiveStage(i)}
            className={`flex-1 min-w-[120px] px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              activeStage === i
                ? "bg-purple-600 text-white"
                : result && i <= (activeStage ?? -1)
                  ? "bg-purple-100 text-purple-700 hover:bg-purple-200"
                  : running && i === 0
                    ? "bg-amber-100 text-amber-700 animate-pulse"
                    : "bg-gray-50 text-gray-400"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Main content: two panels */}
      <div className="grid grid-cols-2 gap-6">
        {/* Left: Stage output */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm min-h-[400px] overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-700">
              {activeStage !== null ? STAGE_LABELS[activeStage] : "Stage Output"}
            </h2>
          </div>
          <div className="p-4 max-h-[600px] overflow-y-auto">
            {!result && !running && (
              <p className="text-gray-400 text-sm">Run the pipeline to see stage outputs.</p>
            )}
            {running && (
              <div className="flex items-center gap-2 text-amber-600 text-sm">
                <div className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                Running simulated pipeline...
              </div>
            )}
            {result && activeStage !== null && (
              <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
                {activeStage === 6
                  ? JSON.stringify(result.qualityReport, null, 2)
                  : JSON.stringify(
                      result.timedUnit.lessons.slice(0, 3).map((l) => ({
                        position: l.position,
                        label: l.label,
                        totalMinutes: l.totalMinutes,
                        activityCount: l.activities.length,
                        activities: l.activities.map((a) => ({
                          title: a.title,
                          source: a.source,
                          bloom: a.bloom_level,
                          phase: a.phase,
                          category: a.activity_category,
                        })),
                      })),
                      null,
                      2
                    )}
              </pre>
            )}
          </div>
        </div>

        {/* Right: Quality report / metrics */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm min-h-[400px] overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-700">Quality Report</h2>
          </div>
          <div className="p-4">
            {!result ? (
              <p className="text-gray-400 text-sm">Quality report will appear after pipeline runs.</p>
            ) : (
              <div className="space-y-4">
                {/* Overall score */}
                <div className="text-center">
                  <div className="text-4xl font-bold text-purple-600">{result.qualityReport.overallScore}</div>
                  <div className="text-xs text-gray-500 mt-1">Overall Score (0-10)</div>
                </div>

                {/* Dimension scores */}
                <div className="space-y-2">
                  {(["cognitiveRigour", "studentAgency", "teacherCraft", "variety", "coherence"] as const).map((dim) => {
                    const score = result.qualityReport.dimensions[dim];
                    return (
                      <div key={dim} className="flex items-center gap-3">
                        <span className="text-xs text-gray-600 w-32 capitalize">
                          {dim.replace(/([A-Z])/g, " $1").trim()}
                        </span>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${(score.score / 10) * 100}%`,
                              backgroundColor: score.score >= 7 ? "#10B981" : score.score >= 4 ? "#F59E0B" : "#EF4444",
                            }}
                          />
                        </div>
                        <span className="text-xs font-mono w-8 text-right">{score.score}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Library metrics */}
                <div className="pt-3 border-t border-gray-100">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Library Metrics</h3>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-lg font-bold text-gray-800">
                        {Math.round(result.qualityReport.libraryMetrics.blockReuseRate * 100)}%
                      </div>
                      <div className="text-[10px] text-gray-500">Reuse Rate</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-gray-800">
                        {result.qualityReport.libraryMetrics.newBlocksGenerated}
                      </div>
                      <div className="text-[10px] text-gray-500">Generated</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-green-600">$0.00</div>
                      <div className="text-[10px] text-gray-500">Cost</div>
                    </div>
                  </div>
                </div>

                {/* Recommendations */}
                {result.qualityReport.recommendations.length > 0 && (
                  <div className="pt-3 border-t border-gray-100">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Recommendations</h3>
                    <ul className="space-y-1">
                      {result.qualityReport.recommendations.map((rec, i) => (
                        <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                          <span className="text-amber-500 mt-0.5">!</span>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Stage timings */}
                <div className="pt-3 border-t border-gray-100">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Stage Timings (ms)</h3>
                  <div className="grid grid-cols-7 gap-1">
                    {Object.entries(result.stageTimings).map(([stage, ms]) => (
                      <div key={stage} className="text-center">
                        <div className="text-xs font-mono text-gray-700">{ms}</div>
                        <div className="text-[9px] text-gray-400">S{stage.replace("stage", "")}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
