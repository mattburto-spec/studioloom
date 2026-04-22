"use client";

/**
 * /fabrication/jobs/[jobId] — Preflight Phase 5-4 status + results page.
 * (File path uses the `(student)` route group — URL is /fabrication/jobs/X,
 * NOT /student/fabrication/jobs/X. PH4-FINDING-01.)
 *
 * Flow:
 *   1. Polls /api/student/fabrication/jobs/[jobId]/status?include=results
 *      via useFabricationStatus hook (Phase 4-5, extended 5-4).
 *   2. While scan is pending/running → renders ScanProgressCard
 *      (Phase 4-5 staged-messaging spinner).
 *   3. On scan_status === 'done' → delegates to ScanResultsViewer
 *      (Phase 5-3) for the 3-bucket soft-gate UI.
 *   4. On scan_status === 'error' OR polling error → renders error card
 *      via ScanProgressCard's error state (untouched).
 *   5. On 90s timeout → ScanProgressCard's timeout state.
 *
 * User actions from the results viewer:
 *   - onAcknowledge(ruleId, choice) → POST /acknowledge-warning, update
 *     local ack state optimistically.
 *   - onSubmit() → POST /submit, router.push /fabrication/submitted/[jobId]
 *     on success (submitted stub page lands in Phase 5-6).
 *   - onReupload() → stub for Phase 5-5 (ReuploadModal). For now, simple
 *     inline redirect to /fabrication/new — user loses the jobId context
 *     but the flow still works end-to-end for the Checkpoint 5.1 smoke.
 */

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useFabricationStatus } from "@/hooks/useFabricationStatus";
import { ScanProgressCard } from "@/components/fabrication/ScanProgressCard";
import { ScanResultsViewer } from "@/components/fabrication/ScanResultsViewer";
import { canSubmit, type Rule } from "@/lib/fabrication/rule-buckets";
import type {
  AckChoice,
  AcknowledgedWarnings,
  JobStatusSuccess,
} from "@/lib/fabrication/orchestration";

export default function FabricationJobStatusPage() {
  const params = useParams<{ jobId: string }>();
  const router = useRouter();
  const jobId = params?.jobId;

  const pollState = useFabricationStatus(jobId ?? "", { includeResults: true });

  // Local ack state — mirrors server-side acknowledged_warnings but
  // allows optimistic updates when the student clicks a radio. Hydrated
  // from the first poll response that carries acknowledged_warnings;
  // subsequent polls don't overwrite (student's in-flight clicks win).
  const [localAcks, setLocalAcks] = React.useState<AcknowledgedWarnings>({});
  const hydratedFromServerRef = React.useRef(false);

  React.useEffect(() => {
    if (hydratedFromServerRef.current) return;
    if (pollState.kind !== "polling" && pollState.kind !== "done") return;
    const serverAcks = (pollState.status as JobStatusSuccess).acknowledgedWarnings;
    if (serverAcks !== undefined) {
      // Server types `choice` as a loose string for forward-compat
      // (manual SQL edits, migrations adding new choices, etc). Local
      // state trusts the DB shape — if the choice doesn't match any
      // AckChoice, the radio renders with no selection (graceful
      // degrade, no crash).
      setLocalAcks((serverAcks ?? {}) as AcknowledgedWarnings);
      hydratedFromServerRef.current = true;
    }
  }, [pollState]);

  const [isAckInFlight, setIsAckInFlight] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  async function handleAcknowledge(ruleId: string, choice: AckChoice) {
    if (pollState.kind !== "done" || !jobId) return;
    const revisionNumber = pollState.status.currentRevision;
    const revisionKey = `revision_${revisionNumber}`;

    // Optimistic update — roll back on failure.
    const previousAcks = localAcks;
    setLocalAcks({
      ...localAcks,
      [revisionKey]: {
        ...(localAcks[revisionKey] ?? {}),
        [ruleId]: { choice, timestamp: new Date().toISOString() },
      },
    });
    setActionError(null);
    setIsAckInFlight(true);

    try {
      const res = await fetch(
        `/api/student/fabrication/jobs/${jobId}/acknowledge-warning`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ revisionNumber, ruleId, choice }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "" }));
        setLocalAcks(previousAcks);
        setActionError(
          body.error || `Couldn't save acknowledgement (HTTP ${res.status})`
        );
      } else {
        const body = await res.json();
        if (body.acknowledgedWarnings) setLocalAcks(body.acknowledgedWarnings);
      }
    } catch (e) {
      setLocalAcks(previousAcks);
      setActionError(
        e instanceof Error ? e.message : "Network error saving acknowledgement"
      );
    } finally {
      setIsAckInFlight(false);
    }
  }

  async function handleSubmit() {
    if (pollState.kind !== "done" || !jobId) return;
    setActionError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/student/fabrication/jobs/${jobId}/submit`, {
        method: "POST",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "" }));
        setActionError(body.error || `Submit failed (HTTP ${res.status})`);
        setIsSubmitting(false);
        return;
      }
      // Redirect to submitted stub (Phase 5-6 lands the page).
      router.push(`/fabrication/submitted/${jobId}`);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Network error submitting");
      setIsSubmitting(false);
    }
  }

  function handleReupload() {
    // Phase 5-5 will replace this with an inline modal that creates
    // revision N+1 on the existing job (preserving class/machine/unit
    // context). For 5-4 the simplest end-to-end path: drop the student
    // back to /fabrication/new. They'll create a fresh job — not ideal
    // but validates the rest of the flow.
    router.push("/fabrication/new");
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">
          {pollState.kind === "done" ? "Your scan is ready" : "Checking your file"}
        </h1>
        {pollState.kind !== "done" && (
          <p className="text-sm text-gray-600 mt-1">
            We&apos;re running a quick machine-readiness check before your file
            goes to the lab tech.
          </p>
        )}
      </header>

      {!jobId && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-900">
            Missing job id — this page needs a valid URL.
          </p>
        </div>
      )}

      {jobId && pollState.kind === "done" ? (
        <DoneStateView
          pollState={pollState}
          localAcks={localAcks}
          onAcknowledge={handleAcknowledge}
          onSubmit={handleSubmit}
          onReupload={handleReupload}
          isAckInFlight={isAckInFlight}
          isSubmitting={isSubmitting}
          actionError={actionError}
        />
      ) : jobId ? (
        <ScanProgressCard state={pollState} />
      ) : null}
    </main>
  );
}

/**
 * Extracted so the main component stays readable. Computes canSubmit
 * from the live ack state + renders the soft-gate UI + any action error.
 */
function DoneStateView(props: {
  pollState: Extract<ReturnType<typeof useFabricationStatus>, { kind: "done" }>;
  localAcks: AcknowledgedWarnings;
  onAcknowledge: (ruleId: string, choice: AckChoice) => void;
  onSubmit: () => void;
  onReupload: () => void;
  isAckInFlight: boolean;
  isSubmitting: boolean;
  actionError: string | null;
}) {
  const {
    pollState,
    localAcks,
    onAcknowledge,
    onSubmit,
    onReupload,
    isAckInFlight,
    isSubmitting,
    actionError,
  } = props;

  const status = pollState.status as JobStatusSuccess;
  const revisionNumber = status.currentRevision;
  const scanResults = (status.scanResults ?? { rules: [] }) as { rules?: Rule[] | null };
  const gate = canSubmit({
    results: scanResults,
    acknowledgedWarnings: localAcks,
    revisionNumber,
  });

  return (
    <div className="space-y-4">
      {actionError && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-900">{actionError}</p>
        </div>
      )}

      <ScanResultsViewer
        scanResults={scanResults}
        acknowledgedWarnings={localAcks}
        revisionNumber={revisionNumber}
        canSubmitState={gate}
        onAcknowledge={onAcknowledge}
        onSubmit={onSubmit}
        onReupload={onReupload}
        isAckInFlight={isAckInFlight}
        isSubmitting={isSubmitting}
        thumbnailUrl={status.revision?.thumbnailUrl ?? null}
      />

      <div className="pt-4 text-xs text-gray-500">
        <Link href="/dashboard" className="underline hover:no-underline">
          ← Back to dashboard
        </Link>
      </div>
    </div>
  );
}
