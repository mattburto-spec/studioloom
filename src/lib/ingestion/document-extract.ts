/**
 * Document text extraction for PDF, DOCX, and PPTX files.
 * Preserves structure (sections/headings) for intelligent chunking.
 *
 * Relocated from src/lib/knowledge/extract.ts (16 Apr 2026) because this
 * is shared document infrastructure used by the Dimensions3 ingestion
 * pipeline, not part of the old quarantined knowledge pipeline.
 */

export interface ExtractedSection {
  heading: string;
  content: string;
}

export interface ExtractedDoc {
  title: string;
  sections: ExtractedSection[];
  rawText: string;
}

/**
 * Extract text from a PDF buffer.
 *
 * Uses pdfjs-dist legacy build directly (no canvas dependency) so it works
 * in Vercel serverless. pdf-parse v2 depends on @napi-rs/canvas which only
 * ships darwin-arm64 binaries locally and crashes on Linux.
 */
export async function extractFromPDF(
  buffer: Buffer,
  filename: string
): Promise<ExtractedDoc> {
  // pdfjs-dist references browser rendering globals (DOMMatrix, Path2D, etc.)
  // which don't exist in Vercel's serverless Node.js runtime. Stub them all —
  // text extraction never touches the rendering path so these are never called.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any;
  for (const name of ["DOMMatrix", "Path2D", "ImageData", "OffscreenCanvas"]) {
    if (typeof g[name] === "undefined") {
      g[name] = class Stub {};
    }
  }

  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(buffer);
  const loadingTask = pdfjsLib.getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
    disableFontFace: true,
  });
  const doc = await loadingTask.promise;

  const pageTexts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pageText = content.items.map((item: any) => item.str).join(" ");
    pageTexts.push(pageText);
  }
  const text = pageTexts.join("\n\n");

  // Split by double newlines to approximate sections
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p: string) => p.trim())
    .filter((p: string) => p.length > 20);

  // Use first substantial line as title, or filename
  const title =
    paragraphs[0]?.length < 100
      ? paragraphs[0]
      : filename.replace(/\.[^.]+$/, "");

  // Group paragraphs into sections (by detecting heading-like lines)
  const sections: ExtractedSection[] = [];
  let currentHeading = "Introduction";
  let currentContent: string[] = [];

  for (const para of paragraphs) {
    // Heuristic: short lines (<80 chars) that don't end with period are likely headings
    if (para.length < 80 && !para.endsWith(".") && !para.endsWith(",")) {
      if (currentContent.length > 0) {
        sections.push({
          heading: currentHeading,
          content: currentContent.join("\n\n"),
        });
        currentContent = [];
      }
      currentHeading = para;
    } else {
      currentContent.push(para);
    }
  }

  if (currentContent.length > 0) {
    sections.push({
      heading: currentHeading,
      content: currentContent.join("\n\n"),
    });
  }

  // Fallback: if no sections detected, use entire text as one section
  if (sections.length === 0) {
    sections.push({ heading: "Content", content: text.trim() });
  }

  return { title, sections, rawText: text };
}

/**
 * Extract text from a DOCX buffer.
 * Mammoth preserves heading structure well.
 */
export async function extractFromDOCX(
  buffer: Buffer,
  filename: string
): Promise<ExtractedDoc> {
  const mammoth = await import("mammoth");
  const result = await mammoth.convertToHtml({ buffer });
  let html = result.value;

  // Also get raw text for rawText field
  const rawResult = await mammoth.extractRawText({ buffer });

  // ── Table processing (Phase 0) ──
  // Teacher-authored DOCXs commonly use table grids for scheme-of-work
  // timelines (Week rows × Lesson columns). Mammoth preserves <table>
  // tags, but heading-based splitting ignores them — collapsing 12 lessons
  // into 1-3 sections. Process tables BEFORE bold-heading promotion:
  // schedule tables → <h3> headings; other tables → unwrapped inner HTML.
  html = processTablesInHtml(html);

  // ── Bold-heading promotion (two-phase) ──
  // Many teacher-authored docs use bold text for headings instead of Word
  // heading styles. Mammoth only creates <h> tags for styled headings, so
  // bold-only paragraphs appear as <p><strong>text</strong></p>.
  //
  // Phase 1 (ALWAYS): Promote bold text matching lesson/week/day patterns
  // regardless of existing headings. A scheme_of_work often has 3 proper
  // headings (Intro, Task, Assessment) with bold "Lesson 1:", "Week 2:"
  // sub-headings inside sections. Without this, 12-lesson documents
  // collapse to 1 lesson because the sub-headings stay as body text.
  //
  // Phase 2 (no headings only): If the document has NO heading styles at
  // all, also promote other short bold paragraphs as headings.
  html = promoteLessonHeadings(html);
  if (!/<h[1-6][^>]*>/i.test(html)) {
    html = promoteBoldToHeadings(html);
  }

  // Parse HTML to extract headings and content sections
  const sections: ExtractedSection[] = [];
  let currentHeading = "Introduction";
  let currentContent: string[] = [];

  // Split HTML by heading tags
  const parts = html.split(/<h[1-6][^>]*>/i);

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    // Check if this part contains a closing heading tag
    const headingMatch = part.match(/^(.*?)<\/h[1-6]>/i);

    if (headingMatch && i > 0) {
      // Save previous section
      if (currentContent.length > 0) {
        sections.push({
          heading: currentHeading,
          content: currentContent.join("\n\n"),
        });
        currentContent = [];
      }
      currentHeading = stripHtml(headingMatch[1]);
      // Content after the heading close tag
      const afterHeading = part.slice(headingMatch[0].length);
      const text = stripHtml(afterHeading).trim();
      if (text) currentContent.push(text);
    } else {
      const text = stripHtml(part).trim();
      if (text) currentContent.push(text);
    }
  }

  if (currentContent.length > 0) {
    sections.push({
      heading: currentHeading,
      content: currentContent.join("\n\n"),
    });
  }

  if (sections.length === 0) {
    sections.push({ heading: "Content", content: rawResult.value.trim() });
  }

  const title =
    sections[0]?.heading !== "Introduction"
      ? sections[0].heading
      : filename.replace(/\.[^.]+$/, "");

  return { title, sections, rawText: rawResult.value };
}

/**
 * Extract text from a PPTX buffer.
 * Returns one section per slide.
 */
export async function extractFromPPTX(
  buffer: Buffer,
  filename: string
): Promise<ExtractedDoc> {
  const { parseOffice } = await import("officeparser");

  const ast = await parseOffice(buffer);
  const text = ast.toText();

  // Split by slide markers or double newlines
  const slides = text
    .split(/\n{3,}|---+/)
    .map((s: string) => s.trim())
    .filter((s: string) => s.length > 10);

  const sections: ExtractedSection[] = slides.map(
    (slide: string, i: number) => {
      const lines = slide.split("\n");
      const heading = lines[0]?.length < 100 ? lines[0] : `Slide ${i + 1}`;
      const content = lines.slice(1).join("\n").trim() || slide;
      return { heading, content };
    }
  );

  if (sections.length === 0) {
    sections.push({ heading: "Content", content: text.trim() });
  }

  const title = sections[0]?.heading || filename.replace(/\.[^.]+$/, "");

  return { title, sections, rawText: text };
}

/**
 * Route extraction based on file type.
 */
export async function extractDocument(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<ExtractedDoc> {
  if (
    mimeType === "application/pdf" ||
    filename.toLowerCase().endsWith(".pdf")
  ) {
    return extractFromPDF(buffer, filename);
  }
  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    filename.toLowerCase().endsWith(".docx")
  ) {
    return extractFromDOCX(buffer, filename);
  }
  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    filename.toLowerCase().endsWith(".pptx")
  ) {
    return extractFromPPTX(buffer, filename);
  }

  throw new Error(`Unsupported file type: ${mimeType || filename}`);
}

/**
 * Rebuild markdown text from structured sections so downstream consumers
 * (parseDocument) can detect heading boundaries. extractFromDOCX/PDF populate
 * sections correctly but their rawText field strips headings.
 */
export function sectionsToMarkdown(sections: ExtractedSection[]): string {
  return sections
    .map((s) => {
      const heading = s.heading?.trim();
      const content = s.content?.trim() ?? "";
      if (!heading) return content;
      return `# ${heading}\n\n${content}`;
    })
    .filter((block) => block.length > 0)
    .join("\n\n");
}

/**
 * Pattern for lesson/week/day headings — always promoted regardless of
 * whether the document has other heading styles.
 */
const LESSON_HEADING_RE = /^(?:Lesson|Week|Weeks|Day|Session|Module|Part|Unit)\s+\d/i;

/**
 * Phase 1 promotion: Always promote bold text that matches lesson/week/day
 * patterns to <h3> headings, even when the document already has heading styles.
 *
 * This is critical for scheme_of_work documents where the top-level structure
 * uses proper headings but individual lesson entries are bold body text.
 * Without this, a 12-lesson scheme of work collapses to 1 lesson.
 */
function promoteLessonHeadings(html: string): string {
  // Pattern 1: Entire bold paragraph matching lesson heading
  // e.g. <p><strong>Lesson 3: Prototyping</strong></p>
  let result = html.replace(
    /<p>\s*<strong>(.*?)<\/strong>\s*<\/p>/gi,
    (fullMatch, inner: string) => {
      const text = stripHtml(inner).trim();
      if (text.length >= 3 && text.length <= 120 && LESSON_HEADING_RE.test(text)) {
        return `<h3>${text}</h3>`;
      }
      return fullMatch;
    }
  );

  // Pattern 2: Bold start matching lesson heading + short tail
  // e.g. <p><strong>Week 1</strong>: Introduction to Biomimicry</p>
  result = result.replace(
    /<p>\s*<strong>(.*?)<\/strong>\s*([^<]{1,80})\s*<\/p>/gi,
    (fullMatch, boldInner: string, tail: string) => {
      const boldText = stripHtml(boldInner).trim();
      if (LESSON_HEADING_RE.test(boldText)) {
        const combined = (boldText + " " + tail.trim()).trim();
        if (combined.length >= 3 && combined.length <= 120) {
          return `<h3>${combined}</h3>`;
        }
      }
      return fullMatch;
    }
  );

  return result;
}

/**
 * Phase 2 promotion: Promote ALL bold-only paragraphs to <h3> headings.
 * Only used when mammoth finds no Word heading styles in a DOCX — the next best
 * structural signal is bold text that teachers use as visual headings.
 *
 * Handles two patterns:
 *   <p><strong>Lesson 1: Title</strong></p>        → <h3>Lesson 1: Title</h3>
 *   <p><strong>Week 1</strong>: Introduction</p>   → <h3>Week 1: Introduction</h3>
 */
function promoteBoldToHeadings(html: string): string {
  // Pattern 1: Entire paragraph is a single bold element
  // e.g. <p><strong>Lesson 3: Prototyping</strong></p>
  let result = html.replace(
    /<p>\s*<strong>(.*?)<\/strong>\s*<\/p>/gi,
    (fullMatch, inner: string) => {
      const text = stripHtml(inner).trim();
      if (text.length >= 3 && text.length <= 120 && !/[.!?]$/.test(text)) {
        return `<h3>${text}</h3>`;
      }
      return fullMatch;
    }
  );

  // Pattern 2: Bold start followed by short non-HTML tail
  // e.g. <p><strong>Week 1</strong>: Introduction to Biomimicry</p>
  result = result.replace(
    /<p>\s*<strong>(.*?)<\/strong>\s*([^<]{1,80})\s*<\/p>/gi,
    (fullMatch, boldInner: string, tail: string) => {
      const combined = (stripHtml(boldInner).trim() + " " + tail.trim()).trim();
      if (
        combined.length >= 3 &&
        combined.length <= 120 &&
        !/[.!?]$/.test(combined)
      ) {
        return `<h3>${combined}</h3>`;
      }
      return fullMatch;
    }
  );

  return result;
}

/**
 * Schedule column pattern — matches "Lesson N", "Session N", "Day N",
 * "Period N", or "Class N" in table header cells.
 */
const SCHEDULE_COL_RE = /^((?:Lesson|Session|Day|Period|Class)\s+\d+)/i;

/**
 * Process tables in mammoth HTML output.
 *
 * Teacher-authored DOCXs commonly use table grids for scheme-of-work
 * timelines (Week rows × Lesson columns). Mammoth preserves table tags
 * but `extractFromDOCX`'s heading-based splitter ignores them, collapsing
 * 12 lessons into 1-3 sections.
 *
 * Schedule/timeline tables (those with "Lesson N" or "Session N" columns)
 * are expanded into `<h3>` heading + `<p>` content blocks — one per
 * week × lesson cell. This preserves the grid structure for downstream
 * section splitting.
 *
 * Non-schedule tables (metadata, rubrics) are unwrapped: table/tr/th/td
 * tags removed, inner HTML preserved so bold-heading promotion can still
 * detect patterns like `<p><strong>Unit Overview:</strong></p>`.
 */
function processTablesInHtml(html: string): string {
  return html.replace(/<table[\s\S]*?<\/table>/gi, (tableHtml) => {
    const rows = tableHtml.match(/<tr[\s\S]*?<\/tr>/gi) || [];
    if (rows.length < 2) return unwrapTable(tableHtml);

    // Parse header row cells
    const headerCells = extractTableCells(rows[0]);

    // Find schedule columns (Lesson N, Session N, etc.)
    const scheduleCols: { index: number; name: string }[] = [];
    headerCells.forEach((cellHtml, i) => {
      const text = stripHtml(cellHtml).trim();
      const match = text.match(SCHEDULE_COL_RE);
      if (match) {
        scheduleCols.push({ index: i, name: match[1] });
      }
    });

    // Not a schedule table — unwrap and preserve inner HTML
    if (scheduleCols.length === 0) {
      return unwrapTable(tableHtml);
    }

    // --- Schedule table: expand week × lesson cells into sections ---

    // Optionally find a "variations/differentiation" column
    const varColIdx = headerCells.findIndex((cellHtml) => {
      const t = stripHtml(cellHtml).trim().toLowerCase();
      return t.includes("variation") || t.includes("differentiat") || t.includes("different needs");
    });

    let output = "";
    for (let r = 1; r < rows.length; r++) {
      const cells = extractTableCells(rows[r]);
      if (cells.length === 0) continue;

      // First cell = week/period label
      const weekText = stripHtml(cells[0] || "").trim();
      const weekMatch = weekText.match(/^(\d+(?:\s*[&\-–—,]\s*\d+)*)\s*([\s\S]*)/);
      const weekRaw = weekMatch?.[1] || `${r}`;
      const weekDesc = weekMatch?.[2]?.replace(/^\s*[-–—:]\s*/, "").trim() || "";

      // Expand combined week ranges: "3 & 4" → [3, 4], "5" → [5]
      // A row covering multiple weeks means the same lesson plan repeats
      // each week (e.g., "12 x 72-minute lessons" over 4 weeks, 3 per week).
      const weekNums = expandWeekRange(weekRaw);

      // Get variations/differentiation text if column exists
      const varText =
        varColIdx >= 0 && cells[varColIdx]
          ? stripHtml(cells[varColIdx]).trim()
          : "";

      for (const weekNum of weekNums) {
        for (const col of scheduleCols) {
          const cellHtml = cells[col.index];
          if (!cellHtml) continue;

          const cellText = stripHtml(cellHtml).trim();
          if (cellText.length < 10) continue; // Skip trivial/empty cells

          // Build descriptive heading: "Week 3 - Lesson 1: Production"
          const heading = weekDesc
            ? `Week ${weekNum} - ${col.name}: ${weekDesc}`
            : `Week ${weekNum} - ${col.name}`;

          // Build content, append differentiation notes if available
          let content = cellText;
          if (varText.length > 10) {
            content += `\n\nDifferentiation: ${varText}`;
          }

          output += `<h3>${heading}</h3><p>${content}</p>\n`;
        }
      }
    }

    return output || unwrapTable(tableHtml);
  });
}

/**
 * Extract cell contents from a table row.
 * Handles both `<th>` and `<td>` cells.
 */
function extractTableCells(rowHtml: string): string[] {
  const cells: string[] = [];
  const regex = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
  let match;
  while ((match = regex.exec(rowHtml)) !== null) {
    cells.push(match[1]);
  }
  return cells;
}

/**
 * Unwrap a non-schedule table: remove table/tr/th/td tags but
 * preserve inner HTML (paragraphs, bold text, lists, links).
 * This allows bold-heading promotion to still detect patterns.
 */
function unwrapTable(tableHtml: string): string {
  const rows = tableHtml.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  let output = "";
  for (const row of rows) {
    const cells = extractTableCells(row);
    for (const cellHtml of cells) {
      const content = cellHtml.trim();
      if (content.length > 0) {
        output += content;
      }
    }
  }
  return output;
}

/**
 * Expand a combined week range string into individual week numbers.
 *
 * "3 & 4"  → ["3", "4"]
 * "3-5"    → ["3", "4", "5"]
 * "5"      → ["5"]
 * "1, 2"   → ["1", "2"]
 *
 * Combined rows in schedule tables mean the same lesson plan repeats
 * each week — e.g., a "12 lessons over 4 weeks" document where weeks
 * 3 & 4 share one row but each week has its own 3 class periods.
 */
function expandWeekRange(raw: string): string[] {
  const trimmed = raw.trim();

  // "3 & 4", "3, 4", "3 and 4" → split on separators
  const parts = trimmed.split(/\s*[&,]\s*|\s+and\s+/i).map((s) => s.trim()).filter(Boolean);

  // If any part is a range like "3-5" or "3–5", expand it
  const result: string[] = [];
  for (const part of parts) {
    const rangeMatch = part.match(/^(\d+)\s*[-–—]\s*(\d+)$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      for (let n = start; n <= end; n++) {
        result.push(String(n));
      }
    } else {
      result.push(part);
    }
  }

  return result.length > 0 ? result : [trimmed];
}

// Exported for unit tests — these functions are otherwise private to the module
export { promoteLessonHeadings as _promoteLessonHeadings };
export { promoteBoldToHeadings as _promoteBoldToHeadings };
export { processTablesInHtml as _processTablesInHtml };

/** Strip HTML tags from a string */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
