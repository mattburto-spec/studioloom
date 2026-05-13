"use client";

// Class × Unit lesson scheduling — Tier 2 (13 May 2026).
//
// Focused page: list every lesson page in the unit + a date input per
// row. Save persists via PUT /api/teacher/classes/[classId]/lesson-
// schedule. Teaching Mode reads the schedule on load and auto-jumps to
// today's lesson (or closest).
//
// URL: /teacher/classes/[classId]/schedule/[unitId]

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getPageList } from "@/lib/unit-adapter";
import { resolveClassUnitContent } from "@/lib/units/resolve-content";
import type { UnitContentData, UnitPage } from "@/types";

interface ScheduleEntry {
  page_id: string;
  scheduled_date: string;
}

interface PageProps {
  params: Promise<{ classId: string; unitId: string }>;
}

export default function ClassUnitSchedulePage({ params }: PageProps) {
  const { classId, unitId } = use(params);

  const [pages, setPages] = useState<UnitPage[] | null>(null);
  const [unitTitle, setUnitTitle] = useState<string>("");
  const [className, setClassName] = useState<string>("");
  const [dates, setDates] = useState<Record<string, string>>({});
  const [originalDates, setOriginalDates] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const supabase = createClient();

        // Class + unit + class-unit override content (resolves the
        // class-local content the teacher actually teaches).
        const [classRes, unitRes, cuRes, schedRes] = await Promise.all([
          supabase.from("classes").select("name").eq("id", classId).maybeSingle(),
          supabase.from("units").select("title, content_data").eq("id", unitId).maybeSingle(),
          supabase
            .from("class_units")
            .select("content_data")
            .eq("class_id", classId)
            .eq("unit_id", unitId)
            .maybeSingle(),
          fetch(
            `/api/teacher/classes/${classId}/lesson-schedule?unitId=${unitId}`,
            { credentials: "same-origin", cache: "no-store" },
          ),
        ]);

        if (cancelled) return;

        if (!unitRes.data) {
          setError("Unit not found.");
          setLoading(false);
          return;
        }

        const masterContent = unitRes.data.content_data as UnitContentData;
        const overrideContent = (cuRes.data?.content_data as UnitContentData | undefined) ?? undefined;
        const resolved = resolveClassUnitContent(masterContent, overrideContent);
        const pageList = getPageList(resolved);

        setPages(pageList);
        setUnitTitle(unitRes.data.title);
        setClassName(classRes.data?.name ?? "");

        if (schedRes.ok) {
          const body = (await schedRes.json()) as { schedule: ScheduleEntry[] };
          const map: Record<string, string> = {};
          for (const entry of body.schedule) {
            map[entry.page_id] = entry.scheduled_date;
          }
          setDates(map);
          setOriginalDates(map);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Load failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [classId, unitId]);

  const dirty = useMemo(() => {
    // Compare against original keys + values.
    const allKeys = new Set([...Object.keys(dates), ...Object.keys(originalDates)]);
    for (const k of allKeys) {
      if ((dates[k] ?? "") !== (originalDates[k] ?? "")) return true;
    }
    return false;
  }, [dates, originalDates]);

  function updateDate(pageId: string, value: string) {
    setDates((prev) => {
      const next = { ...prev };
      if (value === "") delete next[pageId];
      else next[pageId] = value;
      return next;
    });
  }

  async function save() {
    if (!pages || saving) return;
    setSaving(true);
    setError(null);
    try {
      // Build entries: every page that changed since load.
      const allKeys = new Set([...Object.keys(dates), ...Object.keys(originalDates)]);
      const entries: Array<{ page_id: string; scheduled_date: string | null }> = [];
      for (const pageId of allKeys) {
        const current = dates[pageId] ?? null;
        const original = originalDates[pageId] ?? null;
        if (current !== original) {
          entries.push({ page_id: pageId, scheduled_date: current });
        }
      }
      if (entries.length === 0) {
        setSaving(false);
        return;
      }

      const res = await fetch(`/api/teacher/classes/${classId}/lesson-schedule`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ unitId, entries }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Save failed (${res.status})`);
      }
      const body = (await res.json()) as { schedule: ScheduleEntry[] };
      const map: Record<string, string> = {};
      for (const entry of body.schedule) {
        map[entry.page_id] = entry.scheduled_date;
      }
      setDates(map);
      setOriginalDates(map);
      setSavedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function fillForwardWeekly() {
    if (!pages || pages.length === 0) return;
    const firstWithDate = pages.find((p) => dates[p.id]);
    const startISO = firstWithDate
      ? dates[firstWithDate.id]
      : new Date().toISOString().slice(0, 10);
    const start = new Date(startISO);
    if (!Number.isFinite(start.getTime())) return;
    const startIdx = firstWithDate
      ? pages.findIndex((p) => p.id === firstWithDate.id)
      : 0;

    setDates((prev) => {
      const next = { ...prev };
      for (let i = startIdx; i < pages.length; i++) {
        const offsetDays = (i - startIdx) * 7;
        const d = new Date(start.getTime() + offsetDays * 86_400_000);
        next[pages[i].id] = d.toISOString().slice(0, 10);
      }
      return next;
    });
  }

  if (loading) {
    return (
      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="text-center text-sm text-zinc-500">Loading schedule…</div>
      </main>
    );
  }

  if (error || !pages) {
    return (
      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {error ?? "Couldn't load schedule."}
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <div className="mb-2 flex items-center gap-1.5 text-xs text-zinc-500">
        <Link
          href={`/teacher/classes/${classId}`}
          className="hover:text-zinc-900 transition"
        >
          {className || "Class"}
        </Link>
        <span>›</span>
        <span className="text-zinc-700 font-medium">{unitTitle}</span>
        <span>›</span>
        <span className="text-zinc-900 font-bold">Schedule</span>
      </div>

      <h1 className="text-2xl font-extrabold text-zinc-900 mb-1">Lesson schedule</h1>
      <p className="text-sm text-zinc-600 mb-6">
        Set the date you&apos;ll teach each lesson to <strong>{className}</strong>.
        Teaching Mode will auto-jump to today&apos;s lesson (or the closest)
        when you open it.
      </p>

      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={fillForwardWeekly}
          disabled={pages.length === 0}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          title="Fills every lesson from the first scheduled (or today) forward, one per week"
        >
          ⚡ Fill forward weekly
        </button>
        <span className="text-[11px] text-zinc-500">
          Quickly back-fill the rest of the term from your first date.
        </span>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
        <ul className="divide-y divide-zinc-100">
          {pages.map((page, idx) => {
            const dateValue = dates[page.id] ?? "";
            const changed =
              (dates[page.id] ?? "") !== (originalDates[page.id] ?? "");
            return (
              <li
                key={page.id}
                className="flex items-center gap-4 px-4 py-3 hover:bg-zinc-50/60"
              >
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-purple-100 text-[12px] font-bold text-purple-700">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-zinc-900 truncate">
                    {page.title || `Lesson ${idx + 1}`}
                  </div>
                  {page.content?.learningGoal && (
                    <div className="mt-0.5 text-[12px] text-zinc-500 truncate">
                      {page.content.learningGoal}
                    </div>
                  )}
                </div>
                <input
                  type="date"
                  value={dateValue}
                  onChange={(e) => updateDate(page.id, e.target.value)}
                  className={`rounded-lg border px-2 py-1 text-sm focus:outline-none focus:ring-2 ${
                    changed
                      ? "border-amber-400 bg-amber-50 focus:border-amber-500 focus:ring-amber-200"
                      : "border-zinc-300 focus:border-purple-500 focus:ring-purple-200"
                  }`}
                />
                {dateValue && (
                  <button
                    type="button"
                    onClick={() => updateDate(page.id, "")}
                    className="text-[11px] text-zinc-400 hover:text-rose-600"
                    title="Clear date"
                  >
                    ✕
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <div className="text-[12px] text-zinc-500">
          {savedAt && !dirty ? (
            <span className="text-emerald-700">
              ✓ Saved {savedAt.toLocaleTimeString()}
            </span>
          ) : dirty ? (
            <span className="text-amber-700">Unsaved changes</span>
          ) : (
            <span>No changes.</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/teacher/teach/${unitId}?classId=${classId}`}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            Back to Teaching Mode
          </Link>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="rounded-lg bg-purple-600 px-4 py-1.5 text-sm font-bold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save schedule"}
          </button>
        </div>
      </div>
    </main>
  );
}
