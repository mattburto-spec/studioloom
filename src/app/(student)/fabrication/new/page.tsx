"use client";

/**
 * /student/fabrication/new — Preflight Phase 4-3 scaffold.
 *
 * Page scaffold for the upload flow. This sub-phase lands class + machine
 * pickers; 4-4 adds the file picker + upload orchestration wiring; 4-5
 * wires the redirect to the status page.
 *
 * Data fetching: hits /api/student/fabrication/picker-data on mount
 * (can't use createAdminClient() directly in a client component per
 * Lesson #3). The layout already handles student auth globally.
 *
 * File picker + Upload button are stubbed here — visible but disabled
 * until 4-4 lands the logic. Shipping the full page shell now so 4-4
 * is a pure additive commit (no layout shift on students mid-pilot).
 */

import * as React from "react";
import {
  ClassMachinePicker,
  type ClassOption,
  type MachineProfileOption,
} from "@/components/fabrication/ClassMachinePicker";

interface PickerData {
  classes: ClassOption[];
  machineProfiles: MachineProfileOption[];
}

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: PickerData };

export default function FabricationNewPage() {
  const [loadState, setLoadState] = React.useState<LoadState>({ kind: "loading" });
  const [selectedClassId, setSelectedClassId] = React.useState<string | null>(null);
  const [selectedMachineProfileId, setSelectedMachineProfileId] = React.useState<
    string | null
  >(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/student/fabrication/picker-data", {
          credentials: "same-origin",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: "" }));
          if (!cancelled) {
            setLoadState({
              kind: "error",
              message: body.error || `Failed to load picker data (HTTP ${res.status})`,
            });
          }
          return;
        }
        const data = (await res.json()) as PickerData;
        if (!cancelled) setLoadState({ kind: "ready", data });
      } catch (e) {
        if (!cancelled) {
          setLoadState({
            kind: "error",
            message: e instanceof Error ? e.message : "Network error",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const canUpload =
    loadState.kind === "ready" &&
    selectedClassId !== null &&
    selectedMachineProfileId !== null;

  return (
    <main className="max-w-2xl mx-auto px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">Submit a file for fabrication</h1>
        <p className="text-sm text-gray-600 mt-1">
          Upload an STL (3D print) or SVG (laser cut) file. We&apos;ll check it
          for common problems before it hits the machine.
        </p>
      </header>

      {loadState.kind === "loading" && (
        <div className="flex items-center gap-3 py-12 justify-center">
          <div className="w-5 h-5 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-600">Loading your classes and machines…</span>
        </div>
      )}

      {loadState.kind === "error" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <h2 className="font-semibold text-red-900 text-sm mb-1">
            Couldn&apos;t load your classes
          </h2>
          <p className="text-sm text-red-800">{loadState.message}</p>
        </div>
      )}

      {loadState.kind === "ready" && (
        <div className="space-y-6">
          <ClassMachinePicker
            classes={loadState.data.classes}
            machineProfiles={loadState.data.machineProfiles}
            selectedClassId={selectedClassId}
            selectedMachineProfileId={selectedMachineProfileId}
            onClassChange={setSelectedClassId}
            onMachineChange={setSelectedMachineProfileId}
          />

          {/*
           * File picker placeholder — Phase 4-4 lands FileDropzone +
           * UploadProgress + the enqueue wiring. Keeping the space
           * reserved now so the layout doesn't shift later.
           */}
          <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-6 text-center">
            <p className="text-sm font-medium text-gray-700">File picker</p>
            <p className="text-xs text-gray-500 mt-1">
              Coming in the next sub-phase — you&apos;ll drag a file here.
            </p>
          </div>

          <button
            type="button"
            disabled={!canUpload}
            className="w-full py-2.5 rounded-xl bg-brand-purple text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Upload and scan
          </button>

          {loadState.data.classes.length === 0 && (
            <p className="text-xs text-center text-gray-500">
              You&apos;re not enrolled in any classes yet. Ask your teacher to
              add you before you can submit a file.
            </p>
          )}
        </div>
      )}
    </main>
  );
}
