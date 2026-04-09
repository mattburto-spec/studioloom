# StudioLoom Automation & Bug Squash — Handoff Doc

Context for Cowork / Claude Code. Goal: set up the automation layer so StudioLoom keeps running while Matt is teaching or with family.

---

## Top 10 tools for a solo dev (time-leverage order)

1. **Claude Code** — agentic coding, delegate whole tasks
2. **GitHub + GitHub Actions** — version control + free CI/CD
3. **Vercel** — git-push-to-deploy (already on Next.js 15)
4. **Sentry** — error monitoring, alerts before users email
5. **Better Stack / UptimeRobot** — uptime + SMS/push alerts
6. **Linear** (or GitHub Issues + Projects) — single source of truth for next actions
7. **Supabase pg_cron + Edge Functions** — scheduled jobs overnight Nanjing time
8. **Stripe** — payments, tax, dunning when ready to charge
9. **Resend / Postmark + React Email** — transactional email
10. **1Password CLI** — secrets and shared creds

**Mindset:** every recurring manual task is a candidate for a GitHub Action, cron job, or saved Claude Code prompt. Weekly question: "what did I do twice this week that a machine could've done?"

**Priority for this month (before pilot):** Sentry + uptime monitoring + Supabase scheduled jobs.

---

## 1. GitHub Actions for StudioLoom

`.github/workflows/ci.yml` — runs on every push: lint, typecheck, build. Vercel handles deploy separately; this is the safety net.

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npx tsc --noEmit
      - run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
```

Add a second workflow `nightly.yml` with `on: schedule: - cron: '0 18 * * *'` (~2am Nanjing) for heavier checks: dependency audit, broken-link check, Lighthouse against staging.

---

## 2. pg_cron for Work Capture Pipeline

In Supabase SQL editor (one-time): `create extension if not exists pg_cron;`

```sql
-- Process queued student submissions every 5 min
select cron.schedule(
  'process-work-capture-queue',
  '*/5 * * * *',
  $$ select net.http_post(
       url := 'https://<project>.supabase.co/functions/v1/process-capture',
       headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_key'))
     ); $$
);

-- Nightly: retry failures, expire stale drafts
select cron.schedule('nightly-maintenance', '0 18 * * *', $$
  update work_captures set status='failed'
   where status='processing' and updated_at < now() - interval '1 hour';
  delete from draft_sessions where updated_at < now() - interval '30 days';
$$);
```

The Edge Function does the actual vision-API work; pg_cron just pokes it on schedule. Pattern scales to AI Mentor matching, XP recalcs, any batch job.

---

## 3. Sentry + uptime

Sentry for Next.js (~10 min):

```bash
npx @sentry/wizard@latest -i nextjs
```

Wizard creates `sentry.client.config.ts`, `sentry.server.config.ts`, wraps `next.config.js`. Set `tracesSampleRate: 0.1` to stay in free tier. Add a Slack/email alert rule: "notify on any new issue in production."

**Better Stack** (free tier: 10 monitors, 3-min checks). Monitors:
- `studioloom.org` (homepage 200)
- `studioloom.org/api/health` (build a tiny route that pings Supabase, returns `{ ok: true }`)
- Edge Functions endpoint

Configure push notifications with quiet-hours window.

---

## 4. Bug Squash Tool — how it ties into the stack

The user-facing bug reporter is the missing piece that makes everything else sing. Loop:

1. Student/teacher hits **"Report bug"** widget in StudioLoom
2. Widget captures: URL, user ID, console errors, last N user actions, screenshot, optional text
3. Posts to Supabase `bug_reports` table **and** fires a Sentry event with the same `correlation_id`
4. Sentry already has the stack trace; the table has the human context ("the AI mentor wouldn't load my drawing")
5. pg_cron nightly job groups new reports by Sentry issue ID, emails Matt a digest
6. Better Stack confirms whether it's site-wide or one user
7. Claude Code investigates Sentry issue from phone/laptop, opens PR
8. GitHub Actions runs CI on the fix, Vercel deploys

**The correlation ID is the magic bit** — it stitches "what the user felt" to "what actually broke" so debugging is not guesswork.

### Suggested `bug_reports` schema (starter)

```sql
create table bug_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  user_id uuid references auth.users(id),
  school_id uuid references schools(id),
  url text not null,
  user_description text,
  console_errors jsonb,
  recent_actions jsonb,
  screenshot_url text,
  user_agent text,
  sentry_event_id text,
  correlation_id uuid not null default gen_random_uuid(),
  status text default 'new' check (status in ('new','triaged','in_progress','fixed','wontfix')),
  severity text default 'unknown'
);

-- RLS: students/teachers insert their own; only admin reads
alter table bug_reports enable row level security;
create policy "users insert own bugs" on bug_reports
  for insert with check (auth.uid() = user_id);
create policy "admin reads all" on bug_reports
  for select using (exists (
    select 1 from user_roles where user_id = auth.uid() and role = 'admin'
  ));
```

### Widget component checklist
- Floating button bottom-right, low-key (doesn't compete with primary UI)
- Modal: textarea + "include screenshot" toggle (default on) + submit
- Captures `window.location.href`, last 10 console messages from a ring buffer, last 10 user clicks/navigations
- Uses `html2canvas` or browser screenshot API for the image, uploads to Supabase Storage
- Calls `Sentry.captureMessage()` with `correlation_id` as a tag before inserting the row
- Confirmation toast: "Thanks — Matt will see this within 24 hours"

### Nightly digest (pg_cron + Edge Function)

```sql
select cron.schedule('bug-digest', '0 22 * * *', $$
  select net.http_post(
    url := 'https://<project>.supabase.co/functions/v1/bug-digest'
  );
$$);
```

Edge Function queries `bug_reports where status='new' and created_at > now() - interval '24 hours'`, groups by `sentry_event_id`, sends one Resend email to Matt with counts + links.

---

## Combined effect

Student hits a bug during NIS class while Matt is teaching:
- Sentry captures stack trace
- Bug widget captures human context with correlation ID
- Better Stack confirms site is up
- GitHub Actions has already validated last night's deploy
- pg_cron is processing the backlog
- Matt sees one notification, asks Claude Code on phone to investigate
- Draft fix waiting on laptop after class

---

## Open questions for next Cowork session

1. Confirm bug widget scope — students + teachers, or teachers only for v1?
2. Where does the floating button live — global layout, or only inside authenticated app routes?
3. Severity field — auto-set from Sentry level, or let user pick (low/medium/blocker)?
4. Should `bug_reports` integrate with the existing Linear/GitHub Issues workflow, or stay Supabase-native for now?
5. Privacy: scrub PII from `recent_actions` before storing? (Likely yes — student names, especially.)
