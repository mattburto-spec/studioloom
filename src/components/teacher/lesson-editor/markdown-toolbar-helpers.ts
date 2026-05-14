/**
 * Pure text-manipulation helpers backing MarkdownToolbar. Live in a
 * separate `.ts` file so unit tests (which are also `.ts`) can import
 * them without the vite import-analyzer trying to parse the toolbar's
 * JSX.
 *
 * All helpers operate on (value, selectionStart, selectionEnd) and
 * return a new (value, selectionStart, selectionEnd) — no DOM, no
 * React. The toolbar component is the only React-aware caller and it
 * lives alongside in MarkdownToolbar.tsx.
 */

export interface SelectionResult {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

/**
 * Wrap [start, end) with `marker` on both sides.
 *  - No selection → insert two markers, place caret between them.
 *  - Selection    → wrap and grow the selection to include the
 *                   newly-wrapped run (caret stays usable for chaining
 *                   bold + italic).
 */
export function applyInlineWrap(
  value: string,
  start: number,
  end: number,
  marker: string,
): SelectionResult {
  if (start === end) {
    const next = value.slice(0, start) + marker + marker + value.slice(end);
    const caret = start + marker.length;
    return { value: next, selectionStart: caret, selectionEnd: caret };
  }
  const selected = value.slice(start, end);
  const next =
    value.slice(0, start) + marker + selected + marker + value.slice(end);
  return {
    value: next,
    selectionStart: start + marker.length,
    selectionEnd: end + marker.length,
  };
}

/**
 * Prefix every line touched by [start, end] using `prefixFn(i)` where
 * `i` is the 0-based line index within the selected block.
 *
 * Expands the selection to whole lines so prefixing a mid-line caret
 * still hits the correct line. After the transform, the selection
 * covers the whole prefixed block — that's what users expect when
 * applying a list to multiple lines.
 */
export function applyLinePrefix(
  value: string,
  start: number,
  end: number,
  prefixFn: (lineIndexInSelection: number) => string,
): SelectionResult {
  const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  let lineEnd = value.indexOf("\n", end);
  if (lineEnd === -1) lineEnd = value.length;

  const block = value.slice(lineStart, lineEnd);
  const lines = block.split("\n");
  const prefixed = lines
    .map((line, i) => prefixFn(i) + line)
    .join("\n");

  const next = value.slice(0, lineStart) + prefixed + value.slice(lineEnd);
  return {
    value: next,
    selectionStart: lineStart,
    selectionEnd: lineStart + prefixed.length,
  };
}

/**
 * Insert `[text](url)` at the selection. If a selection is present,
 * it becomes the link text; otherwise a placeholder "link text" is
 * inserted with the link text highlighted so the user can overtype.
 */
export function applyLink(
  value: string,
  start: number,
  end: number,
  url: string,
): SelectionResult {
  const hasSelection = start !== end;
  const linkText = hasSelection ? value.slice(start, end) : "link text";
  const inserted = `[${linkText}](${url})`;
  const next = value.slice(0, start) + inserted + value.slice(end);

  if (hasSelection) {
    // Caret lands after the closing paren — natural place to keep typing.
    const caret = start + inserted.length;
    return { value: next, selectionStart: caret, selectionEnd: caret };
  }
  // Highlight the placeholder so overtyping replaces it.
  const placeholderStart = start + 1;
  return {
    value: next,
    selectionStart: placeholderStart,
    selectionEnd: placeholderStart + linkText.length,
  };
}
