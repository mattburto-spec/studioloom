"use client";

import { useState, useEffect, useCallback } from "react";
import AdjustmentCard from "./AdjustmentCard";
import BatchActions from "./BatchActions";
import AuditLogTab from "./AuditLogTab";

interface Proposal {
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
}

interface Summary {
  pending: number;
  approved: number;
  rejected: number;
  efficacyPending: number;
  healingPending: number;
}

type Tab = "queue" | "audit";

export default function ApprovalQueue() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected">("pending");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("queue");

  const loadProposals = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: filter });
      if (typeFilter) params.set("type", typeFilter);
      const res = await fetch(`/api/admin/feedback?${params}`);
      if (!res.ok) throw new Error("Failed to load proposals");
      const data = await res.json();
      setProposals(data.proposals);
      setSummary(data.summary);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [filter, typeFilter]);

  useEffect(() => {
    loadProposals();
  }, [loadProposals]);

  const handleAction = async (
    proposalId: string,
    action: "approved" | "rejected" | "modified",
    modifiedValue?: unknown,
    note?: string
  ) => {
    const res = await fetch("/api/admin/feedback", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proposalId, action, modifiedValue, note }),
    });

    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Failed to update proposal");
      return;
    }

    // Remove from local list
    setProposals(prev => prev.filter(p => p.id !== proposalId));
    setSelectedIds(prev => prev.filter(id => id !== proposalId));
    if (summary) {
      setSummary({
        ...summary,
        pending: summary.pending - 1,
        [action === "rejected" ? "rejected" : "approved"]:
          summary[action === "rejected" ? "rejected" : "approved"] + 1,
      });
    }
  };

  const handleBatchAction = async (ids: string[], action: "approved" | "rejected", note?: string) => {
    for (const id of ids) {
      await handleAction(id, action, undefined, note);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const runBatch = async () => {
    setComputing(true);
    try {
      const res = await fetch("/api/admin/feedback", { method: "POST" });
      if (!res.ok) throw new Error("Batch computation failed");
      const data = await res.json();
      alert(
        `Batch complete: ${data.efficacyResults} efficacy, ${data.healingProposals} self-healing, ${data.proposalsInserted} proposals created`
      );
      loadProposals();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Batch failed");
    } finally {
      setComputing(false);
    }
  };

  const efficacyProposals = proposals.filter(p => p.proposal_type === "efficacy_adjustment");
  const healingProposals = proposals.filter(p => p.proposal_type === "self_healing");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Feedback Approval Queue</h2>
        <div className="flex gap-2">
          <button
            onClick={runBatch}
            disabled={computing}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
          >
            {computing ? "Computing..." : "Run Batch Analysis"}
          </button>
        </div>
      </div>

      {/* Tab bar: Queue vs Audit Log */}
      <div className="flex gap-1 border-b">
        <button
          onClick={() => setActiveTab("queue")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeTab === "queue"
              ? "border-purple-600 text-purple-700"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Approval Queue
        </button>
        <button
          onClick={() => setActiveTab("audit")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeTab === "audit"
              ? "border-purple-600 text-purple-700"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Audit Log
        </button>
      </div>

      {activeTab === "audit" ? (
        <AuditLogTab />
      ) : (
        <>
          {/* Summary pills */}
          {summary && (
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={() => setFilter("pending")}
                className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                  filter === "pending" ? "bg-amber-500 text-white" : "bg-amber-100 text-amber-700"
                }`}
              >
                Pending ({summary.pending})
              </button>
              <button
                onClick={() => setFilter("approved")}
                className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                  filter === "approved" ? "bg-emerald-500 text-white" : "bg-emerald-100 text-emerald-700"
                }`}
              >
                Approved ({summary.approved})
              </button>
              <button
                onClick={() => setFilter("rejected")}
                className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                  filter === "rejected" ? "bg-red-500 text-white" : "bg-red-100 text-red-700"
                }`}
              >
                Rejected ({summary.rejected})
              </button>
              <span className="border-l border-gray-200 mx-1" />
              <button
                onClick={() => setTypeFilter(typeFilter === "efficacy_adjustment" ? null : "efficacy_adjustment")}
                className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                  typeFilter === "efficacy_adjustment" ? "bg-blue-500 text-white" : "bg-blue-100 text-blue-700"
                }`}
              >
                Efficacy ({summary.efficacyPending})
              </button>
              <button
                onClick={() => setTypeFilter(typeFilter === "self_healing" ? null : "self_healing")}
                className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                  typeFilter === "self_healing" ? "bg-amber-500 text-white" : "bg-amber-100 text-amber-700"
                }`}
              >
                Self-Healing ({summary.healingPending})
              </button>
            </div>
          )}

          {/* Batch actions bar */}
          <BatchActions
            selectedIds={selectedIds}
            onBatchAction={handleBatchAction}
            onClearSelection={() => setSelectedIds([])}
          />

          {error && (
            <div className="bg-red-50 text-red-700 rounded-lg px-4 py-2 text-sm">{error}</div>
          )}

          {loading ? (
            <div className="text-gray-500 text-sm py-8 text-center">Loading proposals...</div>
          ) : proposals.length === 0 ? (
            <div className="text-gray-400 text-sm py-8 text-center">
              No {filter} proposals. {filter === "pending" && "Run batch analysis to generate proposals."}
            </div>
          ) : (
            <div className="space-y-8">
              {/* Efficacy Section */}
              {efficacyProposals.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    Efficacy Adjustments ({efficacyProposals.length})
                  </h3>
                  <div className="grid gap-3">
                    {efficacyProposals.map(p => (
                      <div key={p.id} className="flex items-start gap-2">
                        {filter === "pending" && (
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(p.id)}
                            onChange={() => toggleSelect(p.id)}
                            className="mt-4 h-4 w-4 rounded border-gray-300"
                          />
                        )}
                        <div className="flex-1">
                          <AdjustmentCard proposal={p} onAction={handleAction} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Self-Healing Section */}
              {healingProposals.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    Self-Healing Proposals ({healingProposals.length})
                  </h3>
                  <div className="grid gap-3">
                    {healingProposals.map(p => (
                      <div key={p.id} className="flex items-start gap-2">
                        {filter === "pending" && (
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(p.id)}
                            onChange={() => toggleSelect(p.id)}
                            className="mt-4 h-4 w-4 rounded border-gray-300"
                          />
                        )}
                        <div className="flex-1">
                          <AdjustmentCard proposal={p} onAction={handleAction} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
