"use client";

import type { RefObject } from "react";

/**
 * MarkdownToolbar — small inline toolbar that renders above a <textarea>
 * and inserts markdown syntax around the current selection (or current line
 * for list items). Keeps the textarea focused and restores selection after
 * each insert so students can keep typing without re-clicking the input.
 *
 * Surfaces:
 *   - Bold:    wraps **selected** with **
 *   - Italic:  wraps *selected* with *
 *   - Bullet:  prefixes the current line(s) with "- "
 *   - Numbered: prefixes the current line(s) with "1. " / "2. " / ...
 *
 * The textarea value stays plain text + markdown — no rich-text editor,
 * no contenteditable. Display surfaces that already render markdown
 * (MarkdownPrompt) will format it; raw-text surfaces will show the
 * markdown syntax inline. That's an acceptable tradeoff for a quick win;
 * a full WYSIWYG migration is out of scope.
 */

type Format = "bold" | "italic" | "bullet" | "numbered";

interface MarkdownToolbarProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (value: string) => void;
}

interface FormatResult {
  newValue: string;
  newSelStart: number;
  newSelEnd: number;
}

function applyFormat(value: string, selStart: number, selEnd: number, format: Format): FormatResult {
  const before = value.slice(0, selStart);
  const selected = value.slice(selStart, selEnd);
  const after = value.slice(selEnd);

  if (format === "bold") {
    if (selected) {
      return {
        newValue: `${before}**${selected}**${after}`,
        newSelStart: selStart + 2,
        newSelEnd: selEnd + 2,
      };
    }
    return {
      newValue: `${before}****${after}`,
      newSelStart: selStart + 2,
      newSelEnd: selStart + 2,
    };
  }

  if (format === "italic") {
    if (selected) {
      return {
        newValue: `${before}*${selected}*${after}`,
        newSelStart: selStart + 1,
        newSelEnd: selEnd + 1,
      };
    }
    return {
      newValue: `${before}**${after}`,
      newSelStart: selStart + 1,
      newSelEnd: selStart + 1,
    };
  }

  // List formatting — operate on full lines covered by the selection.
  // Find the start of the first line and the end of the last line
  // intersecting the selection.
  const lineStart = before.lastIndexOf("\n") + 1;
  const afterNewline = after.indexOf("\n");
  const lineEnd = afterNewline === -1 ? value.length : selEnd + afterNewline;
  const block = value.slice(lineStart, lineEnd);
  const lines = block.split("\n");

  let prefixed: string;
  if (format === "bullet") {
    prefixed = lines.map((line) => (line.length > 0 ? `- ${line}` : "- ")).join("\n");
  } else {
    // numbered
    prefixed = lines.map((line, i) => (line.length > 0 ? `${i + 1}. ${line}` : `${i + 1}. `)).join("\n");
  }

  const delta = prefixed.length - block.length;
  return {
    newValue: value.slice(0, lineStart) + prefixed + value.slice(lineEnd),
    newSelStart: selStart + (format === "bullet" ? 2 : 3),
    newSelEnd: selEnd + delta,
  };
}

export function MarkdownToolbar({ textareaRef, value, onChange }: MarkdownToolbarProps) {
  function handleClick(format: Format) {
    const ta = textareaRef.current;
    if (!ta) return;
    const selStart = ta.selectionStart;
    const selEnd = ta.selectionEnd;
    const { newValue, newSelStart, newSelEnd } = applyFormat(value, selStart, selEnd, format);
    onChange(newValue);
    // Restore focus + selection on the next tick (after React has re-rendered).
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(newSelStart, newSelEnd);
    });
  }

  return (
    <div
      className="flex items-center gap-1 px-1 py-1 mb-1 rounded-md"
      style={{ background: "transparent" }}
      role="toolbar"
      aria-label="Text formatting"
    >
      <ToolbarButton onClick={() => handleClick("bold")} ariaLabel="Bold" title="Bold (Markdown: **text**)">
        <span className="font-bold">B</span>
      </ToolbarButton>
      <ToolbarButton onClick={() => handleClick("italic")} ariaLabel="Italic" title="Italic (Markdown: *text*)">
        <span className="italic">I</span>
      </ToolbarButton>
      <span className="w-px h-4 mx-1" style={{ background: "#D1D5DB" }} aria-hidden />
      <ToolbarButton onClick={() => handleClick("bullet")} ariaLabel="Bulleted list" title="Bulleted list">
        <BulletIcon />
      </ToolbarButton>
      <ToolbarButton onClick={() => handleClick("numbered")} ariaLabel="Numbered list" title="Numbered list">
        <NumberedIcon />
      </ToolbarButton>
      <span className="ml-auto text-[10px] text-gray-400 select-none">Markdown</span>
    </div>
  );
}

function ToolbarButton({
  onClick,
  ariaLabel,
  title,
  children,
}: {
  onClick: () => void;
  ariaLabel: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault() /* keep textarea selection */}
      onClick={onClick}
      aria-label={ariaLabel}
      title={title}
      className="flex items-center justify-center w-7 h-7 rounded text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
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
