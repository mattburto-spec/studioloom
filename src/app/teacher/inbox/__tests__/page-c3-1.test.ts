/**
 * TFL.3 C.3.1 — inbox UX fixes after Matt's reply-loop smoke on
 * 12 May 2026. Three issues caught:
 *
 *   1. When a student hits "Got it" with no reply text, the AI helper
 *      returns NO_FOLLOWUP_SENTINEL. The teacher should NOT be forced
 *      to "Approve & send" — there's nothing to send. The inbox now
 *      surfaces a single "Mark resolved" purple button (Skip semantics)
 *      as the primary action in the sentinel state.
 *
 *   2. Queue rows + detail header now show a compact relative
 *      timestamp ("5m", "3h", "yest.", "3d", "8 May", "May '25") so the
 *      teacher knows which items are stale.
 *
 *   3. The reply_waiting bucket now sorts OLDEST-first (not newest-
 *      first). The backlog floats to the top instead of being buried
 *      by fresh replies.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "..", "page.tsx"), "utf-8");

describe("/teacher/inbox C.3.1 — Mark resolved button (sentinel state)", () => {
  it("renders a 'Mark resolved' purple button when isNoFollowupSentinel", () => {
    expect(src).toContain('data-testid="inbox-mark-resolved-button"');
    expect(src).toMatch(/✓ Mark resolved/);
    // Purple = pedagogical "thread closed cleanly" signal, distinct
    // from emerald approve.
    expect(src).toMatch(
      /isNoFollowupSentinel\s*\?\s*\(\s*<button[\s\S]*?bg-purple-600/,
    );
  });

  it("Mark resolved wires to onSkip (closes thread silently)", () => {
    // The student's 'got it' already closed the thread on their side;
    // local hide via Skip is the right semantic here.
    expect(src).toMatch(
      /data-testid="inbox-mark-resolved-button"[\s\S]*?onClick=\{onSkip\}/,
    );
  });

  it("suppresses the green Approve & send button entirely in sentinel state", () => {
    // The ternary REPLACES the approve+skip cluster with the single
    // Mark resolved button — approve is not just disabled, it's gone.
    expect(src).toMatch(
      /isNoFollowupSentinel\s*\?\s*\([\s\S]*?inbox-mark-resolved-button[\s\S]*?\)\s*:\s*\([\s\S]*?inbox-approve-button/,
    );
  });

  it("textarea draftValue is empty (not the sentinel literal) when in sentinel state", () => {
    // The sentinel is an internal marker. Surfacing it literally in
    // the textarea was confusing — teacher saw "(no follow-up needed)"
    // as a draft they were apparently about to send.
    expect(src).toMatch(
      /followupDraft\s*===\s*NO_FOLLOWUP_SENTINEL\s*\?\s*""\s*:\s*followupDraft\s*\?\?\s*""/,
    );
  });
});

describe("/teacher/inbox C.3.1 — relative timestamps", () => {
  it("imports formatInboxRelativeTime from @/lib/grading/relative-time", () => {
    expect(src).toMatch(
      /import\s*\{\s*formatInboxRelativeTime\s*\}\s*from\s*"@\/lib\/grading\/relative-time"/,
    );
  });

  it("queue row shows a relative-time chip with full ISO on hover (title attr)", () => {
    expect(src).toContain('data-testid="inbox-queue-row-relative-time"');
    expect(src).toMatch(
      /title=\{new Date\(item\.lastActivityAt\)\.toLocaleString\(\)\}/,
    );
    expect(src).toMatch(/formatInboxRelativeTime\(item\.lastActivityAt\)/);
  });

  it("detail header also shows the relative time (next to unit/page metadata)", () => {
    expect(src).toContain('data-testid="inbox-detail-relative-time"');
  });
});

describe("/teacher/inbox C.3.1 — oldest-first sort", () => {
  // The sort flip lives in inbox-loader.ts; this just pins the
  // page-side display still treats reply_waiting as the first section.
  it("queue still groups reply_waiting first regardless of sort", () => {
    expect(src).toMatch(
      /\(\["reply_waiting",\s*"drafted",\s*"no_draft"\]/,
    );
  });
});
