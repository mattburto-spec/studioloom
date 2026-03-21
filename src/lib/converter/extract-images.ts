/**
 * Extract images from DOCX files.
 *
 * DOCX files are ZIP archives. Images live in `word/media/`.
 * We extract them, tag them with their approximate position in the document,
 * and return them as buffers for storage.
 *
 * Note: PDF image extraction is much harder and deferred to a future version.
 * PPTX images could use a similar approach (ppt/media/).
 */

export interface ExtractedImage {
  /** Original filename inside the docx (e.g., "image1.png") */
  filename: string;
  /** Image data as Buffer */
  data: Buffer;
  /** MIME type */
  mimeType: string;
  /** File extension */
  extension: string;
  /** Approximate position: which relationship ID references this image */
  rId?: string;
  /** Size in bytes */
  sizeBytes: number;
}

/**
 * Extract images from a DOCX file buffer.
 *
 * DOCX is a ZIP containing:
 * - word/document.xml (the main document)
 * - word/media/image1.png, image2.jpg, etc.
 * - word/_rels/document.xml.rels (maps rId -> media files)
 *
 * We extract all files from word/media/ and return them as buffers.
 */
export async function extractImagesFromDocx(buffer: Buffer): Promise<ExtractedImage[]> {
  try {
    // Dynamic import to avoid bundling issues
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(buffer);

    const images: ExtractedImage[] = [];
    const mediaFolder = zip.folder("word/media");

    if (!mediaFolder) {
      return [];
    }

    // Get relationship mappings for position context
    const relsFile = zip.file("word/_rels/document.xml.rels");
    const relsMap = new Map<string, string>(); // filename -> rId
    if (relsFile) {
      const relsXml = await relsFile.async("string");
      const relMatches = relsXml.matchAll(/Id="(rId\d+)"[^>]*Target="media\/([^"]+)"/g);
      for (const m of relMatches) {
        relsMap.set(m[2], m[1]);
      }
    }

    // Extract each image file
    const imageExtensions = new Set(["png", "jpg", "jpeg", "gif", "bmp", "tiff", "svg", "webp", "emf", "wmf"]);
    const mimeTypes: Record<string, string> = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      bmp: "image/bmp",
      tiff: "image/tiff",
      svg: "image/svg+xml",
      webp: "image/webp",
      emf: "image/emf",
      wmf: "image/wmf",
    };

    mediaFolder.forEach((relativePath, file) => {
      if (file.dir) return;
      const ext = relativePath.split(".").pop()?.toLowerCase() || "";
      if (imageExtensions.has(ext)) {
        // Queue for extraction
        images.push({
          filename: relativePath,
          data: Buffer.alloc(0), // Will be filled below
          mimeType: mimeTypes[ext] || "application/octet-stream",
          extension: ext,
          rId: relsMap.get(relativePath),
          sizeBytes: 0,
        });
      }
    });

    // Extract image data
    for (let i = 0; i < images.length; i++) {
      const file = mediaFolder.file(images[i].filename);
      if (file) {
        const data = await file.async("nodebuffer");
        images[i].data = data;
        images[i].sizeBytes = data.length;
      }
    }

    // Filter out very small images (likely decorative/spacer images < 1KB)
    return images.filter(img => img.sizeBytes > 1024);
  } catch (err) {
    console.error("[extractImagesFromDocx] Error:", err);
    return [];
  }
}

/**
 * Check if a file is a DOCX (by extension or MIME type).
 */
export function isDocx(filename: string, mimeType?: string): boolean {
  const ext = filename.toLowerCase().split(".").pop();
  return ext === "docx" || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}
