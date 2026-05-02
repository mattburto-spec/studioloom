# Feature Flag & Secret Taxonomy

## Purpose

`docs/feature-flags.yaml` is the single source of truth for every runtime feature flag and deployment secret in StudioLoom. It distinguishes:

- **Flags** — values that change application behaviour (toggle features, set thresholds, gate access). Flags have a `default:` that makes the app function without them.
- **Secrets** — credentials, API keys, and connection strings. Secrets have no meaningful default; the feature they gate is simply unavailable without them.

## Schema fields

### Common fields (both flags and secrets)

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | The exact env var name or admin_settings key |
| `kind` | `flag` \| `secret` | Whether this entry toggles behaviour or provides credentials |
| `source` | `env` \| `db` | Where the value lives — environment variable or `admin_settings` table |
| `public` | bool | `true` if the value is safe to expose in client bundles (`NEXT_PUBLIC_*` prefix) |
| `required` | bool | `true` if the app cannot start / core feature fails without it |
| `consumers` | string[] | File paths that read this value (grep-verified) |
| `description` | string | One-line purpose |

### Flag-only fields

| Field | Type | Description |
|-------|------|-------------|
| `default` | string \| number \| bool \| object | The fallback value used when the flag is unset |
| `type` | `boolean` \| `number` \| `string` \| `json` \| `email_list` | Data type for validation |
| `scope` | `runtime` \| `build` \| `test` | When this flag is read — runtime (request-time), build (compile-time), test (CI only) |
| `requires_plan` | `public` \| `free` \| `pro` \| `school` | **Phase 4.8b** — minimum subscription tier required to use the gated feature. The flag-reading wrapper consults this when present; absence = `free` (universally available). Used by the post-access-v2 freemium build for tier-gated UX. NOT applicable to secrets. |

### Secret-only fields

| Field | Type | Description |
|-------|------|-------------|
| `provider` | string | The external service this key authenticates with |
| `rotation_notes` | string | How to rotate this key safely |

## Classification rules

1. **`NEXT_PUBLIC_*` vars** → `public: true`. They are inlined into client JS bundles by Next.js.
2. **`pipeline.*` keys** → `source: db`, read from `admin_settings` via service-role Supabase client. Changed at runtime via `/admin/controls`.
3. **`*_API_KEY` vars** → almost always `kind: secret`. Exception: none currently.
4. **`COST_ALERT_*` vars** → `kind: flag` (thresholds with defaults), except `RESEND_API_KEY` which is a secret.
5. **Framework-provided vars** (`NODE_ENV`, `NEXT_RUNTIME`) → `kind: flag`, `scope: runtime`, not app-defined but app-consumed.
6. **Test-only vars** (`RUN_E2E`) → not seeded in the registry. They don't affect production behaviour.

## Update convention

Any new `process.env.*` reference or `admin_settings` key added in code **MUST** have a corresponding entry in `feature-flags.yaml` before the PR is merged. Flag without a consumer = dead code; consumer without a flag entry = undocumented behaviour.

When adding a new flag:
1. Add the YAML entry with all required fields.
2. Verify at least one consumer file path exists.
3. If the flag has a default, ensure the default matches the fallback in code.
4. If the flag is a secret, add it to `.env.example` with a placeholder value.
5. **Phase 4.8b** — for `kind: flag`, decide the minimum tier required and set `requires_plan`. If the feature should work universally, omit the field (treated as `free`). Examples: `pipeline.starter_patterns_enabled` → `free` (everyone gets starters); `school.library_browse` (future) → `school` (school-tier only).

## Tier ordering for `requires_plan`

`public < free < pro < school`. A flag with `requires_plan: pro` is satisfied by both `pro` and `school` plans. A flag with `requires_plan: public` is universally available (including unauthenticated requests).

Flag-reader wrappers (Phase 5+ when wired into routes / UI) should consult the user's resolved tier (via ActorSession.plan) and refuse the feature when below `requires_plan`. Today the field is schema-only — no consumer reads it; the freemium build adds the gate.
