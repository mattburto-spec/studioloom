#!/usr/bin/env python3
"""
WIRING.yaml Health Check

Validates the system dependency registry:
1. YAML is valid (parseable)
2. No dangling references (affects/depends_on point to real systems)
3. No orphan systems (everything is connected)

Run: python3 scripts/check-wiring-health.py
Impact trace: python3 scripts/check-wiring-health.py --trace <system-id>
"""

import sys
import os
import yaml

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WIRING_PATH = os.path.join(ROOT, "docs/projects/WIRING.yaml")

# Parse
try:
    with open(WIRING_PATH) as f:
        data = yaml.safe_load(f)
except yaml.YAMLError as e:
    print(f"❌ WIRING.yaml is not valid YAML: {e}")
    sys.exit(2)

systems = {s["id"]: s for s in data["systems"]}
issues = []

# Dangling references
for s in data["systems"]:
    for ref in s.get("affects", []) + s.get("depends_on", []):
        if ref not in systems:
            issues.append(f"DANGLING: {s['id']} references '{ref}' which doesn't exist")

# Orphans
connected = set()
for s in data["systems"]:
    if s.get("affects") or s.get("depends_on"):
        connected.add(s["id"])
orphans = [s for s in data["systems"] if s["id"] not in connected]

# Report
print(f"\n🔌 WIRING.yaml: {len(systems)} systems\n")

if issues:
    print(f"❌ {len(issues)} reference issue(s):")
    for i in issues:
        print(f"   {i}")
    print()

if orphans:
    print(f"🏝️  {len(orphans)} orphan system(s):")
    for o in orphans:
        print(f"   - {o['name']} ({o['id']})")
    print()

# Impact trace mode
if "--trace" in sys.argv:
    target = sys.argv[sys.argv.index("--trace") + 1]
    print(f"\n{'=' * 60}")
    print(f"IMPACT TRACE: {target}")
    print(f"{'=' * 60}\n")

    def trace(sid, depth=0, visited=None):
        if visited is None:
            visited = set()
        if sid in visited or depth > 4:
            return
        visited.add(sid)
        s = systems.get(sid)
        if not s:
            print(f"{'  ' * depth}⚠️  {sid} — NOT FOUND")
            return
        icons = {"complete": "✅", "active": "🔴", "designed": "📐", "planned": "🔵"}
        icon = icons.get(s.get("status", ""), "❓")
        print(f"{'  ' * depth}{icon} {s['name']} ({sid}) — v{s.get('currentVersion', '?')}")
        if s.get("change_impacts") and depth == 0:
            print(f"{'  ' * depth}   ⚡ {str(s['change_impacts'])[:120]}")
        for affected in s.get("affects", []):
            trace(affected, depth + 1, visited)

    trace(target)
    print(f"\nUpstream (depends on {target}):")
    for sid, s in systems.items():
        if target in (s.get("depends_on") or []):
            print(f"  ← {s['name']} ({sid})")

if not issues and not orphans and "--trace" not in sys.argv:
    print("✅ All references valid, no orphans\n")

sys.exit(1 if issues else 0)
