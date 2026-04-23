"use client";

/**
 * ScanResultsViewer — Phase 5-3 container for the soft-gate UX.
 *
 * Renders the three-bucket results layout from spec §8 plus the submit
 * + re-upload actions. Stateless / controlled — parent (5-4 status
 * page) owns ack state + wires the API calls.
 *
 * Submit enablement is driven by the `canSubmitState` prop produced by
 * canSubmit() (Phase 5-2). Same predicate the server enforces, so the
 * button state can't drift from what the submit endpoint would accept.
 */

import * as React from "react";
import { RuleCard } from "./RuleCard";
import {
  classifyRules,
  type Rule,
  type CanSubmitResult,
} from "@/lib/fabrication/rule-buckets";
import type { AckChoice, AcknowledgedWarnings } from "@/lib/fabrication/orchestration";

export interface ScanResultsViewerProps {
  scanResults: { rules?: Rule[] | null };
  acknowledgedWarnings: AcknowledgedWarnings | null;
  revisionNumber: number;
  canSubmitState: CanSubmitResult;
  onAcknowledge: (ruleId: string, choice: AckChoice) => void;
  onSubmit: () => void;
  onReupload: () => void;
  isSubmitting?: boolean;
  isAckInFlight?: boolean;
  /** Filename of the currently-displayed revision, for the header strip. */
  filename?: string;
  /** Thumbnail URL (signed) to display at the top of the viewer. */
  thumbnailUrl?: string | null;
  /** Machine profile label for the header strip. */
  machineLabel?: string;
  /** Drives the fileType-aware ack option labels (STL: slicer, SVG:
   *  design software). Defaults to 'stl' — page should always pass. */
  fileType?: "stl" | "svg";
  /** Phase 6-2: teacher-side read-only view. When true: Submit +
   *  Re-upload buttons + gate explainer are hidden, radios show the
   *  student's choices but can't be changed, empty-state hint labels
   *  flip from "ready to submit" to "student saw no issues". */
  readOnly?: boolean;
  /** Phase 6-6c: hide ONLY the Submit button (keep Re-upload visible
   *  + interactive). Used on the student-side status page when the
   *  job is in `needs_revision` or `pending_approval` — Submit is
   *  inappropriate (teacher asked for a fix / already submitted) but
   *  re-uploading a new revision is still the valid next step.
   *  Caller derives via shouldHideSubmitButton(jobStatus). Ignored
   *  when readOnly is true (that hides both anyway). */
  hideSubmit?: boolean;
  /** Phase 6-6e: suppress the built-in thumbnail + metadata header
   *  strip. Set when the caller renders its own preview panel (e.g.
   *  the student status page's 2-column layout moves the thumbnail
   *  to a sidebar card alongside the revision history). Bucket
   *  sections + actions still render. */
  hideHeaderStrip?: boolean;
}

export function ScanResultsViewer(props: ScanResultsViewerProps) {
  const {
    scanResults,
    acknowledgedWarnings,
    revisionNumber,
    canSubmitState,
    onAcknowledge,
    onSubmit,
    onReupload,
    isSubmitting = false,
    isAckInFlight = false,
    filename,
    thumbnailUrl,
    machineLabel,
    fileType = "stl",
    readOnly = false,
    hideSubmit = false,
    hideHeaderStrip = false,
  } = props;

  const buckets = classifyRules(scanResults);
  const revisionKey = `revision_${revisionNumber}`;
  const acksForRevision = acknowledgedWarnings?.[revisionKey] ?? {};

  const disabledFromAction = isSubmitting || isAckInFlight;

  return (
    <div className="space-y-8">
      {/* Header strip — thumbnail + file metadata. Centred on wider
          containers so the thumbnail isn't floating against the left
          edge with acres of empty space. Suppressed by hideHeaderStrip
          when the page renders its own preview panel (e.g. 2-column
          student layout). */}
      {!hideHeaderStrip && (filename || thumbnailUrl || machineLabel) && (
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 rounded-2xl border border-gray-200 bg-white p-6">
          {thumbnailUrl && (
            <img
              src={thumbnailUrl}
              alt="Scan preview"
              className="w-64 h-64 rounded-xl border border-gray-200 object-contain bg-gray-50 shrink-0"
            />
          )}
          <div className="flex-1 min-w-0 w-full">
            {filename && (
              <h2 className="text-base font-semibold text-gray-900 break-all">
                {filename}
              </h2>
            )}
            <div className="text-sm text-gray-600 mt-1 space-x-2">
              {machineLabel && <span>{machineLabel}</span>}
              {machineLabel && <span aria-hidden="true">·</span>}
              <span>Revision {revisionNumber}</span>
            </div>
          </div>
        </div>
      )}

      {/* Must-fix bucket */}
      {buckets.mustFix.length > 0 && (
        <section aria-labelledby="mustfix-heading" className="space-y-4">
          <h2
            id="mustfix-heading"
            className="text-xl font-bold text-gray-900 flex items-center gap-3"
          >
            <span
              aria-hidden="true"
              className="inline-block w-1.5 h-7 rounded-full bg-red-500"
            />
            Must fix
            <span className="text-base font-normal text-gray-500">
              ({buckets.mustFix.length})
            </span>
          </h2>
          {buckets.mustFix.map((rule) => (
            <RuleCard key={rule.id} rule={rule} disabled={disabledFromAction} />
          ))}
          <p className="text-sm text-red-800 italic">
            These must be resolved in the file — re-upload a fixed version before
            submitting.
          </p>
        </section>
      )}

      {/* Should-fix bucket */}
      {buckets.shouldFix.length > 0 && (
        <section aria-labelledby="shouldfix-heading" className="space-y-4">
          <h2
            id="shouldfix-heading"
            className="text-xl font-bold text-gray-900 flex items-center gap-3 flex-wrap"
          >
            <span
              aria-hidden="true"
              className="inline-block w-1.5 h-7 rounded-full bg-amber-500"
            />
            Should fix
            <span className="text-base font-normal text-gray-500">
              ({buckets.shouldFix.length})
            </span>
            {!readOnly && (
              <span className="text-sm font-normal text-amber-800">
                — acknowledge each
              </span>
            )}
          </h2>
          {buckets.shouldFix.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              currentChoice={acksForRevision[rule.id]?.choice}
              onAcknowledge={onAcknowledge}
              disabled={disabledFromAction}
              fileType={fileType}
              readOnly={readOnly}
            />
          ))}
        </section>
      )}

      {/* FYI bucket */}
      {buckets.fyi.length > 0 && (
        <section aria-labelledby="fyi-heading" className="space-y-4">
          <h2
            id="fyi-heading"
            className="text-xl font-bold text-gray-900 flex items-center gap-3"
          >
            <span
              aria-hidden="true"
              className="inline-block w-1.5 h-7 rounded-full bg-gray-400"
            />
            Good to know
            <span className="text-base font-normal text-gray-500">
              ({buckets.fyi.length})
            </span>
          </h2>
          {buckets.fyi.map((rule) => (
            <RuleCard key={rule.id} rule={rule} disabled={disabledFromAction} />
          ))}
        </section>
      )}

      {/* Empty state — no rules fired at all */}
      {buckets.mustFix.length === 0 &&
        buckets.shouldFix.length === 0 &&
        buckets.fyi.length === 0 && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
            {readOnly
              ? "Scan passed with no rules fired — clean submission."
              : "No issues found. Your file is ready to submit."}
          </div>
        )}

      {/* Submit + Re-upload actions (hidden in teacher readOnly view).
          When hideSubmit is set (jobStatus = needs_revision or
          pending_approval — see shouldHideSubmitButton), Submit is
          omitted and Re-upload becomes the primary purple action. */}
      {!readOnly && (
        <>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            {!hideSubmit && (
              <button
                type="button"
                onClick={onSubmit}
                disabled={!canSubmitState.ok || disabledFromAction}
                className="flex-1 py-2.5 rounded-xl bg-brand-purple text-white text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                {isSubmitting ? "Submitting…" : "Submit for approval"}
              </button>
            )}
            <button
              type="button"
              onClick={onReupload}
              disabled={disabledFromAction}
              className={
                hideSubmit
                  ? "flex-1 py-2.5 rounded-xl bg-brand-purple text-white text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
                  : "flex-1 py-2.5 rounded-xl border border-gray-300 bg-white text-sm font-semibold text-gray-800 transition-all hover:bg-gray-50 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
              }
            >
              Re-upload a fixed version
            </button>
          </div>

          {/* Gate-failure explainer (student-only, pre-submit only) */}
          {!hideSubmit && !canSubmitState.ok && canSubmitState.reason && (
            <p role="status" className="text-xs text-gray-600 italic">
              {canSubmitState.reason === "blockers_present"
                ? "Submit is disabled until all must-fix issues are resolved in a re-uploaded version."
                : "Submit is disabled until every should-fix warning has an acknowledgement above."}
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default ScanResultsViewer;
