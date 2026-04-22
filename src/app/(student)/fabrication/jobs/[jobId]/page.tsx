"use client";

/**
 * /fabrication/jobs/[jobId] — Preflight Phase 4-5 status page.
 * (File path uses the `(student)` route group — parens mean no URL
 * contribution. URL is `/fabrication/jobs/[jobId]`.)
 *
 * Destination for the Phase 4-4 router.push after an upload completes.
 * Polls the scan status every 2 s, shows staged messaging based on
 * elapsed time, lands on a success/error/timeout card as soon as the
 * scan settles.
 *
 * Uses useFabricationStatus — first extracted hook in the codebase.
 * Transitions are covered in the reducer tests; the hook itself is
 * exercised end-to-end at Checkpoint 4.1 via a real prod upload.
 */

import * as React from "react";
import { useParams } from "next/navigation";
import { useFabricationStatus } from "@/hooks/useFabricationStatus";
import { ScanProgressCard } from "@/components/fabrication/ScanProgressCard";

export default function FabricationJobStatusPage() {
  const params = useParams<{ jobId: string }>();
  const jobId = params?.jobId;
  const state = useFabricationStatus(jobId ?? "");

  return (
    <main className="max-w-2xl mx-auto px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">Checking your file</h1>
        <p className="text-sm text-gray-600 mt-1">
          We&apos;re running a quick machine-readiness check before your file
          goes to the lab tech.
        </p>
      </header>

      {jobId ? (
        <ScanProgressCard state={state} />
      ) : (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-900">
            Missing job id — this page needs a valid URL.
          </p>
        </div>
      )}
    </main>
  );
}
