"use client";

/**
 * /fabrication/submitted/[jobId] — Preflight Phase 5-6 confirmation page.
 * (File path uses the `(student)` route group — URL is /fabrication/submitted/X,
 * NOT /student/fabrication/submitted/X. PH4-FINDING-01.)
 *
 * Landing target for router.push after a successful POST /submit. Shows
 * a brief confirmation keyed to fabrication_jobs.status:
 *   - pending_approval → "Waiting for your teacher to review"
 *   - approved         → "Ready for the lab tech to queue"
 *   - anything else    → "Submission recorded" (defensive catch-all)
 *
 * Scope — deliberately thin per spec §8 ("no celebration overkill"):
 *   - No confetti, no gamification.
 *   - No machine / teacher / fabricator names (Phase 6 enriches when
 *     the teacher queue lands with its own context).
 *   - No live status polling — students don't need to watch this page
 *     spin. If they return later, they'll see whatever the job is NOW.
 *
 * Fetches the job status once via the thin /status endpoint (no
 * ?include=results — we only need jobStatus + currentRevision here).
 */

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | {
      kind: "ready";
      jobStatus: string;
      currentRevision: number;
    };

export default function FabricationSubmittedPage() {
  const params = useParams<{ jobId: string }>();
  const jobId = params?.jobId;

  const [state, setState] = React.useState<LoadState>({ kind: "loading" });

  React.useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/student/fabrication/jobs/${jobId}/status`,
          { credentials: "same-origin" }
        );
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: "" }));
          setState({
            kind: "error",
            message: body.error || `Couldn't load submission status (HTTP ${res.status})`,
          });
          return;
        }
        const data = await res.json();
        setState({
          kind: "ready",
          jobStatus: data.jobStatus,
          currentRevision: data.currentRevision,
        });
      } catch (e) {
        if (cancelled) return;
        setState({
          kind: "error",
          message: e instanceof Error ? e.message : "Network error",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      {!jobId && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-900">
            Missing job id — this page needs a valid URL.
          </p>
        </div>
      )}

      {jobId && state.kind === "loading" && (
        <div className="flex items-center gap-3 py-12 justify-center">
          <div className="w-5 h-5 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-600">Loading…</span>
        </div>
      )}

      {jobId && state.kind === "error" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-900">{state.message}</p>
          <Link
            href={`/fabrication/jobs/${jobId}`}
            className="inline-block mt-2 text-sm font-semibold text-red-900 underline"
          >
            Back to scan results →
          </Link>
        </div>
      )}

      {jobId && state.kind === "ready" && (
        <SubmittedCard jobStatus={state.jobStatus} />
      )}
    </main>
  );
}

interface SubmittedMessage {
  heading: string;
  body: string;
  icon: string;
}

function messageForStatus(status: string): SubmittedMessage {
  switch (status) {
    case "pending_approval":
      return {
        heading: "Submitted — waiting for your teacher to review",
        body: "Your teacher will see this in their fabrication queue. Once approved, the lab tech can queue the file on the machine.",
        icon: "📨",
      };
    case "approved":
      return {
        heading: "Submitted — ready for the lab tech to queue",
        body: "Your file has been approved and is in the lab tech's pickup queue. You'll get an email when it's printed / cut.",
        icon: "✅",
      };
    case "needs_revision":
      return {
        heading: "Your teacher sent this back for revision",
        body: "Open the scan results page to see what needs fixing, then re-upload a new version.",
        icon: "🔁",
      };
    case "picked_up":
      return {
        heading: "Your file is being fabricated",
        body: "The lab tech has picked up your submission. Check back later for the completion update.",
        icon: "🛠️",
      };
    case "completed":
      return {
        heading: "Fabrication complete",
        body: "Your file has been printed / cut. Pick it up from the fabrication area.",
        icon: "🎉",
      };
    default:
      return {
        heading: "Submission recorded",
        body: `Your submission is in status '${status}'. Return to your scan results for details.`,
        icon: "📋",
      };
  }
}

function SubmittedCard({ jobStatus }: { jobStatus: string }) {
  const msg = messageForStatus(jobStatus);
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
        <div aria-hidden="true" className="text-5xl mb-4">
          {msg.icon}
        </div>
        <h1 className="text-3xl font-bold text-gray-900">{msg.heading}</h1>
        <p className="text-base text-gray-600 mt-3 max-w-xl mx-auto">
          {msg.body}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/fabrication"
          className="flex-1 py-2.5 rounded-xl border border-gray-300 bg-white text-sm font-semibold text-center text-gray-800 hover:bg-gray-50"
        >
          All my submissions
        </Link>
        <Link
          href="/fabrication/new"
          className="flex-1 py-2.5 rounded-xl bg-brand-purple text-white text-sm font-semibold text-center hover:opacity-90"
        >
          Submit another file
        </Link>
      </div>
    </div>
  );
}
