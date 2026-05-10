/**
 * /admin/teacher-feedback-sandbox — visual sandbox for the Pass A
 * <TeacherFeedback /> component.
 *
 * No auth gate beyond the existing /admin layout — this surface only
 * exists in the visual prototype phase and gets removed (or moved
 * behind a feature flag) once Pass B wires the live schema. Same
 * pattern as the other /admin sandboxes (test-sandbox, generation-
 * sandbox, ingestion-sandbox).
 *
 * What you can do here:
 *   - Flip through 5 fixture states via the side rail.
 *   - Toggle attentionGrab + needsReply + reduced-motion preview.
 *   - Watch the speech-bubble tail anchor against a faux response card.
 *   - Click the pills + send a reply; the sandbox handler logs to the
 *     console and updates a "last interaction" panel — no persistence.
 */

"use client";

import * as React from "react";
import { TeacherFeedback } from "@/components/lesson/TeacherFeedback";
import {
  ACTIVE_THREAD_TURNS,
  EMPTY_TURNS,
  FRESH_UNREAD_TURNS,
  NEEDS_REPLY_TURNS,
  RESOLVED_TURNS,
} from "@/components/lesson/TeacherFeedback/fixtures";
import type { Sentiment, Turn } from "@/components/lesson/TeacherFeedback/types";

type FixtureKey = "fresh" | "needs-reply" | "active" | "resolved" | "empty";

const FIXTURES: Record<
  FixtureKey,
  { label: string; description: string; turns: Turn[]; needsReply: boolean }
> = {
  fresh: {
    label: "1 · Fresh, unread",
    description:
      "Single teacher turn, attentionGrab pulse on. The first thing the student sees when they open the lesson.",
    turns: FRESH_UNREAD_TURNS,
    needsReply: false,
  },
  "needs-reply": {
    label: "2 · Needs reply (flagged)",
    description:
      "Teacher has flagged this turn as needing a written reply. Got it pill is disabled; pushback / not_sure stay live. Pass A: the prop wires the visual; Pass B will gate the upstream response submit too.",
    turns: NEEDS_REPLY_TURNS,
    needsReply: true,
  },
  active: {
    label: "3 · Active mid-thread",
    description:
      "Teacher → student 'not_sure' → teacher follow-up. The single bubble morphs into the multi-turn Thread shape. Latest turn is teacher, so pills + reply box show below.",
    turns: ACTIVE_THREAD_TURNS,
    needsReply: false,
  },
  resolved: {
    label: "4 · Resolved (got_it)",
    description:
      "Latest turn is got_it. Bubble collapses to the 56px Resolved row; click anywhere to re-open the full thread.",
    turns: RESOLVED_TURNS,
    needsReply: false,
  },
  empty: {
    label: "5 · Empty (no comment yet)",
    description:
      "Tile has no teacher feedback at all. Subtle dashed placeholder — non-attention-grabbing.",
    turns: EMPTY_TURNS,
    needsReply: false,
  },
};

const FIXTURE_ORDER: FixtureKey[] = [
  "fresh",
  "needs-reply",
  "active",
  "resolved",
  "empty",
];

interface InteractionLog {
  ts: string;
  sentiment: Sentiment;
  text?: string;
}

export default function TeacherFeedbackSandboxPage() {
  const [activeKey, setActiveKey] = React.useState<FixtureKey>("fresh");
  const [attentionGrab, setAttentionGrab] = React.useState(true);
  const [showResponseCard, setShowResponseCard] = React.useState(true);
  const [interactions, setInteractions] = React.useState<InteractionLog[]>([]);

  const fixture = FIXTURES[activeKey];

  async function handleReply(sentiment: Sentiment, text?: string) {
    // Simulated network roundtrip so the "Sending…" state surfaces.
    await new Promise((r) => setTimeout(r, 600));
    setInteractions((prev) =>
      [{ ts: new Date().toISOString(), sentiment, text }, ...prev].slice(0, 8),
    );
    // eslint-disable-next-line no-console
    console.log("[teacher-feedback-sandbox] onReply", { sentiment, text });
  }

  function handleReopen() {
    // eslint-disable-next-line no-console
    console.log("[teacher-feedback-sandbox] onReopen");
  }

  return (
    <div className="flex flex-col" style={{ minHeight: "calc(100vh - 3.5rem)" }}>
      {/* Header */}
      <div
        className="px-6 py-3 flex items-center justify-between shrink-0 border-b"
        style={{
          borderColor: "rgba(0,0,0,0.06)",
          background: "rgba(255,255,255,0.6)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div className="flex items-center gap-3">
          <svg
            className="w-5 h-5 text-emerald-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
            />
          </svg>
          <h1 className="text-base font-bold text-gray-900">
            Teacher Feedback Sandbox
          </h1>
          <span className="text-xs text-gray-400">
            Pass A · visual-only · fixtures
          </span>
        </div>
        <a
          href="/teacher/marking"
          className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl px-3 py-2 hover:bg-gray-50 transition-colors font-medium"
        >
          Marking page →
        </a>
      </div>

      {/* Body — 2-column: fixture rail + canvas */}
      <div className="flex-1 grid grid-cols-[280px_1fr] gap-0">
        {/* Left rail */}
        <aside className="border-r bg-white/60 backdrop-blur p-4 flex flex-col gap-4">
          <div>
            <div className="text-[10px] font-bold tracking-wider uppercase text-gray-400 mb-2">
              States
            </div>
            <div className="flex flex-col gap-1">
              {FIXTURE_ORDER.map((key) => {
                const f = FIXTURES[key];
                const active = key === activeKey;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveKey(key)}
                    className={[
                      "text-left px-3 py-2 rounded-lg text-xs font-bold transition border",
                      active
                        ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                        : "bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50",
                    ].join(" ")}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-bold tracking-wider uppercase text-gray-400 mb-2">
              Toggles
            </div>
            <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 cursor-pointer text-xs font-semibold text-gray-700">
              <input
                type="checkbox"
                checked={attentionGrab}
                onChange={(e) => setAttentionGrab(e.target.checked)}
                className="accent-emerald-500"
              />
              attentionGrab pulse
            </label>
            <label className="mt-1 flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 cursor-pointer text-xs font-semibold text-gray-700">
              <input
                type="checkbox"
                checked={showResponseCard}
                onChange={(e) => setShowResponseCard(e.target.checked)}
                className="accent-emerald-500"
              />
              show faux response card above
            </label>
          </div>

          <div className="text-xs text-gray-500 leading-relaxed border-t pt-3">
            <div className="font-bold text-gray-700 mb-1">Tip</div>
            On states 1 + 2, click <strong>Not sure</strong> or{" "}
            <strong>I disagree</strong> to open the height-animated reply
            box. Both require ≥10 chars to send. <strong>Got it</strong>{" "}
            single-clicks to resolve (state 4).
          </div>
        </aside>

        {/* Canvas */}
        <main className="bg-stone-100 p-8 overflow-y-auto">
          <div className="max-w-3xl mx-auto">
            <div className="mb-4">
              <div className="text-xs text-gray-500 font-mono">
                state: <code>{activeKey}</code> · turns:{" "}
                <code>{fixture.turns.length}</code> · needsReply:{" "}
                <code>{String(fixture.needsReply)}</code>
              </div>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                {fixture.description}
              </p>
            </div>

            {/* Faux lesson tile shell — gives the bubble a response
                card to anchor its tail against. */}
            <div className="rounded-3xl bg-stone-50 border border-stone-200 p-6">
              <div className="text-[10px] font-bold tracking-wider uppercase text-purple-700 mb-2">
                Co-construct definition
              </div>
              <h2 className="text-xl font-extrabold text-gray-950 leading-tight max-w-2xl">
                In your own words: what does AGENCY mean for the next 7
                weeks of design?
              </h2>
              <div className="mt-1 w-12 h-1 rounded-full bg-purple-500" />

              {showResponseCard && (
                <div className="mt-5 rounded-2xl bg-white border border-stone-200 px-5 py-4">
                  <p className="text-sm text-gray-800 leading-relaxed">
                    Agency means doing what you choose. It's about being
                    independent and making your own decisions in design
                    class.
                  </p>
                  <div className="mt-3 pt-3 border-t border-stone-100 flex items-center justify-between text-[11px] text-gray-500">
                    <span>Submitted 4m ago · 24 words</span>
                    <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                      Saved
                    </span>
                  </div>
                </div>
              )}

              {/* The component under test */}
              <TeacherFeedback
                threadId={`sandbox-${activeKey}`}
                turns={fixture.turns}
                attentionGrab={
                  attentionGrab && activeKey === "fresh"
                }
                needsReply={fixture.needsReply}
                onReply={handleReply}
                onReopen={handleReopen}
              />
            </div>

            {/* Interaction log */}
            {interactions.length > 0 && (
              <div className="mt-6 rounded-2xl border border-gray-200 bg-white px-4 py-3">
                <div className="text-[10px] font-bold tracking-wider uppercase text-gray-400 mb-2">
                  Last interactions (sandbox only — not persisted)
                </div>
                <ul className="text-xs text-gray-700 font-mono space-y-1">
                  {interactions.map((i, idx) => (
                    <li key={idx}>
                      <span className="text-gray-400">
                        {i.ts.slice(11, 19)}
                      </span>{" "}
                      onReply(<strong>{i.sentiment}</strong>
                      {i.text ? `, "${i.text}"` : ""})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
