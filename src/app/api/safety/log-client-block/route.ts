// audit-skip: public anonymous safety-badge test, no actor identity
// POST /api/safety/log-client-block
// Logs anonymized client-side block events to student_content_moderation_log.
// No student content is stored — only flag type, severity, source, and lang.
// Uses service role (createAdminClient) because students have no INSERT RLS
// on student_content_moderation_log.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FlagType, Severity, ContentSource } from "@/lib/content-safety/types";

interface LogBody {
  flagType: FlagType;
  severity: Severity;
  source: ContentSource;
  lang: string;
  classId?: string;
  studentId?: string;
}

export async function POST(request: Request) {
  try {
    const body: LogBody = await request.json();
    const { flagType, severity, source, lang, classId, studentId } = body;

    if (!flagType || !severity || !source) {
      return NextResponse.json({ logged: false }, { status: 200 });
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("student_content_moderation_log")
      .insert({
        class_id: classId || null,
        student_id: studentId || "00000000-0000-0000-0000-000000000000",
        content_source: source,
        moderation_layer: "client_text",
        flags: [{ type: flagType, severity, lang }],
        overall_result: severity === "critical" ? "blocked" : "flagged",
        severity,
        action_taken: "logged",
      });

    if (error) {
      console.error("[log-client-block] Insert error:", error.message);
      return NextResponse.json({ logged: false }, { status: 200 });
    }

    return NextResponse.json({ logged: true }, { status: 200 });
  } catch {
    return NextResponse.json({ logged: false }, { status: 200 });
  }
}
