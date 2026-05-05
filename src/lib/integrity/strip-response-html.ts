/**
 * stripResponseHtml — convert a student response (which may contain HTML
 * markup from the RichTextEditor + auto-injected vocabulary "Look up <word>"
 * buttons) into plain prose for teacher viewing.
 *
 * Why: student responses are stored as HTML strings (post the rich-text
 * editor migration, commit 10b8468). Inline buttons + spans + style
 * attributes turn the IntegrityReport modal into a wall of unreadable
 * markup when rendered as text. The teacher wants to see the actual
 * writing, not the markup.
 *
 * Behaviour:
 *   - Returns the input unchanged if it doesn't look like HTML (no '<')
 *   - Strips all tags including their attributes
 *   - Decodes the most common HTML entities
 *   - Collapses runs of spaces/tabs to a single space
 *   - Preserves newlines (the rich-text editor uses <br> + block tags
 *     which become single newlines via this regex; explicit \n in the
 *     source text are preserved)
 *
 * Not a full HTML parser — that would need DOMParser, which is browser-only
 * and overkill for a display-only sanitiser. We're stripping markup, not
 * rendering it; if a tag passes through (e.g. malformed input), the worst
 * case is the teacher sees a stray '<' character, not script execution.
 */
export function stripResponseHtml(input: unknown): string {
  if (typeof input !== "string" || input.length === 0) return "";

  // Always run the full normalisation chain — even pure-text inputs may
  // contain &nbsp; entities or multi-space runs that should be collapsed.
  // The cost is trivial (a handful of regex passes on a string).
  return input
    // Convert block-level tag boundaries to newlines BEFORE stripping.
    // Otherwise paragraph A</p><p>paragraph B becomes "paragraph Aparagraph B".
    .replace(/<\/?(p|div|li|h[1-6]|br)\s*\/?>/gi, "\n")
    // Strip every remaining tag (including attributes).
    .replace(/<[^>]+>/g, "")
    // Decode the entities the rich-text editor + the look-up button
    // injection actually emit. Not exhaustive — we don't need to handle
    // numeric entities or the long tail. If something slips through, it
    // shows as &xxx; which is a visible signal, not silent corruption.
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    // Collapse multi-space runs to a single space (preserves newlines).
    .replace(/[ \t]+/g, " ")
    // Collapse 3+ newlines to a max of 2 (preserves paragraph breaks).
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
