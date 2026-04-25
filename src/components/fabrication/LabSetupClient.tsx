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
  labAutoApproveState,
  type LabWithMachines,
} from "./lab-setup-helpers";
import { MachineEditModal } from "./MachineEditModal";
import { AddLabModal } from "./AddLabModal";
import { AddMachineModal } from "./AddMachineModal";
import { AssignClassesToLabModal } from "./AssignClassesToLabModal";
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

  const fetchAll = React.useCallback(async () => {
    setState({ kind: "loading" });
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
      // Auto-expand labs that have machines by default.
      const toExpand = new Set<string>();
      for (const lab of labs.labs) {
        if (lab.machineCount > 0) toExpand.add(lab.id);
      }
      setExpandedLabs(toExpand);
    } catch (e) {
      setState({
        kind: "error",
        message: e instanceof Error ? e.message : "Network error",
      });
    }
  }, []);

  React.useEffect(() => {
    fetchAll();
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
    fetchAll();
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
    fetchAll();
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
    fetchAll();
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
      fetchAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Network error");
    }
  }

  async function toggleBulkApproval(
    labId: string,
    labName: string,
    nextValue: boolean
  ) {
    setBulkStatus(null);
    const res = await fetch(`/api/teacher/labs/${labId}/bulk-approval`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ requireApproval: nextValue }),
    });
    const body = await res.json().catch(() => ({ error: "" }));
    if (!res.ok) {
      alert(body.error || `Bulk toggle failed (HTTP ${res.status})`);
      return;
    }
    setBulkStatus(
      `Updated ${body.updatedMachineCount} machine${
        body.updatedMachineCount === 1 ? "" : "s"
      } in "${labName}" — approval now ${nextValue ? "REQUIRED" : "SKIPPED"}.`
    );
    fetchAll();
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
          onClick={fetchAll}
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
              {/* Lab header */}
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
                    {machines.length > 0 &&
                      (() => {
                        const state = labAutoApproveState(machines);
                        const isOn = state === "all";
                        const isMixed = state === "mixed";
                        const label = isMixed
                          ? "Approval: mixed"
                          : isOn
                            ? "Approval: OFF for lab"
                            : "Approval: ON for lab";
                        const nextValue = isOn; // flip to require
                        return (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleBulkApproval(lab.id, lab.name, nextValue);
                            }}
                            className="text-xs px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-100"
                            title="Toggle teacher-approval for every machine in this lab"
                          >
                            {label}
                          </button>
                        );
                      })()}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setModal({ kind: "add-machine", labId: lab.id });
                      }}
                      className="text-xs px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-100"
                    >
                      + Add machine
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        renameLab(lab);
                      }}
                      className="text-xs px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-100"
                      title="Rename lab"
                    >
                      Rename
                    </button>
                    {!lab.isDefault && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          makeDefaultLab(lab);
                        }}
                        className="text-xs px-2 py-1 rounded border border-brand-purple/40 bg-white text-brand-purple hover:bg-brand-purple/5"
                        title="Make this the default lab. Existing classes' default lab won't change automatically — assign them via the Classes section."
                      >
                        Make default
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setModal({
                          kind: "assign-classes",
                          labId: lab.id,
                          labName: lab.name,
                        });
                      }}
                      className="text-xs px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-100"
                      title="Pick which classes use this lab as their default"
                    >
                      Assign classes
                    </button>
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

              {/* Lab body */}
              {expandedLabs.has(lab.id) && (
                <div className="p-4">
                  {lab.description && (
                    <p className="text-xs text-gray-500 mb-3">
                      {lab.description}
                    </p>
                  )}
                  {machines.length === 0 ? (
                    <p className="text-sm text-gray-500 italic py-4 text-center">
                      No machines in this lab yet.
                    </p>
                  ) : (
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
                              <p className="text-xs text-gray-500 truncate">
                                {m.machineCategory === "3d_printer"
                                  ? "3D printer"
                                  : "Laser cutter"}
                                {m.machineModel && ` · ${m.machineModel}`}
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
                    </ul>
                  )}
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
            fetchAll();
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
            fetchAll();
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
            fetchAll();
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
            fetchAll();
          }}
        />
      )}
    </div>
  );
}
