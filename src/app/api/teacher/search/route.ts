import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { withErrorHandler } from "@/lib/api/error-handler";
import type {
  ClassHit,
  StudentHit,
  UnitHit,
  SearchResponse,
} from "@/types/search";

async function getAuthenticatedClient(request: NextRequest) {
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
  return { supabase, user };
}

const PER_BUCKET = 6;

export const GET = withErrorHandler("teacher/search:GET", async (request: NextRequest) => {
  const { supabase, user } = await getAuthenticatedClient(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const rawQ = (url.searchParams.get("q") ?? "").trim();
  // ilike pattern — escape % and _ so user input is literal, then wrap.
  const escaped = rawQ.replace(/[\\%_]/g, (m) => `\\${m}`);
  const pattern = `%${escaped}%`;

  const empty: SearchResponse = { query: rawQ, classes: [], units: [], lessons: [], students: [] };
  if (rawQ.length < 2) {
    return NextResponse.json(empty);
  }

  const teacherId = user.id;

  // Get this teacher's class IDs first — every search is scoped to classes
  // they own. Co-teaching gates on Access Model v2 (FU-O).
  const { data: classRows } = await supabase
    .from("classes")
    .select("id, name, code")
    .eq("teacher_id", teacherId)
    .neq("is_archived", true);

  const ownedClasses = (classRows ?? []) as Array<{ id: string; name: string; code: string }>;
  const classIds = ownedClasses.map((c) => c.id);

  // Run the three searches in parallel.
  const [classMatchesRes, classUnitsRes, studentMatchesRes] = await Promise.all([
    // Classes — match on name OR code, restricted to this teacher
    supabase
      .from("classes")
      .select("id, name, code")
      .eq("teacher_id", teacherId)
      .neq("is_archived", true)
      .or(`name.ilike.${pattern},code.ilike.${pattern}`)
      .limit(PER_BUCKET),
    // Units — only units assigned to one of this teacher's classes via class_units
    classIds.length > 0
      ? supabase
          .from("class_units")
          .select("unit_id, class_id, units!inner(id, title)")
          .in("class_id", classIds)
          .eq("is_active", true)
          .ilike("units.title", pattern)
          .limit(PER_BUCKET * 2)
      : Promise.resolve({ data: [] as Array<{ unit_id: string; class_id: string; units: { id: string; title: string } }> }),
    // Students — via class_students junction, scoped to teacher's classes
    classIds.length > 0
      ? supabase
          .from("class_students")
          .select("student_id, class_id, students!inner(id, username, display_name)")
          .in("class_id", classIds)
          .eq("is_active", true)
          .or(`username.ilike.${pattern},display_name.ilike.${pattern}`, {
            referencedTable: "students",
          })
          .limit(PER_BUCKET * 2)
      : Promise.resolve({ data: [] as Array<{ student_id: string; class_id: string; students: { id: string; username: string; display_name: string | null } }> }),
  ]);

  const classNameById = new Map(ownedClasses.map((c) => [c.id, c.name]));

  const classes: ClassHit[] = ((classMatchesRes.data ?? []) as Array<{ id: string; name: string; code: string }>).map(
    (c) => ({
      type: "class",
      id: c.id,
      title: c.name,
      subtitle: c.code ?? null,
      href: `/teacher/classes/${c.id}`,
    })
  );

  // Dedup units by id (one unit may be in multiple classes); keep first class as subtitle.
  const unitsSeen = new Set<string>();
  const units: UnitHit[] = [];
  for (const row of (classUnitsRes.data ?? []) as Array<{
    unit_id: string;
    class_id: string;
    units: { id: string; title: string };
  }>) {
    if (!row.units || unitsSeen.has(row.units.id)) continue;
    unitsSeen.add(row.units.id);
    units.push({
      type: "unit",
      id: row.units.id,
      title: row.units.title,
      subtitle: classNameById.get(row.class_id) ?? null,
      href: `/teacher/units/${row.units.id}`,
    });
    if (units.length >= PER_BUCKET) break;
  }

  // Dedup students by id; keep first class as subtitle.
  const studentsSeen = new Set<string>();
  const students: StudentHit[] = [];
  for (const row of (studentMatchesRes.data ?? []) as Array<{
    student_id: string;
    class_id: string;
    students: { id: string; username: string; display_name: string | null };
  }>) {
    if (!row.students || studentsSeen.has(row.students.id)) continue;
    studentsSeen.add(row.students.id);
    const display = row.students.display_name?.trim() || row.students.username;
    students.push({
      type: "student",
      id: row.students.id,
      title: display,
      subtitle: classNameById.get(row.class_id) ?? null,
      href: `/teacher/students/${row.students.id}`,
    });
    if (students.length >= PER_BUCKET) break;
  }

  const response: SearchResponse = { query: rawQ, classes, units, lessons: [], students };
  return NextResponse.json(response);
});
