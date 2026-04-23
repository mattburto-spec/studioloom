"use client";

/**
 * PreviewCard — large thumbnail + revision label for the right-column
 * sidebar on preflight detail pages (Phase 6-6i).
 *
 * Shared between the student status page (Phase 6-6e) and the teacher
 * detail page (Phase 6-6j). Click thumbnail → fullscreen lightbox
 * modal with click-to-toggle zoom. Falls back to a dashed placeholder
 * when the scanner hasn't produced a thumbnail yet (mid-scan or
 * scan_error).
 *
 * Future (PH6-FU-PREVIEW-OVERLAY P2): annotate the thumbnail with
 * bounding boxes / highlights from each rule's `evidence` field so
 * students and teachers can see WHERE the issue is, not just what.
 */

import * as React from "react";

export interface PreviewCardProps {
  thumbnailUrl: string | null;
  revisionNumber: number;
  fileType: "stl" | "svg";
  /** Optional caption shown below the revision number. Useful on the
   *  teacher detail page for surfacing the originalFilename next to
   *  the thumbnail (which the student side omits because it's
   *  already in the main viewer header). */
  subtitle?: string;
}

export function PreviewCard({
  thumbnailUrl,
  revisionNumber,
  fileType,
  subtitle,
}: PreviewCardProps) {
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  return (
    <>
      <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
        {thumbnailUrl ? (
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            aria-label="Open preview in larger view"
            className="aspect-square w-full rounded-xl border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center cursor-zoom-in hover:border-brand-purple/40 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/40"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbnailUrl}
              alt="Scan preview — click to enlarge"
              className="w-full h-full object-contain"
            />
          </button>
        ) : (
          <div
            aria-hidden="true"
            className="aspect-square w-full rounded-xl border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center"
          >
            <span className="text-gray-300 text-sm">preview not available</span>
          </div>
        )}
        <div>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">
              Revision {revisionNumber}
            </p>
            <span className="text-xs text-gray-500 font-mono uppercase">
              {fileType}
            </span>
          </div>
          {subtitle && (
            <p className="text-xs text-gray-500 truncate mt-0.5" title={subtitle}>
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {isModalOpen && thumbnailUrl && (
        <PreviewModal
          imageUrl={thumbnailUrl}
          caption={`Revision ${revisionNumber} · ${fileType.toUpperCase()}`}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
}

/**
 * Fullscreen lightbox for the preview thumbnail.
 *
 *   - Backdrop click → close
 *   - Esc key → close
 *   - Click image → toggle "fit" (default) ↔ "1:1 native" (zoom)
 *   - Body scroll locked while open
 */
function PreviewModal(props: {
  imageUrl: string;
  caption: string;
  onClose: () => void;
}) {
  const { imageUrl, caption, onClose } = props;
  const [zoomed, setZoomed] = React.useState(false);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  React.useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Scan preview"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close preview"
        className="absolute top-4 right-4 text-white text-2xl bg-black/40 hover:bg-black/60 rounded-full w-10 h-10 flex items-center justify-center leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      >
        ×
      </button>

      <div
        onClick={(e) => {
          e.stopPropagation();
          setZoomed((z) => !z);
        }}
        className={`max-w-[92vw] max-h-[88vh] overflow-auto bg-white rounded-xl ${
          zoomed ? "cursor-zoom-out" : "cursor-zoom-in"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="Scan preview enlarged"
          className={
            zoomed
              ? "max-w-none block"
              : "max-w-[92vw] max-h-[88vh] block object-contain"
          }
        />
      </div>

      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/90 text-xs bg-black/40 px-3 py-1.5 rounded-full whitespace-nowrap">
        {caption} · {zoomed ? "click to fit" : "click to zoom in"} · Esc to close
      </p>
    </div>
  );
}

export default PreviewCard;
