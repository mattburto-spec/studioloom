"use client";

import { useState } from "react";

// =========================================================================
// Types
// =========================================================================

export interface ReviewBlock {
  id: string;
  title: string;
  description: string | null;
  prompt: string;
  bloom_level: string | null;
  time_weight: string | null;
  grouping: string | null;
  phase: string | null;
  activity_category: string | null;
  materials_needed: string[] | null;
  pii_scanned: boolean;
  pii_flags: Record<string, unknown> | null;
  copyright_flag: string | null;
  teacher_verified: boolean;
  source_upload_id: string | null;
  created_at: string;
}

interface BlockReviewCardProps {
  block: ReviewBlock;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onEdit: (id: string, edits: Record<string, unknown>) => void;
  disabled?: boolean;
}

// =========================================================================
// Helpers
// =========================================================================

const BLOOM_COLORS: Record<string, string> = {
  remember: "bg-gray-100 text-gray-700",
  understand: "bg-blue-100 text-blue-700",
  apply: "bg-green-100 text-green-700",
  analyze: "bg-amber-100 text-amber-700",
  evaluate: "bg-orange-100 text-orange-700",
  create: "bg-purple-100 text-purple-700",
};

const TIME_WEIGHT_LABELS: Record<string, string> = {
  quick: "< 10 min",
  moderate: "10-25 min",
  extended: "25+ min",
  flexible: "Varies",
};

// =========================================================================
// Component
// =========================================================================

export default function BlockReviewCard({
  block,
  onApprove,
  onReject,
  onEdit,
  disabled,
}: BlockReviewCardProps) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(block.title);
  const [editPrompt, setEditPrompt] = useState(block.prompt);
  const [expanded, setExpanded] = useState(false);

  const hasPII =
    block.pii_flags &&
    typeof block.pii_flags === "object" &&
    Object.keys(block.pii_flags).length > 0;

  function handleSaveEdit() {
    onEdit(block.id, {
      title: editTitle,
      prompt: editPrompt,
    });
    setEditing(false);
  }

  return (
    <div className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {editing ? (
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="flex-1 px-2 py-1 text-sm font-semibold border border-purple-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          ) : (
            <h3 className="text-sm font-semibold text-gray-900 truncate">
              {block.title}
            </h3>
          )}
        </div>

        {/* Metadata pills */}
        <div className="flex items-center gap-1.5 ml-3 flex-shrink-0">
          {block.bloom_level && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${BLOOM_COLORS[block.bloom_level] || "bg-gray-100 text-gray-600"}`}
            >
              {block.bloom_level}
            </span>
          )}
          {block.time_weight && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-600">
              {TIME_WEIGHT_LABELS[block.time_weight] || block.time_weight}
            </span>
          )}
          {block.activity_category && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-cyan-50 text-cyan-700">
              {block.activity_category}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        {/* Flags */}
        {(hasPII || block.copyright_flag === "copyrighted") && (
          <div className="flex gap-2 mb-2">
            {hasPII && (
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700">
                PII Detected
              </span>
            )}
            {block.copyright_flag === "copyrighted" && (
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">
                Copyrighted
              </span>
            )}
          </div>
        )}

        {/* Description */}
        {block.description && (
          <p className="text-xs text-gray-500 mb-2">{block.description}</p>
        )}

        {/* Prompt */}
        <div className="mb-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs font-medium text-gray-500 hover:text-gray-700 mb-1 flex items-center gap-1"
          >
            <span className={`transition-transform ${expanded ? "rotate-90" : ""}`}>
              ▶
            </span>
            Prompt / Student Instructions
          </button>
          {expanded && (
            editing ? (
              <textarea
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 text-xs font-mono border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            ) : (
              <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono bg-gray-50 rounded-lg p-3 max-h-40 overflow-y-auto">
                {block.prompt}
              </pre>
            )
          )}
        </div>

        {/* Extra metadata */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {block.phase && (
            <span className="px-1.5 py-0.5 text-[10px] text-gray-500 bg-gray-50 rounded">
              Phase: {block.phase}
            </span>
          )}
          {block.grouping && (
            <span className="px-1.5 py-0.5 text-[10px] text-gray-500 bg-gray-50 rounded">
              {block.grouping}
            </span>
          )}
          {block.materials_needed && block.materials_needed.length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] text-gray-500 bg-gray-50 rounded">
              Materials: {block.materials_needed.join(", ")}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center gap-2">
        {editing ? (
          <>
            <button
              onClick={handleSaveEdit}
              disabled={disabled}
              className="px-3 py-1.5 text-xs font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              Save & Approve
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setEditTitle(block.title);
                setEditPrompt(block.prompt);
              }}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => onApprove(block.id)}
              disabled={disabled}
              className="px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              Approve
            </button>
            <button
              onClick={() => setEditing(true)}
              disabled={disabled}
              className="px-3 py-1.5 text-xs font-medium bg-white text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Edit
            </button>
            <button
              onClick={() => onReject(block.id)}
              disabled={disabled}
              className="px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
            >
              Reject
            </button>
          </>
        )}
      </div>
    </div>
  );
}
