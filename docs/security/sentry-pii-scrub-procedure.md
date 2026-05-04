# Sentry PII Scrubbing Verification (Phase 5.7 — Manual Verification)

**Status:** RUNBOOK — must be executed once by Matt before Checkpoint A6 closes.
**Audit reference:** F25 (Sentry PII scrubbing verification).
**Frequency:** Quarterly thereafter (next due: 4 August 2026).

---

## Why this drill exists

Sentry is wired into the StudioLoom app via `@sentry/nextjs 10.43.0` (`src/instrumentation.ts` + `src/instrumentation-client.ts`). At least 8 routes use `Sentry.captureException` directly, plus the Phase 5.1 `logAuditEvent` wrapper's `'soft-sentry'` failure mode also captures exceptions tagged `layer: audit-log`.

If PII scrubbing is misconfigured in the Sentry project, ANY captureException call could leak student emails, names, UUIDs, IP addresses, AI conversation snippets, or screenshot URLs into Sentry — a PIPL/FERPA/GDPR breach. This drill confirms the scrubber is on with the right rule set BEFORE the first NIS student logs in.

The IT audit (F25) named this as a pre-pilot verification.

---

## What we're verifying

Sentry's PII scrubber operates at three layers:

1. **Default scrubber** — strips obvious patterns (`password`, `secret`, `passwd`, `api_key`, `apikey`, `access_token`, `refresh_token`, `private_key`).
2. **Sensitive Fields list** — additional field-name patterns the scrubber treats as high-value.
3. **Custom rules** — regex patterns that scrub matched payloads regardless of field name.

We need ALL THREE configured before pilot.

---

## The drill

### Step 1 — Open the Sentry project settings

1. Open `https://sentry.io/`.
2. Navigate to the StudioLoom project (org slug + project slug match the env vars `NEXT_PUBLIC_SENTRY_ORG_SLUG` + `NEXT_PUBLIC_SENTRY_PROJECT_SLUG` set in Vercel).
3. Settings → Security & Privacy.

### Step 2 — Confirm "Scrub Data" toggles are ON

The Settings → Security & Privacy page has these toggles (modulo Sentry UI changes — adapt as the dashboard evolves):

- [ ] **Data Scrubbing** = ON.
- [ ] **Use Default Scrubbers** = ON.
- [ ] **Scrub IP Addresses** = ON (PIPL Article 38 / GDPR Recital 30 — IP is PII).
- [ ] **Send Default PII** = OFF (Sentry's "send PII" mode would send headers + cookies; we don't want it).

### Step 3 — Confirm Sensitive Fields list

In the "Sensitive Fields" textarea (one entry per line), the list MUST include at minimum:

```
password
secret
passwd
api_key
apikey
access_token
refresh_token
private_key
authorization
cookie
session
classcode
student_id
student_name
email
ip_address
```

If any of those are missing, ADD them and click Save. (Defaults usually cover the first 9; the StudioLoom-specific ones — classcode, student_id, student_name, ip_address — must be added explicitly.)

### Step 4 — Confirm custom Advanced Data Scrubbing rules (if used)

Sentry supports regex-based "Data Scrubbing" rules under Advanced. If StudioLoom adds custom rules for AI conversation transcripts (e.g., `[Removed]` for any value in fields named `studentMessage` or `mentorResponse`), confirm they're present.

For v1 pilot, the Sensitive Fields list above is the minimum; custom rules can come later if the pilot surfaces a real leak class. File `FU-AV2-SENTRY-CUSTOM-RULES-{date}` if needed.

### Step 5 — Screenshot the configuration

Take a screenshot of the Settings → Security & Privacy page showing all toggles + the Sensitive Fields list. Save to:

```
docs/security/sentry-pii-scrub-2026-05.png
```

Filename uses YYYY-MM format so quarterly screenshots build a chronological record.

### Step 6 — Live verification (optional but recommended)

Trigger one Sentry event with a known-PII payload to confirm scrubbing fires:

1. In the local checkout, temporarily edit `src/app/api/student/word-lookup/route.ts` to add (then remove):
   ```typescript
   import * as Sentry from "@sentry/nextjs";
   Sentry.captureMessage("PII drill", {
     level: "info",
     extra: {
       password: "should-be-scrubbed-123",
       student_id: "should-be-scrubbed-uuid",
       email: "should-be-scrubbed@example.com",
       safe_data: "should-NOT-be-scrubbed",
     },
   });
   ```
2. Run the route locally with `npm run dev` + curl the endpoint.
3. Open the resulting event in Sentry. Verify:
   - `password`, `student_id`, `email` show as `[Filtered]` (or `[Removed]` per Sentry's renderer).
   - `safe_data` shows the original string.
4. Revert the local edit (don't commit).

If any of the should-be-scrubbed fields show their literal values, **STOP** — the scrubber is misconfigured. Do NOT proceed to pilot until fixed.

---

## Done when

- [ ] All toggles in Step 2 confirmed ON / OFF as required.
- [ ] All Sensitive Fields from Step 3 present in the list.
- [ ] Screenshot saved to `docs/security/sentry-pii-scrub-2026-05.png`.
- [ ] (Optional) Live verification (Step 6) confirms scrubbing fires.

---

## Quarterly cadence

Re-run Steps 1–5 every quarter (next: first week of August 2026). The drill is short (~10 min) and catches:

- Sentry org admin changes that flip toggles.
- New StudioLoom features adding new field names that need to be added to the Sensitive Fields list.
- Sentry plan/dashboard changes that move settings around.

Append the verification date + screenshot path to `docs/security/sentry-drill-log.md` (create on first run):

```
| Date       | Operator | Toggles OK | Sensitive Fields OK | Screenshot path |
|------------|----------|-----------:|--------------------:|-----------------|
| 2026-05-04 | Matt     | ✅         | ✅                  | sentry-pii-scrub-2026-05.png |
```
