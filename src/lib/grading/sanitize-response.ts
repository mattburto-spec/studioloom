/**
 * Convert contenteditable-style HTML student responses into plain text with
 * preserved line breaks. The student composer emits markup like
 *   "start text<div>line two</div><div>line three</div><div><br></div>"
 * which renders as raw tags in our marking view. This helper produces:
 *   "start text
 *   line two
 *   line three
 *   "
 *
 * Strategy:
 *   - Convert <br> and </div>, <p>, <li> to a newline.
 *   - Convert <div>, <p>, <li> openings between content to a newline (only
 *     when they're not the very first opener).
 *   - Strip every other tag.
 *   - Decode the common HTML entities so &amp; doesn't show literally.
 *   - Collapse runs of 3+ blank lines to 2.
 *
 * Pure function. Output is plain text; render in a `<pre>`-style block so
 * whitespace renders correctly.
 */

const ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

const BLOCK_OPEN = /<(div|p|li)\b[^>]*>/gi;
const BLOCK_CLOSE = /<\/(div|p|li|h[1-6]|tr)\s*>/gi;
const BR_TAG = /<br\s*\/?>/gi;
const ANY_TAG = /<[^>]+>/g;

export function sanitizeResponseText(raw: string | null | undefined): string {
  if (!raw) return "";

  let s = String(raw);

  // <br> → newline.
  s = s.replace(BR_TAG, "\n");

  // Drop block-element CLOSING tags entirely; the OPENING tag below becomes
  // the line break. Together: "before<div>a</div><div>b</div>" gets one
  // newline per block, not two — preserving Matt's expected "before\na\nb".
  s = s.replace(BLOCK_CLOSE, "");

  // Block-element OPENING tags → newline. This handles both "leading text
  // before first <div>" (wraps the text onto its own line) and consecutive
  // siblings.
  s = s.replace(BLOCK_OPEN, "\n");

  // Strip every other tag (spans, formatting, dangerous nodes like
  // <script>/<img>).
  s = s.replace(ANY_TAG, "");

  // Decode common entities.
  for (const [entity, char] of Object.entries(ENTITY_MAP)) {
    s = s.split(entity).join(char);
  }

  // Numeric entities &#NNN; / &#xHH; — defensive only, rare from contenteditable.
  s = s.replace(/&#(\d+);/g, (_m, n) => {
    const code = Number(n);
    return Number.isFinite(code) ? String.fromCodePoint(code) : "";
  });

  // Collapse 3+ consecutive newlines to 2 (paragraph break max).
  s = s.replace(/\n{3,}/g, "\n\n");

  // Trim leading/trailing whitespace incl. leading newline from the very first
  // <div>.
  return s.trim();
}
