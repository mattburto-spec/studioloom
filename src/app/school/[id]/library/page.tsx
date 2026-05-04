"use client";

/**
 * /school/[id]/library — Phase 4.6 school library browse.
 *
 * Lists published units in the school. Each unit card has a "Request to use"
 * button (unless the viewer is the author). Click → opens compose drawer →
 * POSTs to /api/school/[id]/library/[unitId]/request-use → outbox status
 * surfaces in /teacher/notifications/use-requests.
 *
 * Implicit tier-awareness: free/pro teachers in personal schools see only
 * their own units (alone in school); school-tier teachers see colleagues'.
 */

import { useState, useEffect, useCallback } from "react";
import { use } from "react";
import Link from "next/link";

interface LibraryUnit {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  grade_level: string | null;
  duration_weeks: number | null;
  topic: string | null;
  global_context: string | null;
  key_concept: string | null;
  author_teacher_id: string;
  author_name: string | null;
  school_name: string | null;
  tags: string[] | null;
  forked_from: string | null;
  forked_from_author_id: string | null;
  fork_count: number | null;
  created_at: string;
}

export default function SchoolLibraryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: schoolId } = use(params);

  const [units, setUnits] = useState<LibraryUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [requesting, setRequesting] = useState<string | null>(null);
  const [requestSent, setRequestSent] = useState<Set<string>>(new Set());
  const [composeUnitId, setComposeUnitId] = useState<string | null>(null);
  const [composeMessage, setComposeMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    const params = search ? `?q=${encodeURIComponent(search)}` : "";
    fetch(`/api/school/${schoolId}/library${params}`)
      .then((r) => {
        if (r.status === 403) throw new Error("Not a member of this school");
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: { units: LibraryUnit[] }) => setUnits(data.units ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [schoolId, search]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Fetch own user id once (used to suppress "Request to use" on own units).
  useEffect(() => {
    fetch("/api/teacher/whoami")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.id) setCurrentUserId(data.id);
      })
      .catch(() => {});
  }, []);

  const submitRequest = async () => {
    if (!composeUnitId) return;
    setRequesting(composeUnitId);
    try {
      const res = await fetch(
        `/api/school/${schoolId}/library/${composeUnitId}/request-use`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            intent_message: composeMessage.trim() || undefined,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message ?? data.error ?? `HTTP ${res.status}`);
      }
      setRequestSent(new Set(requestSent).add(composeUnitId));
      setComposeUnitId(null);
      setComposeMessage("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setRequesting(null);
    }
  };

  if (loading && units.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8">
        <p className="text-sm text-gray-500">Loading library…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          <strong>Error:</strong> {error}
        </div>
        <button
          onClick={() => {
            setError(null);
            refresh();
          }}
          className="mt-4 px-3 py-1.5 text-xs rounded-lg bg-white border border-gray-200 hover:bg-gray-50"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">School Library</h1>
        <p className="text-sm text-gray-500 mt-1">
          Units published by colleagues at your school. Click &ldquo;Request to
          use&rdquo; to ask the author for permission to fork into your own
          dashboard.
        </p>
      </div>

      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Search by title / description / topic…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
        />
      </div>

      {units.length === 0 ? (
        <div className="border border-gray-200 rounded-lg bg-gray-50 p-6 text-center text-sm text-gray-500">
          No published units in your school library yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {units.map((u) => {
            const isOwn = currentUserId && u.author_teacher_id === currentUserId;
            const alreadyRequested = requestSent.has(u.id);
            return (
              <div
                key={u.id}
                className="border border-gray-200 rounded-xl p-4 bg-white flex flex-col"
              >
                {u.thumbnail_url && (
                  <div
                    className="aspect-video rounded-lg bg-gray-100 mb-3 bg-cover bg-center"
                    style={{ backgroundImage: `url(${u.thumbnail_url})` }}
                  />
                )}
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-gray-900 line-clamp-2">
                    {u.title}
                  </h3>
                  {u.fork_count != null && u.fork_count > 0 && (
                    <span
                      className="text-xs text-gray-500"
                      title={`Forked ${u.fork_count} time${u.fork_count === 1 ? "" : "s"}`}
                    >
                      ⑂{u.fork_count}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  by {u.author_name ?? "Unknown"}
                  {u.grade_level && ` · ${u.grade_level}`}
                  {u.duration_weeks && ` · ${u.duration_weeks}w`}
                </p>
                {u.description && (
                  <p className="text-xs text-gray-700 mt-2 line-clamp-3">
                    {u.description}
                  </p>
                )}
                <div className="mt-auto pt-3 flex gap-2">
                  {isOwn ? (
                    <span className="text-xs text-gray-400">Your unit</span>
                  ) : alreadyRequested ? (
                    <span className="text-xs text-emerald-700">
                      ✓ Request sent
                    </span>
                  ) : (
                    <button
                      onClick={() => setComposeUnitId(u.id)}
                      disabled={requesting !== null}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
                    >
                      Request to use
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Compose drawer */}
      {composeUnitId && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-5 space-y-4">
            <h3 className="font-semibold text-gray-900">Request to use this unit</h3>
            <p className="text-sm text-gray-600">
              Add an optional message — what you plan to use it for, any
              adjustments you&apos;d like to make. The author will see this
              when deciding.
            </p>
            <textarea
              value={composeMessage}
              onChange={(e) => setComposeMessage(e.target.value)}
              placeholder="(optional) e.g. 'Planning to use this for my Year 8 design class next semester. Will adapt the timeline.'"
              maxLength={2000}
              rows={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setComposeUnitId(null);
                  setComposeMessage("");
                }}
                disabled={requesting !== null}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={submitRequest}
                disabled={requesting !== null}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {requesting ? "Sending…" : "Send request"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="text-center pt-6 border-t border-gray-100">
        <Link
          href="/teacher/notifications/use-requests"
          className="text-xs text-purple-700 hover:underline"
        >
          View your sent requests + inbox →
        </Link>
      </div>
    </div>
  );
}
