/**
 * /teacher/inbox — Teacher Marking Inbox (TFL.3 / Pass C)
 *
 * C.2 layout: master-detail two-column. Queue on the left, detail +
 * marking surface on the right. Replaces C.1's stacked-card placeholder
 * after Matt smoke ("don't make me click into another marking button —
 * mark it right here in two columns").
 *
 * Workflow:
 *   1. On mount: fetch /api/teacher/inbox/items + warm auto-drafts for
 *      no_draft groups (existing ai-prescore route).
 *   2. Auto-select the FIRST item on load.
 *   3. Teacher reads response + AI draft in the right pane.
 *   4. ✓ Approve & send → POST /api/teacher/grading/tile-grades with
 *      ai_comment_draft promoted to student_facing_comment + score
 *      + confirmed=true. Item flies out of the left list; next item
 *      auto-selects.
 *   5. Skip → hides the item from this session (client-only, refresh
 *      restores). Auto-advances to next.
 *
 * HTML sanitize: studentResponse comes through sanitizeResponseText
 * before render — fixes the LIS contenteditable `<div>` tags showing
 * raw text in C.1's smoke.
 *
 * Low-confidence drafts (<40%): the detail pane surfaces an amber
 * "Review carefully — low AI confidence" chip + makes the approve
 * button slightly less prominent. C.4 will add tweak buttons that
 * regenerate the draft.
 *
 * Tweak buttons (Shorter / Warmer / Sharper / + Ask) and the dashboard
 * chip land in C.4 / C.5 respectively.
 */

"use client";

import * as React from "react";
import Link from "next/link";
import { sanitizeResponseText } from "@/lib/grading/sanitize-response";
import { formatInboxRelativeTime } from "@/lib/grading/relative-time";

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

const LOW_CONFIDENCE_THRESHOLD = 0.4;

export default function TeacherInboxPage() {
  const [items, setItems] = React.useState<InboxItem[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [warmingDrafts, setWarmingDrafts] = React.useState(false);
  const [classFilter, setClassFilter] = React.useState<string | null>(null);
  const [lessonFilter, setLessonFilter] = React.useState<string | null>(null);
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);
  const [skipped, setSkipped] = React.useState<Set<string>>(new Set());
  /** Drafts edited inline by the teacher before approve. Keyed by
   *  itemKey. Falls back to item.aiCommentDraft if absent. */
  const [draftEdits, setDraftEdits] = React.useState<Record<string, string>>(
    {},
  );
  const [approving, setApproving] = React.useState(false);
  /** TFL.3 C.3 — AI-drafted follow-ups for reply_waiting items.
   *  Keyed by itemKey. Lazy-fetched the FIRST time a reply_waiting
   *  item is selected. Local React state (not persisted) — keeps the
   *  ai_comment_draft column clean of follow-up text that could
   *  confuse the prescore flow. */
  const [followupDrafts, setFollowupDrafts] = React.useState<
    Record<string, string>
  >({});
  const [followupFetching, setFollowupFetching] = React.useState<
    Record<string, boolean>
  >({});

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

  // ─── Auto-refresh every 60s so new student replies / fresh
  // submissions surface without the teacher hitting browser refresh.
  // Pauses when the tab is hidden to avoid burning DB queries for
  // nothing; resumes (with an immediate refetch) on focus. Matt
  // feedback 12 May 2026 ("inbox needs to auto update every minute
  // or so"). ───
  const INBOX_POLL_MS = 60_000;
  React.useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (intervalId) return;
      intervalId = setInterval(() => {
        if (typeof document !== "undefined" && document.hidden) return;
        void refetch();
      }, INBOX_POLL_MS);
    };
    const stop = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        void refetch();
        start();
      }
    };
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refetch]);

  // ─── Auto-draft warm-up for no_draft items (unchanged from C.1) ───
  React.useEffect(() => {
    if (!items || items.length === 0) return;
    const noDraftItems = items.filter((i) => i.state === "no_draft");
    if (noDraftItems.length === 0) return;
    if (warmingDrafts) return;

    setWarmingDrafts(true);
    void (async () => {
      try {
        const groups = new Map<string, InboxItem[]>();
        for (const i of noDraftItems) {
          const key = `${i.classId}::${i.unitId}::${i.pageId}::${i.tileId}`;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(i);
        }
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
        await refetch();
      } finally {
        setWarmingDrafts(false);
      }
    })();
    // Only fire once per fresh load (items transitions null → []).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items === null]);

  // ─── Derived: filtered + skipped items ───
  const visibleItems = React.useMemo(() => {
    if (!items) return [];
    return items.filter((i) => {
      if (skipped.has(i.itemKey)) return false;
      if (classFilter && i.classId !== classFilter) return false;
      if (lessonFilter && `${i.unitId}::${i.pageId}` !== lessonFilter)
        return false;
      return true;
    });
  }, [items, skipped, classFilter, lessonFilter]);

  // ─── Auto-select first item on load + after approvals/skips ───
  React.useEffect(() => {
    if (!selectedKey && visibleItems.length > 0) {
      setSelectedKey(visibleItems[0].itemKey);
      return;
    }
    if (selectedKey && !visibleItems.find((i) => i.itemKey === selectedKey)) {
      // Selected item no longer in the visible list (approved/skipped/
      // filtered out) — advance to the first remaining item.
      setSelectedKey(visibleItems[0]?.itemKey ?? null);
    }
  }, [visibleItems, selectedKey]);

  const selectedItem = React.useMemo(
    () => visibleItems.find((i) => i.itemKey === selectedKey) ?? null,
    [visibleItems, selectedKey],
  );

  // ─── C.3: lazy-fetch the AI follow-up draft when a reply_waiting
  // item is selected and we haven't drafted for it yet. ───
  React.useEffect(() => {
    if (!selectedItem) return;
    if (selectedItem.state !== "reply_waiting") return;
    if (followupDrafts[selectedItem.itemKey] !== undefined) return; // already drafted
    if (followupFetching[selectedItem.itemKey]) return; // in flight

    const key = selectedItem.itemKey;
    const gradeId = selectedItem.gradeId;
    setFollowupFetching((prev) => ({ ...prev, [key]: true }));

    void (async () => {
      try {
        const res = await fetch("/api/teacher/grading/draft-followup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ grade_id: gradeId }),
        });
        if (!res.ok) {
          // Surface the error inline; don't block the teacher.
          const json = await res.json().catch(() => ({}));
          const errMsg =
            (json as { error?: string }).error ??
            `Draft failed (${res.status})`;
          setFollowupDrafts((prev) => ({
            ...prev,
            [key]: `(AI draft failed — ${errMsg})`,
          }));
        } else {
          const json = (await res.json()) as { draftBody: string };
          setFollowupDrafts((prev) => ({
            ...prev,
            [key]: json.draftBody ?? "",
          }));
        }
      } catch (err) {
        setFollowupDrafts((prev) => ({
          ...prev,
          [key]: `(AI draft failed — ${err instanceof Error ? err.message : "network error"})`,
        }));
      } finally {
        setFollowupFetching((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    })();
  }, [selectedItem, followupDrafts, followupFetching]);

  // ─── Filter options ───
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
      m.set(`${i.unitId}::${i.pageId}`, `${i.unitTitle} · ${i.pageTitle}`);
    }
    return Array.from(m.entries()).map(([id, name]) => ({ id, name }));
  }, [items]);

  // ─── Counts ───
  const counts = React.useMemo(() => {
    return {
      total: visibleItems.length,
      replyWaiting: visibleItems.filter((i) => i.state === "reply_waiting")
        .length,
    };
  }, [visibleItems]);

  // ─── Approve handler ───
  const handleApprove = React.useCallback(async () => {
    if (!selectedItem) return;
    const item = selectedItem;
    // For reply_waiting items the source-of-truth draft is the AI
    // follow-up (lazy-loaded into followupDrafts), NOT the original
    // aiCommentDraft column. Mirror DetailPane's baseDraft logic
    // exactly so handleApprove sees what the teacher saw on screen.
    // (12 May 2026 — Matt smoke caught the button silently no-op'ing
    // because aiCommentDraft was empty for already-confirmed grades.)
    const NO_FOLLOWUP_SENTINEL = "(no follow-up needed)";
    const followupForItem = followupDrafts[item.itemKey];
    const baseDraft =
      item.state === "reply_waiting"
        ? followupForItem === NO_FOLLOWUP_SENTINEL
          ? ""
          : followupForItem ?? ""
        : item.aiCommentDraft ?? "";
    const draftText = draftEdits[item.itemKey] ?? baseDraft;
    if (!draftText.trim()) return;

    setApproving(true);
    try {
      // The PUT route exists from G3; it handles the upsert + the B.4
      // sync trigger picks up the comment write to manage the turn
      // INSERT/UPDATE semantics.
      const res = await fetch("/api/teacher/grading/tile-grades", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: item.studentId,
          unit_id: item.unitId,
          page_id: item.pageId,
          tile_id: item.tileId,
          class_id: item.classId,
          score: item.aiScore,
          confirmed: true,
          criterion_keys: [], // server-side: pre-existing keys preserved
          student_facing_comment: draftText,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(
          (json as { error?: string }).error ??
            `Approve failed (${res.status})`,
        );
      }
      // Optimistic: drop this item from the local list. The next
      // useEffect picks the next visible item automatically.
      setItems((prev) =>
        prev ? prev.filter((p) => p.itemKey !== item.itemKey) : prev,
      );
      setDraftEdits((prev) => {
        const next = { ...prev };
        delete next[item.itemKey];
        return next;
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setApproving(false);
    }
  }, [selectedItem, draftEdits, followupDrafts]);

  const handleSkip = React.useCallback(() => {
    if (!selectedItem) return;
    setSkipped((prev) => new Set(prev).add(selectedItem.itemKey));
  }, [selectedItem]);

  // ─── Render: loading + error states ───
  if (items === null) {
    return (
      <div className="min-h-screen bg-stone-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-3">
            <div className="h-8 bg-gray-200 rounded w-1/3" />
            <div className="h-96 bg-gray-200 rounded" />
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
    <div className="h-[calc(100vh-3.5rem)] flex flex-col bg-stone-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/60 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-extrabold text-gray-950">
              Feedback inbox
            </h1>
            <p className="text-xs text-gray-600">
              {counts.total === 0 ? (
                "0 to review — nice work."
              ) : (
                <>
                  <span className="font-bold text-gray-900">
                    {counts.total} to review
                  </span>
                  {counts.replyWaiting > 0 && (
                    <>
                      {" "}·{" "}
                      <span className="text-amber-700 font-bold">
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
          <div className="flex items-center gap-2 text-xs">
            {classOptions.length > 1 && (
              <select
                value={classFilter ?? ""}
                onChange={(e) => setClassFilter(e.target.value || null)}
                data-testid="inbox-class-filter"
                className="px-2 py-1 rounded-md border border-gray-200 bg-white"
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
                data-testid="inbox-lesson-filter"
                className="px-2 py-1 rounded-md border border-gray-200 bg-white"
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
            <Link
              href="/teacher/marking"
              className="text-gray-500 hover:text-gray-700 border border-gray-200 rounded-md px-2 py-1 hover:bg-gray-50 font-medium"
            >
              Cohort view →
            </Link>
          </div>
        </div>
      </header>

      {/* Master-detail body */}
      <div className="flex-1 overflow-hidden">
        <div className="max-w-6xl mx-auto h-full grid grid-cols-[320px_1fr] gap-0">
          {/* ─── Queue (left) ─── */}
          <aside
            data-testid="inbox-queue"
            className="border-r border-gray-200 bg-white overflow-y-auto"
          >
            {visibleItems.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500">
                0 to review — nice work.
              </div>
            ) : (
              <QueueList
                items={visibleItems}
                selectedKey={selectedKey}
                onSelect={setSelectedKey}
              />
            )}
          </aside>

          {/* ─── Detail (right) ─── */}
          <main
            data-testid="inbox-detail"
            className="overflow-y-auto bg-stone-50"
          >
            {selectedItem ? (
              <DetailPane
                item={selectedItem}
                draftEdits={draftEdits}
                setDraftEdits={setDraftEdits}
                approving={approving}
                onApprove={handleApprove}
                onSkip={handleSkip}
                followupDraft={followupDrafts[selectedItem.itemKey]}
                followupFetching={
                  !!followupFetching[selectedItem.itemKey]
                }
              />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                Select an item from the queue to get started.
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// QueueList — compact rows grouped by state. Selectable.
// ════════════════════════════════════════════════════════════════════════════

function QueueList({
  items,
  selectedKey,
  onSelect,
}: {
  items: InboxItem[];
  selectedKey: string | null;
  onSelect: (k: string) => void;
}) {
  // Group by state (preserving server-side sort within each group).
  const byState = React.useMemo(() => {
    const buckets: Record<
      InboxItem["state"],
      InboxItem[]
    > = { reply_waiting: [], drafted: [], no_draft: [] };
    for (const i of items) buckets[i.state].push(i);
    return buckets;
  }, [items]);

  const sectionTitle: Record<InboxItem["state"], string> = {
    reply_waiting: "Reply waiting",
    drafted: "AI drafted",
    no_draft: "Drafting…",
  };
  const sectionTone: Record<InboxItem["state"], string> = {
    reply_waiting: "text-amber-700",
    drafted: "text-emerald-700",
    no_draft: "text-gray-500",
  };

  return (
    <div className="py-2">
      {(["reply_waiting", "drafted", "no_draft"] as InboxItem["state"][]).map(
        (state) => {
          const bucket = byState[state];
          if (bucket.length === 0) return null;
          return (
            <section key={state} className="mb-3">
              <header
                className={[
                  "px-4 py-1.5 text-[10px] font-extrabold uppercase tracking-wider",
                  sectionTone[state],
                ].join(" ")}
              >
                {sectionTitle[state]} ({bucket.length})
              </header>
              <ul>
                {bucket.map((item) => (
                  <li key={item.itemKey}>
                    <QueueRow
                      item={item}
                      active={item.itemKey === selectedKey}
                      onClick={() => onSelect(item.itemKey)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          );
        },
      )}
    </div>
  );
}

function QueueRow({
  item,
  active,
  onClick,
}: {
  item: InboxItem;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="inbox-queue-row"
      data-state={item.state}
      data-active={active}
      className={[
        "w-full text-left px-4 py-2.5 border-l-4 transition",
        active
          ? "bg-purple-50 border-purple-500"
          : "border-transparent hover:bg-gray-50",
      ].join(" ")}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-bold text-gray-900 truncate">
          {item.studentName}
        </span>
        <span
          className="text-[10px] text-gray-400 shrink-0 font-mono tabular-nums"
          data-testid="inbox-queue-row-relative-time"
          title={new Date(item.lastActivityAt).toLocaleString()}
        >
          {formatInboxRelativeTime(item.lastActivityAt)}
        </span>
      </div>
      <div className="text-[11px] text-gray-500 truncate">
        {item.className} · {item.pageTitle}
      </div>
      {item.state === "reply_waiting" && item.latestStudentReply && (
        <div className="mt-1 text-[10px] text-amber-700 italic truncate">
          ⇠ {item.latestStudentReply.sentiment.replace("_", " ")}
          {item.latestStudentReply.text
            ? `: ${item.latestStudentReply.text.slice(0, 40)}${item.latestStudentReply.text.length > 40 ? "…" : ""}`
            : ""}
        </div>
      )}
    </button>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// DetailPane — full marking surface for the selected item.
// ════════════════════════════════════════════════════════════════════════════

function DetailPane({
  item,
  draftEdits,
  setDraftEdits,
  approving,
  onApprove,
  onSkip,
  followupDraft,
  followupFetching,
}: {
  item: InboxItem;
  draftEdits: Record<string, string>;
  setDraftEdits: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  approving: boolean;
  onApprove: () => void;
  onSkip: () => void;
  /** TFL.3 C.3 — the AI follow-up draft (got_it/not_sure/pushback)
   *  for reply_waiting items. Lazy-loaded by the parent. */
  followupDraft: string | undefined;
  followupFetching: boolean;
}) {
  /** Hide approve when the follow-up is still fetching OR when the
   *  AI returned the "no follow-up needed" sentinel. The sentinel
   *  surfaces as a teacher-facing message; teacher can Mark resolved
   *  (Skip semantics) or type their own follow-up. */
  const NO_FOLLOWUP_SENTINEL = "(no follow-up needed)";
  const isNoFollowupSentinel =
    item.state === "reply_waiting" &&
    followupDraft === NO_FOLLOWUP_SENTINEL &&
    !draftEdits[item.itemKey];

  // For reply_waiting items, the textarea reflects the follow-up
  // draft (from C.3's draft-followup route). For drafted / no_draft
  // items, it reflects the prescore draft (aiCommentDraft column).
  // Teacher edits override either via draftEdits.
  // The sentinel is an INTERNAL marker — never surface it in the
  // textarea; render an empty value (placeholder visible) so the
  // teacher isn't asked to "approve & send" a literal "(no follow-up
  // needed)" string.
  const baseDraft =
    item.state === "reply_waiting"
      ? followupDraft === NO_FOLLOWUP_SENTINEL
        ? ""
        : followupDraft ?? ""
      : item.aiCommentDraft ?? "";
  const draftValue = draftEdits[item.itemKey] ?? baseDraft;
  const cleanResponse = item.studentResponse
    ? sanitizeResponseText(item.studentResponse)
    : "";
  const isLowConfidence =
    typeof item.aiConfidence === "number" &&
    item.aiConfidence < LOW_CONFIDENCE_THRESHOLD;

  const canApprove = (() => {
    if (approving) return false;
    if (!draftValue.trim()) return false;
    // For reply_waiting: need a real draft (not the sentinel) OR a
    // teacher edit that overrides the sentinel.
    if (item.state === "reply_waiting") {
      if (followupFetching) return false;
      if (isNoFollowupSentinel) return false;
      return true;
    }
    // For drafted/no_draft: need a prescore draft.
    return !!item.aiCommentDraft;
  })();

  return (
    <article
      data-testid="inbox-detail-pane"
      data-grade-id={item.gradeId}
      data-state={item.state}
      className="max-w-3xl mx-auto px-6 py-6"
    >
      {/* Context header */}
      <header className="mb-4">
        <div className="text-[10px] font-bold tracking-wider uppercase text-purple-700">
          {item.criterionLabel}
        </div>
        <h2 className="text-xl font-extrabold text-gray-950 mt-1 leading-tight">
          {item.tilePrompt}
        </h2>
        <div className="mt-1 text-xs text-gray-500">
          <span className="font-bold text-gray-700">{item.studentName}</span>
          {" · "}
          {item.className}
          {" · "}
          {item.unitTitle}
          {" · "}
          {item.pageTitle}
          {" · "}
          <span
            className="text-gray-400"
            data-testid="inbox-detail-relative-time"
            title={new Date(item.lastActivityAt).toLocaleString()}
          >
            {formatInboxRelativeTime(item.lastActivityAt)}
          </span>
        </div>
      </header>

      {/* Student response */}
      <section className="mb-4">
        <div className="text-[10px] font-bold tracking-wider uppercase text-gray-500 mb-1.5">
          Student response
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">
          {cleanResponse || (
            <span className="italic text-gray-400">
              No submission yet.
            </span>
          )}
        </div>
      </section>

      {/* Student reply (reply_waiting state) */}
      {item.state === "reply_waiting" && item.latestStudentReply && (
        <section className="mb-4">
          <div className="text-[10px] font-bold tracking-wider uppercase text-purple-700 mb-1.5">
            {item.studentName}&rsquo;s reply ·{" "}
            {item.latestStudentReply.sentiment === "got_it"
              ? "Got it"
              : item.latestStudentReply.sentiment === "not_sure"
                ? "Not sure"
                : "I disagree"}
          </div>
          <div className="rounded-xl border border-purple-300 bg-purple-50/60 px-4 py-3 text-sm text-purple-950 whitespace-pre-wrap">
            {item.latestStudentReply.text || (
              <span className="italic">
                (no message — single-click reply)
              </span>
            )}
          </div>
        </section>
      )}

      {/* AI draft (editable inline). TFL.3 C.3: for reply_waiting
          items the textarea now reflects the follow-up draft (3
          sub-prompts: got_it/not_sure/pushback) instead of the
          prescore draft. */}
      <section className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-[10px] font-bold tracking-wider uppercase text-emerald-700 inline-flex items-center gap-2">
            {item.state === "reply_waiting" ? "AI follow-up draft" : "AI draft"}
            {item.state !== "reply_waiting" && item.aiScore !== null && (
              <span className="font-mono text-emerald-600">
                · Score {item.aiScore}
              </span>
            )}
            {item.state !== "reply_waiting" && item.aiConfidence !== null && (
              <span
                className={[
                  "inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                  isLowConfidence
                    ? "bg-amber-100 text-amber-800"
                    : "bg-emerald-100 text-emerald-800",
                ].join(" ")}
                data-testid="inbox-detail-confidence"
                data-low-confidence={isLowConfidence}
              >
                {Math.round(item.aiConfidence * 100)}% confident
              </span>
            )}
            {item.state === "reply_waiting" && followupFetching && (
              <span
                className="inline-flex items-center gap-1 text-purple-700 font-bold animate-pulse"
                data-testid="inbox-followup-drafting"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" />
                </svg>
                drafting reply…
              </span>
            )}
          </div>
        </div>

        {isLowConfidence && item.state !== "reply_waiting" && (
          <div
            data-testid="inbox-low-confidence-warning"
            className="mb-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2"
          >
            <strong>Review carefully.</strong> The AI&rsquo;s confidence on
            this one is low — usually because the response is empty,
            off-topic, or very short. Consider editing the draft (or skipping
            + using the marking page&rsquo;s nudge button) before approving.
          </div>
        )}

        {isNoFollowupSentinel && (
          <div
            data-testid="inbox-no-followup-needed"
            className="mb-2 text-[11px] text-purple-800 bg-purple-50 border border-purple-300 rounded-lg px-3 py-2"
          >
            <strong>The AI thinks no follow-up is needed here.</strong>{" "}
            {item.studentName}&rsquo;s &ldquo;Got it&rdquo; resolves the thread
            cleanly. Skip to close silently, or type your own follow-up below.
          </div>
        )}

        <textarea
          data-testid="inbox-draft-textarea"
          value={draftValue}
          onChange={(e) =>
            setDraftEdits((prev) => ({
              ...prev,
              [item.itemKey]: e.target.value,
            }))
          }
          placeholder={(() => {
            if (item.state === "reply_waiting") {
              if (followupFetching) return "AI is drafting your follow-up…";
              if (isNoFollowupSentinel)
                return `Skip to close silently, or type your own follow-up to ${item.studentName}.`;
              return "Edit the AI follow-up, or approve as-is.";
            }
            return item.aiCommentDraft
              ? "Edit the AI draft, or approve as-is."
              : "AI is still drafting — give it a moment, then approve.";
          })()}
          rows={5}
          disabled={
            item.state === "reply_waiting"
              ? followupFetching
              : !item.aiCommentDraft
          }
          className="w-full px-3 py-2 text-sm border border-emerald-200 bg-emerald-50/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none disabled:bg-gray-50 disabled:text-gray-400"
        />
        {/* Tweak buttons (Shorter / Warmer / Sharper / + Ask) land in C.4. */}
        <div className="mt-1 text-[10px] text-gray-400 italic">
          Tweak buttons (Shorter / Warmer / Sharper / + Ask) ship in C.4.
        </div>
      </section>

      {/* Actions. When the AI returned the "no follow-up needed" sentinel
          (got_it on a thin response) we suppress the approve button and
          promote a single "Mark resolved" purple button — closing the
          thread silently is the correct semantic, not "approve & send a
          blank message". The teacher can still type into the textarea
          above to override the sentinel; that re-shows approve. */}
      <footer className="flex items-center justify-between gap-3 pt-2 border-t border-gray-200">
        <div className="flex items-center gap-2">
          {isNoFollowupSentinel ? (
            <button
              type="button"
              data-testid="inbox-mark-resolved-button"
              onClick={onSkip}
              disabled={approving}
              className="px-5 py-2.5 text-sm font-extrabold rounded-xl transition bg-purple-600 text-white hover:bg-purple-700 shadow-sm disabled:opacity-50"
            >
              ✓ Mark resolved
            </button>
          ) : (
            <>
              <button
                type="button"
                data-testid="inbox-approve-button"
                onClick={onApprove}
                disabled={!canApprove}
                className={[
                  "px-5 py-2.5 text-sm font-extrabold rounded-xl transition",
                  canApprove
                    ? isLowConfidence
                      ? "bg-amber-500 text-white hover:bg-amber-600 shadow-sm"
                      : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed",
                ].join(" ")}
              >
                {approving ? "Sending…" : "✓ Approve & send"}
              </button>
              <button
                type="button"
                data-testid="inbox-skip-button"
                onClick={onSkip}
                disabled={approving}
                className="px-3 py-2 text-xs font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition disabled:opacity-50"
              >
                Skip
              </button>
            </>
          )}
        </div>
        <Link
          href={`/teacher/marking?class=${item.classId}&unit=${item.unitId}`}
          className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 font-medium"
        >
          Open in marking page →
        </Link>
      </footer>
    </article>
  );
}
