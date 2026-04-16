"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import MatchReport from "@/components/teacher/library/MatchReport";

interface ImportResult {
  reconstruction: {
    lessons: Array<{
      title: string;
      learningGoal: string;
      blocks: Array<{
        tempId: string;
        title: string;
        description: string;
        bloom_level: string;
        time_weight: string;
        activity_category: string;
        phase: string;
      }>;
      matchPercentage: number;
      originalIndex: number;
    }>;
    overallMatchPercentage: number;
    totalBlocks: number;
    unmatchedBlocks: Array<{
      tempId: string;
      title: string;
      description: string;
      bloom_level: string;
      time_weight: string;
      activity_category: string;
      phase: string;
    }>;
    metadata: {
      detectedLessonCount: number;
      sequenceConfidence: number;
      assessmentPoints: number[];
    };
  };
  contentData: unknown;
  ingestion: {
    documentType: string;
    subject: string;
    gradeLevel: string;
    totalBlocks: number;
    piiDetected: boolean;
  };
}

export default function ImportPage() {
  const router = useRouter();
  const [rawText, setRawText] = useState("");
  const [copyright, setCopyright] = useState<"own" | "copyrighted" | "creative_commons" | "unknown">("own");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [accepted, setAccepted] = useState(false);

  // Pick up result stashed by library landing page redirect handoff
  useEffect(() => {
    try {
      const stashed = sessionStorage.getItem("pendingImportResult");
      if (stashed) {
        sessionStorage.removeItem("pendingImportResult");
        const parsed = JSON.parse(stashed) as ImportResult;
        if (parsed?.reconstruction && parsed?.ingestion) {
          setResult(parsed);
        }
      }
    } catch (e) {
      console.error("[import] Failed to parse pendingImportResult:", e);
      sessionStorage.removeItem("pendingImportResult");
    }
  }, []);

  const handleImport = async () => {
    if (rawText.length < 50) {
      setError("Please paste at least 50 characters of your unit plan.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/teacher/library/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText, copyrightFlag: copyright }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Import failed");
      }

      const data = await res.json();
      if (data.moderationHold) {
        setError(
          "This document was flagged by our content safety system and has been held for review. No unit was created. Please check the content and try again."
        );
      } else {
        setResult(data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = useCallback(async () => {
    if (!result) return;
    setSaving(true);
    setError(null);

    try {
      // Build a title from the first lesson or ingestion metadata
      const firstLesson = result.reconstruction.lessons[0];
      const title =
        result.ingestion.subject && result.ingestion.gradeLevel
          ? `${result.ingestion.subject} — ${result.ingestion.gradeLevel}`
          : firstLesson?.title || "Imported Unit";

      const res = await fetch("/api/teacher/units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          title,
          contentData: result.contentData,
          description:
            `Imported from ${result.ingestion.documentType}. ` +
            `${result.reconstruction.lessons.length} lessons, ` +
            `${result.reconstruction.totalBlocks} activities.`,
          gradeLevel: result.ingestion.gradeLevel || null,
          topic: result.ingestion.subject || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save unit");
      }

      const data = await res.json();
      setAccepted(true);

      // Redirect to the new unit after a brief pause so the success banner is visible
      if (data.unitId) {
        setTimeout(() => router.push(`/teacher/units/${data.unitId}`), 1200);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save unit");
    } finally {
      setSaving(false);
    }
  }, [result, router]);

  const handleReject = () => {
    setResult(null);
    setRawText("");
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Import Unit Plan</h1>
        <p className="text-sm text-gray-500 mt-1">
          Paste your unit plan document below. The system will analyse and reconstruct it as a StudioLoom unit.
        </p>
      </div>

      {!result ? (
        <div className="space-y-4">
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Paste your unit plan text here..."
            className="w-full h-64 border rounded-lg px-4 py-3 text-sm resize-y"
            disabled={loading}
          />

          <div className="flex items-center gap-4">
            <label className="text-sm text-gray-600">
              Copyright:
              <select
                value={copyright}
                onChange={(e) => setCopyright(e.target.value as typeof copyright)}
                className="ml-2 border rounded px-2 py-1 text-sm"
              >
                <option value="own">My own work</option>
                <option value="creative_commons">Creative Commons</option>
                <option value="copyrighted">Copyrighted</option>
                <option value="unknown">Unknown</option>
              </select>
            </label>

            <span className="text-xs text-gray-400">{rawText.length} characters</span>
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 rounded-lg px-4 py-2 text-sm">{error}</div>
          )}

          <button
            onClick={handleImport}
            disabled={loading || rawText.length < 50}
            className="px-6 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? "Analysing..." : "Import & Reconstruct"}
          </button>
        </div>
      ) : accepted ? (
        <div className="bg-emerald-50 text-emerald-700 rounded-lg px-6 py-4 text-center">
          <div className="text-lg font-semibold mb-1">✓ Unit Imported Successfully</div>
          <p className="text-sm">
            Detected as {result.ingestion.subject} ({result.ingestion.gradeLevel}) — {result.reconstruction.lessons.length} lessons, {result.reconstruction.totalBlocks} activities
          </p>
          <p className="text-xs text-emerald-500 mt-2">Redirecting to your new unit…</p>
        </div>
      ) : (
        <div className="space-y-4">
          {saving && (
            <div className="bg-purple-50 text-purple-700 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              Saving unit to your library…
            </div>
          )}
          {/* Ingestion summary */}
          <div className="bg-blue-50 rounded-lg border border-blue-100 px-4 py-3 flex gap-4 text-sm">
            <span className="text-blue-700">
              <strong>Type:</strong> {result.ingestion.documentType}
            </span>
            <span className="text-blue-700">
              <strong>Subject:</strong> {result.ingestion.subject}
            </span>
            <span className="text-blue-700">
              <strong>Grade:</strong> {result.ingestion.gradeLevel}
            </span>
            {result.ingestion.piiDetected && (
              <span className="text-amber-700 font-medium">PII detected</span>
            )}
          </div>

          <MatchReport
            lessons={result.reconstruction.lessons}
            overallMatchPercentage={result.reconstruction.overallMatchPercentage}
            totalBlocks={result.reconstruction.totalBlocks}
            unmatchedBlocks={result.reconstruction.unmatchedBlocks}
            metadata={result.reconstruction.metadata}
            onAccept={handleAccept}
            onReject={handleReject}
          />
        </div>
      )}
    </div>
  );
}
