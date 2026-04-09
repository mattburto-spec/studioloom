#!/usr/bin/env npx tsx
/**
 * Documentation Freshness Checker
 *
 * Reads doc-manifest.yaml and reports:
 * 1. Docs with "unknown" last_verified dates
 * 2. Docs not verified in > 30 days (stale)
 * 3. Docs that don't exist on disk (broken references)
 *
 * Run: npx tsx scripts/check-doc-freshness.ts
 * Fix unknown dates: npx tsx scripts/check-doc-freshness.ts --fix
 *   (sets unknown dates to file's mtime)
 *
 * Exit codes:
 *   0 = all good
 *   1 = issues found
 */

import { readFileSync, writeFileSync, statSync, existsSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "..");
const MANIFEST_PATH = resolve(ROOT, "docs/doc-manifest.yaml");
const STALE_DAYS = 30;
const FIX_MODE = process.argv.includes("--fix");

interface DocEntry {
  path: string;
  title: string;
  last_verified: string;
  lineNumber: number;
}

// Simple YAML parser for our manifest structure (avoids dependency)
function parseManifest(content: string): DocEntry[] {
  const entries: DocEntry[] = [];
  const lines = content.split("\n");
  let current: Partial<DocEntry> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const pathMatch = line.match(/^\s+- path:\s*(.+)/);
    if (pathMatch) {
      if (current.path) entries.push(current as DocEntry);
      current = { path: pathMatch[1].trim().replace(/^["']|["']$/g, ""), lineNumber: i + 1 };
    }
    const titleMatch = line.match(/^\s+title:\s*"?(.+?)"?\s*$/);
    if (titleMatch && current.path) current.title = titleMatch[1];
    const verifiedMatch = line.match(/^\s+last_verified:\s*"?(.+?)"?\s*$/);
    if (verifiedMatch && current.path) current.last_verified = verifiedMatch[1];
  }
  if (current.path) entries.push(current as DocEntry);

  return entries;
}

function daysSince(dateStr: string): number {
  const date = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function getFileMtime(filePath: string): string | null {
  const fullPath = resolve(ROOT, filePath);
  try {
    const stat = statSync(fullPath);
    return stat.mtime.toISOString().split("T")[0];
  } catch {
    return null;
  }
}

// --- Main ---
const content = readFileSync(MANIFEST_PATH, "utf-8");
const entries = parseManifest(content);

const unknown: DocEntry[] = [];
const stale: DocEntry[] = [];
const missing: DocEntry[] = [];
const fixes: Map<string, string> = new Map(); // "unknown" → mtime date

for (const entry of entries) {
  // Check if file exists
  const fullPath = resolve(ROOT, entry.path);
  if (!existsSync(fullPath)) {
    missing.push(entry);
    continue;
  }

  if (entry.last_verified === "unknown") {
    unknown.push(entry);
    if (FIX_MODE) {
      const mtime = getFileMtime(entry.path);
      if (mtime) fixes.set(entry.path, mtime);
    }
  } else {
    const days = daysSince(entry.last_verified);
    if (days > STALE_DAYS) {
      stale.push(entry);
    }
  }
}

console.log(`\n📚 Doc Manifest: ${entries.length} entries\n`);

if (missing.length > 0) {
  console.log(`❌ ${missing.length} broken references (file not found):`);
  missing.forEach((d) => console.log(`   - ${d.path}`));
  console.log();
}

if (unknown.length > 0) {
  console.log(`⚠️  ${unknown.length} docs with unknown verification date:`);
  if (unknown.length <= 10) {
    unknown.forEach((d) => console.log(`   - ${d.path}`));
  } else {
    unknown.slice(0, 5).forEach((d) => console.log(`   - ${d.path}`));
    console.log(`   ... and ${unknown.length - 5} more`);
  }
  if (!FIX_MODE) {
    console.log(`   Run with --fix to auto-set dates from file modification times`);
  }
  console.log();
}

if (stale.length > 0) {
  console.log(`🕐 ${stale.length} docs not verified in >${STALE_DAYS} days:`);
  stale
    .sort((a, b) => daysSince(b.last_verified) - daysSince(a.last_verified))
    .slice(0, 10)
    .forEach((d) => console.log(`   - ${d.path} (${daysSince(d.last_verified)} days ago)`));
  if (stale.length > 10) console.log(`   ... and ${stale.length - 10} more`);
  console.log();
}

// Apply fixes
if (FIX_MODE && fixes.size > 0) {
  let updated = content;
  let fixCount = 0;
  for (const [path, date] of fixes) {
    // Find the block for this path and replace its last_verified
    const pathEscaped = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(
      `(- path:\\s*${pathEscaped}[\\s\\S]*?last_verified:\\s*)"unknown"`,
      "m"
    );
    if (regex.test(updated)) {
      updated = updated.replace(regex, `$1"${date}"`);
      fixCount++;
    }
  }
  writeFileSync(MANIFEST_PATH, updated);
  console.log(`✅ Fixed ${fixCount} unknown dates using file modification times\n`);
}

const hasIssues = missing.length > 0 || unknown.length > 0 || stale.length > 0;
if (!hasIssues) {
  console.log("✅ All documentation is fresh and accounted for\n");
}

process.exit(hasIssues ? 1 : 0);
