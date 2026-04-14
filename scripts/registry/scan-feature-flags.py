#!/usr/bin/env python3
"""
Feature Flag Scanner — compares docs/feature-flags.yaml against actual
process.env.* references in src/ to detect drift (orphaned or missing flags).

Read-only: emits JSON report to stdout AND docs/scanner-reports/feature-flags.json.
No --apply flag — manual update only.

Usage:
  python3 scripts/registry/scan-feature-flags.py
"""

import json
import os
import re
import sys
from datetime import datetime, timezone

import yaml

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
# Scan both src/ and project root (next.config.ts, middleware.ts etc.)
SRC_DIR = os.path.join(REPO_ROOT, "src")
ROOT_FILES = ["next.config.ts", "middleware.ts"]
REGISTRY_PATH = os.path.join(REPO_ROOT, "docs", "feature-flags.yaml")
REPORT_PATH = os.path.join(REPO_ROOT, "docs", "scanner-reports", "feature-flags.json")

# Env var pattern — matches process.env.X and process.env?.X (optional chaining)
ENV_RE = re.compile(r"process\.env\??\.([A-Z][A-Z_0-9]+)")

# Secret name conventions (for distinguishing flags from secrets in code)
SECRET_SUFFIXES = ("_API_KEY", "_SECRET", "_TOKEN", "_ROLE_KEY")


# ---------------------------------------------------------------------------
# Registry loading
# ---------------------------------------------------------------------------

def load_registry():
    """Load feature-flags.yaml and return (flag_names, secret_names)."""
    with open(REGISTRY_PATH) as f:
        data = yaml.safe_load(f)

    flag_names = set()
    secret_names = set()

    for entry in data.get("flags", []):
        if entry.get("source") == "env":
            flag_names.add(entry["name"])
        elif entry.get("source") == "db":
            flag_names.add(entry["name"])

    for entry in data.get("secrets", []):
        secret_names.add(entry["name"])

    return flag_names, secret_names


# ---------------------------------------------------------------------------
# Code scanning
# ---------------------------------------------------------------------------

def scan_env_vars():
    """Walk src/**/*.ts{x} and root config files, extract all process.env.X references."""
    found = {}  # env_var_name -> list of file paths

    for dirpath, _dirs, filenames in os.walk(SRC_DIR):
        # Skip test directories
        if "__tests__" in dirpath or "node_modules" in dirpath:
            continue
        for fname in filenames:
            if not fname.endswith((".ts", ".tsx")):
                continue
            filepath = os.path.join(dirpath, fname)
            rel = os.path.relpath(filepath, REPO_ROOT)

            with open(filepath) as f:
                content = f.read()

            for m in ENV_RE.finditer(content):
                var_name = m.group(1)
                found.setdefault(var_name, []).append(rel)

    # Also scan root config files
    for fname in ROOT_FILES:
        filepath = os.path.join(REPO_ROOT, fname)
        if not os.path.exists(filepath):
            continue
        with open(filepath) as f:
            content = f.read()
        for m in ENV_RE.finditer(content):
            var_name = m.group(1)
            found.setdefault(var_name, []).append(fname)

    return found


# ---------------------------------------------------------------------------
# Diff
# ---------------------------------------------------------------------------

def compute_drift(flag_names, secret_names, code_vars):
    """Compute orphaned (in yaml, not in code) and missing (in code, not in yaml)."""
    all_registered = flag_names | secret_names

    # Env-sourced flags/secrets only (DB-sourced won't appear as process.env)
    env_registered = {n for n in all_registered if not n.startswith("pipeline.")}

    code_var_names = set(code_vars.keys())

    orphaned = sorted(env_registered - code_var_names)
    missing = sorted(code_var_names - env_registered)

    return orphaned, missing


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    os.chdir(REPO_ROOT)

    flag_names, secret_names = load_registry()
    code_vars = scan_env_vars()
    orphaned, missing = compute_drift(flag_names, secret_names, code_vars)

    status = "ok" if not orphaned and not missing else "drift"

    report = {
        "registry": "feature-flags.yaml",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": 1,
        "drift": {
            "orphaned": orphaned,
            "missing": missing,
        },
        "stats": {
            "registered_flags": len(flag_names),
            "registered_secrets": len(secret_names),
            "code_env_vars": len(code_vars),
        },
        "status": status,
    }

    # Write report file
    os.makedirs(os.path.dirname(REPORT_PATH), exist_ok=True)
    with open(REPORT_PATH, "w") as f:
        json.dump(report, f, indent=2)
        f.write("\n")

    # Also emit to stdout
    json.dump(report, sys.stdout, indent=2)
    print()

    return 0


if __name__ == "__main__":
    sys.exit(main())
