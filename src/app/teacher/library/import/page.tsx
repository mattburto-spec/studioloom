"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  const [inputMode, setInputMode] = useState<"choice" | "paste" | "file">("choice");
  const [rawText, setRawText] = useState("");
  const [copyright, setCopyright] = useState<"own" | "copyrighted" | "creative_commons" | "unknown">("own");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileUpload = async (file: File) => {
    const maxSize = 20 * 1024 * 1024; // 20MB
    if (file.size > maxSize) {
      setError("File is too large (max 20MB).");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setUploadedFileName(file.name);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("copyrightFlag", copyright);

      const res = await fetch("/api/teacher/library/import", {
        method: "POST",
        body: formData,
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
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.pptx,.txt,.md"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file);
          e.target.value = "";
        }}
        className="hidden"
      />

      <div>
        <h1 className="text-xl font-bold text-gray-900">Import Unit Plan</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload or paste a unit plan and we&apos;ll reconstruct it as a StudioLoom unit with lessons and activities.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 rounded-lg px-4 py-2 text-sm">{error}</div>
      )}

      {!result ? (
        <>
          {/* Loading state */}
          {loading && (
            <div className="rounded-xl border border-purple-200 bg-purple-50 p-8 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm font-medium text-purple-700">
                Analysing {uploadedFileName ? uploadedFileName : "your unit plan"}...
              </p>
              <p className="text-[11px] text-gray-500">
                This can take 30–60 seconds for longer documents
              </p>
            </div>
          )}

          {/* Choice: upload or paste */}
          {!loading && inputMode === "choice" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="group text-left rounded-xl border-2 border-purple-200 hover:border-purple-400 p-5 transition-all hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #7B2FF2, #5C16C5)" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900">Upload a file</span>
                      <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full uppercase tracking-wide">Recommended</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      PDF, Word (.docx), PowerPoint (.pptx), or text file
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setInputMode("paste")}
                className="group text-left rounded-xl border-2 border-gray-200 hover:border-gray-300 p-5 transition-all hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center group-hover:bg-purple-50 transition-colors shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" /></svg>
                  </div>
                  <div>
                    <span className="text-sm font-bold text-gray-900">Paste text</span>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Copy-paste your unit plan content directly
                    </p>
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* Paste mode */}
          {!loading && inputMode === "paste" && (
            <div className="space-y-4">
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste your unit plan text here..."
                className="w-full h-64 border border-gray-200 rounded-xl px-4 py-3 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition-all"
                autoFocus
              />

              <div className="flex items-center gap-4">
                <label className="text-sm text-gray-600">
                  Copyright:
                  <select
                    value={copyright}
                    onChange={(e) => setCopyright(e.target.value as typeof copyright)}
                    className="ml-2 border border-gray-200 rounded-lg px-2 py-1 text-sm"
                  >
                    <option value="own">My own work</option>
                    <option value="creative_commons">Creative Commons</option>
                    <option value="copyrighted">Copyrighted</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </label>
                <span className="text-xs text-gray-400">{rawText.length} characters</span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleImport}
                  disabled={rawText.length < 50}
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white rounded-xl transition-all duration-200 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
                  style={{ background: "linear-gradient(135deg, #7B2FF2, #5C16C5)", boxShadow: "0 4px 14px rgba(123, 47, 242, 0.3)" }}
                >
                  Import &amp; Reconstruct
                </button>
                <button
                  onClick={() => setInputMode("choice")}
                  className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </>
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
