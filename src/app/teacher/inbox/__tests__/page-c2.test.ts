/**
 * TFL.3 C.2 — /teacher/inbox master-detail layout source-static guards.
 *
 * Replaces the C.1 placeholder card layout. The page now renders as
 * two columns:
 *   - LEFT (queue): compact rows grouped by state (reply_waiting /
 *     drafted / no_draft) with select-on-click behaviour.
 *   - RIGHT (detail): full marking surface for the selected item —
 *     sanitized response, AI draft (editable inline), reply (when
 *     state=reply_waiting), low-confidence warning chip, approve +
 *     skip controls + "open in marking page" deep-link.
 *
 * Approve flow writes through the existing PUT
 * /api/teacher/grading/tile-grades route (G3 path, B.4 trigger
 * handles the turn insert/update). On success the local list drops
 * the item; useEffect auto-selects the next visible item.
 *
 * HTML sanitize: studentResponse runs through sanitizeResponseText
 * before render — fixes the LIS contenteditable `<div>` tags showing
 * raw in C.1 smoke.
 *
 * Low-confidence drafts (<40%): amber chip + warning band + amber
 * (not emerald) approve button. Teacher can still approve; the
 * visual signal is meant to slow them down, not gate them.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "..", "page.tsx"), "utf-8");

describe("/teacher/inbox C.2 — master-detail layout", () => {
  it("uses a 2-column grid (320px queue + 1fr detail)", () => {
    expect(src).toMatch(/grid-cols-\[320px_1fr\]/);
  });

  it("queue + detail panes each carry a data-testid", () => {
    expect(src).toContain('data-testid="inbox-queue"');
    expect(src).toContain('data-testid="inbox-detail"');
  });

  it("imports sanitizeResponseText (HTML-leak fix from C.1 smoke)", () => {
    expect(src).toMatch(
      /import\s*\{\s*sanitizeResponseText\s*\}\s*from\s*"@\/lib\/grading\/sanitize-response"/,
    );
  });

  it("studentResponse runs through sanitizeResponseText before render", () => {
    expect(src).toMatch(/sanitizeResponseText\(item\.studentResponse\)/);
  });
});

describe("/teacher/inbox C.2 — queue (master pane)", () => {
  it("groups rows by state (reply_waiting / drafted / no_draft)", () => {
    expect(src).toMatch(/sectionTitle:\s*Record<InboxItem\["state"\],\s*string>/);
    expect(src).toMatch(/"Reply waiting"/);
    expect(src).toMatch(/"AI drafted"/);
    expect(src).toMatch(/"Drafting…"/);
  });

  it("queue rows carry data-state + data-active + data-testid", () => {
    expect(src).toContain('data-testid="inbox-queue-row"');
    expect(src).toMatch(/data-state=\{item\.state\}/);
    expect(src).toMatch(/data-active=\{active\}/);
  });

  it("clicking a row sets selectedKey via onSelect callback (JSX prop, not object key)", () => {
    // JSX uses `=` for prop assignment, not `:`. The QueueList renders
    // <QueueRow onClick={() => onSelect(item.itemKey)} /> at its level;
    // QueueRow forwards onClick to the actual <button>.
    expect(src).toMatch(/onClick=\{\(\)\s*=>\s*onSelect\(item\.itemKey\)\}/);
  });

  it("queue row surfaces a reply-preview when state is reply_waiting", () => {
    expect(src).toMatch(
      /item\.state\s*===\s*"reply_waiting"\s*&&\s*item\.latestStudentReply/,
    );
    expect(src).toMatch(/⇠/); // back-arrow icon
  });
});

describe("/teacher/inbox C.2 — detail (right pane)", () => {
  it("DetailPane renders both Student response + AI draft section labels", () => {
    expect(src).toMatch(/>\s*Student response\s*</);
    // The AI draft header label varies by state:
    //   - "AI draft" for drafted / no_draft
    //   - "AI follow-up draft" for reply_waiting (C.3)
    // Match either form.
    expect(src).toMatch(/AI (?:follow-up )?draft\b/);
  });

  it("AI draft textarea is editable inline (draftEdits state keyed by itemKey)", () => {
    expect(src).toContain('data-testid="inbox-draft-textarea"');
    expect(src).toMatch(/setDraftEdits\(\(prev\)\s*=>/);
  });

  it("textarea falls back to item.aiCommentDraft when no edit exists", () => {
    expect(src).toMatch(
      /draftEdits\[item\.itemKey\]\s*\?\?\s*item\.aiCommentDraft/,
    );
  });
});

describe("/teacher/inbox C.2 — low-confidence warning", () => {
  it("threshold pinned at 0.4 (LOW_CONFIDENCE_THRESHOLD)", () => {
    expect(src).toMatch(/LOW_CONFIDENCE_THRESHOLD\s*=\s*0\.4/);
  });

  it("shows an amber 'Review carefully' band when confidence < threshold", () => {
    expect(src).toContain('data-testid="inbox-low-confidence-warning"');
    expect(src).toMatch(/Review carefully/);
  });

  it("low-confidence approve button is amber (not emerald) so the visual signal is unmissable", () => {
    expect(src).toMatch(
      /isLowConfidence[\s\S]*?\?\s*"bg-amber-500\s+text-white\s+hover:bg-amber-600/,
    );
  });

  it("confidence chip carries data-low-confidence attr for downstream e2e", () => {
    expect(src).toMatch(/data-low-confidence=\{isLowConfidence\}/);
  });
});

describe("/teacher/inbox C.2 — approve flow", () => {
  it("approve button has data-testid + writes through PUT /api/teacher/grading/tile-grades", () => {
    expect(src).toContain('data-testid="inbox-approve-button"');
    expect(src).toMatch(/method:\s*"PUT"/);
    expect(src).toContain("/api/teacher/grading/tile-grades");
  });

  it("approve payload promotes ai_comment_draft → student_facing_comment + score + confirmed=true", () => {
    expect(src).toMatch(/student_facing_comment:\s*draftText/);
    expect(src).toMatch(/score:\s*item\.aiScore/);
    expect(src).toMatch(/confirmed:\s*true/);
  });

  it("optimistic drop: approved item removed from local items list (next item auto-selects)", () => {
    expect(src).toMatch(/setItems\(\(prev\)\s*=>[\s\S]*?\.filter\(\(p\)\s*=>\s*p\.itemKey\s*!==\s*item\.itemKey\)/);
  });

  it("auto-advance via useEffect when selectedKey no longer in visibleItems", () => {
    expect(src).toMatch(
      /selectedKey\s*&&\s*!visibleItems\.find\(\(i\)\s*=>\s*i\.itemKey\s*===\s*selectedKey\)/,
    );
    expect(src).toMatch(/setSelectedKey\(visibleItems\[0\]\?\.itemKey\s*\?\?\s*null\)/);
  });

  it("approve is disabled when draft text is empty (defensive)", () => {
    // C.3 expanded canApprove to an IIFE handling reply_waiting vs
    // drafted/no_draft branches. The empty-text guard still applies
    // — pin the trim check at the top of the IIFE.
    expect(src).toMatch(/if\s*\(!draftValue\.trim\(\)\)\s*return\s+false/);
  });
});

describe("/teacher/inbox C.2 — skip + open-in-marking-page", () => {
  it("skip button hides the item from this session (client-only set)", () => {
    expect(src).toContain('data-testid="inbox-skip-button"');
    expect(src).toMatch(/setSkipped\(\(prev\)\s*=>\s*new\s+Set\(prev\)\.add\(selectedItem\.itemKey\)\)/);
  });

  it("'Open in marking page →' link preserves class + unit query params", () => {
    expect(src).toMatch(
      /\/teacher\/marking\?class=\$\{item\.classId\}&unit=\$\{item\.unitId\}/,
    );
  });
});
