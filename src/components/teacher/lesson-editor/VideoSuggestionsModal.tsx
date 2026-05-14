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
    [framing, task, success_signal, unitTitle, gradeLevel, excludedIds],
  );

  // Auto-run once when the modal opens.
  useEffect(() => {
    if (open && state.kind === "idle") {
      void run([]);
    }
    if (!open && state.kind !== "idle") {
      // Reset on close so reopening re-fetches with fresh state.
      setState({ kind: "idle" });
      setExcludedIds([]);
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="✨ Suggest videos"
      maxWidth="max-w-3xl"
    >
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
