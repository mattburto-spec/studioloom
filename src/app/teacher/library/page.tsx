"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ACCEPTED = ".pdf,.docx,.pptx,.txt,.md";

type CardState = "idle" | "dragover" | "uploading" | "done" | "error";

interface UploadResult {
  classification?: { documentType?: string; topic?: string };
  parse?: { title?: string };
  suggestedRedirect?: string;
  reconstruction?: { lessons?: unknown[] };
  ingestion?: { documentType?: string };
  error?: string;
  moderationHold?: boolean;
  moderationHoldReason?: string;
}

/**
 * Teacher Library landing page.
 * Two cards: Review Queue (ingest) and Import Unit (import).
 * Each card is a drop target + has a file picker. Review Queue card
 * shows an intent-guard prompt when Pass 0 classifies as scheme_of_work.
 */
export default function LibraryLandingPage() {
  const router = useRouter();

  // Review Queue card state
  const [reviewState, setReviewState] = useState<CardState>("idle");
  const [reviewFile, setReviewFile] = useState<string | null>(null);
  const [reviewResult, setReviewResult] = useState<UploadResult | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [showRedirectPrompt, setShowRedirectPrompt] = useState(false);
  const reviewInputRef = useRef<HTMLInputElement>(null);
  const reviewFileRef = useRef<File | null>(null);

  // Import Unit card state
  const [importState, setImportState] = useState<CardState>("idle");
  const [importFile, setImportFile] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<UploadResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(async (
    file: File,
    endpoint: string,
    setCardState: (s: CardState) => void,
    setFileName: (n: string | null) => void,
    setResult: (r: UploadResult | null) => void,
    setError: (e: string | null) => void,
  ): Promise<UploadResult | null> => {
    if (file.size > MAX_FILE_SIZE) {
      setError("File too large (max 20MB)");
      setCardState("error");
      return null;
    }

    setCardState("uploading");
    setFileName(file.name);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(endpoint, { method: "POST", body: formData });
      const data: UploadResult = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || `Upload failed (${res.status})`);
        setCardState("error");
        return null;
      }

      setResult(data);
      setCardState("done");
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setCardState("error");
      return null;
    }
  }, []);

  // Review Queue handlers
  const handleReviewFile = useCallback(async (file: File) => {
    reviewFileRef.current = file;
    const data = await uploadFile(
      file, "/api/teacher/library/ingest",
      setReviewState, setReviewFile, setReviewResult, setReviewError
    );
    if (data?.suggestedRedirect === "import") {
      setShowRedirectPrompt(true);
    }
  }, [uploadFile]);

  const handleRedirectYes = useCallback(async () => {
    setShowRedirectPrompt(false);
    const file = reviewFileRef.current;
    if (!file) return;
    // Re-POST the same file to import
    setReviewState("uploading");
    setReviewError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/teacher/library/import", { method: "POST", body: formData });
      const data: UploadResult = await res.json();
      if (!res.ok || data.error) {
        setReviewError(data.error || `Import failed (${res.status})`);
        setReviewState("error");
      } else {
        setReviewResult(data);
        setReviewState("done");
        router.push("/teacher/library/import");
      }
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : "Import failed");
      setReviewState("error");
    }
  }, [router]);

  const handleRedirectNo = useCallback(() => {
    setShowRedirectPrompt(false);
  }, []);

  // Import Unit handlers
  const handleImportFile = useCallback(async (file: File) => {
    await uploadFile(
      file, "/api/teacher/library/import",
      setImportState, setImportFile, setImportResult, setImportError
    );
  }, [uploadFile]);

  // Generic drag/drop helpers
  const onDragOver = (e: React.DragEvent, setState: (s: CardState) => void) => {
    e.preventDefault();
    e.stopPropagation();
    setState("dragover");
  };
  const onDragLeave = (e: React.DragEvent, setState: (s: CardState) => void) => {
    e.preventDefault();
    e.stopPropagation();
    setState("idle");
  };
  const onDrop = (e: React.DragEvent, handler: (f: File) => void, setState: (s: CardState) => void) => {
    e.preventDefault();
    e.stopPropagation();
    setState("idle");
    const file = e.dataTransfer.files[0];
    if (file) handler(file);
  };
  const onPick = (e: React.ChangeEvent<HTMLInputElement>, handler: (f: File) => void) => {
    const file = e.target.files?.[0];
    if (file) handler(file);
    e.target.value = ""; // reset so same file can be re-selected
  };

  function cardBorderClass(state: CardState): string {
    if (state === "dragover") return "border-purple-400 bg-purple-50";
    if (state === "uploading") return "border-purple-300 bg-purple-50/30";
    if (state === "done") return "border-green-300 bg-green-50/30";
    if (state === "error") return "border-red-300 bg-red-50/30";
    return "border-gray-200";
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Library</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage your activity blocks and import existing unit plans.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* ── Review Queue Card ── */}
        <div
          className={`relative bg-white rounded-xl border shadow-sm p-5 transition hover:shadow-md ${cardBorderClass(reviewState)}`}
          onDragOver={(e) => onDragOver(e, setReviewState)}
          onDragLeave={(e) => onDragLeave(e, setReviewState)}
          onDrop={(e) => onDrop(e, handleReviewFile, setReviewState)}
        >
          <Link href="/teacher/library/review" className="block">
            <h2 className="text-base font-semibold text-gray-900">Review Queue</h2>
            <p className="text-sm text-gray-500 mt-1">
              Upload documents, extract activity blocks, and approve them into
              your library.
            </p>
          </Link>

          {/* Upload affordance */}
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); reviewInputRef.current?.click(); }}
              disabled={reviewState === "uploading"}
              className="px-3 py-1.5 text-xs font-medium bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 disabled:opacity-50 transition"
            >
              {reviewState === "uploading" ? "Processing..." : "Upload file"}
            </button>
            <input
              ref={reviewInputRef}
              type="file"
              accept={ACCEPTED}
              onChange={(e) => onPick(e, handleReviewFile)}
              className="hidden"
            />
            {reviewFile && (
              <span className="text-xs text-gray-500 truncate max-w-[180px]">{reviewFile}</span>
            )}
          </div>

          {reviewState === "dragover" && (
            <div className="absolute inset-0 rounded-xl bg-purple-100/50 flex items-center justify-center pointer-events-none">
              <span className="text-sm font-medium text-purple-700">Drop file here</span>
            </div>
          )}

          {/* Result */}
          {reviewState === "done" && reviewResult && !showRedirectPrompt && (
            <div className="mt-3 p-2 bg-green-50 rounded-lg text-xs text-green-700">
              Extracted from: {reviewResult.classification?.topic || reviewResult.parse?.title || "document"}.{" "}
              <Link href="/teacher/library/review" className="underline font-medium">View in review queue</Link>
            </div>
          )}

          {/* Error */}
          {reviewError && (
            <div className="mt-3 p-2 bg-red-50 rounded-lg text-xs text-red-700">{reviewError}</div>
          )}

          {/* Intent-guard prompt */}
          {showRedirectPrompt && (
            <div data-testid="redirect-prompt" className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
              <p className="text-amber-800 font-medium">This looks like a unit plan.</p>
              <p className="text-amber-700 text-xs mt-1">Send to Import Unit instead?</p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={(e) => { e.stopPropagation(); handleRedirectYes(); }}
                  className="px-3 py-1 text-xs font-medium bg-amber-600 text-white rounded hover:bg-amber-700 transition"
                >
                  Yes, redirect
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleRedirectNo(); }}
                  className="px-3 py-1 text-xs font-medium bg-white text-gray-600 border border-gray-200 rounded hover:bg-gray-50 transition"
                >
                  No, continue
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Import Unit Card ── */}
        <div
          className={`relative bg-white rounded-xl border shadow-sm p-5 transition hover:shadow-md ${cardBorderClass(importState)}`}
          onDragOver={(e) => onDragOver(e, setImportState)}
          onDragLeave={(e) => onDragLeave(e, setImportState)}
          onDrop={(e) => onDrop(e, handleImportFile, setImportState)}
        >
          <Link href="/teacher/library/import" className="block">
            <h2 className="text-base font-semibold text-gray-900">Import Unit</h2>
            <p className="text-sm text-gray-500 mt-1">
              Paste an existing unit plan and reconstruct it as a StudioLoom unit.
            </p>
          </Link>

          {/* Upload affordance */}
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); importInputRef.current?.click(); }}
              disabled={importState === "uploading"}
              className="px-3 py-1.5 text-xs font-medium bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 disabled:opacity-50 transition"
            >
              {importState === "uploading" ? "Processing..." : "Upload file"}
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept={ACCEPTED}
              onChange={(e) => onPick(e, handleImportFile)}
              className="hidden"
            />
            {importFile && (
              <span className="text-xs text-gray-500 truncate max-w-[180px]">{importFile}</span>
            )}
          </div>

          {importState === "dragover" && (
            <div className="absolute inset-0 rounded-xl bg-purple-100/50 flex items-center justify-center pointer-events-none">
              <span className="text-sm font-medium text-purple-700">Drop file here</span>
            </div>
          )}

          {/* Result */}
          {importState === "done" && importResult && (
            <div className="mt-3 p-2 bg-green-50 rounded-lg text-xs text-green-700">
              Unit reconstructed.{" "}
              <Link href="/teacher/library/import" className="underline font-medium">Review import</Link>
            </div>
          )}

          {/* Error */}
          {importError && (
            <div className="mt-3 p-2 bg-red-50 rounded-lg text-xs text-red-700">{importError}</div>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center">
        Drop a .pdf, .docx, .pptx, .txt, or .md file on either card, or use the upload button. Max 20MB.
      </p>
    </div>
  );
}
