// audit-skip: low-blast-radius teacher image upload for library cards.
//
// Sibling of /api/teacher/upload-image but does NOT take a unitId —
// choice cards are a school-wide LIBRARY entity, not unit-scoped.
// Writes to `unit-images/choice-cards/{timestamp}.jpg`. Same sharp
// compression rules as upload-image (max 800×600, JPEG q80 progressive)
// to keep storage cost profile consistent.
//
// Returns the proxy URL — caller assigns to the card's image_url on
// create (POST /api/teacher/choice-cards) or update (PATCH .../[cardId]).
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import sharp from "sharp";
import { buildStorageProxyUrl } from "@/lib/storage/proxy-url";
import { requireTeacher } from "@/lib/auth/require-teacher";

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

  if (!file) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
  }

  const admin = createAdminClient();

  const arrayBuffer = await file.arrayBuffer();
  let imageBuffer: Buffer;
  try {
    imageBuffer = await compressImage(arrayBuffer);
  } catch {
    imageBuffer = Buffer.from(arrayBuffer);
  }

  const timestamp = Date.now();
  const filePath = `choice-cards/${timestamp}.jpg`;

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
