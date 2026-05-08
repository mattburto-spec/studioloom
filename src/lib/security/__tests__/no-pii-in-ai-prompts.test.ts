/**
 * Regression catch (security-plan.md P-6): every file that calls
 * `callAnthropicMessages` / `streamAnthropicMessages` is scanned for
 * forbidden PII identifier names. If any future refactor reintroduces
 * a student name into a prompt without going through the placeholder-
 * swap pattern (see report-writer-prompt.ts), this test fails.
 *
 * Allowlist below = files that use a known-good redaction pattern.
 *
 * What this catches: literal references to `display_name`, `firstName`,
 * `\.email`, etc. inside files that construct AI prompts. Won't catch
 * obfuscated paths (e.g. spreading `student` into a template), so it's
 * a regression net, not a proof. Pair with code review.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "../../../..");
const SRC_DIR = resolve(REPO_ROOT, "src");

/**
 * Files that legitimately reference these tokens because they implement
 * the redaction pattern (placeholder swap before send, restore after).
 * If you add a file here, add a matching code comment in the file pointing
 * at this test.
 */
const REDACTION_ALLOWLIST = new Set([
  "src/app/api/tools/report-writer/route.ts",
  "src/app/api/tools/report-writer/bulk/route.ts",
  "src/lib/tools/report-writer-prompt.ts",
  // The chokepoint itself + tests/types may legitimately reference PII
  // identifier names in comments/JSDoc.
  "src/lib/ai/call.ts",
  "src/lib/security/__tests__/no-pii-in-ai-prompts.test.ts",
  "src/lib/security/sentry-pii-filter.ts",
  "src/lib/security/__tests__/sentry-pii-filter.test.ts",
]);

/**
 * Files where the PII identifier is used for AUTH / RATE-LIMIT / LOGGING,
 * not for LLM-payload construction. Confirmed by manual audit on the date
 * the entry was added. If the file later starts constructing prompts, it
 * MUST be removed from this list.
 *
 * Audit policy: any addition here requires (a) a code comment in the file
 * stating the email/name use is non-LLM, and (b) the date in the comment
 * below.
 */
const NON_LLM_USE_ALLOWLIST = new Set([
  // 2026-05-09 — admin allowlist gate (`user.email` checked against ADMIN_EMAILS).
  // No email reaches Anthropic; admin auth only.
  "src/app/api/admin/ai-model/test/route.ts",
  "src/app/api/admin/ai-model/test-lesson/route.ts",
  // 2026-05-09 — teacher's own email used for free-tool rate-limit + ai_usage_log
  // metadata attribution. Email is NOT in the prompt body. Verified at
  // marking-comments/route.ts:71 (rate-limit key) and :106 (log metadata).
  "src/app/api/tools/marking-comments/route.ts",
]);

/**
 * Forbidden tokens. A match in a non-allowlisted AI-calling file is a
 * potential PII-in-prompt leak — even if it's just a comment, treat as
 * a smell that needs review.
 *
 * Patterns chosen for high signal: column names + camelCase variants
 * the codebase actually uses. `auth.users.email` is grandfathered via
 * the boundary test below (we look for *property access*, not the
 * unscoped string).
 */
const FORBIDDEN_PATTERNS: { name: string; regex: RegExp }[] = [
  { name: "display_name", regex: /\bdisplay_name\b/ },
  { name: "displayName", regex: /\bdisplayName\b/ },
  { name: "first_name", regex: /\bfirst_name\b/ },
  { name: "firstName", regex: /\bfirstName\b/ },
  { name: "last_name", regex: /\blast_name\b/ },
  { name: "lastName", regex: /\blastName\b/ },
  { name: "full_name", regex: /\bfull_name\b/ },
  { name: "fullName", regex: /\bfullName\b/ },
  { name: ".email property access", regex: /\.email\b/ },
  { name: "studentName", regex: /\bstudentName\b/ },
  { name: "student_name", regex: /\bstudent_name\b/ },
];

function findAICallSiteFiles(): string[] {
  // ripgrep would be faster, but plain grep is universally available.
  // Returns repo-relative POSIX paths.
  const stdout = execSync(
    `grep -rl -E "callAnthropicMessages|streamAnthropicMessages" ${SRC_DIR}`,
    { encoding: "utf8" },
  );
  return stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((p) => p.replace(REPO_ROOT + "/", ""));
}

describe("PII-in-AI-prompts regression catch", () => {
  const files = findAICallSiteFiles();

  it("inventory is non-empty (test smoke-checks itself)", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  for (const relPath of files) {
    if (REDACTION_ALLOWLIST.has(relPath)) continue;
    if (NON_LLM_USE_ALLOWLIST.has(relPath)) continue;

    it(`${relPath} contains no PII identifier tokens`, () => {
      const source = readFileSync(resolve(REPO_ROOT, relPath), "utf8");
      const violations: string[] = [];
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.regex.test(source)) {
          violations.push(pattern.name);
        }
      }
      if (violations.length > 0) {
        const message =
          `${relPath} references PII identifier(s): ${violations.join(", ")}.\n\n` +
          `If this file is constructing an Anthropic prompt with a student name, ` +
          `route it through the placeholder-swap pattern in ` +
          `src/lib/tools/report-writer-prompt.ts (STUDENT_NAME_PLACEHOLDER + ` +
          `restoreStudentName) and add the file to REDACTION_ALLOWLIST in this test.\n\n` +
          `If this file legitimately needs to read names without sending them to ` +
          `the LLM (e.g. building UI), refactor so the name lives in a separate code ` +
          `path from the AI call, then add to REDACTION_ALLOWLIST.\n\n` +
          `See docs/security/security-overview.md §1.3 for the redaction pattern.`;
        throw new Error(message);
      }
    });
  }
});
