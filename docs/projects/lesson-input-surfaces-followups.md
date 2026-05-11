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

## FU-LIS-STUDENT-IMAGE-MODERATION-FALSE-POSITIVE — Beach photo blocked, but the gate that fired is unclear
**Surfaced:** 10 May 2026, post-image-upload smoke (Matt)
**Target phase:** Trigger when more student-side image-upload usage surfaces additional false-positives (currently N=1)
**Severity:** 🟡 MEDIUM — students who hit it have no escape hatch (error message says "talk to your teacher" but no teacher-override path exists)

**Symptom:** Matt smoke-tested student-side image upload by uploading a beach scene (Hawaiian sand + ocean + palm trees) into a "Mid-Studio evidence" upload prompt. The response was rejected with the inline error: **"This content can't be submitted. If you think this is a mistake, talk to your teacher."**

Screenshot included in the originating chat. The image is clearly benign (landscape photo, no people, no problematic content) — clean false positive.

**Diagnosis update 10 May 2026 (post-investigation):**

The error text Matt saw maps to `MODERATION_MESSAGES.en` in `src/lib/content-safety/client-filter.ts:144` — the **TEXT-content** filter, NOT the **IMAGE** filter. The image filter uses a different message: `IMAGE_MODERATION_MESSAGES.en` = "This **image** can't be **uploaded**…" (`src/lib/content-safety/client-image-filter.ts:141`).

That means **whatever gate fired was not NSFWJS image classification**, OR the image filter fired and the wrapping component surfaced the wrong message constant. Two candidates:

1. **A text-content filter ran on the response payload.** The prompt asks for a caption ("Caption it in one line"). If the caption tripped the text filter, or if a stringified JSON of the upload metadata got passed through `checkClientSide`, this is the error path. Worth checking what content was passed to moderation.
2. **An image-filter false positive surfaced via the wrong message constant.** Some unfound wrapping component uses `MODERATION_MESSAGES` when it should use `IMAGE_MODERATION_MESSAGES`. Grep for callers of `checkClientImage` that don't import `IMAGE_MODERATION_MESSAGES`.

Audit of grep results in the lesson page path: `UploadInput` uses `IMAGE_MODERATION_MESSAGES` correctly; `StructuredPromptsResponse` uses `IMAGE_MODERATION_MESSAGES` correctly. The only file in the codebase that uses `MODERATION_MESSAGES` (text) on an upload path is `src/components/quest/EvidenceCapture.tsx` — which is the Quest/Open-Studio surface, not the lesson page. So if Matt's surface was a lesson page, candidate #1 (text filter on caption/payload) is more likely.

**About the image filter (relevant if it turns out to be #2):**

`src/lib/content-safety/client-image-filter.ts` uses **NSFWJS** ([`@tensorflow/tfjs` + nsfwjs model](https://github.com/infinitered/nsfwjs)) with a **SUMMED** threshold rule (lines 113-118):

```js
const combined = porn + hentai + sexy;  // sum of 3 categories
if (combined > BLOCK_THRESHOLD) { /* block, default 0.6 */ }
```

NSFWJS routinely returns small non-zero scores across all categories (model uncertainty). On beach scenes the typical pattern is porn≈0.10 + hentai≈0.05 + sexy≈0.45 = 0.60 → blocked, even though no single category clears 0.5 alone. A **MAX-of-three** rule would not false-positive on the same image. (Trade-off: any single category > 0.4 catches more borderline cases.)

The filter is also a hard block with no `?override=true` query param, no teacher-bypass token, no whitelist by file hash. When it fires, the student is stuck. There IS a `/api/safety/log-client-block` POST that logs `flags` + `layer`, but no surface today exposes those flags to the teacher.

**Suggested investigation (now sharper):**

1. **Reproduce with DevTools open.** Repeat the upload; watch the Network tab for `POST /api/safety/log-client-block`. The request body's `layer` field tells you which gate fired (`client_text` vs `client_image`). The `flags` array tells you what categories tripped. Console may also log `[content-safety]` warnings.
2. **If layer === "client_image":** check NSFWJS scores in the flag detail (the filter emits `"NSFW scores: porn=X, hentai=Y, sexy=Z"`). Confirm sum > 0.6 with no single category > 0.5 — i.e. the summed-threshold problem. Fix is **MAX-of-three** rule.
3. **If layer === "client_text":** trace what text content was passed. Check the caption field, then walk back the response-input wrappers to see if the upload metadata JSON gets stringified into a moderation call (Phase 5F-style submit-time check).
4. **If a layer reported in flags doesn't match any known component:** there's an unfound moderation gate. Grep harder.

**Three possible fixes (still applies regardless of which gate fired):**
- **Tune thresholds / rule:** for image filter, MAX-of-three instead of SUM. For text filter, look at what tripped (we don't have ground truth yet).
- **Add teacher override path:** "Request teacher review" button posts to a teacher inbox. Existing `safety/log-client-block` route can carry the override request.
- **Migrate to server-side moderation:** "Uploading..." then either success or "held for review" — removes the perceived false positive from the student's flow.

**When to revisit:** When ≥3 false-positives are reported, OR a student loses a portfolio submission to it. **First CTA: build a teacher-visible block log.** Every block already fires `/api/safety/log-client-block`; surfacing those on the existing teacher safety dashboard would let Matt see the false-positive rate over time without students having to flag it manually. That's the cheapest move before doing rule changes.

**Origin:** Student-side smoke 10 May 2026. Investigation update 10 May 2026 after grepping the codebase for the exact error string.

---

## ✅ FU-CLASS-UNITS-IS-ACTIVE-AUDIT — RESOLVED 11 May 2026 (PR #202)
**Surfaced:** 10 May 2026, post unit/class sync fix
**Resolved:** 11 May 2026 via PR #202 (squash-merged at `8d60623`)
**Severity at resolution:** 🟢 LOW — proactive sweep after three reactive fixes (#189/#196/#199)

**What shipped:** Walked every `class_units` read in `src/`. 9 read sites that lacked `.eq("is_active", true)` were fixed in one batch:

- `/api/student/insights` (×2: unit_id list + nm_config list)
- `/api/student/nm-assessment` (NM config lookup)
- `/api/student/nm-checkpoint/[pageId]` (NM config lookup)
- `/api/student/open-studio/check-in` (framework probe)
- `/api/student/safety/pending` (badge requirement unit list)
- `src/lib/design-assistant/conversation.ts` (×2: legacy + multi-class framework probes)
- `/teacher/teach/[unitId]` (teach-mode class picker — Matt's smoke surface)
- `/teacher/units/[unitId]/edit` (first-class redirect target)

Writes / probes targeting a single explicit `(class_id, unit_id)` pair (toggle, fork, promote, nm-config update) were intentionally left alone — they need to see soft-removed rows. Decision is documented in the audit test header.

**Lock-in:** `src/__tests__/class-units-is-active-audit.test.ts` source-statics each filter with regex. 10 tests pass. Future regressions trip a test, not a smoke round.

**Closed via PR:** [#202](https://github.com/mattburto-spec/studioloom/pull/202).

---

## ARCHIVED — original FU body for reference
**Severity at filing:** 🟢 LOW — symptom-driven, no known additional surfaces today

**Origin:** Fix for the unit-page-vs-class-page assignment sync (the unit page was reading `class_units` without `is_active=true`, so soft-removed assignments surfaced as active). The fix is one line on `src/app/teacher/units/[unitId]/page.tsx`, but the codebase has ~20 other files that read `class_units`. Many should filter on `is_active=true`; some legitimately don't (e.g. the class page itself, which reads the full set to render the per-unit toggle state).

**Files that touch `class_units`** (audit needed for each: should this read filter on `is_active`?):

```
src/app/api/student/unit/route.ts
src/app/api/student/progress/route.ts
src/app/api/student/design-assistant/route.ts
src/app/api/student/insights/route.ts
src/app/api/student/open-studio/check-in/route.ts
src/app/api/student/search/route.ts
src/app/api/student/units/route.ts
src/app/api/student/safety/pending/route.ts
src/app/api/student/nm-assessment/route.ts
src/app/api/student/nm-checkpoint/[pageId]/route.ts
src/app/api/storage/[bucket]/[...path]/authorize.ts
src/app/api/teacher/pypx-cohort/route.ts
src/app/api/teacher/schedule/today/route.ts
src/app/api/teacher/nm-results/route.ts
src/app/api/teacher/grading/tile-grades/ai-prescore/route.ts
src/app/api/teacher/class-units/route.ts
src/app/api/teacher/class-units/content/route.ts
src/app/api/teacher/units/versions/route.ts
src/app/api/teacher/dashboard/route.ts
src/app/api/teacher/search/route.ts
```

**Decision rule per file:**

- **Student-side routes:** should always filter `is_active=true`. A student should never see content from an assignment that's been removed.
- **Teacher admin routes (`/api/teacher/dashboard`, `/api/teacher/search`, etc.):** should usually filter `is_active=true` unless the surface intentionally shows soft-removed assignments (e.g. an "Unit History" panel).
- **Storage proxy:** the `/api/storage/[bucket]/[...path]/authorize.ts` file uses `class_units` for the per-bucket authorization chain (the LIS S5 security closure). If a class soft-removes a unit, should students lose access to the unit's images? Probably yes — but worth confirming the intent.
- **Grading + NM:** assessment data should persist past assignment removal (don't lose student work), but new write paths should refuse. Read for display vs read for write authorization are different checks.

**Suggested investigation:**

1. Walk each file in the list above. For each, ask: "if a soft-removed assignment row is included, what UX bug does that cause?" If the answer is "the student sees stale content" or "the teacher sees a stale assignment toggle," add `.eq("is_active", true)`. If the answer is "no bug" or "we want history," leave it.
2. After the audit, file a single PR with all the fixes + a corresponding source-static test per file.

**When to revisit:** If Matt or a teacher reports another "I removed it but it's still showing up" issue. The unit/class sync fix only patched the surface he reported.

**Origin:** Fix shipped via PR (forthcoming). Audit list captured from `grep -rln "from.*class_units" src` on 10 May 2026.

---
