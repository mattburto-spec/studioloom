/**
 * Phase 5.3 retrofit catalog — assert exact wire-up of withAIBudget across
 * the 3 student AI route files. Greppable acceptance test: if a refactor
 * removes the wrapper from a route OR adds a 4th student route without
 * wrapping (→ §5.3d budget-coverage CI gate catches it later), the
 * corresponding test fires.
 *
 * Lessons applied: #38 (assert specific values via fs.readFileSync grep
 * — same pattern that caught the audit-log retrofit drift in §5.1).
 *
 * Brief drift recorded inline: brief named 4 routes; safety/check-requirements
 * is GET-only (no AI call) so dropped from §5.3 scope. The §5.3d scanner
 * (Phase 5.3d) will surface any future student AI route that lacks
 * withAIBudget; until then this catalog is the source of truth for what's
 * wired today.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readSrc(rel: string): string {
  return readFileSync(resolve(__dirname, "../../../../..", rel), "utf-8");
}

describe("Phase 5.3 retrofit catalog — withAIBudget wired into student AI routes", () => {
  it("word-lookup route imports + calls withAIBudget around messages.create", () => {
    const src = readSrc("src/app/api/student/word-lookup/route.ts");
    expect(src).toMatch(
      /import \{ withAIBudget \} from ['"]@\/lib\/access-v2\/ai-budget\/middleware['"]/,
    );
    expect(src).toMatch(/await withAIBudget\(supabase, auth\.studentId, async \(\) => \{/);
    // 429 response shape
    expect(src).toContain('error: "budget_exceeded"');
    expect(src).toMatch(/status: 429/);
    // 502 truncation response shape
    expect(src).toContain('error: "model_truncated"');
    expect(src).toMatch(/status: 502/);
  });

  it("quest/mentor route imports + calls withAIBudget around anthropic.messages.create", () => {
    const src = readSrc("src/app/api/student/quest/mentor/route.ts");
    expect(src).toMatch(
      /import \{ withAIBudget \} from ['"]@\/lib\/access-v2\/ai-budget\/middleware['"]/,
    );
    expect(src).toMatch(/await withAIBudget\(supabase, studentId, async \(\) => \{/);
    expect(src).toContain("'budget_exceeded'");
    expect(src).toMatch(/status: 429/);
    expect(src).toContain("'model_truncated'");
    expect(src).toMatch(/status: 502/);
  });

  it("design-assistant route imports + calls withAIBudget around generateResponse", () => {
    const src = readSrc("src/app/api/student/design-assistant/route.ts");
    expect(src).toMatch(
      /import \{ withAIBudget \} from ['"]@\/lib\/access-v2\/ai-budget\/middleware['"]/,
    );
    expect(src).toMatch(/await withAIBudget\(\s*supabaseForBudget,\s*studentId,\s*async \(\) => \{/);
    expect(src).toContain('"budget_exceeded"');
    expect(src).toMatch(/status: 429/);
    expect(src).toContain('"model_truncated"');
    expect(src).toMatch(/status: 502/);
  });

  it("generateResponse returns usage in its result (Phase 5.3 contract extension)", () => {
    const src = readSrc("src/lib/design-assistant/conversation.ts");
    // The function signature now includes `usage` in its return
    expect(src).toMatch(/usage: \{\s*input_tokens: number;\s*output_tokens: number;\s*stop_reason: string;\s*\};/);
    // The return statement passes usage through
    expect(src).toMatch(/usage: aiResult\.usage,/);
  });

  it("safety/check-requirements is NOT wrapped (GET-only, no AI call) — brief drift", () => {
    const src = readSrc("src/app/api/student/safety/check-requirements/route.ts");
    expect(src).not.toContain("withAIBudget");
    // Sanity: it's GET, not a mutation. No AI either.
    expect(src).toMatch(/export async function GET/);
    expect(src).not.toMatch(/messages\.create/);
    expect(src).not.toMatch(/new Anthropic/);
  });

  it("middleware exports withAIBudget with the 3-state result discriminant", () => {
    const src = readSrc("src/lib/access-v2/ai-budget/middleware.ts");
    expect(src).toContain("export async function withAIBudget");
    expect(src).toMatch(/reason: "over_cap"/);
    expect(src).toMatch(/reason: "truncated"/);
    expect(src).toContain('action: "ai_budget.over_cap"');
    expect(src).toContain('action: "ai_budget.bill_failed"');
  });
});
