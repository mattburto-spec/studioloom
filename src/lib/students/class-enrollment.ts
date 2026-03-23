/**
 * Student-Class Enrollment Helpers (migration 041)
 *
 * Abstracts the class_students junction table so that the rest of the
 * codebase can migrate from `students.class_id` one file at a time.
 *
 * All functions accept a Supabase client (browser or admin).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Student, ClassStudent } from "@/types";

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

/**
 * Get all ACTIVE students enrolled in a class (replaces
 * `supabase.from("students").select("*").eq("class_id", classId)`)
 */
export async function getStudentsForClass(
  supabase: SupabaseClient,
  classId: string
): Promise<Student[]> {
  // Join through class_students to get active enrollments
  const { data, error } = await supabase
    .from("class_students")
    .select("student_id, ell_level_override, students(*)")
    .eq("class_id", classId)
    .eq("is_active", true);

  if (error || !data) return [];

  return data.map((row: any) => {
    const student = row.students as Student;
    // Apply per-enrollment ELL override if set
    if (row.ell_level_override != null) {
      student.ell_level = row.ell_level_override;
    }
    return student;
  });
}

/**
 * Get all classes a student is enrolled in (active only by default).
 */
export async function getClassesForStudent(
  supabase: SupabaseClient,
  studentId: string,
  includeInactive = false
): Promise<Array<ClassStudent & { class_name?: string; class_code?: string }>> {
  let query = supabase
    .from("class_students")
    .select("*, classes(name, code)")
    .eq("student_id", studentId)
    .order("enrolled_at", { ascending: false });

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row: any) => ({
    ...row,
    class_name: row.classes?.name,
    class_code: row.classes?.code,
    classes: undefined, // Clean up the nested object
  }));
}

/**
 * Get all students belonging to a teacher (across all classes).
 * Includes enrollment info.
 */
export async function getStudentsForTeacher(
  supabase: SupabaseClient,
  teacherId: string
): Promise<Student[]> {
  const { data, error } = await supabase
    .from("students")
    .select("*")
    .eq("author_teacher_id", teacherId);

  if (error || !data) return [];
  return data as Student[];
}

// ---------------------------------------------------------------------------
// Write helpers
// ---------------------------------------------------------------------------

/**
 * Create a new student belonging to a teacher (not enrolled in any class yet).
 */
export async function createStudent(
  supabase: SupabaseClient,
  teacherId: string,
  data: { username: string; display_name?: string; ell_level?: number }
): Promise<{ student: Student | null; error: string | null }> {
  const { data: student, error } = await supabase
    .from("students")
    .insert({
      username: data.username.trim().toLowerCase(),
      display_name: data.display_name?.trim() || null,
      ell_level: data.ell_level || 3,
      author_teacher_id: teacherId,
      class_id: null, // No class — independent student
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return { student: null, error: "A student with this username already exists." };
    }
    return { student: null, error: error.message };
  }

  return { student: student as Student, error: null };
}

/**
 * Create a student AND enroll them in a class in one step.
 * (Replaces the old single-insert pattern.)
 */
export async function createAndEnroll(
  supabase: SupabaseClient,
  teacherId: string,
  classId: string,
  data: { username: string; display_name?: string; ell_level?: number }
): Promise<{ student: Student | null; error: string | null }> {
  // Check if student already exists for this teacher
  const { data: existing } = await supabase
    .from("students")
    .select("id")
    .eq("author_teacher_id", teacherId)
    .eq("username", data.username.trim().toLowerCase())
    .maybeSingle();

  if (existing) {
    // Student exists — just enroll them
    const enrollResult = await enrollStudent(supabase, existing.id, classId);
    if (enrollResult.error) return { student: null, error: enrollResult.error };

    // Fetch full student record
    const { data: student } = await supabase
      .from("students")
      .select("*")
      .eq("id", existing.id)
      .single();

    return { student: student as Student, error: null };
  }

  // Create new student
  const { student, error } = await createStudent(supabase, teacherId, data);
  if (error || !student) return { student: null, error };

  // Also set legacy class_id for backward compat
  await supabase
    .from("students")
    .update({ class_id: classId })
    .eq("id", student.id);

  // Enroll in class
  await enrollStudent(supabase, student.id, classId);

  return { student: { ...student, class_id: classId }, error: null };
}

/**
 * Enroll a student in a class.
 * If previously unenrolled, reactivates the enrollment.
 */
export async function enrollStudent(
  supabase: SupabaseClient,
  studentId: string,
  classId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("class_students")
    .upsert(
      {
        student_id: studentId,
        class_id: classId,
        is_active: true,
        enrolled_at: new Date().toISOString(),
        unenrolled_at: null,
      },
      { onConflict: "student_id,class_id" }
    );

  if (error) return { error: error.message };

  // Update legacy class_id for backward compat
  await supabase
    .from("students")
    .update({ class_id: classId })
    .eq("id", studentId);

  return { error: null };
}

/**
 * Unenroll a student from a class (soft — student record persists).
 */
export async function unenrollStudent(
  supabase: SupabaseClient,
  studentId: string,
  classId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("class_students")
    .update({
      is_active: false,
      unenrolled_at: new Date().toISOString(),
    })
    .eq("student_id", studentId)
    .eq("class_id", classId);

  if (error) return { error: error.message };

  // If this was the legacy class_id, clear it and set to most recent active enrollment
  const { data: activeEnrollments } = await supabase
    .from("class_students")
    .select("class_id")
    .eq("student_id", studentId)
    .eq("is_active", true)
    .order("enrolled_at", { ascending: false })
    .limit(1);

  const newClassId = activeEnrollments?.[0]?.class_id || null;
  await supabase
    .from("students")
    .update({ class_id: newClassId })
    .eq("id", studentId);

  return { error: null };
}
