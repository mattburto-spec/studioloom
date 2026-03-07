import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function run() {
  const content = JSON.parse(readFileSync("public/sample_unit.json", "utf8"));

  // Create the unit
  const { data: unit, error: unitErr } = await supabase
    .from("units")
    .insert({
      title: "Arcade Machine Project",
      description:
        "Design and build an interactive arcade-style game using Makey Makey, conductive materials, and Scratch.",
      content_data: content,
    })
    .select()
    .single();

  if (unitErr) {
    console.log("Unit error:", unitErr);
    return;
  }
  console.log("Unit created:", unit.id);

  // Get the class
  const { data: classes } = await supabase
    .from("classes")
    .select("id")
    .limit(1);
  if (!classes || classes.length === 0) {
    console.log("No classes found");
    return;
  }

  // Assign unit to class
  const { error: assignErr } = await supabase.from("class_units").insert({
    class_id: classes[0].id,
    unit_id: unit.id,
    is_active: true,
    locked_pages: [],
  });

  if (assignErr) {
    console.log("Assign error:", assignErr);
    return;
  }
  console.log("Unit assigned to class:", classes[0].id);
}

run();
