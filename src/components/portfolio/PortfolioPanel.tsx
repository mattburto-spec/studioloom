"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { timeAgo, getDomain } from "@/lib/utils";
import { looksLikeRichText } from "@/components/student/RichTextEditor";
import type { PortfolioEntry } from "@/types";

// Round 10 (6 May 2026) — ExportPortfolioPpt button removed per Matt
// (filed as FU-AGENCY-PPT-EXPORT-RESTORE). Dynamic import dropped to
// keep tsc clean; restore both the import and the button render below
// when the FU is picked up. ExportPortfolioPpt.tsx is untouched.

interface PortfolioPanelProps {
  unitId: string;
  open: boolean;
  onClose: () => void;
  onRequestCapture?: () => void;
  onOpenNarrative?: () => void;
  unitTitle?: string;
  studentName?: string;
}

export function PortfolioPanel({
  unitId,
  open,
  onClose,
  onRequestCapture,
  onOpenNarrative,
  unitTitle,
  studentName,
}: PortfolioPanelProps) {
  const [entries, setEntries] = useState<PortfolioEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/student/portfolio?unitId=${unitId}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries || []);
      }
    } catch {
      // fail silently
    } finally {
      setLoading(false);
    }
  }, [unitId]);

  useEffect(() => {
    if (open) loadEntries();
  }, [open, loadEntries]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  async function deleteEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    await fetch(`/api/student/portfolio?id=${id}`, { method: "DELETE" });
  }

  // Refresh entries (called after new capture)
  function refresh() {
    loadEntries();
    // Scroll to top after adding
    setTimeout(() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 200);
  }

  // Group entries by date
  const grouped = groupByDate(entries);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Slide-in panel from right */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-md bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full pointer-events-none"
        }`}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl gradient-cta flex items-center justify-center shadow-sm">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary">
                Portfolio
              </h2>
              <p className="text-xs text-text-secondary">
                {loading
                  ? "Loading..."
                  : `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!loading && onOpenNarrative && (
              <button
                onClick={onOpenNarrative}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary bg-surface-alt hover:bg-gray-200 rounded-lg transition"
                title="View design narrative"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                Narrative
              </button>
            )}
            {/* Round 10 (6 May 2026) — ExportPortfolioPpt removed per
                Matt: "remove the download as PPT in portfolio view".
                Filed as FU-AGENCY-PPT-EXPORT-RESTORE in
                docs/projects/co2-racers-followups.md for later
                consideration. ExportPortfolioPpt component + dynamic
                import + the dependency are left in place — easy to
                restore. */}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-surface-alt flex items-center justify-center text-text-secondary hover:text-text-primary transition"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable timeline */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-5 space-y-6">
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
                  <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                    <div className="h-24 bg-gray-100 rounded-lg animate-pulse" />
                    <div className="h-3 w-3/4 bg-gray-100 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-20 px-6">
              <div className="w-16 h-16 rounded-2xl bg-surface-alt flex items-center justify-center mx-auto mb-4">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-text-secondary/40"
                >
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
              </div>
              <p className="text-text-primary font-semibold mb-1">
                No entries yet
              </p>
              <p className="text-text-secondary/60 text-sm">
                Capture your work as you go — photos, notes, and links.
              </p>
              {onRequestCapture && (
                <button
                  onClick={onRequestCapture}
                  className="mt-5 px-5 py-2.5 gradient-cta text-white rounded-full text-sm font-medium shadow-md shadow-brand-pink/20 hover:opacity-90 transition"
                >
                  + Add first entry
                </button>
              )}
            </div>
          ) : (
            <div className="relative px-5 py-4">
              {/* Timeline line */}
              <div className="absolute left-[29px] top-8 bottom-4 w-px bg-border" />

              {grouped.map(({ dateLabel, items }) => (
                <div key={dateLabel} className="mb-6 last:mb-0">
                  {/* Date header */}
                  <div className="relative flex items-center gap-3 mb-3">
                    <div className="w-[10px] h-[10px] rounded-full bg-brand-purple ring-2 ring-white flex-shrink-0 z-10" />
                    <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                      {dateLabel}
                    </span>
                  </div>

                  {/* Entries for this date */}
                  <div className="ml-[22px] space-y-3">
                    {items.map((entry) => (
                      <TimelineEntry
                        key={entry.id}
                        entry={entry}
                        onDelete={() => deleteEntry(entry.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* + capture button on left edge */}
        {open && onRequestCapture && entries.length > 0 && (
          <button
            onClick={onRequestCapture}
            className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full gradient-cta text-white shadow-lg shadow-brand-pink/30 hover:opacity-90 transition-all flex items-center justify-center z-50"
            title="Add entry"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Timeline entry card                                                */
/* ------------------------------------------------------------------ */

function TimelineEntry({
  entry,
  onDelete,
}: {
  entry: PortfolioEntry;
  onDelete: () => void;
}) {
  const timeStr = new Date(entry.created_at).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="group relative bg-white rounded-xl border border-border/80 overflow-hidden hover:shadow-md transition-shadow duration-200">
      {/* Delete button */}
      <button
        onClick={onDelete}
        className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-white/90 backdrop-blur text-text-secondary/30 hover:text-red-400 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center z-10 shadow-sm"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
        </svg>
      </button>

      {/* Photo */}
      {entry.media_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={entry.media_url}
          alt=""
          className="w-full h-40 object-cover"
          loading="lazy"
        />
      )}

      <div className="p-3.5">
        {/* Note — round 15 (6 May 2026): when content is rich-text HTML
            (typed via RichTextEditor and sent via the new "Send to
            Portfolio" affordance), render it with dangerouslySetInnerHTML
            so <div>/<br>/<p>/etc. tags don't leak as raw text. The
            looksLikeRichText helper is the same conservative check the
            narrative uses; safe because the editor only emits the
            inline tag set listed there. */}
        {entry.content && (
          looksLikeRichText(entry.content) ? (
            <div
              className="text-sm text-text-primary leading-relaxed mb-2 rich-response"
              dangerouslySetInnerHTML={{ __html: entry.content }}
            />
          ) : (
            <p className="text-sm text-text-primary leading-relaxed mb-2 whitespace-pre-wrap">
              {entry.content}
            </p>
          )
        )}

        {/* Link */}
        {entry.link_url && (
          <a
            href={entry.link_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-accent-blue/5 hover:bg-accent-blue/10 transition border border-accent-blue/10 mb-2"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://www.google.com/s2/favicons?domain=${getDomain(entry.link_url)}&sz=16`}
              alt=""
              className="w-4 h-4 flex-shrink-0"
            />
            <span className="text-xs text-accent-blue truncate font-medium">
              {getDomain(entry.link_url)}
            </span>
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#2E86AB"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="flex-shrink-0 ml-auto opacity-40"
            >
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        )}

        {/* Legacy type badge */}
        {entry.type === "mistake" && (
          <span className="inline-block px-2 py-0.5 rounded-full bg-accent-orange/10 text-accent-orange text-[10px] font-medium mb-2">
            Learning moment
          </span>
        )}

        {/* Time */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-text-secondary/50">
            {timeStr}
          </span>
          <span className="text-[10px] text-text-secondary/30">
            {timeAgo(entry.created_at)}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Group entries by date                                               */
/* ------------------------------------------------------------------ */

function groupByDate(
  entries: PortfolioEntry[]
): Array<{ dateLabel: string; items: PortfolioEntry[] }> {
  const groups: Map<string, PortfolioEntry[]> = new Map();
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  for (const entry of entries) {
    const date = new Date(entry.created_at);
    let label: string;

    if (isSameDay(date, today)) {
      label = "Today";
    } else if (isSameDay(date, yesterday)) {
      label = "Yesterday";
    } else if (isThisWeek(date, today)) {
      label = date.toLocaleDateString("en-US", { weekday: "long" });
    } else {
      label = date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }

    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(entry);
  }

  return Array.from(groups.entries()).map(([dateLabel, items]) => ({
    dateLabel,
    items,
  }));
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isThisWeek(date: Date, today: Date): boolean {
  const diffMs = today.getTime() - date.getTime();
  return diffMs >= 0 && diffMs < 7 * 24 * 60 * 60 * 1000;
}
