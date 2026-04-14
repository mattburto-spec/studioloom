"use client";

import { useState, useEffect, useCallback } from "react";

interface WiringTest {
  id: number;
  name: string;
  description: string;
  lastRun: string | null;
  status: "pass" | "fail" | "unknown";
  durationMs: number | null;
  error: string | null;
}

const FLOW_TESTS: Array<{ name: string; description: string }> = [
  { name: "Ingestion → Library", description: "Upload test doc, verify blocks created" },
  { name: "Library → Generation", description: "Generate test unit, verify blocks retrieved" },
  { name: "Generation → Delivery", description: "Open generated unit in student view, verify content renders" },
  { name: "Delivery → Tracking", description: "Student interaction, verify tracking data saved" },
  { name: "Tracking → Feedback", description: "Edit a block in editor, verify efficacy updated" },
  { name: "Feedback → Library", description: "Check block with edits, verify efficacy reflects changes" },
];

export default function WiringPage() {
  const [tests, setTests] = useState<WiringTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<number | null>(null);

  const loadResults = useCallback(() => {
    fetch("/api/admin/smoke-tests")
      .then((r) => r.json())
      .then((data) => {
        const results = data.results || [];
        setTests(
          FLOW_TESTS.map((ft, i) => {
            const match = results.find((r: { test_name?: string }) =>
              r.test_name?.toLowerCase().includes(ft.name.split(" → ")[0].toLowerCase())
            );
            return {
              id: i,
              name: ft.name,
              description: ft.description,
              lastRun: match?.created_at || null,
              status: match?.passed ? "pass" : match ? "fail" : "unknown",
              durationMs: match?.duration_ms || null,
              error: match?.error || null,
            };
          })
        );
      })
      .catch(() => {
        setTests(FLOW_TESTS.map((ft, i) => ({
          id: i, name: ft.name, description: ft.description,
          lastRun: null, status: "unknown", durationMs: null, error: null,
        })));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadResults(); }, [loadResults]);

  const runTest = async (testId: number) => {
    setRunning(testId);
    try {
      await fetch("/api/admin/smoke-tests", { method: "POST" });
      await loadResults();
    } finally {
      setRunning(null);
    }
  };

  if (loading) return <div className="max-w-7xl mx-auto px-6 py-8"><p className="text-sm text-gray-500">Loading wiring status...</p></div>;

  const passCount = tests.filter((t) => t.status === "pass").length;
  const failCount = tests.filter((t) => t.status === "fail").length;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Wiring</h2>
          <p className="text-sm text-gray-500">6 E2E flow tests — system integration health</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm">
            <span className="text-green-600 font-medium">{passCount} pass</span>
            {failCount > 0 && <span className="text-red-600 font-medium ml-2">{failCount} fail</span>}
          </span>
          <button
            onClick={() => runTest(-1)}
            disabled={running !== null}
            className="px-3 py-1.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 disabled:opacity-50 transition"
          >
            {running !== null ? "Running..." : "Run All"}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {tests.map((test) => (
          <div key={test.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${
                test.status === "pass" ? "bg-green-500" :
                test.status === "fail" ? "bg-red-500" :
                "bg-gray-300"
              }`} />
              <div>
                <p className="text-sm font-medium text-gray-900">{test.name}</p>
                <p className="text-xs text-gray-500">{test.description}</p>
                {test.error && <p className="text-xs text-red-500 mt-1">{test.error}</p>}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {test.lastRun && (
                <span className="text-xs text-gray-400">
                  {new Date(test.lastRun).toLocaleString()}
                  {test.durationMs && ` (${test.durationMs}ms)`}
                </span>
              )}
              <button
                onClick={() => runTest(test.id)}
                disabled={running !== null}
                className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 disabled:opacity-50 transition"
              >
                Run
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Flow Diagram */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Flow Diagram</h3>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {["Ingestion", "Library", "Generation", "Delivery", "Tracking", "Feedback"].map((stage, i) => (
            <div key={stage} className="flex items-center gap-2">
              <div className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                tests[i]?.status === "pass" ? "bg-green-100 text-green-700" :
                tests[i]?.status === "fail" ? "bg-red-100 text-red-700" :
                "bg-gray-100 text-gray-600"
              }`}>
                {stage}
              </div>
              {i < 5 && (
                <span className={`text-sm ${
                  tests[i]?.status === "pass" ? "text-green-400" :
                  tests[i]?.status === "fail" ? "text-red-400" :
                  "text-gray-300"
                }`}>→</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
