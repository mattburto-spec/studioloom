/**
 * Round 30 (7 May 2026, NIS Class 1 day) — StructuredPromptsResponse
 * blank-after-refresh fix.
 *
 * Per Matt during Class 1: "lesson 1 structured prompts are saving
 * inititially (goes green) and the data is viewable in portfolio
 * after... but if i refresh page then the form appears blank again
 * (good thing data still visible in portfolio)".
 *
 * Repro: fresh page load. usePageData fetches /api/student/progress
 * asynchronously. At first render savedValue="" (parent's responses
 * state is still {}). Component mounts with editing=true and
 * responses={} from the useState initializer. The server response
 * arrives, parent re-renders with savedValue=<saved markdown>. But
 * useState initializers run ONCE — internal state stays empty. The
 * button label flips to "Update saved entry" (re-evaluated each
 * render via hasSavedEntry) but the form textareas show placeholders.
 *
 * Fix: useEffect watching savedValue. When it transitions from empty
 * → non-empty AND the user hasn't started editing yet, sync internal
 * state from parseComposedContent(savedValue) + flip to saved-preview
 * mode. userHasEditedRef ensures we don't clobber in-progress edits.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const SRC = readFileSync(
  join(__dirname, "..", "StructuredPromptsResponse.tsx"),
  "utf-8"
);

describe("StructuredPromptsResponse — round 30 late-savedValue sync", () => {
  it("imports useEffect (was missing — the round-30 sync needs it)", () => {
    expect(SRC).toMatch(/import\s*\{[^}]*\buseEffect\b[^}]*\}\s*from\s*"react"/);
  });

  it("declares userHasEditedRef to gate the sync against in-progress edits", () => {
    expect(SRC).toMatch(/userHasEditedRef\s*=\s*useRef\(false\)/);
  });

  it("useEffect watches savedValue and syncs when transitioning empty → non-empty", () => {
    expect(SRC).toMatch(
      /useEffect\(\(\)\s*=>\s*\{[\s\S]{0,400}has\s*&&\s*!userHasEditedRef\.current[\s\S]{0,300}setResponses\(parseComposedContent\(prompts,\s*savedValue\s*\?\?\s*""\)\)[\s\S]{0,200}setEditing\(false\)/
    );
  });

  it("setResponseFor flips userHasEditedRef.current = true on first user keystroke", () => {
    expect(SRC).toMatch(
      /function setResponseFor[\s\S]{0,500}userHasEditedRef\.current\s*=\s*true/
    );
  });

  it("successful save resets userHasEditedRef.current = false (clean for next sync)", () => {
    // Look in the post-save block (after setResponses({}), before setPhotoFile)
    expect(SRC).toMatch(
      /setResponses\(\{\}\)[\s\S]{0,300}userHasEditedRef\.current\s*=\s*false/
    );
  });

  it("does NOT sync when user has started editing (protects in-progress text)", () => {
    // Anchor on the actual useEffect *call* (skipping the import + comments).
    const effectIdx = SRC.indexOf("useEffect(() => {");
    expect(effectIdx).toBeGreaterThan(0);
    const slice = SRC.slice(effectIdx, effectIdx + 800);
    expect(slice).toContain("!userHasEditedRef.current");
  });
});
