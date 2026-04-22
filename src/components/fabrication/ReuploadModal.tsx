"use client";

/**
 * ReuploadModal — Phase 5-5. Inline modal for re-uploading a fixed
 * version of an existing job. Replaces the Phase 5-4 temporary redirect
 * to /fabrication/new (which created a fresh job + lost context).
 *
 * Flow (mirror of Phase 4-4 upload page orchestration):
 *   1. User picks file via FileDropzone (reused from Phase 4-4).
 *   2. POST /api/student/fabrication/jobs/[jobId]/revisions → signed URL.
 *   3. XHR PUT file to signed URL with progress events.
 *   4. POST /enqueue-scan (idempotent via unique-active-per-revision).
 *   5. onSuccess callback → page resets polling hook so new revision
 *      streams through the same status UI.
 *
 * Locked to the original job's fileType (STL or SVG) — a student
 * mid-STL-project can't switch to SVG for revision 2. The server also
 * validates this (createRevision 400s on mismatch) but surfacing it in
 * the dropzone's accept attribute prevents the user from even picking
 * a wrong-type file.
 */

import * as React from "react";
import { FileDropzone } from "./FileDropzone";
import { UploadProgress } from "./UploadProgress";
import {
  uploadReducer,
  initialUploadState,
} from "./upload-state";
import type { FabricationFileType } from "./picker-helpers";

export interface ReuploadModalProps {
  jobId: string;
  originalFileType: FabricationFileType;
  onClose: () => void;
  /** Called after enqueue-scan returns 200 — page resets its poll hook. */
  onSuccess: (revisionId: string) => void;
}

export function ReuploadModal({
  jobId,
  originalFileType,
  onClose,
  onSuccess,
}: ReuploadModalProps) {
  const [file, setFile] = React.useState<File | null>(null);
  const [detectedType, setDetectedType] = React.useState<FabricationFileType | null>(null);
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const [uploadState, dispatch] = React.useReducer(uploadReducer, initialUploadState);

  const isBusy =
    uploadState.kind === "uploading" || uploadState.kind === "enqueuing";
  const canConfirm =
    !!file && !!detectedType && (uploadState.kind === "idle" || uploadState.kind === "error");

  // Esc to close (but not mid-upload).
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !isBusy) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isBusy, onClose]);

  async function handleConfirm() {
    if (!file || !detectedType) return;

    // Client-side fileType lock — already enforced by the dropzone's
    // `accept`, but double-check in case the browser let it through.
    if (detectedType !== originalFileType) {
      setValidationError(
        `This job started with a .${originalFileType} file. Re-upload must also be .${originalFileType}.`
      );
      return;
    }

    // Step 1: POST /revisions to create revision N+1 + mint signed URL.
    let initResult: {
      jobId: string;
      revisionId: string;
      uploadUrl: string;
      storagePath: string;
    };
    try {
      const res = await fetch(
        `/api/student/fabrication/jobs/${jobId}/revisions`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileType: detectedType,
            originalFilename: file.name,
            fileSizeBytes: file.size,
          }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        dispatch({
          type: "ERROR",
          message: body.error || `Re-upload init failed (HTTP ${res.status})`,
        });
        return;
      }
      initResult = await res.json();
    } catch (e) {
      dispatch({
        type: "ERROR",
        message: e instanceof Error ? e.message : "Re-upload init failed",
      });
      return;
    }

    dispatch({
      type: "START_UPLOAD",
      jobId: initResult.jobId,
      revisionId: initResult.revisionId,
      totalBytes: file.size,
    });

    // Step 2: XHR PUT (same pattern as Phase 4-4 — fetch doesn't
    // expose upload progress).
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
      const indeterminateTimer = window.setTimeout(() => {
        if (!anyProgressSeen) dispatch({ type: "PROGRESS_INDETERMINATE" });
      }, 1500);
      xhr.onload = () => {
        window.clearTimeout(indeterminateTimer);
        if (xhr.status >= 200 && xhr.status < 300) resolve(true);
        else {
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
      const contentType = detectedType === "svg" ? "image/svg+xml" : "model/stl";
      xhr.setRequestHeader("Content-Type", contentType);
      xhr.send(file);
    });

    if (!uploadOk) return;

    dispatch({ type: "UPLOAD_COMPLETE" });

    // Step 3: enqueue scan for the new revision.
    try {
      const enqRes = await fetch(
        `/api/student/fabrication/jobs/${jobId}/enqueue-scan`,
        { method: "POST", credentials: "same-origin" }
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

    // Step 4: hand control back to the page, which resets the poll hook.
    onSuccess(initResult.revisionId);
  }

  return (
    <div
      role="dialog"
      aria-labelledby="reupload-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0, 0, 0, 0.5)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isBusy) onClose();
      }}
    >
      <div
        className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl"
        // Stop propagation so clicks inside don't bubble to the backdrop.
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="reupload-title" className="text-lg font-bold text-gray-900">
            Re-upload a fixed version
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            aria-label="Close"
            className="p-1 text-gray-500 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Upload a new <code className="font-mono">.{originalFileType}</code> file
          for the same job. Your previous revision stays in the history below.
        </p>

        <div className="space-y-4">
          <FileDropzone
            file={file}
            onFilePicked={(picked, ft) => {
              setFile(picked);
              setDetectedType(ft);
              setValidationError(null);
              if (uploadState.kind === "error") dispatch({ type: "RESET" });
            }}
            onValidationError={setValidationError}
            disabled={isBusy}
          />

          {validationError && (
            <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm text-amber-900">{validationError}</p>
            </div>
          )}

          <UploadProgress state={uploadState} />

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!canConfirm}
              className="flex-1 py-2.5 rounded-xl bg-brand-purple text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {uploadState.kind === "error"
                ? "Try again"
                : `Upload revision`}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isBusy}
              className="px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-sm font-semibold text-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReuploadModal;
