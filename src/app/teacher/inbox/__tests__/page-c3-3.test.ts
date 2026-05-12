/**
 * TFL.3 C.3.3 — persistent thread resolution.
 *
 * Matt feedback 12 May 2026: "inbox keeps getting these got its which
 * i've marked as resolved a few times". Root cause: Mark resolved was
 * wired to handleSkip which only set in-memory React state — survived
 * the 60s polls but a page reload wiped it.
 *
 * Fix: separate handleResolve writes gradeId → ISO timestamp to
 * localStorage. visibleItems filter hides items where gradeId is in
 * the resolved map UNLESS a new student reply arrived with sentAt >
 * resolvedAt — pedagogically: a new "got it" or any reply re-opens
 * the thread because the student has more to say.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "..", "page.tsx"), "utf-8");

describe("/teacher/inbox C.3.3 — persistent resolved-threads state", () => {
  it("declares a stable localStorage key (versioned)", () => {
    expect(src).toMatch(
      /RESOLVED_STORAGE_KEY\s*=\s*"studioloom\.inbox\.resolved-threads\.v1"/,
    );
  });

  it("uses a Record<string, string> shape (gradeId → ISO timestamp)", () => {
    expect(src).toMatch(/setResolvedThreads/);
    expect(src).toMatch(
      /\[resolvedThreads,\s*setResolvedThreads\][\s\S]{0,80}React\.useState<\s*\n?\s*Record<string,\s*string>/,
    );
  });

  it("hydrates from localStorage on mount (single-shot effect, [] deps)", () => {
    expect(src).toMatch(
      /window\.localStorage\.getItem\(RESOLVED_STORAGE_KEY\)/,
    );
    expect(src).toMatch(/setResolvedThreads\(parsed\)/);
  });

  it("clears corrupt JSON gracefully (try/catch around parse)", () => {
    // If a future schema bump leaves a v1 payload that won't parse,
    // wipe it and start fresh rather than wedging the page.
    expect(src).toMatch(
      /window\.localStorage\.removeItem\(RESOLVED_STORAGE_KEY\)/,
    );
  });
});

describe("/teacher/inbox C.3.3 — handleResolve writer", () => {
  it("declares handleResolve as a useCallback that writes both state + localStorage", () => {
    expect(src).toMatch(/const handleResolve\s*=\s*React\.useCallback/);
    expect(src).toMatch(
      /window\.localStorage\.setItem\(\s*RESOLVED_STORAGE_KEY,\s*JSON\.stringify\(next\)/,
    );
  });

  it("keys by gradeId (stable) NOT itemKey", () => {
    // itemKey is "<gradeId>::<student>::<tile>" — gradeId alone is
    // the stable handle. The visibleItems filter also reads by
    // gradeId to keep both sides in sync.
    expect(src).toMatch(/const gradeId\s*=\s*selectedItem\.gradeId/);
    expect(src).toMatch(/\[gradeId\]:\s*resolvedAt/);
  });

  it("writes the current wall-clock time (new Date().toISOString())", () => {
    expect(src).toMatch(
      /const resolvedAt\s*=\s*new Date\(\)\.toISOString\(\)/,
    );
  });

  it("also adds to in-memory skipped set so the item disappears this turn (belt + braces)", () => {
    // The polling refetch is up to 60s away; without this the item
    // stays visible until the next refetch. setSkipped gives an
    // instant local hide.
    expect(src).toMatch(
      /\/\/ Belt \+ braces[\s\S]*?setSkipped\(\(prev\)\s*=>\s*new\s+Set\(prev\)\.add\(itemKey\)\)/,
    );
  });

  it("swallows localStorage write failures silently (quota / private mode)", () => {
    // Don't blow up the UI if localStorage is full or unavailable —
    // the in-memory state still hides the item for this session.
    expect(src).toMatch(
      /localStorage quota exceeded \/ private mode — fail silently/,
    );
  });
});

describe("/teacher/inbox C.3.3 — re-surface filter", () => {
  it("visibleItems checks resolvedThreads[gradeId] BEFORE class/lesson filters", () => {
    expect(src).toMatch(
      /const resolvedAt\s*=\s*resolvedThreads\[i\.gradeId\][\s\S]*?if\s*\(resolvedAt\)/,
    );
  });

  it("hides item when resolved AND no new student reply since then", () => {
    expect(src).toMatch(
      /const replyAt\s*=\s*i\.latestStudentReply\?\.sentAt[\s\S]*?if\s*\(!replyAt\s*\|\|\s*replyAt\s*<=\s*resolvedAt\)\s*return\s+false/,
    );
  });

  it("re-surfaces item when a NEW student reply arrived after resolution", () => {
    // The fall-through after the resolved check lets a new reply
    // re-open the thread — pedagogically: student has more to say.
    // Pin the structural shape (no explicit `return true` inside the
    // resolved branch).
    expect(src).toMatch(
      /if\s*\(resolvedAt\)\s*\{\s*const replyAt[\s\S]*?if\s*\([^)]+\)\s*return\s+false;\s*\}/,
    );
  });

  it("resolvedThreads is in the useMemo dependency array", () => {
    expect(src).toMatch(
      /\[items, skipped, resolvedThreads, classFilter, lessonFilter\]/,
    );
  });
});

describe("/teacher/inbox C.3.3 — DetailPane onResolve prop wiring", () => {
  it("DetailPane signature accepts onResolve: () => void", () => {
    expect(src).toMatch(/onResolve:\s*\(\)\s*=>\s*void/);
  });

  it("parent passes handleResolve as the onResolve prop", () => {
    expect(src).toMatch(/onResolve=\{handleResolve\}/);
  });
});
