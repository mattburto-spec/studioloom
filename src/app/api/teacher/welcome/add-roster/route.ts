/**
 * POST /api/teacher/welcome/add-roster
 *
 * Phase 1B — Teacher Onboarding Flow. Called from step 3 of `/teacher/welcome`.
 *
 * Bulk-inserts a roster into the teacher's freshly-created class. Mirrors the
 * parsing rules from the classes-page `addStudentsBulk()` flow (see
 * `src/app/teacher/classes/[classId]/page.tsx`) so a teacher who later edits
 * their roster there gets the same username conventions.
 *
 * Parsing:
 *   - "username, Display Name"      → username + display name
 *   - "username\tDisplay Name"       → username + display name
 *   - "Display Name" (two+ words)    → first-initial + last-name username
 *   - "username" (single token)      → username, no display name
 *
 * Roster step is optional — a teacher can hit "Skip" and still complete
 * onboarding. This endpoint only runs when they actually paste students.
 *
 * Returns the inserted students so the wizard can show a credentials sheet
 * without a second round-trip.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import {
  requireTeacherAuth,
  verifyTeacherOwnsClass,
} from "@/lib/auth/verify-teacher-unit";
import { provisionStudentAuthUser } from "@/lib/access-v2/provision-student-auth-user";

type RosterInput = { name?: string; username?: string };

interface ParsedStudent {
  username: string;
  display_name: string | null;
  class_id: string;
  author_teacher_id: string;
  school_id: string | null;
}

/**
 * Normalise a single roster line (or object) into a parsed student row.
 * Returns null if the line yields no usable username.
 *
 * `schoolId` is denormalised onto every student per Phase 0.3 (mig
 * 20260428134250). After 0.8b NOT NULL tighten, students.school_id is required
 * — caller MUST resolve it from classes.school_id before invoking parseEntry.
 */
function parseEntry(
  entry: RosterInput,
  classId: string,
  teacherId: string,
  schoolId: string | null
): ParsedStudent | null {
  const rawUsername = entry.username?.trim();
  const rawName = entry.name?.trim();

  let username: string;
  let displayName: string | null = null;

  if (rawUsername) {
    // Explicit username — take it as-is, lowercased + scrubbed of stray chars.
    username = rawUsername.toLowerCase().replace(/[^a-z0-9._-]/g, "");
    displayName = rawName || null;
  } else if (rawName && rawName.includes(" ")) {
    // Derive "jsmith" style username from "John Smith"
    displayName = rawName;
    const parts = rawName.toLowerCase().split(/\s+/);
    username =
      parts.length >= 2
        ? parts[0][0] + parts[parts.length - 1]
        : parts[0];
    username = username.replace(/[^a-z0-9]/g, "");
  } else if (rawName) {
    // Single token — use it directly as username.
    username = rawName.toLowerCase().replace(/[^a-z0-9._-]/g, "");
  } else {
    return null;
  }

  if (!username) return null;

  return {
    username,
    display_name: displayName,
    class_id: classId,
    author_teacher_id: teacherId,
    school_id: schoolId,
  };
}

export const POST = withErrorHandler(
  "teacher/welcome/add-roster:POST",
  async (request: NextRequest) => {
    const auth = await requireTeacherAuth(request);
    if (auth.error) return auth.error;
    const teacherId = auth.teacherId;

    let body: { classId?: string; roster?: RosterInput[] };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const classId = body.classId?.trim();
    const roster = Array.isArray(body.roster) ? body.roster : [];

    if (!classId || !/^[0-9a-f-]{36}$/i.test(classId)) {
      return NextResponse.json(
        { error: "Valid classId is required" },
        { status: 400 }
      );
    }

    if (roster.length === 0) {
      return NextResponse.json({
        added: 0,
        skipped: [],
        students: [],
      });
    }

    // Ownership check — can't bulk-paste students into someone else's class.
    const owns = await verifyTeacherOwnsClass(teacherId, classId);
    if (!owns) {
      return NextResponse.json(
        { error: "Class not found or not yours" },
        { status: 403 }
      );
    }

    const supabase = createAdminClient();

    // Resolve the class's school_id ONCE — every roster student lands in the
    // same class so they share school_id. Required since Phase 0.8b tightened
    // students.school_id NOT NULL.
    const { data: classRow } = await supabase
      .from("classes")
      .select("school_id")
      .eq("id", classId)
      .single();
    const schoolId: string | null = classRow?.school_id ?? null;

    // Fetch existing usernames globally so we don't collide with users in
    // *any* class the teacher already owns. `students.username` is unique
    // across the whole table, so this matches DB reality.
    const { data: existing } = await supabase
      .from("students")
      .select("username");
    const existingUsernames = new Set(
      (existing || [])
        .map((s: { username: string | null }) => s.username?.toLowerCase())
        .filter((u): u is string => !!u)
    );

    const toInsert: ParsedStudent[] = [];
    const skipped: string[] = [];

    for (const entry of roster) {
      const parsed = parseEntry(entry, classId, teacherId, schoolId);
      if (!parsed) {
        skipped.push(entry.name || entry.username || "(empty line)");
        continue;
      }
      if (
        existingUsernames.has(parsed.username) ||
        toInsert.some((s) => s.username === parsed.username)
      ) {
        skipped.push(`${parsed.display_name || parsed.username} (duplicate)`);
        continue;
      }
      toInsert.push(parsed);
    }

    if (toInsert.length === 0) {
      return NextResponse.json({ added: 0, skipped, students: [] });
    }

    const { data: inserted, error: insertErr } = await supabase
      .from("students")
      .insert(toInsert)
      .select("id, username, display_name");

    if (insertErr || !inserted) {
      console.error(
        "[welcome/add-roster] students insert failed:",
        insertErr?.message
      );
      return NextResponse.json(
        { error: insertErr?.message || "Insert failed" },
        { status: 500 }
      );
    }

    // Enroll each student in the class via the junction table. If this fails,
    // the students row still exists — teacher can re-add from the class page
    // without losing data.
    const enrollments = inserted.map((s) => ({
      student_id: s.id,
      class_id: classId,
      is_active: true,
    }));
    const { error: enrollErr } = await supabase
      .from("class_students")
      .insert(enrollments);

    if (enrollErr) {
      console.warn(
        "[welcome/add-roster] class_students insert warning:",
        enrollErr.message
      );
    }

    // Phase 1.1d — provision auth.users rows for the new students. Per-student
    // failures are logged but do not fail the bulk roster import; lazy-provision
    // on first login (Phase 1.2 student-classcode-login) is the safety net.
    // Reuses the schoolId resolved earlier (line ~138) for the parseEntry path.

    let provisionFailures = 0;
    for (const s of inserted) {
      const result = await provisionStudentAuthUser(supabase, {
        id: s.id,
        user_id: null,
        school_id: schoolId,
      });
      if (!result.ok) {
        provisionFailures += 1;
        console.error(
          `[welcome/add-roster] provisionStudentAuthUser failed for student=${s.id}: ${result.error}`
        );
      }
    }
    if (provisionFailures > 0) {
      console.warn(
        `[welcome/add-roster] ${provisionFailures}/${inserted.length} students need lazy auth provisioning on first login`
      );
    }

    return NextResponse.json({
      added: inserted.length,
      skipped,
      students: inserted.map((s) => ({
        id: s.id,
        username: s.username,
        displayName: s.display_name,
      })),
    });
  }
);
