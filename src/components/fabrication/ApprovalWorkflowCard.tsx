"use client";

/**
 * ApprovalWorkflowCard — Phase 8.1d-6.
 *
 * Visualises the approval workflow for a lab and lets the teacher
 * toggle "require teacher approval for all machines in this lab" with
 * a proper switch (not a button-as-toggle). Replaces the cramped
 * action-verb button in the lab header — Matt's UX feedback 25 Apr PM
 * said the previous button was "still confusing and ugly as a page
 * design."
 *
 * The visual shows the actual journey of a student job:
 *
 *   ON state:    Student → 🧑‍🏫 You review → 🛠️ Fabricator
 *   OFF state:   Student ────────────→ 🛠️ Fabricator
 *   MIXED:       Student → 🧑‍🏫 You? → 🛠️ Fabricator (per-machine)
 *
 * The "You review" node literally appears / disappears based on the
 * toggle state — visceral feedback for what's about to change.
 */

import * as React from "react";
import {
  labAutoApproveState,
} from "./lab-setup-helpers";
import type { MachineProfileRow } from "@/lib/fabrication/machine-orchestration";

interface Props {
  labId: string;
  labName: string;
  machines: MachineProfileRow[];
  onToggle: (requireApproval: boolean) => void;
}

export function ApprovalWorkflowCard({
  labId: _labId,
  labName: _labName,
  machines,
  onToggle,
}: Props) {
  void _labId;
  void _labName;

  const state = labAutoApproveState(machines);

  // Empty lab — nothing to toggle yet, hide the card.
  if (state === "empty") return null;

  const isOn = state === "none"; // "none" auto-approves = false → approval ON
  const isMixed = state === "mixed";
  const total = machines.length;
  const autoCount = machines.filter((m) => !m.requiresTeacherApproval).length;
  const requireCount = total - autoCount;

  return (
    <div className="rounded-lg border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-4 mb-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">
            Approval workflow
          </h3>

          {/* Visual flow */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-900">
              <span aria-hidden="true">👤</span>
              <span className="font-medium">Student</span>
            </span>

            <Arrow />

            {/* Teacher node — present when ON, omitted when OFF, "?" when mixed */}
            {isMixed ? (
              <>
                <span
                  className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-900"
                  title="Some machines in this lab require approval, some auto-approve. Click 'Require approval for all' or 'Skip approval for all' below to make it consistent."
                >
                  <span aria-hidden="true">🧑‍🏫</span>
                  <span className="font-medium">You? (per-machine)</span>
                </span>
                <Arrow />
              </>
            ) : isOn ? (
              <>
                <span className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-900">
                  <span aria-hidden="true">🧑‍🏫</span>
                  <span className="font-medium">You review</span>
                </span>
                <Arrow />
              </>
            ) : null}

            <span className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-900">
              <span aria-hidden="true">🛠️</span>
              <span className="font-medium">Fabricator</span>
            </span>
          </div>
        </div>
      </div>

      {/* Toggle row */}
      <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
        {isMixed ? (
          // Mixed state: two explicit choice buttons (a single toggle
          // is ambiguous when machines disagree).
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => onToggle(true)}
              className="text-sm px-3 py-1.5 rounded border border-amber-300 bg-white text-amber-900 hover:bg-amber-50 transition"
            >
              Require approval for all
            </button>
            <button
              type="button"
              onClick={() => onToggle(false)}
              className="text-sm px-3 py-1.5 rounded border border-emerald-300 bg-white text-emerald-900 hover:bg-emerald-50 transition"
            >
              Skip approval for all
            </button>
          </div>
        ) : (
          // Pure state: real switch toggle.
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <span className="text-sm font-medium text-gray-900">
              Require teacher approval
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={isOn}
              onClick={() => onToggle(!isOn)}
              className={
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors " +
                (isOn ? "bg-brand-purple" : "bg-gray-300")
              }
            >
              <span
                aria-hidden="true"
                className={
                  "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform " +
                  (isOn ? "translate-x-6" : "translate-x-1")
                }
              />
            </button>
          </label>
        )}
      </div>

      {/* Description */}
      <p className="mt-2 text-xs text-gray-600 leading-relaxed">
        {isMixed
          ? `Currently: ${autoCount} of ${total} machine${total === 1 ? "" : "s"} auto-approves, ${requireCount} require${requireCount === 1 ? "s" : ""} approval. Pick one to make it consistent across the lab.`
          : isOn
            ? "Student jobs land in your queue before the fabricator picks them up. Use this for higher-risk or expensive machines."
            : "Jobs go straight from student to fabricator on a clean scan. Faster, but you won't see them first. Use for low-risk machines like 3D printers."}
      </p>
    </div>
  );
}

function Arrow() {
  return (
    <span aria-hidden="true" className="text-gray-400 text-lg leading-none">
      →
    </span>
  );
}
