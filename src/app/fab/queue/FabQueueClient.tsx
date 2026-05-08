"use client";

/**
 * CategoryDashboard — Phase 8.1d-23 layout rebuild.
 *
 * Per-category fabricator page (3D printing OR laser cutting).
 * Mounted by /fab/queue/printer and /fab/queue/laser. Renamed
 * conceptually from FabQueueClient — kept the filename for git
 * history continuity.
 *
 * Layout (matches Matt's spatial spec, not the design canvas's
 * artboard A which we built in 8.1d-20 + had to rebuild):
 *
 *   ┌─ Top nav: brand + category switcher + sign-out ────────────┐
 *   │                                                              │
 *   ├─ Header: display headline ("3D Printing. N incoming, M run") │
 *   │                                                              │
 *   ├─ Incoming row (horizontal scroll) ─────────────────────────┐ │
 *   │   approved + machine_profile_id IS NULL jobs in this        │ │
 *   │   category. Cards: thumbnail + student + class + filename   │ │
 *   │   + Send-to → menu of compatible machines.                  │ │
 *   ├─────────────────────────────────────────────────────────────┘ │
 *   │                                                                │
 *   └─ Machine columns (grid, one per machine in this category) ──┐ │
 *       Per column:                                                 │ │
 *         - Header (machine name + status + queue count)            │ │
 *         - NOW RUNNING block (picked_up by anyone) — Mark P/F here │ │
 *         - QUEUE list (approved + assigned to this machine, not    │ │
 *                       yet started) — each card has Start button   │ │
 *                       (= download + flip to picked_up)            │ │
 *         - Drop zone (visual hint; drag-and-drop = future polish)  │ │
 *       ─────────────────────────────────────────────────────────────┘
 *
 * "Done today" deliberately removed from this view — it conflicts
 * with the active-triage mental model. Filed
 * PH9-FU-FAB-COLLECTION-VIEW for a separate page when teachers /
 * students want a collection-readiness surface.
 *
 * Job lifecycle from fab's POV:
 *   approved + machine null    → INCOMING ROW
 *   approved + machine bound   → COLUMN QUEUE for that machine
 *   picked_up                  → COLUMN NOW RUNNING for that machine
 *   completed                  → leaves the dashboard (logged elsewhere)
 *
 * Data flow: 3 parallel fetches on mount (ready / in_progress /
 * machines). No done_today fetch on this surface. Each mutation
 * (assign / start / mark printed / mark failed) re-fetches all
 * three. PH9-FU-FAB-DRAG-ASSIGN will replace the Send-to menu UI
 * with framer-motion drag but call the same API.
 */

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import type { FabJobRow } from "@/lib/fabrication/fab-orchestration";
import {
  formatRelativeTime,
  formatDateTime,
} from "@/components/fabrication/revision-history-helpers";
import { formatFileSize } from "@/components/fabrication/fab-queue-helpers";
import {
  colorForClassName,
  colorTintForClassName,
} from "@/components/fabrication/class-color";
import styles from "./fab-queue.module.css";

type Category = "3d_printer" | "laser_cutter";

interface Props {
  category: Category;
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
  // Phase 8.1d-29: re-added for the per-tab "done today" count in
  // the top nav. The full Done Today strip stays removed from the
  // dashboard body (8.1d-23 decision); this is JUST the count.
  doneToday: FabJobRow[];
}

const EMPTY_DATA: DashboardData = { ready: [], inProgress: [], doneToday: [] };

// Phase 8.1d-28: canned reasons for the Mark Failed modal. Picked
// from the most common modes Matt's flagged in smoke + standard
// 3D-print failure causes. "Other" intentionally omitted — empty
// chip selection is the same as "Other", and the textarea is
// always editable so a fab can write anything.
const FAILURE_REASON_CHIPS: ReadonlyArray<string> = [
  "Bed adhesion lost",
  "Warped / lifted off bed",
  "Filament jam",
  "Layer shift",
  "File corrupt / wouldn't slice",
  "Out of material",
  "Nozzle clog",
  "First-layer issue",
];

interface FabMachineOption {
  id: string;
  name: string;
  lab_id: string | null;
  lab_name: string | null;
  machine_category: Category | null;
}

// Phase 8.1d-26b: portal anchor lives inside .fabRoot so the
// portalled Send-to menu inherits the dark-theme CSS variables
// (--surface, --ink, etc). Without this, document.body doesn't
// cascade fabRoot's vars and the menu renders as a near-invisible
// faint outline (caught by Matt's screenshot 27 Apr).
const PortalAnchorContext = React.createContext<HTMLElement | null>(null);

export default function CategoryDashboard({
  category,
  fabricatorName,
  fabricatorInitials,
}: Props) {
  const [state, setState] = React.useState<LoadState>({ kind: "loading" });
  const [data, setData] = React.useState<DashboardData>(EMPTY_DATA);
  // The portal anchor element is set after mount; this state
  // tracks its current value so children re-render once it's
  // available (refs alone don't trigger re-renders).
  const [portalAnchor, setPortalAnchor] = React.useState<HTMLElement | null>(
    null
  );
  const [machines, setMachines] = React.useState<FabMachineOption[]>([]);

  const [inFlight, setInFlight] = React.useState<
    Record<string, "complete" | "fail" | "start" | "assign" | "unassign" | "delete" | undefined>
  >({});

  // Phase 8.1d-26: lab filter. "all" = no filter (default — single-
  // lab schools never see the pill bar). Otherwise a specific lab_id
  // narrows incoming jobs + machine columns. Persists to URL via
  // ?lab= so a fab tech can bookmark "Lab B printer queue."
  const [labFilter, setLabFilter] = React.useState<string>("all");

  // Phase 8.1d-26: any in-flight mutation pauses auto-refresh so a
  // poll doesn't blow up the optimistic state mid-action. Tracks
  // count, not bool, so two concurrent mutations don't unpause when
  // one resolves.
  const mutatingCount = React.useRef(0);

  // Phase 8.1d-28: failure-reason modal state. Replaces the ugly
  // window.prompt with a styled modal that has canned chips. Null
  // = closed; { jobId } = open for that job. Confirm/cancel come
  // from inside the modal.
  const [failModalJobId, setFailModalJobId] = React.useState<string | null>(
    null
  );

  // Phase 8.1d-31: confirm modals for the two destructive
  // fabricator-side actions. Both replace native window.confirm —
  // the browser's chrome looked terrible against the dark theme
  // (caught by Matt's screenshot 27 Apr) AND scope was needed for
  // a permanent-delete action that didn't exist yet.
  //
  //   unassign — reversible (job goes back to incoming)
  //   delete   — permanent (DB cascade + Storage wipe)
  //
  // Each holds the resolved job row so the modal can show student
  // name + class without a re-query, and so the message can adapt
  // to the job's current lane.
  const [unassignConfirm, setUnassignConfirm] = React.useState<FabJobRow | null>(
    null
  );
  const [deleteConfirm, setDeleteConfirm] = React.useState<FabJobRow | null>(
    null
  );

  // Phase 8.1d-26: track the last-completed fetch so the auto-
  // refresh effect doesn't fire while one's already in flight.
  const fetchInFlight = React.useRef(false);

  const fetchAll = React.useCallback(async (opts?: { silent?: boolean }) => {
    // Phase 8.1d-26: silent mode skips the loading-state flash so
    // auto-refresh doesn't blank the UI every 30s. Still updates
    // data + sets error/ready when the fetch resolves.
    const silent = opts?.silent === true;
    if (fetchInFlight.current) return; // single-flight guard
    fetchInFlight.current = true;
    if (!silent) setState({ kind: "loading" });
    try {
      const [r, ip, dt, m] = await Promise.all([
        fetchTab("ready"),
        fetchTab("in_progress"),
        fetchTab("done_today"),
        fetchMachines(),
      ]);
      // Done-today errors are non-fatal — it's just for the count
      // chip in the nav, the dashboard still works without it. Strip
      // its error from the firstError surface so a flaky done-today
      // poll doesn't blank a working dashboard.
      const firstError = [r, ip, m].find((x) => "error" in x) as
        | { error: string }
        | undefined;
      setData({
        ready: "jobs" in r ? r.jobs : [],
        inProgress: "jobs" in ip ? ip.jobs : [],
        doneToday: "jobs" in dt ? dt.jobs : [],
      });
      if ("machines" in m) setMachines(m.machines);
      setState(firstError ? { kind: "error", message: firstError.error } : { kind: "ready" });
    } catch (e) {
      setState({
        kind: "error",
        message: e instanceof Error ? e.message : "Network error",
      });
    } finally {
      fetchInFlight.current = false;
    }
  }, []);

  // Initial load.
  React.useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // Phase 8.1d-26: 30-second auto-refresh in silent mode. Skipped
  // when a mutation's in flight (single-flight guard inside
  // fetchAll handles overlapping polls; this guard handles a poll
  // landing mid-mutation that would clobber optimistic state).
  React.useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (mutatingCount.current > 0) return;
      void fetchAll({ silent: true });
    }, 30_000);
    return () => window.clearInterval(intervalId);
  }, [fetchAll]);

  // Mutations =============================================
  async function assignToMachine(jobId: string, machineProfileId: string) {
    setInFlight((p) => ({ ...p, [jobId]: "assign" }));
    mutatingCount.current += 1;
    try {
      const res = await fetch(`/api/fab/jobs/${jobId}/assign-machine`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ machineProfileId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "" }));
        alertUser(body.error || `Couldn't assign machine (HTTP ${res.status})`);
      }
    } catch (e) {
      alertUser(e instanceof Error ? e.message : "Network error");
    } finally {
      setInFlight((p) => ({ ...p, [jobId]: undefined }));
      mutatingCount.current = Math.max(0, mutatingCount.current - 1);
      await fetchAll();
    }
  }

  // Phase 8.1d (4 May 2026 polish): Start = download + flip to
  // picked_up. Previously a plain <a href="/api/fab/jobs/[id]/download">
  // link — the browser navigated to the endpoint, status flipped
  // server-side as a side-effect of the GET, file downloaded. UX
  // problem: zero feedback during the download. For a 200kB file
  // it looked instant; for a 50MB file the user clicked "Start"
  // and saw nothing change for several seconds, then suddenly
  // the buttons morphed into Mark printed / Mark failed.
  //
  // Fix: fetch + blob + programmatic anchor click. Sets inFlight
  // to "start" immediately so the button shows a spinner +
  // "Downloading..." text. Finishes by re-fetching the dashboard
  // to pick up the picked_up status. File still saves via the
  // browser's download dialog (we trigger it via a programmatic
  // <a download>).
  async function startAndDownload(jobId: string, filename: string) {
    setInFlight((p) => ({ ...p, [jobId]: "start" }));
    mutatingCount.current += 1;
    try {
      const res = await fetch(`/api/fab/jobs/${jobId}/download`, {
        credentials: "same-origin",
      });
      if (!res.ok) {
        const errBody = await res
          .text()
          .then((t) => {
            try {
              return JSON.parse(t).error;
            } catch {
              return t;
            }
          })
          .catch(() => "");
        alertUser(errBody || `Couldn't start job (HTTP ${res.status})`);
        return;
      }
      // Server responded with the file + Content-Disposition. Status
      // is already flipped to picked_up server-side regardless of
      // whether we successfully save the blob.
      // Prefer the server's filename hint if present.
      const cd = res.headers.get("Content-Disposition") || "";
      const cdMatch = cd.match(/filename="?([^";]+)"?/i);
      const downloadName = cdMatch?.[1] ?? filename;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Revoke after a tick so the browser has time to grab the blob.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      alertUser(e instanceof Error ? e.message : "Network error");
    } finally {
      setInFlight((p) => ({ ...p, [jobId]: undefined }));
      mutatingCount.current = Math.max(0, mutatingCount.current - 1);
      await fetchAll();
    }
  }

  async function markComplete(jobId: string) {
    setInFlight((p) => ({ ...p, [jobId]: "complete" }));
    mutatingCount.current += 1;
    try {
      const res = await fetch(`/api/fab/jobs/${jobId}/complete`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        // Phase 8.1d-28: server expects `completion_note`. Earlier
        // 8.1d-20 redesign sent `note` and the server silently
        // ignored it (no harm — completion is allowed without a
        // note — but worth the rename for consistency with /fail).
        body: JSON.stringify({ completion_note: null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "" }));
        alertUser(body.error || `Couldn't mark complete (HTTP ${res.status})`);
      }
    } catch (e) {
      alertUser(e instanceof Error ? e.message : "Network error");
    } finally {
      setInFlight((p) => ({ ...p, [jobId]: undefined }));
      mutatingCount.current = Math.max(0, mutatingCount.current - 1);
      await fetchAll();
    }
  }

  async function unassignFromMachine(jobId: string) {
    setInFlight((p) => ({ ...p, [jobId]: "unassign" }));
    mutatingCount.current += 1;
    try {
      const res = await fetch(`/api/fab/jobs/${jobId}/unassign`, {
        method: "POST",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "" }));
        alertUser(
          body.error || `Couldn't remove the job (HTTP ${res.status})`
        );
      }
    } catch (e) {
      alertUser(e instanceof Error ? e.message : "Network error");
    } finally {
      setInFlight((p) => ({ ...p, [jobId]: undefined }));
      mutatingCount.current = Math.max(0, mutatingCount.current - 1);
      await fetchAll();
    }
  }

  // Phase 8.1d-31: permanent purge. Cascades to revisions +
  // scan_jobs + Storage bytes server-side. The card animates out
  // via AnimatePresence on the next refetch — same as unassign,
  // but the row never comes back.
  async function deleteJobAsync(jobId: string) {
    setInFlight((p) => ({ ...p, [jobId]: "delete" }));
    mutatingCount.current += 1;
    try {
      const res = await fetch(`/api/fab/jobs/${jobId}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "" }));
        alertUser(
          body.error || `Couldn't delete the job (HTTP ${res.status})`
        );
      }
    } catch (e) {
      alertUser(e instanceof Error ? e.message : "Network error");
    } finally {
      setInFlight((p) => ({ ...p, [jobId]: undefined }));
      mutatingCount.current = Math.max(0, mutatingCount.current - 1);
      await fetchAll();
    }
  }

  // Phase 8.1d-28: opens the styled failure-reason modal. Modal's
  // confirm callback wires through to submitFailed below. Replaces
  // the previous inline window.prompt which (a) looked terrible,
  // (b) had no canned reasons, and (c) sent the wrong field name
  // so the server rejected the note as missing.
  function openFailModal(jobId: string) {
    setFailModalJobId(jobId);
  }

  async function submitFailed(jobId: string, note: string) {
    const trimmed = note.trim();
    if (trimmed.length === 0) return;
    setInFlight((p) => ({ ...p, [jobId]: "fail" }));
    mutatingCount.current += 1;
    try {
      const res = await fetch(`/api/fab/jobs/${jobId}/fail`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        // Phase 8.1d-28 fix: the server expects `completion_note`,
        // not `note`. The previous code sent `note` and got a
        // confusing "A note is required" rejection because the
        // server read body.completion_note as undefined.
        body: JSON.stringify({ completion_note: trimmed }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "" }));
        alertUser(body.error || `Couldn't mark failed (HTTP ${res.status})`);
      }
    } catch (e) {
      alertUser(e instanceof Error ? e.message : "Network error");
    } finally {
      setInFlight((p) => ({ ...p, [jobId]: undefined }));
      mutatingCount.current = Math.max(0, mutatingCount.current - 1);
      await fetchAll();
    }
  }

  // Filter to this category =============================
  const categoryMachines = React.useMemo(
    () => machines.filter((m) => m.machine_category === category),
    [machines, category]
  );
  const categoryReady = React.useMemo(
    () => data.ready.filter((j) => j.machineCategory === category),
    [data.ready, category]
  );
  const categoryInProgress = React.useMemo(
    () => data.inProgress.filter((j) => j.machineCategory === category),
    [data.inProgress, category]
  );

  // Phase 8.1d-26: distinct labs in this category, sorted by name
  // for the lab-pill bar. The pill bar only renders when there's
  // more than one — single-lab schools don't need it.
  const labOptions = React.useMemo<Array<{ id: string; name: string }>>(() => {
    const seen = new Map<string, { id: string; name: string }>();
    for (const m of categoryMachines) {
      if (m.lab_id && m.lab_name && !seen.has(m.lab_id)) {
        seen.set(m.lab_id, { id: m.lab_id, name: m.lab_name });
      }
    }
    return Array.from(seen.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [categoryMachines]);

  // Apply lab filter on top of category filter.
  const visibleMachines = React.useMemo(
    () =>
      labFilter === "all"
        ? categoryMachines
        : categoryMachines.filter((m) => m.lab_id === labFilter),
    [categoryMachines, labFilter]
  );
  const visibleReady = React.useMemo(
    () =>
      labFilter === "all"
        ? categoryReady
        : categoryReady.filter((j) => j.labId === labFilter),
    [categoryReady, labFilter]
  );
  const visibleInProgress = React.useMemo(
    () =>
      labFilter === "all"
        ? categoryInProgress
        : categoryInProgress.filter((j) => j.labId === labFilter),
    [categoryInProgress, labFilter]
  );

  // Incoming = approved + unassigned in this category (after lab filter).
  const incomingJobs = React.useMemo(
    () => visibleReady.filter((j) => j.machineProfileId === null),
    [visibleReady]
  );

  return (
    <PortalAnchorContext.Provider value={portalAnchor}>
    <div className={styles.fabRoot}>
      {/* Phase 8.1d-26b: portal target for popovers (Send-to menu).
           Lives inside .fabRoot so CSS vars cascade. position:fixed
           on the menu itself escapes any overflow clip — this div's
           position is irrelevant. */}
      <div ref={setPortalAnchor} aria-hidden="true" />
      <FabTopNav
        category={category}
        fabricatorName={fabricatorName}
        initials={fabricatorInitials}
        // Phase 8.1d-29: per-category counts for the tab summary +
        // pulse-on-attention indicator. Filter against unfiltered
        // data (not the lab-filtered visibleX) — the nav is global,
        // not lab-scoped.
        //
        // Phase 8.1d-30: count only RENDERABLE jobs. Ghost jobs
        // whose machine_profile_id points to a since-deleted /
        // soft-deleted machine still exist in the DB but the
        // dashboard can't show them (no column to render into).
        // Counting them inflates the nav badge above what the body
        // actually displays — caught by Matt's smoke 27 Apr ("nav
        // says 6 in laser, only 1 visible"). Use the same predicate
        // the body uses to decide what to render: unassigned (will
        // show in incoming row) OR assigned to a machine we know
        // about (will show in that column).
        printerCounts={categoryCountsFor(
          "3d_printer",
          data,
          machines
        )}
        laserCounts={categoryCountsFor(
          "laser_cutter",
          data,
          machines
        )}
      />

      <main className="px-6 py-6 space-y-5 max-w-[1600px] mx-auto">
        <DashboardHeader
          category={category}
          incomingCount={incomingJobs.length}
          runningCount={visibleInProgress.length}
          machineCount={visibleMachines.length}
          state={state}
          onRefresh={() => fetchAll()}
        />

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

        {/* Phase 8.1d-26: lab filter pills. Only render with >1 lab —
            single-lab schools don't need the chrome. */}
        {labOptions.length > 1 && (
          <LabFilterBar
            options={labOptions}
            value={labFilter}
            onChange={setLabFilter}
          />
        )}

        <IncomingRow
          jobs={incomingJobs}
          machines={visibleMachines}
          inFlight={inFlight}
          onAssign={assignToMachine}
          onDelete={(j) => setDeleteConfirm(j)}
        />

        {visibleMachines.length === 0 ? (
          <EmptyMachinesState
            category={category}
            loading={state.kind === "loading"}
            labFiltered={labFilter !== "all"}
            onClearFilter={() => setLabFilter("all")}
          />
        ) : (
          <motion.div
            layout
            className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
          >
            <AnimatePresence mode="popLayout">
              {visibleMachines.map((m) => (
                <motion.div
                  key={m.id}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                >
                  <MachineColumn
                    machine={m}
                    runningJob={
                      visibleInProgress.find(
                        (j) => j.machineProfileId === m.id
                      ) ?? null
                    }
                    queuedJobs={visibleReady.filter(
                      (j) => j.machineProfileId === m.id
                    )}
                    inFlight={inFlight}
                    onStart={startAndDownload}
                    onComplete={markComplete}
                    onFailed={openFailModal}
                    onUnassign={(j) => setUnassignConfirm(j)}
                    onDelete={(j) => setDeleteConfirm(j)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </main>

      {/* Phase 8.1d-28: failure-reason modal. Replaces window.prompt
           with a styled overlay that has canned chips + an editable
           textarea. Renders inside .fabRoot so theme vars cascade. */}
      <AnimatePresence>
        {failModalJobId && (
          <FailureReasonModal
            jobId={failModalJobId}
            onCancel={() => setFailModalJobId(null)}
            onSubmit={async (note) => {
              const j = failModalJobId;
              setFailModalJobId(null);
              await submitFailed(j, note);
            }}
          />
        )}
      </AnimatePresence>

      {/* Phase 8.1d-31: confirm modals for unassign + delete.
           Both use the shared ConfirmActionModal component — only
           the copy + intent (warn vs danger) differs. Renders
           inside .fabRoot so theme vars cascade. */}
      <AnimatePresence>
        {unassignConfirm && (
          <ConfirmActionModal
            key={`unassign-${unassignConfirm.jobId}`}
            intent="warn"
            title="Remove from this machine?"
            description={
              <>
                <strong>{unassignConfirm.studentName}</strong>
                {unassignConfirm.className ? ` (${unassignConfirm.className})` : ""} —{" "}
                <span className="font-mono text-[11px]">
                  {unassignConfirm.originalFilename}
                </span>
                <br />
                Goes back to the Incoming row so a different machine can
                pick it up. Reversible.
              </>
            }
            confirmLabel="Remove"
            onCancel={() => setUnassignConfirm(null)}
            onConfirm={async () => {
              const j = unassignConfirm;
              setUnassignConfirm(null);
              await unassignFromMachine(j.jobId);
            }}
          />
        )}
        {deleteConfirm && (
          <ConfirmActionModal
            key={`delete-${deleteConfirm.jobId}`}
            intent="danger"
            title="Delete this job permanently?"
            description={
              <>
                <strong>{deleteConfirm.studentName}</strong>
                {deleteConfirm.className ? ` (${deleteConfirm.className})` : ""} —{" "}
                <span className="font-mono text-[11px]">
                  {deleteConfirm.originalFilename}
                </span>
                <br />
                Removes the job, all revisions, and the uploaded file.
                The student won&apos;t be able to see it on their
                submission page anymore. <strong>This can&apos;t be
                undone.</strong>
              </>
            }
            confirmLabel="Delete forever"
            onCancel={() => setDeleteConfirm(null)}
            onConfirm={async () => {
              const j = deleteConfirm;
              setDeleteConfirm(null);
              await deleteJobAsync(j.jobId);
            }}
          />
        )}
      </AnimatePresence>
    </div>
    </PortalAnchorContext.Provider>
  );
}

// ============================================================
// Lab filter pill bar — Phase 8.1d-26
// ============================================================

function LabFilterBar({
  options,
  value,
  onChange,
}: {
  options: Array<{ id: string; name: string }>;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span
        className={`${styles.cap} mr-1`}
        style={{ color: "var(--ink-3)", letterSpacing: "0.12em" }}
      >
        Lab
      </span>
      <LabPill
        label="All labs"
        active={value === "all"}
        onClick={() => onChange("all")}
      />
      {options.map((opt) => (
        <LabPill
          key={opt.id}
          label={opt.name}
          active={value === opt.id}
          onClick={() => onChange(opt.id)}
        />
      ))}
    </div>
  );
}

function LabPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-[12px] font-extrabold transition"
      style={
        active
          ? { background: "var(--ink)", color: "var(--bg)" }
          : {
              background: "var(--surface-2)",
              color: "var(--ink-2)",
              border: "1px solid var(--hair)",
            }
      }
    >
      {label}
    </button>
  );
}

// ============================================================
// Failure-reason modal — Phase 8.1d-28
// ============================================================

function FailureReasonModal({
  jobId,
  onCancel,
  onSubmit,
}: {
  jobId: string;
  onCancel: () => void;
  onSubmit: (note: string) => void | Promise<void>;
}) {
  const [note, setNote] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Focus the textarea when the modal mounts so a fab can start
  // typing immediately. Picking a chip also focuses the textarea
  // so they can extend the chip's text.
  React.useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Esc closes; Cmd/Ctrl+Enter submits (if note non-empty).
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && note.trim()) {
        e.preventDefault();
        void handleSubmit();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note]);

  const trimmed = note.trim();
  const canSubmit = trimmed.length > 0 && !submitting;

  function pickChip(label: string) {
    // Replace empty / append to existing — preserves any text the
    // fab has already typed. Common case: empty → fill with chip;
    // already-typed → append "; bed adhesion lost" so multiple
    // reasons can be combined.
    setNote((prev) => (prev.trim() === "" ? label : `${prev.trim()}; ${label}`));
    textareaRef.current?.focus();
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{
        background: "rgba(0,0,0,0.6)",
        zIndex: 200,
      }}
      onMouseDown={(e) => {
        // Click on the dimmer cancels; click inside the modal does not.
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className={`${styles.card} w-full max-w-md`}
        style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`fail-modal-title-${jobId}`}
      >
        <div
          className="px-5 py-4"
          style={{ borderBottom: "1px solid var(--hair)" }}
        >
          <h2
            id={`fail-modal-title-${jobId}`}
            className={`${styles.display} text-[18px] leading-tight`}
            style={{ color: "var(--ink)" }}
          >
            Mark as failed
          </h2>
          <p
            className="text-[12px] mt-1"
            style={{ color: "var(--ink-2)" }}
          >
            Tell the student what went wrong. They&apos;ll see this on
            their submission page.
          </p>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div>
            <div
              className={`${styles.cap} mb-2`}
              style={{ color: "var(--ink-3)" }}
            >
              Quick reasons
            </div>
            <div className="flex flex-wrap gap-1.5">
              {FAILURE_REASON_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => pickChip(chip)}
                  disabled={submitting}
                  className="text-[11px] font-semibold px-2.5 py-1.5 rounded-full transition disabled:opacity-50"
                  style={{
                    background: "var(--surface-2)",
                    color: "var(--ink-2)",
                    border: "1px solid var(--hair)",
                  }}
                >
                  + {chip}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor={`fail-note-${jobId}`}
              className={`${styles.cap} block mb-1.5`}
              style={{ color: "var(--ink-3)" }}
            >
              Note
            </label>
            <textarea
              id={`fail-note-${jobId}`}
              ref={textareaRef}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={submitting}
              rows={3}
              placeholder="What went wrong? Pick a reason above or type your own."
              className="w-full rounded-lg p-3 text-[13px] leading-snug resize-none focus:outline-none transition disabled:opacity-50"
              style={{
                background: "var(--surface-2)",
                color: "var(--ink)",
                border: "1px solid var(--hair-2)",
                fontFamily:
                  "var(--font-manrope), system-ui, sans-serif",
              }}
            />
          </div>
        </div>

        <div
          className="px-5 py-3 flex items-center justify-end gap-2"
          style={{ borderTop: "1px solid var(--hair)" }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className={`${styles.btnSecondary} rounded-lg px-4 py-2 text-[12px]`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`${styles.btnBad} rounded-lg px-4 py-2 text-[12px] inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <XIcon size={11} />
            {submitting ? "Marking failed…" : "Mark failed"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============================================================
// Confirm action modal — Phase 8.1d-31
// ============================================================
//
// Generic confirm-or-cancel overlay used for unassign + delete.
// Replaces window.confirm — same purpose, but theme-aware and
// supports two intents:
//
//   intent="warn"   → amber primary button (reversible action)
//   intent="danger" → red   primary button (destructive action)
//
// `description` is ReactNode so callers can format the job
// identity (student / class / filename) inline. Esc cancels;
// clicking the dimmer cancels; Cmd/Ctrl+Enter confirms.

function ConfirmActionModal({
  intent,
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  intent: "warn" | "danger";
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const [submitting, setSubmitting] = React.useState(false);

  // Esc to cancel; Cmd/Ctrl+Enter to confirm.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void handleConfirm();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleConfirm() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setSubmitting(false);
    }
  }

  // Danger uses the same red as Mark Failed for visual consistency
  // (styles.btnBad). Warn uses an amber tone — different enough
  // from danger that a fab can tell unassign from delete at a
  // glance even when both modals are queued back-to-back.
  const confirmClass =
    intent === "danger" ? styles.btnBad : styles.btnPrimary;
  const confirmStyle =
    intent === "warn"
      ? { background: "var(--warn)", color: "#0B0C0E" }
      : undefined;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", zIndex: 200 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className={`${styles.card} w-full max-w-md`}
        style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}
        role="dialog"
        aria-modal="true"
      >
        <div
          className="px-5 py-4"
          style={{ borderBottom: "1px solid var(--hair)" }}
        >
          <h2
            className={`${styles.display} text-[18px] leading-tight`}
            style={{ color: "var(--ink)" }}
          >
            {title}
          </h2>
        </div>

        <div
          className="px-5 py-4 text-[12.5px] leading-snug"
          style={{ color: "var(--ink-2)" }}
        >
          {description}
        </div>

        <div
          className="px-5 py-3 flex items-center justify-end gap-2"
          style={{ borderTop: "1px solid var(--hair)" }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className={`${styles.btnSecondary} rounded-lg px-4 py-2 text-[12px]`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className={`${confirmClass} rounded-lg px-4 py-2 text-[12px] inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed`}
            style={confirmStyle}
          >
            {intent === "danger" ? (
              <TrashIcon size={11} />
            ) : (
              <XIcon size={11} />
            )}
            {submitting ? "Working…" : confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============================================================
// Header
// ============================================================

function DashboardHeader({
  category,
  incomingCount,
  runningCount,
  machineCount,
  state,
  onRefresh,
}: {
  category: Category;
  incomingCount: number;
  runningCount: number;
  machineCount: number;
  state: LoadState;
  onRefresh: () => void;
}) {
  const headline =
    category === "3d_printer" ? "3D printing." : "Laser cutting.";
  const accent = categoryAccentVar(category);

  // Phase 8.1d-30: defer the date string until after mount so
  // SSR + client-hydration agree on initial markup. Server renders
  // empty; client fills + ticks every minute. Fixes React #418
  // hydration error caused by `new Date()` differing between SSR
  // and the first client render.
  const [now, setNow] = React.useState<string>("");
  React.useEffect(() => {
    setNow(formatHeaderDate());
    const id = window.setInterval(() => setNow(formatHeaderDate()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <header className="flex items-end justify-between gap-3 flex-wrap">
      <div>
        <div
          className={`${styles.cap} mb-1.5`}
          style={{ color: "var(--ink-3)", minHeight: 14 }}
          suppressHydrationWarning
        >
          {now}
        </div>
        <h1
          className={`${styles.displayXl} text-[36px] sm:text-[44px] leading-[0.95]`}
        >
          {headline}{" "}
          <span className={styles.serifEm} style={{ color: accent }}>
            {incomingCount}
          </span>{" "}
          incoming,
          <br />
          <span style={{ color: "var(--ink-2)" }}>
            {runningCount} running on {machineCount} machine
            {machineCount === 1 ? "" : "s"}.
          </span>
        </h1>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRefresh}
          disabled={state.kind === "loading"}
          className={`${styles.btnSecondary} rounded-full px-4 py-2 text-[12px] inline-flex items-center gap-1.5`}
        >
          <RefreshIcon size={12} /> {state.kind === "loading" ? "Refreshing…" : "Refresh"}
        </button>
      </div>
    </header>
  );
}

// ============================================================
// Top nav with category switcher
// ============================================================

interface CategoryCounts {
  /** Total approved jobs awaiting pickup (incoming + queued). */
  waiting: number;
  /** Subset of waiting that are unassigned to a specific machine —
   *  drives the pulsing red dot on the inactive tab. */
  incoming: number;
  /** Currently picked-up jobs running on machines. */
  running: number;
  /** Completed today (UTC midnight cutoff). */
  done: number;
}

function FabTopNav({
  category,
  fabricatorName,
  initials,
  printerCounts,
  laserCounts,
}: {
  category: Category;
  fabricatorName: string;
  initials: string;
  printerCounts: CategoryCounts;
  laserCounts: CategoryCounts;
}) {
  return (
    <header
      style={{ background: "var(--surface)", borderBottom: "1px solid var(--hair)" }}
    >
      {/* Phase 8.1d-29: nav grew taller to fit the per-tab summary
           rows. h-14 → h-auto + min-h-14 keeps single-line content
           (brand, user, signout) vertically centred while the tabs
           expand to two lines. */}
      <div className="px-6 py-2 flex items-center gap-6 min-h-14">
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
        <nav className="flex items-center gap-1.5">
          {/* Phase 8.1d-23: explicit category tabs in the nav.
              Active route = current category, inactive = the other.
              8.1d-29: tabs now show per-category counts + a
              pulsing red dot when the inactive tab has incoming
              (unassigned) jobs needing attention. */}
          <CategoryTab
            href="/fab/queue/printer"
            label="3D Printing"
            isActive={category === "3d_printer"}
            counts={printerCounts}
          />
          <CategoryTab
            href="/fab/queue/laser"
            label="Laser cutting"
            isActive={category === "laser_cutter"}
            counts={laserCounts}
          />
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

function CategoryTab({
  href,
  label,
  isActive,
  counts,
}: {
  href: string;
  label: string;
  isActive: boolean;
  counts: CategoryCounts;
}) {
  // Phase 8.1d-29: pulse the inactive tab when there are
  // unassigned jobs in that category — peripheral-vision signal
  // that the OTHER category needs attention. Pulse stops the
  // moment the user is on that tab (they're already looking).
  const shouldPulse = !isActive && counts.incoming > 0;

  // Per-section text colour shifts between active + inactive so
  // the count chips don't disappear into the background. Active
  // tab uses inverted ink; inactive tab uses muted secondary.
  const labelColor = isActive ? "var(--bg)" : "var(--ink)";
  const summaryColor = isActive ? "rgba(14,15,18,0.65)" : "var(--ink-3)";

  return (
    <Link
      href={href}
      className="relative inline-flex flex-col rounded-2xl transition"
      style={{
        padding: "6px 14px",
        background: isActive ? "var(--ink)" : "var(--surface-2)",
        border: isActive ? "1px solid var(--ink)" : "1px solid var(--hair)",
        minWidth: 184,
      }}
      title={
        shouldPulse
          ? `${counts.incoming} new job${counts.incoming === 1 ? "" : "s"} waiting to be assigned`
          : undefined
      }
    >
      {/* Pulsing red dot — top-right corner, small + understated.
           Uses the existing .pulse keyframe (currentColor box-shadow)
           applied to a danger-coloured node. */}
      {shouldPulse && (
        <span
          className={styles.pulse}
          aria-label="New jobs waiting"
          style={{
            position: "absolute",
            top: 6,
            right: 8,
            color: "var(--bad)",
          }}
        />
      )}
      <span
        className="text-[13px] leading-tight font-extrabold"
        style={{ color: labelColor }}
      >
        {label}
      </span>
      <span
        className={`${styles.mono} text-[10px] leading-tight mt-0.5 flex items-center gap-1.5`}
        style={{ color: summaryColor }}
      >
        <CountChip
          label={`${counts.waiting} waiting`}
          highlight={shouldPulse}
        />
        <span aria-hidden="true">·</span>
        <span>{counts.running} running</span>
        <span aria-hidden="true">·</span>
        <span>{counts.done} done</span>
      </span>
    </Link>
  );
}

function CountChip({
  label,
  highlight,
}: {
  label: string;
  highlight: boolean;
}) {
  // The leading "waiting" count goes red when there are
  // unassigned jobs (matches the pulse-dot signal). Keeps the
  // attention path consistent: dot + count both turn red.
  return (
    <span
      style={
        highlight
          ? { color: "#FCA5A5", fontWeight: 800 }
          : undefined
      }
    >
      {label}
    </span>
  );
}

// ============================================================
// Incoming row
// ============================================================

function IncomingRow({
  jobs,
  machines,
  inFlight,
  onAssign,
  onDelete,
}: {
  jobs: FabJobRow[];
  machines: FabMachineOption[];
  inFlight: Record<string, "complete" | "fail" | "start" | "assign" | "unassign" | "delete" | undefined>;
  onAssign: (jobId: string, machineProfileId: string) => void;
  onDelete: (job: FabJobRow) => void;
}) {
  // Phase 8.1d-31: filters scoped to the Incoming row only.
  // Machine columns intentionally don't filter — once a job is on a
  // machine the order is the lab tech's print queue and shuffling
  // it would lose context. Filters here narrow what's *waiting to
  // be assigned* so a fab can triage by class or file type without
  // hiding the running queues.
  //
  // Three filter controls, left → right:
  //   1. Free-text search   — matches student name OR filename
  //   2. File type chips    — STL / SVG (rendered only when both present)
  //   3. Class chips        — one per class with incoming jobs
  //                           (rendered only when 2+ classes present)
  //
  // The chip bar disappears entirely on tiny job lists (single
  // class, single file type) — keeps the chrome out of the way
  // when filtering would be redundant.
  const [search, setSearch] = React.useState("");
  const [fileTypeFilter, setFileTypeFilter] = React.useState<
    "all" | "stl" | "svg"
  >("all");
  const [classFilter, setClassFilter] = React.useState<string | null>(null);

  // Distinct values across the unfiltered job set — drives which
  // chip rows render. Sorted so the chip ordering doesn't shuffle
  // between renders even when the underlying data does.
  const fileTypes = React.useMemo(() => {
    const set = new Set<"stl" | "svg">();
    for (const j of jobs) set.add(j.fileType);
    return Array.from(set).sort();
  }, [jobs]);
  const classNames = React.useMemo(() => {
    const set = new Set<string>();
    for (const j of jobs) {
      if (j.className) set.add(j.className);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [jobs]);

  // Apply filters. Search is case-insensitive substring on student
  // OR filename. File-type + class are exact match. Combined with
  // AND so each filter narrows the previous.
  const filteredJobs = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs.filter((j) => {
      if (fileTypeFilter !== "all" && j.fileType !== fileTypeFilter) {
        return false;
      }
      if (classFilter !== null && j.className !== classFilter) {
        return false;
      }
      if (q.length > 0) {
        const haystack = `${j.studentName} ${j.originalFilename}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [jobs, search, fileTypeFilter, classFilter]);

  const hasActiveFilter =
    search.trim().length > 0 ||
    fileTypeFilter !== "all" ||
    classFilter !== null;

  function clearFilters() {
    setSearch("");
    setFileTypeFilter("all");
    setClassFilter(null);
  }

  // Empty incoming pool — same chrome-free state as before. No
  // filter UI rendered (nothing to filter against).
  if (jobs.length === 0) {
    return (
      <div
        className="rounded-2xl px-5 py-6 text-center"
        style={{
          border: "1px dashed var(--hair-2)",
          background: "var(--surface-2)",
        }}
      >
        <div className={`${styles.cap}`} style={{ color: "var(--ink-3)" }}>
          Incoming
        </div>
        <div className="mt-2 text-[13px]" style={{ color: "var(--ink-2)" }}>
          Nothing waiting to be assigned. New approvals show up here.
        </div>
      </div>
    );
  }

  // Show the chip row only when there's something to filter by —
  // single-class single-filetype incoming pools are visually quieter.
  const showChipRow = fileTypes.length > 1 || classNames.length > 1;

  return (
    <div className={styles.card}>
      <div
        className="px-5 py-3 flex items-center justify-between flex-wrap gap-3"
        style={{ borderBottom: "1px solid var(--hair)" }}
      >
        <div className="flex items-center gap-3">
          <div className={styles.cap} style={{ color: "var(--ink-3)" }}>
            Incoming
          </div>
          <div className="text-[12px] font-semibold" style={{ color: "var(--ink-2)" }}>
            {hasActiveFilter
              ? `${filteredJobs.length} of ${jobs.length}`
              : `${jobs.length} job${jobs.length === 1 ? "" : "s"} waiting to be assigned`}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student or filename…"
            aria-label="Search incoming jobs"
            className="rounded-md px-2.5 py-1.5 text-[11.5px] focus:outline-none transition"
            style={{
              background: "var(--surface-2)",
              color: "var(--ink)",
              border: "1px solid var(--hair-2)",
              minWidth: 200,
              fontFamily: "var(--font-manrope), system-ui, sans-serif",
            }}
          />
          {hasActiveFilter && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-[10.5px] font-semibold px-2 py-1 rounded transition hover:bg-[var(--surface-2)]"
              style={{ color: "var(--ink-3)" }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {showChipRow && (
        <div
          className="px-5 py-2 flex items-center gap-2 flex-wrap"
          style={{ borderBottom: "1px solid var(--hair)" }}
        >
          {fileTypes.length > 1 && (
            <>
              <FilterChip
                label="All types"
                active={fileTypeFilter === "all"}
                onClick={() => setFileTypeFilter("all")}
              />
              {fileTypes.map((t) => (
                <FilterChip
                  key={t}
                  label={t.toUpperCase()}
                  active={fileTypeFilter === t}
                  onClick={() => setFileTypeFilter(t)}
                />
              ))}
              {classNames.length > 1 && (
                <span
                  className="mx-1"
                  style={{ color: "var(--hair-2)" }}
                  aria-hidden
                >
                  ·
                </span>
              )}
            </>
          )}
          {classNames.length > 1 && (
            <>
              <FilterChip
                label="All classes"
                active={classFilter === null}
                onClick={() => setClassFilter(null)}
              />
              {classNames.map((c) => (
                <FilterChip
                  key={c}
                  label={c}
                  active={classFilter === c}
                  onClick={() =>
                    setClassFilter(classFilter === c ? null : c)
                  }
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* Horizontal scrolling row. overflow-x-auto + flex children keep
           the cards in line; lab tech wheel-scrolls or shift-scrolls.
           Phase 8.1d-26: cards wrapped in <motion.div layout> so a
           card disappearing (e.g. after Send-to assignment) animates
           out instead of jumping. */}
      <div
        className="px-3 py-3 overflow-x-auto"
        style={{ scrollbarWidth: "thin" }}
      >
        {filteredJobs.length === 0 ? (
          <div
            className="px-4 py-6 text-center text-[12px]"
            style={{ color: "var(--ink-3)" }}
          >
            No jobs match the current filter.{" "}
            <button
              type="button"
              onClick={clearFilters}
              className="underline font-semibold"
              style={{ color: "var(--ink-2)" }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <motion.div layout className="flex gap-3 min-w-min">
            <AnimatePresence mode="popLayout">
              {filteredJobs.map((job) => (
                <motion.div
                  key={job.jobId}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  <IncomingCard
                    job={job}
                    machines={machines}
                    busy={inFlight[job.jobId]}
                    onAssign={onAssign}
                    onDelete={onDelete}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// Phase 8.1d-31: shared chip used by the Incoming filter bar.
// Mirrors LabPill's visual style (solid-active / outline-inactive)
// for consistency between the two filter chrome strips.
function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="text-[10.5px] font-semibold px-2.5 py-1 rounded-full transition"
      style={
        active
          ? {
              background: "var(--ink)",
              color: "var(--surface)",
              border: "1px solid var(--ink)",
            }
          : {
              background: "transparent",
              color: "var(--ink-2)",
              border: "1px solid var(--hair-2)",
            }
      }
    >
      {label}
    </button>
  );
}

function IncomingCard({
  job,
  machines,
  busy,
  onAssign,
  onDelete,
}: {
  job: FabJobRow;
  machines: FabMachineOption[];
  busy: "complete" | "fail" | "start" | "assign" | "unassign" | "delete" | undefined;
  onAssign: (jobId: string, machineProfileId: string) => void;
  /** Phase 8.1d-31: corner trash button on the card opens the
   *  parent's ConfirmActionModal (danger intent). Used when a fab
   *  spots a duplicate or test-data submission before assigning. */
  onDelete: (job: FabJobRow) => void;
}) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  // Phase 8.1d-26: menu portal'd into a target div inside .fabRoot
  // so it escapes the incoming-row's overflow-x-auto clip (CSS
  // quirk: setting overflow-x:auto implicitly computes
  // overflow-y:auto on the same element, which clips the dropdown
  // vertically too) AND inherits the dark-theme CSS variables
  // (--surface, --ink, etc). 8.1d-26b: portalling to document.body
  // broke CSS-var inheritance — the menu rendered as an invisible
  // faint outline. Now portalled to a context-provided anchor inside
  // .fabRoot so vars cascade.
  const portalAnchor = React.useContext(PortalAnchorContext);
  const buttonRef = React.useRef<HTMLButtonElement | null>(null);
  const [menuPos, setMenuPos] = React.useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  // Recompute menu coords whenever it opens. Close on
  // scroll/resize — staying open with stale coords would have the
  // menu drift away from the button.
  React.useEffect(() => {
    if (!menuOpen) return;
    const updatePos = () => {
      const btn = buttonRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      setMenuPos({ top: r.bottom + 4, left: r.left, width: r.width });
    };
    updatePos();
    const onScroll = () => setMenuOpen(false);
    const onResize = () => setMenuOpen(false);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    const onDocClick = (e: MouseEvent) => {
      // Don't close when clicking the button itself (it toggles).
      if (buttonRef.current?.contains(e.target as Node)) return;
      // Don't close when clicking inside the portal'd menu either —
      // selecting a machine triggers onAssign which closes via the
      // explicit setMenuOpen(false) below.
      const target = e.target as HTMLElement;
      if (target.closest("[data-fab-sendto-menu]")) return;
      setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("mousedown", onDocClick);
    };
  }, [menuOpen]);

  // Send-to menu only lists machines in the same lab as the job.
  const candidates = React.useMemo(
    () =>
      machines.filter(
        (m) => m.lab_id === job.labId && m.machine_category === job.machineCategory
      ),
    [machines, job.labId, job.machineCategory]
  );

  const accent = categoryAccentVar(job.machineCategory);

  return (
    <div
      className={`${styles.card2} relative shrink-0`}
      style={{ width: 240 }}
    >
      {/* Phase 8.1d-31: corner trash. Tucked top-right so it
           doesn't compete with Send-to but is still reachable
           with one click. Only enabled when no other mutation is
           in flight on this card. */}
      <button
        type="button"
        onClick={() => onDelete(job)}
        disabled={busy !== undefined}
        title="Delete job permanently"
        aria-label="Delete job permanently"
        className="absolute top-1.5 right-1.5 p-1 rounded transition disabled:opacity-50 hover:bg-[var(--surface-2)]"
        style={{ color: "var(--ink-3)", zIndex: 2 }}
      >
        {busy === "delete" ? (
          <span
            className="block w-2.5 h-2.5 border-[1.5px] rounded-full animate-spin"
            style={{
              borderColor: "var(--ink-2)",
              borderTopColor: "transparent",
            }}
          />
        ) : (
          <TrashIcon size={11} />
        )}
      </button>
      <div className="p-3">
        <div className="flex gap-2.5">
          <div
            className="w-12 h-12 rounded shrink-0 p-1"
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
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-0.5">
              <div className="text-[12px] font-extrabold truncate">
                {job.studentName}
              </div>
              <ClassChip name={job.className} teacherInitials={job.teacherInitials} small />
            </div>
            <div
              className={`${styles.mono} text-[10px] truncate`}
              style={{ color: "var(--ink-2)" }}
            >
              {job.originalFilename}
            </div>
            <div
              className="flex items-center gap-1 mt-1.5 text-[10px]"
              style={{ color: "var(--ink-3)" }}
            >
              <FileTypeChip fileType={job.fileType} />
              <span>·</span>
              <span className={styles.mono}>{formatFileSize(job.fileSizeBytes)}</span>
            </div>
            {/* Phase 8.1d-COLORv1b: filament color chip on the
                INCOMING card too — fab uses this to decide WHICH
                3D printer to route to (e.g. printer A has black
                PLA loaded, printer B has white). Mirror's the
                QueuedJobCard chip below for visual consistency. */}
            {job.preferredColor && (
              <div
                className="mt-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9.5px] font-semibold ring-1"
                style={{
                  background: "rgba(245, 158, 11, 0.12)",
                  color: "rgb(252, 211, 77)",
                  borderColor: "rgba(245, 158, 11, 0.3)",
                }}
              >
                <span aria-hidden="true">🎨</span>
                <span className="truncate">{job.preferredColor}</span>
              </div>
            )}
            {/* Pilot Mode P4: scanner found a BLOCK-severity issue on
                this file and the student used "Override and proceed"
                during the pilot. The fab tech needs to see this BEFORE
                they pull the file into the slicer — it may not slice
                or print cleanly. Red signals a print-risk warning,
                distinct from the amber color-pref chip above. */}
            {job.pilotOverrideAt && (
              <div
                className="mt-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide ring-1"
                style={{
                  background: "rgba(220, 38, 38, 0.16)",
                  color: "rgb(252, 165, 165)",
                  borderColor: "rgba(220, 38, 38, 0.45)",
                }}
                title={`Scanner flagged: ${job.pilotOverrideRuleIds.join(", ") || "rule(s)"}. Student overrode. May not slice/print correctly — heads-up before you start.`}
              >
                <span aria-hidden="true">⚠</span>
                <span className="truncate">
                  Flagged · may not print
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-2 text-[10px]" style={{ color: "var(--ink-3)" }}>
          {job.labName ?? "—"} ·{" "}
          <span title={formatDateTime(job.createdAt)}>
            {formatRelativeTime(job.createdAt)}
          </span>
        </div>

        {job.teacherReviewNote && (
          <div
            className="mt-2 rounded p-1.5 text-[10px]"
            style={{
              background: "rgba(245,158,11,0.08)",
              border: "1px solid rgba(245,158,11,0.2)",
              color: "var(--ink-2)",
              lineHeight: 1.35,
            }}
          >
            <span className="font-extrabold" style={{ color: "var(--warn)" }}>
              Note:{" "}
            </span>
            {job.teacherReviewNote}
          </div>
        )}

        <button
          ref={buttonRef}
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          disabled={busy !== undefined || candidates.length === 0}
          className={`${styles.btnPrimary} mt-2.5 rounded-md w-full px-3 py-1.5 text-[11px] inline-flex items-center justify-center gap-1.5 disabled:opacity-50`}
          style={{ background: accent, color: "#0B0C0E" }}
        >
          {busy === "assign"
            ? "Assigning…"
            : candidates.length === 0
              ? "No machines available"
              : "Send to →"}
        </button>

        {/* Phase 8.1d-26 + 26b: portal target lives INSIDE .fabRoot
            (set on the wrapping div via setPortalAnchor) so the
            menu inherits --surface / --ink / --hair-2 etc. The
            menu's position:fixed escapes the overflow clip
            independently of where in the DOM it lives. Falls back
            to document.body in the unlikely race where the anchor
            isn't mounted yet — preserves the menu over silent
            no-show, even if theming is briefly muted. */}
        {menuOpen && candidates.length > 0 && menuPos && typeof document !== "undefined" &&
          createPortal(
            <div
              data-fab-sendto-menu=""
              role="menu"
              className="rounded-lg overflow-hidden"
              style={{
                position: "fixed",
                top: menuPos.top,
                left: menuPos.left,
                width: menuPos.width,
                zIndex: 100,
                background: "var(--surface)",
                border: "1px solid var(--hair-2)",
                boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                fontFamily: "var(--font-manrope), system-ui, sans-serif",
              }}
            >
              {candidates.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onAssign(job.jobId, m.id);
                  }}
                  className="block w-full text-left px-3 py-2 text-[12px] font-semibold hover:bg-[var(--surface-2)] transition"
                  style={{ color: "var(--ink)" }}
                >
                  {m.name}
                  {m.lab_name && (
                    <span
                      className="ml-1.5 text-[10px] font-medium"
                      style={{ color: "var(--ink-3)" }}
                    >
                      · {m.lab_name}
                    </span>
                  )}
                </button>
              ))}
            </div>,
            portalAnchor ?? document.body
          )}
      </div>
    </div>
  );
}

// ============================================================
// Machine column
// ============================================================

function MachineColumn({
  machine,
  runningJob,
  queuedJobs,
  inFlight,
  onStart,
  onComplete,
  onFailed,
  onUnassign,
  onDelete,
}: {
  machine: FabMachineOption;
  runningJob: FabJobRow | null;
  queuedJobs: FabJobRow[];
  inFlight: Record<string, "complete" | "fail" | "start" | "assign" | "unassign" | "delete" | undefined>;
  /** Phase 4-May polish: Start now goes through fetch+blob so the
   *  card can show a "Downloading…" busy state during the download.
   *  Was a plain <a href> link before — zero feedback for big files. */
  onStart: (jobId: string, filename: string) => void;
  onComplete: (jobId: string) => void;
  onFailed: (jobId: string) => void;
  /** Phase 8.1d-31: callbacks now take the full FabJobRow so the
   *  parent can show "remove [student]'s [filename]" in the
   *  confirm modal without a re-query. */
  onUnassign: (job: FabJobRow) => void;
  onDelete: (job: FabJobRow) => void;
}) {
  const accent = categoryAccentVar(machine.machine_category);
  return (
    <div
      className={`${styles.card} flex flex-col`}
      style={{ minHeight: 540 }}
    >
      {/* Header */}
      <div
        className="px-4 py-4 flex items-center gap-3"
        style={{
          borderTop: `3px solid ${accent}`,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          borderBottom: "1px solid var(--hair)",
        }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: `color-mix(in srgb, ${accent} 13%, transparent)`,
            color: accent,
          }}
        >
          <CategoryIcon category={machine.machine_category} size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[17px] font-extrabold leading-tight truncate">
            {machine.name}
          </div>
          <div
            className="text-[11px] font-semibold mt-0.5"
            style={{ color: "var(--ink-3)" }}
          >
            {runningJob ? "Running" : "Idle"}
            {machine.lab_name ? ` · ${machine.lab_name}` : ""}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div
            className={`${styles.display} ${styles.tnum} text-[24px] leading-none`}
            style={{ color: accent }}
          >
            {queuedJobs.length}
          </div>
          <div
            className={styles.cap}
            style={{ color: "var(--ink-3)", fontSize: 9, marginTop: 2 }}
          >
            queued
          </div>
        </div>
      </div>

      {/* Now Running block */}
      {runningJob && (
        <RunningBlock
          job={runningJob}
          accent={accent}
          busy={inFlight[runningJob.jobId]}
          onComplete={onComplete}
          onFailed={onFailed}
          onDelete={onDelete}
        />
      )}

      {/* Queue. Phase 8.1d-26: AnimatePresence + layout key by jobId
           so a card moving from incoming → queue → running animates
           position smoothly instead of pop-in/out. The same jobId
           appears in IncomingRow's AnimatePresence + here, so
           framer-motion threads the move via shared layout when the
           data changes (assign-machine resolves, refetch swaps the
           arrays). */}
      <motion.div layout className="p-3 space-y-2 flex-1">
        {queuedJobs.length === 0 ? (
          <div
            className="rounded-lg p-6 text-center text-[11px]"
            style={{
              border: "1px dashed var(--hair)",
              color: "var(--ink-3)",
              background: "var(--surface-2)",
            }}
          >
            Drop a job here
            <div className="mt-1 text-[10px]" style={{ color: "var(--ink-3)" }}>
              (or use Send to → on an incoming card)
            </div>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {queuedJobs.map((j) => (
              <motion.div
                key={j.jobId}
                layout
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.96 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                <QueuedJobCard
                  job={j}
                  accent={accent}
                  busy={inFlight[j.jobId]}
                  onStart={onStart}
                  onUnassign={onUnassign}
                  onDelete={onDelete}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </motion.div>
    </div>
  );
}

function RunningBlock({
  job,
  accent,
  busy,
  onComplete,
  onFailed,
  onDelete,
}: {
  job: FabJobRow;
  accent: string;
  busy: "complete" | "fail" | "start" | "assign" | "unassign" | "delete" | undefined;
  onComplete: (jobId: string) => void;
  onFailed: (jobId: string) => void;
  /** Phase 8.1d-31: also exposed on Now Running so a fab can purge
   *  a stuck/duplicate after marking it failed (or instead of). */
  onDelete: (job: FabJobRow) => void;
}) {
  const elapsed = job.pickedUpAt ? formatRelativeTime(job.pickedUpAt) : null;
  const isBusy = busy !== undefined;
  return (
    <div
      className="px-3 py-3"
      style={{
        background: `color-mix(in srgb, ${accent} 6%, transparent)`,
        borderBottom: "1px solid var(--hair)",
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className={styles.pulse} style={{ color: accent }} />
        <div
          className={styles.cap}
          style={{ color: accent, letterSpacing: "0.1em", fontSize: 9.5 }}
        >
          Now running
        </div>
        <span className="text-[10px] ml-auto" style={{ color: "var(--ink-3)" }}>
          {elapsed ? `${elapsed}` : ""}
        </span>
        {/* Phase 8.1d-31: ghost-icon delete on the Now-Running row. */}
        <button
          type="button"
          onClick={() => onDelete(job)}
          disabled={isBusy}
          title="Delete job permanently"
          aria-label="Delete job permanently"
          className="p-1 rounded transition disabled:opacity-50 hover:bg-[var(--surface-2)]"
          style={{ color: "var(--ink-3)" }}
        >
          {busy === "delete" ? (
            <span
              className="block w-2.5 h-2.5 border-[1.5px] rounded-full animate-spin"
              style={{
                borderColor: "var(--ink-2)",
                borderTopColor: "transparent",
              }}
            />
          ) : (
            <TrashIcon size={11} />
          )}
        </button>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-9 h-9 rounded shrink-0 p-0.5"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--hair)",
          }}
        >
          {job.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={job.thumbnailUrl} alt="" className="w-full h-full object-contain" />
          ) : (
            <div className="w-full h-full" style={{ background: "var(--surface-3)" }} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <div className="text-[12px] font-extrabold truncate">
              {job.studentName}
            </div>
            <ClassChip name={job.className} teacherInitials={job.teacherInitials} small />
          </div>
          <div
            className={`${styles.mono} text-[10px] truncate`}
            style={{ color: "var(--ink-3)" }}
          >
            {job.originalFilename}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          disabled={busy !== undefined}
          onClick={() => onComplete(job.jobId)}
          className={`${styles.btnOk} rounded-md py-1.5 text-[11px] inline-flex items-center justify-center gap-1.5`}
        >
          <CheckIcon size={11} /> {busy === "complete" ? "Saving…" : "Printed"}
        </button>
        <button
          type="button"
          disabled={busy !== undefined}
          onClick={() => onFailed(job.jobId)}
          className={`${styles.btnBad} rounded-md py-1.5 text-[11px] inline-flex items-center justify-center gap-1.5`}
        >
          <XIcon size={11} /> {busy === "fail" ? "Saving…" : "Failed"}
        </button>
      </div>
    </div>
  );
}

function QueuedJobCard({
  job,
  accent,
  busy,
  onStart,
  onUnassign,
  onDelete,
}: {
  job: FabJobRow;
  accent: string;
  busy: "complete" | "fail" | "start" | "assign" | "unassign" | "delete" | undefined;
  /** Phase 4-May polish: Start now goes through fetch+blob so we
   *  can show a "Downloading…" busy state during big-file fetches
   *  (was a native <a href> link with no feedback). */
  onStart: (jobId: string, filename: string) => void;
  /** Phase 8.1d-31: callbacks now receive the row so the parent's
   *  ConfirmActionModal can show student + class + filename
   *  without a re-query. Replaces 8.1d-27's window.confirm
   *  (browser chrome looked terrible against the dark theme). */
  onUnassign: (job: FabJobRow) => void;
  onDelete: (job: FabJobRow) => void;
}) {
  const isBusy = busy !== undefined;
  const isDownloading = busy === "start";

  return (
    <div className={`${styles.card2}`} style={{ overflow: "hidden" }}>
      <div className="p-2.5">
        <div className="flex gap-2">
          <div
            className="w-10 h-10 rounded shrink-0 p-0.5 relative"
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
              className={`${styles.mono} absolute -bottom-1 -right-1 px-0.5 rounded text-[8.5px] font-extrabold`}
              style={{ background: accent, color: "#0B0C0E" }}
            >
              r{job.currentRevision}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-0.5">
              <div className="text-[11.5px] font-extrabold truncate">
                {job.studentName}
              </div>
              <ClassChip name={job.className} teacherInitials={job.teacherInitials} small />
            </div>
            <div
              className={`${styles.mono} text-[10px] truncate`}
              style={{ color: "var(--ink-3)" }}
            >
              {job.originalFilename}
            </div>
            {/* Phase 8.1d-COLORv1: filament color chip — the student
                told us what they want, surface it where the fab
                makes the load-vs-skip decision. */}
            {job.preferredColor && (
              <div
                className="mt-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9.5px] font-semibold ring-1"
                style={{
                  background: "rgba(245, 158, 11, 0.12)",
                  color: "rgb(252, 211, 77)",
                  borderColor: "rgba(245, 158, 11, 0.3)",
                }}
              >
                <span aria-hidden="true">🎨</span>
                <span className="truncate">{job.preferredColor}</span>
              </div>
            )}
            {/* Pilot Mode P4: same red flag as on incoming cards. The
                queued card is post-Send-to but pre-Start, so the fab
                still has time to triage before pulling it into the
                slicer. */}
            {job.pilotOverrideAt && (
              <div
                className="mt-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide ring-1"
                style={{
                  background: "rgba(220, 38, 38, 0.16)",
                  color: "rgb(252, 165, 165)",
                  borderColor: "rgba(220, 38, 38, 0.45)",
                }}
                title={`Scanner flagged: ${job.pilotOverrideRuleIds.join(", ") || "rule(s)"}. Student overrode. May not slice/print correctly.`}
              >
                <span aria-hidden="true">⚠</span>
                <span className="truncate">Flagged · may not print</span>
              </div>
            )}
          </div>
        </div>

        {/* Phase 8.1d-31: 5-button action row.
              Info     → /fab/jobs/[jobId] detail page (existing)
              Download → /download-preview (read-only, no status flip)
              Start    → /download (= pickup; status → picked_up)
              Remove   → /unassign (returns job to Incoming row, ConfirmActionModal warn)
              Delete   → DELETE /api/fab/jobs/[jobId] (permanent, ConfirmActionModal danger)
            Start gets the wide primary slot; the rest are icon-only
            secondary buttons with title attrs for the tooltip.
            Both Remove + Delete go through the parent-owned modal
            instead of window.confirm. */}
        <div className="mt-2 flex items-stretch gap-1">
          <Link
            href={`/fab/jobs/${job.jobId}`}
            title="View details"
            aria-label="View details"
            className={`${styles.btnSecondary} rounded-md inline-flex items-center justify-center px-2`}
            style={{ minWidth: 28 }}
          >
            <EyeIcon size={12} />
          </Link>
          <a
            href={`/api/fab/jobs/${job.jobId}/download-preview`}
            title="Download for preview (no pickup)"
            aria-label="Download preview"
            className={`${styles.btnSecondary} rounded-md inline-flex items-center justify-center px-2 ${
              isBusy ? "opacity-50 pointer-events-none" : ""
            }`}
            style={{ minWidth: 28 }}
          >
            <DownloadIcon size={12} />
          </a>
          <button
            type="button"
            onClick={() => onStart(job.jobId, job.originalFilename)}
            disabled={isBusy}
            title={
              isDownloading
                ? "Downloading the file… the job will start once it's saved."
                : "Download the file and pick up the job (status → in progress)"
            }
            aria-label={isDownloading ? "Downloading" : "Download and start"}
            className={`${styles.btnPrimary} rounded-md flex-1 px-2 py-1.5 text-[11px] inline-flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-wait`}
          >
            {isDownloading ? (
              <>
                <span
                  className="block w-2.5 h-2.5 border-[1.5px] rounded-full animate-spin"
                  style={{
                    borderColor: "rgba(255,255,255,0.6)",
                    borderTopColor: "transparent",
                  }}
                />
                <span>Downloading…</span>
              </>
            ) : (
              <>
                <PlayIcon size={9} /> Download and start
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => onUnassign(job)}
            disabled={isBusy}
            title="Remove from this machine (back to incoming)"
            aria-label="Remove from queue"
            className={`${styles.btnSecondary} rounded-md inline-flex items-center justify-center px-2 disabled:opacity-50`}
            style={{ minWidth: 28 }}
          >
            {busy === "unassign" ? (
              <span
                className="block w-2.5 h-2.5 border-[1.5px] rounded-full animate-spin"
                style={{
                  borderColor: "var(--ink-2)",
                  borderTopColor: "transparent",
                }}
              />
            ) : (
              <XIcon size={11} />
            )}
          </button>
          <button
            type="button"
            onClick={() => onDelete(job)}
            disabled={isBusy}
            title="Delete job permanently"
            aria-label="Delete job permanently"
            className={`${styles.btnSecondary} rounded-md inline-flex items-center justify-center px-2 disabled:opacity-50`}
            style={{ minWidth: 28, color: "var(--ink-3)" }}
          >
            {busy === "delete" ? (
              <span
                className="block w-2.5 h-2.5 border-[1.5px] rounded-full animate-spin"
                style={{
                  borderColor: "var(--ink-2)",
                  borderTopColor: "transparent",
                }}
              />
            ) : (
              <TrashIcon size={11} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Empty state
// ============================================================

function EmptyMachinesState({
  category,
  loading,
  labFiltered,
  onClearFilter,
}: {
  category: Category;
  loading: boolean;
  labFiltered: boolean;
  onClearFilter: () => void;
}) {
  const label =
    category === "3d_printer" ? "3D printers" : "laser cutters";
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
        {loading
          ? "Loading machines…"
          : labFiltered
            ? `No ${label} in this lab.`
            : `No ${label} in your school's labs.`}
      </div>
      <div className="text-[12px]" style={{ color: "var(--ink-3)" }}>
        {loading ? (
          "Fetching from your school's lab setup."
        ) : labFiltered ? (
          <>
            Try a different lab, or{" "}
            <button
              type="button"
              onClick={onClearFilter}
              className="underline font-semibold"
              style={{ color: "var(--ink-2)" }}
            >
              show all labs
            </button>
            .
          </>
        ) : (
          `Ask the teacher to add a ${
            category === "3d_printer" ? "3D printer" : "laser cutter"
          } via the Lab Setup page.`
        )}
      </div>
    </div>
  );
}

// ============================================================
// Helpers + atoms
// ============================================================

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

async function fetchMachines(): Promise<
  { machines: FabMachineOption[] } | { error: string }
> {
  try {
    const res = await fetch("/api/fab/machines", {
      credentials: "same-origin",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "" }));
      return { error: body.error || `HTTP ${res.status} on /machines` };
    }
    return (await res.json()) as { machines: FabMachineOption[] };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Network error" };
  }
}

/**
 * Phase 8.1d-30: count jobs the dashboard can actually render.
 *
 * A "ghost job" is approved + has a machine_profile_id that no
 * longer matches any active machine in the inviting teacher's
 * machines list (machine got soft-deleted post-assignment, or
 * the row is stale from old smoke runs). The body filters these
 * out implicitly because there's no column to render them into,
 * but the nav was counting them via the unfiltered data.ready,
 * leading to "6 waiting in laser cutting · only 1 visible" drift.
 *
 * Match the body's render predicate: a job counts as "waiting" iff
 * either:
 *   - machine_profile_id is null (will render in the Incoming row), OR
 *   - its machine_profile_id is in the active machines list
 *     (will render as a Queue card in that column)
 *
 * Ghost jobs are excluded from the count entirely. PH9-FU-FAB-
 * GHOST-JOB-CLEANUP files the data-side fix (auto-unassign on
 * machine soft-delete + a backfill of existing ghosts).
 */
function categoryCountsFor(
  category: Category,
  data: DashboardData,
  machines: FabMachineOption[]
): CategoryCounts {
  const validMachineIds = new Set(
    machines
      .filter((m) => m.machine_category === category)
      .map((m) => m.id)
  );

  const renderable = (j: FabJobRow) => {
    if (j.machineCategory !== category) return false;
    if (j.machineProfileId === null) return true;
    return validMachineIds.has(j.machineProfileId);
  };

  const waitingJobs = data.ready.filter(renderable);
  return {
    waiting: waitingJobs.length,
    incoming: waitingJobs.filter((j) => j.machineProfileId === null).length,
    running: data.inProgress.filter((j) => j.machineCategory === category)
      .length,
    done: data.doneToday.filter((j) => j.machineCategory === category).length,
  };
}

function categoryAccentVar(c: Category | null): string {
  if (c === "laser_cutter") return "var(--laser)";
  if (c === "3d_printer") return "var(--printer)";
  return "var(--ink-2)";
}

function formatHeaderDate(): string {
  const d = new Date();
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${days[d.getDay()]} · ${d.getDate()} ${months[d.getMonth()]} · ${hh}:${mm}`;
}

function alertUser(msg: string) {
  if (typeof window !== "undefined") window.alert(msg);
}

// ============================================================
// Class + file-type chips
// ============================================================

function ClassChip({
  name,
  teacherInitials,
  small,
}: {
  name: string | null;
  teacherInitials?: string | null;
  small?: boolean;
}) {
  if (!name) return null;
  // Phase 8-4 path 2: pass teacherInitials as the disambiguation key
  // so two "Grade 10"s from different teachers get distinct hues.
  // Falls back to single-key hashing when no initials present
  // (single-teacher schools / pre-Phase-8-4 fixtures).
  const teacherKey = teacherInitials ?? null;
  const c = colorForClassName(name, teacherKey);
  const tint = colorTintForClassName(name, "subtle", teacherKey);
  return (
    <span
      className="font-extrabold rounded flex-shrink-0 inline-flex items-baseline gap-1"
      style={{
        fontSize: small ? 9 : 10,
        padding: small ? "2px 6px" : "3px 7px",
        background: tint,
        color: c,
      }}
    >
      <span>{name}</span>
      {teacherInitials && (
        // 70% opacity — present but secondary. The class name
        // is the primary cue; initials are the tiebreaker.
        <span style={{ opacity: 0.7, fontWeight: 600 }}>
          · {teacherInitials}
        </span>
      )}
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

// ============================================================
// Inline icons
// ============================================================

function CategoryIcon({
  category,
  size = 14,
}: {
  category: Category | null;
  size?: number;
}) {
  if (category === "laser_cutter") {
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
      stroke="currentColor"
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
function DownloadIcon({ size = 12 }: IconProps) {
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
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5M12 15V3" />
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
// Phase 8.1d-31: trash icon for permanent-delete actions.
function TrashIcon({ size = 12 }: IconProps) {
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
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}
function PlayIcon({ size = 10 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 4l14 8-14 8z" />
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

// Note on thumbnails: rendered with raw `<img>` rather than
// next/image because the URLs are short-lived Supabase signed
// URLs and would need the host allowlisted in next.config.js for
// the optimizer. PH9-FU-FAB-NEXT-IMAGE swaps to next/image once
// the signed-URL host is whitelisted.
