"use client";

/**
 * AISuggestBox — reusable inline AI-assist widget for the skill card form.
 *
 * Pattern (Path A from the 24 Apr 2026 form-complexity feedback):
 *   teacher clicks ✨ Suggest → POST to a /api/teacher/skills/ai/* endpoint
 *   → render returned suggestions as clickable chips → teacher picks one
 *   (single-mode) or adds one or more (multi-mode) into form state.
 *
 * Used by the demo / outcomes / anchors fields. Quiz generation has its
 * own dedicated UI in QuizSection (different shape + needs count + mix).
 */

import { useState } from "react";

export type SuggestionRenderer<T> = (
  s: T,
  i: number,
  onPick: (s: T) => void
) => React.ReactNode;

interface Props<T> {
  /** Endpoint URL — POSTs `{ draft }` JSON, expects `{ suggestions | anchors }`
   *  back on success. */
  endpoint: string;
  /** The card draft to send as context. Re-evaluated on every click so we
   *  always send the freshest form state. */
  buildDraft: () => Record<string, unknown>;
  /** Key in the JSON response that holds the suggestion array. */
  responseKey: "suggestions" | "anchors";
  /** "single" = clicking a suggestion replaces the field's value (demo).
   *  "multi"  = clicking a suggestion appends to the field's list and
   *             removes it from the chip set (outcomes / anchors). */
  mode: "single" | "multi";
  /** Render one suggestion as a chip. Receives the value, the index in
   *  the local list, and an onPick callback to wire into the chip. */
  renderSuggestion: SuggestionRenderer<T>;
  /** Called when the teacher picks a suggestion. */
  onPick: (s: T) => void;
  /** Optional client-side validation that the draft has enough info to
   *  produce useful suggestions (e.g. body must not be empty for quiz).
   *  Return null to allow, return a string to show an inline warning. */
  precheck?: (draft: Record<string, unknown>) => string | null;
  /** Button label override. Defaults to "✨ Suggest with AI". */
  buttonLabel?: string;
  /** Help text shown under the button. */
  hint?: string;
}

export function AISuggestBox<T>({
  endpoint,
  buildDraft,
  responseKey,
  mode,
  renderSuggestion,
  onPick,
  precheck,
  buttonLabel = "✨ Suggest with AI",
  hint,
}: Props<T>) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<T[] | null>(null);

  async function fetchSuggestions() {
    setError(null);
    const draft = buildDraft();
    if (precheck) {
      const warn = precheck(draft);
      if (warn) {
        setError(warn);
        return;
      }
    }
    setLoading(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`AI assist failed (${res.status}): ${txt || res.statusText}`);
      }
      const json = await res.json();
      const list = (json?.[responseKey] ?? []) as T[];
      if (!Array.isArray(list) || list.length === 0) {
        setError("AI returned no suggestions. Try filling more of the card first (title, summary, body).");
        setSuggestions(null);
      } else {
        setSuggestions(list);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function handlePick(s: T) {
    onPick(s);
    if (mode === "single") {
      // Single-mode: clicking a suggestion fills the field and we close
      // the box so the chip set doesn't keep tempting the teacher.
      setSuggestions(null);
    } else {
      // Multi-mode: remove the picked one from the chip set so we don't
      // double-add. Keep remaining chips visible for further picks.
      setSuggestions((prev) => (prev ? prev.filter((x) => x !== s) : prev));
    }
  }

  return (
    <div className="ai-suggest-box mt-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={fetchSuggestions}
          disabled={loading}
          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 disabled:opacity-50"
        >
          {loading ? "Generating…" : buttonLabel}
        </button>
        {hint && <span className="text-xs text-gray-500">{hint}</span>}
      </div>

      {error && (
        <p className="text-xs text-rose-600 mt-1">⚠ {error}</p>
      )}

      {suggestions && suggestions.length > 0 && (
        <div className="ai-suggest-chips mt-2 p-3 bg-indigo-50/40 border border-indigo-100 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] uppercase tracking-wide text-indigo-700 font-medium">
              {mode === "single" ? "Pick one to use" : "Click to add"}
            </span>
            <button
              type="button"
              onClick={() => setSuggestions(null)}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              ✕ Close
            </button>
          </div>
          <ul className="space-y-1.5">
            {suggestions.map((s, i) => (
              <li key={i}>{renderSuggestion(s, i, handlePick)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
