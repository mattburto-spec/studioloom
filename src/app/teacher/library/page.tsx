"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ClassificationCheckpoint from "@/components/teacher/library/ClassificationCheckpoint";
import MatchReport from "@/components/teacher/library/MatchReport";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ACCEPTED = ".pdf,.docx,.pptx,.txt,.md";

// =========================================================================
// Types
// =========================================================================

type ReviewCardState = "idle" | "dragover" | "uploading" | "done" | "error";

interface ReviewUploadResult {
  classification?: { documentType?: string; topic?: string };
  parse?: { title?: string };
  suggestedRedirect?: string;
  error?: string;
  moderationHold?: boolean;
  moderationHoldReason?: string;
}

/** Import flow stages — rendered as a vertical timeline below the cards */
type ImportStage =
  | "idle"
  | "extracting"       // Extracting text from file
  | "classifying"      // Running Pass A
  | "checkpoint"       // User reviewing classification
  | "enriching"        // Running Pass B + Extract
  | "review"           // Showing MatchReport
  | "saving"           // Creating unit
  | "done"             // Redirect to unit
  | "error";

interface ClassifyResult {
  classification: {
    documentType: string;
    confidences: { documentType: number; subject?: number; strand?: number; level?: number };
    topic: string;
    detectedSubject?: string;
    detectedStrand?: string;
    detectedLevel?: string;
    sections: Array<{ index: number; heading: string; content: string; sectionType: string }>;
    cost: { inputTokens: number; outputTokens: number; modelId: string; estimatedCostUSD: number; timeMs: number };
  };
  rawText: string;
  parseResult: { title: string; sectionCount: number; sectionHeadings: string[] };
  cost: { inputTokens: number; outputTokens: number; estimatedCostUSD: number; timeMs: number };
  correctionsUsed: number;
  fileHash: string;
}

interface ImportBlock {
  tempId: string;
  title: string;
  description: string;
  bloom_level: string;
  time_weight: string;
  activity_category: string;
  phase: string;
  grouping?: string;
  materials?: string[];
  teaching_approach?: string;
  scaffolding_notes?: string;
}

interface ImportResult {
  reconstruction: {
    lessons: Array<{
      title: string;
      learningGoal: string;
      blocks: ImportBlock[];
      matchPercentage: number;
      originalIndex: number;
    }>;
    overallMatchPercentage: number;
    totalBlocks: number;
    unmatchedBlocks: ImportBlock[];
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
    documentTitle?: string;
  };
}

interface CorrectionRecord {
  correctedDocumentType?: string;
  correctedSubject?: string;
  correctedGradeLevel?: string;
  correctedSectionCount?: number;
  correctionNote?: string;
}

// =========================================================================
// Progress Timeline
// =========================================================================

const STAGE_LABELS: Record<string, { label: string; detail: string }> = {
  extracting:  { label: "Extracting text",    detail: "Reading document structure, tables, and headings" },
  classifying: { label: "Classifying",        detail: "Identifying document type, subject, grade, and sections" },
  checkpoint:  { label: "Your review",        detail: "Confirm or correct the classification below" },
  enriching:   { label: "Enriching lessons",  detail: "Adding Bloom's levels, grouping, materials, and pedagogy" },
  review:      { label: "Ready for review",   detail: "Check the reconstructed lessons below" },
  saving:      { label: "Creating unit",      detail: "Saving to your library..." },
  done:        { label: "Import complete",    detail: "Redirecting to your new unit" },
};

const STAGE_ORDER: ImportStage[] = [
  "extracting", "classifying", "checkpoint", "enriching", "review",
];

function StageTimeline({
  currentStage,
  completedStages,
  fileName,
  classifyTimeMs,
  enrichTimeMs,
  correctionStored,
}: {
  currentStage: ImportStage;
  completedStages: Set<ImportStage>;
  fileName: string | null;
  classifyTimeMs: number | null;
  enrichTimeMs: number | null;
  correctionStored: boolean;
}) {
  if (currentStage === "idle") return null;

  return (
    <div className="relative pl-6">
      {/* Vertical line */}
      <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-gray-200" />

      {STAGE_ORDER.map((stage) => {
        const isCompleted = completedStages.has(stage);
        const isCurrent = stage === currentStage;
        const isPending = !isCompleted && !isCurrent;
        const info = STAGE_LABELS[stage];

        return (
          <div key={stage} className={`relative pb-5 last:pb-0 ${isPending ? "opacity-40" : ""}`}>
            {/* Dot */}
            <div className={`absolute -left-6 top-0.5 w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center
              ${isCompleted ? "bg-emerald-500 border-emerald-500" : ""}
              ${isCurrent ? "bg-white border-purple-500 shadow-sm shadow-purple-200" : ""}
              ${isPending ? "bg-white border-gray-300" : ""}
            `}>
              {isCompleted && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
              {isCurrent && !isCompleted && (
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
              )}
            </div>

            {/* Content */}
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${isCompleted ? "text-emerald-700" : isCurrent ? "text-gray-900" : "text-gray-400"}`}>
                  {info.label}
                </span>

                {/* Timing badges */}
                {stage === "classifying" && classifyTimeMs !== null && isCompleted && (
                  <span className="text-[10px] text-gray-400">{(classifyTimeMs / 1000).toFixed(1)}s</span>
                )}
                {stage === "enriching" && enrichTimeMs !== null && isCompleted && (
                  <span className="text-[10px] text-gray-400">{(enrichTimeMs / 1000).toFixed(1)}s</span>
                )}

                {/* Correction stored badge */}
                {stage === "checkpoint" && correctionStored && isCompleted && (
                  <span className="px-2 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 rounded-full">
                    Correction saved — will improve next import
                  </span>
                )}
              </div>
              <p className={`text-xs mt-0.5 ${isCurrent ? "text-gray-500" : "text-gray-400"}`}>
                {isCurrent && stage === "extracting" && fileName
                  ? `Reading ${fileName}...`
                  : info.detail}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// =========================================================================
// Main Component
// =========================================================================

export default function LibraryLandingPage() {
  const router = useRouter();

  // ── Review Queue card state ──
  const [reviewState, setReviewState] = useState<ReviewCardState>("idle");
  const [reviewFile, setReviewFile] = useState<string | null>(null);
  const [reviewResult, setReviewResult] = useState<ReviewUploadResult | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [showRedirectPrompt, setShowRedirectPrompt] = useState(false);
  const reviewInputRef = useRef<HTMLInputElement>(null);
  const reviewFileRef = useRef<File | null>(null);

  // ── Import flow state ──
  const [importStage, setImportStage] = useState<ImportStage>("idle");
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [classifyResult, setClassifyResult] = useState<ClassifyResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [completedStages, setCompletedStages] = useState<Set<ImportStage>>(new Set());
  const [classifyTimeMs, setClassifyTimeMs] = useState<number | null>(null);
  const [enrichTimeMs, setEnrichTimeMs] = useState<number | null>(null);
  const [correctionStored, setCorrectionStored] = useState(false);
  const [copyright] = useState<"own" | "copyrighted" | "creative_commons" | "unknown">("own");
  const importInputRef = useRef<HTMLInputElement>(null);
  const lastImportFileRef = useRef<File | null>(null);

  // helpers
  const markComplete = (stage: ImportStage) =>
    setCompletedStages((prev) => new Set([...prev, stage]));

  // ── Review Queue upload ──
  const handleReviewFile = useCallback(async (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      setReviewError("File too large (max 20MB)");
      setReviewState("error");
      return;
    }
    setReviewState("uploading");
    setReviewFile(file.name);
    setReviewError(null);
    setReviewResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/teacher/library/ingest", { method: "POST", body: formData });
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        setReviewError(res.status === 413 ? "File too large for server" : `Upload failed (${res.status})`);
        setReviewState("error");
        return;
      }
      const data: ReviewUploadResult = await res.json();
      if (!res.ok || data.error) {
        setReviewError(data.error || `Upload failed (${res.status})`);
        setReviewState("error");
        return;
      }
      setReviewResult(data);
      setReviewState("done");

      // Scheme-of-work intent guard
      if (data.suggestedRedirect === "import") {
        reviewFileRef.current = file;
        setShowRedirectPrompt(true);
      }
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : "Upload failed");
      setReviewState("error");
    }
  }, []);

  const handleRedirectYes = useCallback(() => {
    setShowRedirectPrompt(false);
    const file = reviewFileRef.current;
    if (file) handleImportFile(file);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRedirectNo = useCallback(() => {
    setShowRedirectPrompt(false);
  }, []);

  // ── Import flow: Step 1 — Classify ──
  const handleImportFile = useCallback(async (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      setImportError("File too large (max 20MB)");
      setImportStage("error");
      return;
    }

    // Reset state + store file ref for retry
    lastImportFileRef.current = file;
    setImportFileName(file.name);
    setImportError(null);
    setClassifyResult(null);
    setImportResult(null);
    setCompletedStages(new Set());
    setClassifyTimeMs(null);
    setEnrichTimeMs(null);
    setCorrectionStored(false);

    // Stage: extracting
    setImportStage("extracting");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("copyrightFlag", copyright);

      // Brief pause so the "extracting" stage is visible
      const classifyStart = Date.now();

      // Stage: classifying (we merge extracting + classifying since it's one API call)
      setTimeout(() => {
        markComplete("extracting");
        setImportStage("classifying");
      }, 800);

      const res = await fetch("/api/teacher/library/import/classify", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        // Try to extract JSON error message; fall back to status code
        let errorMsg = `Classification failed (${res.status})`;
        try {
          const errData = await res.json();
          if (errData.message) errorMsg = errData.message;
          else if (errData.error) errorMsg = errData.error;
        } catch {
          // Response wasn't JSON (e.g., Vercel infrastructure error)
        }
        throw new Error(errorMsg);
      }

      const data = await res.json();
      if (data.error) {
        throw new Error(data.message || data.error);
      }

      if (data.moderationHold) {
        throw new Error("This document was flagged by our content safety system. Please check the content and try again.");
      }

      setClassifyTimeMs(Date.now() - classifyStart);
      setClassifyResult(data);
      markComplete("extracting");
      markComplete("classifying");
      setImportStage("checkpoint");
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Classification failed");
      setImportStage("error");
    }
  }, [copyright]);

  // ── Import flow: Step 2 — Continue after checkpoint ──
  const handleCheckpointConfirm = useCallback(async (corrections?: CorrectionRecord) => {
    if (!classifyResult) return;

    markComplete("checkpoint");
    setImportStage("enriching");
    setCorrectionStored(!!corrections && Object.values(corrections).some(Boolean));

    const enrichStart = Date.now();

    try {
      const res = await fetch("/api/teacher/library/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText: classifyResult.rawText,
          copyrightFlag: copyright,
          classification: classifyResult.classification,
          corrections: corrections || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Import failed");
      }

      const data = await res.json();
      if (data.moderationHold) {
        throw new Error("Content flagged by safety system during enrichment.");
      }

      setEnrichTimeMs(Date.now() - enrichStart);
      setImportResult(data);
      markComplete("enriching");
      setImportStage("review");
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Import failed");
      setImportStage("error");
    }
  }, [classifyResult, copyright]);

  // ── Import flow: Step 3 — Accept ──
  const handleAccept = useCallback(async () => {
    if (!importResult) return;
    setImportStage("saving");

    try {
      // Prefer the actual document title over "Subject — Grade"
      const docTitle = importResult.ingestion.documentTitle;
      const firstLesson = importResult.reconstruction.lessons[0];
      const title = docTitle && docTitle !== "Imported Unit"
        ? docTitle
        : firstLesson?.title || "Imported Unit";

      // Strip redundant "Grade" prefix if the detected level already starts with "Grade"
      const rawGrade = importResult.ingestion.gradeLevel || null;
      const gradeLevel = rawGrade?.replace(/^Grade\s+/i, "") || rawGrade;

      const res = await fetch("/api/teacher/units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          title,
          contentData: importResult.contentData,
          description:
            `Imported from ${importResult.ingestion.documentType}. ` +
            `${importResult.reconstruction.lessons.length} lessons, ` +
            `${importResult.reconstruction.totalBlocks} activities.`,
          gradeLevel,
          topic: importResult.ingestion.subject || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save unit");
      }

      const data = await res.json();
      markComplete("review");
      setImportStage("done");

      if (data.unitId) {
        setTimeout(() => router.push(`/teacher/units/${data.unitId}`), 1500);
      }
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Failed to save unit");
      setImportStage("error");
    }
  }, [importResult, router]);

  const handleReject = useCallback(() => {
    setImportStage("idle");
    setClassifyResult(null);
    setImportResult(null);
    setImportFileName(null);
    setCompletedStages(new Set());
    setCorrectionStored(false);
  }, []);

  // ── Retry with same file ──
  const handleRetry = useCallback(() => {
    const file = lastImportFileRef.current;
    if (file) handleImportFile(file);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Drag / drop helpers ──
  const onDragOver = (e: React.DragEvent, handler: () => void) => { e.preventDefault(); e.stopPropagation(); handler(); };
  const onDragLeave = (e: React.DragEvent, handler: () => void) => { e.preventDefault(); e.stopPropagation(); handler(); };
  const onDrop = (e: React.DragEvent, handler: (f: File) => void) => {
    e.preventDefault(); e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file) handler(file);
  };
  const onPick = (e: React.ChangeEvent<HTMLInputElement>, handler: (f: File) => void) => {
    const file = e.target.files?.[0];
    if (file) handler(file);
    e.target.value = "";
  };

  function reviewBorderClass(): string {
    if (reviewState === "dragover") return "border-purple-400 bg-purple-50";
    if (reviewState === "uploading") return "border-purple-300 bg-purple-50/30";
    if (reviewState === "done") return "border-green-300 bg-green-50/30";
    if (reviewState === "error") return "border-red-300 bg-red-50/30";
    return "border-gray-200";
  }

  const importActive = importStage !== "idle";
  const importCardBorder = importActive
    ? "border-purple-400 bg-purple-50/30 ring-1 ring-purple-200"
    : "border-gray-200";

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Library</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage your activity blocks and import existing unit plans.
        </p>
      </div>

      {/* ── Two cards ────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Review Queue Card */}
        <div
          className={`relative bg-white rounded-xl border shadow-sm p-5 transition hover:shadow-md ${reviewBorderClass()}`}
          onDragOver={(e) => onDragOver(e, () => setReviewState("dragover"))}
          onDragLeave={(e) => onDragLeave(e, () => setReviewState("idle"))}
          onDrop={(e) => onDrop(e, handleReviewFile)}
        >
          <Link href="/teacher/library/review" className="block">
            <h2 className="text-base font-semibold text-gray-900">Review Queue</h2>
            <p className="text-sm text-gray-500 mt-1">
              Upload documents, extract activity blocks, and approve them into your library.
            </p>
          </Link>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); reviewInputRef.current?.click(); }}
              disabled={reviewState === "uploading"}
              className="px-3 py-1.5 text-xs font-medium bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 disabled:opacity-50 transition"
            >
              {reviewState === "uploading" ? "Processing..." : "Upload file"}
            </button>
            <input ref={reviewInputRef} type="file" accept={ACCEPTED} onChange={(e) => onPick(e, handleReviewFile)} className="hidden" />
            {reviewFile && <span className="text-xs text-gray-500 truncate max-w-[180px]">{reviewFile}</span>}
          </div>

          {reviewState === "dragover" && (
            <div className="absolute inset-0 rounded-xl bg-purple-100/50 flex items-center justify-center pointer-events-none">
              <span className="text-sm font-medium text-purple-700">Drop file here</span>
            </div>
          )}
          {reviewState === "done" && reviewResult && !showRedirectPrompt && (
            <div className="mt-3 p-2 bg-green-50 rounded-lg text-xs text-green-700">
              Extracted from: {reviewResult.classification?.topic || reviewResult.parse?.title || "document"}.{" "}
              <Link href="/teacher/library/review" className="underline font-medium">View in review queue</Link>
            </div>
          )}
          {reviewError && <div className="mt-3 p-2 bg-red-50 rounded-lg text-xs text-red-700">{reviewError}</div>}

          {showRedirectPrompt && (
            <div data-testid="redirect-prompt" className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
              <p className="text-amber-800 font-medium">This looks like a unit plan.</p>
              <p className="text-amber-700 text-xs mt-1">Import it as a StudioLoom unit instead?</p>
              <div className="flex gap-2 mt-2">
                <button onClick={(e) => { e.stopPropagation(); handleRedirectYes(); }} className="px-3 py-1 text-xs font-medium bg-amber-600 text-white rounded hover:bg-amber-700 transition">
                  Yes, import it
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleRedirectNo(); }} className="px-3 py-1 text-xs font-medium bg-white text-gray-600 border border-gray-200 rounded hover:bg-gray-50 transition">
                  No, just extract blocks
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Import Unit Card */}
        <div
          className={`relative bg-white rounded-xl border shadow-sm p-5 transition hover:shadow-md ${importCardBorder}`}
          onDragOver={(e) => onDragOver(e, () => {})}
          onDragLeave={(e) => onDragLeave(e, () => {})}
          onDrop={(e) => onDrop(e, handleImportFile)}
        >
          <h2 className="text-base font-semibold text-gray-900">Import Unit</h2>
          <p className="text-sm text-gray-500 mt-1">
            Upload a unit plan and we&apos;ll reconstruct it as a StudioLoom unit with lessons and activities.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); importInputRef.current?.click(); }}
              disabled={importActive}
              className="px-3 py-1.5 text-xs font-medium bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 disabled:opacity-50 transition"
            >
              {importActive ? "Import in progress..." : "Upload file"}
            </button>
            <input ref={importInputRef} type="file" accept={ACCEPTED} onChange={(e) => onPick(e, handleImportFile)} className="hidden" />
            {importFileName && importActive && (
              <span className="text-xs text-gray-500 truncate max-w-[180px]">{importFileName}</span>
            )}
          </div>

          {/* Paste link for text import */}
          {!importActive && (
            <div className="mt-2">
              <Link href="/teacher/library/import" className="text-xs text-purple-500 hover:text-purple-700 transition-colors">
                or paste text manually →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ── Import Flow (inline below cards) ───────────── */}
      {importActive && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
              <h3 className="text-sm font-semibold text-gray-900">
                Importing {importFileName || "unit plan"}
              </h3>
            </div>
            {importStage !== "saving" && importStage !== "done" && (
              <button
                onClick={handleReject}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>

          <div className="p-5 space-y-6">
            {/* Stage timeline */}
            <StageTimeline
              currentStage={importStage}
              completedStages={completedStages}
              fileName={importFileName}
              classifyTimeMs={classifyTimeMs}
              enrichTimeMs={enrichTimeMs}
              correctionStored={correctionStored}
            />

            {/* Error */}
            {importStage === "error" && importError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                <p className="font-medium">Import failed</p>
                <p className="text-xs mt-1">{importError}</p>
                <div className="flex items-center gap-3 mt-2">
                  {lastImportFileRef.current && (
                    <button
                      onClick={handleRetry}
                      className="px-3 py-1 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
                    >
                      Retry
                    </button>
                  )}
                  <button
                    onClick={handleReject}
                    className="text-xs font-medium text-red-600 hover:text-red-800 underline"
                  >
                    Start over
                  </button>
                </div>
              </div>
            )}

            {/* Classification Checkpoint */}
            {importStage === "checkpoint" && classifyResult && (
              <ClassificationCheckpoint
                classification={classifyResult.classification}
                sectionCount={classifyResult.parseResult.sectionCount}
                sectionHeadings={classifyResult.parseResult.sectionHeadings}
                documentTitle={classifyResult.parseResult.title}
                correctionsUsed={classifyResult.correctionsUsed}
                onConfirm={handleCheckpointConfirm}
                onReject={handleReject}
              />
            )}

            {/* Enriching spinner */}
            {importStage === "enriching" && (
              <div className="flex items-center gap-3 px-4 py-3 bg-purple-50 rounded-lg">
                <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                <div>
                  <p className="text-sm font-medium text-purple-700">Analysing lessons...</p>
                  <p className="text-xs text-purple-500 mt-0.5">
                    Adding Bloom&apos;s taxonomy, materials, grouping, and pedagogy to each lesson
                  </p>
                </div>
              </div>
            )}

            {/* MatchReport */}
            {importStage === "review" && importResult && (
              <div className="space-y-3">
                {/* Summary strip */}
                <div className="flex gap-4 text-sm bg-blue-50 rounded-lg border border-blue-100 px-4 py-2.5">
                  <span className="text-blue-700"><strong>Type:</strong> {importResult.ingestion.documentType}</span>
                  <span className="text-blue-700"><strong>Subject:</strong> {importResult.ingestion.subject}</span>
                  <span className="text-blue-700"><strong>Grade:</strong> {importResult.ingestion.gradeLevel}</span>
                  {importResult.ingestion.piiDetected && (
                    <span className="text-amber-700 font-medium">PII detected</span>
                  )}
                </div>

                <MatchReport
                  lessons={importResult.reconstruction.lessons}
                  overallMatchPercentage={importResult.reconstruction.overallMatchPercentage}
                  totalBlocks={importResult.reconstruction.totalBlocks}
                  unmatchedBlocks={importResult.reconstruction.unmatchedBlocks}
                  metadata={importResult.reconstruction.metadata}
                  onAccept={handleAccept}
                  onReject={handleReject}
                />
              </div>
            )}

            {/* Saving */}
            {importStage === "saving" && (
              <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 rounded-lg">
                <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-medium text-emerald-700">Creating unit in your library...</p>
              </div>
            )}

            {/* Done */}
            {importStage === "done" && (
              <div className="text-center py-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-lg">
                  <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm font-semibold text-emerald-700">
                    Unit imported successfully — redirecting...
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer hint (only when idle) */}
      {!importActive && (
        <p className="text-xs text-gray-400 text-center">
          Drop a .pdf, .docx, .pptx, .txt, or .md file on either card, or use the upload button. Max 20MB.
        </p>
      )}
    </div>
  );
}
