#!/usr/bin/env python3
"""
Schema Registry Sync — parses Supabase migration files + greps repo,
produces docs/schema-registry.yaml entries for all tables.

Usage:
  python3 scripts/registry/sync-schema-registry.py            # dry-run
  python3 scripts/registry/sync-schema-registry.py --apply    # write

Data sources:
  - supabase/migrations/*.sql   (CREATE TABLE, ALTER TABLE, CREATE INDEX,
                                  CREATE POLICY, ENABLE ROW LEVEL SECURITY)
  - src/ via ripgrep             (writers = insert/update/upsert/delete,
                                  readers = select minus writers)

Preserves hand-crafted fields (purpose, spec_drift, status, notes,
seed_rows, changes_in_phase_7a) on existing entries.
Only updates introspected fields: columns, unique_constraints, indexes,
rls, writers, readers, source_migration, applied_date.
"""

import argparse
import difflib
import glob
import os
import re
import subprocess
import sys
from collections import OrderedDict, defaultdict

import yaml

# ---------------------------------------------------------------------------
# YAML formatting helpers — keep output readable
# ---------------------------------------------------------------------------

class LiteralStr(str):
    pass

def literal_representer(dumper, data):
    return dumper.represent_scalar("tag:yaml.org,2002:str", data, style="|")

def str_representer(dumper, data):
    if "\n" in data:
        return dumper.represent_scalar("tag:yaml.org,2002:str", data, style=">")
    return dumper.represent_scalar("tag:yaml.org,2002:str", data)

def ordered_dict_representer(dumper, data):
    return dumper.represent_mapping("tag:yaml.org,2002:map", data.items())

def none_representer(dumper, data):
    return dumper.represent_scalar("tag:yaml.org,2002:null", "null")

yaml.add_representer(LiteralStr, literal_representer)
yaml.add_representer(OrderedDict, ordered_dict_representer)
yaml.add_representer(type(None), none_representer)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MIGRATIONS_DIR = os.path.join(REPO_ROOT, "supabase", "migrations")
YAML_PATH = os.path.join(REPO_ROOT, "docs", "schema-registry.yaml")
SRC_DIR = os.path.join(REPO_ROOT, "src")

# Fields that are NEVER overwritten by introspection (hand-crafted)
PRESERVE_FIELDS = {
    "purpose", "spec_drift", "status", "notes", "seed_rows",
    "changes_in_phase_7a",
}

# Fields that introspection produces
INTROSPECTED_FIELDS = {
    "columns", "unique_constraints", "indexes", "rls",
    "writers", "readers", "source_migration", "applied_date",
}

# ---------------------------------------------------------------------------
# Migration parsing
# ---------------------------------------------------------------------------

def read_all_migrations():
    """Read all migration files, return list of (filename, content) sorted."""
    pattern = os.path.join(MIGRATIONS_DIR, "*.sql")
    files = sorted(glob.glob(pattern))
    result = []
    for f in files:
        with open(f) as fh:
            result.append((os.path.basename(f), fh.read()))
    return result


def list_tables_from_migrations(migrations):
    """Extract all CREATE TABLE names from migrations. Returns sorted unique list."""
    tables = set()
    dropped = set()
    for _fname, content in migrations:
        for m in re.finditer(
            r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s*\(",
            content, re.IGNORECASE
        ):
            tables.add(m.group(1))
        for m in re.finditer(
            r"DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(\w+)",
            content, re.IGNORECASE
        ):
            dropped.add(m.group(1))
    return sorted(tables), dropped


def find_source_migration(table, migrations):
    """Return the first migration file that CREATE TABLEs this table."""
    pat = re.compile(
        r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?" + re.escape(table) + r"\s*\(",
        re.IGNORECASE,
    )
    for fname, content in migrations:
        if pat.search(content):
            return fname
    return None


def parse_columns(table, migrations):
    """
    Parse column definitions from CREATE TABLE + ALTER TABLE ADD COLUMN
    across all migrations. Returns OrderedDict of {col_name: definition_str}.
    """
    columns = OrderedDict()

    # Pattern for CREATE TABLE block
    create_pat = re.compile(
        r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?" + re.escape(table) + r"\s*\((.*?)\);",
        re.IGNORECASE | re.DOTALL,
    )

    for _fname, content in migrations:
        for m in create_pat.finditer(content):
            body = m.group(1)
            _parse_create_body(body, columns)

    # ALTER TABLE ADD COLUMN
    alter_pat = re.compile(
        r"ALTER\s+TABLE\s+" + re.escape(table) + r"\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s+(.+?)(?:;|\n\s*(?:ALTER|CREATE|DROP|--|$))",
        re.IGNORECASE | re.DOTALL,
    )
    for _fname, content in migrations:
        for m in alter_pat.finditer(content):
            col_name = m.group(1).strip()
            col_def = _clean_col_def(m.group(2).strip())
            if col_name.upper() not in ("TABLE", "CONSTRAINT", "INDEX"):
                columns[col_name] = col_def

    # Also handle multiline ALTER TABLE ... ADD COLUMN patterns
    # Some migrations use indented format:
    #   ALTER TABLE foo
    #     ADD COLUMN IF NOT EXISTS bar TEXT;
    alter_pat2 = re.compile(
        r"ALTER\s+TABLE\s+" + re.escape(table) + r"\s*\n\s*ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s+(.+?)(?:;)",
        re.IGNORECASE | re.DOTALL,
    )
    for _fname, content in migrations:
        for m in alter_pat2.finditer(content):
            col_name = m.group(1).strip()
            col_def = _clean_col_def(m.group(2).strip())
            if col_name not in columns and col_name.upper() not in ("TABLE", "CONSTRAINT", "INDEX"):
                columns[col_name] = col_def

    return columns


def _strip_sql_comments(text):
    """Remove SQL single-line comments (-- ...) to avoid comma confusion."""
    return re.sub(r"--[^\n]*", "", text)


def _parse_create_body(body, columns):
    """Parse the inside of a CREATE TABLE (...) block into column definitions."""
    body = _strip_sql_comments(body)
    # Split on commas, but respect parentheses (for CHECK, DEFAULT, etc.)
    parts = _split_respecting_parens(body)
    for part in parts:
        part = part.strip()
        if not part:
            continue
        # Skip constraints (PRIMARY KEY, UNIQUE, CHECK, FOREIGN KEY, CONSTRAINT)
        upper = part.upper().lstrip()
        if upper.startswith(("PRIMARY KEY", "UNIQUE(", "UNIQUE (", "CHECK", "FOREIGN KEY", "CONSTRAINT")):
            continue
        # Column definition: name TYPE [rest]
        m = re.match(r"(\w+)\s+(.+)", part, re.DOTALL)
        if m:
            col_name = m.group(1)
            col_def = _clean_col_def(m.group(2))
            # Skip if it looks like a keyword, not a column
            if col_name.upper() not in ("PRIMARY", "UNIQUE", "CHECK", "FOREIGN", "CONSTRAINT", "CREATE", "ALTER"):
                columns[col_name] = col_def


def _split_respecting_parens(text):
    """Split text on commas, but not commas inside parentheses."""
    parts = []
    depth = 0
    current = []
    for ch in text:
        if ch == '(':
            depth += 1
            current.append(ch)
        elif ch == ')':
            depth -= 1
            current.append(ch)
        elif ch == ',' and depth == 0:
            parts.append(''.join(current))
            current = []
        elif ch == '\n':
            current.append(' ')
        else:
            current.append(ch)
    if current:
        parts.append(''.join(current))
    return parts


def _clean_col_def(s):
    """Clean up a column definition string."""
    # Collapse whitespace
    s = re.sub(r"\s+", " ", s).strip()
    # Remove trailing comma
    s = s.rstrip(",").strip()
    return s


def parse_unique_constraints(table, migrations):
    """Extract unique constraints from CREATE TABLE and ALTER TABLE."""
    constraints = []

    create_pat = re.compile(
        r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?" + re.escape(table) + r"\s*\((.*?)\);",
        re.IGNORECASE | re.DOTALL,
    )
    for _fname, content in migrations:
        for m in create_pat.finditer(content):
            body = m.group(1)
            parts = _split_respecting_parens(body)
            for part in parts:
                part = part.strip()
                upper = part.upper()
                if upper.startswith("UNIQUE"):
                    # Extract column list from UNIQUE(col1, col2)
                    cols_m = re.search(r"\(([^)]+)\)", part)
                    if cols_m:
                        cols = [c.strip() for c in cols_m.group(1).split(",")]
                        constraints.append(cols)

    # ALTER TABLE ADD CONSTRAINT ... UNIQUE
    alter_pat = re.compile(
        r"ALTER\s+TABLE\s+" + re.escape(table) + r"\s+ADD\s+CONSTRAINT\s+\w+\s+UNIQUE\s*\(([^)]+)\)",
        re.IGNORECASE,
    )
    for _fname, content in migrations:
        for m in alter_pat.finditer(content):
            cols = [c.strip() for c in m.group(1).split(",")]
            if cols not in constraints:
                constraints.append(cols)

    return constraints


def parse_indexes(table, migrations):
    """Extract indexes for a table from all migrations."""
    indexes = []
    seen = set()

    # CREATE [UNIQUE] INDEX [IF NOT EXISTS] name ON table ...
    idx_pat = re.compile(
        r"CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s+ON\s+" + re.escape(table) + r"\s*(.*?)(?:;)",
        re.IGNORECASE | re.DOTALL,
    )
    for _fname, content in migrations:
        for m in idx_pat.finditer(content):
            idx_name = m.group(1)
            idx_rest = re.sub(r"\s+", " ", m.group(2)).strip()
            # Also check for USING
            entry = f"{idx_name} ON {idx_rest}" if idx_rest else idx_name
            if idx_name not in seen:
                seen.add(idx_name)
                indexes.append(entry)

    return indexes


def parse_rls_policies(table, migrations):
    """
    Parse RLS policies for a table. Returns dict with 'read' and 'write' keys,
    each containing a summary string.
    """
    has_rls = False
    policies = []

    # Check ENABLE ROW LEVEL SECURITY
    rls_pat = re.compile(
        r"ALTER\s+TABLE\s+" + re.escape(table) + r"\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY",
        re.IGNORECASE,
    )
    for _fname, content in migrations:
        if rls_pat.search(content):
            has_rls = True
            break

    if not has_rls:
        return {
            "read": "No RLS — table not protected",
            "write": "No RLS — table not protected",
        }

    # Parse CREATE POLICY ... ON table
    policy_pat2 = re.compile(
        r'CREATE\s+POLICY\s+(?:"([^"]+)"|(\w+))\s*\n?\s*ON\s+' + re.escape(table) + r'\b(.*?)(?=CREATE\s+POLICY|CREATE\s+(?:UNIQUE\s+)?INDEX|ALTER\s+TABLE|CREATE\s+TABLE|DROP|GRANT|REVOKE|INSERT\s+INTO|--\s*={3,}|\Z)',
        re.IGNORECASE | re.DOTALL,
    )

    for _fname, content in migrations:
        for m in policy_pat2.finditer(content):
            name = m.group(1) or m.group(2)
            body = m.group(3).strip()
            # Extract FOR clause
            for_match = re.search(r"FOR\s+(SELECT|INSERT|UPDATE|DELETE|ALL)", body, re.IGNORECASE)
            command = for_match.group(1).upper() if for_match else "ALL"
            # Extract TO clause
            to_match = re.search(r"TO\s+(\w+)", body, re.IGNORECASE)
            role = to_match.group(1) if to_match else "unknown"
            policies.append({
                "name": name,
                "command": command,
                "role": role,
            })

    if not policies:
        return {
            "read": "RLS enabled but no policies found in migrations",
            "write": "RLS enabled but no policies found in migrations",
        }

    # Summarize: group by read (SELECT) vs write (INSERT/UPDATE/DELETE)
    read_summaries = []
    write_summaries = []
    for p in policies:
        summary = f"{p['name']} ({p['role']})"
        if p["command"] in ("SELECT", "ALL"):
            read_summaries.append(summary)
        if p["command"] in ("INSERT", "UPDATE", "DELETE", "ALL"):
            write_summaries.append(summary)

    return {
        "read": "; ".join(read_summaries) if read_summaries else "RLS enabled, no SELECT policy",
        "write": "; ".join(write_summaries) if write_summaries else "RLS enabled, no write policy",
    }


# ---------------------------------------------------------------------------
# Codebase grep (writers / readers)
# ---------------------------------------------------------------------------

def find_writers(table):
    """Find files that write (insert/update/upsert/delete) to a table."""
    pattern = rf"\.from\(['\"]({re.escape(table)})['\"]"
    write_ops = r"\.(insert|update|upsert|delete)"
    combined = rf"\.from\(['\"]({re.escape(table)})['\"].*{write_ops}"
    try:
        result = subprocess.run(
            ["rg", "-l", "--type", "ts", "--type", "tsx",
             rf"\.from\('{table}'\).*\.(insert|update|upsert|delete)",
             SRC_DIR],
            capture_output=True, text=True, cwd=REPO_ROOT, timeout=10,
        )
        # rg might not know tsx, try again with glob
        if result.returncode == 2:  # type error
            result = subprocess.run(
                ["rg", "-l", "--glob", "*.{ts,tsx}",
                 rf"\.from\('{table}'\).*\.(insert|update|upsert|delete)",
                 SRC_DIR],
                capture_output=True, text=True, cwd=REPO_ROOT, timeout=10,
            )
        paths = [_rel_path(p) for p in result.stdout.strip().split("\n") if p.strip()]
        return sorted(paths)
    except Exception:
        return []


def find_readers(table):
    """Find files that read (select) from a table, excluding writers."""
    writers = set(find_writers.__wrapped__(table) if hasattr(find_writers, '__wrapped__') else [])
    try:
        result = subprocess.run(
            ["rg", "-l", "--glob", "*.{ts,tsx}",
             rf"\.from\('{table}'\).*\.select",
             SRC_DIR],
            capture_output=True, text=True, cwd=REPO_ROOT, timeout=10,
        )
        all_refs = {_rel_path(p) for p in result.stdout.strip().split("\n") if p.strip()}
        return sorted(all_refs)
    except Exception:
        return []


def find_all_refs(table):
    """Find all files referencing a table via .from('table') or .from("table"), split into writers and readers."""
    try:
        # Find all files referencing this table (single or double quotes)
        w_result = subprocess.run(
            ["rg", "-l", "--glob", "*.{ts,tsx}",
             rf"""\.from\(['"]{table}['"]\)""",
             SRC_DIR],
            capture_output=True, text=True, cwd=REPO_ROOT, timeout=10,
        )
        all_files = {_rel_path(p) for p in w_result.stdout.strip().split("\n") if p.strip()}

        # Now check which of those files contain write operations for this table
        writers = set()
        for f in all_files:
            full_path = os.path.join(REPO_ROOT, f)
            if os.path.exists(full_path):
                try:
                    with open(full_path) as fh:
                        content = fh.read()
                    # Check for write ops near the .from() call
                    if re.search(rf"""\.from\(['"]{table}['"]\)[\s\S]{{0,200}}\.(insert|update|upsert|delete)\b""", content):
                        writers.add(f)
                except Exception:
                    pass

        readers = all_files - writers
        return sorted(writers), sorted(readers)
    except Exception:
        return [], []


def _rel_path(p):
    """Make path relative to repo root."""
    p = p.strip()
    if p.startswith(REPO_ROOT):
        return os.path.relpath(p, REPO_ROOT)
    return p


# ---------------------------------------------------------------------------
# YAML load / merge / write
# ---------------------------------------------------------------------------

def load_existing_yaml():
    """Load existing schema-registry.yaml, return (header_lines, tables_list)."""
    if not os.path.exists(YAML_PATH):
        return [], []

    with open(YAML_PATH) as f:
        raw = f.read()

    try:
        data = yaml.safe_load(raw)
    except yaml.YAMLError:
        data = None

    if not data or "tables" not in data:
        return [], []

    # Build lookup of existing entries
    existing = []
    for entry in data.get("tables", []):
        if isinstance(entry, dict) and "name" in entry:
            existing.append(entry)

    return data, existing


def build_entry(table, migrations, dropped_tables):
    """Build a fresh introspected entry for a table."""
    entry = OrderedDict()
    entry["name"] = table

    source = find_source_migration(table, migrations)
    entry["source_migration"] = source

    if table in dropped_tables:
        entry["status"] = "dropped"
        entry["applied_date"] = None
        entry["purpose"] = None
        entry["columns"] = OrderedDict()
        entry["spec_drift"] = []
        return entry

    entry["status"] = "applied"
    entry["applied_date"] = None
    entry["purpose"] = None

    columns = parse_columns(table, migrations)
    entry["columns"] = columns if columns else OrderedDict()

    unique = parse_unique_constraints(table, migrations)
    if unique:
        entry["unique_constraints"] = [cols for cols in unique]

    indexes = parse_indexes(table, migrations)
    if indexes:
        entry["indexes"] = indexes

    rls = parse_rls_policies(table, migrations)
    entry["rls"] = rls

    writers, readers = find_all_refs(table)
    entry["writers"] = writers if writers else []
    entry["readers"] = readers if readers else []

    entry["spec_drift"] = []

    return entry


def merge_entries(existing_list, new_entries):
    """
    Merge new introspected entries with existing hand-crafted ones.
    Preserves PRESERVE_FIELDS from existing, updates INTROSPECTED_FIELDS from new.
    """
    existing_map = {}
    for e in existing_list:
        if isinstance(e, dict) and "name" in e:
            existing_map[e["name"]] = e

    merged = []
    seen = set()

    # First, process all new entries (which covers all tables from migrations)
    for new in new_entries:
        name = new["name"]
        seen.add(name)

        if name in existing_map:
            old = existing_map[name]
            result = OrderedDict()
            result["name"] = name

            # Start with new entry as base
            for k, v in new.items():
                result[k] = v

            # Overlay preserved fields from existing
            for field in PRESERVE_FIELDS:
                if field in old:
                    result[field] = old[field]

            # Also preserve any extra hand-crafted fields not in introspected set
            for k, v in old.items():
                if k not in INTROSPECTED_FIELDS and k != "name":
                    result[k] = v

            merged.append(result)
        else:
            merged.append(new)

    # Then add any existing entries that weren't in migrations (shouldn't happen normally)
    for name, old in existing_map.items():
        if name not in seen:
            merged.append(old)

    # Sort by name
    merged.sort(key=lambda e: e.get("name", ""))
    return merged


def build_yaml_doc(merged_entries, existing_data):
    """Build the complete YAML document."""
    doc = OrderedDict()
    doc["last_updated"] = existing_data.get("last_updated", "2026-04-14") if existing_data else "2026-04-14"
    doc["last_updated_by"] = "sync-schema-registry.py backfill"
    doc["tables"] = merged_entries
    return doc


def yaml_dump(doc):
    """Dump YAML with nice formatting."""
    return yaml.dump(
        doc,
        default_flow_style=False,
        allow_unicode=True,
        sort_keys=False,
        width=120,
    )


def read_yaml_header():
    """Read the comment header from the existing YAML file."""
    if not os.path.exists(YAML_PATH):
        return ""
    lines = []
    with open(YAML_PATH) as f:
        for line in f:
            if line.startswith("#") or line.strip() == "":
                lines.append(line)
            else:
                break
    return "".join(lines)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Sync schema registry from migrations")
    parser.add_argument("--apply", action="store_true", help="Write changes (default: dry-run)")
    args = parser.parse_args()

    os.chdir(REPO_ROOT)

    # 1. Read migrations
    migrations = read_all_migrations()
    print(f"Read {len(migrations)} migration files")

    # 2. List tables
    tables, dropped = list_tables_from_migrations(migrations)
    print(f"Found {len(tables)} tables ({len(dropped)} dropped)")
    if dropped:
        print(f"  Dropped: {', '.join(sorted(dropped))}")

    # 3. Load existing YAML
    existing_data, existing_entries = load_existing_yaml()
    existing_names = {e["name"] for e in existing_entries}
    print(f"Existing YAML entries: {len(existing_entries)} ({', '.join(sorted(existing_names))})")

    # 4. Build introspected entries for all tables
    print("\nIntrospecting tables...")
    new_entries = []
    no_rls_tables = []
    for i, table in enumerate(tables):
        entry = build_entry(table, migrations, dropped)
        new_entries.append(entry)
        rls = entry.get("rls", {})
        if isinstance(rls, dict) and "No RLS" in rls.get("read", ""):
            no_rls_tables.append(table)
        sys.stdout.write(f"\r  [{i+1}/{len(tables)}] {table:<40}")
        sys.stdout.flush()
    print()

    # 5. Flag no-RLS tables
    if no_rls_tables:
        print(f"\n{'='*60}")
        print(f"WARNING: {len(no_rls_tables)} tables have NO RLS policies:")
        for t in no_rls_tables:
            print(f"  - {t}")
        print(f"{'='*60}\n")

    # 6. Merge
    merged = merge_entries(existing_entries, new_entries)
    doc = build_yaml_doc(merged, existing_data)

    # 7. Generate output
    header = read_yaml_header()
    new_yaml = header + yaml_dump(doc)

    # 8. Diff
    if os.path.exists(YAML_PATH):
        with open(YAML_PATH) as f:
            old_yaml = f.read()
    else:
        old_yaml = ""

    diff = list(difflib.unified_diff(
        old_yaml.splitlines(keepends=True),
        new_yaml.splitlines(keepends=True),
        fromfile="docs/schema-registry.yaml (before)",
        tofile="docs/schema-registry.yaml (after)",
    ))

    if not diff:
        print("No changes detected.")
        return 0

    # Print diff (truncated for readability)
    diff_text = "".join(diff)
    diff_lines = diff_text.split("\n")
    print(f"\nDiff: {len(diff_lines)} lines")
    if len(diff_lines) > 100:
        print("".join(diff[:150]))
        print(f"\n... ({len(diff_lines) - 150} more lines) ...")
    else:
        print(diff_text)

    # Summary
    print(f"\nSummary:")
    print(f"  Total entries: {len(merged)}")
    print(f"  Existing (preserved): {len(existing_entries)}")
    print(f"  New: {len(merged) - len(existing_entries)}")
    print(f"  No RLS: {len(no_rls_tables)}")

    if args.apply:
        with open(YAML_PATH, "w") as f:
            f.write(new_yaml)
        print(f"\nWritten to {YAML_PATH}")
    else:
        print(f"\nDry-run complete. Use --apply to write.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
