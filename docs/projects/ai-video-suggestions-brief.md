# AI Video Suggestions — Design Brief

**Status:** Draft v1 for Matt to review
**Created:** 15 May 2026
**Scope:** Smallest version of teacher-facing video discovery that proves the loop. Activity Block only. YouTube only. Suggest-don't-attach.

**Headline recommendation:** Build v1 against **YouTube Data API v3** (`search.list` + `videos.list` with `safeSearch=strict`), wrapped behind a Claude-authored query and a Claude-authored re-ranker. Three suggestions, teacher previews, teacher picks, URL drops into `activity.media`. All AI calls go through `src/lib/ai/call.ts` → `callAnthropicMessages()` with endpoint `teacher/suggest-videos`. ~3 days likely.

## 1. User flow

- Button lives on the **Activity Block Media tab** only for v1. The Lesson Intro Hero Video field gets it in v1.1 once the Activity Block flow is proven.
- Button label: **"Suggest videos"**. Disabled until the block has at least a `framing` or `task` string saved (we need something to search on).
- Click → side panel slides in with a loading state. Backend builds a query from block context, hits YouTube, asks Claude to re-rank + label, returns top 3.
- Results render as 3 cards: thumbnail, title, channel, duration, a one-line **"Why this fits"** caption from Claude, and an embedded preview player (no autoplay).
- Teacher clicks **Attach** → the YouTube URL is written to `activity.media` (existing field, no schema change). Panel closes. Block is marked dirty.
- A small **"Suggest again"** link re-runs with a different seed and excludes already-shown video IDs.
- Failure modes (no results, API error, over-cap): inline panel message, no toast spam. Teacher can paste a URL manually as today.

## 2. Video source — recommend YouTube Data API v3

| Option | Coverage | Quality control | Integration cost | Verdict |
|---|---|---|---|---|
| **YouTube Data API v3** | Massive. Almost every educational video is here. | `safeSearch=strict`, `videoEmbeddable=true`, channel filters. | One API key in Vercel env, 10K units/day free. `search.list` = 100 units, so ~100 searches/day before paying. | **Pick this for v1.** |
| Anthropic web search (Claude tool-use) | Returns links, not structured video metadata. No thumbnails, no duration, no embeddability flag. | Inherits whatever the web ranks; no native safe-search. | Simpler — no second key — but we'd have to re-fetch every result anyway. | Defer. Not built for video discovery. |
| Vimeo API | Smaller catalog, more polished content. | Less moderation noise but also fewer K-12-shaped explainers. | Comparable integration cost. | Defer. May add as a secondary source in v2 if YouTube quality disappoints. |

**Cost estimate:** ~$0 for typical pilot use (free tier covers ~100 teacher searches/day). Claude side: re-rank prompt ~1.5K tokens in + ~500 out per call, ~$0.015 per click at Sonnet 4 pricing. 30/day cap per teacher → $0.45/teacher/day ceiling.

## 3. Content safety

Teachers vet before publishing, so this is defence-in-depth, not the only line.

- **YouTube `safeSearch=strict`** on every `search.list` call. Non-negotiable.
- **`videoEmbeddable=true`** so we never surface a "video unavailable" experience inside the platform.
- **Duration filter:** prefer `videoDuration=short` (under 4 min) or `medium` (4–20 min); exclude `long`.
- **Channel denylist (v1 light):** small starter denylist of channels we never surface (clickbait, reaction). Allowlist boost can come later.
- **Claude post-filter:** the re-ranker is told to reject clickbait, sensationalised, reaction, or off-topic. Rejected items are dropped silently.
- **Teacher preview is the backstop.** Card shows the embedded player; teacher must press Attach. No auto-attach in v1.

## 4. AI prompt design

Two AI calls per click — both via `callAnthropicMessages()`:

1. **Query builder** (Haiku 4.5, cheap): turns block context into a 6–10 word YouTube search query. Inputs: `unit.title`, `grade_level`, `activity.framing`, `activity.task`, `activity.success_signal`, `unit.subject` if present. Total ~150 tokens.
2. **Re-ranker + caption** (Sonnet 4): given the YouTube top-10 (title, channel, description snippet, duration), pick 3 best fits and write a one-line "Why this fits" caption for each.

**PII discipline:** no student names, no `firstName`, no `displayName`, no `.email` reach this prompt. Block fields are teacher-authored but still run through the standard sanitiser. Add this callsite to `REDACTION_ALLOWLIST` in `src/lib/security/__tests__/no-pii-in-ai-prompts.test.ts` with a dated justification, even though it shouldn't trip. No Discovery / student-persona context, no design-teaching corpus, no framework rubric. Keep it lean.

## 5. Suggest vs auto-add

**Suggest 3–5, teacher picks.** Reasons in priority order:

1. **Kid-safety.** YouTube safe-search is good, not perfect. A human gate before content reaches an 11-year-old is non-negotiable for v1.
2. **Teacher voice control.** A video is a pedagogical choice — pacing, tone, accent, cultural fit. The teacher knows their class.
3. **Low regret cost.** Wrong auto-attached videos require an edit + re-publish + (worst case) a student already saw it. Suggest-mode contains the blast radius to one click that didn't happen.

v1.x can add an auto-fill placeholder ("we pre-attached this; click to confirm or replace"). Not v1.

## 6. Telemetry + cost ceiling

- Every suggestion call logs to `ai_usage_log` via the helper's built-in `logUsage`. Endpoint: `teacher/suggest-videos`. Pass `teacherId` (triggers BYOK chain via `resolveCredentials`).
- `metadata: { unitId, lessonId, activityBlockId, gradeLevel, videosReturned, videosRejected }` for the `/admin/ai-budget` breakdown view.
- **Per-teacher daily cap: 30 suggestion runs/day.** Enforced via the existing budget-cap pattern in `src/lib/ai/call.ts` (the `withAIBudget` machinery used for student-facing routes, adapted for a teacher key). Over-cap → `{ ok: false, reason: "over_cap" }` → 429 with a panel-state message.
- YouTube quota tracked separately. v1 can trust the free tier and add a small `youtube_quota_log` row per call once we approach the ceiling.

## 7. Scope

**v1 (~3 days):**
- "Suggest videos" button on Activity Block Media tab.
- POST `/api/teacher/suggest-videos` route, gated by `requireTeacher()`.
- Query builder + YouTube `search.list` + `videos.list` (duration/embeddable) + Claude re-ranker.
- Side panel UI with 3 cards, embedded preview, Attach button.
- Writes URL to `activity.media`. Logs to `ai_usage_log`.

**Deferred (v1.1+):** Lesson Intro Hero Video button; bulk suggestion for a whole unit; watch-later / saved list per teacher; time-stamped chapter linking (`?t=120`); transcript ingestion for higher-quality re-rank; auto-attach placeholder mode; Vimeo as secondary source; channel allowlist editor for school admin.

## 8. Open questions for Matt

- **BYOK or platform-paid?** Light enough to platform-pay at pilot scale, but the BYOK chain already exists. Default platform-paid for v1?
- **Embeddable-only or also "watch on YouTube"?** Embeddable-only is safer; external links open the catalogue but break contained UX.
- **Type tags?** Tag each suggestion tutorial / inspiration / explainer / hook, or just title + thumbnail + caption?
- **Channel allowlist seed?** Do you have 5–10 trusted channels (Crash Course, Veritasium, etc.) to boost, or start with none?
- **Grade-level source?** Use `unit.grade_level` only, or also a "make it easier / more advanced" toggle in the panel?

## 9. Build estimate

- **Best:** 2 days (no surprises, YouTube key provisioned, side-panel component reused).
- **Likely:** 3 days (1d backend route + AI, 1d panel UI, 0.5d cap/telemetry, 0.5d polish + smoke).
- **Worst:** 5 days (YouTube quota edge cases, embed iframe CSP wrangling, re-rank quality tuning).
