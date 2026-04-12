"use client";

import { useState } from "react";
import ProposalReasoning from "./ProposalReasoning";
import FeedbackDiff from "./FeedbackDiff";
import GuardrailWarning from "./GuardrailWarning";

interface AdjustmentCardProps {
  proposal: {
    id: string;
    block_id: string;
    proposal_type: string;
    field: string;
    current_value: unknown;
    proposed_value: unknown;
    evidence_count: number;
    evidence_summary: string;
    signal_breakdown: Record<string, number>;
    reasoning?: Record<string, number> | null;
    requires_manual_approval: boolean;
    guardrail_flags: string[];
    status: string;
    created_at: string;
    activity_blocks?: { title: string; time_weight: string; bloom_level: string; efficacy_score: number } | null;
  };
  onAction: (proposalId: string, action: "approved" | "rejected" | "modified", modifiedValue?: unknown, note?: string) => Promise<void>;
}

export default function AdjustmentCard({ proposal, onAction }: AdjustmentCardProps) {
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");
  const [modifiedValue, setModifiedValue] = useState(String(proposal.proposed_value ?? ""));
  const [showModify, setShowModify] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const blockTitle = proposal.activity_blocks?.title ?? `Block ${proposal.block_id.slice(0, 8)}`;
  const isEfficacy = proposal.proposal_type === "efficacy_adjustment";
  const isHealing = proposal.proposal_type === "self_healing";

  const handleAction = async (action: "approved" | "rejected" | "modified") => {
    setLoading(true);
    try {
      const val = action === "modified" ? parseProposalValue(modifiedValue, proposal.field) : undefined;
      await onAction(proposal.id, action, val, note || undefined);
    } finally {
      setLoading(false);
    }
  };

  const delta = isEfficacy
    ? ((proposal.proposed_value as number) - (proposal.current_value as number)).toFixed(1)
    : null;
  const deltaColor = delta && parseFloat(delta) > 0 ? "text-emerald-600" : "text-red-600";

  return (
    <div className="border rounded-lg bg-white shadow-sm">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">{blockTitle}</h3>
            <div className="flex gap-2 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                isEfficacy ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
              }`}>
                {isEfficacy ? "Efficacy" : isHealing ? "Self-Healing" : proposal.proposal_type}
              </span>
              <span className="text-xs text-gray-500">{proposal.field}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">
              {new Date(proposal.created_at).toLocaleDateString()}
            </span>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-purple-600 hover:text-purple-800 font-medium"
            >
              {expanded ? "Less" : "Details"}
            </button>
          </div>
        </div>

        {/* Guardrail warnings */}
        <GuardrailWarning
          requiresManualApproval={proposal.requires_manual_approval}
          guardrailFlags={proposal.guardrail_flags}
          currentValue={proposal.current_value}
          proposedValue={proposal.proposed_value}
          field={proposal.field}
        />

        {/* Score change */}
        {isEfficacy && (
          <div className="flex items-center gap-3 mb-3 mt-2 text-sm">
            <span className="text-gray-600">{String(proposal.current_value)}</span>
            <span className="text-gray-400">→</span>
            <span className="font-semibold text-gray-900">{String(proposal.proposed_value)}</span>
            {delta && (
              <span className={`text-xs font-medium ${deltaColor}`}>
                ({parseFloat(delta) > 0 ? "+" : ""}{delta})
              </span>
            )}
          </div>
        )}

        {/* Evidence */}
        <p className="text-xs text-gray-600 mb-2">{proposal.evidence_summary}</p>
        <div className="flex gap-3 text-xs text-gray-500 mb-3">
          <span>{proposal.evidence_count} evidence points</span>
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="space-y-3 mb-3 border-t pt-3">
            {/* Reasoning breakdown */}
            {isEfficacy && (
              <ProposalReasoning
                reasoning={proposal.reasoning}
                evidenceCount={proposal.evidence_count}
                signalBreakdown={proposal.signal_breakdown}
              />
            )}

            {/* Diff view */}
            <FeedbackDiff
              field={proposal.field}
              currentValue={proposal.current_value}
              proposedValue={proposal.proposed_value}
              blockData={proposal.activity_blocks as Record<string, unknown> | null}
            />

            {/* Signal breakdown */}
            {proposal.signal_breakdown && Object.keys(proposal.signal_breakdown).length > 0 && (
              <div className="text-xs">
                <div className="font-medium text-gray-600 mb-1">Signal breakdown</div>
                <div className="flex gap-3 flex-wrap text-gray-500">
                  {Object.entries(proposal.signal_breakdown).map(([k, v]) => (
                    <span key={k}>{k}: {v}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modify input */}
        {showModify && (
          <div className="mb-3 space-y-2">
            <input
              type="text"
              value={modifiedValue}
              onChange={e => setModifiedValue(e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm"
              placeholder="Modified value"
            />
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm"
              rows={2}
              placeholder="Note (optional)"
            />
          </div>
        )}

        {/* Actions */}
        {proposal.status === "pending" && (
          <div className="flex gap-2">
            <button
              onClick={() => handleAction("approved")}
              disabled={loading}
              className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              Approve
            </button>
            <button
              onClick={() => handleAction("rejected")}
              disabled={loading}
              className="px-3 py-1.5 bg-red-100 text-red-700 rounded text-xs font-medium hover:bg-red-200 disabled:opacity-50"
            >
              Reject
            </button>
            <button
              onClick={() => showModify ? handleAction("modified") : setShowModify(true)}
              disabled={loading}
              className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-xs font-medium hover:bg-gray-200 disabled:opacity-50"
            >
              {showModify ? "Apply Modified" : "Modify"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function parseProposalValue(value: string, field: string): unknown {
  if (field === "efficacy_score") return parseFloat(value) || 50;
  if (field === "time_weight") return value;
  return value;
}
