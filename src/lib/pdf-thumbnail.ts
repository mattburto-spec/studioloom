/**
 * Client-side PDF image extraction.
 * Loads pdfjs from CDN to bypass Next.js webpack bundling issues.
 * Renders PDF pages to canvas and returns JPEG blobs.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pdfjsLibPromise: Promise<any> | null = null;

/** Load pdfjs-dist from CDN (bypasses webpack entirely) */
function loadPdfjsFromCDN() {
  if (pdfjsLibPromise) return pdfjsLibPromise;

  const cdnUrl = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.9.155/build/pdf.min.mjs";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdfjsLibPromise = import(/* webpackIgnore: true */ cdnUrl).then((mod: any) => {
    mod.GlobalWorkerOptions.workerSrc =
      "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.9.155/build/pdf.worker.min.mjs";
    return mod;
  });

  return pdfjsLibPromise;
}

/** Render a single PDF page to a JPEG blob */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function renderPage(page: any, maxWidth: number): Promise<Blob | null> {
  const unscaledViewport = page.getViewport({ scale: 1 });
  const scale = maxWidth / unscaledViewport.width;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  await page.render({ canvasContext: ctx, viewport }).promise;

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.85);
  });
}

/**
 * Generate a JPEG thumbnail from page 1 of a PDF.
 * Returns null if rendering fails (non-fatal).
 */
export async function generatePDFThumbnail(
  file: File,
  maxWidth = 400
): Promise<Blob | null> {
  try {
    const pdfjsLib = await loadPdfjsFromCDN();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
    const page = await pdf.getPage(1);
    const blob = await renderPage(page, maxWidth);
    pdf.destroy();
    return blob;
  } catch (err) {
    console.warn("[pdf-thumbnail] Failed to generate thumbnail:", err);
    return null;
  }
}

export interface PDFPageImage {
  pageNumber: number;
  blob: Blob;
}

/**
 * Render all pages of a PDF as JPEG images.
 * Capped at maxPages to avoid browser memory issues.
 * Returns array of { pageNumber, blob } for each successfully rendered page.
 */
export async function extractPDFPageImages(
  file: File,
  maxWidth = 600,
  maxPages = 30
): Promise<PDFPageImage[]> {
  try {
    const pdfjsLib = await loadPdfjsFromCDN();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;

    const pageCount = Math.min(pdf.numPages, maxPages);
    const results: PDFPageImage[] = [];

    for (let i = 1; i <= pageCount; i++) {
      try {
        const page = await pdf.getPage(i);
        const blob = await renderPage(page, maxWidth);
        if (blob) {
          results.push({ pageNumber: i, blob });
        }
      } catch {
        // Skip failed pages, continue with rest
      }
    }

    pdf.destroy();
    return results;
  } catch (err) {
    console.warn("[pdf-images] Failed to extract page images:", err);
    return [];
  }
}
