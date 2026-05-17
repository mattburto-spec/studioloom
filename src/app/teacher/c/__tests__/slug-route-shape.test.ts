/**
 * /teacher/c/[classSlugId] — slug route shape guards.
 *
 * Source-static guards locking the new class-canonical canvas URL
 * (DT canvas Package B.4, 17 May 2026):
 *   - Server component (no "use client" header).
 *   - Calls resolveClassBySlug() with the segment.
 *   - 404s on not_found / collision.
 *   - Throws on query_error so the error boundary catches it.
 *   - Server-redirects to the canonical slug when the incoming
 *     segment doesn't match (rename case).
 *   - Renders an empty-state with two CTA links when the class has
 *     no active unit.
 *   - Otherwise mounts <ClassCanvas /> with the resolved unit + class.
 *
 * The legacy URL at /teacher/units/[unitId]/class/[classId] gets its
 * own guards lower down (server-side lookup + redirect + fallback
 * client wrapper).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const SLUG_ROUTE_SRC = readFileSync(
  join(
    process.cwd(),
    "src/app/teacher/c/[classSlugId]/page.tsx",
  ),
  "utf-8",
);

const LEGACY_ROUTE_SRC = readFileSync(
  join(
    process.cwd(),
    "src/app/teacher/units/[unitId]/class/[classId]/page.tsx",
  ),
  "utf-8",
);

const LEGACY_FALLBACK_SRC = readFileSync(
  join(
    process.cwd(),
    "src/app/teacher/units/[unitId]/class/[classId]/legacy-client.tsx",
  ),
  "utf-8",
);

describe("/teacher/c/[classSlugId] — slug route shape", () => {
  it("is a server component (no 'use client' header)", () => {
    expect(SLUG_ROUTE_SRC).not.toMatch(/^"use client"/m);
  });

  it("imports resolveClassBySlug + ClassCanvas + next/navigation utils", () => {
    expect(SLUG_ROUTE_SRC).toMatch(
      /import\s*\{[^}]*resolveClassBySlug[^}]*\}\s*from\s*["']@\/lib\/classes\/resolve-by-slug["']/,
    );
    expect(SLUG_ROUTE_SRC).toMatch(
      /import\s*\{[^}]*ClassCanvas[^}]*\}\s*from\s*["']@\/components\/teacher\/class-hub\/ClassCanvas["']/,
    );
    expect(SLUG_ROUTE_SRC).toMatch(
      /import\s*\{[^}]*notFound[^}]*redirect[^}]*\}\s*from\s*["']next\/navigation["']/,
    );
  });

  it("force-dynamic so the slug resolves per-request (RLS scope changes)", () => {
    expect(SLUG_ROUTE_SRC).toMatch(/export const dynamic\s*=\s*["']force-dynamic["']/);
  });

  it("calls resolveClassBySlug(supabase, classSlugId)", () => {
    expect(SLUG_ROUTE_SRC).toMatch(
      /resolveClassBySlug\(supabase,\s*classSlugId\)/,
    );
  });

  it("404s on not_found + collision (notFound() call gated on result.reason)", () => {
    expect(SLUG_ROUTE_SRC).toMatch(
      /result\.reason\s*===\s*["']not_found["'][\s\S]{0,80}["']collision["'][\s\S]{0,80}notFound\(\)/,
    );
  });

  it("throws on query_error so root error boundary handles it", () => {
    expect(SLUG_ROUTE_SRC).toMatch(
      /throw new Error\(`resolveClassBySlug failed:/,
    );
  });

  it("server-redirects to canonical slug when segment mismatches", () => {
    expect(SLUG_ROUTE_SRC).toMatch(
      /canonicalSlug\s*!==\s*classSlugId[\s\S]{0,120}redirect\(`\/teacher\/c\/\$\{canonicalSlug\}`\)/,
    );
  });

  it("renders empty-state shell when class has no active unit", () => {
    expect(SLUG_ROUTE_SRC).toMatch(/!activeUnitId/);
    // Two CTAs: Open class settings + Browse units
    expect(SLUG_ROUTE_SRC).toContain("Open class settings");
    expect(SLUG_ROUTE_SRC).toContain("Browse units");
    expect(SLUG_ROUTE_SRC).toMatch(/href=\{`\/teacher\/classes\/\$\{classId\}`\}/);
    expect(SLUG_ROUTE_SRC).toMatch(/href="\/teacher\/units"/);
  });

  it("mounts <ClassCanvas unitId={activeUnitId} classId={classId} /> on the happy path", () => {
    expect(SLUG_ROUTE_SRC).toMatch(
      /<ClassCanvas\s+unitId=\{activeUnitId\}\s+classId=\{classId\}\s*\/>/,
    );
  });
});

describe("/teacher/units/[unitId]/class/[classId] — legacy URL redirect (B.4)", () => {
  it("is a server component now (no 'use client' header)", () => {
    expect(LEGACY_ROUTE_SRC).not.toMatch(/^"use client"/m);
  });

  it("looks up the class by classId + redirects via buildSlugWithId", () => {
    expect(LEGACY_ROUTE_SRC).toMatch(
      /from\(["']classes["']\)[\s\S]{0,200}\.eq\(["']id["'],\s*classId\)/,
    );
    expect(LEGACY_ROUTE_SRC).toMatch(
      /redirect\(slugUrl\)/,
    );
    expect(LEGACY_ROUTE_SRC).toMatch(
      /buildSlugWithId\(cls\.name,\s*cls\.id\)/,
    );
  });

  it("falls back to <LegacyCanvasClient /> when the lookup errors out", () => {
    expect(LEGACY_ROUTE_SRC).toMatch(
      /<LegacyCanvasClient\s+unitId=\{unitId\}\s+classId=\{classId\}\s*\/>/,
    );
  });

  it("fallback client wrapper mounts <ClassCanvas /> directly", () => {
    expect(LEGACY_FALLBACK_SRC).toMatch(/^"use client";?/m);
    expect(LEGACY_FALLBACK_SRC).toMatch(
      /<ClassCanvas\s+unitId=\{unitId\}\s+classId=\{classId\}\s*\/>/,
    );
  });
});

describe("Package B.5 — inbound canvas links mint slug URLs", () => {
  // Each of these sites was on the old /teacher/units/<u>/class/<c>
  // pattern pre-B.5. The guards anchor the new slug URL so a future
  // edit that drops back to the legacy URL trips the test.

  it("api/teacher/dashboard insight baseHref uses /teacher/c/<slug>", () => {
    const SRC = readFileSync(
      join(process.cwd(), "src/app/api/teacher/dashboard/route.ts"),
      "utf-8",
    );
    expect(SRC).toMatch(
      /baseHref\s*=\s*`\/teacher\/c\/\$\{buildSlugWithId\(cls\.name,\s*student\.class_id\)\}`/,
    );
  });

  it("dashboard-v2 UnitsGrid manageHref uses /teacher/c/<slug>", () => {
    const SRC = readFileSync(
      join(process.cwd(), "src/components/teacher-dashboard-v2/UnitsGrid.tsx"),
      "utf-8",
    );
    expect(SRC).toMatch(
      /manageHref:\s*`\/teacher\/c\/\$\{buildSlugWithId\(c\.classTag,\s*c\.classId\)\}`/,
    );
  });

  it("dashboard-v2 TodayRail manageHref uses /teacher/c/<slug>", () => {
    const SRC = readFileSync(
      join(process.cwd(), "src/components/teacher-dashboard-v2/TodayRail.tsx"),
      "utf-8",
    );
    expect(SRC).toMatch(
      /manageHref\s*=[\s\S]{0,80}`\/teacher\/c\/\$\{buildSlugWithId\(c\.className,\s*c\.classId\)\}`/,
    );
  });

  it("dashboard-v2 NowHero progressHref uses /teacher/c/<slug>", () => {
    const SRC = readFileSync(
      join(process.cwd(), "src/components/teacher-dashboard-v2/NowHero.tsx"),
      "utf-8",
    );
    expect(SRC).toMatch(
      /progressHref\s*=[\s\S]{0,160}`\/teacher\/c\/\$\{buildSlugWithId\(vm\.className,\s*classId\)\}`/,
    );
  });

  it("ChangeUnitModal router.push uses /teacher/c/<slug>", () => {
    const SRC = readFileSync(
      join(process.cwd(), "src/components/teacher/class-hub/ChangeUnitModal.tsx"),
      "utf-8",
    );
    expect(SRC).toMatch(
      /router\.push\(`\/teacher\/c\/\$\{buildSlugWithId\(className,\s*classId\)\}`\)/,
    );
  });

  it("dashboard-legacy uses /teacher/c/<slug> on the 3 canvas links", () => {
    const SRC = readFileSync(
      join(process.cwd(), "src/app/teacher/dashboard-legacy/page.tsx"),
      "utf-8",
    );
    // 3 separate links — all on the same buildSlugWithId(u.className, u.classId) pattern
    const matches = SRC.match(/\/teacher\/c\/\$\{buildSlugWithId\(u\.className,\s*u\.classId\)\}/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(3);
  });

  it("class detail page Manage link uses /teacher/c/<slug>", () => {
    const SRC = readFileSync(
      join(process.cwd(), "src/app/teacher/classes/[classId]/page.tsx"),
      "utf-8",
    );
    expect(SRC).toMatch(
      /href=\{`\/teacher\/c\/\$\{buildSlugWithId\(className,\s*classId\)\}`\}/,
    );
  });

  it("class units sub-route router.push + row link both use /teacher/c/<slug>", () => {
    const SRC = readFileSync(
      join(process.cwd(), "src/app/teacher/classes/[classId]/units/page.tsx"),
      "utf-8",
    );
    expect(SRC).toMatch(
      /router\.push\(`\/teacher\/c\/\$\{buildSlugWithId\(className,\s*classId\)\}`\)/,
    );
    expect(SRC).toMatch(
      /href=\{`\/teacher\/c\/\$\{buildSlugWithId\(className,\s*classId\)\}`\}/,
    );
  });
});
