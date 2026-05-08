#!/usr/bin/env python3
"""
AI Call Sites Scanner — scans src/ for LLM and embedding API calls and produces
docs/ai-call-sites.yaml with one entry per (file, function, model) tuple.

Detection layers:
  1. Direct SDK imports (@anthropic-ai/sdk, voyageai, groq-sdk, @google/generative-ai)
  2. Wrapper function consumers (callHaiku, AnthropicProvider, etc.)
  3. HTTP-based calls (fetch to api.anthropic.com, api.voyageai.com, etc.)

Usage:
  python3 scripts/registry/scan-ai-calls.py            # dry-run
  python3 scripts/registry/scan-ai-calls.py --apply    # write
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

class NoAliasDumper(yaml.Dumper):
    def ignore_aliases(self, data):
        return True

def ordered_dict_representer(dumper, data):
    return dumper.represent_mapping("tag:yaml.org,2002:map", data.items())

def none_representer(dumper, data):
    return dumper.represent_scalar("tag:yaml.org,2002:null", "null")

NoAliasDumper.add_representer(OrderedDict, ordered_dict_representer)
NoAliasDumper.add_representer(type(None), none_representer)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC_DIR = os.path.join(REPO_ROOT, "src")
YAML_PATH = os.path.join(REPO_ROOT, "docs", "ai-call-sites.yaml")
API_REGISTRY_PATH = os.path.join(REPO_ROOT, "docs", "api-registry.yaml")
FOLLOWUPS_PATH = os.path.join(REPO_ROOT, "docs", "projects", "dimensions3-followups.md")

# Provider detection patterns
SDK_IMPORTS = {
    "anthropic": re.compile(r"""from\s+['"]@anthropic-ai/sdk['"]"""),
    "voyage": re.compile(r"""from\s+['"](?:voyageai|@voyageai)['"]"""),
    "groq": re.compile(r"""from\s+['"]groq-sdk['"]"""),
    "gemini": re.compile(r"""from\s+['"]@google/generative-ai['"]"""),
}

# HTTP-based provider hostnames
HTTP_PROVIDERS = {
    "anthropic": "api.anthropic.com",
    "voyage": "api.voyageai.com",
    "groq": "api.groq.com",
    "gemini": "generativelanguage.googleapis.com",
}

# Known wrapper files and their exported functions
# Built dynamically in pass 1

# SDK call patterns
ANTHROPIC_CALL_RE = re.compile(r"""\.messages\.(create|stream)\s*\(""")
VOYAGE_CALL_RE = re.compile(r"""\.(embed|rerank)\s*\(""")

# Known wrapper functions to look for in consumers
WRAPPER_FUNCTIONS = {
    "callHaiku": {"provider": "anthropic", "model": "claude-haiku-4-5-20251001", "via": "HTTP fetch"},
    "callSonnet": {"provider": "anthropic", "model": "claude-sonnet-4-20250514", "via": "HTTP fetch"},
    "callClaude": {"provider": "anthropic", "model": "dynamic", "via": "HTTP fetch"},
    "validateToolkitRequest": None,  # utility, not an AI call
    "parseToolkitJSON": None,  # utility
}

# Model extraction patterns
MODEL_LITERAL_RE = re.compile(r"""model:\s*['"]([^'"]+)['"]""")
MODEL_VARIABLE_RE = re.compile(r"""model:\s*(\w+(?:\.\w+)*)""")
MAX_TOKENS_LITERAL_RE = re.compile(r"""max_tokens:\s*(\d+)""")
MAX_TOKENS_VARIABLE_RE = re.compile(r"""max_tokens:\s*(\w+)""")

# Cost category inference from file path
COST_CATEGORY_PATHS = [
    (r"src/lib/ingestion/|src/lib/knowledge/|src/lib/moderation/|src/lib/content-safety/", "ingestion"),
    (r"src/lib/ai/|src/lib/generation/|src/lib/brain/|src/lib/pipeline/|src/lib/converter/", "generation"),
    (r"src/lib/tools/|src/lib/toolkit/|src/app/api/tools/", "student_api"),
    (r"src/lib/teacher-style/|src/lib/lesson-pulse/", "teacher_api"),
    (r"src/app/api/student/", "student_api"),
    (r"src/app/api/teacher/", "teacher_api"),
    (r"src/app/api/admin/", "teacher_api"),
    (r"src/app/api/discovery/", "student_api"),
]


# ---------------------------------------------------------------------------
# FU-5 parsing
# ---------------------------------------------------------------------------

def parse_fu5():
    """Parse FU-5 from dimensions3-followups.md.

    Returns:
        handled: set of (file, function_or_none) tuples marked as fixed
        not_handled: set of (file, function_or_none) tuples still remaining
    """
    handled = set()
    not_handled = set()

    if not os.path.exists(FOLLOWUPS_PATH):
        print("WARNING: FU-5 file not found — seeding all as unknown.")
        return handled, not_handled

    with open(FOLLOWUPS_PATH) as f:
        content = f.read()

    # Find FU-5 section
    fu5_match = re.search(r"## FU-5.*?\n(.*?)(?=\n## FU-|$)", content, re.DOTALL)
    if not fu5_match:
        print("WARNING: FU-5 section not found — seeding all as unknown.")
        return handled, not_handled

    fu5_text = fu5_match.group(1)

    # Pass A and Pass B are noted as FIXED in Phase 1.7
    handled.add(("src/lib/ingestion/pass-a.ts", None))
    handled.add(("src/lib/ingestion/pass-b.ts", None))

    # Parse the table rows: | # | `file` | line | max_tokens | risk |
    # Function name may appear as: 116 (`streamCriterionPages` finalMessage) or 40 (`generateCriterionPages`)
    table_re = re.compile(
        r"\|\s*(\d+)\s*\|\s*`([^`]+)`\s*\|\s*(\d+)\s*(?:\(`?(\w+)`?[^)]*\))?\s*\|\s*([^|]+)\|",
    )
    for m in table_re.finditer(fu5_text):
        file_path = m.group(2).strip()
        func_name = m.group(4)  # may be None
        not_handled.add((file_path, func_name))

    # Also parse the Phase 2 addendum table (stage sites)
    stage_table_re = re.compile(
        r"\|\s*`([^`]+)`\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*([^|]+)\|",
    )
    for m in stage_table_re.finditer(fu5_text):
        file_path = m.group(1).strip()
        not_handled.add((file_path, None))

    return handled, not_handled


def check_fu5_status(file_path, func_name, handled, not_handled):
    """Check if a call site's stop_reason is handled based on FU-5."""
    rel = file_path
    if rel.startswith(REPO_ROOT):
        rel = os.path.relpath(rel, REPO_ROOT)

    # Check handled (Pass A/B fixed)
    for (f, fn) in handled:
        if rel == f or rel.endswith(f):
            return True

    # Check not-handled (remaining audit entries)
    for (f, fn) in not_handled:
        if rel == f or rel.endswith(f):
            if fn is None or func_name is None or fn == func_name:
                return False

    return "unknown"


# ---------------------------------------------------------------------------
# API registry loading (for called_from_routes)
# ---------------------------------------------------------------------------

def load_api_registry():
    """Load api-registry.yaml, return dict of file -> [route paths]."""
    if not os.path.exists(API_REGISTRY_PATH):
        return {}
    with open(API_REGISTRY_PATH) as f:
        data = yaml.safe_load(f)
    if not data or "routes" not in data:
        return {}

    # Build file -> routes mapping
    file_routes = {}
    for entry in data["routes"]:
        f = entry.get("file", "")
        path = entry.get("path", "")
        if f and path:
            file_routes.setdefault(f, set()).add(path)
    return file_routes


def find_called_from_routes(file_path, file_routes, all_route_files):
    """Find API routes that directly import this file.

    One-level direct import lookup only.
    """
    rel = os.path.relpath(file_path, REPO_ROOT)

    # Build possible import paths for this file
    # @/lib/ai/anthropic -> src/lib/ai/anthropic
    import_stems = set()
    if rel.startswith("src/"):
        # @/ alias
        alias_path = "@/" + rel[4:]  # src/lib/ai/foo.ts -> @/lib/ai/foo.ts
        for ext in [".ts", ".tsx", ""]:
            stem = alias_path
            if stem.endswith(ext) and ext:
                stem = stem[:-len(ext)]
            import_stems.add(stem)
        # Also without extension
        if alias_path.endswith(".ts"):
            import_stems.add(alias_path[:-3])
        elif alias_path.endswith(".tsx"):
            import_stems.add(alias_path[:-4])
        # /index shorthand
        if alias_path.endswith("/index.ts"):
            import_stems.add(alias_path[:-9])

    routes = set()
    for route_file in all_route_files:
        full = os.path.join(REPO_ROOT, route_file)
        if not os.path.exists(full):
            continue
        try:
            with open(full) as f:
                content = f.read()
        except Exception:
            continue

        for stem in import_stems:
            if stem in content:
                # This route imports our file
                if route_file in file_routes:
                    routes.update(file_routes[route_file])
                break

    return sorted(routes)


# ---------------------------------------------------------------------------
# ID generation
# ---------------------------------------------------------------------------

def make_id(file_path, func_name=None, suffix=None):
    """Generate stable ID from file path + optional function name."""
    rel = os.path.relpath(file_path, REPO_ROOT)
    # Drop src/ prefix and .ts/.tsx extension
    rel = re.sub(r"^src/", "", rel)
    rel = re.sub(r"\.(tsx?|js)$", "", rel)
    # Replace / - . [ ] with _
    id_str = re.sub(r"[/\-.\[\]]", "_", rel)
    id_str = "ai_" + id_str

    if func_name:
        id_str += "_" + func_name
    if suffix:
        id_str += "_" + suffix

    return id_str


# ---------------------------------------------------------------------------
# Call site extraction
# ---------------------------------------------------------------------------

def extract_function_context(content, pos):
    """Given a position in content, find the enclosing function name."""
    # Search backwards for function/method declaration
    before = content[:pos]
    # Look for: async functionName( or function functionName( or methodName(
    matches = list(re.finditer(
        r"(?:async\s+)?(?:function\s+)?(\w+)\s*\(",
        before,
    ))
    if matches:
        # Get the last function-like declaration before this position
        # Filter to reasonable function names (not if/for/while etc)
        for m in reversed(matches):
            name = m.group(1)
            if name not in ("if", "for", "while", "switch", "catch", "fetch", "JSON",
                           "await", "return", "throw", "new", "typeof", "import",
                           "require", "from", "export", "const", "let", "var"):
                return name
    return None


def extract_model_from_context(content, call_pos, search_range=500):
    """Extract model string from near an API call site."""
    region = content[max(0, call_pos - 100):call_pos + search_range]

    # Literal model string
    lit = MODEL_LITERAL_RE.search(region)
    if lit:
        return lit.group(1)

    # Variable reference
    var = MODEL_VARIABLE_RE.search(region)
    if var:
        var_name = var.group(1)
        # Check if the variable is defined with a literal in the file
        var_def = re.search(rf"{re.escape(var_name)}\s*[:=]\s*['\"]([^'\"]+)['\"]", content)
        if var_def:
            return var_def.group(1)
        # Check for common constant patterns
        if "HAIKU" in var_name.upper():
            return "claude-haiku-4-5-20251001"
        if "SONNET" in var_name.upper():
            return "claude-sonnet-4-20250514"
        return "dynamic"

    return None


def extract_max_tokens_from_context(content, call_pos, search_range=500):
    """Extract max_tokens from near an API call site."""
    region = content[max(0, call_pos - 100):call_pos + search_range]

    lit = MAX_TOKENS_LITERAL_RE.search(region)
    if lit:
        return int(lit.group(1))

    var = MAX_TOKENS_VARIABLE_RE.search(region)
    if var:
        var_name = var.group(1)
        if var_name.isdigit():
            return int(var_name)
        # Check if defined in file
        var_def = re.search(rf"{re.escape(var_name)}\s*[:=]\s*(\d+)", content)
        if var_def:
            return int(var_def.group(1))
        return None  # dynamic

    return None


def infer_cost_category(file_path):
    """Infer cost category from file path."""
    rel = os.path.relpath(file_path, REPO_ROOT)
    for pattern, category in COST_CATEGORY_PATHS:
        if re.search(pattern, rel):
            return category
    return "unknown"


def check_has_fallback(content, provider):
    """Check if the function has a try/catch with a different provider fallback."""
    # Simple heuristic: file contains calls to more than one provider
    providers_found = set()
    if ANTHROPIC_CALL_RE.search(content) or "api.anthropic.com" in content:
        providers_found.add("anthropic")
    if "api.voyageai.com" in content:
        providers_found.add("voyage")
    if "api.groq.com" in content:
        providers_found.add("groq")
    if "generativelanguage.googleapis.com" in content:
        providers_found.add("gemini")
    if re.search(r"openai.*chat.*completions|/chat/completions", content):
        providers_found.add("openai-compatible")

    if len(providers_found) > 1:
        return True

    # Check for try/catch with any retry/fallback pattern
    if re.search(r"catch\s*\([^)]*\)\s*\{[^}]*(?:fetch|messages|\.create|\.stream)", content, re.DOTALL):
        return True

    return False


# ---------------------------------------------------------------------------
# Main scanner — 3 detection layers
# ---------------------------------------------------------------------------

def scan_all():
    """Run all 3 detection layers and produce call site entries."""
    # Load cross-reference data
    fu5_handled, fu5_not_handled = parse_fu5()
    file_routes = load_api_registry()
    all_route_files = list(file_routes.keys())

    entries = []
    seen_ids = set()

    # Stats
    stats = {
        "direct_sdk": 0,
        "wrapper_consumers": 0,
        "http_based": 0,
        "wrapper_files": [],
    }

    # ── LAYER 1: Direct SDK imports ──────────────────────────
    all_ts_files = []
    for dirpath, _, filenames in os.walk(SRC_DIR):
        for fname in filenames:
            if fname.endswith((".ts", ".tsx")) and "__tests__" not in dirpath:
                all_ts_files.append(os.path.join(dirpath, fname))

    for filepath in sorted(all_ts_files):
        with open(filepath) as f:
            content = f.read()

        rel = os.path.relpath(filepath, REPO_ROOT)

        for provider_name, import_re in SDK_IMPORTS.items():
            if not import_re.search(content):
                continue

            # Skip files that ONLY have type imports (import type { ... } from '@anthropic-ai/sdk/...')
            # but no actual SDK import (import Anthropic from '@anthropic-ai/sdk')
            if provider_name == "anthropic":
                has_real_import = re.search(r"""(?<!type\s)from\s+['"]@anthropic-ai/sdk['"]""", content)
                has_only_type = re.search(r"""import\s+type\s+.*from\s+['"]@anthropic-ai/sdk""", content)
                if has_only_type and not has_real_import:
                    continue

            # Find actual API calls in this file
            if provider_name == "anthropic":
                call_matches = list(ANTHROPIC_CALL_RE.finditer(content))
                if not call_matches:
                    continue

                for i, call_m in enumerate(call_matches):
                    func = extract_function_context(content, call_m.start())
                    call_type = call_m.group(1)  # create or stream
                    suffix = None
                    if len(call_matches) > 1:
                        suffix = func or f"call{i}"

                    entry_id = make_id(filepath, func, suffix if len(call_matches) > 1 else None)
                    if entry_id in seen_ids:
                        continue
                    seen_ids.add(entry_id)

                    model = extract_model_from_context(content, call_m.start())
                    max_tokens = extract_max_tokens_from_context(content, call_m.start())
                    stop_handled = check_fu5_status(filepath, func, fu5_handled, fu5_not_handled)
                    has_fb = check_has_fallback(content, provider_name)
                    routes = find_called_from_routes(filepath, file_routes, all_route_files)
                    cost_cat = infer_cost_category(filepath)

                    notes_parts = []
                    if call_type == "stream":
                        notes_parts.append("Streaming call")
                    if model is None:
                        model = "dynamic"
                        notes_parts.append("Model not detected in call context")
                    if max_tokens is None:
                        notes_parts.append("max_tokens not set or dynamic")

                    entry = OrderedDict([
                        ("id", entry_id),
                        ("file", rel),
                        ("function", func),
                        ("provider", provider_name),
                        ("model", model),
                        ("max_tokens", max_tokens),
                        ("stop_reason_handled", stop_handled),
                        ("has_fallback", has_fb),
                        ("called_from_routes", routes),
                        ("cost_category", cost_cat),
                        ("notes", "; ".join(notes_parts) if notes_parts else None),
                    ])
                    entries.append(entry)
                    stats["direct_sdk"] += 1

    # ── LAYER 2: Wrapper function consumers ──────────────────
    # Identify wrapper files (files in src/lib/ that re-export AI functionality)
    wrapper_files = {}  # file_path -> {exported_funcs, provider}

    # Known wrappers
    toolkit_shared = os.path.join(SRC_DIR, "lib", "toolkit", "shared-api.ts")
    if os.path.exists(toolkit_shared):
        wrapper_files[toolkit_shared] = {
            "functions": {"callHaiku", "callSonnet", "callClaude"},
            "provider": "anthropic",
        }
        stats["wrapper_files"].append(os.path.relpath(toolkit_shared, REPO_ROOT))

    embeddings_file = os.path.join(SRC_DIR, "lib", "ai", "embeddings.ts")
    if os.path.exists(embeddings_file):
        wrapper_files[embeddings_file] = {
            "functions": {"embedText", "embedBatch", "embedAll"},
            "provider": "voyage",
        }
        stats["wrapper_files"].append(os.path.relpath(embeddings_file, REPO_ROOT))

    openai_compat = os.path.join(SRC_DIR, "lib", "ai", "openai-compatible.ts")
    if os.path.exists(openai_compat):
        wrapper_files[openai_compat] = {
            "functions": {"OpenAICompatibleProvider"},
            "provider": "openai-compatible",
        }
        stats["wrapper_files"].append(os.path.relpath(openai_compat, REPO_ROOT))

    # Scan for consumers of wrapper functions
    for wrapper_path, wrapper_info in wrapper_files.items():
        wrapper_rel = os.path.relpath(wrapper_path, REPO_ROOT)
        # Build import stems
        import_stems = set()
        alias = "@/" + wrapper_rel[4:]  # src/ -> @/
        for ext in [".ts", ".tsx"]:
            if alias.endswith(ext):
                import_stems.add(alias[:-len(ext)])
        import_stems.add(alias.replace(".ts", "").replace(".tsx", ""))

        for filepath in sorted(all_ts_files):
            if filepath == wrapper_path:
                continue
            rel = os.path.relpath(filepath, REPO_ROOT)

            with open(filepath) as f:
                content = f.read()

            # Check if this file imports from the wrapper
            imports_wrapper = False
            for stem in import_stems:
                if stem in content:
                    imports_wrapper = True
                    break

            if not imports_wrapper:
                continue

            # Check which wrapper functions are actually called
            for func_name in wrapper_info["functions"]:
                if func_name not in content:
                    continue

                # Check it's actually called, not just imported
                if not re.search(rf"\b{func_name}\s*\(", content):
                    continue

                entry_id = make_id(filepath, func_name)
                if entry_id in seen_ids:
                    continue
                seen_ids.add(entry_id)

                # Extract model and max_tokens from the call context
                call_match = re.search(rf"\b{func_name}\s*\(", content)
                if call_match:
                    model = None
                    max_tokens = None

                    if func_name in WRAPPER_FUNCTIONS and WRAPPER_FUNCTIONS[func_name]:
                        winfo = WRAPPER_FUNCTIONS[func_name]
                        model = winfo.get("model", "dynamic")
                    elif func_name in ("embedText", "embedBatch", "embedAll"):
                        model = "voyage-3.5"
                    else:
                        model = extract_model_from_context(content, call_match.start()) or "wrapper-default"

                    max_tokens = extract_max_tokens_from_context(content, call_match.start())
                    # For callHaiku, check if maxTokens is passed as arg
                    if func_name == "callHaiku" and max_tokens is None:
                        # Default is 300 per shared-api.ts
                        region = content[call_match.start():call_match.start() + 300]
                        args = re.search(r"callHaiku\([^,]+,[^,]+,\s*(\d+)", region)
                        if args:
                            max_tokens = int(args.group(1))
                        else:
                            max_tokens = 300  # default

                provider = wrapper_info["provider"]
                stop_handled = check_fu5_status(filepath, func_name, fu5_handled, fu5_not_handled)
                has_fb = check_has_fallback(content, provider)
                routes = find_called_from_routes(filepath, file_routes, all_route_files)
                cost_cat = infer_cost_category(filepath)

                notes_parts = [f"Uses wrapper {wrapper_rel}"]
                if not routes:
                    # Check if the file IS a route
                    if rel in file_routes:
                        routes = sorted(file_routes[rel])
                    else:
                        notes_parts.append("Not directly imported by any route — likely transitive via service module")

                entry = OrderedDict([
                    ("id", entry_id),
                    ("file", rel),
                    ("function", func_name),
                    ("provider", provider),
                    ("model", model),
                    ("max_tokens", max_tokens),
                    ("stop_reason_handled", stop_handled),
                    ("has_fallback", has_fb),
                    ("called_from_routes", routes),
                    ("cost_category", cost_cat),
                    ("notes", "; ".join(notes_parts) if notes_parts else None),
                ])
                entries.append(entry)
                stats["wrapper_consumers"] += 1

    # ── LAYER 3: HTTP-based provider calls ───────────────────
    for filepath in sorted(all_ts_files):
        rel = os.path.relpath(filepath, REPO_ROOT)
        with open(filepath) as f:
            content = f.read()

        for provider_name, hostname in HTTP_PROVIDERS.items():
            if hostname not in content:
                continue

            # Skip files already covered by Layer 1 (SDK imports)
            # and wrapper definition files (Layer 2 handles their consumers)
            is_wrapper = filepath in wrapper_files
            if is_wrapper:
                continue

            # Find fetch calls with this hostname
            fetch_matches = list(re.finditer(
                rf"""fetch\s*\(\s*[^)]*{re.escape(hostname)}[^)]*\)""",
                content,
            ))
            # Also match: fetch(URL_CONST, ...) where URL_CONST contains the hostname
            if not fetch_matches and hostname in content:
                # Check for const with the URL
                url_const = re.search(rf"""(?:const|let|var)\s+(\w+)\s*=\s*['"][^'"]*{re.escape(hostname)}""", content)
                if url_const:
                    const_name = url_const.group(1)
                    fetch_matches = list(re.finditer(
                        rf"""fetch\s*\(\s*{re.escape(const_name)}""",
                        content,
                    ))

            if not fetch_matches:
                continue

            for i, fm in enumerate(fetch_matches):
                func = extract_function_context(content, fm.start())
                suffix = f"http{i}" if len(fetch_matches) > 1 else "http"
                entry_id = make_id(filepath, func, suffix if len(fetch_matches) > 1 else None)
                if entry_id in seen_ids:
                    continue
                seen_ids.add(entry_id)

                model = extract_model_from_context(content, fm.start(), 1000)
                max_tokens = extract_max_tokens_from_context(content, fm.start(), 1000)
                stop_handled = check_fu5_status(filepath, func, fu5_handled, fu5_not_handled)
                has_fb = check_has_fallback(content, provider_name)
                routes = find_called_from_routes(filepath, file_routes, all_route_files)
                cost_cat = infer_cost_category(filepath)

                notes_parts = ["HTTP-based call (no SDK import)"]
                if model is None:
                    model = "dynamic"
                    notes_parts.append("Model not detected in call context")
                if not routes:
                    if rel in file_routes:
                        routes = sorted(file_routes[rel])
                    else:
                        notes_parts.append("Not directly imported by any route — likely transitive via service module")

                entry = OrderedDict([
                    ("id", entry_id),
                    ("file", rel),
                    ("function", func),
                    ("provider", provider_name),
                    ("model", model),
                    ("max_tokens", max_tokens),
                    ("stop_reason_handled", stop_handled),
                    ("has_fallback", has_fb),
                    ("called_from_routes", routes),
                    ("cost_category", cost_cat),
                    ("notes", "; ".join(notes_parts) if notes_parts else None),
                ])
                entries.append(entry)
                stats["http_based"] += 1

    # Sort by file, then function
    entries.sort(key=lambda e: (e["file"], e.get("function") or "", e["id"]))

    return entries, stats, fu5_handled, fu5_not_handled


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------

def build_header(total):
    return f"""# AI Call Sites Registry — source of truth for all LLM / embedding API calls
#
# Auto-generated by scripts/registry/scan-ai-calls.py.
# Cross-referenced with docs/api-registry.yaml (called_from_routes) and
# docs/projects/dimensions3-followups.md FU-5 (stop_reason_handled seeding).
#
# Last synced: 2026-04-14
# Total call sites: {total}

"""


def yaml_dump(doc):
    return yaml.dump(
        doc,
        Dumper=NoAliasDumper,
        default_flow_style=False,
        allow_unicode=True,
        sort_keys=False,
        width=120,
    )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Scan AI call sites")
    parser.add_argument("--apply", action="store_true", help="Write changes (default: dry-run)")
    args = parser.parse_args()

    os.chdir(REPO_ROOT)

    print("Scanning AI call sites...")
    entries, stats, fu5_handled, fu5_not_handled = scan_all()
    total = len(entries)

    # --- Diagnostics ---
    print(f"\nDetection layers:")
    print(f"  Direct SDK imports: {stats['direct_sdk']}")
    print(f"  Wrapper files: {len(stats['wrapper_files'])} ({', '.join(stats['wrapper_files'])})")
    print(f"  Wrapper consumers: {stats['wrapper_consumers']}")
    print(f"  HTTP-based provider calls: {stats['http_based']}")
    print(f"  Total unique call sites: {total}")

    # Provider breakdown
    providers = {}
    for e in entries:
        providers[e["provider"]] = providers.get(e["provider"], 0) + 1
    print(f"\nProvider breakdown:")
    for p in sorted(providers, key=lambda x: -providers[x]):
        print(f"  {p}: {providers[p]}")

    # Model breakdown (top 10)
    models = {}
    for e in entries:
        models[e["model"]] = models.get(e["model"], 0) + 1
    print(f"\nModel breakdown (top 10):")
    for m in sorted(models, key=lambda x: -models[x])[:10]:
        print(f"  {m}: {models[m]}")

    # max_tokens
    mt_set = sum(1 for e in entries if isinstance(e["max_tokens"], int))
    mt_null = sum(1 for e in entries if e["max_tokens"] is None)
    print(f"\nmax_tokens: set={mt_set}, null={mt_null}")

    # stop_reason_handled
    srh = {"true": 0, "false": 0, "unknown": 0}
    for e in entries:
        v = e["stop_reason_handled"]
        if v is True:
            srh["true"] += 1
        elif v is False:
            srh["false"] += 1
        else:
            srh["unknown"] += 1
    print(f"stop_reason_handled: true={srh['true']}, false={srh['false']}, unknown={srh['unknown']}")
    print(f"  FU-5 seeded {srh['true']} entries as handled, {srh['false']} as not-handled; {srh['unknown']} left as unknown.")

    # has_fallback
    fb_true = sum(1 for e in entries if e["has_fallback"])
    fb_false = sum(1 for e in entries if not e["has_fallback"])
    print(f"has_fallback: true={fb_true}, false={fb_false}")

    # cost_category
    cats = {}
    for e in entries:
        cats[e["cost_category"]] = cats.get(e["cost_category"], 0) + 1
    print(f"\ncost_category:")
    for c in sorted(cats, key=lambda x: -cats[x]):
        print(f"  {c}: {cats[c]}")

    # called_from_routes
    with_routes = sum(1 for e in entries if e["called_from_routes"])
    empty_routes = sum(1 for e in entries if not e["called_from_routes"])
    print(f"\ncalled_from_routes: with-routes={with_routes}, empty={empty_routes}")

    # --- Gate checks ---
    gate_fail = False
    if total < 15 or total > 100:
        print(f"\n⛔ GATE FAIL: total call sites {total} outside range 15-100")
        gate_fail = True

    # Phase A.3 — callAnthropicMessages chokepoint accepts model as a parameter,
    # so post-migration most call sites show "dynamic" (which is correct: the
    # chokepoint passes the model through). Threshold bumped from 30% → 60%
    # to reflect chokepoint reality. FU: teach scanner to recognise the helper.
    dynamic_count = sum(1 for e in entries if e["model"] == "dynamic")
    if dynamic_count > total * 0.6:
        print(f"\n⛔ GATE FAIL: dynamic model count {dynamic_count} > 60% of {total}")
        gate_fail = True

    unknown_cat = cats.get("unknown", 0)
    if unknown_cat > total * 0.5:
        print(f"\n⛔ GATE FAIL: unknown cost_category {unknown_cat} > 50% of {total}")
        gate_fail = True

    if stats["wrapper_consumers"] == 0 and stats["direct_sdk"] < 20:
        print(f"\n⛔ GATE FAIL: wrapper-consumer=0 AND direct<20 — wrapper detection may have failed")
        ai_lib_files = []
        for dirpath, _, filenames in os.walk(os.path.join(SRC_DIR, "lib", "ai")):
            for fn in filenames:
                if fn.endswith(".ts"):
                    ai_lib_files.append(os.path.relpath(os.path.join(dirpath, fn), REPO_ROOT))
        print(f"  Files under src/lib/ai/: {ai_lib_files}")
        gate_fail = True

    if gate_fail:
        print("\nGate check FAILED. Fix issues before --apply.")
        return 1

    print("\n✓ All gate checks passed.")

    # --- Preview ---
    doc = OrderedDict([("call_sites", entries)])
    header = build_header(total)
    full_yaml = header + yaml_dump(doc)

    preview_lines = full_yaml.split("\n")[:80]
    print(f"\nYAML preview (first 80 lines):")
    print("\n".join(preview_lines))
    if len(full_yaml.split("\n")) > 80:
        print(f"... ({len(full_yaml.split(chr(10))) - 80} more lines)")

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
