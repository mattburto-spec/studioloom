"use client";

import { useState } from "react";

/**
 * §5.4: Multi-select proposals, batch accept/reject.
 * Batch reject requires a reason.
 */

interface BatchActionsProps {
  selectedIds: string[];
  onBatchAction: (ids: string[], action: "approved" | "rejected", note?: string) => Promise<void>;
  onClearSelection: () => void;
}

export default function BatchActions({ selectedIds, onBatchAction, onClearSelection }: BatchActionsProps) {
  const [loading, setLoading] = useState(false);
  const [showRejectReason, setShowRejectReason] = useState(false);
  const [reason, setReason] = useState("");

  if (selectedIds.length === 0) return null;

  const handleApprove = async () => {
    setLoading(true);
    try {
      await onBatchAction(selectedIds, "approved");
      onClearSelection();
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!showRejectReason) {
      setShowRejectReason(true);
      return;
    }
    if (!reason.trim()) return; // Reason required for batch reject
    setLoading(true);
    try {
      await onBatchAction(selectedIds, "rejected", reason.trim());
      setShowRejectReason(false);
      setReason("");
      onClearSelection();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sticky top-0 z-10 bg-white border rounded-lg shadow-md p-3 flex items-center gap-3">
      <span className="text-sm font-medium text-gray-700">
        {selectedIds.length} selected
      </span>

      <button
        onClick={handleApprove}
        disabled={loading}
        className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-medium hover:bg-emerald-700 disabled:opacity-50"
      >
        Approve All
      </button>

      <button
        onClick={handleReject}
        disabled={loading || (showRejectReason && !reason.trim())}
        className="px-3 py-1.5 bg-red-100 text-red-700 rounded text-xs font-medium hover:bg-red-200 disabled:opacity-50"
      >
        Reject All
      </button>

      {showRejectReason && (
        <input
          type="text"
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Rejection reason (required)"
          className="flex-1 border rounded px-2 py-1 text-sm"
          autoFocus
        />
      )}

      <button
        onClick={() => { onClearSelection(); setShowRejectReason(false); setReason(""); }}
        className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
      >
        Clear
      </button>
    </div>
  );
}
