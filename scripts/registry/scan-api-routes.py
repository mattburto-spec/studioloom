#!/usr/bin/env python3
"""
API Registry Scanner — walks src/app/api/**/route.ts and produces
docs/api-registry.yaml with one entry per (path, method) tuple.

Usage:
  python3 scripts/registry/scan-api-routes.py            # dry-run
  python3 scripts/registry/scan-api-routes.py --apply    # write

Extracts: path, method, auth type, tables_read, tables_written.
Leaves ai_call_sites (7-Pre.3) and cost_ceiling_usd (Phase 7I) empty.
"""

import argparse
import os
import re
import sys
from collections import OrderedDict

import yaml

# ---------------------------------------------------------------------------
# YAML formatting
# ---------------------------------------------------------------------------

def ordered_dict_representer(dumper, data):
    return dumper.represent_mapping("tag:yaml.org,2002:map", data.items())

def none_representer(dumper, data):
    return dumper.represent_scalar("tag:yaml.org,2002:null", "null")

yaml.add_representer(OrderedDict, ordered_dict_representer)
yaml.add_representer(type(None), none_representer)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
API_DIR = os.path.join(REPO_ROOT, "src", "app", "api")
YAML_PATH = os.path.join(REPO_ROOT, "docs", "api-registry.yaml")
SCHEMA_REGISTRY_PATH = os.path.join(REPO_ROOT, "docs", "schema-registry.yaml")

# ---------------------------------------------------------------------------
# Route discovery
# ---------------------------------------------------------------------------

def find_route_files():
    """Walk src/app/api/**/ and find all route.ts files."""
    routes = []
    for dirpath, _dirnames, filenames in os.walk(API_DIR):
        if "route.ts" in filenames:
            full = os.path.join(dirpath, "route.ts")
            routes.append(full)
    return sorted(routes)


def file_to_api_path(filepath):
    """Convert a route.ts file path to its API path.

    src/app/api/teacher/generate-lesson/route.ts → /api/teacher/generate-lesson
    Strips route groups (parenthesized segments).
    """
    # Get path relative to src/app
    rel = os.path.relpath(filepath, os.path.join(REPO_ROOT, "src", "app"))
    # Remove /route.ts suffix
    path_dir = os.path.dirname(rel)
    # Convert OS separator to URL separator
    parts = path_dir.replace(os.sep, "/").split("/")
    # Strip route groups (segments wrapped in parentheses)
    parts = [p for p in parts if not (p.startswith("(") and p.endswith(")"))]
    return "/" + "/".join(parts)


# ---------------------------------------------------------------------------
# Method detection
# ---------------------------------------------------------------------------

HTTP_METHODS = {"GET", "POST", "PATCH", "PUT", "DELETE", "HEAD", "OPTIONS"}

# export async function GET(...)
FUNC_EXPORT_RE = re.compile(
    r"^export\s+(?:async\s+)?function\s+(GET|POST|PATCH|PUT|DELETE|HEAD|OPTIONS)\b",
    re.MULTILINE,
)

# export const GET = ...
CONST_EXPORT_RE = re.compile(
    r"^export\s+const\s+(GET|POST|PATCH|PUT|DELETE|HEAD|OPTIONS)\s*=",
    re.MULTILINE,
)

# export { GET, POST } or export { GET }
REEXPORT_RE = re.compile(
    r"^export\s*\{([^}]+)\}",
    re.MULTILINE,
)


def detect_methods(content):
    """Return set of HTTP methods exported from the file."""
    methods = set()
    for m in FUNC_EXPORT_RE.finditer(content):
        methods.add(m.group(1))
    for m in CONST_EXPORT_RE.finditer(content):
        methods.add(m.group(1))
    for m in REEXPORT_RE.finditer(content):
        names = [n.strip() for n in m.group(1).split(",")]
        for name in names:
            if name in HTTP_METHODS:
                methods.add(name)
    return sorted(methods)


# ---------------------------------------------------------------------------
# Auth inference
# ---------------------------------------------------------------------------

def infer_auth(filepath, content):
    """Infer auth type from file path and content. Returns (auth_type, notes_or_none)."""
    rel_path = os.path.relpath(filepath, REPO_ROOT)
    signals = set()

    # Admin checks
    if re.search(r"@/lib/auth/admin|requireAdmin|teacher_tier\s*===?\s*['\"]admin['\"]", content):
        signals.add("admin")
    elif "src/app/api/admin/" in rel_path:
        signals.add("admin")

    # Teacher checks — requireTeacherAuth, getUser, createServerClient + auth.getUser
    if re.search(r"requireTeacherAuth|requireTeacher\b", content):
        signals.add("teacher")
    elif re.search(r"\.auth\.getUser|getUser\(\)|createRouteHandlerClient|createServerClient", content):
        # Supabase user auth — teacher unless also student
        if "src/app/api/student/" not in rel_path:
            signals.add("teacher")

    # Student checks
    if re.search(r"requireStudentAuth|requireStudent\b|validateStudentToken|student_token|studentToken", content):
        signals.add("student")
    elif "src/app/api/student/" in rel_path and not signals:
        signals.add("student")

    # Public path
    if "src/app/api/public/" in rel_path:
        signals.add("public")

    # Service-role only (createAdminClient WITHOUT any user auth)
    # Note: createAdminClient is widely used alongside user auth for elevated queries.
    # Only flag as service-role if there's NO user auth at all.
    if not signals and re.search(r"createAdminClient|SUPABASE_SERVICE_ROLE_KEY", content):
        signals.add("service-role")

    # No auth at all
    if not signals:
        # Check if there's truly no auth of any kind
        if not re.search(r"auth|token|getUser|requireStudent|requireTeacher|createAdminClient|createServerClient|SERVICE_ROLE", content, re.IGNORECASE):
            return "public", None
        # Has some auth-like imports but didn't match our patterns
        return "unknown", "Could not infer auth pattern; manual review needed"

    if len(signals) == 1:
        return signals.pop(), None

    # Mixed
    return "mixed", f"Multiple auth patterns detected: {', '.join(sorted(signals))}"


# ---------------------------------------------------------------------------
# Table extraction
# ---------------------------------------------------------------------------

# .from('table_name') or .from("table_name")
FROM_RE = re.compile(r"""\.from\(['"]([\w]+)['"]\)""")

# Write operations: .insert, .update, .upsert, .delete
WRITE_RE = re.compile(r"""\.from\(['"]([\w]+)['"]\)\s*\.\s*(insert|update|upsert|delete)\b""")

# Read operations: .select
READ_RE = re.compile(r"""\.from\(['"]([\w]+)['"]\)\s*\.\s*select\b""")

# RPC calls: .rpc('function_name')
RPC_RE = re.compile(r"""\.rpc\(['"]([\w]+)['"]\)""")


def extract_tables(content):
    """Extract tables_read and tables_written from file content."""
    written = set()
    for m in WRITE_RE.finditer(content):
        written.add(m.group(1))

    read = set()
    for m in READ_RE.finditer(content):
        read.add(m.group(1))

    # Also catch chained patterns where .select comes after .insert etc (read-back)
    # and multi-line patterns
    all_from = set()
    for m in FROM_RE.finditer(content):
        all_from.add(m.group(1))

    # Check for write ops that may be on subsequent lines
    for table in all_from:
        # Look for table reference followed by write op within ~500 chars
        pattern = re.compile(
            rf"""\.from\(['"]{re.escape(table)}['"]\)[\s\S]{{0,500}}?\.\s*(insert|update|upsert|delete)\b"""
        )
        if pattern.search(content):
            written.add(table)

        # Same for reads
        pattern_r = re.compile(
            rf"""\.from\(['"]{re.escape(table)}['"]\)[\s\S]{{0,500}}?\.\s*select\b"""
        )
        if pattern_r.search(content):
            read.add(table)

    return sorted(read), sorted(written)


def extract_rpcs(content):
    """Extract RPC function names from file content."""
    rpcs = set()
    for m in RPC_RE.finditer(content):
        rpcs.add(m.group(1))
    return sorted(rpcs)


# ---------------------------------------------------------------------------
# Schema registry cross-validation
# ---------------------------------------------------------------------------

def load_schema_tables():
    """Load table names from schema-registry.yaml."""
    if not os.path.exists(SCHEMA_REGISTRY_PATH):
        return set()
    with open(SCHEMA_REGISTRY_PATH) as f:
        data = yaml.safe_load(f)
    if not data or "tables" not in data:
        return set()
    return {t["name"] for t in data["tables"] if isinstance(t, dict) and "name" in t}


# ---------------------------------------------------------------------------
# Main scanner
# ---------------------------------------------------------------------------

def scan_all_routes():
    """Scan all route files and produce entries."""
    route_files = find_route_files()
    schema_tables = load_schema_tables()
    entries = []
    unknown_table_refs = {}  # table -> list of files

    for filepath in route_files:
        with open(filepath) as f:
            content = f.read()

        rel_file = os.path.relpath(filepath, REPO_ROOT)
        api_path = file_to_api_path(filepath)
        methods = detect_methods(content)
        auth, auth_notes = infer_auth(filepath, content)
        tables_read, tables_written = extract_tables(content)
        rpcs = extract_rpcs(content)

        if not methods:
            # File exists but no exported methods found
            methods = ["UNKNOWN"]

        for method in methods:
            entry = OrderedDict()
            entry["path"] = api_path
            entry["method"] = method
            entry["file"] = rel_file
            entry["auth"] = auth
            entry["tables_read"] = tables_read
            entry["tables_written"] = tables_written
            entry["ai_call_sites"] = []
            entry["cost_ceiling_usd"] = None

            # Build notes
            notes_parts = []
            if auth_notes:
                notes_parts.append(auth_notes)
            if rpcs:
                notes_parts.append(f"Uses RPC: {', '.join(rpcs)}")

            # Cross-validate tables against schema registry
            all_tables = set(tables_read) | set(tables_written)
            for t in sorted(all_tables):
                if t not in schema_tables:
                    notes_parts.append(f"Reference to unknown table '{t}' — not in schema-registry")
                    unknown_table_refs.setdefault(t, []).append(rel_file)

            entry["notes"] = "; ".join(notes_parts) if notes_parts else None

            entries.append(entry)

    # Sort by path ASC, then method ASC
    method_order = {"GET": 0, "POST": 1, "PATCH": 2, "PUT": 3, "DELETE": 4, "HEAD": 5, "OPTIONS": 6, "UNKNOWN": 7}
    entries.sort(key=lambda e: (e["path"], method_order.get(e["method"], 99)))

    return entries, route_files, unknown_table_refs


def build_yaml_doc(entries):
    """Build the YAML document."""
    doc = OrderedDict()
    doc["routes"] = entries
    return doc


class NoAliasDumper(yaml.Dumper):
    """Dumper that never emits YAML aliases/anchors."""
    def ignore_aliases(self, data):
        return True

NoAliasDumper.add_representer(OrderedDict, ordered_dict_representer)
NoAliasDumper.add_representer(type(None), none_representer)


def yaml_dump(doc):
    return yaml.dump(
        doc,
        Dumper=NoAliasDumper,
        default_flow_style=False,
        allow_unicode=True,
        sort_keys=False,
        width=120,
    )


def build_header(total):
    return f"""# API Registry — source of truth for all HTTP endpoints
#
# Auto-generated by scripts/registry/scan-api-routes.py from src/app/api/**/route.ts.
# Manual edits to auto-populated fields will be overwritten. Use `notes` for manual context.
# Cross-referenced with docs/schema-registry.yaml (tables) and docs/ai-call-sites.yaml (AI calls).
#
# Last synced: 2026-04-14
# Total routes: {total}

"""


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Scan API routes and produce api-registry.yaml")
    parser.add_argument("--apply", action="store_true", help="Write changes (default: dry-run)")
    args = parser.parse_args()

    os.chdir(REPO_ROOT)

    entries, route_files, unknown_table_refs = scan_all_routes()

    # --- Diagnostics ---
    print(f"Route files scanned: {len(route_files)}")
    print(f"Total (path, method) entries: {len(entries)}")

    # Method breakdown
    method_counts = {}
    for e in entries:
        method_counts[e["method"]] = method_counts.get(e["method"], 0) + 1
    print(f"\nMethod breakdown:")
    for m in sorted(method_counts, key=lambda x: (-method_counts[x], x)):
        print(f"  {m}: {method_counts[m]}")

    # Auth breakdown
    auth_counts = {}
    for e in entries:
        auth_counts[e["auth"]] = auth_counts.get(e["auth"], 0) + 1
    print(f"\nAuth breakdown:")
    for a in sorted(auth_counts, key=lambda x: (-auth_counts[x], x)):
        print(f"  {a}: {auth_counts[a]}")

    # Write-free endpoints
    write_free = sum(1 for e in entries if not e["tables_written"])
    print(f"\nEntries with tables_written: []: {write_free}")

    # No tables at all
    no_tables = sum(1 for e in entries if not e["tables_read"] and not e["tables_written"])
    print(f"Entries with BOTH tables_read: [] AND tables_written: []: {no_tables}")

    # Unknown table refs
    if unknown_table_refs:
        print(f"\nUnknown table references (not in schema-registry):")
        for t, files in sorted(unknown_table_refs.items()):
            print(f"  {t}: {len(files)} files")
    else:
        print(f"\nUnknown table references: 0")

    # --- Gate checks ---
    total = len(entries)
    unknown_auth = auth_counts.get("unknown", 0)
    public_auth = auth_counts.get("public", 0)
    max_reads = max((len(e["tables_read"]) for e in entries), default=0)
    max_writes = max((len(e["tables_written"]) for e in entries), default=0)

    gate_fail = False
    if unknown_auth > total * 0.2:
        print(f"\n⛔ GATE FAIL: unknown auth count {unknown_auth} > 20% of {total}")
        gate_fail = True
    if public_auth > 40:
        print(f"\n⛔ GATE FAIL: public auth count {public_auth} > 40")
        gate_fail = True
    if max_reads > 15 or max_writes > 15:
        print(f"\n⛔ GATE FAIL: max tables_read={max_reads}, max tables_written={max_writes} (>15)")
        gate_fail = True
    if total < 150 or total > 300:
        print(f"\n⛔ GATE FAIL: total entries {total} outside expected range 150-300")
        gate_fail = True

    if gate_fail:
        print("\nGate check FAILED. Fix issues before --apply.")
        return 1

    print("\n✓ All gate checks passed.")

    # --- Preview ---
    doc = build_yaml_doc(entries)
    header = build_header(total)
    full_yaml = header + yaml_dump(doc)

    preview_lines = full_yaml.split("\n")[:100]
    print(f"\nYAML preview (first 100 lines):")
    print("\n".join(preview_lines))
    if len(full_yaml.split("\n")) > 100:
        print(f"... ({len(full_yaml.split(chr(10))) - 100} more lines)")

    # --- Apply ---
    if args.apply:
        with open(YAML_PATH, "w") as f:
            f.write(full_yaml)
        print(f"\nWritten to {YAML_PATH}")
    else:
        print(f"\nDry-run complete. Use --apply to write.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
