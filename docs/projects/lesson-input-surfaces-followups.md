# Lesson Input Surfaces (LIS) — Follow-up Tickets

> Items surfaced during LIS phase work that are NOT blockers for the
> phase they were found in, but should be picked up before LIS is
> declared "v1 done." Each entry: short title, when surfaced, symptom,
> suspected cause, suggested investigation, target phase or trigger.
>
> Phase order: LIS.A (KeyInformationCallout opt-in) → LIS.A.2 (auto-flip
> info blocks) → LIS.A.3 (hoist framing to title) → **LIS.B
> (RichTextResponse + integrity port — auto-replace text responses)** →
> LIS.C (MultiQuestionResponse + persistence port) → LIS.D (lesson
> editor UI for callouts/stepper/rich-text) → **LIS.E (this file's
> open items, closed before declaring LIS done)**.

---

## ✅ FU-LIS-PORTFOLIO-NARRATIVE-DISPLAY — RESOLVED 10 May 2026 (LIS.E)

**Resolution:** `buildNarrativeSections` now accepts a third arg `portfolioEntries: PortfolioEntry[]` (default `[]` for back-compat) and widens the portfolio-filter inclusion: a section's response surfaces in Narrative when **either** the section has `portfolioCapture: true` (auto-capture path) **OR** there's a `portfolio_entries` row for the section's `(page_id, section_index)` (manual capture path). Both callers (`narrative/page.tsx` + `NarrativeModal.tsx`) updated to pass through the entries that were already being fetched. Tests added: 7 → 12 (+5 covering the inclusion gate, negative control, back-compat default, exact-coord matching, and standalone-note exclusion).

**Root cause (preserved for the archive):**


**Surfaced:** 10 May 2026, LIS.B smoke (Matt)
**Target phase:** LIS.E (close before LIS v1 declared done)
**Severity:** 🟡 MEDIUM — display gap; data is being saved, just not surfaced

**Symptom:**
- Student types a response in the new RichTextResponse text input.
- Student presses the Portfolio capture affordance (the button next to
  the response, OR the section's `portfolioCapture: true` auto-capture).
- Open `/portfolio` view → the response appears ✓
- Open `/unit/[unitId]/narrative` view → the response is **missing** ✗

**Why it's not necessarily LIS.B's fault:**
- LIS.B only changed the EDITOR component (RichTextResponse), not the
  persistence path. The response writes through the existing lesson
  autosave to `student_progress.responses[responseKey]` AND the existing
  Portfolio capture writes to `portfolio_entries`.
- Both surfaces (Portfolio + Narrative) have read-side HTML handling
  via `looksLikeRichText` + `dangerouslySetInnerHTML` — that's already
  on main and unchanged.

**Suspected causes (in priority order):**
1. **Narrative reads ONLY from `student_progress.responses`, not
   `portfolio_entries` (per `StructuredPromptsResponse.tsx:90` comment
   "Narrative reads from student_progress.responses, not
   portfolio_entries").** The lesson autosave should be populating that
   column, but maybe a recent path bypasses it for certain response
   types (e.g. when a student actively presses "Send to Portfolio"
   without leaving the lesson).
2. **`buildNarrativeSections()` filter** (in `src/lib/narrative/`)
   may exclude the response based on:
   - empty/falsy check that doesn't account for HTML-only content
     (`<p></p>` has no textContent but isn't empty as a string)
   - section key shape mismatch (e.g. it expects `section_N` keys
     but the new render path uses `activity_<id>` keys)
3. **A timing issue** — the autosave debounce (~2s) hadn't fired by
   the time the student opened Narrative. If true, refreshing after a
   minute or two would surface the response. (Easy first check.)

**Suggested investigation:**
1. Reproduce: type a response, send to portfolio, open Narrative
   immediately → confirm absent. Wait 30s, refresh → still absent?
2. Open Supabase, query `student_progress.responses` for that page →
   confirm the response IS in the JSONB column.
3. If yes (data is saved): the bug is in NarrativeView's read filter.
   - Read `src/components/portfolio/NarrativeView.tsx` →
     `buildNarrativeSections()` logic.
   - Find what filters/transforms the response key/value before display.
   - Check if HTML-only-empty (`<p></p>`, `<br>`) bypasses the
     truthy filter.
4. If no (data is NOT saved): the lesson autosave isn't picking up
   this section's response. Diff against the StructuredPromptsResponse
   path which DOES save successfully.

**Don't forget:** the same FU likely applies to PortfolioPanel — Matt
flagged "I think there are some probs displaying info even though it's
being saved" suggesting the issue may be broader than narrative alone.
Triage both surfaces together when LIS.E starts.

**Origin:** Smoke session 10 May 2026, immediately after LIS.B merged
to main as `7af4765`. No regression from LIS.B itself — the gap
predates the auto-replace, but LIS.B made the response surface itself
prominent enough that the downstream gap became visible.

---

## FU-LIS-EDITOR-IMAGE-LIBRARY — Add "Find an image" library button to ActivityBlock media + LessonIntroEditor hero
**Surfaced:** 10 May 2026, post-editor-image-upload smoke (Matt)
**Target phase:** Trigger on next editor-polish pass
**Severity:** 🟢 LOW — nice-to-have alongside Upload + URL paste

**Origin:** PR [#174](https://github.com/mattburto-spec/studioloom/pull/174) shipped Upload + URL paste in the media tab. Matt asked: "is there a way to put 2 buttons: find an image (from some kind of image library) or generate an AI image". Library half of that ask.

**Symptom:** Today, when a teacher wants an image, the only options are:
1. Paste a URL (works for YouTube / Vimeo / external images)
2. Upload from device (PR #174)

There's no curated library for "I need an icebreaker image for this lesson but don't have one on hand."

**Suggested implementation:**
- Reuse `src/components/teacher/UnitThumbnailPicker.tsx` — already has 30 curated Unsplash photos covering design / workshop / maker / robotics / electronics themes
- Refactor it to be image-library-only (decouple from the "set as unit thumbnail" mutation it currently does as a side effect)
- Add a third button "🎨 Library" next to Upload in both `ActivityBlock` media tab + `LessonIntroEditor` hero
- Click opens a modal grid; click a photo → sets `media.url` to the Unsplash URL (no upload required — Unsplash URLs are public + stable)
- Estimated effort: ~30 min

**When to revisit:** when Matt or another teacher needs a quick image and the URL/upload flow feels heavy. Or bundle with FU-LIS-EDITOR-AI-IMAGE-GEN as a "media stack v2" PR.

---

## FU-LIS-EDITOR-AI-IMAGE-GEN — Add "Generate AI image" button to ActivityBlock media + LessonIntroEditor hero
**Surfaced:** 10 May 2026, post-editor-image-upload smoke (Matt)
**Target phase:** Trigger when a specific lesson needs a custom image that isn't in the library and the teacher doesn't have one
**Severity:** 🟢 LOW — nice-to-have, but a real workflow improvement when the moment arrives

**Origin:** PR [#174](https://github.com/mattburto-spec/studioloom/pull/174) shipped Upload + URL paste. Matt asked: "is there a way to put 2 buttons: find an image (from some kind of image library) or generate an AI image". AI-gen half of that ask. Sibling of FU-LIS-EDITOR-IMAGE-LIBRARY.

**Suggested implementation:**
- Provider: OpenAI DALL-E 3 is the obvious default ($0.04 standard / $0.08 HD per image, ~10s latency, well-documented REST API). Alternatives: Replicate-hosted Stable Diffusion, Black Forest Labs Flux, Anthropic doesn't ship image gen.
- New route: `POST /api/teacher/generate-image` taking `{prompt, unitId, quality?}` → calls DALL-E → uploads result to `unit-images` bucket under `{unitId}/blocks/gen-{timestamp}.jpg` → returns proxy URL
- Wire through the existing `withAIBudget` discipline — per-teacher budget cap + cost log entry
- New entry in `docs/vendors.yaml` (OpenAI as a sub-processor) + DPA review per the existing vendor approval pattern
- UI: prompt textbox + Generate button + preview + Accept / Regenerate / Cancel actions inside the media tab
- Estimated effort: ~2-4 hours (longest part: budget integration + vendor registry + cost-cap discipline)

**Stop triggers when this gets built:**
- Per-teacher budget cap — image gen is meaningfully more expensive than text calls; needs cost ceiling enforcement before launch
- Vendor approval — adding OpenAI as a sub-processor needs DPA review per the existing pattern
- Prompt moderation — DALL-E 3 has its own moderation but a wrapper layer (similar to `checkClientImage` for student uploads) makes sense for teacher-side gen too

**When to revisit:** when a teacher hits a real moment of "I need a specific custom image for this lesson and the library doesn't have it." Triggering moment is more valuable than building it speculatively.

---

## FU-LIS-STUDENT-IMAGE-MODERATION-FALSE-POSITIVE — Beach photo blocked by checkClientImage
**Surfaced:** 10 May 2026, post-image-upload smoke (Matt)
**Target phase:** Trigger when more student-side image-upload usage surfaces additional false-positives (currently N=1)
**Severity:** 🟡 MEDIUM — students who hit it have no escape hatch (error message says "talk to your teacher" but no teacher-override path exists)

**Symptom:** Matt smoke-tested student-side image upload by uploading a beach scene (Hawaiian sand + ocean + palm trees) into a "Mid-Studio evidence" upload prompt. The response was rejected with the inline error: **"This content can't be submitted. If you think this is a mistake, talk to your teacher."**

Screenshot included in the originating chat. The image is clearly benign (landscape photo, no people, no problematic content) — clean false positive.

**Suspected cause:**
The client-side image filter at `src/lib/content-safety/client-image-filter.ts` uses **NSFWJS** ([`@tensorflow/tfjs` + nsfwjs model](https://github.com/infinitered/nsfwjs)) for browser-side classification. NSFWJS has known false-positive rates on:
- Beach scenes (skin-tone heuristics + sand colour confusion)
- Sunset / warm-colour gradients (similar to skin tones)
- Anything with lots of orange / pink in the foreground

The filter is also a hard block — no `?override=true` query param, no teacher-bypass token, no whitelist by file hash. When it fires, the student is stuck.

**Suggested investigation:**
1. **Reproduce** with the exact beach photo Matt used (preserved in the screenshot) — confirm NSFWJS classification scores.
2. **Read** `src/lib/content-safety/client-image-filter.ts` to see the current thresholds. NSFWJS returns 5 categories: Drawing / Hentai / Neutral / Porn / Sexy. The block likely fires when one of the latter four crosses a threshold. The "Sexy" category is the most common false-positive driver on beach photos.
3. **Three possible fixes** (any combo):
   - **Tune thresholds:** raise the "Sexy" threshold (e.g. from 0.5 → 0.7) — trades a few false negatives for many fewer false positives. Hard to land without ground-truth data.
   - **Add teacher override path:** when a student gets blocked, surface a "Request teacher review" button that posts to a teacher inbox. Teacher can mark the image as approved + reset the block (existing `safety/log-client-block` route can be extended).
   - **Migrate to server-side moderation:** push the image to Supabase Storage with a "pending" flag, then run a server-side moderation step (could use OpenAI's moderation API, or AWS Rekognition's content moderation) before flipping the flag to "approved". Removes the false-positive from the student's perceived experience entirely — they see "Uploading..." then either success or a held-for-review state.

**Lesson #57-flavour:** the client-side moderation is on a fast path (NSFWJS is ~200ms). Server-side moderation would be ~1-2s. The right trade-off depends on the false-positive rate against real student uploads — N=1 isn't enough data to commit to migration.

**When to revisit:** When ≥3 false-positives are reported, OR a student loses a portfolio submission to it (currently the only signal is "the teacher hears about it"). The CTA to add **right now** is logging — every block fires `/api/safety/log-client-block` with the NSFWJS scores; surface those on the existing teacher safety dashboard so Matt can see the false-positive rate over time without students having to flag it manually.

**Origin:** Student-side smoke 10 May 2026. PortfolioCaptureAffordance / MultiQuestionResponse / StructuredPromptsResponse all share the same `checkClientImage` gate; this would also fix the structured-prompts photo-attach path if it's ever hit there.

---
