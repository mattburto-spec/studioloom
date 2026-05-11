/**
 * Schedule "today" / "Next up" route — schema sync.
 *
 * Matt smoke caught it on the dashboard: the "Next up · Period 1" hero
 * card AND the "Your day" sidebar still listed a unit he had
 * unassigned from a class. Both surfaces are fed by
 * /api/teacher/schedule/today, which read class_units WITHOUT filtering
 * on is_active. Soft-removed assignments (set via the class page's
 * "Remove unit" toggle, or via the unit page after PR #189) still
 * surfaced in the day's schedule.
 *
 * Fix: add .eq("is_active", true) to the class_units fetch. Same root
 * cause as PRs #189 and #196; the dashboard route already had this
 * filter, the schedule route didn't.
 *
 * Source-static — locks the filter against future regressions.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROUTE_SRC = readFileSync(
  join(__dirname, "..", "route.ts"),
  "utf-8",
);

describe("/api/teacher/schedule/today — class_units filter", () => {
  it("class_units fetch chains .eq('is_active', true) so soft-removed assignments don't surface in today's schedule", () => {
    expect(ROUTE_SRC).toMatch(
      /from\("class_units"\)[\s\S]{0,400}\.eq\("is_active",\s*true\)/,
    );
  });

  it("the .in(class_id) filter still runs first so the active-only filter scopes to the teacher's classes", () => {
    // Defensive: don't accidentally drop the class scope when adding
    // is_active — the route should ONLY return rows for the teacher's
    // classes that are also active.
    expect(ROUTE_SRC).toMatch(
      /from\("class_units"\)[\s\S]{0,200}\.in\("class_id",[\s\S]{0,200}\.eq\("is_active",\s*true\)/,
    );
  });
});
