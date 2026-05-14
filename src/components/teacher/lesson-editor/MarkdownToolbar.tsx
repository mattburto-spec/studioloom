"use client";

/**
 * MarkdownToolbar — small button bar for textareas whose content is
 * rendered through react-markdown.
 *
 * Wraps / prefixes the textarea's current selection with markdown
 * syntax that the existing renderer already allow-lists:
 *   - **bold**   → <strong>
 *   - *italic*   → <em>
 *   - - item     → <ul><li>
 *   - 1. item    → <ol><li>
 *   - [t](url)   → <a>
 *
 * Bound to a textarea via ref. Keeps the storage shape as plain
 * markdown text — no schema change, no new dependency.
 *
 * The pure text-manipulation helpers live in markdown-toolbar-helpers.ts
 * so unit tests (`.test.ts`) can import them without vite's
 * import-analyzer choking on this file's JSX.
 */

import { useCallback, type RefObject } from "react";
import {
  applyInlineWrap,
  applyLinePrefix,
  applyLink,
  type SelectionResult,
} from "./markdown-toolbar-helpers";

interface MarkdownToolbarProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string) => void;
}

export function MarkdownToolbar({
  textareaRef,
  value,
  onChange,
}: MarkdownToolbarProps) {
  const apply = useCallback(
    (
      transform: (v: string, start: number, end: number) => SelectionResult,
    ) => {
      const el = textareaRef.current;
      if (!el) return;
      const { selectionStart, selectionEnd } = el;
      const result = transform(value, selectionStart, selectionEnd);
      onChange(result.value);
      // Restore caret/selection after React re-renders the controlled value.
      requestAnimationFrame(() => {
        const current = textareaRef.current;
        if (!current) return;
        current.focus();
        current.setSelectionRange(
          result.selectionStart,
          result.selectionEnd,
        );
      });
    },
    [textareaRef, value, onChange],
  );

  const onBold = () =>
    apply((v, s, e) => applyInlineWrap(v, s, e, "**"));
  const onItalic = () =>
    apply((v, s, e) => applyInlineWrap(v, s, e, "*"));
  const onBulletList = () =>
    apply((v, s, e) => applyLinePrefix(v, s, e, () => "- "));
  const onNumberedList = () =>
    apply((v, s, e) => applyLinePrefix(v, s, e, (i) => `${i + 1}. `));
  const onLink = () => {
    // window.prompt is intentionally minimal — a richer URL picker can
    // come later. Cancelling the prompt is a no-op.
    const url =
      typeof window === "undefined"
        ? null
        : window.prompt("Link URL", "https://");
    if (!url) return;
    apply((v, s, e) => applyLink(v, s, e, url));
  };

  const btn =
    "h-6 min-w-[24px] px-1.5 rounded border border-[var(--le-hair)] bg-[var(--le-paper)] text-[var(--le-ink-2)] hover:bg-[var(--le-bg)] hover:border-[var(--le-ink-3)] hover:text-[var(--le-ink)] transition-colors text-[11px] font-bold flex items-center justify-center";

  return (
    <div
      className="flex items-center gap-1 mb-1"
      role="toolbar"
      aria-label="Formatting toolbar"
    >
      <button
        type="button"
        onClick={onBold}
        title="Bold"
        aria-label="Bold"
        className={btn}
      >
        <span className="font-extrabold">B</span>
      </button>
      <button
        type="button"
        onClick={onItalic}
        title="Italic"
        aria-label="Italic"
        className={btn}
      >
        <span className="italic">I</span>
      </button>
      <span className="w-px h-4 bg-[var(--le-hair)] mx-0.5" aria-hidden />
      <button
        type="button"
        onClick={onBulletList}
        title="Bulleted list"
        aria-label="Bulleted list"
        className={btn}
      >
        •
      </button>
      <button
        type="button"
        onClick={onNumberedList}
        title="Numbered list"
        aria-label="Numbered list"
        className={btn}
      >
        <span className="le-tnum">1.</span>
      </button>
      <span className="w-px h-4 bg-[var(--le-hair)] mx-0.5" aria-hidden />
      <button
        type="button"
        onClick={onLink}
        title="Link"
        aria-label="Insert link"
        className={btn}
      >
        🔗
      </button>
      <span className="ml-auto text-[10px] text-[var(--le-ink-3)] italic">
        Markdown: <strong className="not-italic">**bold**</strong> ·{" "}
        <em>*italic*</em> · - list
      </span>
    </div>
  );
}
