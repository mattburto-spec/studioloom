"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { I } from "../teacher-dashboard-v2/icons";
import type { SearchHit, SearchResponse } from "@/types/search";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  /** API endpoint to GET ?q=<query> from. Defaults to teacher search. */
  searchUrl?: string;
}

type FlatHit = SearchHit & { groupLabel: string };

const EMPTY: SearchResponse = { query: "", classes: [], units: [], students: [] };

export function CommandPalette({
  open,
  onClose,
  searchUrl = "/api/teacher/search",
}: CommandPaletteProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  // Reset state when the palette opens.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setResults(EMPTY);
    setActiveIdx(0);
    // Defer focus until after the modal mounts.
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  // Esc to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Debounced fetch.
  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ac = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(`${searchUrl}?q=${encodeURIComponent(trimmed)}`, {
          signal: ac.signal,
          credentials: "same-origin",
        });
        if (!res.ok) {
          setResults({ ...EMPTY, query: trimmed });
          return;
        }
        const data = (await res.json()) as SearchResponse;
        setResults(data);
        setActiveIdx(0);
      } catch (err) {
        if ((err as { name?: string }).name !== "AbortError") {
          setResults({ ...EMPTY, query: trimmed });
        }
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      ac.abort();
      window.clearTimeout(t);
    };
  }, [query, open, searchUrl]);

  // Flat list for keyboard nav, with group labels for rendering.
  const flat = useMemo<FlatHit[]>(() => {
    const out: FlatHit[] = [];
    for (const c of results.classes) out.push({ ...c, groupLabel: "Classes" });
    for (const u of results.units) out.push({ ...u, groupLabel: "Units" });
    for (const s of results.students) out.push({ ...s, groupLabel: "Students" });
    return out;
  }, [results]);

  // Clamp active index whenever the list shrinks.
  useEffect(() => {
    if (activeIdx >= flat.length) setActiveIdx(Math.max(0, flat.length - 1));
  }, [flat.length, activeIdx]);

  const go = (hit: FlatHit) => {
    onClose();
    router.push(hit.href);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, Math.max(0, flat.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = flat[activeIdx];
      if (hit) go(hit);
    }
  };

  if (!open) return null;

  const trimmed = query.trim();
  const showEmptyState = trimmed.length >= 2 && !loading && flat.length === 0;
  const showHint = trimmed.length < 2;

  // Build grouped index ranges so each row knows its position in `flat` for activeIdx.
  let runningIdx = 0;
  const groups: Array<{ label: string; items: Array<{ hit: SearchHit; flatIdx: number }> }> = [];
  for (const [label, items] of [
    ["Classes", results.classes] as const,
    ["Units", results.units] as const,
    ["Students", results.students] as const,
  ]) {
    if (items.length === 0) continue;
    groups.push({
      label,
      items: items.map((hit) => ({ hit, flatIdx: runningIdx++ })),
    });
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Search"
    >
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-xl bg-white rounded-2xl card-shadow-lg border border-[var(--hair)] overflow-hidden">
        <div className="flex items-center gap-3 px-4 h-14 border-b border-[var(--hair)]">
          <span className="text-[var(--ink-3)]">
            <I name="search" size={16} />
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search classes, units, students…"
            className="flex-1 bg-transparent outline-none text-[14px] placeholder:text-[var(--ink-3)]"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden sm:inline-block text-[10.5px] font-bold text-[var(--ink-3)] border border-[var(--hair)] rounded px-1.5 py-0.5">
            Esc
          </kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-1.5">
          {showHint && (
            <div className="px-4 py-6 text-center text-[12.5px] text-[var(--ink-3)]">
              Type at least 2 characters to search.
            </div>
          )}
          {loading && trimmed.length >= 2 && (
            <div className="px-4 py-6 text-center text-[12.5px] text-[var(--ink-3)]">
              Searching…
            </div>
          )}
          {showEmptyState && (
            <div className="px-4 py-6 text-center text-[12.5px] text-[var(--ink-3)]">
              No matches for &ldquo;{trimmed}&rdquo;.
            </div>
          )}
          {!loading &&
            groups.map((group) => (
              <div key={group.label} className="mb-1.5 last:mb-0">
                <div className="px-3 pt-2 pb-1 text-[10.5px] font-extrabold uppercase tracking-wider text-[var(--ink-3)]">
                  {group.label}
                </div>
                {group.items.map(({ hit, flatIdx }) => {
                  const active = flatIdx === activeIdx;
                  return (
                    <button
                      key={`${hit.type}-${hit.id}`}
                      onMouseEnter={() => setActiveIdx(flatIdx)}
                      onClick={() => go({ ...hit, groupLabel: group.label })}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition ${
                        active ? "bg-[var(--bg)]" : "hover:bg-[var(--bg)]"
                      }`}
                    >
                      <TypeBadge type={hit.type} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-bold truncate">{hit.title}</div>
                        {hit.subtitle && (
                          <div className="text-[11.5px] text-[var(--ink-3)] truncate">
                            {hit.subtitle}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
        </div>

        <div className="flex items-center justify-between gap-2 px-4 h-9 border-t border-[var(--hair)] text-[10.5px] text-[var(--ink-3)]">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="font-bold">↑ ↓</kbd> Navigate
            </span>
            <span>
              <kbd className="font-bold">↵</kbd> Open
            </span>
          </div>
          <div>
            <kbd className="font-bold">⌘K</kbd> to toggle
          </div>
        </div>
      </div>
    </div>
  );
}

function TypeBadge({ type }: { type: SearchHit["type"] }) {
  const label = type === "class" ? "Class" : type === "unit" ? "Unit" : "Student";
  const tone =
    type === "class"
      ? "bg-[#0EA5E9]/10 text-[#0369A1]"
      : type === "unit"
      ? "bg-[#9333EA]/10 text-[#6B21A8]"
      : "bg-[#E86F2C]/10 text-[#9A3D08]";
  return (
    <span
      className={`shrink-0 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${tone}`}
    >
      {label}
    </span>
  );
}
