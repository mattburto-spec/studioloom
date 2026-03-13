"use client";

import { useState } from "react";
import type { PortfolioEntry } from "@/types";

interface ExportPortfolioPptProps {
  entries: PortfolioEntry[];
  unitTitle: string;
  studentName?: string;
}

export function ExportPortfolioPpt({
  entries,
  unitTitle,
  studentName,
}: ExportPortfolioPptProps) {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    if (entries.length === 0) return;
    setExporting(true);

    try {
      const PptxGenJS = (await import("pptxgenjs")).default;
      const pptx = new PptxGenJS();

      pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5"
      pptx.author = studentName || "Student";
      pptx.title = `${unitTitle} — Portfolio`;

      // Brand colors
      const PURPLE = "7B2FF2";
      const PINK = "FF3366";
      const DARK = "1a1a2e";
      const GRAY = "666666";

      // --- Title slide ---
      const titleSlide = pptx.addSlide();
      titleSlide.background = { fill: PURPLE };

      titleSlide.addText("Portfolio", {
        x: 0.8,
        y: 1.0,
        w: 11,
        h: 1.2,
        fontSize: 44,
        fontFace: "Helvetica",
        color: "FFFFFF",
        bold: true,
      });

      titleSlide.addText(unitTitle, {
        x: 0.8,
        y: 2.2,
        w: 11,
        h: 0.6,
        fontSize: 20,
        fontFace: "Helvetica",
        color: "FFFFFF",
        transparency: 40,
      });

      titleSlide.addText(
        `${studentName || "Student"} — ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`,
        {
          x: 0.8,
          y: 3.2,
          w: 11,
          h: 0.4,
          fontSize: 14,
          fontFace: "Helvetica",
          color: "FFFFFF",
          transparency: 60,
        }
      );

      titleSlide.addText(`${entries.length} entries`, {
        x: 0.8,
        y: 6.4,
        w: 3,
        h: 0.4,
        fontSize: 12,
        fontFace: "Helvetica",
        color: "FFFFFF",
        transparency: 50,
      });

      // --- Entry slides ---
      // Reverse so oldest first (chronological)
      const sorted = [...entries].reverse();

      for (let i = 0; i < sorted.length; i++) {
        const entry = sorted[i];
        const slide = pptx.addSlide();
        slide.background = { fill: "FFFFFF" };

        const date = new Date(entry.created_at);
        const dateStr = date.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
        const timeStr = date.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        });

        // Top bar — entry number + date
        slide.addShape(pptx.ShapeType.rect, {
          x: 0,
          y: 0,
          w: 13.33,
          h: 0.6,
          fill: { color: PURPLE },
        });

        slide.addText(`Entry ${i + 1} of ${sorted.length}`, {
          x: 0.5,
          y: 0.08,
          w: 4,
          h: 0.45,
          fontSize: 11,
          fontFace: "Helvetica",
          color: "FFFFFF",
          bold: true,
        });

        slide.addText(`${dateStr} at ${timeStr}`, {
          x: 8,
          y: 0.08,
          w: 5,
          h: 0.45,
          fontSize: 11,
          fontFace: "Helvetica",
          color: "FFFFFF",
          transparency: 40,
          align: "right",
        });

        // Type badge
        const typeLabel =
          entry.type === "mistake"
            ? "Learning Moment"
            : entry.type === "photo"
              ? "Photo"
              : entry.type === "link"
                ? "Link"
                : entry.type === "note"
                  ? "Note"
                  : "Entry";

        const badgeColor =
          entry.type === "mistake"
            ? "E86F2C"
            : entry.type === "photo"
              ? PURPLE
              : entry.type === "link"
                ? "2E86AB"
                : PINK;

        slide.addText(typeLabel.toUpperCase(), {
          x: 0.5,
          y: 0.9,
          w: 1.8,
          h: 0.35,
          fontSize: 9,
          fontFace: "Helvetica",
          color: "FFFFFF",
          bold: true,
          fill: { color: badgeColor },
          rectRadius: 0.15,
          align: "center",
        });

        // Layout depends on what content exists
        const hasImage = !!entry.media_url;
        const hasText = !!entry.content;
        const hasLink = !!entry.link_url;

        if (hasImage && hasText) {
          // Image on left, text on right
          slide.addImage({
            path: entry.media_url!,
            x: 0.5,
            y: 1.5,
            w: 6,
            h: 4.5,
            rounding: true,
          });

          slide.addText(entry.content!, {
            x: 7,
            y: 1.5,
            w: 5.5,
            h: 4,
            fontSize: 16,
            fontFace: "Helvetica",
            color: DARK,
            valign: "top",
            wrap: true,
            lineSpacingMultiple: 1.3,
          });
        } else if (hasImage) {
          // Image centered, larger
          slide.addImage({
            path: entry.media_url!,
            x: 2,
            y: 1.5,
            w: 9,
            h: 5.2,
            rounding: true,
          });
        } else if (hasText) {
          // Text centered, larger
          slide.addText(entry.content!, {
            x: 1.5,
            y: 1.8,
            w: 10,
            h: 4,
            fontSize: 22,
            fontFace: "Helvetica",
            color: DARK,
            valign: "top",
            wrap: true,
            lineSpacingMultiple: 1.4,
          });
        }

        // Link at bottom if present
        if (hasLink) {
          const y = hasImage || hasText ? 6.3 : 2.5;
          slide.addText(entry.link_url!, {
            x: 0.5,
            y,
            w: 12,
            h: 0.4,
            fontSize: 11,
            fontFace: "Helvetica",
            color: "2E86AB",
            hyperlink: { url: entry.link_url! },
          });
        }
      }

      // --- Save ---
      const filename = `Portfolio_${unitTitle.replace(/[^a-zA-Z0-9]/g, "_")}_${(studentName || "Student").replace(/\s/g, "_")}`;
      await pptx.writeFile({ fileName: `${filename}.pptx` });
    } catch (err) {
      console.error("PPT export failed:", err);
    }

    setExporting(false);
  }

  return (
    <button
      onClick={handleExport}
      disabled={exporting || entries.length === 0}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary bg-surface-alt hover:bg-gray-200 rounded-lg transition disabled:opacity-40"
      title="Export as PowerPoint"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      {exporting ? "Exporting..." : "PPT"}
    </button>
  );
}
