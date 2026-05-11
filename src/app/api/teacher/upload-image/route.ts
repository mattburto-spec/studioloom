// audit-skip: routine teacher pedagogy ops, low audit value
//
// Generic teacher image upload — sibling of /api/teacher/upload-unit-image
// but DOES NOT mutate `units.thumbnail_url`. Used by the lesson editor to
// attach images to activity-block media slots and page-intro hero slots
// without overwriting the unit-thumbnail surface (which has its own
// dedicated route + UI).
//
// Returns the proxy URL — caller writes it into the appropriate field
// (activity.media.url or page.introduction.media.url) and the lesson
// autosave persists it.
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import sharp from "sharp";
import { buildStorageProxyUrl } from "@/lib/storage/proxy-url";
import { requireTeacher } from "@/lib/auth/require-teacher";

// Mirror the unit-thumbnail compression rules so the storage cost
// profile stays the same: max 800×600, JPEG q80 progressive.
async function compressImage(buffer: ArrayBuffer): Promise<Buffer> {
  return sharp(Buffer.from(buffer))
    .resize(800, 600, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 80, progressive: true })
    .toBuffer();
}

export async function POST(request: NextRequest) {
  const auth = await requireTeacher(request);
  if (auth.error) return auth.error;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const unitId = formData.get("unitId") as string | null;

  if (!file || !unitId) {
    return NextResponse.json(
      { error: "file and unitId required" },
      { status: 400 },
    );
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json(
      { error: "File too large (max 5MB)" },
      { status: 400 },
    );
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "Only image files are allowed" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const arrayBuffer = await file.arrayBuffer();
  let imageBuffer: Buffer;
  try {
    imageBuffer = await compressImage(arrayBuffer);
  } catch {
    // If sharp fails (e.g. unsupported format), upload the original
    imageBuffer = Buffer.from(arrayBuffer);
  }

  const timestamp = Date.now();
  const filePath = `${unitId}/blocks/${timestamp}.jpg`;

  const { data, error } = await admin.storage
    .from("unit-images")
    .upload(filePath, imageBuffer, {
      contentType: "image/jpeg",
      upsert: true,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const proxyUrl = buildStorageProxyUrl("unit-images", data.path);

  return NextResponse.json({ url: proxyUrl });
}
