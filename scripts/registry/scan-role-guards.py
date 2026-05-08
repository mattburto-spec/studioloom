#!/usr/bin/env python3
"""
scan-role-guards.py — role-guard coverage scanner for /api/teacher, /api/admin

Closes P-1c of docs/security/security-plan.md. Walks every API route file
under src/app/api/{teacher,admin,fab}/ and verifies the file imports an
appropriate role-gate helper. Without a gate, a logged-in *student* JWT
could call e.g. POST /api/teacher/generate-unit (the middleware Phase 6.3b
only matches PAGE routes — its config matcher does NOT cover /api/*).

Approved gates by namespace:

    /api/teacher/*  -> requireTeacher() OR requireTeacherAuth() OR requireAdmin()
    /api/admin/*    -> requireAdmin() OR requirePlatformAdmin()
    /api/fab/*      -> validateFabricatorSession() (fab-auth.ts)
    /api/v1/teacher/*  -> same as /api/teacher/*
    /api/v1/admin/*    -> same as /api/admin/*
    /api/v1/student/[id]/* -> requirePlatformAdmin() OR verifyTeacherCanManageStudent (DSR)

Read-only scanner. Emits JSON report to stdout + scanner-reports.

Usage:
    python3 scripts/registry/scan-role-guards.py
    python3 scripts/registry/scan-role-guards.py --apply  (no-op for now)
    python3 scripts/registry/scan-role-guards.py --fail-on-missing  (CI mode)
"""

import json
import os
import re
import sys
from datetime import datetime, timezone

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
API_DIR = os.path.join(REPO_ROOT, "src", "app", "api")
REPORT_PATH = os.path.join(
    REPO_ROOT, "docs", "scanner-reports", "role-guard-coverage.json"
)

# Approved role-gate helpers per namespace.
GATE_HELPERS = {
    "teacher": [
        "requireTeacher",
        "requireTeacherAuth",
        "requireAdmin",
        "requirePlatformAdmin",
    ],
    "admin": ["requireAdmin", "requirePlatformAdmin"],
    "fab": ["validateFabricatorSession", "requireFabricatorAuth"],
    "v1/teacher": [
        "requireTeacher",
        "requireTeacherAuth",
        "requireAdmin",
        "requirePlatformAdmin",
    ],
    "v1/admin": ["requireAdmin", "requirePlatformAdmin"],
    "v1/student": [
        "requirePlatformAdmin",
        "verifyTeacherCanManageStudent",
        "requireAdmin",
    ],
}

# Per-route allowlist. Files that legitimately don't need a role guard
# because they implement their own auth or are intentionally public.
# Each entry MUST have a justification comment.
ALLOWLIST = {
    # 2026-05-09 — anonymous public route gated by Cloudflare Turnstile.
    # Writes to teacher_access_requests (a deny-all RLS table) via service-role.
    "src/app/api/teacher/welcome/request-school-access/route.ts": (
        "anonymous request route gated by Turnstile, audit-skip annotated"
    ),
    # 2026-05-09 — auth-establishment routes. Cannot have a session gate
    # because they CREATE the session. Each implements its own credential
    # check (Argon2id password verify + rate limit).
    "src/app/api/fab/login/route.ts": "auth-establishment — Argon2id verify + rate-limit",
    "src/app/api/fab/logout/route.ts": "session destruction — accepts any session cookie",
    "src/app/api/fab/set-password/submit/route.ts": (
        "auth-establishment — consumes is_setup session token"
    ),
    "src/app/api/fab/set-password/verify/route.ts": (
        "auth-establishment — consumes is_setup session token"
    ),
    # 2026-05-09 — admin AI-model test routes use ADMIN_EMAILS env-var
    # allowlist directly (not requireAdmin helper) because they predate the
    # helper and are infrequently touched. Marked here; should be migrated
    # in the next admin-route sweep.
    "src/app/api/admin/ai-model/test/route.ts": (
        "uses ADMIN_EMAILS env-var allowlist directly; migrate to requireAdmin in next sweep"
    ),
    "src/app/api/admin/ai-model/test-lesson/route.ts": (
        "uses ADMIN_EMAILS env-var allowlist directly; migrate to requireAdmin in next sweep"
    ),
}

# Routes under these prefixes are scanned. Order matters — longer prefixes first.
SCAN_PREFIXES = [
    ("v1/teacher", "v1/teacher"),
    ("v1/admin", "v1/admin"),
    ("v1/student", "v1/student"),
    ("teacher", "teacher"),
    ("admin", "admin"),
    ("fab", "fab"),
]


def find_route_files():
    """Walk src/app/api/{teacher,admin,fab,v1} and yield (relpath, namespace)."""
    for prefix_path, namespace in SCAN_PREFIXES:
        root = os.path.join(API_DIR, *prefix_path.split("/"))
        if not os.path.isdir(root):
            continue
        for dirpath, _, files in os.walk(root):
            for f in files:
                if f != "route.ts" and f != "route.tsx":
                    continue
                full = os.path.join(dirpath, f)
                rel = os.path.relpath(full, REPO_ROOT)
                # Skip nested test files
                if "__tests__" in rel:
                    continue
                yield rel, namespace


def file_has_gate(filepath, namespace):
    """True if the file imports/calls any approved gate helper."""
    try:
        with open(os.path.join(REPO_ROOT, filepath)) as f:
            text = f.read()
    except OSError:
        return False, "unreadable"
    helpers = GATE_HELPERS.get(namespace, [])
    for helper in helpers:
        # Look for either an import of the symbol or a call to it.
        # Both `import { requireTeacher }` and `await requireTeacher(req)` count.
        pattern = re.compile(
            r"(?:from\s+['\"][^'\"]*?['\"]\s*;?\s*)?\b" + re.escape(helper) + r"\b"
        )
        if pattern.search(text):
            return True, helper
    return False, None


def main():
    rows = list(find_route_files())
    covered = []
    missing = []
    allowlisted = []

    for relpath, namespace in rows:
        if relpath in ALLOWLIST:
            allowlisted.append({"path": relpath, "reason": ALLOWLIST[relpath]})
            continue
        ok, helper = file_has_gate(relpath, namespace)
        if ok:
            covered.append({"path": relpath, "namespace": namespace, "helper": helper})
        else:
            missing.append({"path": relpath, "namespace": namespace})

    report = {
        "registry": "role-guard-coverage",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": 1,
        "stats": {
            "total_routes": len(rows),
            "covered": len(covered),
            "missing": len(missing),
            "allowlisted": len(allowlisted),
        },
        "covered_helpers_used": _helper_breakdown(covered),
        "missing": missing,
        "allowlisted": allowlisted,
        "status": "clean" if not missing else "drift",
    }

    os.makedirs(os.path.dirname(REPORT_PATH), exist_ok=True)
    with open(REPORT_PATH, "w") as f:
        json.dump(report, f, indent=2)
        f.write("\n")

    print(json.dumps(report, indent=2))

    if "--fail-on-missing" in sys.argv and missing:
        print(
            f"\nERROR: {len(missing)} routes missing a role guard. "
            "Add the appropriate require* helper, or add an entry to ALLOWLIST "
            "with justification.",
            file=sys.stderr,
        )
        sys.exit(1)

    if missing:
        # Non-fatal warning when --fail-on-missing not set.
        print(
            f"\nWARN: {len(missing)} routes missing a role guard.", file=sys.stderr
        )

    return 0


def _helper_breakdown(covered):
    counts = {}
    for entry in covered:
        h = entry.get("helper") or "unknown"
        counts[h] = counts.get(h, 0) + 1
    return counts


if __name__ == "__main__":
    sys.exit(main() or 0)
