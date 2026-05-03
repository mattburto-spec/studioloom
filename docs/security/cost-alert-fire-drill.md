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

- [ ] `RESEND_API_KEY` set in Vercel prod env (verify via Vercel dashboard → Settings → Environment Variables).
- [ ] `COST_ALERT_EMAIL` set to a valid inbox you can check (e.g., `hello@loominary.org`).
- [ ] You have at least one student account on prod with budget headroom (any test/dev student works).
- [ ] You have `SUPABASE_SERVICE_ROLE_KEY` available locally for running the cron.

---

## The drill

### Step 1 — Lower the daily threshold to $0.01

In Vercel dashboard → Settings → Environment Variables → Production:

1. Add or edit `COST_ALERT_DAILY_USD` with value `0.01`.
2. Click "Save".
3. Trigger a redeploy (Deployments tab → ⋯ → Redeploy without cache) so the env var lands.

Capture the original value first — you'll restore it at the end.

### Step 2 — Trigger one student AI call

Any student-facing AI call works. The simplest:

1. Open `https://studioloom.org/student/login` in an incognito tab.
2. Sign in as a test student with classcode + name.
3. Navigate into a unit with the Design Assistant available.
4. Send one short message to the AI mentor.

Verify the call succeeded (you got an AI response).

### Step 3 — Run the cost-alert cron locally

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

### Step 4 — Confirm Resend delivered the email

Within 5 minutes:

1. Check the inbox configured at `COST_ALERT_EMAIL`. Email subject: `[StudioLoom Cost Alert] Daily threshold crossed`.
2. Open the Resend dashboard at `https://resend.com/emails`. Find the matching email; status should be `Delivered`.
3. Screenshot the Resend dashboard row showing the delivered email.

If no email lands within 5 minutes:
- Check `cost-alert.ts:run()` debounce logic (`system_alerts` may have a recent warning of the same type → silent skip).
- Check Resend dashboard for the API call attempt — `4xx` indicates auth/config issue.
- File `FU-AV2-COST-ALERT-DELIVERY-{date}` if pipeline broken.

### Step 5 — Restore production threshold

Vercel dashboard → Settings → Environment Variables → Production:

1. Edit `COST_ALERT_DAILY_USD` back to its original value (or remove the env var if it wasn't set before).
2. Redeploy.

Confirm the env var is restored before checkpoint signoff.

### Step 6 — Document the drill

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
