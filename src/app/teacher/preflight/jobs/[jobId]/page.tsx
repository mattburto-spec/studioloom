"use client";

/**
 * /teacher/preflight/jobs/[jobId] — Phase 6-2.
 *
 * Teacher's per-submission review page. Fetches detail from
 * GET /api/teacher/fabrication/jobs/[jobId], renders read-only
 * ScanResultsViewer + revision history + TeacherActionBar.
 *
 * The 4 actions (approve / return-for-revision / reject / note) POST
 * to the Phase 6-1 endpoints. On success, we re-fetch the detail so
 * the page reflects the new status + updated note.
 */

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { ScanResultsViewer } from "@/components/fabrication/ScanResultsViewer";
import { RevisionHistoryPanel } from "@/components/fabrication/RevisionHistoryPanel";
import { TeacherActionBar } from "@/components/fabrication/TeacherActionBar";
import { PreviewCard } from "@/components/fabrication/PreviewCard";
import { buildFabricationDownloadFilename } from "@/lib/fabrication/download-filename";
import { canSubmit, type Rule } from "@/lib/fabrication/rule-buckets";
import type {
  TeacherJobDetailSuccess,
  TeacherRevisionSummary,
} from "@/lib/fabrication/teacher-orchestration";

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; detail: TeacherJobDetailSuccess };

export default function TeacherJobDetailPage() {
  const params = useParams<{ jobId: string }>();
  const router = useRouter();
  const jobId = params?.jobId;

  // Phase 6-6m: context-aware back navigation. Detail page is reachable
  // from the queue page, the per-student Fabrication tab, the per-class
  // Fabrication section, and direct-URL entry (email link / bookmark).
  // Hardcoding href="/teacher/preflight" was wrong for every path except
  // the queue. Use router.back() when we have history; fall back to the
  // queue for direct entries (window.history.length > 1 gate — otherwise
  // back() would exit the app entirely on a fresh tab).
  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/teacher/preflight");
    }
  }

  const [state, setState] = React.useState<LoadState>({ kind: "loading" });
  const [isBusy, setIsBusy] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = React.useState<string | null>(null);

  const fetchDetail = React.useCallback(async () => {
    if (!jobId) return;
    try {
      const res = await fetch(`/api/teacher/fabrication/jobs/${jobId}`, {
        credentials: "same-origin",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "" }));
        setState({
          kind: "error",
          message: body.error || `Couldn't load submission (HTTP ${res.status})`,
        });
        return;
      }
      const detail = (await res.json()) as TeacherJobDetailSuccess;
      setState({ kind: "ready", detail });
    } catch (e) {
      setState({
        kind: "error",
        message: e instanceof Error ? e.message : "Network error",
      });
    }
  }, [jobId]);

  React.useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  async function runAction(
    endpoint: "approve" | "return-for-revision" | "reject" | "note",
    body: Record<string, unknown>,
    successMessage: string
  ) {
    if (!jobId) return;
    setActionError(null);
    setActionSuccess(null);
    setIsBusy(true);
    try {
      const res = await fetch(
        `/api/teacher/fabrication/jobs/${jobId}/${endpoint}`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: "" }));
        setActionError(errBody.error || `Action failed (HTTP ${res.status})`);
        return;
      }
      setActionSuccess(successMessage);
      await fetchDetail();
      // Scroll to top so the teacher sees the success banner + the
      // updated status pill in the header. Without this, clicking
      // Approve from the bottom TeacherActionBar flashes a success
      // banner at the very top of the page — out of view behind the
      // teacher's current scroll position. Smooth scroll so it reads
      // as "page acknowledging your action" not a jarring teleport.
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Network error");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleApprove(note: string | undefined) {
    await runAction("approve", note ? { note } : {}, "Approved ✓");
  }
  async function handleReturn(note: string) {
    await runAction(
      "return-for-revision",
      { note },
      "Returned for revision ✓"
    );
  }
  async function handleReject(note: string | undefined) {
    await runAction("reject", note ? { note } : {}, "Rejected ✓");
  }
  async function handleSaveNote(note: string) {
    await runAction("note", { note }, "Note saved ✓");
  }

  return (
    <main className="max-w-6xl mx-auto px-6 py-10 space-y-6">
      <div className="text-sm">
        <button
          type="button"
          onClick={handleBack}
          className="text-brand-purple hover:underline transition-all active:scale-[0.97]"
        >
          ← Back
        </button>
      </div>

      {state.kind === "loading" && (
        <div className="flex items-center gap-3 py-12 justify-center">
          <div className="w-5 h-5 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-600">Loading submission…</span>
        </div>
      )}

      {state.kind === "error" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-900">{state.message}</p>
        </div>
      )}

      {state.kind === "ready" && (
        <ReadyView
          detail={state.detail}
          isBusy={isBusy}
          actionError={actionError}
          actionSuccess={actionSuccess}
          onApprove={handleApprove}
          onReturn={handleReturn}
          onReject={handleReject}
          onSaveNote={handleSaveNote}
        />
      )}
    </main>
  );
}

function ReadyView(props: {
  detail: TeacherJobDetailSuccess;
  isBusy: boolean;
  actionError: string | null;
  actionSuccess: string | null;
  onApprove: (note: string | undefined) => void;
  onReturn: (note: string) => void;
  onReject: (note: string | undefined) => void;
  onSaveNote: (note: string) => void;
}) {
  const { detail, isBusy, actionError, actionSuccess } = props;
  const scanResults = (detail.currentRevisionData?.scanResults ?? {
    rules: [],
  }) as { rules?: Rule[] | null };
  const gate = canSubmit({
    results: scanResults,
    acknowledgedWarnings: detail.acknowledgedWarnings,
    revisionNumber: detail.job.currentRevision,
  });

  const fileType: "stl" | "svg" = detail.job.fileType === "svg" ? "svg" : "stl";

  return (
    <>
      {/* Context header — full-width above the 2-column split so the
          student name + status pill are glanceable without eye-
          scanning a single column. */}
      <header className="rounded-2xl border border-gray-200 bg-white p-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {detail.student.name}
          {detail.classInfo && (
            <span className="text-gray-500 font-normal">
              {" "}— {detail.classInfo.name}
            </span>
          )}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600">
          <span>
            <strong>{detail.machine.name}</strong>
            {detail.machine.category && ` (${detail.machine.category.replace("_", " ")})`}
          </span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1.5">
            <code className="text-xs">{detail.job.originalFilename}</code>
            {detail.job.quantity > 1 && (
              <span
                className="inline-flex items-center rounded-full bg-purple-600 px-2 py-0.5 text-[10px] font-bold text-white"
                title={`${detail.job.quantity} copies requested`}
              >
                × {detail.job.quantity}
              </span>
            )}
          </span>
          <span aria-hidden="true">·</span>
          <span>Revision {detail.job.currentRevision}</span>
          <span aria-hidden="true">·</span>
          <span>
            Submitted {new Date(detail.job.createdAt).toLocaleString()}
          </span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span
            className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded ${statusPillClass(detail.job.status)}`}
          >
            {detail.job.status.replace(/_/g, " ")}
          </span>
          {detail.unit && (
            <span className="text-xs text-gray-500">
              Unit: {detail.unit.title}
            </span>
          )}
        </div>
      </header>

      {/* Two-column layout matching the student status page (6-6e/j):
          scan results + teacher action bar on the left, preview card
          + revision history on the right. Stacks to single column on
          mobile. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── LEFT COLUMN — banners + scan results + action bar ── */}
        <div className="lg:col-span-2 space-y-4">
          {actionError && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-900">{actionError}</p>
            </div>
          )}
          {actionSuccess && !actionError && (
            <div role="status" className="rounded-xl border border-green-200 bg-green-50 p-3">
              <p className="text-sm text-green-900">{actionSuccess}</p>
            </div>
          )}

          {/* Scan results (read-only). Header strip is suppressed —
              the right-column preview card renders a bigger thumbnail
              + context header card above already shows filename /
              machine / revision. */}
          <ScanResultsViewer
            scanResults={scanResults}
            acknowledgedWarnings={detail.acknowledgedWarnings}
            revisionNumber={detail.job.currentRevision}
            canSubmitState={gate}
            onAcknowledge={() => {}}
            onSubmit={() => {}}
            onReupload={() => {}}
            thumbnailUrl={detail.currentRevisionData?.thumbnailUrl ?? null}
            filename={detail.job.originalFilename}
            machineLabel={detail.machine.name}
            fileType={fileType}
            readOnly
            hideHeaderStrip
          />

          {/* Action bar — sits at the bottom of the left column so the
              teacher's primary actions are below the evidence they
              just reviewed. */}
          <TeacherActionBar
            jobStatus={detail.job.status}
            currentNote={detail.job.teacherReviewNote}
            isBusy={isBusy}
            onApprove={props.onApprove}
            onReturn={props.onReturn}
            onReject={props.onReject}
            onSaveNote={props.onSaveNote}
          />
        </div>

        {/* ── RIGHT COLUMN — preview + revision history ── */}
        <aside className="lg:col-span-1 space-y-4">
          <PreviewCard
            thumbnailUrl={detail.currentRevisionData?.thumbnailUrl ?? null}
            revisionNumber={detail.job.currentRevision}
            fileType={fileType}
            // Shows the filename the fabricator will see when they
            // download this file (Phase 6-6k). Originally Matt asked
            // teachers to mentally map "random-student-filename.stl"
            // to whose print it actually is; this previews the auto-
            // renamed version using student name + class + unit.
            // Context header above still shows the student's original
            // filename for reference.
            subtitle={buildFabricationDownloadFilename({
              studentName: detail.student.name,
              gradeLevel: detail.classInfo?.name ?? null,
              unitTitle: detail.unit?.title ?? null,
              originalFilename: detail.job.originalFilename,
              submittedAt: detail.job.createdAt,
            })}
          />

          {/* Revision history — hidden by the panel when only 1
              revision exists. */}
          <RevisionHistoryPanel
            revisions={detail.revisions.map(summaryToHistoryRow)}
            currentRevision={detail.job.currentRevision}
          />
        </aside>
      </div>
    </>
  );
}

/**
 * Adapter — TeacherRevisionSummary has the same shape the existing
 * RevisionHistoryPanel expects (via the RevisionSummary type from
 * student-side orchestration.ts). Values line up field-for-field.
 */
function summaryToHistoryRow(
  summary: TeacherRevisionSummary
): {
  id: string;
  revisionNumber: number;
  scanStatus: string | null;
  scanError: string | null;
  scanCompletedAt: string | null;
  thumbnailUrl: string | null;
  ruleCounts: { block: number; warn: number; fyi: number };
  createdAt: string;
} {
  return {
    id: summary.id,
    revisionNumber: summary.revisionNumber,
    scanStatus: summary.scanStatus,
    scanError: summary.scanError,
    scanCompletedAt: summary.scanCompletedAt,
    thumbnailUrl: summary.thumbnailUrl,
    ruleCounts: summary.ruleCounts,
    createdAt: summary.createdAt,
  };
}

function statusPillClass(status: string): string {
  switch (status) {
    case "approved":
    case "completed":
      return "bg-green-100 text-green-900";
    case "pending_approval":
      return "bg-amber-100 text-amber-900";
    case "needs_revision":
      return "bg-orange-100 text-orange-900";
    case "rejected":
    case "cancelled":
      return "bg-red-100 text-red-900";
    case "uploaded":
    case "scanning":
      return "bg-blue-100 text-blue-900";
    case "picked_up":
      return "bg-purple-100 text-purple-900";
    default:
      return "bg-gray-100 text-gray-900";
  }
}
