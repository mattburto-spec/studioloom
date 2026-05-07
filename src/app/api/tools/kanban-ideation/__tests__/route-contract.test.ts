/**
 * Source-static contract guards for /api/tools/kanban-ideation.
 *
 * No live route execution test (the existing toolkit routes don't have
 * those either — they hit Anthropic's API). Instead we lock the
 * key behaviors that determine whether the Socratic ideation tool stays
 * faithful to docs/education-ai-patterns.md:
 *
 *   1. Route exposes POST handler
 *   2. Two actions: "probe" + "nudge"
 *   3. probe action requires ≥3 student-typed rough ideas (effort gate)
 *   4. System prompts forbid AI from listing ideas (Socratic-only)
 *   5. Uses callHaiku from the toolkit (Haiku 4.5 for speed/cost)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROUTE_SRC = readFileSync(
  join(__dirname, "..", "route.ts"),
  "utf-8"
);

describe("kanban-ideation route contract", () => {
  it("exposes a POST handler", () => {
    expect(ROUTE_SRC).toMatch(/export async function POST/);
  });

  it("uses callHaiku from the shared toolkit (not Sonnet)", () => {
    expect(ROUTE_SRC).toContain("callHaiku");
    expect(ROUTE_SRC).not.toContain("callSonnet");
  });

  it("declares two valid actions: probe + nudge", () => {
    // Array is multi-line in source: ["probe", \n "nudge",\n]
    expect(ROUTE_SRC).toMatch(
      /validateToolkitRequest[\s\S]{0,200}"probe"[\s\S]{0,40}"nudge"/
    );
  });

  it("probe action enforces the ≥3 rough-ideas effort gate", () => {
    expect(ROUTE_SRC).toMatch(/studentIdeas\.length\s*<\s*3/);
  });

  it("system prompts forbid listing ideas (Socratic-only contract)", () => {
    // Locks the pedagogical contract: the AI must NEVER write the
    // student's backlog items for them. If someone weakens this, the
    // tool stops being effort-gated.
    expect(ROUTE_SRC).toMatch(/NEVER suggest backlog items?/i);
    expect(ROUTE_SRC).toMatch(/NEVER write a list/i);
    expect(ROUTE_SRC).toMatch(/Question(s)? only|question only/i);
  });

  it("nudge action handles three effort levels (low/medium/high)", () => {
    expect(ROUTE_SRC).toContain('"low"');
    expect(ROUTE_SRC).toContain('"medium"');
    expect(ROUTE_SRC).toContain('"high"');
    expect(ROUTE_SRC).toMatch(/EFFORT LEVEL:\s*LOW/);
    expect(ROUTE_SRC).toMatch(/EFFORT LEVEL:\s*MEDIUM/);
    expect(ROUTE_SRC).toMatch(/EFFORT LEVEL:\s*HIGH/);
  });

  it("low-effort nudge emits an empty acknowledgment (no praise for vague work)", () => {
    expect(ROUTE_SRC).toMatch(/acknowledgment[\s\S]{0,200}MUST be an empty string/i);
  });

  it("logs usage for both actions", () => {
    expect(ROUTE_SRC).toMatch(/logToolkitUsage\("tools\/kanban-ideation\/probe"/);
    expect(ROUTE_SRC).toMatch(/logToolkitUsage\("tools\/kanban-ideation\/nudge"/);
  });
});
