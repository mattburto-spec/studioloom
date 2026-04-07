"use client";

import { useState, useEffect } from "react";
import ReviewQueue from "@/components/teacher/knowledge/ReviewQueue";
import type { ReviewBlock } from "@/components/teacher/knowledge/BlockReviewCard";

export default function ReviewQueuePage() {
  const [blocks, setBlocks] = useState<ReviewBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadText, setUploadText] = useState("");
  const [copyrightFlag, setCopyrightFlag] = useState<string>("own");
  const [uploadResult, setUploadResult] = useState<any>(null);

  useEffect(() => {
    fetchPendingBlocks();
  }, []);

  async function fetchPendingBlocks() {
    try {
      const res = await fetch("/api/teacher/activity-blocks/review?status=pending");
      if (res.ok) {
        const data = await res.json();
        setBlocks(data.blocks || []);
      }
    } catch (e) {
      console.error("[ReviewPage] fetch error:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload() {
    if (!uploadText.trim()) return;
    setUploading(true);
    setUploadResult(null);

    try {
      const res = await fetch("/api/teacher/knowledge/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText: uploadText,
          copyrightFlag,
        }),
      });

      const data = await res.json();
      setUploadResult(data);

      if (res.ok) {
        // Refresh the block list
        setUploadText("");
        await fetchPendingBlocks();
      }
    } catch (e) {
      console.error("[ReviewPage] upload error:", e);
      setUploadResult({ error: "Upload failed" });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Block Library Review</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload documents to extract activity blocks, then review before adding to your library.
        </p>
      </div>

      {/* Upload section */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">Upload Document</h2>
        </div>
        <div className="p-4 space-y-3">
          <textarea
            value={uploadText}
            onChange={(e) => setUploadText(e.target.value)}
            placeholder="Paste your lesson plan, scheme of work, or activity description here..."
            rows={6}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y"
          />

          <div className="flex items-center gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase">
                Copyright
              </label>
              <select
                value={copyrightFlag}
                onChange={(e) => setCopyrightFlag(e.target.value)}
                className="ml-2 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="own">My own material</option>
                <option value="creative_commons">Creative Commons</option>
                <option value="copyrighted">Published / copyrighted</option>
                <option value="unknown">Not sure</option>
              </select>
            </div>

            <button
              onClick={handleUpload}
              disabled={uploading || !uploadText.trim()}
              className="px-5 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {uploading ? "Processing..." : "Extract Blocks"}
            </button>
          </div>

          {/* Upload result summary */}
          {uploadResult && (
            <div
              className={`mt-3 p-3 rounded-lg text-sm ${
                uploadResult.error
                  ? "bg-red-50 text-red-700"
                  : "bg-green-50 text-green-700"
              }`}
            >
              {uploadResult.error ? (
                <p>Error: {uploadResult.error}</p>
              ) : (
                <div className="space-y-1">
                  <p className="font-medium">
                    Extracted {uploadResult.extraction?.blocks?.length || 0} blocks
                    from {uploadResult.classification?.documentType || "document"}
                  </p>
                  <p className="text-xs opacity-75">
                    Topic: {uploadResult.classification?.topic || "Unknown"} |
                    Confidence: {Math.round((uploadResult.classification?.confidence || 0) * 100)}% |
                    Cost: ${uploadResult.totalCost?.estimatedCostUSD?.toFixed(4) || "0.0000"}
                  </p>
                  {uploadResult.extraction?.piiDetected && (
                    <p className="text-amber-700 font-medium text-xs">
                      PII detected in some blocks — please review before approving.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Review Queue */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">Review Queue</h2>
        </div>
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
              <span className="ml-2 text-sm text-gray-500">Loading...</span>
            </div>
          ) : (
            <ReviewQueue initialBlocks={blocks} />
          )}
        </div>
      </div>
    </div>
  );
}
