/**
 * ReplyBox — height-animated text-reply composer that opens below the
 * sentiment pills when the student picks `not_sure` or `pushback`.
 *
 * Designer spec (TFL.2 Pass A): 2px sentiment-coloured border, header
 * strip naming the sentiment, textarea, char counter, Cancel (ghost)
 * + Send reply (sentiment-fill). Send is disabled until ≥10 trimmed
 * chars; counter shows "N more characters" until the threshold.
 *
 * For `got_it` the parent skips the reply box entirely (single-click
 * resolves), so this component never renders for that sentiment.
 */

"use client";

import * as React from "react";
import type { Sentiment } from "./types";
import { REPLY_MIN_CHARS, SENTIMENT_LABELS } from "./types";
import { useCollapsible } from "./useCollapsible";

interface ReplyBoxProps {
  /** The sentiment that triggered the box. Drives header copy +
   *  border colour. Only `not_sure` and `pushback` ever reach here;
   *  `got_it` short-circuits in the parent. */
  sentiment: Sentiment;
  /** Open/close. Animation is height-only. */
  open: boolean;
  /** Sending state from the parent. While true, both buttons disable
   *  and the Send pill shows a spinner. */
  sending: boolean;
  /** Cancel — closes without sending. */
  onCancel: () => void;
  /** Send the reply. The parent persists; the box just calls back
   *  with the trimmed text. */
  onSend: (text: string) => void;
}

const SENTIMENT_TOKENS: Record<
  Sentiment,
  {
    border: string;
    headerBg: string;
    headerText: string;
    sendBg: string;
    sendHover: string;
    sendText: string;
    sendBorder: string;
    focusRing: string;
  }
> = {
  // got_it never reaches here — kept for type completeness.
  got_it: {
    border: "border-emerald-300",
    headerBg: "bg-emerald-50",
    headerText: "text-emerald-800",
    sendBg: "bg-emerald-500",
    sendHover: "hover:bg-emerald-600",
    sendText: "text-white",
    sendBorder: "border-emerald-600",
    focusRing: "focus:ring-emerald-500",
  },
  not_sure: {
    border: "border-amber-300",
    headerBg: "bg-amber-50",
    headerText: "text-amber-800",
    sendBg: "bg-amber-500",
    sendHover: "hover:bg-amber-600",
    sendText: "text-white",
    sendBorder: "border-amber-600",
    focusRing: "focus:ring-amber-500",
  },
  pushback: {
    border: "border-purple-300",
    headerBg: "bg-purple-50",
    headerText: "text-purple-800",
    sendBg: "bg-purple-600",
    sendHover: "hover:bg-purple-700",
    sendText: "text-white",
    sendBorder: "border-purple-700",
    focusRing: "focus:ring-purple-500",
  },
};

export function ReplyBox({
  sentiment,
  open,
  sending,
  onCancel,
  onSend,
}: ReplyBoxProps) {
  const [text, setText] = React.useState("");
  const tokens = SENTIMENT_TOKENS[sentiment];
  const trimmedLen = text.trim().length;
  const meetsMinimum = trimmedLen >= REPLY_MIN_CHARS;
  const remaining = Math.max(REPLY_MIN_CHARS - trimmedLen, 0);

  const { ref, height, transitionStyle } = useCollapsible(open);

  // When the box closes from outside (e.g. parent set open=false on
  // a sentiment switch), clear the draft so the next open is clean.
  React.useEffect(() => {
    if (!open) setText("");
  }, [open]);

  // Focus the textarea once the open transition settles.
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  React.useEffect(() => {
    if (!open) return;
    // Match the useCollapsible duration so focus lands AFTER the
    // height animation, not during.
    const t = setTimeout(() => textareaRef.current?.focus(), 340);
    return () => clearTimeout(t);
  }, [open]);

  function handleSend() {
    if (!meetsMinimum || sending) return;
    onSend(text.trim());
  }

  return (
    <div
      ref={ref}
      style={{ height, overflow: "hidden", transition: transitionStyle }}
      aria-hidden={!open}
    >
      <div
        className={[
          "mt-3 rounded-2xl border-2 overflow-hidden",
          tokens.border,
        ].join(" ")}
        data-testid="teacher-feedback-reply-box"
      >
        <div
          className={[
            "px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase",
            tokens.headerBg,
            tokens.headerText,
          ].join(" ")}
        >
          Replying as: {SENTIMENT_LABELS[sentiment]}
        </div>
        <div className="bg-white p-3 flex flex-col gap-2">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              sentiment === "not_sure"
                ? "What part is unclear? Where would you like more help?"
                : "What would you push back on, and why?"
            }
            rows={3}
            aria-required={true}
            aria-label={`Reply text for sentiment: ${SENTIMENT_LABELS[sentiment]}`}
            className={[
              "w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm leading-relaxed",
              "focus:outline-none focus:ring-2 focus:border-transparent",
              tokens.focusRing,
            ].join(" ")}
          />
          <div className="flex items-center justify-between gap-2">
            <span
              className={[
                "text-[11px] font-medium",
                meetsMinimum ? "text-gray-400" : tokens.headerText,
              ].join(" ")}
              aria-live="polite"
            >
              {meetsMinimum
                ? `${trimmedLen} characters`
                : `${remaining} more character${remaining === 1 ? "" : "s"}`}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={sending}
                className="px-3 py-1.5 text-xs font-bold rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="teacher-feedback-reply-send"
                onClick={handleSend}
                disabled={!meetsMinimum || sending}
                className={[
                  "px-3 py-1.5 text-xs font-bold rounded-md border transition",
                  meetsMinimum && !sending
                    ? `${tokens.sendBg} ${tokens.sendHover} ${tokens.sendText} ${tokens.sendBorder}`
                    : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed",
                ].join(" ")}
              >
                {sending ? "Sending…" : "Send reply"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
