/**
 * parseResponseValue — recognise the shapes that students store in
 * `student_progress.responses[key]` so the teacher viewer can render
 * uploads / links / voice as something better than raw JSON.
 *
 * Shapes (per src/components/student/UploadInput, LinkInput, VoiceInput):
 *   - upload: '{"type":"upload","url":"...","filename":"...","size":N,"mimeType":"..."}'
 *   - link:   '{"type":"link","url":"...","title":"..."}'
 *   - voice:  '{"type":"voice","url":"...","duration":N}'
 *
 * Non-JSON or non-matching strings → return null; caller falls back to
 * plain-text rendering (after stripResponseHtml).
 */

export type ParsedResponseValue =
  | {
      kind: "upload";
      url: string;
      filename: string;
      size: number | null;
      mimeType: string | null;
      isImage: boolean;
    }
  | {
      kind: "link";
      url: string;
      title: string | null;
    }
  | {
      kind: "voice";
      url: string;
      duration: number | null;
    };

export function parseResponseValue(value: unknown): ParsedResponseValue | null {
  if (typeof value !== "string") return null;
  // Quick reject — JSON-shaped values always start with '{' for our cases.
  if (!value.startsWith("{")) return null;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  if (parsed.type === "upload" && typeof parsed.url === "string" && typeof parsed.filename === "string") {
    const mimeType = typeof parsed.mimeType === "string" ? parsed.mimeType : null;
    return {
      kind: "upload",
      url: parsed.url,
      filename: parsed.filename,
      size: typeof parsed.size === "number" ? parsed.size : null,
      mimeType,
      isImage: mimeType !== null && mimeType.startsWith("image/"),
    };
  }

  if (parsed.type === "link" && typeof parsed.url === "string") {
    return {
      kind: "link",
      url: parsed.url,
      title: typeof parsed.title === "string" && parsed.title.trim() !== "" ? parsed.title : null,
    };
  }

  if (parsed.type === "voice" && typeof parsed.url === "string") {
    return {
      kind: "voice",
      url: parsed.url,
      duration: typeof parsed.duration === "number" ? parsed.duration : null,
    };
  }

  return null;
}

/** Format a byte count for display ("12 KB", "1.4 MB"). */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
