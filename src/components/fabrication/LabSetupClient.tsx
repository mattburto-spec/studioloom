"use client";

/**
 * LabSetupClient — Phase 8-4.
 *
 * Top-level orchestrator for the `/teacher/preflight/lab-setup` page.
 * Fetches labs + machines on mount, groups them, and renders a
 * vertical stack of LabCards. Click a MachineCard → MachineEditModal
 * opens. Click + Add lab / + Add machine → respective modal opens.
 *
 * Design: click-based per parent brief §2 Option B. No drag-drop.
 *
 * Simple and functional — polish pass comes in Phase 9.
 */

import * as React from "react";
import Link from "next/link";
import {
  groupMachinesByLab,
  type LabWithMachines,
} from "./lab-setup-helpers";
import { MachineEditModal } from "./MachineEditModal";
import { AddLabModal } from "./AddLabModal";
import { AddMachineModal } from "./AddMachineModal";
import { AssignClassesToLabModal } from "./AssignClassesToLabModal";
import { ApprovalWorkflowCard } from "./ApprovalWorkflowCard";
import type { LabListRow } from "@/lib/fabrication/lab-orchestration";
import type { MachineProfileRow } from "@/lib/fabrication/machine-orchestration";

interface LoadedState {
  labs: LabListRow[];
  teacherMachines: MachineProfileRow[];
  systemTemplates: MachineProfileRow[];
}

type FetchState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: LoadedState };

type Modal =
  | { kind: "add-lab" }
  | { kind: "add-machine"; labId: string }
  | { kind: "edit-machine"; machine: MachineProfileRow }
  | { kind: "assign-classes"; labId: string; labName: string };

export function LabSetupClient() {
  const [state, setState] = React.useState<FetchState>({ kind: "loading" });
  const [modal, setModal] = React.useState<Modal | null>(null);
  const [expandedLabs, setExpandedLabs] = React.useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = React.useState<string | null>(null);

  const fetchAll = React.useCallback(async (silent = false) => {
    // Phase 8.1d-7: silent mode for background refetches after
    // optimistic updates. Skips the "Loading lab setup..." spinner
    // flash when the user has already seen valid data.
    if (!silent) setState({ kind: "loading" });
    try {
      const [labsRes, machinesRes] = await Promise.all([
        fetch("/api/teacher/labs", { credentials: "same-origin" }),
        fetch("/api/teacher/machine-profiles", {
          credentials: "same-origin",
        }),
      ]);
      if (!labsRes.ok) {
        const body = await labsRes.json().catch(() => ({ error: "" }));
        setState({
          kind: "error",
          message: body.error || `Couldn't load labs (HTTP ${labsRes.status})`,
        });
        return;
      }
      if (!machinesRes.ok) {
        const body = await machinesRes.json().catch(() => ({ error: "" }));
        setState({
          kind: "error",
          message:
            body.error || `Couldn't load machines (HTTP ${machinesRes.status})`,
        });
        return;
      }
      const labs = (await labsRes.json()) as { labs: LabListRow[] };
      const machines = (await machinesRes.json()) as {
        teacherMachines: MachineProfileRow[];
        systemTemplates: MachineProfileRow[];
      };
      setState({
        kind: "ready",
        data: {
          labs: labs.labs,
          teacherMachines: machines.teacherMachines,
          systemTemplates: machines.systemTemplates,
        },
      });
      // Auto-expand labs that have machines by default — but only
      // on initial load, not on silent refetches (the user may have
      // collapsed a lab manually since).
      if (!silent) {
        const toExpand = new Set<string>();
        for (const lab of labs.labs) {
          if (lab.machineCount > 0) toExpand.add(lab.id);
        }
        setExpandedLabs(toExpand);
      }
    } catch (e) {
      setState({
        kind: "error",
        message: e instanceof Error ? e.message : "Network error",
      });
    }
  }, []);

  React.useEffect(() => {
    // Initial mount — show loading spinner (no data yet).
    fetchAll(false);
  }, [fetchAll]);

  function toggleLab(labId: string) {
    setExpandedLabs((prev) => {
      const next = new Set(prev);
      if (next.has(labId)) next.delete(labId);
      else next.add(labId);
      return next;
    });
  }

  async function deleteMachine(machine: MachineProfileRow) {
    if (!confirm(`Deactivate "${machine.name}"? This hides it from students.`))
      return;
    const res = await fetch(
      `/api/teacher/machine-profiles/${machine.id}`,
      { method: "DELETE", credentials: "same-origin" }
    );
    const body = await res.json().catch(() => ({ error: "" }));
    if (!res.ok) {
      alert(body.error || `Delete failed (HTTP ${res.status})`);
      return;
    }
    fetchAll(true);
  }

  async function deleteLab(lab: LabListRow) {
    if (lab.machineCount > 0) {
      alert(
        `"${lab.name}" has ${lab.machineCount} machine${
          lab.machineCount === 1 ? "" : "s"
        }. Move or remove them first, then try again.`
      );
      return;
    }
    if (!confirm(`Delete lab "${lab.name}"?`)) return;
    const res = await fetch(`/api/teacher/labs/${lab.id}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    const body = await res.json().catch(() => ({ error: "" }));
    if (!res.ok) {
      alert(body.error || `Delete failed (HTTP ${res.status})`);
      return;
    }
    fetchAll(true);
  }

  async function renameLab(lab: LabListRow) {
    // Phase 8.1d: simple window.prompt for v1; richer modal in 9-polish.
    const next = window.prompt(`Rename "${lab.name}":`, lab.name);
    if (!next || next.trim() === lab.name.trim()) return;
    const res = await fetch(`/api/teacher/labs/${lab.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ name: next.trim() }),
    });
    const body = await res.json().catch(() => ({ error: "" }));
    if (!res.ok) {
      alert(body.error || `Rename failed (HTTP ${res.status})`);
      return;
    }
    fetchAll(true);
  }

  async function makeDefaultLab(lab: LabListRow) {
    // Phase 8.1d-3 (PH8-FU-SET-DEFAULT-LAB): two-step swap.
    // The DB has a unique partial index `WHERE is_default = true` so
    // we can't just set is_default=true on this lab while another
    // lab also has it — that returns 23505 → 409. Instead: PATCH the
    // current default to false first, then this one to true.
    if (lab.isDefault) return;
    if (state.kind !== "ready") return;
    const currentDefault = state.data.labs.find((l) => l.isDefault);
    try {
      if (currentDefault) {
        const res = await fetch(`/api/teacher/labs/${currentDefault.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ isDefault: false }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: "" }));
          alert(body.error || `Couldn't unset current default (HTTP ${res.status})`);
          return;
        }
      }
      const promote = await fetch(`/api/teacher/labs/${lab.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ isDefault: true }),
      });
      if (!promote.ok) {
        const body = await promote.json().catch(() => ({ error: "" }));
        alert(body.error || `Promotion failed (HTTP ${promote.status})`);
        return;
      }
      fetchAll(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Network error");
    }
  }

  async function toggleBulkApproval(
    labId: string,
    labName: string,
    nextValue: boolean
  ) {
    // Phase 8.1d-7: optimistic update + silent background sync.
    // No more page-level loading-spinner flash on every toggle.
    setBulkStatus(null);

    // 1. Capture previous state for rollback on API failure.
    const previousState = state;

    // 2. Optimistic local update — flip every active teacher-owned
    //    machine in this lab to the new value, immediately.
    if (state.kind === "ready") {
      setState({
        kind: "ready",
        data: {
          ...state.data,
          teacherMachines: state.data.teacherMachines.map((m) =>
            m.labId === labId &&
            !m.isSystemTemplate &&
            m.isActive &&
            m.requiresTeacherApproval !== nextValue
              ? { ...m, requiresTeacherApproval: nextValue }
              : m
          ),
        },
      });
    }

    // 3. Background API call.
    try {
      const res = await fetch(`/api/teacher/labs/${labId}/bulk-approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ requireApproval: nextValue }),
      });
      const body = await res.json().catch(() => ({ error: "" }));
      if (!res.ok) {
        // Revert + show error.
        setState(previousState);
        alert(body.error || `Bulk toggle failed (HTTP ${res.status})`);
        return;
      }
      setBulkStatus(
        `Updated ${body.updatedMachineCount} machine${
          body.updatedMachineCount === 1 ? "" : "s"
        } in "${labName}" — approval now ${nextValue ? "REQUIRED" : "SKIPPED"}.`
      );
      // Silent refetch so any server-side drift gets reconciled
      // without the loading-spinner flash. Race-safe: this is just
      // the canonical state from the server.
      fetchAll(true);
    } catch (err) {
      setState(previousState);
      alert(err instanceof Error ? err.message : "Network error");
    }
  }

  if (state.kind === "loading") {
    return (
      <div className="flex items-center gap-3 py-16 justify-center">
        <div className="w-5 h-5 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-600">Loading lab setup…</span>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-900">{state.message}</p>
        <button
          type="button"
          onClick={() => fetchAll(false)}
          className="mt-2 text-sm px-3 py-1.5 rounded border border-red-300 bg-white hover:bg-red-50"
        >
          Retry
        </button>
      </div>
    );
  }

  const grouped: LabWithMachines[] = groupMachinesByLab(
    state.data.labs,
    state.data.teacherMachines
  );

  return (
    <div className="space-y-6">
      {/* Header + actions */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Lab setup</h1>
          <p className="text-base text-gray-600 mt-2 max-w-2xl">
            Group your 3D printers and laser cutters into labs (e.g. "2nd
            floor design lab"). Students see only the machines in their
            class's lab. Fabricators pick up jobs for the machines they're
            assigned to.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/teacher/preflight/fabricators"
            className="text-sm px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50"
          >
            Fabricators
          </Link>
          <button
            type="button"
            onClick={() => setModal({ kind: "add-lab" })}
            className="text-sm px-3 py-1.5 rounded bg-brand-purple text-white hover:bg-brand-purple/90"
          >
            + Add lab
          </button>
        </div>
      </div>

      {bulkStatus && (
        <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-900">
          {bulkStatus}
        </div>
      )}

      {/* Labs */}
      {grouped.length === 0 ? (
        <div className="rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-600">
          <p>No labs yet.</p>
          <p className="mt-1">
            Click "+ Add lab" above to get started. Your first lab becomes
            the default — students + existing machines automatically assign
            to it.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {grouped.map(({ lab, machines }) => (
            <li
              key={lab.id}
              className="rounded-xl border border-gray-200 bg-white overflow-hidden"
            >
              {/* Lab header — Phase 8.1d-5 polish:
                   - pencil icon for rename (next to name, click stops bubble)
                   - action-verb approval button (no status display)
                   - "+ Add machine" moved to body as a tile (see below) */}
              <div className="flex items-center justify-between gap-3 p-4 bg-gray-50 border-b border-gray-200">
                <button
                  type="button"
                  onClick={() => toggleLab(lab.id)}
                  className="flex items-center gap-2 text-left flex-1 min-w-0"
                >
                  <span className="text-xs text-gray-400">
                    {expandedLabs.has(lab.id) ? "▼" : "▶"}
                  </span>
                  <h2 className="font-semibold text-gray-900 truncate">
                    {lab.name}
                  </h2>
                  {lab.id !== "__unassigned__" && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        renameLab(lab);
                      }}
                      className="text-gray-400 hover:text-gray-700 px-1 text-sm"
                      title="Rename lab"
                      aria-label={`Rename ${lab.name}`}
                    >
                      ✏️
                    </button>
                  )}
                  {lab.isDefault && (
                    <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-brand-purple/10 text-brand-purple font-bold shrink-0">
                      Default
                    </span>
                  )}
                  <span className="text-xs text-gray-500 shrink-0">
                    {machines.length} machine{machines.length === 1 ? "" : "s"}
                  </span>
                </button>
                {lab.id !== "__unassigned__" && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Phase 8.1d-6: bulk approval toggle moved to a
                         visualised card at the top of the lab body
                         (ApprovalWorkflowCard). The action-verb button
                         that used to live here was confusing — toggle
                         + workflow diagram makes the consequence visceral. */}
                    {!lab.isDefault && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          makeDefaultLab(lab);
                        }}
                        className="text-xs px-2 py-1 rounded border border-brand-purple/40 bg-white text-brand-purple hover:bg-brand-purple/5"
                        title="Make this the default lab"
                      >
                        Make default
                      </button>
                    )}
                    {/* Phase 8.1d-5: "Assign classes" button removed —
                         class-to-lab filtering deprecated in favour of
                         group-by-lab picker (matches Matt's UX call:
                         "have all labs available for students to see and
                         make sure they are named well"). The Assign-classes
                         modal + class-to-lab API endpoint stay in the repo
                         as no-op surfaces until Phase 9 cleanup. */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteLab(lab);
                      }}
                      className="text-xs px-2 py-1 rounded border border-red-300 bg-white text-red-700 hover:bg-red-50"
                      title="Delete lab"
                      aria-label={`Delete ${lab.name}`}
                    >
                      Delete lab
                    </button>
                  </div>
                )}
              </div>

              {/* Lab body — Phase 8.1d-5/6 polish:
                   - ApprovalWorkflowCard at top: visualised flow + toggle
                   - + Add machine tile at end of grid */}
              {expandedLabs.has(lab.id) && (
                <div className="p-4">
                  {lab.description && (
                    <p className="text-xs text-gray-500 mb-3">
                      {lab.description}
                    </p>
                  )}
                  {lab.id !== "__unassigned__" && machines.length > 0 && (
                    <ApprovalWorkflowCard
                      labId={lab.id}
                      labName={lab.name}
                      machines={machines}
                      onToggle={(requireApproval) =>
                        toggleBulkApproval(lab.id, lab.name, requireApproval)
                      }
                    />
                  )}
                  {(() => {
                    return (
                    <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {machines.map((m) => (
                        <li
                          key={m.id}
                          className="rounded border border-gray-200 bg-white p-3 hover:border-brand-purple/30 hover:shadow-sm transition"
                        >
                          <div className="flex items-start justify-between gap-2 min-w-0">
                            <div className="min-w-0">
                              <p className="font-semibold text-sm text-gray-900 truncate">
                                {m.name}
                              </p>
                              {/* Phase 8.1d-14: brand + model under the
                                   user-chosen name. Falls back to category
                                   alone when brand isn't set (legacy custom
                                   machines). */}
                              <p className="text-xs text-gray-500 truncate">
                                {m.machineBrand ? (
                                  <>
                                    <span className="font-medium text-gray-700">
                                      {m.machineBrand}
                                    </span>
                                    {m.machineModel && ` ${m.machineModel}`}
                                    {" · "}
                                  </>
                                ) : (
                                  m.machineModel && `${m.machineModel} · `
                                )}
                                {m.machineCategory === "3d_printer"
                                  ? "3D printer"
                                  : "Laser cutter"}
                              </p>
                            </div>
                            {m.requiresTeacherApproval && (
                              <span
                                className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold shrink-0"
                                title="Students' jobs for this machine require your approval"
                              >
                                Approval
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
                            Bed: {m.bedSizeXMm}×{m.bedSizeYMm}
                            {m.bedSizeZMm ? `×${m.bedSizeZMm}` : ""} mm
                          </p>
                          <div className="flex items-center gap-1.5 mt-3">
                            <button
                              type="button"
                              onClick={() =>
                                setModal({ kind: "edit-machine", machine: m })
                              }
                              className="text-xs px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 flex-1"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteMachine(m)}
                              className="text-xs text-gray-400 hover:text-red-600 px-2"
                              title="Deactivate"
                              aria-label={`Deactivate ${m.name}`}
                            >
                              Deactivate
                            </button>
                          </div>
                        </li>
                      ))}
                      {/* Phase 8.1d-5: dashed "+ Add machine" tile at end of grid.
                           Hidden for the synthetic Unassigned bucket — adding
                           a machine there would orphan it on creation. */}
                      {lab.id !== "__unassigned__" && (
                        <li>
                          <button
                            type="button"
                            onClick={() =>
                              setModal({ kind: "add-machine", labId: lab.id })
                            }
                            className="w-full h-full min-h-[120px] rounded border-2 border-dashed border-gray-300 bg-white text-gray-500 hover:border-brand-purple/50 hover:bg-brand-purple/5 hover:text-brand-purple transition flex flex-col items-center justify-center gap-1 p-4"
                            aria-label={`Add machine to ${lab.name}`}
                          >
                            <span className="text-2xl leading-none">＋</span>
                            <span className="text-sm font-semibold">
                              Add machine
                            </span>
                          </button>
                        </li>
                      )}
                    </ul>
                    );
                  })()}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Modals */}
      {modal?.kind === "add-lab" && (
        <AddLabModal
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            fetchAll(true);
          }}
        />
      )}
      {modal?.kind === "add-machine" && (
        <AddMachineModal
          labId={modal.labId}
          templates={state.data.systemTemplates}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            fetchAll(true);
          }}
        />
      )}
      {modal?.kind === "edit-machine" && (
        <MachineEditModal
          mode={{ kind: "edit", machine: modal.machine }}
          availableLabs={
            state.kind === "ready"
              ? state.data.labs.filter((l) => l.id !== "__unassigned__")
              : undefined
          }
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            fetchAll(true);
          }}
        />
      )}
      {modal?.kind === "assign-classes" && (
        <AssignClassesToLabModal
          labId={modal.labId}
          labName={modal.labName}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            fetchAll(true);
          }}
        />
      )}
    </div>
  );
}
