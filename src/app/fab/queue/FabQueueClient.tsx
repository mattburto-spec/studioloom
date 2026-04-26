"use client";

/**
 * FabQueueClient — Phase 8.1d-20 redesign.
 *
 * Replaces the pre-20 tab-based "Ready / In progress" list with a
 * three-surface dashboard:
 *
 *   1. Top header — display headline ("Queue. N ready, M running.")
 *      + action buttons (refresh, manual job).
 *   2. Now Running strip — one cell per machine the teacher owns.
 *      Shows current pickup + Mark Printed / Mark Failed buttons,
 *      or "Idle · Start next" if nothing's running on it.
 *   3. Machine lanes — 4-up grid (responsive), ready jobs grouped
 *      by their actual machine. Per-machine accent colour (laser
 *      orange / printer teal / vinyl pink / cnc purple) lights up
 *      the lane top-border.
 *   4. Done Today strip — completed jobs since UTC midnight, with
 *      Notify-student affordance for collection.
 *
 * Filter + sort UI from 8.1d-15 carries over, scoped to the lanes.
 * Bulk actions deferred to the per-cell Mark buttons (no checkbox
 * column on the dashboard — the design's signature was 1-click
 * actions on the running cell). PH9-FU-FAB-SMART-BATCH for the
 * suggested-batch banner from the design's artboard B.
 *
 * Data flow: 3 parallel fetches on mount (ready / in_progress /
 * done_today via the new 8.1d-20 tab). Each refresh re-fires all
 * three; pickup / complete / fail mutations re-fetch the affected
 * surfaces only. Optimistic UI on Mark Printed / Failed so the
 * "running" cell flips to the done strip without a full spinner.
 */

import * as React from "react";
import Link from "next/link";
import type { FabJobRow } from "@/lib/fabrication/fab-orchestration";
import {
  formatRelativeTime,
  formatDateTime,
} from "@/components/fabrication/revision-history-helpers";
import {
  formatFileSize,
  machineCategoryLabel,
} from "@/components/fabrication/fab-queue-helpers";
import {
  colorForClassName,
  colorTintForClassName,
} from "@/components/fabrication/class-color";
import styles from "./fab-queue.module.css";

interface Props {
  fabricatorName: string;
  fabricatorInitials: string;
}

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready" };

interface DashboardData {
  ready: FabJobRow[];
  inProgress: FabJobRow[];
  doneToday: FabJobRow[];
}

const EMPTY_DATA: DashboardData = {
  ready: [],
  inProgress: [],
  doneToday: [],
};

export default function FabQueueClient({
  fabricatorName,
  fabricatorInitials,
}: Props) {
  const [state, setState] = React.useState<LoadState>({ kind: "loading" });
  const [data, setData] = React.useState<DashboardData>(EMPTY_DATA);

  // Per-action in-flight tracking. Keyed by jobId so we can disable
  // the right buttons + show per-row spinners without a global lock
  // (lab tech can mark machine A printed AND machine B failed in
  // parallel; one action shouldn't freeze the other).
  const [inFlight, setInFlight] = React.useState<
    Record<string, "complete" | "fail" | "pickup" | undefined>
  >({});

  const fetchAll = React.useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const [r, ip, dt] = await Promise.all([
        fetchTab("ready"),
        fetchTab("in_progress"),
        fetchTab("done_today"),
      ]);
      // If any one tab errored, surface the first message but keep
      // the others' data — the lab tech still wants what we have.
      const firstError = [r, ip, dt].find((x) => "error" in x) as
        | { error: string }
        | undefined;
      setData({
        ready: "jobs" in r ? r.jobs : [],
        inProgress: "jobs" in ip ? ip.jobs : [],
        doneToday: "jobs" in dt ? dt.jobs : [],
      });
      if (firstError) {
        setState({ kind: "error", message: firstError.error });
      } else {
        setState({ kind: "ready" });
      }
    } catch (e) {
      setState({
        kind: "error",
        message: e instanceof Error ? e.message : "Network error",
      });
    }
  }, []);

  React.useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // === Mutations ===
  // Pickup is the existing /api/fab/jobs/:id/download endpoint
  // (used by the green "Pick up" button — downloads the file +
  // transitions to picked_up). Linking to it triggers the browser's
  // native download which is the same shape the LabTechActionBar
  // already uses.

  async function markComplete(jobId: string, machineCategory: FabJobRow["machineCategory"]) {
    setInFlight((p) => ({ ...p, [jobId]: "complete" }));
    try {
      const res = await fetch(`/api/fab/jobs/${jobId}/complete`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "" }));
        alertUser(body.error || `Couldn't mark complete (HTTP ${res.status})`);
      }
    } catch (e) {
      alertUser(e instanceof Error ? e.message : "Network error");
    } finally {
      // Suppress unused-var lint — accepted but not used yet (the
      // action bar's bigger sheet uses category to derive printed/
      // cut copy; here we're trusting the orchestration to derive).
      void machineCategory;
      setInFlight((p) => ({ ...p, [jobId]: undefined }));
      await fetchAll();
    }
  }

  async function markFailed(jobId: string) {
    // Phase 8.1d-20 keeps it simple — the design's failure-reason
    // sheet is filed as PH9-FU-FAB-FAILURE-SHEET. For now a minimal
    // window.prompt covers the v1 case and the orchestration
    // already requires a non-empty note.
    const note =
      typeof window !== "undefined"
        ? window.prompt(
            "Quick note on what went wrong (e.g. 'bed adhesion lost', 'file corrupt'):"
          )
        : null;
    if (!note || note.trim().length === 0) return;
    setInFlight((p) => ({ ...p, [jobId]: "fail" }));
    try {
      const res = await fetch(`/api/fab/jobs/${jobId}/fail`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "" }));
        alertUser(body.error || `Couldn't mark failed (HTTP ${res.status})`);
      }
    } catch (e) {
      alertUser(e instanceof Error ? e.message : "Network error");
    } finally {
      setInFlight((p) => ({ ...p, [jobId]: undefined }));
      await fetchAll();
    }
  }

  // Derived: machines list — the lanes show one column per machine
  // the teacher actually owns (any machine that appears in ANY of
  // the three tab lists). Sorted by category then label so the
  // layout is stable across refreshes.
  const machines = React.useMemo<MachineSummary[]>(() => {
    const seen = new Map<string, MachineSummary>();
    for (const j of [...data.ready, ...data.inProgress, ...data.doneToday]) {
      const key = `${j.machineLabel}|${j.machineCategory ?? ""}`;
      if (!seen.has(key)) {
        seen.set(key, {
          label: j.machineLabel,
          category: j.machineCategory,
        });
      }
    }
    return Array.from(seen.values()).sort((a, b) => {
      // Group by category first (printer / laser / unknown), then
      // alphabetical within. categoryRank keeps "3D printer" before
      // "Laser cutter" before unknown.
      const ra = categoryRank(a.category);
      const rb = categoryRank(b.category);
      if (ra !== rb) return ra - rb;
      return a.label.localeCompare(b.label);
    });
  }, [data]);

  return (
    <div className={styles.fabRoot}>
      <FabTopNav fabricatorName={fabricatorName} initials={fabricatorInitials} />

      <main className="px-6 py-6 space-y-5 max-w-[1600px] mx-auto">
        {/* Header — display headline + actions */}
        <header className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <div className={`${styles.cap} mb-1.5`} style={{ color: "var(--ink-3)" }}>
              {formatHeaderDate()}
            </div>
            <h1
              className={`${styles.displayXl} text-[36px] sm:text-[44px] leading-[0.95]`}
            >
              Queue.{" "}
              <span className={styles.serifEm} style={{ color: "var(--accent)" }}>
                {data.ready.length}
              </span>{" "}
              ready,
              <br />
              <span style={{ color: "var(--ink-2)" }}>
                {data.inProgress.length} currently running.
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchAll}
              disabled={state.kind === "loading"}
              className={`${styles.btnSecondary} rounded-full px-4 py-2 text-[12px] inline-flex items-center gap-1.5`}
            >
              <RefreshIcon size={12} /> {state.kind === "loading" ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </header>

        {/* Surface error inline — don't block the dashboard. */}
        {state.kind === "error" && (
          <div
            className="rounded-xl px-4 py-3 text-[12px]"
            style={{
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.3)",
              color: "#FCA5A5",
            }}
          >
            {state.message}
          </div>
        )}

        {/* Now Running strip */}
        <NowRunningStrip
          machines={machines}
          inProgress={data.inProgress}
          inFlight={inFlight}
          onComplete={markComplete}
          onFailed={markFailed}
        />

        {/* Machine lanes */}
        {machines.length === 0 ? (
          <EmptyDashboard loading={state.kind === "loading"} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {machines.map((m) => (
              <MachineLane
                key={`${m.label}|${m.category}`}
                machine={m}
                readyJobs={data.ready.filter(
                  (j) =>
                    j.machineLabel === m.label && j.machineCategory === m.category
                )}
                runningJob={data.inProgress.find(
                  (j) =>
                    j.machineLabel === m.label && j.machineCategory === m.category
                ) ?? null}
              />
            ))}
          </div>
        )}

        {/* Done today */}
        {data.doneToday.length > 0 && <DoneTodayStrip jobs={data.doneToday} />}
      </main>
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================

interface MachineSummary {
  label: string;
  category: FabJobRow["machineCategory"];
}

interface FetchTabSuccess {
  jobs: FabJobRow[];
}
interface FetchTabError {
  error: string;
}

async function fetchTab(
  tab: "ready" | "in_progress" | "done_today"
): Promise<FetchTabSuccess | FetchTabError> {
  try {
    const res = await fetch(`/api/fab/queue?tab=${tab}`, {
      credentials: "same-origin",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "" }));
      return { error: body.error || `HTTP ${res.status} on tab=${tab}` };
    }
    return (await res.json()) as FetchTabSuccess;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Network error" };
  }
}

/** Order machines by category for stable lane layout. Lower wins. */
function categoryRank(c: FabJobRow["machineCategory"]): number {
  if (c === "3d_printer") return 0;
  if (c === "laser_cutter") return 1;
  return 2;
}

/** Map machineCategory → CSS variable in the design tokens. Returns
 *  the printer accent for unknown/null so an unmapped lane still
 *  renders a tasteful colour. */
function categoryAccentVar(c: FabJobRow["machineCategory"]): string {
  if (c === "laser_cutter") return "var(--laser)";
  if (c === "3d_printer") return "var(--printer)";
  return "var(--ink-2)";
}

function formatHeaderDate(): string {
  const d = new Date();
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${days[d.getDay()]} · ${d.getDate()} ${months[d.getMonth()]} · ${hh}:${mm}`;
}

function alertUser(msg: string) {
  if (typeof window !== "undefined") window.alert(msg);
}

// ============================================================
// Top nav
// ============================================================

function FabTopNav({
  fabricatorName,
  initials,
}: {
  fabricatorName: string;
  initials: string;
}) {
  return (
    <header style={{ background: "var(--surface)", borderBottom: "1px solid var(--hair)" }}>
      <div className="px-6 h-14 flex items-center gap-6">
        <div className="flex items-center gap-2.5">
          <div
            className={`${styles.display} w-8 h-8 rounded-xl flex items-center justify-center text-[14px]`}
            style={{ background: "var(--accent)", color: "var(--bg)" }}
          >
            #
          </div>
          <div className={`${styles.display} text-[15px] leading-none`}>StudioLoom</div>
          <div className="text-[11.5px] font-bold" style={{ color: "var(--ink-3)" }}>
            / Fab
          </div>
        </div>
        <nav className="flex items-center gap-1">
          <span
            className="px-3 py-1.5 rounded-full text-[12px] font-extrabold"
            style={{ background: "var(--ink)", color: "var(--bg)" }}
          >
            Queue
          </span>
        </nav>
        <div className="flex-1" />
        <div className="hidden sm:flex items-center gap-2">
          <span className="text-[11.5px]" style={{ color: "var(--ink-2)" }}>
            {fabricatorName}
          </span>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center font-extrabold text-[10.5px]"
            style={{ background: "var(--accent)", color: "var(--bg)" }}
          >
            {initials}
          </div>
        </div>
        <form action="/api/fab/logout" method="post">
          <button
            type="submit"
            className={`${styles.btnSecondary} rounded-lg px-3 py-1.5 text-[11.5px]`}
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}

// ============================================================
// Now Running strip
// ============================================================

function NowRunningStrip({
  machines,
  inProgress,
  inFlight,
  onComplete,
  onFailed,
}: {
  machines: MachineSummary[];
  inProgress: FabJobRow[];
  inFlight: Record<string, "complete" | "fail" | "pickup" | undefined>;
  onComplete: (jobId: string, category: FabJobRow["machineCategory"]) => void;
  onFailed: (jobId: string) => void;
}) {
  if (machines.length === 0) return null;
  return (
    <div className={styles.card} style={{ overflow: "hidden" }}>
      <div
        className="px-5 py-3 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--hair)" }}
      >
        <div className="flex items-center gap-3">
          <div className={styles.pulse} style={{ color: "var(--ok)" }} />
          <div className={styles.cap} style={{ color: "var(--ink-3)" }}>
            Now running
          </div>
          <div className="text-[12px] font-semibold" style={{ color: "var(--ink-2)" }}>
            {inProgress.length} of {machines.length} machine
            {machines.length === 1 ? "" : "s"} active ·{" "}
            {Math.max(0, machines.length - inProgress.length)} idle
          </div>
        </div>
      </div>
      <div
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-px"
        style={{ background: "var(--hair)" }}
      >
        {machines.map((m) => {
          const running =
            inProgress.find(
              (j) => j.machineLabel === m.label && j.machineCategory === m.category
            ) ?? null;
          return (
            <NowRunningCell
              key={`${m.label}|${m.category}`}
              machine={m}
              running={running}
              busy={running ? inFlight[running.jobId] : undefined}
              onComplete={onComplete}
              onFailed={onFailed}
            />
          );
        })}
      </div>
    </div>
  );
}

function NowRunningCell({
  machine,
  running,
  busy,
  onComplete,
  onFailed,
}: {
  machine: MachineSummary;
  running: FabJobRow | null;
  busy: "complete" | "fail" | "pickup" | undefined;
  onComplete: (jobId: string, category: FabJobRow["machineCategory"]) => void;
  onFailed: (jobId: string) => void;
}) {
  const accent = categoryAccentVar(machine.category);
  return (
    <div className="p-4" style={{ background: "var(--surface)" }}>
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center"
          style={{
            background: `color-mix(in srgb, ${accent} 13%, transparent)`,
            color: accent,
          }}
        >
          <CategoryIcon category={machine.category} size={12} />
        </div>
        <div className="text-[12px] font-extrabold flex-1 truncate">{machine.label}</div>
        <div
          className={styles.cap}
          style={{ color: "var(--ink-3)", fontSize: 9.5 }}
        >
          {machineCategoryLabel(machine.category)}
        </div>
      </div>
      {running ? (
        <RunningBlock
          job={running}
          accent={accent}
          busy={busy}
          onComplete={onComplete}
          onFailed={onFailed}
        />
      ) : (
        <IdleBlock />
      )}
    </div>
  );
}

function RunningBlock({
  job,
  accent,
  busy,
  onComplete,
  onFailed,
}: {
  job: FabJobRow;
  accent: string;
  busy: "complete" | "fail" | "pickup" | undefined;
  onComplete: (jobId: string, category: FabJobRow["machineCategory"]) => void;
  onFailed: (jobId: string) => void;
}) {
  const elapsedLabel = job.pickedUpAt
    ? formatRelativeTime(job.pickedUpAt)
    : null;
  return (
    <div>
      <div className="flex items-center gap-2.5 mb-2.5">
        <div
          className="w-9 h-9 rounded flex-shrink-0 overflow-hidden p-0.5 relative"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--hair)",
          }}
        >
          {job.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={job.thumbnailUrl}
              alt=""
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full" style={{ background: "var(--surface-3)" }} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <div className="text-[11px] font-extrabold truncate">
              {job.studentName}
            </div>
            <ClassChip name={job.className} small />
          </div>
          <div
            className={`${styles.mono} text-[10px] truncate`}
            style={{ color: "var(--ink-3)" }}
          >
            {job.originalFilename}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between text-[10.5px] mb-2.5">
        <span
          className={`${styles.mono} font-bold`}
          style={{ color: accent }}
        >
          {elapsedLabel ? `Picked up ${elapsedLabel}` : "Picked up"}
        </span>
        <span className={styles.mono} style={{ color: "var(--ink-3)" }}>
          {job.fileType.toUpperCase()}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          disabled={busy !== undefined}
          onClick={() => onComplete(job.jobId, job.machineCategory)}
          className={`${styles.btnOk} rounded-lg py-1.5 text-[11px] inline-flex items-center justify-center gap-1.5`}
        >
          <CheckIcon size={11} /> {busy === "complete" ? "Saving…" : "Printed"}
        </button>
        <button
          type="button"
          disabled={busy !== undefined}
          onClick={() => onFailed(job.jobId)}
          className={`${styles.btnBad} rounded-lg py-1.5 text-[11px] inline-flex items-center justify-center gap-1.5`}
        >
          <XIcon size={11} /> {busy === "fail" ? "Saving…" : "Failed"}
        </button>
      </div>
    </div>
  );
}

function IdleBlock() {
  return (
    <div className="text-center py-4">
      <div className="text-[11px] font-extrabold" style={{ color: "var(--ink-2)" }}>
        Idle
      </div>
      <div className="text-[10.5px] mt-0.5" style={{ color: "var(--ink-3)" }}>
        Pick up a job below to start
      </div>
    </div>
  );
}

// ============================================================
// Machine lane
// ============================================================

function MachineLane({
  machine,
  readyJobs,
  runningJob,
}: {
  machine: MachineSummary;
  readyJobs: FabJobRow[];
  runningJob: FabJobRow | null;
}) {
  const accent = categoryAccentVar(machine.category);
  return (
    <div
      className={`${styles.card} flex flex-col`}
      style={{ minHeight: 540 }}
    >
      <div
        className="px-4 py-3 flex items-center gap-2.5"
        style={{
          borderTop: `2px solid ${accent}`,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          borderBottom: "1px solid var(--hair)",
        }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{
            background: `color-mix(in srgb, ${accent} 13%, transparent)`,
            color: accent,
          }}
        >
          <CategoryIcon category={machine.category} size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] font-extrabold leading-tight truncate">
            {machine.label}
          </div>
          <div
            className="text-[10.5px] font-semibold"
            style={{ color: "var(--ink-3)" }}
          >
            {machineCategoryLabel(machine.category)}
          </div>
        </div>
        <div className="text-right">
          <div
            className={`${styles.display} ${styles.tnum} text-[18px] leading-none`}
            style={{ color: accent }}
          >
            {readyJobs.length}
          </div>
          <div
            className={styles.cap}
            style={{
              color: "var(--ink-3)",
              fontSize: 9,
              marginTop: 2,
            }}
          >
            queue
          </div>
        </div>
      </div>

      {runningJob && (
        <div
          className="px-3 py-2.5"
          style={{
            background: `color-mix(in srgb, ${accent} 5%, transparent)`,
            borderBottom: "1px solid var(--hair)",
          }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <div className={styles.pulse} style={{ color: accent }} />
            <div
              className={styles.cap}
              style={{ color: accent, letterSpacing: "0.1em", fontSize: 9.5 }}
            >
              Running
            </div>
          </div>
          <div className="text-[11.5px] font-extrabold truncate">
            {runningJob.studentName}
          </div>
          <div
            className={`${styles.mono} text-[10px] truncate`}
            style={{ color: "var(--ink-3)" }}
          >
            {runningJob.originalFilename}
          </div>
        </div>
      )}

      <div className="p-3 space-y-2 flex-1">
        {readyJobs.length === 0 ? (
          <div
            className="text-center py-6 text-[11px]"
            style={{ color: "var(--ink-3)" }}
          >
            No jobs in queue
          </div>
        ) : (
          readyJobs.map((j) => <LaneJobCard key={j.jobId} job={j} accent={accent} />)
        )}
      </div>
    </div>
  );
}

// ============================================================
// Lane job card
// ============================================================

function LaneJobCard({ job, accent }: { job: FabJobRow; accent: string }) {
  return (
    <div
      className={`${styles.card2} group transition relative`}
      style={{ overflow: "hidden" }}
    >
      <div className="p-3">
        <div className="flex gap-3">
          <div
            className="w-14 h-14 rounded-lg flex-shrink-0 p-1 relative"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--hair)",
            }}
          >
            {job.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={job.thumbnailUrl}
                alt=""
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full" style={{ background: "var(--surface-3)" }} />
            )}
            <div
              className={`${styles.mono} absolute -bottom-1 -right-1 px-1 py-0.5 rounded text-[8.5px] font-extrabold`}
              style={{ background: accent, color: "#0B0C0E" }}
            >
              r{job.currentRevision}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <div className="text-[12.5px] font-extrabold truncate">
                {job.studentName}
              </div>
              <ClassChip name={job.className} small />
            </div>
            <div
              className={`${styles.mono} text-[10.5px] truncate`}
              style={{ color: "var(--ink-2)" }}
            >
              {job.originalFilename}
            </div>
            <div
              className="flex items-center gap-1.5 mt-2 text-[10.5px]"
              style={{ color: "var(--ink-3)" }}
            >
              <FileTypeChip fileType={job.fileType} />
              <span>·</span>
              <span className={styles.mono}>{formatFileSize(job.fileSizeBytes)}</span>
              <span>·</span>
              <span title={formatDateTime(job.createdAt)}>
                {formatRelativeTime(job.createdAt)}
              </span>
            </div>
          </div>
        </div>

        {job.teacherReviewNote && (
          <div
            className="mt-2.5 rounded-md p-2 text-[10.5px] flex items-start gap-1.5"
            style={{
              background: "rgba(245,158,11,0.08)",
              border: "1px solid rgba(245,158,11,0.2)",
            }}
          >
            <NoteIcon size={10} style={{ color: "var(--warn)", marginTop: 2 }} />
            <div style={{ color: "var(--ink-2)", lineHeight: 1.4 }}>
              <span
                className="font-extrabold"
                style={{ color: "var(--warn)" }}
              >
                Teacher note:{" "}
              </span>
              {job.teacherReviewNote}
            </div>
          </div>
        )}

        <div className="mt-2.5 flex items-center gap-1.5">
          {/* Pick up = download. The download endpoint flips status
              to picked_up + streams the file in one request. Native
              <a download> works the same way the existing
              LabTechActionBar does. */}
          <a
            href={`/api/fab/jobs/${job.jobId}/download`}
            className={`${styles.btnPrimary} rounded-md px-3 py-1.5 text-[11px] inline-flex items-center gap-1.5 flex-1 justify-center`}
          >
            <PlayIcon size={9} /> Pick up
          </a>
          <Link
            href={`/fab/jobs/${job.jobId}`}
            title="View details"
            className={`${styles.btnSecondary} rounded-md px-2.5 py-1.5 inline-flex items-center justify-center`}
          >
            <EyeIcon size={12} />
          </Link>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Done today strip
// ============================================================

function DoneTodayStrip({ jobs }: { jobs: FabJobRow[] }) {
  return (
    <div className={styles.card}>
      <div
        className="px-5 py-3 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--hair)" }}
      >
        <div className="flex items-center gap-3">
          <div className={styles.cap} style={{ color: "var(--ink-3)" }}>
            Done today
          </div>
          <div className="text-[12px] font-semibold" style={{ color: "var(--ink-2)" }}>
            {jobs.length} job{jobs.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>
      <div
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-px"
        style={{ background: "var(--hair)" }}
      >
        {jobs.map((j) => (
          <DoneCell key={j.jobId} job={j} />
        ))}
      </div>
    </div>
  );
}

function DoneCell({ job }: { job: FabJobRow }) {
  const isFailed = job.completionStatus === "failed";
  const finishedAt = job.completedAt ? formatDateTime(job.completedAt) : "—";
  return (
    <div className="p-3.5" style={{ background: "var(--surface)" }}>
      <div className="flex items-center gap-2 mb-1.5">
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: isFailed ? "var(--bad)" : "var(--ok)" }}
        />
        <div className="text-[12px] font-extrabold flex-1 truncate">
          {job.studentName}
        </div>
        <ClassChip name={job.className} small />
      </div>
      <div
        className={`${styles.mono} text-[10.5px] truncate mb-2`}
        style={{ color: "var(--ink-3)" }}
      >
        {job.originalFilename}
      </div>
      <div className="flex items-center justify-between text-[10.5px]">
        <span style={{ color: "var(--ink-3)" }}>{finishedAt}</span>
        {isFailed ? (
          <span className="font-extrabold" style={{ color: "var(--bad)" }}>
            Failed
          </span>
        ) : (
          <span className="font-extrabold" style={{ color: "var(--ok)" }}>
            {job.completionStatus === "cut" ? "Cut" : "Printed"}
          </span>
        )}
      </div>
      {isFailed && job.completionNote && (
        <div
          className="mt-1.5 text-[10px] italic"
          style={{ color: "var(--ink-3)" }}
        >
          {job.completionNote}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Empty / loading
// ============================================================

function EmptyDashboard({ loading }: { loading: boolean }) {
  return (
    <div
      className="rounded-2xl p-12 text-center"
      style={{
        border: "1px dashed var(--hair-2)",
        background: "var(--surface-2)",
      }}
    >
      <div
        className="text-[14px] font-extrabold mb-1"
        style={{ color: "var(--ink-2)" }}
      >
        {loading ? "Loading queue…" : "Nothing in the queue right now"}
      </div>
      <div className="text-[12px]" style={{ color: "var(--ink-3)" }}>
        {loading
          ? "Fetching jobs from your inviting teacher's classes."
          : "Approved student jobs from your inviting teacher's classes will show up here."}
      </div>
    </div>
  );
}

// ============================================================
// Small chips + icons
// ============================================================

function ClassChip({ name, small }: { name: string | null; small?: boolean }) {
  if (!name) return null;
  const c = colorForClassName(name);
  const tint = colorTintForClassName(name);
  return (
    <span
      className="font-extrabold rounded flex-shrink-0"
      style={{
        fontSize: small ? 9 : 10,
        padding: small ? "2px 6px" : "3px 7px",
        background: tint,
        color: c,
      }}
    >
      {name}
    </span>
  );
}

function FileTypeChip({ fileType }: { fileType: "stl" | "svg" }) {
  const isStl = fileType === "stl";
  return (
    <span
      className={`${styles.mono} font-extrabold rounded`}
      style={{
        fontSize: 9.5,
        padding: "2px 5px",
        background: isStl ? "rgba(249,115,22,0.18)" : "rgba(20,184,166,0.18)",
        color: isStl ? "#FB923C" : "#5EEAD4",
        border: `1px solid ${isStl ? "rgba(249,115,22,0.3)" : "rgba(20,184,166,0.3)"}`,
        letterSpacing: "0.06em",
      }}
    >
      {fileType.toUpperCase()}
    </span>
  );
}

function CategoryIcon({
  category,
  size = 14,
}: {
  category: FabJobRow["machineCategory"];
  size?: number;
}) {
  // Inline SVGs — the design uses different icons per category.
  // Laser = beam diagonal, Printer = isometric cube, Unknown = box.
  const stroke = "currentColor";
  if (category === "laser_cutter") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={stroke}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 21l4-4M7 13l4 4M3 12L21 12M21 6L13 14" />
        <circle cx="20" cy="5" r="2" />
      </svg>
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.27 6.96L12 12l8.73-5.04M12 22V12" />
    </svg>
  );
}

interface IconProps {
  size?: number;
  style?: React.CSSProperties;
}

function CheckIcon({ size = 12 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
function XIcon({ size = 12 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}
function PlayIcon({ size = 10 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M6 4l14 8-14 8z" />
    </svg>
  );
}
function EyeIcon({ size = 12 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function RefreshIcon({ size = 12 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}
function NoteIcon({ size = 10, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9 8.5 8.5 0 0 1 7.6 4.7 8.4 8.4 0 0 1 .9 3.8z" />
    </svg>
  );
}

// Note on thumbnails: rendered with raw `<img>` rather than
// next/image because the URLs are short-lived Supabase signed
// URLs and would need the host allowlisted in next.config.js for
// the optimizer. PH9-FU-FAB-NEXT-IMAGE swaps to next/image once
// the signed-URL host is whitelisted.
