"use client";

import { useState, useCallback } from "react";
import BlockReviewCard, { type ReviewBlock } from "./BlockReviewCard";

interface ReviewQueueProps {
  initialBlocks: ReviewBlock[];
}

type FilterStatus = "pending" | "approved" | "rejected";

export default function ReviewQueue({ initialBlocks }: ReviewQueueProps) {
  const [blocks, setBlocks] = useState<ReviewBlock[]>(initialBlocks);
  const [filter, setFilter] = useState<FilterStatus>("pending");
  const [loading, setLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [bulkApproving, setBulkApproving] = useState(false);

  const pendingCount = blocks.filter((b) => !b.teacher_verified && !b.pii_flags).length;

  const fetchBlocks = useCallback(async (status: FilterStatus) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/teacher/activity-blocks/review?status=${status}`);
      if (res.ok) {
        const data = await res.json();
        setBlocks(data.blocks || []);
      }
    } catch (e) {
      console.error("[ReviewQueue] fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleFilterChange(status: FilterStatus) {
    setFilter(status);
    fetchBlocks(status);
  }

  async function handleAction(
    blockId: string,
    action: "approve" | "reject" | "edit",
    edits?: Record<string, unknown>
  ) {
    setActionInProgress(blockId);
    try {
      const res = await fetch("/api/teacher/activity-blocks/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockId, action, edits }),
      });

      if (res.ok) {
        // Remove from current list (it moved to a different status)
        setBlocks((prev) => prev.filter((b) => b.id !== blockId));
      }
    } catch (e) {
      console.error("[ReviewQueue] action error:", e);
    } finally {
      setActionInProgress(null);
    }
  }

  async function handleBulkApprove() {
    const pendingIds = blocks
      .filter((b) => !b.teacher_verified)
      .map((b) => b.id);

    if (pendingIds.length === 0) return;

    setBulkApproving(true);
    try {
      const res = await fetch("/api/teacher/activity-blocks/review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockIds: pendingIds }),
      });

      if (res.ok) {
        setBlocks([]);
      }
    } catch (e) {
      console.error("[ReviewQueue] bulk approve error:", e);
    } finally {
      setBulkApproving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        {/* Filter tabs */}
        <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
          {(["pending", "approved", "rejected"] as const).map((status) => (
            <button
              key={status}
              onClick={() => handleFilterChange(status)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filter === status
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {/* Bulk action */}
        {filter === "pending" && blocks.length > 0 && (
          <button
            onClick={handleBulkApprove}
            disabled={bulkApproving || pendingCount === 0}
            className="px-4 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {bulkApproving
              ? "Approving..."
              : `Approve All (${pendingCount})`}
          </button>
        )}
      </div>

      {/* Block list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
          <span className="ml-2 text-sm text-gray-500">Loading blocks...</span>
        </div>
      ) : blocks.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-gray-400">
            {filter === "pending"
              ? "No blocks pending review. Upload a document to extract blocks."
              : `No ${filter} blocks.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {blocks.map((block) => (
            <BlockReviewCard
              key={block.id}
              block={block}
              onApprove={(id) => handleAction(id, "approve")}
              onReject={(id) => handleAction(id, "reject")}
              onEdit={(id, edits) => handleAction(id, "edit", edits)}
              disabled={actionInProgress === block.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
