# ENCRYPTION_KEY Rotation Procedure

**Phase:** Access Model v2 Phase 0.9 (audit-derived deliverable)
**Source:** IT audit F9 (HIGH) + `access-model-v2.md` §3 item #32
**Script:** `scripts/security/rotate-encryption-key.ts`

## Why this exists

The `ENCRYPTION_KEY` env var feeds AES-256-GCM encryption of teacher BYOK credentials (LMS API tokens, AI provider API keys, LTI consumer secrets) via `src/lib/encryption.ts`. Pre-Phase-0.9 the audit found:

> **F9 HIGH** — ENCRYPTION_KEY rotation_notes: "Rotating requires re-encrypting all stored credentials. No automated rotation script exists." If the key leaks it cannot be quickly rotated. There is no kill-switch.

This procedure + script close that gap.

## What's encrypted

Three columns in two tables (in sync with `ENCRYPTED_COLUMNS` in the rotation script):

| Table | PK | Column | Source mig |
|---|---|---|---|
| `ai_settings` | `teacher_id` | `encrypted_api_key` | mig 007 |
| `teacher_integrations` | `id` | `encrypted_api_token` | mig 005 |
| `teacher_integrations` | `id` | `lti_consumer_secret` | mig 005 |

If a future migration adds another encrypted column, **update `ENCRYPTED_COLUMNS` in the rotation script** AND this doc — Lesson #47 (audit every writer first).

## Pre-rotation checklist

- [ ] Generate the new key: `openssl rand -hex 32` (64 hex characters = 32 bytes for AES-256)
- [ ] Store the **new** key in 1Password (label: "StudioLoom — ENCRYPTION_KEY rotation YYYY-MM-DD")
- [ ] Store the **old** key in 1Password too (until rotation completes — discarded after)
- [ ] Schedule a low-activity window (rotation reads + writes every encrypted row)
- [ ] Backup Supabase before rotating — dashboard → Database → Backups → Create backup. **Required.**

## Rotation procedure

### Step 1 — Dry run

```bash
ENCRYPTION_KEY_OLD=<current-hex64> \
ENCRYPTION_KEY_NEW=<new-hex64> \
SUPABASE_URL=<prod-url> \
SUPABASE_SERVICE_ROLE_KEY=<prod-svc-key> \
tsx scripts/security/rotate-encryption-key.ts --dry-run
```

The dry run:
- SELECTs every encrypted row across the 3 columns
- Decrypts with OLD key → re-encrypts with NEW key → roundtrip-verifies (decrypt with NEW key, compare to original plaintext)
- Reports per-row pass/fail
- **Does NOT UPDATE the database**

If any row fails in dry run, **do not proceed to live rotation.** Investigate. Common causes:
- `ENCRYPTION_KEY_OLD` is wrong — verify against the current Vercel env var
- A row was encrypted with a key NOT in the keychain (manual SQL inserts bypassing `encrypt()`?)
- A row was corrupted (truncated ciphertext, missing IV/tag)

### Step 2 — Live rotation

After dry run reports `Failed: 0`:

```bash
# Same env vars, drop --dry-run
tsx scripts/security/rotate-encryption-key.ts
```

The script:
- Re-runs the same per-row decrypt-encrypt-verify chain
- UPDATEs each row in place (per-row, not batch — partial-failure resumability)
- Reports `Rotated: N` and `Failed: 0` on success

If `Failed > 0`, the rotation is partial: some rows have new ciphertext, some still have old. Both keys must remain available until you finish. **Do NOT update the prod env var** until `Failed == 0`.

### Step 3 — Update env vars + redeploy

1. Vercel dashboard → StudioLoom project → Settings → Environment Variables
2. Update `ENCRYPTION_KEY` to the new value (across Production + Preview + Development scopes)
3. Save → Vercel redeploy triggers automatically
4. Update local `.env.local` to match (so dev environment can decrypt prod data)

### Step 4 — Verify

After redeploy:

1. Log in as a teacher with BYOK credentials (Matt's account fits — has `ai_settings.encrypted_api_key`)
2. Trigger a flow that decrypts the credential — e.g. `/api/teacher/ai-settings` GET (returns last-4-of-key-or-similar reveal flow), or trigger an AI-generation that uses the BYOK
3. Confirm no decryption errors in Vercel logs
4. Confirm Sentry has no `Invalid encrypted string format` or `Invalid IV or auth tag length` errors

### Step 5 — Discard the old key

Rotation only works if the old key is destroyed. If it stays accessible, the rotation provides no security benefit.

1. Remove the old-key entry from 1Password (or move to an archive vault marked "destroyed YYYY-MM-DD")
2. Confirm the old key is NOT in any active Vercel env, .env.local, CI secret, or backup file
3. Document the rotation date in this file (append to the log section below)

## Fire-drill verification (Phase 0.9 deliverable)

The audit asked us to "build the rotation script as part of pre-pilot work" AND "rotate once during pilot setup as a fire drill" (F9). The fire drill:

1. Generate a fresh new key
2. Run the full Step 1–5 procedure above
3. Verify a teacher BYOK flow still works after rotation
4. Document the date + outcome in the log section below

This proves the script works on real prod data, not just unit tests. Do this BEFORE the NIS pilot starts so any bugs surface in test conditions, not under load.

## Rotation log

Append a row each time the key is rotated:

| Date | Reason | Rows rotated | Failures | Operator | Notes |
|---|---|---|---|---|---|
| 2026-04-29 | Phase 0.9 fire drill — smoke test (dry-run) | 0 | 0 | Matt | Pre-pilot prod has zero encrypted rows (no BYOK API keys, no LMS integrations wired yet). Dry-run verified script connects to prod via service role, queries all 3 encrypted columns (`ai_settings.encrypted_api_key`, `teacher_integrations.encrypted_api_token`, `teacher_integrations.lti_consumer_secret`), reports zero rows, exits cleanly with `Failed: 0`. Live rotation NOT executed (no rows to rotate; throwaway NEW key never persisted to Vercel). Script proven functional. Re-run as live rotation when first BYOK row exists OR scheduled rotation cadence kicks in. |

## Closes audit finding

- F9 (ENCRYPTION_KEY rotation, HIGH) → script + procedure + drill log structure ready. Matt runs the fire drill once before pilot launch. Forward-fix.

## Related

- `src/lib/encryption.ts` — the encrypt/decrypt primitives the script wraps
- `docs/security/mfa-procedure.md` — the other long-lived-secret rotation pattern
- `scripts/security/rotate-encryption-key.ts` — the script itself
