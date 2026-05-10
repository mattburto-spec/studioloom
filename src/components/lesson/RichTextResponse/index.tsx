"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAutoSave } from "../shared";
import { useIntegrityTracking } from "@/hooks/useIntegrityTracking";
import type { IntegrityMetadata } from "@/components/student/MonitoredTextarea";
import { Toolbar, type ButtonId } from "./Toolbar";
import { ALLOWED_TAGS, type RichTextPrompt } from "./types";

export type { RichTextPrompt };

type Props = {
  // ── Controlled mode (used by ResponseInput auto-replace) ────────────
  /** HTML string. When provided alongside onChange, the parent owns the value and onSave/initialHTML are ignored. */
  value?: string;
  /** Called on every keystroke / format toggle / paste. Parent owns debounce/persistence. */
  onChange?: (html: string) => void;

  // ── Uncontrolled / autosave mode (storybook + standalone usage) ─────
  /** HTML string. Plain text is also valid input. Used when value is not provided. */
  initialHTML?: string;
  /** Called ~700ms after the last keystroke (debounced) — only fires in uncontrolled mode. */
  onSave?: (html: string) => void | Promise<void>;

  // ── Surface ─────────────────────────────────────────────────────────
  /** Prompt header (eyebrow + heading). Renders when standalone. Skip when embedded inside ResponseInput. */
  prompt?: RichTextPrompt;
  /** Placeholder shown when the editor is empty. Falls back to prompt.placeholder. */
  placeholder?: string;

  // ── Integrity monitoring (LIS.B port) ───────────────────────────────
  /** When true, paste/keystroke/focus/visibility events feed into IntegrityMetadata. Default false. */
  enableIntegrityMonitoring?: boolean;
  /** Receives the metadata object on debounced ticks + paste/blur. */
  onIntegrityUpdate?: (metadata: IntegrityMetadata) => void;

  // ── Portfolio toggle (default true when prompt provided, false when embedded) ──
  /** Show the "Send to Portfolio when submitted" checkbox. */
  portfolioToggle?: boolean;
  onPortfolioChange?: (sendToPortfolio: boolean) => void;
  initialPortfolio?: boolean;

  // ── Plumbing ────────────────────────────────────────────────────────
  id?: string;
  disabled?: boolean;
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
      const parent = el.parentNode;
      if (parent) {
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
      }
      return;
    }
    for (const attr of Array.from(el.attributes)) {
      el.removeAttribute(attr.name);
    }
    for (const child of Array.from(el.childNodes)) sanitizeNode(child);
  } else if (node.nodeType !== Node.TEXT_NODE) {
    node.parentNode?.removeChild(node);
  }
}

export function RichTextResponse({
  value,
  onChange,
  initialHTML = "",
  onSave,
  prompt,
  placeholder,
  enableIntegrityMonitoring = false,
  onIntegrityUpdate,
  portfolioToggle,
  onPortfolioChange,
  initialPortfolio = true,
  id,
  disabled = false,
  className = "",
}: Props) {
  const isControlled = value !== undefined && onChange !== undefined;
  // Default portfolio toggle = true for standalone (prompt provided), false for embedded.
  const showPortfolioToggle = portfolioToggle ?? !!prompt;

  const editorRef = useRef<HTMLDivElement | null>(null);
  const [internalHtml, setInternalHtml] = useState(isControlled ? value! : initialHTML);
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState<Partial<Record<ButtonId, boolean>>>({});
  const [sendToPortfolio, setSendToPortfolio] = useState(initialPortfolio);
  const lastSyncedRef = useRef<string>(isControlled ? value! : initialHTML);

  const html = isControlled ? value! : internalHtml;

  // Auto-save fires only in uncontrolled mode. In controlled mode the parent
  // owns the persistence path, so we no-op here.
  const { state: saveState } = useAutoSave({
    value: html,
    onSave: onSave ?? (() => {}),
    disabled: isControlled || !onSave,
  });

  // Integrity hook — reads textContent (plain text) on each notify.
  const integrity = useIntegrityTracking({
    enabled: enableIntegrityMonitoring,
    onIntegrityUpdate,
    getCombinedText: useCallback(() => editorRef.current?.textContent ?? "", []),
  });

  // ── DOM sync ───────────────────────────────────────────────────────────
  // On first mount, populate innerHTML from initial value. After that,
  // we sync from the prop ONLY when it differs from what we last emitted —
  // otherwise every keystroke that bubbles up to the parent and back would
  // steal the cursor.
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (html !== lastSyncedRef.current) {
      el.innerHTML = html ?? "";
      lastSyncedRef.current = html ?? "";
    }
  }, [html]);

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

  const emit = useCallback(
    (next: string) => {
      lastSyncedRef.current = next;
      if (isControlled) {
        onChange!(next);
      } else {
        setInternalHtml(next);
      }
    },
    [isControlled, onChange],
  );

  const emitFromDom = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    emit(el.innerHTML);
    refreshActiveStates();
  }, [emit, refreshActiveStates]);

  const onCommand = useCallback(
    (btn: ButtonId) => {
      if (disabled) return;
      editorRef.current?.focus();
      const cmd = COMMAND_MAP[btn];
      if (btn === "quote") {
        document.execCommand(cmd, false, "blockquote");
      } else {
        document.execCommand(cmd, false);
      }
      emitFromDom();
    },
    [disabled, emitFromDom],
  );

  const onPaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      // Sanitise: insert as plain text only — no foreign HTML, no styles.
      e.preventDefault();
      const text = e.clipboardData.getData("text/plain");
      document.execCommand("insertText", false, text);
      emitFromDom();
      // Forward to integrity tracker so it records the paste event.
      if (enableIntegrityMonitoring) {
        integrity.handlers.onPaste(e);
      }
    },
    [emitFromDom, enableIntegrityMonitoring, integrity.handlers],
  );

  const onInput = () => {
    const el = editorRef.current;
    if (!el) return;
    // Sanitise in-place — covers IME, drag-drop, and any rogue paste paths.
    for (const child of Array.from(el.childNodes)) sanitizeNode(child);
    emitFromDom();
  };

  const onKeyDownLocal = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (enableIntegrityMonitoring) integrity.handlers.onKeyDown(e);
    },
    [enableIntegrityMonitoring, integrity.handlers],
  );

  const onFocusLocal = useCallback(() => {
    setFocused(true);
    refreshActiveStates();
    if (enableIntegrityMonitoring) integrity.handlers.onFocus();
  }, [enableIntegrityMonitoring, integrity.handlers, refreshActiveStates]);

  const onBlurLocal = useCallback(() => {
    setFocused(false);
    if (enableIntegrityMonitoring) integrity.handlers.onBlur();
  }, [enableIntegrityMonitoring, integrity.handlers]);

  const togglePortfolio = (next: boolean) => {
    setSendToPortfolio(next);
    onPortfolioChange?.(next);
  };

  const effectivePlaceholder =
    placeholder ?? prompt?.placeholder ?? "Type your response here…";

  return (
    <div
      className={className}
      style={{ fontFamily: "var(--sl-font-sans)", color: "var(--sl-fg-body)" }}
    >
      {prompt && (
        <div className="mb-3">
          {prompt.eyebrow && (
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 800,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--sl-primary)",
                marginBottom: 6,
              }}
            >
              {prompt.eyebrow}
            </div>
          )}
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              lineHeight: 1.25,
              letterSpacing: "-0.01em",
              color: "var(--sl-fg-primary)",
            }}
          >
            {prompt.heading}
          </div>
        </div>
      )}

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
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <Toolbar onCommand={onCommand} saveState={saveState} active={active} />

        <div
          ref={editorRef}
          id={id}
          contentEditable={!disabled}
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label={prompt?.heading ?? "Response"}
          aria-disabled={disabled || undefined}
          data-ph={effectivePlaceholder}
          onInput={onInput}
          onPaste={onPaste}
          onKeyDown={onKeyDownLocal}
          onFocus={onFocusLocal}
          onBlur={onBlurLocal}
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

      {showPortfolioToggle && (
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
