"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

/**
 * RichTextEditor — contenteditable-based input with a working bold / italic /
 * bulleted / numbered toolbar. Replaces the earlier markdown-syntax approach
 * (which surfaced literal `**word**` to students). Now the formatting renders
 * inline and the storage value is HTML.
 *
 * Design decisions:
 *   - Storage is HTML (e.g. "Hello <b>world</b>"). Plain-text legacy values
 *     render unchanged because contenteditable shows text-only strings as
 *     text. Display surfaces opt into HTML rendering by checking the value
 *     for tags.
 *   - Uses document.execCommand for formatting. Yes, deprecated — but
 *     unanimously supported across browsers and there's no replacement API
 *     for "toggle bold on the current selection" yet.
 *   - Toolbar fires onMouseDown preventDefault to keep selection intact when
 *     buttons are clicked. execCommand fires a regular input event which
 *     onInput captures, so onChange flows naturally.
 *   - text-base (16px) by default — students reported the previous text-sm
 *     (14px) was too small.
 *
 * Integrity-tracking parents (MonitoredTextarea) wire their existing paste /
 * keydown / focus / blur handlers via the props below. The handlers fire on
 * the contenteditable element same as they did on textarea.
 */

interface RichTextEditorProps {
  id?: string;
  /** HTML string. Plain text without tags is also valid. */
  value: string;
  onChange: (html: string) => void;
  onPaste?: (e: React.ClipboardEvent<HTMLDivElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLDivElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLDivElement>) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  disabled?: boolean;
  /** Hide the format toolbar (e.g. for read-only display). */
  hideToolbar?: boolean;
}

export interface RichTextEditorHandle {
  focus: () => void;
  /** Plain text content (HTML stripped) — useful for character counts. */
  getTextContent: () => string;
  /** Underlying contenteditable element (for measurement / scroll). */
  getElement: () => HTMLDivElement | null;
}

export const RichTextEditor = forwardRef<
  RichTextEditorHandle,
  RichTextEditorProps
>(function RichTextEditor(
  {
    id,
    value,
    onChange,
    onPaste,
    onKeyDown,
    onFocus,
    onBlur,
    placeholder = "Type your response here...",
    rows = 4,
    className = "",
    disabled = false,
    hideToolbar = false,
  },
  ref
) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastEmittedRef = useRef<string>(value);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => editorRef.current?.focus(),
      getTextContent: () => editorRef.current?.textContent ?? "",
      getElement: () => editorRef.current,
    }),
    []
  );

  // Sync incoming value into innerHTML when it changes from outside (e.g. a
  // sentence-starter button writes new text). Don't sync when the prop matches
  // what we just emitted — that would steal the cursor on every keystroke.
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (value !== lastEmittedRef.current) {
      if (el.innerHTML !== value) {
        el.innerHTML = value || "";
      }
      lastEmittedRef.current = value;
    }
  }, [value]);

  const handleInput = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const html = el.innerHTML;
    lastEmittedRef.current = html;
    onChange(html);
  }, [onChange]);

  const applyFormat = useCallback(
    (command: "bold" | "italic" | "insertUnorderedList" | "insertOrderedList") => {
      const el = editorRef.current;
      if (!el) return;
      // Make sure focus is in the editor so execCommand operates on the right
      // selection. If the editor lost focus when the toolbar button took
      // focus (which we prevent via onMouseDown), re-focus defensively.
      if (document.activeElement !== el) {
        el.focus();
      }
      try {
        // eslint-disable-next-line deprecation/deprecation
        document.execCommand(command, false);
      } catch {
        // Some browsers throw on insertOrderedList in certain edge cases;
        // swallow and let the user re-try.
      }
      // execCommand fires an input event automatically — onInput will pick it
      // up and call onChange. No manual sync needed.
    },
    []
  );

  // rows × line-height (1.5em) + vertical padding. This mirrors the old
  // textarea sizing closely enough that lessons don't reflow when switching.
  const minHeight = `${rows * 1.6 + 1}em`;

  const baseClass =
    "w-full px-4 py-3 border border-border rounded-b-lg bg-white focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent text-base leading-relaxed";
  const finalClass = className ? `${baseClass} ${className}` : baseClass;

  return (
    <div>
      {/* Inline placeholder style — scoped to this editor by id so it doesn't
          leak. Browsers don't support a native :placeholder selector for
          contenteditable, so we use the "empty + data-placeholder" pattern. */}
      <style>{`
        [data-rt-empty="true"]::before {
          content: attr(data-placeholder);
          color: #9CA3AF;
          pointer-events: none;
          display: block;
        }
        [data-rt-editor] ul { list-style: disc; padding-left: 1.5em; margin: 0.25em 0; }
        [data-rt-editor] ol { list-style: decimal; padding-left: 1.5em; margin: 0.25em 0; }
        [data-rt-editor] li { margin: 0.1em 0; }
        [data-rt-editor] b, [data-rt-editor] strong { font-weight: 700; }
        [data-rt-editor] i, [data-rt-editor] em { font-style: italic; }
      `}</style>

      {!hideToolbar && !disabled && (
        <div
          role="toolbar"
          aria-label="Text formatting"
          className="flex items-center gap-1 px-2 py-1 border border-b-0 border-border rounded-t-lg bg-gray-50"
        >
          <ToolbarButton onClick={() => applyFormat("bold")} title="Bold (Ctrl/Cmd+B)" ariaLabel="Bold">
            <span className="font-bold text-base">B</span>
          </ToolbarButton>
          <ToolbarButton onClick={() => applyFormat("italic")} title="Italic (Ctrl/Cmd+I)" ariaLabel="Italic">
            <span className="italic text-base">I</span>
          </ToolbarButton>
          <span className="w-px h-5 mx-1 bg-gray-300" aria-hidden />
          <ToolbarButton onClick={() => applyFormat("insertUnorderedList")} title="Bulleted list" ariaLabel="Bulleted list">
            <BulletIcon />
          </ToolbarButton>
          <ToolbarButton onClick={() => applyFormat("insertOrderedList")} title="Numbered list" ariaLabel="Numbered list">
            <NumberedIcon />
          </ToolbarButton>
        </div>
      )}

      <div
        ref={editorRef}
        id={id}
        data-rt-editor=""
        data-rt-empty={!value || value === "" ? "true" : "false"}
        data-placeholder={placeholder}
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        onInput={(e) => {
          // Update empty-state attribute for placeholder visibility.
          const el = e.currentTarget;
          const isEmpty =
            !el.textContent || el.textContent.length === 0;
          el.setAttribute("data-rt-empty", isEmpty ? "true" : "false");
          handleInput();
        }}
        onPaste={onPaste}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
        className={`${finalClass} ${hideToolbar ? "rounded-lg" : ""}`}
        style={{ minHeight }}
      />
    </div>
  );
});

function ToolbarButton({
  onClick,
  title,
  ariaLabel,
  children,
}: {
  onClick: () => void;
  title: string;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault() /* keep selection */}
      onClick={onClick}
      aria-label={ariaLabel}
      title={title}
      className="flex items-center justify-center w-8 h-7 rounded text-gray-700 hover:bg-gray-200 hover:text-gray-900 transition-colors"
    >
      {children}
    </button>
  );
}

function BulletIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="9" y1="6" x2="20" y2="6" />
      <line x1="9" y1="12" x2="20" y2="12" />
      <line x1="9" y1="18" x2="20" y2="18" />
      <circle cx="4.5" cy="6" r="1.5" fill="currentColor" />
      <circle cx="4.5" cy="12" r="1.5" fill="currentColor" />
      <circle cx="4.5" cy="18" r="1.5" fill="currentColor" />
    </svg>
  );
}

function NumberedIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="10" y1="6" x2="20" y2="6" />
      <line x1="10" y1="12" x2="20" y2="12" />
      <line x1="10" y1="18" x2="20" y2="18" />
      <text x="2" y="9" fontSize="7" fill="currentColor" stroke="none" fontFamily="ui-sans-serif, system-ui, sans-serif" fontWeight="700">1</text>
      <text x="2" y="15" fontSize="7" fill="currentColor" stroke="none" fontFamily="ui-sans-serif, system-ui, sans-serif" fontWeight="700">2</text>
      <text x="2" y="21" fontSize="7" fill="currentColor" stroke="none" fontFamily="ui-sans-serif, system-ui, sans-serif" fontWeight="700">3</text>
    </svg>
  );
}

/**
 * Detect whether a stored response string contains HTML markup. Used by
 * display surfaces to decide between dangerouslySetInnerHTML and plain
 * text rendering. Conservative: only matches recognized inline tags so a
 * student who types "<3" doesn't get treated as HTML.
 */
export function looksLikeRichText(value: string): boolean {
  if (!value) return false;
  return /<\/?(b|strong|i|em|u|ul|ol|li|p|br|div|span)\b[^>]*>/i.test(value);
}
