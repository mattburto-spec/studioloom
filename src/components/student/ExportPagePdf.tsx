"use client";

import { useState } from "react";
import type { ActivitySection } from "@/types";
import { composedPromptText } from "@/lib/lever-1/compose-prompt";

interface ExportPagePdfProps {
  pageId: string;
  pageTitle: string;
  sections: ActivitySection[];
  responses: Record<string, string>;
  studentName: string;
  unitTitle: string;
}

export function ExportPagePdf({
  pageId,
  pageTitle,
  sections,
  responses,
  studentName,
  unitTitle,
}: ExportPagePdfProps) {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF();

      // Header
      doc.setFontSize(16);
      doc.text(`${pageId}: ${pageTitle}`, 20, 20);
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Student: ${studentName}`, 20, 28);
      doc.text(`Project: ${unitTitle}`, 20, 34);
      doc.text(`Exported: ${new Date().toLocaleDateString()}`, 20, 40);

      // Divider line
      doc.setDrawColor(200, 200, 200);
      doc.line(20, 44, 190, 44);

      doc.setTextColor(0, 0, 0);
      let y = 52;

      // Each section
      sections.forEach((section, i) => {
        const responseValue = responses[`section_${i}`] || "(no response)";

        // Prompt
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        // Lever 1: composes framing + task + success_signal when present;
        // falls back to legacy section.prompt when all three slots are null.
        const promptLines = doc.splitTextToSize(composedPromptText(section), 170);
        doc.text(promptLines, 20, y);
        y += promptLines.length * 5 + 4;

        // Response
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);

        let displayValue = responseValue;
        if (responseValue.startsWith("{")) {
          try {
            const parsed = JSON.parse(responseValue);
            if (parsed.type === "upload")
              displayValue = `[Uploaded file: ${parsed.filename || "file"}]`;
            else if (parsed.type === "voice")
              displayValue = `[Voice recording: ${parsed.filename || "recording"}]`;
            else if (parsed.type === "link")
              displayValue = `[Link: ${parsed.title || parsed.url || "link"}]`;
          } catch {
            /* use raw text */
          }
        }

        const responseLines = doc.splitTextToSize(displayValue, 170);
        doc.text(responseLines, 20, y);
        y += responseLines.length * 4.5 + 10;

        // New page if needed
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
      });

      // Reflection responses
      const reflectionKeys = Object.keys(responses).filter(
        (k) => k.startsWith("reflection_") || k.startsWith("check_")
      );
      if (reflectionKeys.length > 0) {
        if (y > 240) {
          doc.addPage();
          y = 20;
        }
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Reflection", 20, y);
        y += 8;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        reflectionKeys.forEach((key) => {
          const val = responses[key];
          if (val) {
            const lines = doc.splitTextToSize(`${key}: ${val}`, 170);
            doc.text(lines, 20, y);
            y += lines.length * 4.5 + 4;
          }
        });
      }

      doc.save(
        `${pageId}_${studentName.replace(/\s/g, "_")}.pdf`
      );
    } catch (err) {
      console.error("PDF export failed:", err);
    }
    setExporting(false);
  }

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      className="px-3 py-2 text-xs font-medium text-accent-blue bg-accent-blue/10 rounded-lg hover:bg-accent-blue/20 transition disabled:opacity-50"
    >
      {exporting ? "Exporting..." : "Export PDF"}
    </button>
  );
}
