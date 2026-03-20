import { NextResponse } from "next/server";

/**
 * @deprecated — Own Time has been replaced by Open Studio.
 * Use /api/student/open-studio/status instead.
 */
export async function GET() {
  return NextResponse.json(
    {
      error:
        "Own Time has been replaced by Open Studio. Use /api/student/open-studio/status instead.",
    },
    { status: 410 }
  );
}
