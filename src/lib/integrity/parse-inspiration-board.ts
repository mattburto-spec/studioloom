/**
 * parseInspirationBoardResponse — detect + parse the InspirationBoard
 * response shape stored in `student_progress.responses[tileId]`.
 *
 * The InspirationBoard block (src/components/student/inspiration-board/
 * InspirationBoardBlock.tsx) serialises its state as:
 *
 *   {
 *     "items": [
 *       { "id", "url", "commentary", "stealNote", "altText" },
 *       ...
 *     ],
 *     "synthesis": "...",
 *     "completed": true|false
 *   }
 *
 * `url` is a relative `/api/storage/responses/...` path that the storage
 * proxy 302s to a signed Supabase URL on each request (per project
 * security spec — see docs/security/security-overview.md §Storage).
 *
 * Sits alongside parse-response-value.ts so the teacher viewers can
 * render this shape as a thumbnail grid rather than a JSON dump.
 *
 * Returns null on non-matching input so callers can fall back to the
 * default text rendering.
 */

export interface InspirationBoardItem {
  id: string;
  url: string;
  commentary: string;
  stealNote: string;
  altText: string;
}

export interface ParsedInspirationBoard {
  kind: "inspiration-board";
  items: InspirationBoardItem[];
  synthesis: string;
  completed: boolean;
}

export function parseInspirationBoardResponse(
  value: unknown,
): ParsedInspirationBoard | null {
  if (typeof value !== "string") return null;
  // Cheap reject — we know the shape always JSON-stringifies starting
  // with `{`.
  if (!value.startsWith("{")) return null;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  // Distinguishing signature — InspirationBoard always serialises with
  // an `items` array. Other JSON-shaped response types use `type` as
  // their discriminator (upload/link/voice), so the absence of `type`
  // plus presence of `items` is a safe match.
  if (!Array.isArray(parsed.items)) return null;
  if (typeof parsed.type === "string") return null; // upload/link/voice — leave to parse-response-value

  const items: InspirationBoardItem[] = parsed.items
    .filter((i): i is Record<string, unknown> => typeof i === "object" && i !== null)
    .map((i) => ({
      id: typeof i.id === "string" ? i.id : "",
      url: typeof i.url === "string" ? i.url : "",
      commentary: typeof i.commentary === "string" ? i.commentary : "",
      stealNote: typeof i.stealNote === "string" ? i.stealNote : "",
      altText: typeof i.altText === "string" ? i.altText : "",
    }))
    .filter((i) => i.url.length > 0);

  return {
    kind: "inspiration-board",
    items,
    synthesis: typeof parsed.synthesis === "string" ? parsed.synthesis : "",
    completed: parsed.completed === true,
  };
}
