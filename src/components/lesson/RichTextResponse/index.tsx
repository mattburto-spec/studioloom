"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAutoSave } from "../shared";
import { Toolbar, type ButtonId } from "./Toolbar";
import { ALLOWED_TAGS, type RichTextPrompt } from "./types";

export type { RichTextPrompt };

type Props = {
  prompt: RichTextPrompt;
  /** HTML string. Plain text is also valid input. */
  initialHTML?: string;
  /** Called ~700ms after the last keystroke (debounced). */
  onSave: (html: string) => void | Promise<void>;
  /** Show "Send to Portfolio when submitted" checkbox. Default true. */
  portfolioToggle?: boolean;
  /** Called when the portfolio toggle is flipped. */
  onPortfolioChange?: (sendToPortfolio: boolean) => void;
  /** Initial state of the portfolio toggle. Default true. */
  initialPortfolio?: boolean;
  className?: string;
};

const COMMAND_MAP: Record<ButtonId, string> = {
  bold: "bold",
  italic: "italic",
  ul: "insertUnorderedList",
  ol: "insertOrderedList",
  quote: "formatBlock",
};

/**
 * Sanitises a fragment to the ALLOWED_TAGS whitelist by re-walking the DOM
 * tree and unwrapping anything else. Inline styles are stripped.
 */
function sanitizeNode(node: Node): void {
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as HTMLElement;
    const tag = el.tagName.toUpperCase();
    if (!(ALLOWED_TAGS as readonly string[]).includes(tag)) {
      // Unwrap unknown tags — keep their children, drop the element itself.
      const parent = el.parentNode;
      if (parent) {
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
      }
      return;
    }
    // Strip every attribute — we don't need any.
    for (const attr of Array.from(el.attributes)) {
      el.removeAttribute(attr.name);
    }
    // Recurse over a snapshot — sanitiseNode may mutate childNodes.
    for (const child of Array.from(el.childNodes)) sanitizeNode(child);
  } else if (node.nodeType !== Node.TEXT_NODE) {
    node.parentNode?.removeChild(node);
  }
}

export function RichTextResponse({
  prompt,
  initialHTML = "",
  onSave,
  portfolioToggle = true,
  onPortfolioChange,
  initialPortfolio = true,
  className = "",
}: Props) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [html, setHtml] = useState(initialHTML);
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState<Partial<Record<ButtonId, boolean>>>({});
  const [sendToPortfolio, setSendToPortfolio] = useState(initialPortfolio);

  const { state: saveState } = useAutoSave({ value: html, onSave });

  // One-way sync from prop on mount only — after that we own the DOM.
  useEffect(() => {
    if (editorRef.current && initialHTML && editorRef.current.innerHTML === "") {
      editorRef.current.innerHTML = initialHTML;
    }
  }, [initialHTML]);

  const refreshActiveStates = useCallback(() => {
    if (typeof document === "undefined") return;
    setActive({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      ul: document.queryCommandState("insertUnorderedList"),
      ol: document.queryCommandState("insertOrderedList"),
      quote: false,
    });
  }, []);

  const emitChange = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    setHtml(el.innerHTML);
    refreshActiveStates();
  }, [refreshActiveStates]);

  const onCommand = useCallback(
    (id: ButtonId) => {
      editorRef.current?.focus();
      const cmd = COMMAND_MAP[id];
      if (id === "quote") {
        document.execCommand(cmd, false, "blockquote");
      } else {
        document.execCommand(cmd, false);
      }
      emitChange();
    },
    [emitChange],
  );

  const onPaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      // Always paste as plain text — no foreign HTML, no styles.
      e.preventDefault();
      const text = e.clipboardData.getData("text/plain");
      document.execCommand("insertText", false, text);
      emitChange();
    },
    [emitChange],
  );

  const onInput = () => {
    const el = editorRef.current;
    if (!el) return;
    // Sanitise in-place — covers IME, drag-drop, and any rogue paste paths.
    for (const child of Array.from(el.childNodes)) sanitizeNode(child);
    emitChange();
  };

  const togglePortfolio = (next: boolean) => {
    setSendToPortfolio(next);
    onPortfolioChange?.(next);
  };

  return (
    <div
      className={className}
      style={{ fontFamily: "var(--sl-font-sans)", color: "var(--sl-fg-body)" }}
    >
      <div
        style={{
          background: "white",
          border: focused ? "1px solid #C4B5FD" : "1px solid #E5E7EB",
          borderRadius: "var(--sl-radius-2xl)",
          boxShadow: focused
            ? "0 4px 12px -4px rgba(147,51,234,0.18)"
            : "0 1px 2px rgba(15,14,12,0.04)",
          transition: "border-color 200ms ease, box-shadow 200ms ease",
          overflow: "hidden",
        }}
      >
        <Toolbar onCommand={onCommand} saveState={saveState} active={active} />

        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label={prompt.heading}
          data-ph={prompt.placeholder ?? ""}
          onInput={onInput}
          onPaste={onPaste}
          onFocus={() => {
            setFocused(true);
            refreshActiveStates();
          }}
          onBlur={() => setFocused(false)}
          onKeyUp={refreshActiveStates}
          onMouseUp={refreshActiveStates}
          style={{
            minHeight: 200,
            padding: "20px 22px",
            outline: 0,
            fontSize: 15,
            lineHeight: 1.6,
            color: "var(--sl-fg-primary)",
            caretColor: "var(--sl-primary)",
          }}
        />
      </div>

      <style>{`
        [data-ph]:empty:before {
          content: attr(data-ph);
          color: var(--sl-fg-secondary);
          pointer-events: none;
        }
        [contenteditable]::selection { background: #E9D5FF; }
        [contenteditable] blockquote {
          border-left: 3px solid var(--sl-primary);
          padding-left: 12px;
          margin: 8px 0;
          color: var(--sl-fg-body);
          font-style: italic;
        }
        [contenteditable] ul { padding-left: 22px; list-style: disc; margin: 4px 0; }
        [contenteditable] ol { padding-left: 22px; list-style: decimal; margin: 4px 0; }
      `}</style>

      {portfolioToggle && (
        <label
          className="mt-4 inline-flex items-center gap-2 cursor-pointer"
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "var(--sl-fg-body)",
          }}
        >
          <input
            type="checkbox"
            checked={sendToPortfolio}
            onChange={(e) => togglePortfolio(e.target.checked)}
            style={{
              width: 16,
              height: 16,
              accentColor: "var(--sl-primary)",
              cursor: "pointer",
            }}
          />
          Send to Portfolio when submitted
        </label>
      )}
    </div>
  );
}
