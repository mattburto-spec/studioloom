"use client";

/**
 * SchoolPicker — typeahead + add-your-own fallback.
 *
 * Used in:
 *   - /teacher/welcome step 1 (first-login wizard)
 *   - /teacher/settings → Account → School row
 *
 * Contract:
 *   - Controlled by parent via `value` + `onChange`
 *   - `value = null` shows the search input; `value = School` shows a
 *     selected chip with a "Change" button that nulls the value
 *   - Debounced 200ms search against /api/schools/search (min 2 chars)
 *   - "Add your school" fallback POSTs to /api/schools, then auto-selects
 *     the freshly-created row
 *
 * The parent is responsible for persisting the selected school via
 * PATCH /api/teacher/school or by including `schoolId` in its own
 * submit payload.
 */

import { useState, useEffect, useRef } from "react";

export interface PickerSchool {
  id: string;
  name: string;
  city: string | null;
  country: string;
  ib_programmes: string[];
  verified: boolean;
  source: "ibo" | "cis" | "ecis" | "user_submitted" | "imported";
}

interface SchoolPickerProps {
  value: PickerSchool | null;
  onChange: (school: PickerSchool | null) => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** Optional ISO-2 country code to scope search results. */
  countryHint?: string;
  /** Inline form (compact) vs stacked (default) layout. */
  variant?: "default" | "compact";
}

export function SchoolPicker({
  value,
  onChange,
  placeholder = "Start typing your school's name...",
  autoFocus = false,
  countryHint,
  variant = "default",
}: SchoolPickerProps) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PickerSchool[]>([]);
  const [loading, setLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState("");
  const [addCity, setAddCity] = useState("");
  const [addCountry, setAddCountry] = useState(countryHint?.toUpperCase() || "");
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Debounced typeahead
  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    const handle = setTimeout(() => {
      if (abortRef.current) abortRef.current.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);

      const params = new URLSearchParams({ q: trimmed });
      if (countryHint) params.set("country", countryHint);

      fetch(`/api/schools/search?${params.toString()}`, { signal: ctrl.signal })
        .then(async (res) => {
          if (!res.ok) throw new Error(`Search failed (${res.status})`);
          return res.json();
        })
        .then((data) => {
          setResults(Array.isArray(data.schools) ? data.schools : []);
        })
        .catch((err) => {
          if ((err as Error).name !== "AbortError") {
            console.error("[SchoolPicker] search error:", err);
            setResults([]);
          }
        })
        .finally(() => {
          if (!ctrl.signal.aborted) setLoading(false);
        });
    }, 200);

    return () => clearTimeout(handle);
  }, [q, countryHint]);

  async function handleAddSubmit() {
    setAddError(null);
    const trimmedName = addName.trim();
    const trimmedCountry = addCountry.trim();

    if (trimmedName.length < 3) {
      setAddError("School name must be at least 3 characters");
      return;
    }
    if (trimmedCountry.length === 0) {
      setAddError("Country is required (ISO-2 code or full name)");
      return;
    }

    setAdding(true);
    try {
      // Phase 4.4d — timezone smart-default per master spec §3.8 Q10.
      // Read browser timezone from Intl.DateTimeFormat; the API accepts
      // IANA strings and falls back to schema default (Asia/Shanghai)
      // if absent. Teacher invisible at create-time; editable later via
      // /school/[id]/settings page.
      const detectedTimezone =
        typeof Intl !== "undefined" &&
        typeof Intl.DateTimeFormat === "function"
          ? Intl.DateTimeFormat().resolvedOptions().timeZone
          : null;

      const res = await fetch("/api/schools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          city: addCity.trim() || null,
          country: trimmedCountry,
          ...(detectedTimezone ? { timezone: detectedTimezone } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error || `Add failed (HTTP ${res.status})`);
        return;
      }
      onChange(data.school);
      // Reset form state so next "change" starts fresh
      setShowAddForm(false);
      setQ("");
      setAddName("");
      setAddCity("");
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Network error");
    } finally {
      setAdding(false);
    }
  }

  // --- Render: selected chip ---
  if (value) {
    return (
      <div
        className={`flex items-center justify-between ${
          variant === "compact" ? "px-3 py-2" : "p-3"
        } bg-purple-50 border border-purple-200 rounded-xl`}
      >
        <div className="min-w-0">
          <div className="text-sm font-semibold text-gray-900 truncate">{value.name}</div>
          <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
            <span>{[value.city, value.country].filter(Boolean).join(" · ")}</span>
            {value.ib_programmes.length > 0 && (
              <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded font-medium">
                IB {value.ib_programmes.join("/")}
              </span>
            )}
            {!value.verified && (
              <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
                user-added
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="ml-3 text-xs text-gray-500 hover:text-gray-700 underline shrink-0"
        >
          Change
        </button>
      </div>
    );
  }

  // --- Render: add-your-own form ---
  if (showAddForm) {
    return (
      <div className="p-4 bg-white border-2 border-purple-300 rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">Add your school</h3>
          <button
            type="button"
            onClick={() => {
              setShowAddForm(false);
              setAddError(null);
              setAddName("");
              setAddCity("");
            }}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Cancel
          </button>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">
            School name
          </label>
          <input
            type="text"
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 text-sm"
            autoFocus
            maxLength={200}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">
              City
            </label>
            <input
              type="text"
              value={addCity}
              onChange={(e) => setAddCity(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 text-sm"
              maxLength={100}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">
              Country (ISO-2)
            </label>
            <input
              type="text"
              value={addCountry}
              onChange={(e) => setAddCountry(e.target.value.toUpperCase())}
              maxLength={2}
              placeholder="CN"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 text-sm uppercase"
            />
          </div>
        </div>
        {addError && <div className="text-xs text-red-600">{addError}</div>}
        <button
          type="button"
          onClick={handleAddSubmit}
          disabled={adding}
          className="w-full py-2 text-sm font-bold text-white rounded-lg transition-all disabled:opacity-50"
          style={{
            background: "linear-gradient(135deg, #7B2FF2, #5C16C5)",
            boxShadow: adding ? undefined : "0 2px 8px rgba(123, 47, 242, 0.25)",
          }}
        >
          {adding ? "Adding…" : "Add school"}
        </button>
        <p className="text-[11px] text-gray-400 leading-snug">
          We&apos;ll review your submission. In the meantime you can keep using
          the app — the school shows up in your profile immediately.
        </p>
      </div>
    );
  }

  // --- Render: search input + dropdown ---
  return (
    <div className="relative">
      <input
        type="text"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setDropdownOpen(true);
        }}
        onFocus={() => setDropdownOpen(true)}
        onBlur={() => {
          // Delay close so clicks on the dropdown register first
          setTimeout(() => setDropdownOpen(false), 150);
        }}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition-all text-sm"
      />

      {dropdownOpen && q.trim().length >= 2 && (
        <div className="absolute top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-80 overflow-y-auto z-20">
          {loading && (
            <div className="px-4 py-3 text-xs text-gray-500">Searching…</div>
          )}

          {!loading && results.length === 0 && (
            <div className="px-4 py-3 text-xs text-gray-500">
              No schools matched.{" "}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setShowAddForm(true);
                  setDropdownOpen(false);
                  setAddName(q);
                }}
                className="text-purple-600 hover:text-purple-800 font-semibold underline"
              >
                Add it
              </button>
            </div>
          )}

          {results.map((s) => (
            <button
              key={s.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(s);
                setDropdownOpen(false);
                setQ("");
              }}
              className="w-full text-left px-4 py-2.5 hover:bg-purple-50 transition-colors border-b border-gray-100 last:border-b-0"
            >
              <div className="text-sm font-medium text-gray-900">{s.name}</div>
              <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mt-0.5 flex-wrap">
                <span>{[s.city, s.country].filter(Boolean).join(" · ")}</span>
                {s.ib_programmes.length > 0 && (
                  <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded font-medium">
                    IB {s.ib_programmes.join("/")}
                  </span>
                )}
                {!s.verified && (
                  <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
                    user-added
                  </span>
                )}
              </div>
            </button>
          ))}

          {!loading && results.length > 0 && (
            <div className="px-4 py-2 text-[11px] text-gray-400 border-t border-gray-100 bg-gray-50">
              Don&apos;t see your school?{" "}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setShowAddForm(true);
                  setDropdownOpen(false);
                  setAddName(q);
                }}
                className="text-purple-600 hover:text-purple-800 font-semibold underline"
              >
                Add it
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
