"use client";

/**
 * InspirationBoardPreview — renders an Inspiration Board student
 * response as a thumbnail grid with per-item commentary, suitable for
 * the marking page's "Student response" panel.
 *
 * Sister to StudentResponseValue.tsx — that one handles upload / link /
 * voice JSON shapes; this one handles the inspiration-board shape.
 * Lives separately because the inspiration board has its own visual
 * grammar (image grid + commentary) that doesn't fit StudentResponseValue's
 * single-line thumbnail pattern.
 *
 * Future: class-gallery view will reuse the same render logic. Keep this
 * component lean + framework-agnostic so it can mount anywhere.
 *
 * URL handling — TWO kinds of `url` value:
 *   1. Storage-proxied image: `/api/storage/responses/...jpg` etc.
 *      The storage proxy gates auth + 302s to a signed Supabase URL,
 *      so `<img src>` works directly.
 *   2. External article/link: `https://www.d2ziran.com/...htm` etc.
 *      These are HTML pages, NOT images. The OLD code unconditionally
 *      rendered as <img>, producing broken images + noisy CORS errors
 *      in the network tab (Matt smoke 13 May 2026).
 *
 * The `isLikelyImageUrl()` heuristic + an onError fallback handle
 * both cases. Detection priority: storage path → image extension →
 * data URI → else assume link. Img load failure falls back to the
 * link card UI.
 */

import { useState } from "react";
import type {
  InspirationBoardItem,
  ParsedInspirationBoard,
} from "@/lib/integrity/parse-inspiration-board";

interface Props {
  data: ParsedInspirationBoard;
}

export function InspirationBoardPreview({ data }: Props) {
  if (data.items.length === 0) {
    // Edge case: student opened the block, JSON shape persisted, but
    // no images uploaded. Surface that explicitly so the teacher
    // doesn't wonder if rendering failed.
    return (
      <div className="text-sm text-gray-500 italic bg-white border border-gray-200 rounded-xl p-4">
        Inspiration Board started but no images uploaded yet.
        {data.synthesis && (
          <p className="text-gray-800 not-italic mt-3">
            <span className="text-[10px] font-bold tracking-wider uppercase text-gray-400 block mb-1">
              Synthesis
            </span>
            {data.synthesis}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {data.items.map((item, i) => (
          <BoardItemTile key={item.id || `item-${i}`} item={item} index={i} />
        ))}
      </div>

      {data.synthesis.trim() && (
        <div className="pt-3 border-t border-gray-100">
          <p className="text-[10px] font-bold tracking-wider uppercase text-gray-400 mb-1">
            Synthesis
          </p>
          <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
            {data.synthesis}
          </p>
        </div>
      )}

      {!data.completed && data.items.length > 0 && (
        <p className="text-[11px] text-amber-600 italic">
          (In progress — student hasn't marked the board complete)
        </p>
      )}
    </div>
  );
}

/** Conservative detection: is this URL likely to point at an image
 *  (vs an article / web page)? Used to pick between <img> rendering
 *  and the link-card fallback. Defaults to FALSE for unknown URLs —
 *  better to render a link card than a broken image. */
function isLikelyImageUrl(url: string): boolean {
  if (!url) return false;
  if (url.startsWith("/api/storage/")) return true;
  if (url.startsWith("data:image/")) return true;
  // Strip query string before checking extension (proxy signed URLs
  // often append ?token= etc.).
  const pathOnly = url.split("?")[0]?.split("#")[0] ?? "";
  return /\.(jpe?g|png|gif|webp|svg|avif|bmp)$/i.test(pathOnly);
}

/** Pretty-print just the hostname for the link card. */
function urlHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "external link";
  }
}

function BoardItemTile({
  item,
  index,
}: {
  item: InspirationBoardItem;
  index: number;
}) {
  // imgFailed = the <img> tried to load + the server returned non-image
  // (HTML, 403, CORS reject, etc.). Falls back to the link card UI so
  // the teacher still sees what the student pinned + their commentary.
  const [imgFailed, setImgFailed] = useState(false);
  const renderAsLink =
    !isLikelyImageUrl(item.url) || imgFailed;
  const hostname = urlHostname(item.url);

  return (
    <div className="flex flex-col gap-1.5 text-xs">
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        title={
          renderAsLink
            ? `Open link in new tab — ${item.url}`
            : "Open full size in new tab"
        }
        className="block aspect-square rounded-lg border border-gray-200 overflow-hidden bg-gray-50 hover:border-purple-300 hover:shadow-sm transition-all"
      >
        {renderAsLink ? (
          // Link card — student pinned a web page, not a direct image.
          // Render a placeholder with the hostname + link icon so the
          // teacher knows it's an article / external reference.
          <div
            data-testid="ib-link-card"
            className="w-full h-full flex flex-col items-center justify-center gap-1 p-2 bg-gradient-to-br from-purple-50 to-violet-50 text-purple-700"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            <div className="text-[10px] font-bold text-center break-all line-clamp-2">
              {hostname}
            </div>
            <div className="text-[9px] text-purple-500 italic">
              external link
            </div>
          </div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={item.url}
            alt={item.altText || `Inspiration image ${index + 1}`}
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover"
          />
        )}
      </a>
      {item.commentary.trim() && (
        <p className="text-gray-700 leading-snug line-clamp-3">
          {item.commentary}
        </p>
      )}
      {item.stealNote.trim() && (
        <p className="text-purple-600 leading-snug italic line-clamp-2">
          Steal: {item.stealNote}
        </p>
      )}
    </div>
  );
}
