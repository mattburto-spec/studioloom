/**
 * /teacher/preflight — Phase 1B-2 placeholder.
 *
 * The queue landing ships in Phase 2 (once scans exist to display).
 * Until then, this route redirects to the fabricators admin page
 * so the sidebar link always lands somewhere useful.
 *
 * TODO(Phase 2): replace with the real submission queue UI.
 */

import { redirect } from "next/navigation";

export default function TeacherPreflightPage() {
  redirect("/teacher/preflight/fabricators");
}
