import { NextRequest, NextResponse } from "next/server";
import { extractDocument } from "@/lib/ingestion/document-extract";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".pptx"];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5MB." },
        { status: 400 }
      );
    }

    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: "Unsupported file type. Please upload a PDF, DOCX, or PPTX file." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const doc = await extractDocument(buffer, file.name, file.type);

    // Truncate to 2000 chars to match the criterion field limit
    const text = (doc.rawText || "").trim().slice(0, 2000);

    if (!text) {
      return NextResponse.json(
        { error: "Could not extract text from this file. It may be empty or image-only." },
        { status: 422 }
      );
    }

    return NextResponse.json({ text });
  } catch (error) {
    console.error("[extract-rubric]", error);
    return NextResponse.json(
      { error: "Failed to extract text from file." },
      { status: 500 }
    );
  }
}
