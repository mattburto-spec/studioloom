/**
 * /teacher/inbox — Teacher Marking Inbox (TFL.3 / Pass C)
 *
 * Sub-phase C.1: page shell + auto-draft trigger. Approve flow + tweak
 * buttons land in C.2 and C.4 respectively.
 *
 * Flow on mount:
 *   1. Fetch /api/teacher/inbox/items → render cards (placeholder
 *      C.1 layout; full visual in C.2).
 *   2. Group `no_draft` items by (class, unit, page, tile). For each
 *      group, POST to /api/teacher/grading/tile-grades/ai-prescore
 *      to populate ai_comment_draft. Existing route, no fork.
 *   3. Once auto-draft completes, refetch items so the freshly-drafted
 *      cards move from `no_draft` to `drafted`.
 *
 * Filter chips: class + lesson. Counts update on filter change.
 *
 * Empty state ("0 to review — nice work") and full polish land in C.5.
 */

"use client";

import * as React from "react";
import Link from "next/link";

interface InboxItem {
  itemKey: string;
  gradeId: string;
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  unitId: string;
  unitTitle: string;
  pageId: string;
  pageTitle: string;
  tileId: string;
  tilePrompt: string;
  criterionLabel: string;
  state: "reply_waiting" | "drafted" | "no_draft";
  studentResponse: string | null;
  aiScore: number | null;
  aiCommentDraft: string | null;
  aiReasoning: string | null;
  aiQuote: string | null;
  aiConfidence: number | null;
  latestStudentReply: {
    sentiment: "got_it" | "not_sure" | "pushback";
    text: string;
    sentAt: string;
  } | null;
  latestTeacherTurnBody: string | null;
  submittedAt: string | null;
  lastActivityAt: string;
}

export default function TeacherInboxPage() {
  const [items, setItems] = React.useState<InboxItem[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [warmingDrafts, setWarmingDrafts] = React.useState(false);
  const [classFilter, setClassFilter] = React.useState<string | null>(null);
  const [lessonFilter, setLessonFilter] = React.useState<string | null>(null);

  // ─── Fetch inbox ───
  const refetch = React.useCallback(async () => {
    try {
      const res = await fetch("/api/teacher/inbox/items", { cache: "no-store" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setLoadError(
          (json as { error?: string }).error ??
            `Failed to load inbox (${res.status})`,
        );
        setItems([]);
        return;
      }
      const json = (await res.json()) as { items: InboxItem[] };
      setItems(json.items ?? []);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Inbox load failed");
      setItems([]);
    }
  }, []);

  React.useEffect(() => {
    void refetch();
  }, [refetch]);

  // ─── Auto-draft warm-up for no_draft items ───
  // Group by (class, unit, page, tile). One POST per group fires the
  // existing batch ai-prescore route, drafts land in ai_comment_draft.
  // After all groups resolve, refetch the inbox so cards re-categorize.
  React.useEffect(() => {
    if (!items || items.length === 0) return;
    const noDraftItems = items.filter((i) => i.state === "no_draft");
    if (noDraftItems.length === 0) return;
    if (warmingDrafts) return; // already in flight

    setWarmingDrafts(true);
    void (async () => {
      try {
        const groups = new Map<string, InboxItem[]>();
        for (const i of noDraftItems) {
          const key = `${i.classId}::${i.unitId}::${i.pageId}::${i.tileId}`;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(i);
        }
        // Cap concurrency at 4 to avoid overwhelming the route.
        const groupEntries = Array.from(groups.values());
        const CHUNK = 4;
        for (let i = 0; i < groupEntries.length; i += CHUNK) {
          const slice = groupEntries.slice(i, i + CHUNK);
          // eslint-disable-next-line no-await-in-loop
          await Promise.all(
            slice.map((group) => {
              const first = group[0];
              return fetch("/api/teacher/grading/tile-grades/ai-prescore", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  class_id: first.classId,
                  unit_id: first.unitId,
                  page_id: first.pageId,
                  tile_id: first.tileId,
                  student_ids: group.map((g) => g.studentId),
                }),
              }).catch(() => null);
            }),
          );
        }
        // Refresh so newly-drafted items move out of no_draft state.
        await refetch();
      } finally {
        setWarmingDrafts(false);
      }
    })();
    // We intentionally only run this when items first transitions
    // from null → list. Subsequent filter changes don't re-fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items === null]);

  // ─── Derived: counts + filter options ───
  const filteredItems = React.useMemo(() => {
    if (!items) return [];
    return items.filter((i) => {
      if (classFilter && i.classId !== classFilter) return false;
      if (lessonFilter && `${i.unitId}::${i.pageId}` !== lessonFilter)
        return false;
      return true;
    });
  }, [items, classFilter, lessonFilter]);

  const counts = React.useMemo(() => {
    const all = filteredItems;
    return {
      total: all.length,
      replyWaiting: all.filter((i) => i.state === "reply_waiting").length,
      drafted: all.filter((i) => i.state === "drafted").length,
      noDraft: all.filter((i) => i.state === "no_draft").length,
    };
  }, [filteredItems]);

  const classOptions = React.useMemo(() => {
    if (!items) return [];
    const m = new Map<string, string>();
    for (const i of items) m.set(i.classId, i.className);
    return Array.from(m.entries()).map(([id, name]) => ({ id, name }));
  }, [items]);

  const lessonOptions = React.useMemo(() => {
    if (!items) return [];
    const m = new Map<string, string>();
    for (const i of items) {
      const key = `${i.unitId}::${i.pageId}`;
      const label = `${i.unitTitle} · ${i.pageTitle}`;
      m.set(key, label);
    }
    return Array.from(m.entries()).map(([id, name]) => ({ id, name }));
  }, [items]);

  // ─── Render ───
  if (items === null) {
    return (
      <div className="min-h-screen bg-stone-50 p-6">
        <div className="max-w-3xl mx-auto">
          <div className="animate-pulse space-y-3">
            <div className="h-8 bg-gray-200 rounded w-1/3" />
            <div className="h-32 bg-gray-200 rounded" />
            <div className="h-32 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-stone-50 p-6">
        <div className="max-w-3xl mx-auto">
          <div className="rounded-2xl border border-rose-300 bg-rose-50 p-6 text-sm text-rose-900">
            <div className="font-bold mb-2">Inbox couldn&rsquo;t load</div>
            <div className="text-rose-700 mb-3">{loadError}</div>
            <button
              type="button"
              onClick={() => void refetch()}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-rose-600 text-white hover:bg-rose-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-gray-950">
              Feedback inbox
            </h1>
            <p className="text-sm text-gray-600">
              {counts.total === 0 ? (
                "0 to review — nice work."
              ) : (
                <>
                  <span className="font-bold text-gray-900">
                    {counts.total} to review
                  </span>
                  {counts.replyWaiting > 0 && (
                    <>
                      {" "}· <span className="text-amber-700 font-bold">
                        {counts.replyWaiting} waiting on you
                      </span>
                    </>
                  )}
                  {warmingDrafts && (
                    <>
                      {" "}·{" "}
                      <span className="text-purple-700 font-bold inline-flex items-center gap-1">
                        <svg
                          width="11"
                          height="11"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          aria-hidden="true"
                          className="animate-pulse"
                        >
                          <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" />
                        </svg>
                        AI drafting…
                      </span>
                    </>
                  )}
                </>
              )}
            </p>
          </div>
          <Link
            href="/teacher/marking"
            className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl px-3 py-2 hover:bg-gray-50 transition font-medium"
          >
            Marking page →
          </Link>
        </div>

        {/* Filter chips */}
        {items.length > 0 && (
          <div className="max-w-3xl mx-auto px-6 pb-3 flex items-center gap-2 flex-wrap text-xs">
            {classOptions.length > 1 && (
              <select
                value={classFilter ?? ""}
                onChange={(e) => setClassFilter(e.target.value || null)}
                className="px-2 py-1 rounded-md border border-gray-200 bg-white"
                data-testid="inbox-class-filter"
              >
                <option value="">All classes</option>
                {classOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
            {lessonOptions.length > 1 && (
              <select
                value={lessonFilter ?? ""}
                onChange={(e) => setLessonFilter(e.target.value || null)}
                className="px-2 py-1 rounded-md border border-gray-200 bg-white"
                data-testid="inbox-lesson-filter"
              >
                <option value="">All lessons</option>
                {lessonOptions.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            )}
            {(classFilter || lessonFilter) && (
              <button
                type="button"
                onClick={() => {
                  setClassFilter(null);
                  setLessonFilter(null);
                }}
                className="px-2 py-1 rounded-md border border-gray-200 bg-white hover:bg-gray-50"
              >
                Clear
              </button>
            )}
          </div>
        )}
      </header>

      {/* Items — C.1 placeholder cards. Full card layout in C.2. */}
      <main className="max-w-3xl mx-auto px-6 py-6">
        {filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-8 text-center">
            <div className="font-bold text-gray-700 mb-1">
              0 to review — nice work.
            </div>
            <div className="text-sm text-gray-500">
              When students submit responses, their tiles will queue up here
              for you to approve.
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <InboxCardPlaceholder key={item.itemKey} item={item} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Card placeholder (C.1) ───
// Full visual + interactive approve flow lands in C.2. This placeholder
// surfaces the data so we can validate the loader before the visual lands.
function InboxCardPlaceholder({ item }: { item: InboxItem }) {
  const stateTone = {
    reply_waiting: "border-amber-300 bg-amber-50/40",
    drafted: "border-emerald-300 bg-emerald-50/40",
    no_draft: "border-gray-200 bg-white",
  }[item.state];
  const stateLabel = {
    reply_waiting: "Reply waiting",
    drafted: "AI drafted",
    no_draft: "Awaiting draft…",
  }[item.state];

  return (
    <article
      data-testid="inbox-item-card"
      data-state={item.state}
      data-grade-id={item.gradeId}
      className={[
        "rounded-2xl border p-4",
        stateTone,
      ].join(" ")}
    >
      <header className="flex items-baseline justify-between gap-3 mb-2">
        <div className="text-xs text-gray-600">
          <span className="font-bold text-gray-900">{item.studentName}</span>
          {" · "}
          {item.className}
          {" · "}
          {item.unitTitle}
          {" · "}
          {item.pageTitle}
        </div>
        <span
          className={[
            "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider",
            item.state === "reply_waiting"
              ? "bg-amber-100 text-amber-800"
              : item.state === "drafted"
                ? "bg-emerald-100 text-emerald-800"
                : "bg-gray-100 text-gray-600",
          ].join(" ")}
        >
          {stateLabel}
        </span>
      </header>

      <p className="text-sm font-semibold text-gray-900 mb-3">
        {item.tilePrompt}
      </p>

      {item.studentResponse && (
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 mb-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
            Student response
          </span>
          {item.studentResponse.length > 200
            ? `${item.studentResponse.slice(0, 200)}…`
            : item.studentResponse}
        </div>
      )}

      {item.latestStudentReply && (
        <div className="rounded-lg border border-purple-200 bg-purple-50/60 px-3 py-2 text-sm text-purple-950 mb-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block mb-1">
            Reply ({item.latestStudentReply.sentiment.replace("_", " ")})
          </span>
          {item.latestStudentReply.text || "(no message — single-click reply)"}
        </div>
      )}

      {item.aiCommentDraft && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block mb-1">
            AI draft
            {item.aiScore !== null && ` · Score ${item.aiScore}`}
            {item.aiConfidence !== null && ` · ${Math.round(item.aiConfidence * 100)}% confident`}
          </span>
          {item.aiCommentDraft}
        </div>
      )}

      <footer className="mt-3 text-[11px] text-gray-500 italic">
        Approve flow + tweak buttons land in C.2 / C.4. For now this card
        confirms the loader works end-to-end.
      </footer>
    </article>
  );
}
