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
} from "@/components/fabrication/ClassMachinePicker";
import { FileDropzone } from "@/components/fabrication/FileDropzone";
import { UploadProgress } from "@/components/fabrication/UploadProgress";
import {
  uploadReducer,
  initialUploadState,
  type UploadAction,
} from "@/components/fabrication/upload-state";
import type { FabricationFileType } from "@/components/fabrication/picker-helpers";

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
  const [selectedMachineProfileId, setSelectedMachineProfileId] = React.useState<
    string | null
  >(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [fileType, setFileType] = React.useState<FabricationFileType | null>(null);
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const [uploadState, dispatch] = React.useReducer(uploadReducer, initialUploadState);

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
    selectedMachineProfileId !== null &&
    file !== null &&
    fileType !== null &&
    (uploadState.kind === "idle" || uploadState.kind === "error");

  const isBusy =
    uploadState.kind === "uploading" || uploadState.kind === "enqueuing";

  async function handleUpload() {
    if (!file || !fileType || !selectedClassId || !selectedMachineProfileId) return;
    setValidationError(null);

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
          machineProfileId: selectedMachineProfileId,
          fileType,
          originalFilename: file.name,
          fileSizeBytes: file.size,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        dispatch({
          type: "ERROR",
          message: body.error || `Upload init failed (HTTP ${res.status})`,
        });
        return;
      }
      initResult = await res.json();
    } catch (e) {
      dispatch({
        type: "ERROR",
        message: e instanceof Error ? e.message : "Upload init failed",
      });
      return;
    }

    dispatch({
      type: "START_UPLOAD",
      jobId: initResult.jobId,
      revisionId: initResult.revisionId,
      totalBytes: file.size,
    });

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
          <ClassMachinePicker
            classes={loadState.data.classes}
            machineProfiles={loadState.data.machineProfiles}
            selectedClassId={selectedClassId}
            selectedMachineProfileId={selectedMachineProfileId}
            onClassChange={setSelectedClassId}
            onMachineChange={setSelectedMachineProfileId}
            disabled={isBusy}
          />

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
            className="w-full py-2.5 rounded-xl bg-brand-purple text-white text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {uploadState.kind === "error" ? "Try again" : "Upload and scan"}
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
