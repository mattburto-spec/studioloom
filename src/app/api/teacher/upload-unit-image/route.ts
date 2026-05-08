// audit-skip: routine teacher pedagogy ops, low audit value
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@supabase/ssr";
import sharp from "sharp";
import { buildStorageProxyUrl } from "@/lib/storage/proxy-url";

// Verify teacher auth from Supabase cookies
async function getTeacherId(request: NextRequest): Promise<string | null> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {},
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id || null;
}

// Resize and compress image for thumbnail use
// Max 800px wide, JPEG at 80% quality — keeps files under ~100KB
async function compressImage(buffer: ArrayBuffer): Promise<Buffer> {
  return sharp(Buffer.from(buffer))
    .resize(800, 600, {
      fit: "inside", // maintain aspect ratio, fit within 800x600
      withoutEnlargement: true, // don't upscale small images
    })
    .jpeg({ quality: 80, progressive: true })
    .toBuffer();
}

// POST: Upload a unit image to Supabase Storage
export async function POST(request: NextRequest) {
  const teacherId = await getTeacherId(request);
  if (!teacherId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const unitId = formData.get("unitId") as string | null;

  if (!file || !unitId) {
    return NextResponse.json(
      { error: "file and unitId required" },
      { status: 400 }
    );
  }

  // Validate file size (5MB max for raw upload)
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json(
      { error: "File too large (max 5MB)" },
      { status: 400 }
    );
  }

  // Validate file type
  if (!file.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "Only image files are allowed" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Compress and resize before uploading
  const arrayBuffer = await file.arrayBuffer();
  let imageBuffer: Buffer;
  try {
    imageBuffer = await compressImage(arrayBuffer);
  } catch {
    // If sharp fails (e.g. unsupported format), upload the original
    imageBuffer = Buffer.from(arrayBuffer);
  }

  // Always save as .jpg since we convert to JPEG
  const timestamp = Date.now();
  const filePath = `${unitId}/${timestamp}.jpg`;

  // Upload compressed image to Supabase Storage
  const { data, error } = await admin.storage
    .from("unit-images")
    .upload(filePath, imageBuffer, {
      contentType: "image/jpeg",
      upsert: true,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Build proxy URL — bucket is private (security-plan.md P-3); the
  // /api/storage/unit-images/* endpoint auth-gates + 302s to a fresh signed URL.
  const proxyUrl = buildStorageProxyUrl("unit-images", data.path);

  // Update the unit's thumbnail_url
  const { error: updateError } = await admin
    .from("units")
    .update({ thumbnail_url: proxyUrl })
    .eq("id", unitId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ url: proxyUrl });
}
