/**
 * MarkdownToolbar — pure-helper unit tests + source-static wiring
 * check.
 *
 * The pure helpers do the actual text manipulation, so they're worth
 * testing in isolation (no React, no DOM, no jsdom). The source-static
 * block at the bottom mirrors the LIS.D convention used elsewhere in
 * this directory — catches accidental disconnect between the toolbar
 * component and SlotFieldEditor.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  applyInlineWrap,
  applyLinePrefix,
  applyLink,
} from "../markdown-toolbar-helpers";

describe("applyInlineWrap", () => {
  it("wraps a non-empty selection with the marker on both sides", () => {
    const r = applyInlineWrap("the quick fox", 4, 9, "**");
    expect(r.value).toBe("the **quick** fox");
    // Selection should grow to span the original word — bold + italic
    // chaining feels natural that way.
    expect(r.selectionStart).toBe(6);
    expect(r.selectionEnd).toBe(11);
  });

  it("uses italic marker correctly (single asterisk)", () => {
    const r = applyInlineWrap("hello world", 6, 11, "*");
    expect(r.value).toBe("hello *world*");
    expect(r.selectionStart).toBe(7);
    expect(r.selectionEnd).toBe(12);
  });

  it("inserts double markers with caret between when no selection", () => {
    const r = applyInlineWrap("abc", 1, 1, "**");
    expect(r.value).toBe("a****bc");
    expect(r.selectionStart).toBe(3);
    expect(r.selectionEnd).toBe(3);
  });

  it("handles selection at the start of the string", () => {
    const r = applyInlineWrap("foo bar", 0, 3, "**");
    expect(r.value).toBe("**foo** bar");
    expect(r.selectionStart).toBe(2);
    expect(r.selectionEnd).toBe(5);
  });

  it("handles selection at the end of the string", () => {
    const r = applyInlineWrap("foo bar", 4, 7, "**");
    expect(r.value).toBe("foo **bar**");
    expect(r.selectionStart).toBe(6);
    expect(r.selectionEnd).toBe(9);
  });

  it("handles empty input string with no selection", () => {
    const r = applyInlineWrap("", 0, 0, "*");
    expect(r.value).toBe("**");
    expect(r.selectionStart).toBe(1);
    expect(r.selectionEnd).toBe(1);
  });
});

describe("applyLinePrefix", () => {
  it("prefixes a single line when the selection sits inside it", () => {
    const r = applyLinePrefix("just one line", 3, 3, () => "- ");
    expect(r.value).toBe("- just one line");
    expect(r.selectionStart).toBe(0);
    expect(r.selectionEnd).toBe("- just one line".length);
  });

  it("prefixes every line touched by a multi-line selection", () => {
    const text = "alpha\nbeta\ngamma";
    // Selection from inside "alpha" to inside "gamma"
    const r = applyLinePrefix(text, 2, 13, () => "- ");
    expect(r.value).toBe("- alpha\n- beta\n- gamma");
    expect(r.selectionStart).toBe(0);
    expect(r.selectionEnd).toBe(r.value.length);
  });

  it("numbers lines sequentially when prefixFn uses index", () => {
    const text = "first\nsecond\nthird";
    const r = applyLinePrefix(text, 0, text.length, (i) => `${i + 1}. `);
    expect(r.value).toBe("1. first\n2. second\n3. third");
  });

  it("only prefixes the line containing the caret when no selection", () => {
    const text = "line one\nline two\nline three";
    // Caret on "line two" (anywhere inside it)
    const caret = text.indexOf("two") + 1;
    const r = applyLinePrefix(text, caret, caret, () => "- ");
    expect(r.value).toBe("line one\n- line two\nline three");
  });

  it("handles end-of-buffer selection without trailing newline", () => {
    const text = "alpha\nbeta";
    const r = applyLinePrefix(text, 6, 10, () => "- ");
    expect(r.value).toBe("alpha\n- beta");
  });
});

describe("applyLink", () => {
  it("wraps a selection as [text](url) and parks caret after the link", () => {
    const r = applyLink("see foo here", 4, 7, "https://example.com");
    expect(r.value).toBe("see [foo](https://example.com) here");
    // Caret should land just after the closing paren
    expect(r.selectionStart).toBe("see [foo](https://example.com)".length);
    expect(r.selectionEnd).toBe(r.selectionStart);
  });

  it("inserts a placeholder when there's no selection and highlights it", () => {
    const r = applyLink("here ", 5, 5, "https://example.com");
    expect(r.value).toBe("here [link text](https://example.com)");
    // Placeholder should be selected so overtype replaces it
    expect(r.value.slice(r.selectionStart, r.selectionEnd)).toBe("link text");
  });

  it("handles empty input + no selection", () => {
    const r = applyLink("", 0, 0, "https://example.com");
    expect(r.value).toBe("[link text](https://example.com)");
    expect(r.value.slice(r.selectionStart, r.selectionEnd)).toBe("link text");
  });
});

// ─── Source-static wiring (LIS.D pattern) ─────────────────────────────

const TOOLBAR_SRC = readFileSync(
  join(__dirname, "..", "MarkdownToolbar.tsx"),
  "utf-8",
);

const SLOT_EDITOR_SRC = readFileSync(
  join(__dirname, "..", "SlotFieldEditor.tsx"),
  "utf-8",
);

describe("MarkdownToolbar — toolbar surface", () => {
  it("exposes bold, italic, bulleted list, numbered list, and link buttons", () => {
    // The 5 toolbar transforms — one for each pedagogically-allowed
    // markdown form (matches MarkdownPrompt's allowedElements).
    expect(TOOLBAR_SRC).toContain('aria-label="Bold"');
    expect(TOOLBAR_SRC).toContain('aria-label="Italic"');
    expect(TOOLBAR_SRC).toContain('aria-label="Bulleted list"');
    expect(TOOLBAR_SRC).toContain('aria-label="Numbered list"');
    expect(TOOLBAR_SRC).toContain('aria-label="Insert link"');
  });

  it("restores caret/selection via requestAnimationFrame after onChange", () => {
    // Without the restore, the textarea loses focus + selection on
    // every button click — kills chained formatting (bold then italic).
    expect(TOOLBAR_SRC).toMatch(/requestAnimationFrame/);
    expect(TOOLBAR_SRC).toMatch(/setSelectionRange/);
  });
});

describe("SlotFieldEditor — MarkdownToolbar wiring", () => {
  it("imports MarkdownToolbar from the sibling module", () => {
    expect(SLOT_EDITOR_SRC).toMatch(
      /import\s*\{\s*MarkdownToolbar\s*\}\s*from\s*["']\.\/MarkdownToolbar["']/,
    );
  });

  it("renders MarkdownToolbar bound to each slot's textarea", () => {
    // The toolbar receives the per-slot textareaRef + value + onChange
    // so each of framing/task/success_signal gets its own toolbar.
    expect(SLOT_EDITOR_SRC).toMatch(
      /<MarkdownToolbar[\s\S]{0,200}textareaRef=\{textareaRef\}[\s\S]{0,200}value=\{value\}[\s\S]{0,200}onChange=\{onChange\}/,
    );
  });

  it("uses useRef for each slot's textarea (one ref per SlotField)", () => {
    // Per-slot ref keeps the toolbar's selection logic scoped to the
    // textarea it sits above — no shared focus tracking needed.
    expect(SLOT_EDITOR_SRC).toMatch(
      /useRef<HTMLTextAreaElement \| null>\(null\)/,
    );
  });
});
