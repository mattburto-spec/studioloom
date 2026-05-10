/**
 * Thread — multi-turn renderer.
 *
 * Designer spec (TFL.2 Pass A): when there's ≥1 student reply, the
 * single-bubble shape morphs into a "thread container" — outer
 * emerald border + mint header strip ("Feedback thread · N turns"),
 * each turn its own card stacked with 12px gap. Identity by colour +
 * indent rather than avatar column:
 *   - Teacher card : full-width, mint bg, emerald border @ 25%
 *   - Student card : indented 24px, lavender bg, purple border @ 25%
 *
 * New incoming teacher turns slide up from below + get a 1.4s
 * emerald-glow ring on first paint. We track "first paint" by
 * comparing turns[0..n] across renders — turns that were not in the
 * previous array are "new" and get the AnimatePresence glow.
 *
 * The latest turn's reply controls (QuickReplies / ReplyBox / sentiment
 * chip) live OUTSIDE this component — Thread renders only the historical
 * turns. Parent stitches the controls below.
 */

"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Turn, TeacherTurn, StudentTurn } from "./types";
import { SENTIMENT_LABELS } from "./types";

interface ThreadProps {
  turns: Turn[];
  /** Optional. Renders the title at the top of the thread container.
   *  Threading off when there's only 1 turn — the parent renders the
   *  single-bubble shape instead. */
  showHeader?: boolean;
}

function formatRelativeTime(iso: string): string {
  const sentMs = new Date(iso).getTime();
  const ageMs = Date.now() - sentMs;
  const min = Math.floor(ageMs / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

function teacherInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0]?.toUpperCase())
    .filter(Boolean)
    .slice(0, 2)
    .join("");
}

function TeacherCard({ turn }: { turn: TeacherTurn }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, boxShadow: "0 0 0 0 rgba(16,185,129,0)" }}
      animate={{
        opacity: 1,
        y: 0,
        boxShadow: [
          "0 0 0 0 rgba(16,185,129,0)",
          "0 0 0 4px rgba(16,185,129,0.25)",
          "0 0 0 0 rgba(16,185,129,0)",
        ],
      }}
      transition={{
        duration: 1.4,
        boxShadow: { duration: 1.4, times: [0, 0.4, 1] },
      }}
      data-testid="teacher-feedback-thread-turn-teacher"
      className="rounded-2xl border bg-emerald-50 border-emerald-500/25 px-4 py-3"
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-500 text-white font-bold text-[11px] flex items-center justify-center ring-2 ring-white shadow-[0_0_0_2px_rgba(16,185,129,0.2)]">
          {teacherInitials(turn.authorName)}
        </div>
        <span className="text-sm font-bold text-emerald-950">
          {turn.authorName}
        </span>
        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-extrabold tracking-wider uppercase">
          Teacher
        </span>
        <span className="text-[11px] text-gray-500">
          · {formatRelativeTime(turn.sentAt)}
          {turn.editedAt && (
            <span title={`Edited ${formatRelativeTime(turn.editedAt)}`}>
              {" "}
              (edited)
            </span>
          )}
        </span>
      </div>
      <div
        className="prose prose-sm max-w-none text-emerald-950 leading-relaxed [&_em]:text-emerald-900 [&_strong]:text-emerald-950"
        dangerouslySetInnerHTML={{ __html: turn.bodyHTML }}
      />
    </motion.div>
  );
}

const STUDENT_SENTIMENT_TONE: Record<
  StudentTurn["sentiment"],
  { chipBg: string; chipText: string }
> = {
  got_it: { chipBg: "bg-emerald-100", chipText: "text-emerald-800" },
  not_sure: { chipBg: "bg-amber-100", chipText: "text-amber-800" },
  pushback: { chipBg: "bg-purple-100", chipText: "text-purple-800" },
};

function StudentCard({ turn }: { turn: StudentTurn }) {
  const tokens = STUDENT_SENTIMENT_TONE[turn.sentiment];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      data-testid="teacher-feedback-thread-turn-student"
      className="ml-6 rounded-2xl border bg-purple-50 border-purple-500/25 px-4 py-3"
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-600 text-white font-bold text-[11px] flex items-center justify-center ring-2 ring-white">
          You
        </div>
        <span className="text-sm font-bold text-purple-950">You</span>
        <span
          className={[
            "inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold",
            tokens.chipBg,
            tokens.chipText,
          ].join(" ")}
        >
          {SENTIMENT_LABELS[turn.sentiment]}
        </span>
        <span className="text-[11px] text-gray-500">
          · {formatRelativeTime(turn.sentAt)}
        </span>
      </div>
      {turn.text && (
        <p className="text-sm text-purple-950 leading-relaxed whitespace-pre-wrap">
          {turn.text}
        </p>
      )}
    </motion.div>
  );
}

export function Thread({ turns, showHeader = true }: ThreadProps) {
  return (
    <div
      data-testid="teacher-feedback-thread"
      className="rounded-3xl border-2 border-emerald-500 bg-white overflow-hidden"
    >
      {showHeader && (
        <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-500/25 text-[11px] font-bold tracking-wider uppercase text-emerald-800">
          Feedback thread · {turns.length} turn{turns.length === 1 ? "" : "s"}
        </div>
      )}
      <div className="p-4 flex flex-col gap-3">
        <AnimatePresence initial={false}>
          {turns.map((turn) =>
            turn.role === "teacher" ? (
              <TeacherCard key={turn.id} turn={turn} />
            ) : (
              <StudentCard key={turn.id} turn={turn} />
            ),
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
