/**
 * Source-static guards for /api/teacher/unit-brief/generate (POST).
 *
 * AI brief-assist endpoint — Haiku tool-use generates a structured
 * suggestion. Output is sanitised + validated before return so the
 * editor never sees garbage.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "..", "route.ts"), "utf-8");

describe("/api/teacher/unit-brief/generate — module-level", () => {
  it("routes through callAnthropicMessages (single chokepoint per CLAUDE.md)", () => {
    expect(src).toMatch(
      /import \{ callAnthropicMessages \} from "@\/lib\/ai\/call"/,
    );
    expect(src).toMatch(/await callAnthropicMessages\(/);
  });

  it("uses Haiku model (cost class) — not Sonnet", () => {
    expect(src).toContain("MODELS.HAIKU");
    expect(src).not.toContain("MODELS.SONNET");
  });

  it("uses tool-use with a strict 'propose_brief' tool name", () => {
    expect(src).toContain('TOOL_NAME = "propose_brief"');
    expect(src).toMatch(/toolChoice:\s*\{\s*type:\s*"tool",\s*name:\s*TOOL_NAME/);
  });

  it("audit-skip annotation present (teacher-authoring class)", () => {
    expect(src.slice(0, 300)).toContain("audit-skip:");
  });

  it("endpoint string follows the CLAUDE.md path-shaped convention", () => {
    expect(src).toContain('endpoint: "teacher/unit-brief-generate"');
  });

  it("teacherId passed for budget attribution + BYOK chain", () => {
    expect(src).toContain("teacherId,");
  });

  it("imports shared validators — output is validated before return", () => {
    expect(src).toMatch(
      /import \{[\s\S]*?validateConstraints[\s\S]*?\} from "@\/lib\/unit-brief\/validators"/,
    );
  });
});

describe("POST — Phase F.D auth + validation chain", () => {
  it("requireTeacher + verifyTeacherHasUnit.isAuthor (only author can invoke)", () => {
    expect(src).toContain("requireTeacher(request)");
    expect(src).toMatch(/if \(!access\.isAuthor\)/);
    expect(src).toContain("Only the unit author can use AI assist");
  });

  it("returns 400 on missing unitId / prompt", () => {
    expect(src).toContain("unitId required (string)");
    expect(src).toContain("prompt required (non-empty string)");
  });

  it("caps prompt at 2000 chars", () => {
    expect(src).toContain("prompt must be 2000 characters or fewer");
  });

  it("fetches unit + current brief for context", () => {
    expect(src).toMatch(/\.from\("units"\)/);
    expect(src).toMatch(/\.from\("unit_briefs"\)/);
  });

  it("handles all callResult.reason variants (no_credentials / truncated / over_cap / api_error)", () => {
    expect(src).toMatch(/callResult\.reason === "no_credentials"/);
    expect(src).toMatch(/callResult\.reason === "truncated"/);
    expect(src).toMatch(/callResult\.reason === "over_cap"/);
    // Generic fallback for unhandled reasons → 502
    expect(src).toMatch(/AI provider error/);
  });

  it("requires a tool_use block — falls back to 502 if model didn't return one", () => {
    expect(src).toMatch(/content\.find\(\(b\) => b\.type === "tool_use"\)/);
    expect(src).toContain("Model did not return a structured proposal");
  });

  it("defensive narrows input fields (Lesson #39/#42 — schema is training-time only)", () => {
    expect(src).toMatch(
      /typeof input\?\.brief_text === "string"/,
    );
  });

  it("sanitises proposal via validateConstraints; falls back to coerceConstraints if invalid", () => {
    expect(src).toContain("validateConstraints(proposedConstraints)");
    expect(src).toMatch(/coerceConstraints\(proposedConstraints\)/);
  });

  it("returns the suggestion under `suggestion` key with brief_text + constraints", () => {
    expect(src).toMatch(/suggestion:\s*ProposedBrief/);
  });
});

describe("System prompt + tool schema", () => {
  it("system prompt describes both brief_text + constraints", () => {
    expect(src).toContain("brief_text");
    expect(src).toContain("constraints");
  });

  it("system prompt mentions the catalogue material chip ids", () => {
    // Subset check — at least a few catalogue ids appear in the prompt
    // so the model knows the canonical names.
    expect(src).toContain("cardboard");
    expect(src).toContain("ply-3mm");
    expect(src).toContain("laser-mdf");
  });

  it("tool schema declares all constraint fields with sensible types", () => {
    expect(src).toMatch(/brief_text/);
    expect(src).toMatch(/dimensions/);
    expect(src).toMatch(/materials_whitelist/);
    expect(src).toMatch(/budget/);
    expect(src).toMatch(/audience/);
    expect(src).toMatch(/must_include/);
    expect(src).toMatch(/must_avoid/);
    // Dimensions unit enum constrained
    expect(src).toMatch(/enum:\s*\["mm",\s*"cm",\s*"in"\]/);
  });
});
