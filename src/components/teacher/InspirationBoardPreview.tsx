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
 * URL handling: the `url` is a relative `/api/storage/responses/...`
 * path. The storage proxy gates auth on every request + 302s to a
 * signed Supabase URL — so the `<img src>` works directly with no
 * special handling here. Teacher session = teacher cookie = proxy
 * authorises = signed URL.
 */

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

function BoardItemTile({
  item,
  index,
}: {
  item: InspirationBoardItem;
  index: number;
}) {
  return (
    <div className="flex flex-col gap-1.5 text-xs">
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        title="Open full size in new tab"
        className="block aspect-square rounded-lg border border-gray-200 overflow-hidden bg-gray-50 hover:border-purple-300 hover:shadow-sm transition-all"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.url}
          alt={item.altText || `Inspiration image ${index + 1}`}
          loading="lazy"
          className="w-full h-full object-cover"
        />
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
