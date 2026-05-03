# RLS Deny-All Tables — Intentional Service-Role-Only Access

> **Status:** SCAFFOLD (created in Phase 6.0, 4 May 2026). Full content lands in §6.5a.
>
> **Phase 6.5 deliverable:** for each of the 5 tables flagged by `scan-rls-coverage.py` as `rls_enabled_no_policy`, document the intent (deny-all-from-anon, accessed only via service-role from server-side admin paths), the authorised access paths, and the governance rationale. Update the scanner's expected-deny-all allowlist so the drift report zeroes out.

## Tables in scope (5)

| Table | Writers (service-role paths) | Readers (service-role paths) | Why no policy |
|-------|------------------------------|------------------------------|---------------|
| `admin_audit_log` | TODO §6.5 | TODO §6.5 | TODO §6.5 |
| `ai_model_config` | TODO §6.5 | TODO §6.5 | TODO §6.5 |
| `ai_model_config_history` | TODO §6.5 | TODO §6.5 | TODO §6.5 |
| `fabricator_sessions` | TODO §6.5 | TODO §6.5 | TODO §6.5 |
| `teacher_access_requests` | TODO §6.5 | TODO §6.5 | TODO §6.5 |

(Reduced from 7 — `student_sessions` and `fabrication_scan_jobs` were resolved earlier.)

## Scanner allowlist update

TODO §6.5: extend `scripts/registry/scan-rls-coverage.py` with an `INTENTIONAL_DENY_ALL` set listing these 5 tables. Drift report should classify them as `intentional_deny_all` rather than `rls_enabled_no_policy`. Verify `docs/scanner-reports/rls-coverage.json` contains 0 unintentional drift after the change.

## Review cadence

TODO §6.5: quarterly review — does any table on this list now have a legitimate non-service-role consumer (e.g., teacher self-service for `teacher_access_requests`)? If so, write the explicit RLS policy and remove from this list.
