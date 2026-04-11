/**
 * Phase 2 sub-task 5.2.5 commit 5 — meta-test: every AI call site in
 * src/lib/pipeline/stages/ must be paired with an assertNotMaxTokens guard.
 *
 * Lesson #39 enforcement gate. Source-static (file read + regex) — this
 * test does NOT execute pipeline code. If a future stage adds a new
 * client.messages.create call without a paired guard, this test fires.
 *
 * Five tests:
 *  (1) every client.messages.create has assertNotMaxTokens within 30 lines below
 *  (2) every stage file using messages.create imports from ./max-tokens-guard
 *  (3) the shared max-tokens-guard.ts file exports the expected names +
 *      cites Lesson #39 + §5.2.5
 *  (4) no stage file has a max_tokens literal below 1024 (typo sanity)
 *  (5) captured count — exactly 4 call sites across all stages (Lesson #38 pin)
 *
 * If a test fires, read docs/lessons-learned.md Lesson #39 +
 * docs/projects/dimensions3-phase-2-brief.md §5 row 5.2.5 BEFORE "fixing".
 * The guard is mandatory, not optional.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const STAGES_DIR = join(process.cwd(), "src/lib/pipeline/stages");
const GUARD_FILE = join(STAGES_DIR, "max-tokens-guard.ts");

interface StageFile {
  filename: string;
  path: string;
  content: string;
  lines: string[];
}

function readStageFiles(): StageFile[] {
  const entries = readdirSync(STAGES_DIR, { withFileTypes: true });
  return entries
    .filter(e => e.isFile() && e.name.endsWith(".ts") && !e.name.endsWith(".test.ts"))
    .map(e => {
      const path = join(STAGES_DIR, e.name);
      const content = readFileSync(path, "utf8");
      return { filename: e.name, path, content, lines: content.split("\n") };
    });
}

describe("Pipeline AI call sites must guard against max_tokens truncation (Lesson #39)", () => {
  it("every client.messages.create call site has assertNotMaxTokens within 30 lines below", () => {
    const files = readStageFiles();
    const failures: string[] = [];

    // Strip // line-comments so commented-out guard calls don't count.
    // (Block comments /* */ are rare in this codebase and not worth the
    // added complexity — a determined bypass would be caught in review.)
    const stripLineComment = (line: string): string => {
      const idx = line.indexOf("//");
      return idx === -1 ? line : line.slice(0, idx);
    };

    for (const f of files) {
      const code = f.lines.map(stripLineComment);
      for (let i = 0; i < code.length; i++) {
        if (!code[i].includes("client.messages.create")) continue;

        // Look forward up to 30 lines (after the await + closing `)`) for
        // a non-commented assertNotMaxTokens call. Guard must come AFTER.
        const window = code.slice(i, Math.min(i + 30, code.length)).join("\n");
        if (!window.includes("assertNotMaxTokens(")) {
          failures.push(
            `${f.filename}:${i + 1} has client.messages.create with no ` +
            `assertNotMaxTokens within 30 lines below it. Lesson #39 — ` +
            `every AI call site must guard against max_tokens truncation. ` +
            `See dimensions3-phase-2-brief §5 row 5.2.5.`
          );
        }
      }
    }

    expect(failures).toEqual([]);
  });

  it("every stage file using client.messages.create imports from ./max-tokens-guard", () => {
    const files = readStageFiles();
    const failures: string[] = [];

    for (const f of files) {
      if (!f.content.includes("client.messages.create")) continue;
      if (!f.content.includes('from "./max-tokens-guard"')) {
        failures.push(
          `${f.filename} uses client.messages.create but does not import ` +
          `from ./max-tokens-guard. Lesson #39.`
        );
      }
    }

    expect(failures).toEqual([]);
  });

  it("shared max-tokens-guard.ts file exports the expected names and cites Lesson #39 + 5.2.5", () => {
    const source = readFileSync(GUARD_FILE, "utf8");
    expect(source).toMatch(/export class MaxTokensError/);
    expect(source).toMatch(/export function assertNotMaxTokens/);
    expect(source).toContain("Lesson #39");
    expect(source).toContain("5.2.5");
  });

  it("no stage file has a max_tokens literal below 1024 (typo sanity check)", () => {
    const files = readStageFiles();
    const failures: string[] = [];

    for (const f of files) {
      const regex = /max_tokens:\s*(\d+)/g;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(f.content)) !== null) {
        const value = parseInt(match[1], 10);
        if (value < 1024) {
          failures.push(
            `${f.filename} has max_tokens: ${value} which is below the ` +
            `1024 floor — likely a typo. Caps should be 2048 or 4096 for ` +
            `production paths.`
          );
        }
      }
    }

    expect(failures).toEqual([]);
  });

  it("captured AI call site count — exactly 4 across all stage files (Lesson #38 pin)", () => {
    const files = readStageFiles();
    let count = 0;
    for (const f of files) {
      const matches = f.content.match(/client\.messages\.create/g) || [];
      count += matches.length;
    }
    expect(count).toBe(4);
    // Failure message context: if this fires, a new AI call site was added.
    // Ensure it has an assertNotMaxTokens guard AND update this test's
    // expected count. Site map at time of this test:
    //   stage2-assembly.ts   × 1 (main)
    //   stage3-generation.ts × 1 (inside Promise.allSettled batch)
    //   stage4-polish.ts     × 2 (main + polishInChunks)
  });
});
