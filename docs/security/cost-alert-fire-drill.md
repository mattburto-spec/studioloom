# Cost-Alert Fire Drill (Phase 5.7 — Manual Verification)

**Status:** RUNBOOK — must be executed once by Matt before Checkpoint A6 closes.
**Audit reference:** F24 (cost-alert verification).
**Frequency:** Quarterly thereafter (next due: 4 August 2026).

---

## Why this drill exists

The cost-alert pipeline (`src/lib/jobs/cost-alert.ts` + `scripts/ops/run-cost-alert.ts`) sums Anthropic costs and emits a Resend-delivered email when daily/weekly/monthly thresholds are crossed. Both pieces have been on the bench since Phase 4C but have never been live-tested end-to-end. Phase 5.7 verifies the pipeline actually delivers an email when the threshold trips.

The IT audit (F24) named this as a pre-pilot blocker because cost runaway is a real risk and the alert is the only operational signal.

---

## Pre-conditions

- [ ] `RESEND_API_KEY` available (in Vercel env vars OR your local `.env` — you'll pass it inline).
- [ ] `SUPABASE_SERVICE_ROLE_KEY` available locally for running the cron.
- [ ] Some recent (today) Anthropic cost data in `generation_runs` — any AI call landed today qualifies.

**Note:** the cron runs **locally**, not in Vercel. The Vercel-side `COST_ALERT_*` env vars are NOT required for the drill (and don't need to exist) — every threshold + email is passed inline when invoking the script. Skip Vercel changes entirely.

---

## The drill

### Step 1 — Trigger one billable AI call (if no recent activity)

The cron sums `generation_runs` cost for today. If you've made no AI calls today, you'll need at least one — easiest options:

- Hit any free public tool (`https://studioloom.org/tools/report-writer`) and submit a short prompt
- Or use the admin sandbox at `https://studioloom.org/admin/ai-model/test` (logged in as platform admin)
- Or let any existing recent activity stand if there was AI usage today

Verify the call succeeded.

### Step 2 — Run the cost-alert cron locally

Get `RESEND_API_KEY` + `SUPABASE_SERVICE_ROLE_KEY` + `NEXT_PUBLIC_SUPABASE_URL` from Vercel (Settings → Environment Variables → Production).

In your local checkout of `questerra-access-v2`:

```bash
SUPABASE_SERVICE_ROLE_KEY="<from-Vercel>" \
NEXT_PUBLIC_SUPABASE_URL="https://<project>.supabase.co" \
RESEND_API_KEY="<from-Vercel>" \
COST_ALERT_EMAIL="hello@loominary.org" \
COST_ALERT_DAILY_USD="0.01" \
npx tsx scripts/ops/run-cost-alert.ts
```

Expected stdout:
```
Running cost alert...
Alert ID: <uuid>
Summary: { ..., severity: "warning", ... }
```

The script will hit Resend with a POST to `api.resend.com/emails`.

If `severity: "info"` appears (under threshold), make a few more AI calls + retry — needs >$0.01 of cost in `generation_runs` today.

### Step 3 — Confirm Resend delivered the email

Within 5 minutes:

1. Check the inbox configured at `COST_ALERT_EMAIL`. Email subject: `[StudioLoom Cost Alert] Daily threshold crossed`.
2. Open the Resend dashboard at `https://resend.com/emails`. Find the matching email; status should be `Delivered`.
3. Screenshot the Resend dashboard row showing the delivered email.

If no email lands within 5 minutes:
- Check `cost-alert.ts:run()` debounce logic (`system_alerts` may have a recent warning of the same type → silent skip).
- Check Resend dashboard for the API call attempt — `4xx` indicates auth/config issue.
- File `FU-AV2-COST-ALERT-DELIVERY-{date}` if pipeline broken.

### Step 4 — Document the drill

Append a row to `docs/security/cost-alert-drill-log.md` (create on first run):

```
| Date       | Operator | Original threshold | Test threshold | Resend delivered | Email landed at | Notes |
|------------|----------|--------------------|----------------|-----------------:|-----------------|-------|
| 2026-05-04 | Matt     | $50                | $0.01          | ✅                | hello@...       | first drill |
```

---

## Done when

- [ ] Resend dashboard shows one delivered email within 5 minutes of Step 3.
- [ ] Original `COST_ALERT_DAILY_USD` restored in Vercel prod env.
- [ ] Drill logged in `docs/security/cost-alert-drill-log.md`.
- [ ] Screenshot saved to `docs/security/cost-alert-fire-drill-2026-05.png`.

---

## Quarterly cadence

Set a calendar reminder for the first Monday of August 2026, then quarterly thereafter. The drill is short (~15 min) and catches Resend API key rotations, Vercel env var drift, and Supabase service-role key issues before they bite during a real cost spike.
