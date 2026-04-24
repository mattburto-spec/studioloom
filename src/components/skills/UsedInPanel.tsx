"use client";

/**
 * UsedInPanel — teacher-facing widget for pinning a skill card to
 * "subjects" where students will see it at the moment of need.
 *
 * v1 supports subject_type='unit_page' (pin to a lesson page). Once
 * a pin exists, the matching unit page renders a "Skills for this
 * lesson" panel at the top with this card listed.
 *
 * UI shape:
 *   - "Used in" header with the pin count
 *   - List of existing pins (unit · page · gate level · remove button)
 *   - "+ Pin to a lesson" flow: search box → results → tap to pin
 *
 * Picker uses /api/teacher/skills/unit-page-search?q=<text> which scans
 * the teacher's authored units + extracts pages from content_data.
 */

import { useCallback, useEffect, useState } from "react";

interface RefRow {
  id: string;
  subject_type: string;
  subject_id: string;
  subject_label: string | null;
  gate_level: string;
  display_order: number;
  created_at: string;
  created_by_teacher_id: string | null;
}

interface PageSearchResult {
  unit_id: string;
  unit_title: string;
  page_id: string;
  page_title: string;
}

interface Props {
  cardId: string;
}

const SUBJECT_TYPE_LABELS: Record<string, string> = {
  unit_page: "Lesson",
  activity_block: "Activity block",
  unit: "Unit",
  class_gallery_pin: "Crit-board pin",
  safety_badge: "Safety badge",
};

export function UsedInPanel({ cardId }: Props) {
  const [refs, setRefs] = useState<RefRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PageSearchResult[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [pinBusy, setPinBusy] = useState<string | null>(null);
  const [removeBusy, setRemoveBusy] = useState<string | null>(null);

  const loadRefs = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/teacher/skills/cards/${cardId}/refs`,
        { credentials: "include" }
      );
      if (!res.ok) {
        setLoadError("Failed to load refs.");
        setRefs([]);
        return;
      }
      const json = await res.json();
      setRefs(json.refs ?? []);
      setLoadError(null);
    } catch {
      setLoadError("Network error.");
      setRefs([]);
    }
  }, [cardId]);

  useEffect(() => {
    loadRefs();
  }, [loadRefs]);

  // Debounced search as the teacher types
  useEffect(() => {
    if (!showPicker) return;
    const timer = window.setTimeout(async () => {
      setSearchBusy(true);
      try {
        const qs = searchQuery.trim() ? `?q=${encodeURIComponent(searchQuery)}` : "";
        const res = await fetch(
          `/api/teacher/skills/unit-page-search${qs}`,
          { credentials: "include" }
        );
        if (!res.ok) {
          setSearchResults([]);
          return;
        }
        const json = await res.json();
        setSearchResults(json.pages ?? []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchBusy(false);
      }
    }, 200);
    return () => window.clearTimeout(timer);
  }, [showPicker, searchQuery]);

  async function pin(result: PageSearchResult) {
    setPinBusy(result.page_id);
    try {
      const res = await fetch(
        `/api/teacher/skills/cards/${cardId}/refs`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject_type: "unit_page",
            subject_id: result.page_id,
            subject_label: `${result.unit_title} · ${result.page_title}`,
          }),
        }
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(json.error ?? "Failed to pin card.");
        return;
      }
      await loadRefs();
      setShowPicker(false);
      setSearchQuery("");
    } finally {
      setPinBusy(null);
    }
  }

  async function remove(refId: string) {
    if (!confirm("Remove this pin? Students on that lesson will no longer see this card.")) {
      return;
    }
    setRemoveBusy(refId);
    try {
      const res = await fetch(
        `/api/teacher/skills/cards/${cardId}/refs?ref_id=${encodeURIComponent(refId)}`,
        { method: "DELETE", credentials: "include" }
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(json.error ?? "Failed to remove pin.");
        return;
      }
      await loadRefs();
    } finally {
      setRemoveBusy(null);
    }
  }

  if (refs === null) {
    return (
      <section className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Used in</h2>
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-gray-100 rounded w-1/3" />
          <div className="h-8 bg-gray-100 rounded" />
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-6">
      <header className="flex items-start justify-between gap-3 mb-1">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Used in</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Pin this card to a lesson so students see it in the &ldquo;Skills
            for this lesson&rdquo; panel at the top of that page. Pull-moment,
            not push.
          </p>
        </div>
        {refs.length > 0 && (
          <div className="text-sm text-gray-500 text-right flex-shrink-0">
            <div className="font-semibold text-gray-900">{refs.length}</div>
            <div className="text-xs">pin{refs.length === 1 ? "" : "s"}</div>
          </div>
        )}
      </header>

      {loadError && (
        <div className="mt-3 bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700">
          {loadError}
        </div>
      )}

      {refs.length > 0 && (
        <ul className="mt-4 space-y-2">
          {refs.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 p-3 bg-gray-50 border border-gray-100 rounded-xl"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {r.subject_label ?? r.subject_id}
                </div>
                <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-white border border-gray-200 font-medium">
                    {SUBJECT_TYPE_LABELS[r.subject_type] ?? r.subject_type}
                  </span>
                  {r.gate_level !== "suggested" && (
                    <span className="text-indigo-600 font-medium">
                      gate: {r.gate_level}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => remove(r.id)}
                disabled={removeBusy === r.id}
                className="text-sm text-rose-600 hover:text-rose-700 px-2 py-1 rounded disabled:opacity-40 flex-shrink-0"
              >
                {removeBusy === r.id ? "…" : "Remove"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {!showPicker ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => {
              setShowPicker(true);
              setSearchQuery("");
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
          >
            + Pin to a lesson
          </button>
        </div>
      ) : (
        <div className="mt-4 p-4 bg-indigo-50 border border-indigo-100 rounded-xl space-y-3">
          <div className="flex items-center justify-between gap-2">
            <label className="text-sm font-medium text-indigo-900">
              Search lessons
            </label>
            <button
              type="button"
              onClick={() => setShowPicker(false)}
              className="text-xs text-indigo-600 hover:text-indigo-700"
            >
              Cancel
            </button>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search your units + lessons by title…"
            autoFocus
            className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white"
          />

          {searchBusy && searchResults.length === 0 && (
            <div className="text-sm text-indigo-700 italic">Searching…</div>
          )}
          {!searchBusy && searchResults.length === 0 && (
            <div className="text-sm text-indigo-700/80 italic">
              No matching lessons. Try a broader search, or check that you own
              the unit (v1 scopes to units you authored).
            </div>
          )}
          {searchResults.length > 0 && (
            <ul className="bg-white border border-indigo-200 rounded-lg max-h-60 overflow-auto divide-y divide-gray-100">
              {searchResults.map((r) => {
                const alreadyPinned = refs.some(
                  (x) =>
                    x.subject_type === "unit_page" &&
                    x.subject_id === r.page_id
                );
                return (
                  <li key={`${r.unit_id}:${r.page_id}`}>
                    <button
                      type="button"
                      disabled={alreadyPinned || pinBusy === r.page_id}
                      onClick={() => pin(r)}
                      className="w-full text-left px-3 py-2 hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="text-sm font-medium text-gray-900">
                        {r.page_title}
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                        <span>{r.unit_title}</span>
                        {alreadyPinned && (
                          <span className="text-emerald-600 font-medium">
                            Already pinned
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
