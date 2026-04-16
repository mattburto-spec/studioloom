/**
 * AI Timetable Parser — POST /api/teacher/timetable/parse-upload
 *
 * Accepts a PDF or image upload of a teacher's timetable.
 * Uses Claude Sonnet to extract structured timetable data:
 * - Cycle length (number of days)
 * - Period structure (times, durations)
 * - Class entries with AI classification (teaching vs non-teaching)
 *
 * Non-teaching detection rules:
 * - "Advisory" / "Homeroom" / "Tutor" → non-teaching
 * - "Duty" / "Supervision" / "Recess" / "Lunch" → non-teaching
 * - "Planning" / "PLC" / "Meeting" → non-teaching (unless clearly a class name)
 * - "Service" → borderline (flagged for teacher review)
 * - Duration significantly shorter than other entries → flagged
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";

// Claude vision calls on complex timetable images can take 30-60s
export const maxDuration = 120;

const SONNET_MODEL = "claude-sonnet-4-6";

export async function POST(request: NextRequest) {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI service not configured" }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Unsupported file type. Upload a PDF or image (PNG, JPG, WebP)." },
        { status: 400 }
      );
    }

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    // Determine media type for the API
    const mediaType = file.type === "application/pdf" ? "application/pdf" : file.type;

    // Build content block based on file type
    const isPdf = file.type === "application/pdf";
    const contentBlock = isPdf
      ? {
          type: "document" as const,
          source: {
            type: "base64" as const,
            media_type: "application/pdf" as const,
            data: base64,
          },
        }
      : {
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: mediaType as "image/png" | "image/jpeg" | "image/webp",
            data: base64,
          },
        };

    // Call Claude Sonnet with the image/PDF
    // PDF support is GA — no beta header needed
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    };

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: SONNET_MODEL,
        max_tokens: 16384,
        temperature: 0,
        system: TIMETABLE_PARSER_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              contentBlock,
              {
                type: "text",
                text: "Extract the complete timetable from this document. Return ONLY the JSON object — no markdown, no explanation, no code fences. Start directly with { and end with }.",
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[timetable-parse] Claude API error:", response.status, errText);
      return NextResponse.json(
        { error: `AI parsing failed (${response.status}). Details: ${errText.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    console.log("[timetable-parse] API response status:", response.status, "stop_reason:", data.stop_reason, "model:", data.model, "usage:", JSON.stringify(data.usage));
    const textBlock = data.content?.find((b: { type: string }) => b.type === "text");
    const rawText = textBlock?.text || "";

    if (!rawText) {
      const blockTypes = data.content?.map((b: { type: string }) => b.type) || [];
      console.error("[timetable-parse] Empty text response. Content blocks:", JSON.stringify(blockTypes), "Full response:", JSON.stringify(data).slice(0, 500));
      return NextResponse.json(
        { error: `AI returned empty text. Content block types: [${blockTypes.join(", ")}]. Stop reason: ${data.stop_reason || "unknown"}. Try a PNG screenshot instead.` },
        { status: 422 }
      );
    }

    // Extract JSON from the response — try multiple strategies
    let parsed;
    try {
      // Strategy 1: Direct JSON parse (if response is clean JSON)
      try {
        parsed = JSON.parse(rawText.trim());
      } catch {
        // Strategy 2: Extract from ```json code fence
        const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (fenceMatch) {
          parsed = JSON.parse(fenceMatch[1].trim());
        } else {
          // Strategy 3: Find the outermost { ... } in the text
          const firstBrace = rawText.indexOf("{");
          const lastBrace = rawText.lastIndexOf("}");
          if (firstBrace !== -1 && lastBrace > firstBrace) {
            parsed = JSON.parse(rawText.slice(firstBrace, lastBrace + 1));
          } else {
            throw new Error("No JSON object found in response");
          }
        }
      }
    } catch (parseErr) {
      console.error("[timetable-parse] JSON parse error:", parseErr, "Raw text (first 1000 chars):", rawText.slice(0, 1000));
      const stopReason = data.stop_reason || "unknown";
      const hint = stopReason === "max_tokens" ? " (response was truncated — try a simpler timetable image)" : "";
      return NextResponse.json(
        { error: `Could not parse AI response as JSON${hint}. Stop reason: ${stopReason}. AI said: "${rawText.slice(0, 200)}..."` },
        { status: 422 }
      );
    }

    // Validate the parsed structure
    if (!parsed.cycle_length || !parsed.entries || !Array.isArray(parsed.entries)) {
      return NextResponse.json(
        { error: "AI response missing required fields. Try a different image." },
        { status: 422 }
      );
    }

    return NextResponse.json({
      cycle_length: parsed.cycle_length,
      periods: parsed.periods || [],
      entries: parsed.entries,
      room: parsed.room || null,
      school_name: parsed.school_name || null,
      teacher_name: parsed.teacher_name || null,
      ai_notes: parsed.notes || null,
    });
  } catch (err) {
    console.error("[timetable-parse] Error:", err);
    return NextResponse.json(
      { error: "Failed to parse timetable" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// System prompt for timetable extraction
// ---------------------------------------------------------------------------

const TIMETABLE_PARSER_SYSTEM_PROMPT = `You are a school timetable parser. Given an image or PDF of a teacher's timetable, extract the complete schedule as structured JSON.

## Your task

Analyse the timetable and return a JSON object with this exact structure:

\`\`\`json
{
  "school_name": "string or null",
  "teacher_name": "string or null",
  "cycle_length": number,
  "room": "primary room if consistent, or null",
  "periods": [
    {
      "period_number": 1,
      "start_time": "08:00",
      "end_time": "09:05",
      "duration_minutes": 65
    }
  ],
  "entries": [
    {
      "day": 1,
      "period": 1,
      "class_name": "7 Design",
      "grade_level": "Grade 7",
      "room": "Design Centre 3",
      "start_time": "08:00",
      "end_time": "09:05",
      "is_teaching": true,
      "classification": "teaching",
      "classification_reason": "Design class with grade level"
    }
  ],
  "detected_classes": [
    {
      "name": "7 Design",
      "grade": "Grade 7",
      "occurrences": 4,
      "is_teaching": true
    }
  ],
  "notes": "string with any observations about the timetable"
}
\`\`\`

## Handling complex timetables

Real school timetables are messy. You MUST handle these complications:

1. **Rotating cycles (5-10 day):** The timetable may show Day 1 through Day 8 (or more) as columns. Count ALL day columns for cycle_length, not just Mon-Fri.

2. **Varying schedules per weekday:** Some weekdays may have different period times or structures. For example:
   - Mon/Wed/Thu might have 5 periods starting at 8:00
   - Tuesday might skip advisory and end early at 2:30pm
   - Friday might start with 40 minutes of assembly or extended advisory
   - Period start/end times may differ across days — extract the times that appear in EACH cell, not just from a single header row

3. **Assembly / Chapel / Extended Advisory blocks:** These appear as time blocks that replace or precede normal periods on certain days. Mark them as NON-TEACHING.

4. **Service Learning / Service as Action:** Usually a recurring weekly block (e.g. every Day 5 Period 3). Mark as BORDERLINE — is_teaching: true but flag in classification_reason.

5. **Split period numbers:** Some timetables show "Block 3" or "Period 3" with different content on different days of the cycle. Each day-period combination is a separate entry.

6. **Merged cells / multi-period blocks:** If a class spans multiple periods, create an entry for EACH period it occupies.

7. **The teacher only teaches SOME periods:** Most cells may be empty or show non-teaching activities. The goal is to identify the teacher's actual teaching classes among everything else.

## Classification rules

For each entry, determine if it's a TEACHING class or NON-TEACHING activity:

**NON-TEACHING (is_teaching: false):**
- Advisory / Homeroom / Tutor group / Form time / Extended Advisory
- Duty / Yard duty / Supervision / Bus duty
- Planning / PLC / Professional learning / Meeting / Staff meeting
- Recess / Lunch / Break (these won't usually appear but if they do)
- Assembly / Chapel / Extended Assembly
- Free / Unassigned / PPA / Non-contact / Release

**TEACHING (is_teaching: true):**
- Any entry with a subject name + grade level (e.g. "7 Design", "10 Science", "Grade 8 Art")
- Classes in specific teaching rooms with subject-like names
- Electives / Options with a subject name

**BORDERLINE (is_teaching: true but flag in classification_reason):**
- "Service as Action" / "Service Learning" — supervised student programs, treat as teaching but note it
- "Planning Design" with a grade range (e.g. "6-10 Planning Design") — this is likely a class, treat as teaching
- Any ambiguous entry where you're unsure — mark as teaching and explain in classification_reason so the teacher can toggle it off

## Key rules:
1. Count the number of day columns to determine cycle_length. An 8-day cycle has 8 columns labeled Day 1-8.
2. Period numbers are usually shown in the leftmost column
3. Extract exact times from each entry if shown. If times vary per day, use the time shown in that specific cell.
4. The same class may appear multiple times across different days — group them in detected_classes
5. Use the grade level text (e.g. "Grade 6", "Grade 9") to determine grade, NOT the number prefix in the class name (though they usually match)
6. If a cell is empty, don't create an entry for it
7. When in doubt, INCLUDE the entry rather than skipping it — the teacher can toggle it off
8. Return ONLY the JSON — no explanation text before or after`;
