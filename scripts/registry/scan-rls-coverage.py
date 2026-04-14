#!/usr/bin/env python3
"""
scan-rls-coverage.py — RLS coverage scanner for StudioLoom

Reads all migrations in supabase/migrations/ and checks every CREATE TABLE
has a matching ALTER TABLE ... ENABLE ROW LEVEL SECURITY and at least one
CREATE POLICY. Emits JSON report to stdout + docs/scanner-reports/rls-coverage.json.

Read-only scanner — does NOT modify schema-registry.yaml (GOV-1.4 pattern).

Usage:
    python3 scripts/registry/scan-rls-coverage.py
"""

import json
import os
import re
import sys
from datetime import datetime, timezone

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MIGRATIONS_DIR = os.path.join(REPO_ROOT, "supabase", "migrations")
REPORT_PATH = os.path.join(REPO_ROOT, "docs", "scanner-reports", "rls-coverage.json")


def scan():
    """Scan all migrations for RLS coverage gaps."""

    # Collect all migration file contents
    migrations = []
    for fname in sorted(os.listdir(MIGRATIONS_DIR)):
        if not fname.endswith(".sql"):
            continue
        fpath = os.path.join(MIGRATIONS_DIR, fname)
        with open(fpath, "r") as f:
            content = f.read()
        migrations.append((fname, content))

    # 1. Find all CREATE TABLE statements
    #    Pattern: CREATE TABLE [IF NOT EXISTS] <name>
    create_table_pat = re.compile(
        r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?(\w+)\s*\(",
        re.IGNORECASE,
    )

    tables = {}  # name -> source migration
    for fname, content in migrations:
        for m in create_table_pat.finditer(content):
            table_name = m.group(1).lower()
            # Skip Supabase internal / extension tables
            if table_name.startswith("_") or table_name in ("schema_migrations",):
                continue
            # First CREATE TABLE wins (later ones are IF NOT EXISTS re-runs)
            if table_name not in tables:
                tables[table_name] = fname

    # 2. Find all ENABLE ROW LEVEL SECURITY statements
    rls_enabled_pat = re.compile(
        r"ALTER\s+TABLE\s+(?:public\.)?(\w+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY",
        re.IGNORECASE,
    )

    rls_enabled = set()
    for _fname, content in migrations:
        for m in rls_enabled_pat.finditer(content):
            rls_enabled.add(m.group(1).lower())

    # 3. Find all CREATE POLICY ... ON <table> statements
    policy_pat = re.compile(
        r"CREATE\s+POLICY\s+(?:\"[^\"]+\"|\w+)\s+ON\s+(?:public\.)?(\w+)\b",
        re.IGNORECASE,
    )

    tables_with_policies = set()
    for _fname, content in migrations:
        for m in policy_pat.finditer(content):
            tables_with_policies.add(m.group(1).lower())

    # 4. Classify drift
    no_rls = []  # Tables with no ENABLE ROW LEVEL SECURITY
    rls_enabled_no_policy = []  # Tables with RLS enabled but no CREATE POLICY

    for table_name in sorted(tables.keys()):
        source = tables[table_name]
        if table_name not in rls_enabled:
            no_rls.append({"table": table_name, "source_migration": source})
        elif table_name not in tables_with_policies:
            rls_enabled_no_policy.append(
                {"table": table_name, "source_migration": source}
            )

    # 5. Build report
    report = {
        "registry": "rls-coverage",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": 1,
        "drift": {
            "no_rls": no_rls,
            "rls_enabled_no_policy": rls_enabled_no_policy,
        },
        "stats": {
            "total_tables": len(tables),
            "rls_enabled": len(rls_enabled & set(tables.keys())),
            "with_policies": len(tables_with_policies & set(tables.keys())),
            "no_rls_count": len(no_rls),
            "rls_no_policy_count": len(rls_enabled_no_policy),
        },
        "status": "clean" if (len(no_rls) == 0 and len(rls_enabled_no_policy) == 0) else "drift_detected",
    }

    # Write report file
    os.makedirs(os.path.dirname(REPORT_PATH), exist_ok=True)
    with open(REPORT_PATH, "w") as f:
        json.dump(report, f, indent=2)
        f.write("\n")

    # Also emit to stdout
    print(json.dumps(report, indent=2))

    return report


if __name__ == "__main__":
    report = scan()
    # Exit 0 always (scanner pattern — report drift, don't block)
    sys.exit(0)
