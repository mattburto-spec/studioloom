/**
 * TFL.3 C.4 — tweak buttons (Shorter / Warmer / Sharper / + Ask)
 * source-static guards.
 *
 * Pins:
 *   - TweakRow component renders the 4 buttons with data-testids
 *   - Each preset button fires onTweak with the right directive
 *   - "+ Ask" expands an inline input + Apply button + cancel
 *   - Buttons disabled when there's no draft to tweak (empty, follow-up
 *     fetching, sentinel state)
 *   - handleTweak in parent posts to /regenerate-draft + updates the
 *     correct draft slot (followupDrafts for reply_waiting, draftEdits
 *     otherwise)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "..", "page.tsx"), "utf-8");

describe("/teacher/inbox C.4 — TweakRow component", () => {
  it("renders 4 buttons (shorter / warmer / sharper / ask) with data-testids", () => {
    expect(src).toContain('data-testid="inbox-tweak-row"');
    expect(src).toContain('data-testid={`inbox-tweak-${d}`}');
    expect(src).toContain('data-testid="inbox-tweak-ask"');
    // The preset loop covers shorter/warmer/sharper.
    expect(src).toMatch(/\["shorter",\s*"warmer",\s*"sharper"\]\s+as\s+const/);
  });

  it("preset buttons fire onTweak with the directive", () => {
    expect(src).toMatch(/onClick=\{\(\)\s*=>\s*onTweak\(d\)\}/);
  });

  it("Ask button toggles an inline panel (data-testid inbox-tweak-ask-panel)", () => {
    expect(src).toContain('data-testid="inbox-tweak-ask-panel"');
    expect(src).toMatch(/setAskOpen\(!askOpen\)/);
  });

  it("Ask panel renders an input + Apply button", () => {
    expect(src).toContain('data-testid="inbox-tweak-ask-input"');
    expect(src).toContain('data-testid="inbox-tweak-ask-apply"');
  });

  it("Apply button fires onTweak('ask', askText) when text is non-empty", () => {
    expect(src).toMatch(/onClick=\{\(\)\s*=>\s*onTweak\("ask",\s*askText\)\}/);
  });

  it("Enter key in ask input submits when text is non-empty", () => {
    expect(src).toMatch(
      /e\.key\s*===\s*"Enter"\s*&&\s*askText\.trim\(\)\s*&&\s*!tweaking/,
    );
  });

  it("row disables when draftValue is empty / fetching / sentinel / regenerating", () => {
    expect(src).toMatch(/if\s*\(followupFetching\)\s*return\s+"Wait for the AI follow-up to load\."/);
    expect(src).toMatch(/if\s*\(isNoFollowupSentinel\)\s*return/);
    expect(src).toMatch(/if\s*\(!draftValue\.trim\(\)\)\s*return/);
    expect(src).toMatch(/if\s*\(tweaking\)\s*return\s+"Regenerating…"/);
  });

  it("textarea is also disabled while a tweak is in flight (avoid races)", () => {
    expect(src).toMatch(
      /disabled=\{\s*tweaking\s*!==\s*null\s*\|\|[\s\S]*?followupFetching/,
    );
  });
});

describe("/teacher/inbox C.4 — handleTweak (parent)", () => {
  it("declares handleTweak as a useCallback that POSTs to /regenerate-draft", () => {
    expect(src).toMatch(/const handleTweak\s*=\s*React\.useCallback/);
    expect(src).toContain('"/api/teacher/grading/regenerate-draft"');
  });

  it("body includes grade_id, current_draft, directive, and conditionally ask_text", () => {
    expect(src).toMatch(/grade_id:\s*item\.gradeId/);
    expect(src).toMatch(/current_draft:\s*currentDraft/);
    expect(src).toMatch(/directive,/);
    expect(src).toMatch(
      /\.\.\.\(directive\s*===\s*"ask"\s*\?\s*\{\s*ask_text:/,
    );
  });

  it("mirrors DetailPane's baseDraft logic so the POSTed current_draft matches the textarea", () => {
    // The currentDraft is computed inside handleTweak using the same
    // followupForItem === NO_FOLLOWUP_SENTINEL → "" branching the
    // DetailPane does. If these drift, the AI tweaks the wrong text.
    expect(src).toMatch(
      /const followupForItem\s*=\s*followupDrafts\[itemKey\][\s\S]*?const baseDraft\s*=[\s\S]*?item\.state\s*===\s*"reply_waiting"/,
    );
  });

  it("on reply_waiting, regenerated body lands in followupDrafts (NOT draftEdits)", () => {
    expect(src).toMatch(
      /item\.state\s*===\s*"reply_waiting"[\s\S]*?setFollowupDrafts\(\(prev\)\s*=>\s*\(\{[\s\S]*?\[itemKey\]:\s*newBody/,
    );
  });

  it("on drafted/no_draft, regenerated body lands in draftEdits (so textarea picks it up via fall-through)", () => {
    expect(src).toMatch(
      /\}\s*else\s*\{\s*setDraftEdits\(\(prev\)\s*=>\s*\(\{[\s\S]*?\[itemKey\]:\s*newBody/,
    );
  });

  it("closes the ask panel + clears askText on successful ask-tweak", () => {
    expect(src).toMatch(
      /if\s*\(directive\s*===\s*"ask"\)\s*\{[\s\S]*?setAskOpen\(\(prev\)\s*=>[\s\S]*?setAskText\(\(prev\)/,
    );
  });

  it("rolls back tweaking flag in a finally + surfaces error via alert", () => {
    expect(src).toMatch(
      /\}\s*catch\s*\(err\)\s*\{\s*alert\(err instanceof Error/,
    );
    expect(src).toMatch(
      /\}\s*finally\s*\{\s*setTweaking\(\(prev\)\s*=>\s*\{[\s\S]*?delete next\[itemKey\]/,
    );
  });

  it("useCallback dependency array includes selectedItem + draftEdits + followupDrafts", () => {
    expect(src).toMatch(
      /\}, \[selectedItem, draftEdits, followupDrafts\]\)/,
    );
  });
});

describe("/teacher/inbox C.4 — no localStorage / no persistence beyond session", () => {
  it("tweak state lives in React useState only — no localStorage", () => {
    // The tweak result lands in followupDrafts/draftEdits which are
    // session-scoped. Persistence (if a teacher edits + reloads) would
    // be a separate feature; for now reload restores the AI's original
    // draft. Pin via grep — no localStorage.setItem near 'tweak'.
    const tweakLines = src
      .split("\n")
      .filter((l) => /tweak|tweaking|Tweak/i.test(l))
      .join("\n");
    expect(tweakLines).not.toMatch(/localStorage/);
  });
});
