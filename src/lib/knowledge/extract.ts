/**
 * Document text extraction for PDF, DOCX, and PPTX files.
 * Preserves structure (sections/headings) for intelligent chunking.
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

  // ── Bold-heading promotion ──
  // Many teacher-authored docs use bold text for headings instead of Word
  // heading styles. Mammoth only creates <h> tags for styled headings, so
  // bold-only paragraphs appear as <p><strong>text</strong></p>.
  // When no heading styles exist, promote short bold-only paragraphs to
  // <h3> so the section splitter can detect structural boundaries.
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
 * Promote bold-only paragraphs to <h3> headings.
 * Used when mammoth finds no Word heading styles in a DOCX — the next best
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
