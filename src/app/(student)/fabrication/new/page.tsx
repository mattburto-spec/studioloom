"use client";

/**
 * /fabrication/new — Preflight Phase 4-3 + 4-4.
 * (File path uses the `(student)` route group — parens mean no URL
 * contribution. URL is `/fabrication/new`, NOT `/student/fabrication/new`.)
 *
 * Student-facing upload flow. 4-3 shipped the class/machine pickers +
 * picker-data fetch. 4-4 lands here: file picker + XHR PUT with progress
 * + enqueue wiring + redirect to the status page.
 *
 * Upload sequence (orchestrated below, state in the uploadReducer):
 *   1. User picks file + class + machine
 *   2. Click "Upload and scan" → POST /api/student/fabrication/upload
 *      → returns { jobId, revisionId, uploadUrl, storagePath }
 *   3. XHR PUT file → uploadUrl with progress events (fetch() doesn't
 *      expose upload progress — XHR is the only path)
 *   4. POST /api/student/fabrication/jobs/{jobId}/enqueue-scan
 *   5. Redirect to /fabrication/jobs/{jobId} (4-5 status page)
 *
 * Error paths surface via uploadReducer → UploadProgress; the user can
 * reset and retry without losing their class/machine selection.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ClassMachinePicker,
  type ClassOption,
  type MachineProfileOption,
  type MachineCategory,
} from "@/components/fabrication/ClassMachinePicker";
import { FileDropzone } from "@/components/fabrication/FileDropzone";
import { UploadProgress } from "@/components/fabrication/UploadProgress";
import {
  uploadReducer,
  initialUploadState,
  type UploadAction,
} from "@/components/fabrication/upload-state";
import type { FabricationFileType } from "@/components/fabrication/picker-helpers";
import {
  PREFERRED_COLOR_OPTIONS,
  PREFERRED_COLOR_NO_PREFERENCE,
  PREFERRED_COLOR_OTHER_SENTINEL,
  PREFERRED_COLOR_MAX_LEN,
  resolveColorChoice,
} from "@/lib/fabrication/preferred-color-options";

interface PickerData {
  classes: ClassOption[];
  machineProfiles: MachineProfileOption[];
}

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: PickerData };

export default function FabricationNewPage() {
  const router = useRouter();
  const [loadState, setLoadState] = React.useState<LoadState>({ kind: "loading" });
  const [selectedClassId, setSelectedClassId] = React.useState<string | null>(null);
  // Phase 8.1d-10: type-first picker. Category narrows the machine list.
  const [selectedCategory, setSelectedCategory] =
    React.useState<MachineCategory | null>(null);
  // Phase 8.1d-22: lab is its own selection so "Any [category] in [lab]"
  // can be the default upload payload. Specific-machine path is opt-in
  // via the picker's collapsible toggle.
  const [selectedLabId, setSelectedLabId] = React.useState<string | null>(null);
  const [selectedMachineProfileId, setSelectedMachineProfileId] = React.useState<
    string | null
  >(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [fileType, setFileType] = React.useState<FabricationFileType | null>(null);
  const [validationError, setValidationError] = React.useState<string | null>(null);
  // Phase 8.1d-COLORv1: preferred filament color for 3D-printer
  // jobs. Default = "No preference" so it's never blocking. Hidden
  // entirely for laser-cutter selections.
  const [preferredColorChoice, setPreferredColorChoice] = React.useState<string>(
    PREFERRED_COLOR_NO_PREFERENCE
  );
  const [preferredColorOther, setPreferredColorOther] = React.useState<string>("");
  // Quantity (13 May 2026): student picks how many copies they want.
  // Defaults to 1. Bound 1..20 (matches server validation + DB CHECK).
  const [quantity, setQuantity] = React.useState<number>(1);
  const [uploadState, dispatch] = React.useReducer(uploadReducer, initialUploadState);
  // Phase 8.1d-11: instant click feedback. The /upload POST takes
  // 100-500ms before uploadReducer transitions to "uploading", so
  // the button stayed clickable + double-clickable in that window.
  // `isPreparing` flips true synchronously on click and clears
  // when uploadState moves out of idle. Don't fold this into the
  // reducer — the reducer's "idle" lane is the right rest state
  // and we'd otherwise need a fourth pre-upload status to model
  // "click sent, fetch in flight" without lying about jobId/total.
  const [isPreparing, setIsPreparing] = React.useState(false);

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

  // Phase 8.1d-22: a valid pick is EITHER a specific machine OR
  // (lab + category). The picker's auto-resolution effects fill
  // single-option cases for us, so by the time a class is picked
  // we should have a valid combo for the active student.
  const hasValidMachineSelection =
    selectedMachineProfileId !== null ||
    (selectedLabId !== null && selectedCategory !== null);

  const canUpload =
    loadState.kind === "ready" &&
    selectedClassId !== null &&
    hasValidMachineSelection &&
    file !== null &&
    fileType !== null &&
    (uploadState.kind === "idle" || uploadState.kind === "error") &&
    !isPreparing;

  const isBusy =
    uploadState.kind === "uploading" ||
    uploadState.kind === "enqueuing" ||
    isPreparing;

  async function handleUpload() {
    if (!file || !fileType || !selectedClassId) return;
    // Phase 8.1d-22: require EITHER specific machine OR (lab + category).
    if (
      !selectedMachineProfileId &&
      !(selectedLabId && selectedCategory)
    ) {
      return;
    }
    if (isPreparing) return; // double-click guard
    setValidationError(null);
    // Flip the button to its "preparing" state synchronously, BEFORE
    // the await on /upload. This is the user-visible feedback the
    // student needs in the 100-500ms before START_UPLOAD lands.
    setIsPreparing(true);

    // Phase 8.1d-22: send machineProfileId when the student opted into
    // a specific machine; otherwise send (labId + machineCategory) so
    // the fab assigns a machine on pickup. Validation server-side
    // rejects sending both.
    const machineFields: Record<string, string> = selectedMachineProfileId
      ? { machineProfileId: selectedMachineProfileId }
      : {
          labId: selectedLabId as string,
          machineCategory: selectedCategory as string,
        };

    // Phase 8.1d-COLORv1: only attach preferredColor for 3D-printer
    // category. Server also enforces this — duplicating client-side
    // for clarity + to avoid sending stale "Other:" payload when
    // the student switched category mid-form.
    const colorFields: Record<string, string | null> =
      selectedCategory === "3d_printer"
        ? {
            preferredColor: resolveColorChoice(
              preferredColorChoice,
              preferredColorOther
            ),
          }
        : {};

    // Step 1: POST /upload to create rows + mint signed URL.
    let initResult: {
      jobId: string;
      revisionId: string;
      uploadUrl: string;
      storagePath: string;
    };
    try {
      const res = await fetch("/api/student/fabrication/upload", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: selectedClassId,
          ...machineFields,
          ...colorFields,
          fileType,
          originalFilename: file.name,
          fileSizeBytes: file.size,
          quantity,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        dispatch({
          type: "ERROR",
          message: body.error || `Upload init failed (HTTP ${res.status})`,
        });
        setIsPreparing(false);
        return;
      }
      initResult = await res.json();
    } catch (e) {
      dispatch({
        type: "ERROR",
        message: e instanceof Error ? e.message : "Upload init failed",
      });
      setIsPreparing(false);
      return;
    }

    // Hand control to the reducer — uploadState moves to "uploading"
    // which already covers the disabled-button / progress-bar UI, so
    // isPreparing can drop here.
    dispatch({
      type: "START_UPLOAD",
      jobId: initResult.jobId,
      revisionId: initResult.revisionId,
      totalBytes: file.size,
    });
    setIsPreparing(false);

    // Step 2: PUT file to the signed URL with XHR progress.
    //
    // We use XMLHttpRequest instead of fetch() because fetch doesn't
    // expose upload-direction progress events (ReadableStream request
    // bodies aren't widely supported, and even when they are the browser
    // doesn't surface progress to the caller). If a proxy strips the
    // progress events we fall back to the indeterminate spinner via
    // PROGRESS_INDETERMINATE (brief §5 stop trigger — don't block on it).
    const uploadOk = await new Promise<boolean>((resolve) => {
      const xhr = new XMLHttpRequest();
      let anyProgressSeen = false;
      xhr.open("PUT", initResult.uploadUrl, true);
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) {
          anyProgressSeen = true;
          dispatch({ type: "PROGRESS", loaded: ev.loaded, total: ev.total });
        }
      };
      // If no progress events have fired within 1.5s, flip to indeterminate
      // so the user knows we're still working.
      const indeterminateTimer = window.setTimeout(() => {
        if (!anyProgressSeen) dispatch({ type: "PROGRESS_INDETERMINATE" });
      }, 1500);
      xhr.onload = () => {
        window.clearTimeout(indeterminateTimer);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(true);
        } else {
          dispatch({
            type: "ERROR",
            message: `Upload failed (HTTP ${xhr.status}). Try again.`,
          });
          resolve(false);
        }
      };
      xhr.onerror = () => {
        window.clearTimeout(indeterminateTimer);
        dispatch({
          type: "ERROR",
          message: "Upload network error — check your connection and try again.",
        });
        resolve(false);
      };
      xhr.onabort = () => {
        window.clearTimeout(indeterminateTimer);
        dispatch({ type: "ERROR", message: "Upload was cancelled." });
        resolve(false);
      };
      // Supabase signed URLs accept the raw file body. Content-Type
      // should match the object's type — best-effort mapping below,
      // with octet-stream fallback.
      const contentType = fileType === "svg" ? "image/svg+xml" : "model/stl";
      xhr.setRequestHeader("Content-Type", contentType);
      xhr.send(file);
    });

    if (!uploadOk) return;

    dispatch({ type: "UPLOAD_COMPLETE" });

    // Step 3: enqueue scan. Idempotent per 4-2 — safe to retry without
    // creating duplicate scan_jobs.
    try {
      const enqRes = await fetch(
        `/api/student/fabrication/jobs/${initResult.jobId}/enqueue-scan`,
        {
          method: "POST",
          credentials: "same-origin",
        }
      );
      if (!enqRes.ok) {
        const body = await enqRes.json().catch(() => ({ error: `HTTP ${enqRes.status}` }));
        dispatch({
          type: "ERROR",
          message: body.error || `Couldn't queue the scan (HTTP ${enqRes.status})`,
        });
        return;
      }
    } catch (e) {
      dispatch({
        type: "ERROR",
        message: e instanceof Error ? e.message : "Couldn't queue the scan",
      });
      return;
    }

    dispatch({ type: "ENQUEUE_COMPLETE" });

    // Step 4: redirect to the 4-5 status page.
    // Note: `(student)` is a Next.js route group — the parens mean it
    // doesn't contribute to the URL. So pages under src/app/(student)/
    // live at `/...` not `/student/...`. Same convention as existing
    // links (Link href="/dashboard", "/my-tools" throughout the codebase).
    router.push(`/fabrication/jobs/${initResult.jobId}`);
  }

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Submit a file for fabrication
        </h1>
        <p className="text-base text-gray-600 mt-2">
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
          {/* Phase 8.1d-5: dropped the class-to-lab filter. Picker now
               shows all machines grouped by lab name (via
               groupMachinesByLab inside ClassMachinePicker). Teacher
               organisation flows through naturally; no class-to-lab
               assignment overhead. */}
          <ClassMachinePicker
            classes={loadState.data.classes}
            machineProfiles={loadState.data.machineProfiles}
            selectedClassId={selectedClassId}
            selectedCategory={selectedCategory}
            selectedLabId={selectedLabId}
            selectedMachineProfileId={selectedMachineProfileId}
            onClassChange={setSelectedClassId}
            onCategoryChange={(cat) => {
              // Switching category clears lab + machine — both were
              // scoped to the previous category so they shouldn't
              // survive the change.
              setSelectedCategory(cat);
              setSelectedLabId(null);
              setSelectedMachineProfileId(null);
            }}
            onLabChange={(labId) => {
              // Switching lab clears the specific machine (it was
              // scoped to a different lab).
              setSelectedLabId(labId);
              setSelectedMachineProfileId(null);
            }}
            onMachineChange={setSelectedMachineProfileId}
            disabled={isBusy}
          />

          {/* Phase 8.1d-COLORv1: filament color picker, 3D-printer only.
              Hidden for lasers (color is a 3D-printer concept; laser
              jobs care about material thickness which is a future
              field). "No preference" is the default so the field is
              never blocking. */}
          {selectedCategory === "3d_printer" && (
            <div className="space-y-2">
              <label
                htmlFor="preferred-color"
                className="text-sm font-medium text-gray-900"
              >
                Preferred filament color
              </label>
              <select
                id="preferred-color"
                value={preferredColorChoice}
                onChange={(e) => setPreferredColorChoice(e.target.value)}
                disabled={isBusy}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/40 focus:border-brand-purple disabled:opacity-50"
              >
                {PREFERRED_COLOR_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {preferredColorChoice === PREFERRED_COLOR_OTHER_SENTINEL && (
                <div className="space-y-1">
                  <input
                    type="text"
                    placeholder="e.g. neon pink, glow-in-dark green"
                    value={preferredColorOther}
                    onChange={(e) =>
                      setPreferredColorOther(
                        e.target.value.slice(0, PREFERRED_COLOR_MAX_LEN - 7)
                      )
                    }
                    disabled={isBusy}
                    maxLength={PREFERRED_COLOR_MAX_LEN - 7}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/40 focus:border-brand-purple disabled:opacity-50"
                  />
                  <p className="text-xs text-gray-500">
                    The fabricator will see "Other: {preferredColorOther || "…"}".
                  </p>
                </div>
              )}
              <p className="text-xs text-gray-500">
                Helps the fabricator pick the right filament. They'll do their
                best — exact color depends on what's loaded.
              </p>
            </div>
          )}

          {/* Quantity (13 May 2026): student picks how many copies. Default 1.
              Renders for both 3D-printer and laser-cutter — students typically
              need 4 wheels, 2 axles, etc. The lab tech prints/cuts N copies
              from the single file and marks the job complete once.  */}
          <div className="space-y-2">
            <label
              htmlFor="quantity"
              className="text-sm font-medium text-gray-900"
            >
              How many copies?
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={isBusy || quantity <= 1}
                className="h-10 w-10 rounded-xl border border-gray-300 bg-white text-lg font-bold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Decrease quantity"
              >
                −
              </button>
              <input
                id="quantity"
                type="number"
                value={quantity}
                onChange={(e) => {
                  const n = Number.parseInt(e.target.value, 10);
                  if (Number.isFinite(n)) {
                    setQuantity(Math.max(1, Math.min(20, n)));
                  }
                }}
                min={1}
                max={20}
                disabled={isBusy}
                className="h-10 w-20 rounded-xl border border-gray-300 bg-white px-3 text-center text-base font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-purple/40 focus:border-brand-purple disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(20, q + 1))}
                disabled={isBusy || quantity >= 20}
                className="h-10 w-10 rounded-xl border border-gray-300 bg-white text-lg font-bold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Increase quantity"
              >
                +
              </button>
              {quantity > 1 && (
                <span className="text-sm font-semibold text-purple-700">
                  × {quantity} copies
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">
              Need a few of the same thing (e.g. 4 wheels)? Set the count here.
              The fabricator will make all {quantity > 1 ? quantity : "the"} copies before
              marking the job complete. Max 20 — talk to your teacher for more.
            </p>
          </div>

          <FileDropzone
            file={file}
            onFilePicked={(picked, ft) => {
              setFile(picked);
              setFileType(ft);
              setValidationError(null);
              if (uploadState.kind === "error") dispatch({ type: "RESET" });
            }}
            onValidationError={(msg) => setValidationError(msg)}
            disabled={isBusy}
          />

          {validationError && (
            <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm text-amber-900">{validationError}</p>
            </div>
          )}

          <UploadProgress state={uploadState} />

          <button
            type="button"
            onClick={handleUpload}
            disabled={!canUpload}
            className="w-full py-2.5 rounded-xl bg-brand-purple text-white text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center justify-center gap-2"
          >
            {isPreparing ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Preparing upload…
              </>
            ) : uploadState.kind === "error" ? (
              "Try again"
            ) : (
              "Upload and scan"
            )}
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
