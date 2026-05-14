/**
 * Source-static structural tests for the Phase F.C choice-card brief
 * template editor + the trigger button wired into ChoiceCardsLibraryPicker.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const editorSrc = readFileSync(
  join(__dirname, "..", "ChoiceCardBriefTemplateEditor.tsx"),
  "utf-8",
);
const pickerSrc = readFileSync(
  join(__dirname, "..", "ChoiceCardsLibraryPicker.tsx"),
  "utf-8",
);

describe("ChoiceCardBriefTemplateEditor — structure (Phase F.C)", () => {
  it("portal-mounts at document.body to escape ancestor containing blocks (Lesson #89)", () => {
    expect(editorSrc).toContain('import { createPortal } from "react-dom"');
    expect(editorSrc).toContain("createPortal(");
    expect(editorSrc).toContain("document.body");
  });

  it("SSR-safe mount gate (createPortal only after hydration)", () => {
    expect(editorSrc).toMatch(/const \[mounted, setMounted\] = useState\(false\)/);
    expect(editorSrc).toMatch(/setMounted\(true\)/);
    expect(editorSrc).toContain("if (!open || !mounted) return null;");
  });

  it("fetches on each open + resets state (no stale leak between cards)", () => {
    expect(editorSrc).toMatch(
      /fetch\(`\/api\/teacher\/choice-cards\/\$\{encodeURIComponent\(cardId\)\}`\)/,
    );
    expect(editorSrc).toContain("setSavedAt(null)");
    expect(editorSrc).toContain("setErr(null)");
  });

  it("saves via PATCH with the 3 brief template fields", () => {
    expect(editorSrc).toMatch(/method: "PATCH"/);
    expect(editorSrc).toMatch(/brief_text:[\s\S]*?brief_constraints:[\s\S]*?brief_locks:/);
  });

  it("reuses DesignConstraintsEditor + LockToggle from the unit-brief tree", () => {
    expect(editorSrc).toMatch(
      /import \{ DesignConstraintsEditor \} from "@\/components\/teacher\/unit-brief\/DesignConstraintsEditor"/,
    );
    expect(editorSrc).toMatch(
      /import \{ LockToggle \} from "@\/components\/teacher\/unit-brief\/LockToggle"/,
    );
  });

  it("plumbs locks + onToggleLock down to DesignConstraintsEditor", () => {
    expect(editorSrc).toMatch(
      /<DesignConstraintsEditor[\s\S]*?locks=\{locks\}[\s\S]*?onToggleLock=\{handleToggleLock\}/,
    );
  });

  it("LockToggle next to the brief_text textarea (matches unit-brief editor pattern)", () => {
    expect(editorSrc).toMatch(
      /<LockToggle[\s\S]*?field="brief_text"[\s\S]*?locked=\{locks\["brief_text"\] === true\}/,
    );
  });

  it("ESC / backdrop / close button all dismiss the modal", () => {
    expect(editorSrc).toMatch(/data-testid="choice-card-brief-template-backdrop"/);
    expect(editorSrc).toMatch(/data-testid="choice-card-brief-template-close"/);
    expect(editorSrc).toMatch(/aria-modal="true"/);
  });

  it("save button has stable testid for smoke", () => {
    expect(editorSrc).toMatch(/data-testid="choice-card-brief-template-save"/);
  });
});

describe("ChoiceCardsLibraryPicker — Phase F.C brief-template wiring", () => {
  it("imports ChoiceCardBriefTemplateEditor", () => {
    expect(pickerSrc).toMatch(
      /import ChoiceCardBriefTemplateEditor from "\.\/ChoiceCardBriefTemplateEditor"/,
    );
  });

  it("tracks the active card for the brief-template editor", () => {
    expect(pickerSrc).toMatch(/const \[briefEditorFor, setBriefEditorFor\] = useState/);
    expect(pickerSrc).toMatch(/cardId:[\s\S]*?cardLabel:/);
  });

  it("CardPreview gains onEditBriefTemplate prop", () => {
    expect(pickerSrc).toMatch(/onEditBriefTemplate: \(\) => void/);
  });

  it("Each card row renders a '📋 Edit brief template' trigger button below the thumbnail", () => {
    expect(pickerSrc).toContain("📋 Edit brief template");
    expect(pickerSrc).toMatch(/data-testid=\{`card-edit-brief-\$\{card\.id\}`\}/);
  });

  it("Renders the ChoiceCardBriefTemplateEditor modal at the picker's root (only when a card is targeted)", () => {
    expect(pickerSrc).toMatch(/\{briefEditorFor && \([\s\S]*?<ChoiceCardBriefTemplateEditor/);
    expect(pickerSrc).toMatch(/cardId=\{briefEditorFor\.cardId\}/);
    expect(pickerSrc).toMatch(/cardLabel=\{briefEditorFor\.cardLabel\}/);
  });

  it("Outer wrapping element is a <div> (so we can nest both the toggle button and the brief-template trigger as siblings)", () => {
    // Nested buttons aren't valid HTML — the wrapper must be a non-
    // interactive element. The toggle <button> handles card selection;
    // the brief-template trigger is its own <button>.
    expect(pickerSrc).toMatch(/<div className="relative">[\s\S]*?<button[\s\S]*?onClick=\{onToggle\}/);
  });
});
