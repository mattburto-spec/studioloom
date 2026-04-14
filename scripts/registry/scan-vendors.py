#!/usr/bin/env python3
"""
Vendor Scanner — compares docs/vendors.yaml against actual SDK imports,
env var references, and HTTP domain calls in src/ to detect drift.

Read-only: emits JSON report to stdout AND docs/scanner-reports/vendors.json.
No --apply flag — manual update only.

Usage:
  python3 scripts/registry/scan-vendors.py
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
SRC_DIR = os.path.join(REPO_ROOT, "src")
PKG_PATH = os.path.join(REPO_ROOT, "package.json")
REGISTRY_PATH = os.path.join(REPO_ROOT, "docs", "vendors.yaml")
REPORT_PATH = os.path.join(REPO_ROOT, "docs", "scanner-reports", "vendors.json")

# ---------------------------------------------------------------------------
# Vendor SDK map — baked-in detection rules per vendor
# ---------------------------------------------------------------------------

VENDOR_SDK_MAP = {
    "anthropic": {
        "sdk_packages": ["@anthropic-ai/sdk"],
        "env_prefixes": ["ANTHROPIC_"],
        "http_domains": ["api.anthropic.com"],
    },
    "supabase": {
        "sdk_packages": ["@supabase/supabase-js", "@supabase/ssr"],
        "env_prefixes": ["SUPABASE_", "NEXT_PUBLIC_SUPABASE_"],
        "http_domains": ["supabase.co"],
    },
    "voyage": {
        "sdk_packages": [],
        "env_prefixes": ["VOYAGE_"],
        "http_domains": ["api.voyageai.com"],
    },
    "vercel": {
        "sdk_packages": [],
        "env_prefixes": [],
        "http_domains": [],  # Vercel is the host, not called via HTTP from src/
    },
    "groq": {
        "sdk_packages": ["groq-sdk"],
        "env_prefixes": ["GROQ_"],
        "http_domains": ["api.groq.com"],
    },
    "gemini": {
        "sdk_packages": ["@google/generative-ai"],
        "env_prefixes": ["GEMINI_"],
        "http_domains": ["generativelanguage.googleapis.com"],
    },
    "resend": {
        "sdk_packages": ["resend"],
        "env_prefixes": ["RESEND_"],
        "http_domains": ["api.resend.com"],
    },
    "sentry": {
        "sdk_packages": ["@sentry/nextjs"],
        "env_prefixes": ["SENTRY_", "NEXT_PUBLIC_SENTRY_"],
        "http_domains": ["ingest.sentry.io"],
    },
    "elevenlabs": {
        "sdk_packages": ["elevenlabs"],
        "env_prefixes": ["ELEVENLABS_"],
        "http_domains": ["api.elevenlabs.io"],
    },
}


# ---------------------------------------------------------------------------
# Evidence collection
# ---------------------------------------------------------------------------

def load_package_deps():
    """Load dependency names from package.json."""
    with open(PKG_PATH) as f:
        pkg = json.load(f)
    deps = set(pkg.get("dependencies", {}).keys())
    dev_deps = set(pkg.get("devDependencies", {}).keys())
    return deps | dev_deps


def scan_code_evidence():
    """Scan src/ for env var refs and HTTP domain mentions."""
    env_vars = set()
    http_domains = set()

    env_re = re.compile(r"process\.env\.([A-Z][A-Z_0-9]+)")
    # Broad domain match for known vendor domains
    all_domains = set()
    for v in VENDOR_SDK_MAP.values():
        all_domains.update(v["http_domains"])

    for dirpath, _dirs, filenames in os.walk(SRC_DIR):
        if "__tests__" in dirpath or "node_modules" in dirpath:
            continue
        for fname in filenames:
            if not fname.endswith((".ts", ".tsx")):
                continue
            filepath = os.path.join(dirpath, fname)
            with open(filepath) as f:
                content = f.read()

            for m in env_re.finditer(content):
                env_vars.add(m.group(1))

            for domain in all_domains:
                if domain in content:
                    http_domains.add(domain)

    return env_vars, http_domains


def collect_evidence(pkg_deps, env_vars, http_domains):
    """For each vendor, collect evidence of integration from code."""
    evidence = {}

    for vendor_key, rules in VENDOR_SDK_MAP.items():
        vendor_evidence = {
            "sdk_found": [],
            "env_found": [],
            "http_found": [],
        }

        for pkg in rules["sdk_packages"]:
            if pkg in pkg_deps:
                vendor_evidence["sdk_found"].append(pkg)

        for prefix in rules["env_prefixes"]:
            for ev in env_vars:
                if ev.startswith(prefix):
                    vendor_evidence["env_found"].append(ev)

        for domain in rules["http_domains"]:
            if domain in http_domains:
                vendor_evidence["http_found"].append(domain)

        has_evidence = bool(
            vendor_evidence["sdk_found"]
            or vendor_evidence["env_found"]
            or vendor_evidence["http_found"]
        )
        vendor_evidence["has_evidence"] = has_evidence
        evidence[vendor_key] = vendor_evidence

    return evidence


# ---------------------------------------------------------------------------
# Drift detection
# ---------------------------------------------------------------------------

def compute_drift(registry_vendors, evidence):
    """Compare registry against code evidence."""
    orphaned = []  # In registry as integrated but no code evidence
    missing = []   # Code evidence exists but not in registry

    registry_keys = set(registry_vendors.keys())
    evidence_keys = set(VENDOR_SDK_MAP.keys())

    for key in sorted(registry_keys):
        vendor = registry_vendors[key]
        if vendor.get("status") == "integrated":
            if key in evidence and not evidence[key]["has_evidence"]:
                # Special case: vercel has no SDK/env/HTTP evidence (it's the host)
                if key == "vercel":
                    continue
                orphaned.append(key)

    # Check for SDK packages in package.json that aren't in our vendor map
    # (would indicate a new vendor we haven't registered)
    # This is conservative — only flags known vendor SDK packages
    for key, ev in evidence.items():
        if ev["has_evidence"] and key not in registry_keys:
            missing.append(key)

    return orphaned, missing


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    os.chdir(REPO_ROOT)

    # Load registry
    with open(REGISTRY_PATH) as f:
        registry_data = yaml.safe_load(f)
    registry_vendors = registry_data.get("vendors", {})

    # Collect evidence
    pkg_deps = load_package_deps()
    env_vars, http_domains = scan_code_evidence()
    evidence = collect_evidence(pkg_deps, env_vars, http_domains)

    # Compute drift
    orphaned, missing = compute_drift(registry_vendors, evidence)

    status = "ok" if not orphaned and not missing else "drift"

    report = {
        "registry": "vendors.yaml",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": 1,
        "drift": {
            "orphaned": orphaned,
            "missing": missing,
        },
        "evidence": {k: v for k, v in evidence.items()},
        "stats": {
            "registered_vendors": len(registry_vendors),
            "vendors_with_evidence": sum(1 for v in evidence.values() if v["has_evidence"]),
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
