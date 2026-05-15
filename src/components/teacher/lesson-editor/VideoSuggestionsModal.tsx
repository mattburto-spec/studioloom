"use client";

/**
 * VideoSuggestionsModal — calls POST /api/teacher/suggest-videos with
 * the activity block's slot context, renders up to 3 video cards with
 * embedded previews, and writes the chosen URL back to `activity.media`.
 *
 * The route returns { candidates: VideoCandidate[], note?: string }.
 * Empty candidates is a non-error empty state (route already filters
 * for embeddable + safe + on-topic). Failure modes:
 *   - 503: YOUTUBE_API_KEY unset → "feature not configured" copy
 *   - 429: budget cap → "try again tomorrow" copy
 *   - 502 / other: generic try-again copy
 *
 * Sub-phase 2 of the AI video suggestions feature. Brief: docs/projects/
 * ai-video-suggestions-brief.md. Sub-phase 1 (backend) merged in #281.
 */

import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { toEmbedUrl } from "@/lib/video-embed";
import type { ActivityMedia } from "@/types";

interface VideoCandidate {
  videoId: string;
  url: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  durationSeconds: number;
  caption: string;
}

interface SuggestVideosResponse {
  candidates: VideoCandidate[];
  note?: string;
}

export interface VideoSuggestionsModalProps {
  open: boolean;
  onClose: () => void;
  /** Called with the chosen media payload — caller patches activity.media. */
  onAttach: (media: ActivityMedia) => void;
  /** Activity block slot fields — at least one of framing/task/success/unit must be set. */
  framing?: string;
  task?: string;
  success_signal?: string;
  unitTitle?: string;
  gradeLevel?: string;
}

type DurationBucket = "short" | "medium" | "long" | "any";
type SuggestionCount = 3 | 5 | 10;

type FetchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; candidates: VideoCandidate[]; note?: string }
  | { kind: "error"; status?: number; message: string };

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m} min`;
  return `${m} min ${s}s`;
}

const DURATION_PILLS: { value: DurationBucket; label: string; hint: string }[] = [
  { value: "short", label: "Short", hint: "< 4 min" },
  { value: "medium", label: "Medium", hint: "4–20 min" },
  { value: "long", label: "Long", hint: "> 20 min" },
  { value: "any", label: "Any", hint: "no limit" },
];

const COUNT_OPTIONS: SuggestionCount[] = [3, 5, 10];

export function VideoSuggestionsModal({
  open,
  onClose,
  onAttach,
  framing,
  task,
  success_signal,
  unitTitle,
  gradeLevel,
}: VideoSuggestionsModalProps) {
  const [state, setState] = useState<FetchState>({ kind: "idle" });
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const [duration, setDuration] = useState<DurationBucket>("medium");
  const [count, setCount] = useState<SuggestionCount>(3);
  const [extraKeywords, setExtraKeywords] = useState("");
  const [excludeKeywords, setExcludeKeywords] = useState("");

  const run = useCallback(
    async (excludeOverride?: string[]) => {
      setState({ kind: "loading" });
      try {
        const res = await fetch("/api/teacher/suggest-videos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            framing,
            task,
            success_signal,
            unitTitle,
            gradeLevel,
            excludeVideoIds: excludeOverride ?? excludedIds,
            duration,
            count,
            extraKeywords: extraKeywords.trim() || undefined,
            excludeKeywords: excludeKeywords.trim() || undefined,
          }),
        });

        if (!res.ok) {
          if (res.status === 503) {
            setState({
              kind: "error",
              status: 503,
              message:
                "Video suggestions aren't configured yet — ask Matt to set YOUTUBE_API_KEY.",
            });
            return;
          }
          if (res.status === 429) {
            setState({
              kind: "error",
              status: 429,
              message:
                "Daily AI budget reached. Try again tomorrow, or paste a URL by hand.",
            });
            return;
          }
          if (res.status === 400) {
            setState({
              kind: "error",
              status: 400,
              message:
                "This block needs at least a framing, task, or unit title before we can suggest videos.",
            });
            return;
          }
          setState({
            kind: "error",
            status: res.status,
            message:
              "Video suggestions are temporarily unavailable. Try again in a moment.",
          });
          return;
        }

        const data = (await res.json()) as SuggestVideosResponse;
        setState({
          kind: "ok",
          candidates: data.candidates ?? [],
          note: data.note,
        });
      } catch (err) {
        setState({
          kind: "error",
          message:
            err instanceof Error
              ? `Network error: ${err.message}`
              : "Network error.",
        });
      }
    },
    [
      framing,
      task,
      success_signal,
      unitTitle,
      gradeLevel,
      excludedIds,
      duration,
      count,
      extraKeywords,
      excludeKeywords,
    ],
  );

  // Auto-run once when the modal opens. Resets when closed so reopening
  // re-fetches with current control values.
  useEffect(() => {
    if (open && state.kind === "idle") {
      void run([]);
    }
    if (!open && state.kind !== "idle") {
      setState({ kind: "idle" });
      setExcludedIds([]);
      // Controls are NOT reset — sticky across opens-within-session feels
      // natural (the teacher who wanted Short videos likely wants them
      // again next click). Closing the block / page is the natural reset.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleAttach = useCallback(
    (candidate: VideoCandidate) => {
      onAttach({ type: "video", url: candidate.url });
      onClose();
    },
    [onAttach, onClose],
  );

  const handleSuggestAgain = useCallback(() => {
    if (state.kind !== "ok") return;
    const newExcluded = [
      ...excludedIds,
      ...state.candidates.map((c) => c.videoId),
    ];
    setExcludedIds(newExcluded);
    void run(newExcluded);
  }, [state, excludedIds, run]);

  // Re-search reuses the current control values + accumulated exclude
  // IDs so successive clicks fan out instead of repeating. Used by the
  // "Search with these settings" button when the teacher tweaks
  // controls and wants a fresh result with the same exclude memory.
  const handleSearchAgain = useCallback(() => {
    void run(excludedIds);
  }, [excludedIds, run]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="✨ Suggest videos"
      maxWidth="max-w-3xl"
    >
      {/* Always-visible controls row — tweak then click "Search with
          these settings" to re-fetch. Defaults (Medium / 3 / no extras)
          mirror the original auto-run behaviour. */}
      <div className="mb-4 pb-3 border-b border-gray-100 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10.5px] font-bold uppercase tracking-wider text-gray-500 mb-1">
              Duration
            </label>
            <div className="flex gap-1 flex-wrap">
              {DURATION_PILLS.map((pill) => {
                const active = duration === pill.value;
                return (
                  <button
                    key={pill.value}
                    type="button"
                    onClick={() => setDuration(pill.value)}
                    title={pill.hint}
                    className={`px-2.5 py-1 rounded-full text-[11.5px] font-semibold border transition-colors ${
                      active
                        ? "bg-violet-600 text-white border-violet-600"
                        : "bg-white text-gray-700 border-gray-200 hover:border-violet-300"
                    }`}
                  >
                    {pill.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="block text-[10.5px] font-bold uppercase tracking-wider text-gray-500 mb-1">
              How many
            </label>
            <div className="flex gap-1">
              {COUNT_OPTIONS.map((n) => {
                const active = count === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCount(n)}
                    className={`px-3 py-1 rounded-full text-[11.5px] font-semibold border transition-colors ${
                      active
                        ? "bg-violet-600 text-white border-violet-600"
                        : "bg-white text-gray-700 border-gray-200 hover:border-violet-300"
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="suggest-extra-keywords"
              className="block text-[10.5px] font-bold uppercase tracking-wider text-gray-500 mb-1"
            >
              Extra keywords
            </label>
            <input
              id="suggest-extra-keywords"
              type="text"
              value={extraKeywords}
              onChange={(e) => setExtraKeywords(e.target.value)}
              placeholder="e.g. animation, primary school"
              className="w-full px-2.5 py-1.5 text-[12px] border border-gray-200 rounded bg-white text-gray-800 focus:outline-none focus:border-violet-400"
            />
          </div>
          <div>
            <label
              htmlFor="suggest-exclude-keywords"
              className="block text-[10.5px] font-bold uppercase tracking-wider text-gray-500 mb-1"
            >
              Exclude keywords
            </label>
            <input
              id="suggest-exclude-keywords"
              type="text"
              value={excludeKeywords}
              onChange={(e) => setExcludeKeywords(e.target.value)}
              placeholder="e.g. music, shorts"
              className="w-full px-2.5 py-1.5 text-[12px] border border-gray-200 rounded bg-white text-gray-800 focus:outline-none focus:border-violet-400"
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-[10.5px] text-[var(--le-ink-3)] italic">
            Defaults: Medium duration, 3 suggestions, no extra terms.
          </p>
          <button
            type="button"
            onClick={handleSearchAgain}
            disabled={state.kind === "loading"}
            className="px-3 py-1 text-[12px] font-bold text-violet-700 bg-violet-50 border border-violet-200 rounded hover:bg-violet-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Search with these settings
          </button>
        </div>
      </div>

      {state.kind === "loading" && (
        <div className="py-12 text-center">
          <div className="inline-block w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <p className="mt-3 text-[13px] text-[var(--le-ink-3)]">
            Searching YouTube and re-ranking for your activity…
          </p>
        </div>
      )}

      {state.kind === "error" && (
        <div className="py-8 text-center">
          <p className="text-[13px] text-rose-700">{state.message}</p>
          <button
            onClick={() => void run(excludedIds)}
            className="mt-4 px-3 py-1.5 text-[12px] font-semibold text-violet-700 hover:text-violet-900 underline"
          >
            Try again
          </button>
        </div>
      )}

      {state.kind === "ok" && state.candidates.length === 0 && (
        <div className="py-8 text-center">
          <p className="text-[13px] text-[var(--le-ink-3)]">
            {state.note ??
              "No matching videos surfaced. Try refining the activity prompt or paste a URL by hand."}
          </p>
        </div>
      )}

      {state.kind === "ok" && state.candidates.length > 0 && (
        <>
          <p className="text-[11.5px] text-[var(--le-ink-3)] mb-3">
            Pick one to attach. The URL goes into the block&apos;s media field — you
            can preview before publishing the lesson.
          </p>
          <div className="space-y-3">
            {state.candidates.map((c) => {
              const embedUrl = toEmbedUrl(c.url);
              return (
                <div
                  key={c.videoId}
                  className="flex gap-3 p-3 border border-[var(--le-hair)] rounded-lg bg-white"
                >
                  <div className="flex-shrink-0 w-48">
                    {embedUrl ? (
                      <div className="relative aspect-video w-full overflow-hidden rounded">
                        <iframe
                          src={embedUrl}
                          title={c.title}
                          className="absolute inset-0 w-full h-full border-0"
                          allow="encrypted-media; picture-in-picture"
                          referrerPolicy="strict-origin-when-cross-origin"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={c.thumbnail}
                        alt=""
                        className="w-full aspect-video object-cover rounded"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[13px] font-bold text-[var(--le-ink)] line-clamp-2">
                      {c.title}
                    </h3>
                    <p className="text-[11.5px] text-[var(--le-ink-3)] mt-0.5">
                      {c.channelTitle} · {formatDuration(c.durationSeconds)}
                    </p>
                    <p className="text-[12px] text-[var(--le-ink-2)] mt-2 italic">
                      “{c.caption}”
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      <button
                        onClick={() => handleAttach(c)}
                        className="px-3 py-1 text-[12px] font-bold bg-violet-600 text-white rounded hover:bg-violet-700 transition-colors"
                      >
                        Attach
                      </button>
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11.5px] text-[var(--le-ink-3)] hover:text-[var(--le-ink)] underline"
                      >
                        Open on YouTube
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-3 border-t border-[var(--le-hair)] flex items-center justify-between">
            <button
              onClick={handleSuggestAgain}
              className="text-[12px] font-semibold text-violet-700 hover:text-violet-900 underline"
            >
              ↻ Suggest different videos
            </button>
            <button
              onClick={onClose}
              className="text-[12px] text-[var(--le-ink-3)] hover:text-[var(--le-ink)]"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
