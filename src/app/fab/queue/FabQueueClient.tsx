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
    Record<string, "complete" | "fail" | "start" | "assign" | "unassign" | undefined>
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
                    onComplete={markComplete}
                    onFailed={openFailModal}
                    onUnassign={unassignFromMachine}
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
}: {
  jobs: FabJobRow[];
  machines: FabMachineOption[];
  inFlight: Record<string, "complete" | "fail" | "start" | "assign" | "unassign" | undefined>;
  onAssign: (jobId: string, machineProfileId: string) => void;
}) {
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

  return (
    <div className={styles.card}>
      <div
        className="px-5 py-3 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--hair)" }}
      >
        <div className="flex items-center gap-3">
          <div className={styles.cap} style={{ color: "var(--ink-3)" }}>
            Incoming
          </div>
          <div className="text-[12px] font-semibold" style={{ color: "var(--ink-2)" }}>
            {jobs.length} job{jobs.length === 1 ? "" : "s"} waiting to be assigned
          </div>
        </div>
        <div className="text-[10.5px]" style={{ color: "var(--ink-3)" }}>
          Click <strong>Send to →</strong> to route a job to a machine.
        </div>
      </div>
      {/* Horizontal scrolling row. overflow-x-auto + flex children keep
           the cards in line; lab tech wheel-scrolls or shift-scrolls.
           Phase 8.1d-26: cards wrapped in <motion.div layout> so a
           card disappearing (e.g. after Send-to assignment) animates
           out instead of jumping. The Send-to dropdown menu is
           portalled to document.body to escape this container's
           overflow clip — see IncomingCard. */}
      <div
        className="px-3 py-3 overflow-x-auto"
        style={{ scrollbarWidth: "thin" }}
      >
        <motion.div layout className="flex gap-3 min-w-min">
          <AnimatePresence mode="popLayout">
            {jobs.map((job) => (
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
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}

function IncomingCard({
  job,
  machines,
  busy,
  onAssign,
}: {
  job: FabJobRow;
  machines: FabMachineOption[];
  busy: "complete" | "fail" | "start" | "assign" | "unassign" | undefined;
  onAssign: (jobId: string, machineProfileId: string) => void;
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
              <ClassChip name={job.className} small />
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
  onComplete,
  onFailed,
  onUnassign,
}: {
  machine: FabMachineOption;
  runningJob: FabJobRow | null;
  queuedJobs: FabJobRow[];
  inFlight: Record<string, "complete" | "fail" | "start" | "assign" | "unassign" | undefined>;
  onComplete: (jobId: string) => void;
  onFailed: (jobId: string) => void;
  onUnassign: (jobId: string) => void;
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
                  onUnassign={onUnassign}
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
}: {
  job: FabJobRow;
  accent: string;
  busy: "complete" | "fail" | "start" | "assign" | "unassign" | undefined;
  onComplete: (jobId: string) => void;
  onFailed: (jobId: string) => void;
}) {
  const elapsed = job.pickedUpAt ? formatRelativeTime(job.pickedUpAt) : null;
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
  onUnassign,
}: {
  job: FabJobRow;
  accent: string;
  busy: "complete" | "fail" | "start" | "assign" | "unassign" | undefined;
  onUnassign: (jobId: string) => void;
}) {
  // Phase 8.1d-27: Remove uses window.confirm to guard against
  // accidental unassign — it's reversible (job goes back to
  // incoming, fab can re-route) but still surprising if mis-clicked.
  const handleUnassign = React.useCallback(() => {
    if (typeof window === "undefined") return;
    if (
      window.confirm(
        `Remove ${job.studentName}'s job from this machine? It'll go back to the incoming row.`
      )
    ) {
      onUnassign(job.jobId);
    }
  }, [job.jobId, job.studentName, onUnassign]);

  const isBusy = busy !== undefined;

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

        {/* Phase 8.1d-27: 4-button action row.
              Info     → /fab/jobs/[jobId] detail page (existing)
              Download → /download-preview (read-only, no status flip)
              Start    → /download (= pickup; status → picked_up)
              Remove   → /unassign (returns job to Incoming row)
            Start gets the wide primary slot; the rest are icon-only
            secondary buttons with title attrs for the tooltip. */}
        <div className="mt-2 flex items-stretch gap-1">
          <Link
            href={`/fab/jobs/${job.jobId}`}
            title="View details"
            aria-label="View details"
            className={`${styles.btnSecondary} rounded-md inline-flex items-center justify-center px-2`}
            style={{ minWidth: 30 }}
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
            style={{ minWidth: 30 }}
          >
            <DownloadIcon size={12} />
          </a>
          <a
            href={`/api/fab/jobs/${job.jobId}/download`}
            title="Start: download + pick up the job"
            aria-disabled={isBusy}
            className={`${styles.btnPrimary} rounded-md flex-1 px-2.5 py-1.5 text-[11px] inline-flex items-center justify-center gap-1.5 ${
              isBusy ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            <PlayIcon size={9} /> Start
          </a>
          <button
            type="button"
            onClick={handleUnassign}
            disabled={isBusy}
            title="Remove from this machine (back to incoming)"
            aria-label="Remove from queue"
            className={`${styles.btnSecondary} rounded-md inline-flex items-center justify-center px-2 disabled:opacity-50`}
            style={{ minWidth: 30 }}
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
            : `No ${label} in your inviting teacher's labs.`}
      </div>
      <div className="text-[12px]" style={{ color: "var(--ink-3)" }}>
        {loading ? (
          "Fetching from your inviting teacher's lab setup."
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
