"use client";

/**
 * StudentResponseValue — uniform renderer for student response values
 * across the three teacher viewers (class hub, grading evidence, progress
 * detail). Replaces inline `<p>` tags that were dumping raw JSON for
 * upload/link/voice payloads.
 *
 * Recognised shapes (see src/lib/integrity/parse-response-value.ts):
 *   - upload   → image thumbnail (if mimeType image/*) or 📎 file link
 *   - link     → 🔗 clickable link with optional title
 *   - voice    → 🎤 audio player with optional duration
 *   - "true"   → ✓ Checked  (or just ✓ in compact mode)
 *   - "false"  → ☐ Not checked  (or ☐ in compact)
 *   - empty/—  → "—"
 *   - other strings → stripped HTML, plain text
 *   - objects   → small <pre> with JSON for safety (toolkit tracking objects)
 *
 * The component DOES NOT include the outer muted-bg container — callers
 * keep their existing `bg-surface-alt rounded-lg p-3` wrapper. This
 * component renders only the inner content.
 */

import {
  parseResponseValue,
  formatFileSize,
} from "@/lib/integrity/parse-response-value";
import { stripResponseHtml } from "@/lib/integrity/strip-response-html";

interface StudentResponseValueProps {
  value: unknown;
  /** Compact mode (smaller thumbnails, ✓/☐ instead of "✓ Checked"). */
  compact?: boolean;
}

export function StudentResponseValue({
  value,
  compact = false,
}: StudentResponseValueProps) {
  // 1. Boolean strings (checklist responses)
  if (value === "true") {
    return (
      <p className="text-sm text-text-primary">
        {compact ? "✓" : "✓ Checked"}
      </p>
    );
  }
  if (value === "false") {
    return (
      <p className="text-sm text-text-primary">
        {compact ? "☐" : "☐ Not checked"}
      </p>
    );
  }

  // 2. JSON payloads: upload / link / voice
  const parsed = parseResponseValue(value);
  if (parsed?.kind === "upload") {
    const sizeStr = parsed.size !== null ? formatFileSize(parsed.size) : null;
    if (parsed.isImage) {
      const imgClass = compact
        ? "max-h-32 rounded border border-gray-200"
        : "max-h-64 rounded border border-gray-200";
      return (
        <div className="flex flex-col gap-2">
          <a
            href={parsed.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block self-start"
            title="Open full size in a new tab"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={parsed.url}
              alt={parsed.filename}
              className={imgClass}
              loading="lazy"
            />
          </a>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <span aria-hidden="true">📎</span>
            <a
              href={parsed.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium hover:underline truncate"
            >
              {parsed.filename}
            </a>
            {sizeStr && <span className="text-gray-400">{sizeStr}</span>}
          </div>
        </div>
      );
    }
    // Non-image upload (PDF, video, etc.) — file link only
    return (
      <div className="flex items-center gap-2 text-sm">
        <span aria-hidden="true">📎</span>
        <a
          href={parsed.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-purple-700 hover:underline truncate"
        >
          {parsed.filename}
        </a>
        {sizeStr && <span className="text-xs text-gray-400">{sizeStr}</span>}
      </div>
    );
  }

  if (parsed?.kind === "link") {
    return (
      <a
        href={parsed.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-start gap-1.5 text-sm text-purple-700 hover:underline break-all"
      >
        <span aria-hidden="true">🔗</span>
        <span>{parsed.title || parsed.url}</span>
      </a>
    );
  }

  if (parsed?.kind === "voice") {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span aria-hidden="true">🎤</span>
          <span className="font-medium">Voice recording</span>
          {parsed.duration !== null && (
            <span className="text-gray-400">{Math.round(parsed.duration)}s</span>
          )}
        </div>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio src={parsed.url} controls className="w-full max-w-md" preload="none" />
      </div>
    );
  }

  // 3. Plain string (post-HTML-strip) — the common case
  if (typeof value === "string") {
    const stripped = stripResponseHtml(value);
    return (
      <p className="text-sm text-text-primary whitespace-pre-wrap">
        {stripped || "—"}
      </p>
    );
  }

  // 4. Object that wasn't a recognised payload (toolkit tracking, etc.)
  if (typeof value === "object" && value !== null) {
    return (
      <pre className="text-xs text-gray-500 whitespace-pre-wrap break-words max-h-32 overflow-auto rounded border border-gray-100 bg-gray-50 p-2">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }

  // 5. Anything else — empty marker
  return <p className="text-sm text-text-primary">—</p>;
}
