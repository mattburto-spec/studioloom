# StudioLoom Automation Build Plan

> **Goal:** Get a safety net in place before May/June pilot so the platform doesn't silently break while Matt is teaching.
> **Created:** 7 April 2026
> **Status:** Sprints 1-2 COMPLETE (7 Apr 2026). Sprint 3-4 not started.

---

## Current state (updated 7 Apr 2026)

| Piece | Status | Notes |
|-------|--------|-------|
| Sentry SDK | **COMPLETE** | Full setup: `instrumentation.ts` (server+edge), `instrumentation-client.ts` (browser), `global-error.tsx`, `error-handler.ts` (14+ API routes). DSN in `.env.local`. Missing only: `SENTRY_AUTH_TOKEN` in Vercel env vars for source map uploads + Slack/email alert rules |
| GitHub repo | **Live** | Code pushed, proxy issue resolved |
| Vercel deploy | **Live** | Git-push-to-deploy working |
| GitHub Actions CI | **COMPLETE** | `.github/workflows/ci.yml` — lint, typecheck, build on push/PR |
| GitHub Actions nightly | **COMPLETE** | `.github/workflows/nightly.yml` — dep audit + build at 2am Nanjing |
| Health endpoint | **COMPLETE** | `src/app/api/health/route.ts` — pings Supabase, returns ok/db/responseTime |
| Uptime monitoring | **Matt action needed** | Create Better Stack account, add 3 monitors (see setup steps below) |
| Bug report widget | **Not started** | Spec exists in handoff doc — Sprint 3 |
| pg_cron / Edge Functions | **Not started** | Sprint 4 |
| Transactional email | **Not started** | Sprint 4 |

### Matt's action items (5 minutes)

1. **Add `SENTRY_AUTH_TOKEN` to Vercel env vars** — Get from sentry.io → Settings → Auth Tokens → Create Token (scope: `project:releases`). Add to Vercel: Settings → Environment Variables → `SENTRY_AUTH_TOKEN`. This enables readable stack traces instead of minified code.
2. **Add GitHub Secrets** — Go to GitHub repo → Settings → Secrets → Actions. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the same public values from `.env.local`). Also add `NEXT_PUBLIC_SENTRY_DSN`.
3. **Set up Better Stack (free tier, ~10 min):**
   - Sign up at betterstack.com
   - Install mobile app for push notifications
   - Add Monitor 1: `https://studioloom-teal.vercel.app` → expect HTTP 200
   - Add Monitor 2: `https://studioloom-teal.vercel.app/api/health` → expect `{"ok":true}` in body
   - Set check interval: 3 minutes
   - Set quiet hours: 11pm-6am Nanjing time
4. **Set up Sentry alert rule** — Go to sentry.io → Alerts → Create Rule → "Send email on every new issue in production". Add Slack integration if you use it.

---

## Build order (4 sprints, ~2 days each)

### Sprint 1: CI + Sentry completion (~2 hours build)
**Why first:** Everything else depends on confident deploys and visible errors. Right now errors are invisible — a student hits a 500 and Matt never knows.

**Tasks:**

1. **Complete Sentry setup**
   - Create `sentry.client.config.ts` (client-side error capture — currently only server/edge)
   - Verify source maps upload config in `next.config.ts` (the `withSentryConfig` wrapper is there but needs `SENTRY_AUTH_TOKEN` in Vercel env vars)
   - Set up Sentry alert rule: email on any new production issue
   - Test with a deliberate throw on a staging route
   - Time: ~30 min

2. **GitHub Actions CI workflow**
   - Create `.github/workflows/ci.yml`: lint → typecheck → build on every push to main + PRs
   - Needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as GitHub Secrets (public values, safe in CI)
   - Time: ~20 min

3. **GitHub Actions nightly workflow**
   - Create `.github/workflows/nightly.yml`: runs at ~2am Nanjing time (UTC+8 = `0 18 * * *` UTC)
   - `npm audit --audit-level=high` (flag critical vulnerabilities)
   - Full build (catches drift from dependency updates)
   - Time: ~20 min

**Sprint 1 delivers:** Every push is validated. Errors in production are emailed to Matt. Nightly audit catches dependency issues overnight.

---

### Sprint 2: Health endpoint + uptime monitoring (~1 hour build)
**Why second:** Sentry catches code errors but not "Supabase is down" or "Vercel is unreachable." Uptime monitoring catches infrastructure failures.

**Tasks:**

1. **Build `/api/health` route**
   - Pings Supabase with a trivial query (`select 1`)
   - Returns `{ ok: true, db: true, timestamp }` or `{ ok: false, db: false, error }` with 503
   - Include response time measurement
   - No auth required (public endpoint)
   - Time: ~15 min

2. **Set up Better Stack (free tier)**
   - Monitor 1: `studioloom.org` → expect 200
   - Monitor 2: `studioloom.org/api/health` → expect `{"ok":true}`
   - Monitor 3: Supabase project URL (direct, separate from the app)
   - 3-minute check interval
   - Push notification to Matt's phone
   - Quiet hours: 11pm-6am Nanjing time (so no 3am alerts for a 10-second blip)
   - Time: ~30 min (account setup + monitor config)

**Sprint 2 delivers:** Matt gets a push notification within 3 minutes if the site or database goes down. The health endpoint also serves as a quick sanity check after any deploy.

---

### Sprint 3: Bug report system (~1-2 days build)
**Why third:** This is the piece that makes the pilot survivable. Without it, students hit bugs and either tell Matt in person (hours later) or silently give up. With it, every bug arrives with context that makes debugging 10x faster.

**Tasks:**

1. **Migration: `bug_reports` table**
   - Schema from handoff doc, adapted for StudioLoom's auth model
   - Key change: `reporter_type` field (`teacher` | `student`) since students don't use Supabase Auth
   - `student_id UUID REFERENCES students(id)` for student reports (nullable)
   - `teacher_id UUID REFERENCES auth.users(id)` for teacher reports (nullable)
   - RLS: teachers insert where `teacher_id = auth.uid()`; students insert via API route with student auth; admin reads all
   - Add `correlation_id` for Sentry stitching

2. **Bug report widget component**
   - Floating button (bottom-right, subtle — doesn't compete with toolkit FAB or existing UI)
   - Only renders inside authenticated routes (both teacher and student layouts)
   - Per-class toggle: teacher enables/disables via Class Hub settings (already a decision in CLAUDE.md)
   - Modal captures: textarea description, auto-attached URL + user agent + last 10 console messages (ring buffer)
   - Screenshot: use `html2canvas` — lightweight, no browser API permissions needed
   - Upload screenshot to Supabase Storage bucket
   - Fire `Sentry.captureMessage()` with correlation_id tag before DB insert
   - Confirmation toast: "Thanks — Matt will see this within 24 hours"
   - Student reports use `/api/student/bug-report` with `requireStudentAuth`
   - Teacher reports use `/api/teacher/bug-report` with `requireTeacherAuth`

3. **Admin bug view**
   - New tab in admin dashboard: list of bug reports, grouped by Sentry issue ID when available
   - Status workflow: new → triaged → in_progress → fixed → wontfix
   - Link to Sentry event from each report

**Sprint 3 delivers:** Students and teachers can report bugs with one click. Matt gets human context ("the AI mentor wouldn't load") stitched to Sentry stack traces via correlation ID. Per-class toggle means Matt can enable it gradually.

---

### Sprint 4: Nightly automation (~1 day build)
**Why last:** This is the "runs while you sleep" layer. Less urgent than the other three because there's no batch processing workload yet (Work Capture Pipeline isn't built, Dimensions3 is still in spec). But worth setting up the pattern now.

**Tasks:**

1. **Enable pg_cron in Supabase**
   - `CREATE EXTENSION IF NOT EXISTS pg_cron;`
   - Verify it's available on the current Supabase plan

2. **Nightly maintenance job**
   - Clean expired student sessions (> 7-day TTL)
   - Clean stale draft data (> 30 days)
   - Run at 2am Nanjing time

3. **Bug digest Edge Function**
   - Queries `bug_reports WHERE status = 'new' AND created_at > now() - interval '24 hours'`
   - Groups by `sentry_event_id`
   - Sends one email to Matt via Resend (free tier: 100 emails/day)
   - Runs at 10pm Nanjing time (so Matt sees it before bed, has context for next morning)
   - **Dependency:** Resend account + API key + verified domain

4. **Future hooks (don't build yet, just document)**
   - Work Capture queue processing (when pipeline is built)
   - XP/level recalculation (when gamification ships)
   - Library health scoring (when Dimensions3 Block Library exists)
   - Intelligence Profile updates (Phase 3/4)

**Sprint 4 delivers:** Automated housekeeping overnight. Daily bug digest email. Pattern established for all future batch jobs.

---

## Open questions — recommendations

### 1. Bug widget scope: students + teachers, or teachers only for v1?

**Recommendation: Both, but with different UX.**

Teachers get a detailed form (severity picker, category dropdown, steps to reproduce). Students get a simple form (just a text description + automatic screenshot). Rationale: students hit more edge cases because they use the platform differently than Matt expects. But students shouldn't be asked for technical detail — the console log capture and Sentry correlation handle that automatically.

### 2. Where does the floating button live — global layout, or only inside authenticated app routes?

**Recommendation: Authenticated routes only.**

The public `/toolkit` pages and landing page shouldn't have a bug report button — unauthenticated visitors can't provide useful context (no user ID, no class, no session). Place it in:
- `src/app/(teacher)/layout.tsx` — teacher routes
- `src/app/(student)/layout.tsx` — student routes

Controlled by a `show_bug_reporter` flag on the class (per the per-class toggle decision already in CLAUDE.md). Default: OFF for v1 pilot. Matt enables per class as he's ready.

### 3. Severity field — auto-set from Sentry level, or let user pick?

**Recommendation: Auto-set from Sentry, user picks impact.**

Severity (error/warning/info) is a technical classification — let Sentry handle it. But add a "How much did this affect you?" field for users: "I can keep working" / "I'm stuck" / "Something broke badly." This is more useful than low/medium/blocker because it's written from the user's perspective and doesn't require technical judgment.

### 4. Should `bug_reports` integrate with Linear/GitHub Issues, or stay Supabase-native?

**Recommendation: Supabase-native for now, GitHub Issues sync later.**

You're a solo dev — Linear adds a tool without adding value until there's a team. Keep bug_reports in Supabase where the admin dashboard can query them directly. When volume justifies it (post-pilot), add a one-way sync: bug report → auto-create GitHub Issue with correlation ID + link back. The `sentry_event_id` field is the integration point — Sentry's GitHub integration already links to commits and PRs.

### 5. Privacy: scrub PII from `recent_actions` before storing?

**Recommendation: Yes, with a simple allowlist approach.**

The ring buffer captures user actions (clicks, navigations, form submits). Before storing in `recent_actions` JSONB:
- Strip any `value` fields from form inputs (prevents storing student text/passwords)
- Keep only: action type, target element type, URL path, timestamp
- Never capture: input values, student names in text, class codes typed into fields
- For student reporters: don't store `student_id` in the `recent_actions` — the top-level `student_id` on the report is enough context

This is especially important under China's PIPL (student data) and because students are minors (ages 11-16). The console error capture is safe — it's system-generated, not user-generated content.

---

## Dependencies and blockers

| Sprint | Needs from Matt | Needs from external |
|--------|----------------|---------------------|
| 1 — CI + Sentry | Add `SENTRY_AUTH_TOKEN` to Vercel env vars. Add Supabase public keys to GitHub Secrets | None |
| 2 — Health + Uptime | Create Better Stack account, install mobile app | None |
| 3 — Bug widget | Verify Supabase Storage bucket exists for screenshots. Decide on initial classes to enable | `html2canvas` npm package |
| 4 — Nightly jobs | Create Resend account, verify domain | pg_cron availability on Supabase plan |

---

## What this does NOT cover (yet)

These are in the handoff doc's top-10 list but aren't pre-pilot priority:

- **Stripe** — no revenue yet, build when pricing is set
- **1Password CLI** — nice for secrets rotation, not urgent for solo dev
- **Linear** — solo dev doesn't need a project tracker beyond ALL-PROJECTS.md
- **Resend for transactional email beyond bug digest** — no user-facing emails needed yet (student auth is token-based, not email-based)

---

## Estimated total effort

| Sprint | Effort | When |
|--------|--------|------|
| Sprint 1: CI + Sentry | ~2 hours | This week |
| Sprint 2: Health + Uptime | ~1 hour | This week |
| Sprint 3: Bug report system | ~1-2 days | Next week |
| Sprint 4: Nightly automation | ~1 day | Week of April 21 |
| **Total** | **~3-4 days** | **Done by end of April** |

All four sprints done well before the May/June pilot window. Sprint 1+2 can be done in a single Cowork session.
