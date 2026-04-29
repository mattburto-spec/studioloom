# Teacher MFA Procedure

**Phase:** Access Model v2 Phase 0.9 (audit-derived deliverable)
**Source:** IT audit F6 (BLOCKER) + `access-model-v2.md` §3 item #30
**Status:** Procedure documented — Matt enables in Supabase dashboard before NIS pilot starts.

## Why this exists

IT audit F6 flagged "no MFA on teacher accounts" as a **pilot BLOCKER**. A teacher account sees every student's full conversation history, every uploaded artifact, and the moderation log. A single password compromise (phishing, password reuse, hostile insider) exposes every student's content. For school deployments where many students are minors, MFA is non-negotiable.

Phase 0.9 doesn't ship code for this — the implementation is built into Supabase Auth. This doc captures the **enable procedure** and the **operational runbooks** (enrolment, reset, lockout recovery) so the NIS pilot can launch with MFA enforced.

## Step 1 — Enable MFA at the project level (Matt does once)

Supabase dashboard → **Authentication → Providers → MFA**:

1. Enable the **TOTP** factor (Time-based One-Time Password — works with Google Authenticator, Authy, 1Password, etc.).
2. Set MFA enforcement mode to **`required` for `authenticated` users**. (Not `optional`.)
3. Set "AAL" (Authentication Assurance Level) to **`aal2`** for sensitive operations. Routes that mutate student data should require AAL2.
4. Save.

**Reference:** Supabase MFA docs — https://supabase.com/docs/guides/auth/auth-mfa

## Step 2 — Matt's own platform-admin account enrols TOTP first

Before announcing MFA enforcement to NIS staff:

1. Log in to the platform as Matt (the existing teacher account that has `is_platform_admin = true` after Phase 0.5 backfill).
2. The platform UI redirects to `/auth/mfa/enroll` (Phase 2 ships this — for now use Supabase dashboard's "Enrol MFA factor" for your account).
3. Scan the QR code with an authenticator app.
4. Enter the 6-digit code to confirm enrolment.
5. **Save the recovery codes Supabase generates.** Store in 1Password under "StudioLoom — platform-admin MFA recovery". These are the only way to recover access if the authenticator device is lost.

## Step 3 — NIS teacher enrolment (post-pilot-launch)

Each NIS teacher invited to the pilot:

1. Receives invite email with magic-link to `/teacher/login`.
2. Sets initial password.
3. **Forced MFA enrolment on first login** — the platform redirects to `/auth/mfa/enroll` before they can access any other route.
4. Scans QR code, enters 6-digit code, MFA active.
5. Saves recovery codes (UI prompts them; we display + remind to save).

## MFA reset procedure (when teacher loses authenticator device)

This is the gap the audit flagged — currently undefined. Documented procedure:

### Self-service path (recovery codes)

1. Teacher clicks "I lost my authenticator" on the MFA challenge screen.
2. Enters one of their recovery codes (8 codes, single-use each).
3. Platform marks that recovery code as consumed.
4. Teacher is logged in.
5. Teacher is **required** to enrol a new TOTP factor before they can use the platform — old factor is automatically revoked.
6. New recovery codes are generated; teacher saves them.

### Platform-admin reset path (when recovery codes are also lost)

1. Teacher emails Matt (the platform admin) with a verifiable identifier (their school email address).
2. Matt verifies the request out-of-band — phone call or video call. Confirm it's the actual person.
3. Matt logs in to Supabase dashboard → **Authentication → Users**.
4. Find the teacher's row. Click **"Disable MFA"** (or **"Remove MFA factors"**).
5. Confirm the reset action — log entry created in Supabase audit + corresponding `audit_events` row (Phase 5+ wires the event).
6. Notify the teacher that they can log in with just their password and will be prompted to re-enrol MFA on first login.

### What NOT to do

- **Never reset MFA in response to an email-only request.** Phishing vector. Always confirm via second channel.
- **Never share recovery codes between teachers.** Each is single-use, account-specific.
- **Never log recovery codes in plain text** (audit_events `payload_jsonb` should hash or omit the code value if recovery flow is logged).

## Operational notes

- **MFA is required for teachers + platform admins.** It is NOT required for students in v2 — student auth is the classcode+name custom flow (China classes) or future OAuth. MFA can be added to OAuth-using students later if a school requests it.
- **Fabricators (lab tech) auth is separate** (Argon2id session tokens, mig 097). MFA for fabricators is out of scope; they don't see student data, only fabrication jobs.
- **Service-role API keys are not MFA-protected** — they're long-lived secrets stored in Vercel/Supabase env vars. Rotation is the equivalent control there (see `docs/security/encryption-key-rotation.md` pattern).
- **Quarterly verification:** add to `doc-manifest.yaml` as a `security_verifications` entry — every quarter, confirm MFA enforcement is still active (Supabase upgrades have occasionally reset settings).

## Audit trail

Every MFA event (enrolment, reset, factor removal, recovery-code consumption) generates an entry in Supabase's built-in auth audit log. Phase 5 of access-model-v2 mirrors these into the `audit_events` table for school-side filtering via `actor_type='teacher'` + `action LIKE 'mfa.%'`.

## Closes audit finding

- F6 (no MFA on teacher accounts, BLOCKER) → procedure documented; Matt enables in Supabase dashboard before pilot launch. Forward-fix.

## Related

- `docs/security/encryption-key-rotation.md` — rotation pattern for the other long-lived secret (ENCRYPTION_KEY)
- `docs/security/multi-matt-audit-query.md` — read-only audit for duplicate teacher accounts (pre-MFA enrolment, identify which Matt rows actually need to be MFA-enrolled)
