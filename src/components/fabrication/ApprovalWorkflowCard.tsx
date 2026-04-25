"use client";

/**
 * ApprovalWorkflowCard — Phase 8.1d-7.
 *
 * Visualises the approval workflow with framer-motion animations
 * + Heroicons-style line icons. Refines 8.1d-6 in three ways:
 *
 *   1. Real icons (not emoji). Heroicons outline 24x24, stroke 1.5.
 *      User icon for student, ClipboardCheck for teacher, Printer
 *      for fabricator.
 *   2. Animated transitions. The "You review" node enters/exits
 *      with AnimatePresence; surrounding nodes slide via `layout`
 *      animation so the chain shrinks/grows smoothly. Toggle knob
 *      animates between positions.
 *   3. No page refresh. Toggle does optimistic local update first,
 *      then fires the API call in the background. Caller passes
 *      `onOptimisticToggle` to mutate parent state immediately.
 *      No re-fetch, no loading-spinner flash.
 */

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { labAutoApproveState } from "./lab-setup-helpers";
import type { MachineProfileRow } from "@/lib/fabrication/machine-orchestration";

interface Props {
  labId: string;
  labName: string;
  machines: MachineProfileRow[];
  /** Called when the toggle clicks. The parent should:
   *    1. Update local state immediately (optimistic)
   *    2. Fire the API call (background)
   *    3. On error, revert + show feedback
   */
  onToggle: (requireApproval: boolean) => void;
}

export function ApprovalWorkflowCard({ machines, onToggle }: Props) {
  const state = labAutoApproveState(machines);
  if (state === "empty") return null;

  const isOn = state === "none"; // "none" auto-approves = approval REQUIRED for all
  const isMixed = state === "mixed";
  const total = machines.length;
  const autoCount = machines.filter((m) => !m.requiresTeacherApproval).length;
  const requireCount = total - autoCount;

  return (
    <motion.div
      layout
      className="rounded-lg border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-4 mb-4"
    >
      <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">
        Approval workflow
      </h3>

      {/* Animated flow diagram */}
      <motion.div
        layout
        className="flex items-center gap-2 flex-wrap"
        transition={{ layout: { duration: 0.25, ease: "easeOut" } }}
      >
        <FlowNode tone="blue" icon={<UserIcon />} label="Student" />

        <Arrow />

        <AnimatePresence mode="popLayout">
          {isMixed ? (
            <motion.div
              key="teacher-mixed"
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.18 }}
              className="flex items-center gap-2"
            >
              <FlowNode
                tone="amber"
                icon={<ClipboardCheckIcon />}
                label="You? (per-machine)"
                title="Some machines in this lab require approval, some auto-approve. Pick a button below to make it consistent."
              />
              <Arrow />
            </motion.div>
          ) : isOn ? (
            <motion.div
              key="teacher-on"
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.18 }}
              className="flex items-center gap-2"
            >
              <FlowNode
                tone="amber"
                icon={<ClipboardCheckIcon />}
                label="You review"
              />
              <Arrow />
            </motion.div>
          ) : null}
        </AnimatePresence>

        <FlowNode tone="emerald" icon={<PrinterIcon />} label="Fabricator" />
      </motion.div>

      {/* Toggle row */}
      <motion.div layout className="mt-4 flex items-center justify-between gap-3 flex-wrap">
        {isMixed ? (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => onToggle(true)}
              className="text-sm px-3 py-1.5 rounded border border-amber-300 bg-white text-amber-900 hover:bg-amber-50 active:scale-[0.97] transition-all"
            >
              Require approval for all
            </button>
            <button
              type="button"
              onClick={() => onToggle(false)}
              className="text-sm px-3 py-1.5 rounded border border-emerald-300 bg-white text-emerald-900 hover:bg-emerald-50 active:scale-[0.97] transition-all"
            >
              Skip approval for all
            </button>
          </div>
        ) : (
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <span className="text-sm font-medium text-gray-900">
              Require teacher approval
            </span>
            <ToggleSwitch checked={isOn} onChange={onToggle} />
          </label>
        )}
      </motion.div>

      {/* Description */}
      <motion.p
        layout
        className="mt-2 text-xs text-gray-600 leading-relaxed"
      >
        {isMixed
          ? `Currently: ${autoCount} of ${total} machine${total === 1 ? "" : "s"} auto-approves, ${requireCount} require${requireCount === 1 ? "s" : ""} approval. Pick one to make it consistent across the lab.`
          : isOn
            ? "Student jobs land in your queue before the fabricator picks them up. Use this for higher-risk or expensive machines."
            : "Jobs go straight from student to fabricator on a clean scan. Faster, but you won't see them first. Use for low-risk machines like 3D printers."}
      </motion.p>
    </motion.div>
  );
}

// ============================================================
// Sub-components
// ============================================================

interface FlowNodeProps {
  tone: "blue" | "amber" | "emerald";
  icon: React.ReactNode;
  label: string;
  title?: string;
}

function FlowNode({ tone, icon, label, title }: FlowNodeProps) {
  const toneClasses = {
    blue: "bg-blue-50 border-blue-200 text-blue-900",
    amber: "bg-amber-50 border-amber-200 text-amber-900",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-900",
  }[tone];

  return (
    <motion.span
      layout
      className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border ${toneClasses}`}
      title={title}
    >
      <span className="w-4 h-4 shrink-0">{icon}</span>
      <span className="font-medium">{label}</span>
    </motion.span>
  );
}

function Arrow() {
  return (
    <motion.span
      layout
      aria-hidden="true"
      className="text-gray-400 text-lg leading-none"
    >
      →
    </motion.span>
  );
}

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors " +
        (checked ? "bg-brand-purple" : "bg-gray-300")
      }
    >
      <motion.span
        aria-hidden="true"
        className="inline-block h-4 w-4 rounded-full bg-white shadow"
        animate={{ x: checked ? 24 : 4 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </button>
  );
}

// ============================================================
// Heroicons outline 24x24, stroke 1.5
// ============================================================

function UserIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.75}
      stroke="currentColor"
      className="w-full h-full"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
      />
    </svg>
  );
}

function ClipboardCheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.75}
      stroke="currentColor"
      className="w-full h-full"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
      />
    </svg>
  );
}

function PrinterIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.75}
      stroke="currentColor"
      className="w-full h-full"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z"
      />
    </svg>
  );
}
