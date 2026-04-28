/**
 * Read-only DB inspection — dump the current state of classes, units,
 * enrollments, and surface multi-class students. Useful any time you're
 * debugging "which class is this student in / which units does this
 * class own / which classes share the same student".
 *
 * Originally written 28 Apr 2026 to diagnose the multi-class context
 * bugs (Bug 1 / 1.5 / 2 / 4) — kept here because the same questions
 * come up whenever class enrollment data behaves unexpectedly.
 *
 * Usage:
 *   node scripts/dev/list-class-units.mjs
 *
 * Reads .env.local for SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 * No writes, no side effects.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// Load env from .env.local manually (avoid dotenv dependency).
const envText = readFileSync("/Users/matt/CWORK/questerra/.env.local", "utf8");
const env = Object.fromEntries(
  envText
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, "")];
    })
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// 1. Find Matt's teacher row.
const { data: teachers } = await sb.from("teachers").select("id, email, name").limit(20);
console.log("--- teachers ---");
for (const t of teachers ?? []) console.log(`  ${t.id}  ${t.email ?? "(no email)"}  ${t.name ?? ""}`);

// 2. Pull all classes with their teacher.
const { data: classes } = await sb
  .from("classes")
  .select("id, name, code, teacher_id, is_archived")
  .order("name");
console.log("\n--- classes ---");
for (const c of classes ?? []) {
  console.log(`  ${c.id}  ${c.name.padEnd(30)}  code=${c.code}  archived=${c.is_archived ?? false}`);
}

// 3. Per-class: units + active student count.
console.log("\n--- per-class units + student counts ---");
for (const c of classes ?? []) {
  const { data: cu } = await sb
    .from("class_units")
    .select("unit_id, is_active, units(id, title)")
    .eq("class_id", c.id);
  const { data: cs } = await sb
    .from("class_students")
    .select("student_id, is_active, students(id, display_name, username)")
    .eq("class_id", c.id)
    .eq("is_active", true);
  const active = (cu ?? []).filter((r) => r.is_active);
  if (active.length === 0 && (cs ?? []).length === 0) continue;
  console.log(`\n  class: ${c.name}  (${c.id})`);
  console.log(`    units (${active.length}):`);
  for (const r of active) {
    const u = Array.isArray(r.units) ? r.units[0] : r.units;
    console.log(`      ${u?.id ?? "?"}  ${u?.title ?? "(no title)"}`);
  }
  console.log(`    students (${(cs ?? []).length}):`);
  for (const r of cs ?? []) {
    const s = Array.isArray(r.students) ? r.students[0] : r.students;
    console.log(`      ${s?.id ?? "?"}  ${s?.display_name ?? s?.username ?? "(unnamed)"}`);
  }
}

// 4. Look up the multi-class student(s) — anyone in 2+ active enrollments.
const { data: enrollments } = await sb
  .from("class_students")
  .select("student_id, class_id")
  .eq("is_active", true);
const counts = new Map();
for (const e of enrollments ?? []) {
  counts.set(e.student_id, (counts.get(e.student_id) ?? 0) + 1);
}
const multi = [...counts.entries()].filter(([, n]) => n >= 2);
console.log("\n--- multi-class students (2+ active enrollments) ---");
for (const [sid, n] of multi) {
  const { data: s } = await sb
    .from("students")
    .select("id, display_name, username")
    .eq("id", sid)
    .maybeSingle();
  console.log(`  ${sid}  ${s?.display_name ?? s?.username ?? "?"}  (${n} classes)`);
  const { data: rows } = await sb
    .from("class_students")
    .select("class_id, enrolled_at, classes(name)")
    .eq("student_id", sid)
    .eq("is_active", true)
    .order("enrolled_at", { ascending: false });
  for (const r of rows ?? []) {
    const cl = Array.isArray(r.classes) ? r.classes[0] : r.classes;
    console.log(`    enrolled_at=${r.enrolled_at}  ${cl?.name ?? "?"}  (${r.class_id})`);
  }
}
