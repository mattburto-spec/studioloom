/**
 * Visual content extraction for documents.
 *
 * Uses Claude Vision API to describe images, diagrams, charts, and tables
 * found in uploaded documents. Descriptions become additional searchable
 * chunks in the knowledge base, making visual content discoverable via RAG.
 *
 * Supported formats:
 * - PDF:  Claude's native document API (full page visual analysis)
 * - DOCX: Extract embedded images from mammoth HTML → Claude vision
 * - PPTX: Not yet supported (text extraction only)
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface VisualDescription {
  /** Page number or slide number (1-based) */
  pageOrSlide: number;
  /** What type of visual element this is */
  type:
    | "diagram"
    | "chart"
    | "table"
    | "image"
    | "illustration"
    | "photo"
    | "flowchart"
    | "other";
  /** Detailed description of what the visual shows */
  description: string;
  /** How this visual is used educationally */
  educationalContext: string;
  /** Any text visible in or around the visual (labels, captions, etc.) */
  visibleText?: string;
}

export interface ExtractedImageBuffer {
  data: Buffer;
  ext: string; // "png" | "jpeg" | "gif" | "webp"
}

export interface VisualExtractionResult {
  /** Structured descriptions of each visual element */
  descriptions: VisualDescription[];
  /** Total visual elements found in the document */
  totalImagesFound: number;
  /** Which extraction method was used */
  method: "pdf-document" | "docx-images" | "pptx-images" | "skipped";
  /** Raw image buffers extracted from DOCX/PPTX (for persistent storage) */
  imageBuffers?: ExtractedImageBuffer[];
}

/* ================================================================
   VISION PROMPT
   Sent to Claude along with the document/images.
   Optimised for educational content (design & technology textbooks,
   lesson plans, worksheets).
   ================================================================ */

const VISION_PROMPT = `You are analysing an educational document for its visual content. Describe ALL images, diagrams, charts, tables, flowcharts, and illustrations you can see.

For each visual element, provide a structured description. Focus on EDUCATIONAL VALUE — what concept, process, or skill does this visual teach or demonstrate?

Output valid JSON only:
{
  "visuals": [
    {
      "pageOrSlide": 1,
      "type": "diagram|chart|table|image|illustration|photo|flowchart|other",
      "description": "Detailed description of what the visual shows — shapes, connections, labels, colours, layout",
      "educationalContext": "What concept or process this visual teaches. How a teacher would use it in a lesson.",
      "visibleText": "Any text labels, captions, annotations, or headings visible in or near the visual"
    }
  ],
  "documentHasVisuals": true,
  "totalVisualsFound": 3
}

If there are NO visual elements (text-only document), return:
{ "visuals": [], "documentHasVisuals": false, "totalVisualsFound": 0 }

Guidelines:
- Be thorough — include every diagram, chart, table, and image. Don't skip small figures.
- For TABLES: describe columns, rows, headers, and what data the table organises.
- For DIAGRAMS/FLOWCHARTS: describe the flow, connections, steps, and relationships between elements.
- For CHARTS: describe axes, data trends, and what the chart communicates.
- For DESIGN PROCESS diagrams: identify which design methodology is shown (Double Diamond, Design Thinking, MYP Design Cycle, etc.) and describe each phase.
- Describe visuals in enough detail that someone who cannot see them would fully understand the content.
- Include any labels, annotations, or callouts that appear on or near the visual.
- Note the page number for each visual.`;

/* ================================================================
   MAIN ENTRY POINT
   ================================================================ */

/**
 * Extract and describe visual content from a document.
 *
 * Requires `ANTHROPIC_API_KEY` to be set. Returns empty result (not an error)
 * if the key is missing — vision is an enhancement, not a requirement.
 */
export async function extractVisualContent(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<VisualExtractionResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("[vision] No ANTHROPIC_API_KEY — skipping visual extraction");
    return { descriptions: [], totalImagesFound: 0, method: "skipped" };
  }

  const ext = filename.toLowerCase().split(".").pop();

  try {
    if (mimeType === "application/pdf" || ext === "pdf") {
      return await extractPDFVisuals(buffer);
    }

    if (
      mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      ext === "docx"
    ) {
      return await extractDOCXVisuals(buffer);
    }

    // PPTX: Extract embedded images from the ZIP structure
    if (
      mimeType ===
        "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
      ext === "pptx"
    ) {
      return await extractPPTXVisuals(buffer);
    }

    return { descriptions: [], totalImagesFound: 0, method: "skipped" };
  } catch (err) {
    console.error(
      "[vision] Visual extraction failed:",
      err instanceof Error ? err.message : err
    );
    return { descriptions: [], totalImagesFound: 0, method: "skipped" };
  }
}

/* ================================================================
   PDF → Claude Document API
   Sends the entire PDF to Claude's native document endpoint.
   Claude renders pages internally and can see all visual content.
   ================================================================ */

async function extractPDFVisuals(
  buffer: Buffer
): Promise<VisualExtractionResult> {
  // Skip very large PDFs (>15MB binary → ~20MB base64)
  if (buffer.length > 15 * 1024 * 1024) {
    console.warn("[vision] PDF too large for vision analysis (>15MB), skipping");
    return { descriptions: [], totalImagesFound: 0, method: "pdf-document" };
  }

  const base64 = buffer.toString("base64");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64,
              },
            },
            {
              type: "text",
              text: VISION_PROMPT,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("[vision] PDF vision API error:", response.status, errText);
    return { descriptions: [], totalImagesFound: 0, method: "pdf-document" };
  }

  const data = await response.json();
  const text = data.content?.[0]?.type === "text" ? data.content[0].text : "";

  return parseVisionResponse(text, "pdf-document");
}

/* ================================================================
   DOCX → Extract Embedded Images → Claude Vision
   Mammoth converts DOCX to HTML with inline base64 data URIs.
   We extract those images and send them to Claude as image blocks.
   ================================================================ */

async function extractDOCXVisuals(
  buffer: Buffer
): Promise<VisualExtractionResult> {
  const mammoth = await import("mammoth");
  const result = await mammoth.convertToHtml({ buffer });

  // Extract base64 images from inline data URIs in the HTML
  const imgRegex =
    /<img[^>]+src="data:(image\/(?:png|jpeg|gif|webp));base64,([^"]+)"[^>]*>/gi;
  const images: Array<{ mimeType: string; data: string }> = [];

  let match;
  while ((match = imgRegex.exec(result.value)) !== null) {
    const imgData = match[2];
    // Skip tiny images (<5KB base64 ≈ 3.75KB binary) — likely icons, bullets, decorative
    if (imgData.length > 6666) {
      images.push({ mimeType: match[1], data: imgData });
    }
  }

  if (images.length === 0) {
    return { descriptions: [], totalImagesFound: 0, method: "docx-images" };
  }

  // Also return raw image buffers for persistent storage
  const imageBuffers: ExtractedImageBuffer[] = images.map((img) => ({
    data: Buffer.from(img.data, "base64"),
    ext: img.mimeType.split("/")[1] || "png",
  }));

  const descResult = await describeImageSet(images, "docx-images");
  descResult.imageBuffers = imageBuffers;
  return descResult;
}

/* ================================================================
   PPTX → Extract Embedded Images from ZIP → Claude Vision
   PPTX files are ZIP archives. Images are stored in ppt/media/.
   We extract them and send to Claude for description.
   ================================================================ */

async function extractPPTXVisuals(
  buffer: Buffer
): Promise<VisualExtractionResult> {
  let JSZip: typeof import("jszip");
  try {
    JSZip = (await import("jszip")).default;
  } catch {
    console.warn("[vision] jszip not available — skipping PPTX image extraction");
    return { descriptions: [], totalImagesFound: 0, method: "skipped" };
  }

  const zip = await JSZip.loadAsync(buffer);

  // Find image files in ppt/media/
  const imageFiles: Array<{ name: string; data: string; mimeType: string }> = [];
  const mediaRegex = /^ppt\/media\//;
  const imageExtensions: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    tiff: "image/tiff",
    bmp: "image/bmp",
    emf: "image/emf",
    wmf: "image/wmf",
  };

  for (const [path, file] of Object.entries(zip.files)) {
    if (file.dir || !mediaRegex.test(path)) continue;

    const ext = path.split(".").pop()?.toLowerCase() || "";
    const mimeType = imageExtensions[ext];

    // Skip non-image files and vector formats (emf, wmf) that Claude can't process
    if (!mimeType || ext === "emf" || ext === "wmf") continue;

    try {
      const data = await file.async("base64");
      // Skip tiny images (<5KB base64 ≈ 3.75KB binary) — icons, bullets
      if (data.length > 6666) {
        imageFiles.push({ name: path, data, mimeType });
      }
    } catch {
      // Skip corrupted images
    }
  }

  if (imageFiles.length === 0) {
    return { descriptions: [], totalImagesFound: 0, method: "pptx-images" };
  }

  // Also extract image buffers for persistent storage
  const imageBuffers: ExtractedImageBuffer[] = imageFiles.map((img) => ({
    data: Buffer.from(img.data, "base64"),
    ext: img.mimeType.split("/")[1] || "png",
  }));

  // Try to determine slide numbers from relationships
  // PPTX stores slide→image mappings in ppt/slides/_rels/slide*.xml.rels
  // For now, assign sequential "slide" numbers based on image order
  const images = imageFiles.map((img) => ({
    mimeType: img.mimeType,
    data: img.data,
  }));

  const descResult = await describeImageSet(images, "pptx-images");
  descResult.imageBuffers = imageBuffers;
  return descResult;
}

/* ================================================================
   Image Set → Claude Vision
   Takes a batch of base64-encoded images and asks Claude to
   describe them. Used for DOCX and PPTX image analysis.
   ================================================================ */

async function describeImageSet(
  images: Array<{ mimeType: string; data: string }>,
  method: VisualExtractionResult["method"]
): Promise<VisualExtractionResult> {
  // Cap at 20 images to control token costs
  const toProcess = images.slice(0, 20);

  // Build content blocks: images first, then prompt
  const content: Array<Record<string, unknown>> = [];

  for (const img of toProcess) {
    let imgData = img.data;
    let imgMime = img.mimeType;

    // Resize very large images (>2MB) to save tokens
    const imgBuffer = Buffer.from(imgData, "base64");
    if (imgBuffer.length > 2 * 1024 * 1024) {
      try {
        const sharp = (await import("sharp")).default;
        const resized = await sharp(imgBuffer)
          .resize(1568, 1568, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toBuffer();
        imgData = resized.toString("base64");
        imgMime = "image/jpeg";
      } catch {
        // If sharp fails, send original — Claude can handle it
      }
    }

    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: imgMime,
        data: imgData,
      },
    });
  }

  content.push({
    type: "text",
    text: `There are ${toProcess.length} image(s) extracted from a document. ${VISION_PROMPT}`,
  });

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      messages: [{ role: "user", content }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("[vision] Image analysis API error:", response.status, errText);
    return { descriptions: [], totalImagesFound: images.length, method };
  }

  const data = await response.json();
  const text = data.content?.[0]?.type === "text" ? data.content[0].text : "";

  const result = parseVisionResponse(text, method);
  result.totalImagesFound = images.length;
  return result;
}

/* ================================================================
   Parse Vision AI Response
   Extracts structured JSON from Claude's text response.
   ================================================================ */

function parseVisionResponse(
  text: string,
  method: VisualExtractionResult["method"]
): VisualExtractionResult {
  const empty: VisualExtractionResult = {
    descriptions: [],
    totalImagesFound: 0,
    method,
  };

  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch =
      text.match(/```(?:json)?\s*([\s\S]*?)```/) ||
      text.match(/(\{[\s\S]*\})/);

    if (!jsonMatch?.[1]) {
      console.warn("[vision] No JSON found in vision response");
      return empty;
    }

    const parsed = JSON.parse(jsonMatch[1].trim());

    if (!parsed.documentHasVisuals || !parsed.visuals?.length) {
      return {
        descriptions: [],
        totalImagesFound: 0,
        method,
      };
    }

    const descriptions: VisualDescription[] = parsed.visuals.map(
      (v: any) => ({
        pageOrSlide: v.pageOrSlide ?? 1,
        type: v.type ?? "other",
        description: v.description ?? "",
        educationalContext: v.educationalContext ?? "",
        visibleText: v.visibleText || undefined,
      })
    );

    return {
      descriptions,
      totalImagesFound: parsed.totalVisualsFound ?? descriptions.length,
      method,
    };
  } catch (err) {
    console.error(
      "[vision] Failed to parse vision response:",
      err instanceof Error ? err.message : err
    );
    return empty;
  }
}
