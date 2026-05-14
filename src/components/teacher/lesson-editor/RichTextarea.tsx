"use client";

/**
 * RichTextarea — controlled <textarea> with a sibling MarkdownToolbar
 * that operates on the textarea's selection.
 *
 * Convenience wrapper: callers don't need to manage the ref or wire
 * the toolbar themselves. Drop it in anywhere a plain <textarea>
 * holds markdown content (lesson intro, callout bullets, prompt
 * slots etc.).
 *
 * The toolbar uses neutral lesson-editor tokens (--le-paper / --le-hair
 * etc.) so it sits cleanly above the textarea regardless of the
 * surrounding surface tint. If a caller needs to hide the toolbar
 * entirely, pass `showToolbar={false}`.
 */

import { useRef, type TextareaHTMLAttributes } from "react";
import { MarkdownToolbar } from "./MarkdownToolbar";

type PassthroughTextareaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "onChange" | "ref"
>;

interface RichTextareaProps extends PassthroughTextareaProps {
  value: string;
  onChange: (next: string) => void;
  /** Hide the toolbar — useful when a parent already shows formatting cues elsewhere. */
  showToolbar?: boolean;
  /** Optional container class for spacing between toolbar and textarea. */
  containerClassName?: string;
}

export function RichTextarea({
  value,
  onChange,
  showToolbar = true,
  containerClassName,
  ...textareaProps
}: RichTextareaProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  return (
    <div className={containerClassName}>
      {showToolbar && (
        <MarkdownToolbar
          textareaRef={ref}
          value={value}
          onChange={onChange}
        />
      )}
      <textarea
        {...textareaProps}
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
