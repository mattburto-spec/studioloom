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
}

const EMPTY_DATA: DashboardData = { ready: [], inProgress: [] };

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
    Record<string, "complete" | "fail" | "start" | "assign" | undefined>
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
      const [r, ip, m] = await Promise.all([
        fetchTab("ready"),
        fetchTab("in_progress"),
        fetchMachines(),
      ]);
      const firstError = [r, ip, m].find((x) => "error" in x) as
        | { error: string }
        | undefined;
      setData({
        ready: "jobs" in r ? r.jobs : [],
        inProgress: "jobs" in ip ? ip.jobs : [],
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
        body: JSON.stringify({ note: null }),
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

  async function markFailed(jobId: string) {
    const note =
      typeof window !== "undefined"
        ? window.prompt(
            "Quick note on what went wrong (e.g. 'bed adhesion lost', 'file corrupt'):"
          )
        : null;
    if (!note || note.trim().length === 0) return;
    setInFlight((p) => ({ ...p, [jobId]: "fail" }));
    mutatingCount.current += 1;
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
                    onFailed={markFailed}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </main>
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
  return (
    <header className="flex items-end justify-between gap-3 flex-wrap">
      <div>
        <div className={`${styles.cap} mb-1.5`} style={{ color: "var(--ink-3)" }}>
          {formatHeaderDate()}
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

function FabTopNav({
  category,
  fabricatorName,
  initials,
}: {
  category: Category;
  fabricatorName: string;
  initials: string;
}) {
  const otherCategoryHref =
    category === "3d_printer" ? "/fab/queue/laser" : "/fab/queue/printer";
  const otherCategoryLabel =
    category === "3d_printer" ? "Laser cutting" : "3D printing";
  return (
    <header
      style={{ background: "var(--surface)", borderBottom: "1px solid var(--hair)" }}
    >
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
          {/* Phase 8.1d-23: explicit category tabs in the nav.
              Active route = current category, inactive = the other.
              One click switches. Future categories add more tabs. */}
          <CategoryTab
            href="/fab/queue/printer"
            label="3D Printing"
            isActive={category === "3d_printer"}
          />
          <CategoryTab
            href="/fab/queue/laser"
            label="Laser cutting"
            isActive={category === "laser_cutter"}
          />
        </nav>
        <div className="flex-1" />
        <Link
          href={otherCategoryHref}
          className={`${styles.btnSecondary} rounded-full px-3 py-1.5 text-[11.5px] hidden md:inline-flex items-center gap-1`}
        >
          ← Switch to {otherCategoryLabel.toLowerCase()}
        </Link>
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
}: {
  href: string;
  label: string;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 rounded-full text-[12px] font-extrabold transition"
      style={
        isActive
          ? { background: "var(--ink)", color: "var(--bg)" }
          : { color: "var(--ink-2)" }
      }
    >
      {label}
    </Link>
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
  inFlight: Record<string, "complete" | "fail" | "start" | "assign" | undefined>;
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
  busy: "complete" | "fail" | "start" | "assign" | undefined;
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
}: {
  machine: FabMachineOption;
  runningJob: FabJobRow | null;
  queuedJobs: FabJobRow[];
  inFlight: Record<string, "complete" | "fail" | "start" | "assign" | undefined>;
  onComplete: (jobId: string) => void;
  onFailed: (jobId: string) => void;
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
  busy: "complete" | "fail" | "start" | "assign" | undefined;
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
}: {
  job: FabJobRow;
  accent: string;
  busy: "complete" | "fail" | "start" | "assign" | undefined;
}) {
  return (
    <div
      className={`${styles.card2}`}
      style={{ overflow: "hidden" }}
    >
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
        <a
          href={`/api/fab/jobs/${job.jobId}/download`}
          aria-disabled={busy !== undefined}
          className={`${styles.btnPrimary} mt-2 rounded-md w-full px-2.5 py-1.5 text-[11px] inline-flex items-center justify-center gap-1.5 ${
            busy !== undefined ? "opacity-50 pointer-events-none" : ""
          }`}
        >
          <PlayIcon size={9} /> Start
        </a>
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
  tab: "ready" | "in_progress"
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
