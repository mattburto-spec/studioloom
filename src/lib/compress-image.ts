import imageCompression from "browser-image-compression";

/**
 * Compress an image file before upload.
 * Non-image files (PDFs, audio, etc.) pass through unchanged.
 * Converts HEIC/PNG to JPEG, strips EXIF metadata.
 */
export async function compressImage(
  file: File,
  opts?: { maxWidthOrHeight?: number; maxSizeMB?: number }
): Promise<File> {
  // Only compress images
  if (!file.type.startsWith("image/")) return file;

  // Skip tiny images (< 100KB) — already small enough
  if (file.size < 100 * 1024) return file;

  const options = {
    maxSizeMB: opts?.maxSizeMB ?? 0.5,
    maxWidthOrHeight: opts?.maxWidthOrHeight ?? 1600,
    useWebWorker: true,
    fileType: "image/jpeg" as const,
    initialQuality: 0.8,
  };

  try {
    const compressed = await imageCompression(file, options);
    // Return as File (not Blob) with original name but .jpg extension
    const name = file.name.replace(/\.[^.]+$/, ".jpg");
    const result = new File([compressed], name, { type: "image/jpeg" });

    console.log(
      `[compress] ${file.name}: ${(file.size / 1024).toFixed(0)}KB → ${(result.size / 1024).toFixed(0)}KB (${Math.round((1 - result.size / file.size) * 100)}% saved)`
    );

    return result;
  } catch {
    // If compression fails, return original file
    console.warn("Image compression failed, using original file");
    return file;
  }
}
