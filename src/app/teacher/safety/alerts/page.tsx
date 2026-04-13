"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

// ── Types ──

interface ModerationAlert {
  id: string;
  class_id: string | null;
  student_id: string;
  content_source: string;
  moderation_layer: string;
  flags: Array<{ type: string; severity: string; confidence: number; lang?: string }>;
  overall_result: string;
  severity: string;
  action_taken: string | null;
  teacher_reviewed: boolean;
  teacher_action: string | null;
  teacher_reviewed_at: string | null;
  created_at: string;
}

interface ClassOption {
  id: string;
  name: string;
}

// ── Helpers ──

const SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  warning: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  info: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: "Critical",
  warning: "Warning",
  info: "Info",
};

const SOURCE_LABELS: Record<string, string> = {
  student_progress: "Lesson Response",
  tool_session: "Toolkit Tool",
  gallery_post: "Gallery Submission",
  peer_review: "Peer Review",
  quest_evidence: "Quest Evidence",
  quest_sharing: "Quest Sharing",
  portfolio: "Portfolio",
  upload_image: "Image Upload",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Page ──

export default function TeacherSafetyAlertsPage() {
  const [alerts, setAlerts] = useState<ModerationAlert[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [classFilter, setClassFilter] = useState<string>("all");
  const [showReviewed, setShowReviewed] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [studentNames, setStudentNames] = useState<Map<string, string>>(new Map());

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (classFilter !== "all") params.set("class_id", classFilter);
      if (showReviewed) params.set("reviewed", "true");
      const res = await fetch(`/api/teacher/safety/alerts?${params}`);
      if (!res.ok) throw new Error("Failed to load alerts");
      const data = await res.json();
      const alertList: ModerationAlert[] = data.alerts || [];
      setAlerts(alertList);

      // Resolve student names (Lesson #22: junction-first + legacy fallback)
      const ids = [...new Set(alertList.map((a) => a.student_id))];
      if (ids.length > 0) {
        const supabase = createClient();
        const { data: students } = await supabase
          .from("students")
          .select("id, display_name, username")
          .in("id", ids);
        const nameMap = new Map<string, string>();
        for (const s of students || []) {
          nameMap.set(s.id, s.display_name || s.username || s.id.slice(0, 8));
        }
        setStudentNames(nameMap);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [classFilter, showReviewed]);

  // Fetch teacher's classes for filter dropdown
  useEffect(() => {
    async function loadClasses() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: classData } = await supabase
          .from("classes")
          .select("id, name")
          .eq("teacher_id", user.id)
          .order("name");
        if (classData) setClasses(classData);
      } catch {
        // Non-critical — dropdown just won't have class options
      }
    }
    loadClasses();
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleAction = async (alertId: string, action: "false_positive" | "acknowledged" | "escalated") => {
    setActioningId(alertId);
    try {
      const res = await fetch("/api/teacher/safety/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: alertId, action }),
      });
      if (!res.ok) throw new Error("Failed to update");
      // Refresh alerts
      await fetchAlerts();
    } catch {
      setError("Failed to update alert");
    } finally {
      setActioningId(null);
    }
  };

  const criticalAlerts = alerts.filter((a) => a.severity === "critical");
  const warningAlerts = alerts.filter((a) => a.severity === "warning");
  const infoAlerts = alerts.filter((a) => a.severity !== "critical" && a.severity !== "warning");

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Content Safety Alerts</h1>
          <p className="text-sm text-gray-500 mt-1">
            Review flagged student content across your classes
          </p>
        </div>
        {criticalAlerts.length > 0 && (
          <span className="px-3 py-1 bg-red-100 text-red-700 text-sm font-semibold rounded-full">
            {criticalAlerts.length} critical
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white"
        >
          <option value="all">All classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={showReviewed}
            onChange={(e) => setShowReviewed(e.target.checked)}
            className="rounded"
          />
          Show reviewed
        </label>
      </div>

      {loading && (
        <div className="text-center py-12 text-gray-400">Loading alerts...</div>
      )}

      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && alerts.length === 0 && (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">
            {showReviewed ? "📋" : "✅"}
          </div>
          <p className="text-gray-500 text-sm">
            {showReviewed
              ? "No alerts found for the selected filters."
              : "No unreviewed alerts. All clear!"}
          </p>
        </div>
      )}

      {/* Alert groups by severity */}
      {[
        { label: "Critical", items: criticalAlerts, key: "critical" },
        { label: "Warnings", items: warningAlerts, key: "warning" },
        { label: "Info", items: infoAlerts, key: "info" },
      ]
        .filter((group) => group.items.length > 0)
        .map((group) => (
          <div key={group.key} className="mb-8">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              {group.label} ({group.items.length})
            </h2>
            <div className="space-y-3">
              {group.items.map((alert) => {
                const colors = SEVERITY_COLORS[alert.severity] || SEVERITY_COLORS.info;
                return (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-lg border ${colors.border} ${colors.bg} ${
                      alert.teacher_reviewed ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors.text} bg-white/60`}>
                            {SEVERITY_LABELS[alert.severity] || alert.severity}
                          </span>
                          <span className="text-xs text-gray-500">
                            {SOURCE_LABELS[alert.content_source] || alert.content_source}
                          </span>
                          <span className="text-xs text-gray-400">
                            {formatDate(alert.created_at)}
                          </span>
                        </div>

                        {/* Flags */}
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {alert.flags.map((flag, i) => (
                            <span
                              key={i}
                              className="text-xs px-2 py-0.5 bg-white/80 rounded border border-gray-200 text-gray-700"
                            >
                              {flag.type}
                              {flag.lang && <span className="text-gray-400 ml-1">({flag.lang})</span>}
                              <span className="text-gray-400 ml-1">
                                {Math.round(flag.confidence * 100)}%
                              </span>
                            </span>
                          ))}
                        </div>

                        <div className="text-xs text-gray-500">
                          Student: <span className="font-medium">{studentNames.get(alert.student_id) || alert.student_id.slice(0, 8)}</span>
                          {alert.moderation_layer && (
                            <span className="ml-2">Layer: {alert.moderation_layer}</span>
                          )}
                          {alert.overall_result && (
                            <span className="ml-2">Result: {alert.overall_result}</span>
                          )}
                        </div>

                        {alert.teacher_reviewed && alert.teacher_action && (
                          <div className="mt-2 text-xs text-gray-500 italic">
                            Reviewed: {alert.teacher_action.replace("_", " ")}
                            {alert.teacher_reviewed_at && (
                              <span className="ml-1">on {formatDate(alert.teacher_reviewed_at)}</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      {!alert.teacher_reviewed && (
                        <div className="flex flex-col gap-1.5 flex-shrink-0">
                          {alert.severity === "critical" && (
                            <button
                              onClick={() => handleAction(alert.id, "escalated")}
                              disabled={actioningId === alert.id}
                              className="px-3 py-1 text-xs font-semibold rounded border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"
                            >
                              Escalate
                            </button>
                          )}
                          <button
                            onClick={() => handleAction(alert.id, "acknowledged")}
                            disabled={actioningId === alert.id}
                            className="px-3 py-1 text-xs font-medium rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          >
                            Acknowledge
                          </button>
                          <button
                            onClick={() => handleAction(alert.id, "false_positive")}
                            disabled={actioningId === alert.id}
                            className="px-3 py-1 text-xs font-medium rounded border border-gray-300 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                          >
                            False positive
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
    </div>
  );
}
