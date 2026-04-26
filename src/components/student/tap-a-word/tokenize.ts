/**
 * Pure tokenizer for Tap-a-word.
 *
 * Walks an educational text string and emits tokens with a `tappable` flag.
 * Consumers (TappableText) render tappable tokens as <button> spans and
 * untappable tokens as plain <span>, preserving exact whitespace + punctuation.
 *
 * Rules for tappable:
 * - 2+ characters
 * - all Unicode letters (\p{L}), with optional internal hyphens or apostrophes
 *   (so "don't" and "project-based" are single tappable tokens)
 * - skip URLs: any non-whitespace chunk that contains "://" is emitted as a
 *   single untappable token (entire URL stays as one token, not three)
 * - skip pure numbers (digits don't match \p{L}, so they fall into the
 *   "other" group as untappable)
 * - skip 1-char letter tokens ("a", "I") via MIN_TAPPABLE_LENGTH
 *
 * No React, no DOM, no fetch. Tested in isolation in __tests__/tokenize.test.ts.
 */

export type Token = { text: string; tappable: boolean };

const MIN_TAPPABLE_LENGTH = 2;

// Match (in priority order at each position):
//   1. whitespace run
//   2. word: letters with optional internal hyphens or apostrophes (straight or curly)
//   3. anything else (punctuation, digits, symbols)
const TOKEN_RE = /(\s+)|(\p{L}+(?:[-'’]\p{L}+)*)|([^\s\p{L}]+)/gu;

export function tokenize(text: string): Token[] {
  if (!text) return [];

  // Pre-scan: any non-whitespace chunk containing "://" is a URL — mark its range.
  // The range covers ALL letter/punct sub-tokens we'd otherwise emit inside it.
  const urlRanges: Array<[number, number]> = [];
  const nonWsRe = /\S+/g;
  let n: RegExpExecArray | null;
  while ((n = nonWsRe.exec(text)) !== null) {
    if (n[0].includes("://")) {
      urlRanges.push([n.index, n.index + n[0].length]);
    }
  }
  const inUrl = (idx: number): boolean =>
    urlRanges.some(([s, e]) => idx >= s && idx < e);

  const tokens: Token[] = [];
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(text)) !== null) {
    const [, ws, word, other] = m;
    const start = m.index;
    if (ws !== undefined) {
      tokens.push({ text: ws, tappable: false });
    } else if (word !== undefined) {
      const tappable = !inUrl(start) && word.length >= MIN_TAPPABLE_LENGTH;
      tokens.push({ text: word, tappable });
    } else if (other !== undefined) {
      tokens.push({ text: other, tappable: false });
    }
  }

  return tokens;
}
