"use client";

/**
 * PortfolioCaptureAffordance — subtle on-hover "Send to Portfolio"
 * action for any non-empty student response.
 *
 * Round 14 (6 May 2026). Per Matt: "there should be a 'send to
 * portfolio' for all blocks in a lesson... dont want it to be too
 * obvious as i dont want 'send to portfolio' buttons all through the
 * lesson page — more of a mouseover on that section and you can see
 * the option appear in a subtle way."
 *
 * Visibility rules (caller decides; this component just renders):
 *   - Hidden by default (opacity-0)
 *   - Shown on hover via `group-hover:opacity-100` from the ancestor's
 *     `group` class (set the ResponseInput wrapper to `group`)
 *   - Disabled when value is empty (still visible on hover, but greyed)
 *   - Caller skips rendering for:
 *       responseType === 'structured-prompts' (has its own Save flow)
 *       section.portfolioCapture === true        (auto-captures already)
 *       no responseType (content-only block)
 *
 * Persistence:
 *   POST /api/student/portfolio with type='auto', content, mediaUrl
 *   (when value is JSON-encoded upload), pageId, sectionIndex.
 *   Same endpoint StructuredPromptsResponse uses, so the entry shows
 *   up in the Portfolio panel + Narrative aggregator (round 5/10
 *   filter keeps auto entries with content or media_url).
 *
 * Idempotent — portfolio_entries is upsert-keyed on
 * (student_id, unit_id, page_id, section_index), so subsequent sends
 * for the same section update the existing row rather than spawning
 * duplicates.
 */

import { useState } from "react";

interface PortfolioCaptureAffordanceProps {
  unitId: string;
  pageId: string;
  sectionIndex: number;
  /** Raw response value. May be string OR JSON-encoded payload (upload/link/canvas/etc.) */
  value: string;
  /**
   * Round 15 (6 May 2026) — bypass-debounce save of the same value
   * to the lesson's student_progress.responses. Without this, the
   * "Send to Portfolio" click writes only to portfolio_entries but
   * the autosave for student_progress hasn't fired yet (2s debounce),
   * so the Narrative aggregator (which reads from
   * student_progress.responses) shows nothing for this section.
   * Calling this in parallel with the portfolio POST locks both
   * surfaces in sync.
   *
   * Optional + best-effort — if it throws, we continue with the
   * portfolio POST so the Portfolio panel still gets the entry.
   */
  onSaveResponseImmediate?: (value: string) => Promise<void>;
}

export function PortfolioCaptureAffordance({
  unitId,
  pageId,
  sectionIndex,
  value,
  onSaveResponseImmediate,
}: PortfolioCaptureAffordanceProps) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Empty values can't be captured.
  const isEmpty = !value || (typeof value === "string" && value.trim() === "");

  async function handleSend() {
    if (isEmpty || status === "sending") return;
    setStatus("sending");
    setErrorMsg(null);

    // Round 15 — fire the lesson-progress immediate save FIRST and in
    // parallel with the portfolio POST. The lesson save is what the
    // Narrative aggregator reads; without this, narrative shows the
    // section as empty until the (separately-debounced) autosave fires.
    // Best-effort: if it throws, log and continue so the Portfolio
    // panel still gets the entry.
    let lessonSavePromise: Promise<void> = Promise.resolve();
    if (onSaveResponseImmediate) {
      lessonSavePromise = onSaveResponseImmediate(value).catch((err) => {
        console.warn(
          "[portfolio-capture] lesson-progress immediate save failed; portfolio POST will still fire",
          err
        );
      });
    }

    // Try to detect upload-style JSON values so we extract media_url
    // properly. Otherwise treat the whole value as plain content.
    let content: string | undefined = value;
    let mediaUrl: string | undefined;
    if (typeof value === "string" && (value.startsWith("{") || value.startsWith("["))) {
      try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === "object") {
          if (parsed.type === "upload" && parsed.url) {
            mediaUrl = parsed.url as string;
            // Keep filename/caption as content if present
            content = parsed.filename || parsed.caption || undefined;
          } else if (parsed.type === "link" && parsed.url) {
            // Links handled by the existing portfolio link path; we
            // don't have linkUrl in this surface — pass through as
            // content for now.
            content = `${parsed.title || parsed.url}\n${parsed.url}`;
          }
        }
      } catch {
        // not JSON — fall through to plain content
      }
    }

    try {
      const res = await fetch("/api/student/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unitId,
          type: "auto",
          content,
          mediaUrl,
          pageId,
          sectionIndex,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      // Wait for the lesson-progress save to settle so the user can
      // confidently open Narrative and see their entry rendered.
      await lessonSavePromise;
      setStatus("sent");
      setTimeout(() => setStatus("idle"), 2400);
    } catch (err) {
      setStatus("error");
      setErrorMsg(
        err instanceof Error ? err.message : "Couldn't send. Try again."
      );
      setTimeout(() => {
        setStatus("idle");
        setErrorMsg(null);
      }, 3500);
    }
  }

  // Subtle: opacity-0 by default, group-hover from the ancestor lifts
  // it to 70%. Sent / error states pin to full opacity so feedback
  // doesn't disappear when the mouse leaves.
  const visibilityClass =
    status === "sent" || status === "error"
      ? "opacity-100"
      : "opacity-0 group-hover:opacity-70 focus-within:opacity-100";

  if (status === "sent") {
    return (
      <span
        className={`inline-flex items-center gap-1 text-[10.5px] text-emerald-700 font-semibold transition-opacity ${visibilityClass}`}
        data-testid="portfolio-capture-toast"
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
        Sent to Portfolio
      </span>
    );
  }

  if (status === "error") {
    return (
      <span
        className={`inline-flex items-center gap-1 text-[10.5px] text-rose-700 transition-opacity ${visibilityClass}`}
        title={errorMsg ?? "Save failed"}
        data-testid="portfolio-capture-error"
      >
        ⚠ {errorMsg}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleSend}
      disabled={isEmpty || status === "sending"}
      title={
        isEmpty
          ? "Write a response first"
          : "Save this response to your Portfolio"
      }
      className={
        "inline-flex items-center gap-1 text-[10.5px] text-gray-500 hover:text-violet-700 hover:opacity-100 transition-opacity disabled:cursor-not-allowed disabled:hover:text-gray-400 " +
        visibilityClass
      }
      data-testid="portfolio-capture-affordance"
    >
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
      {status === "sending" ? "Sending…" : "Send to Portfolio"}
    </button>
  );
}
