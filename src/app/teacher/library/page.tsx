"use client";

import Link from "next/link";

/**
 * Teacher Library landing page.
 *
 * Placeholder for Phase 1.6 disconnect — replaces the old /teacher/knowledge
 * dashboard. Two cards link to the Dimensions3 review queue and unit import
 * flows. Will be iterated in a later phase.
 */
export default function LibraryLandingPage() {
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Library</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage your activity blocks and import existing unit plans.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/teacher/library/review"
          className="block bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md hover:border-purple-300 transition"
        >
          <h2 className="text-base font-semibold text-gray-900">Review Queue</h2>
          <p className="text-sm text-gray-500 mt-1">
            Upload documents, extract activity blocks, and approve them into
            your library.
          </p>
        </Link>

        <Link
          href="/teacher/library/import"
          className="block bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md hover:border-purple-300 transition"
        >
          <h2 className="text-base font-semibold text-gray-900">Import Unit</h2>
          <p className="text-sm text-gray-500 mt-1">
            Paste an existing unit plan and reconstruct it as a StudioLoom unit.
          </p>
        </Link>
      </div>
    </div>
  );
}
