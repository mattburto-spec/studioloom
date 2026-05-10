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
