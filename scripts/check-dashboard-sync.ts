#!/usr/bin/env npx tsx
/**
 * Dashboard Sync Checker
 *
 * Compares project names in ALL-PROJECTS.md against the PROJECTS array
 * in dashboard.html. Reports mismatches so they can be fixed.
 *
 * Run: npx tsx scripts/check-dashboard-sync.ts
 *
 * Exit codes:
 *   0 = in sync
 *   1 = drift detected (lists mismatches)
 */

import { readFileSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "..");

// --- Parse ALL-PROJECTS.md ---
function parseMarkdownProjects(content: string): Map<string, string> {
  const projects = new Map<string, string>(); // name → status
  let currentStatus = "";

  const statusMap: Record<string, string> = {
    "active projects": "active",
    "ready to build": "ready",
    "planned": "planned",
    "ideas backlog": "idea",
    "complete": "complete",
    "superseded": "superseded",
  };

  for (const line of content.split("\n")) {
    // Detect section headers
    const headerMatch = line.match(/^##\s+[🔴🟢🔵💡✅⚫🔬]\s+(.+)/u);
    if (headerMatch) {
      const sectionName = headerMatch[1].toLowerCase().replace(/\s*—.*$/, "").trim();
      for (const [key, status] of Object.entries(statusMap)) {
        if (sectionName.includes(key)) {
          currentStatus = status;
          break;
        }
      }
      continue;
    }

    // Detect project entries (### headers)
    const projectMatch = line.match(/^###\s+(.+)/);
    if (projectMatch && currentStatus) {
      let name = projectMatch[1].trim();
      // Skip table rows and non-project headers
      if (name.startsWith("|") || name.includes("High Priority") || name.includes("Medium Priority") || name.includes("Low Priority") || name.includes("Parked")) continue;
      projects.set(name, currentStatus);
      continue;
    }

    // Detect idea table entries
    if (currentStatus === "idea" && line.startsWith("| **")) {
      const ideaMatch = line.match(/\|\s*\*\*(.+?)\*\*/);
      if (ideaMatch) {
        let name = ideaMatch[1].trim();
        if (name.startsWith("~~")) continue; // strikethrough = superseded
        projects.set(name, "idea");
      }
    }
  }

  return projects;
}

// --- Parse dashboard.html PROJECTS array ---
function parseDashboardProjects(content: string): Map<string, string> {
  const projects = new Map<string, string>();

  // Extract the PROJECTS array section
  const startIdx = content.indexOf("const PROJECTS = [");
  const endIdx = content.indexOf("];", startIdx);
  if (startIdx === -1 || endIdx === -1) {
    console.error("Could not find PROJECTS array in dashboard.html");
    process.exit(2);
  }

  const arrayContent = content.slice(startIdx, endIdx + 2);

  // Match each project entry
  const entryRegex = /name:\s*"([^"]+)".*?status:\s*"([^"]+)"/g;
  let match;
  while ((match = entryRegex.exec(arrayContent)) !== null) {
    projects.set(match[1], match[2]);
  }

  return projects;
}

// --- Compare ---
function compare(mdProjects: Map<string, string>, dashProjects: Map<string, string>) {
  const issues: string[] = [];

  // In MD but not in dashboard
  for (const [name, status] of mdProjects) {
    if (!dashProjects.has(name)) {
      // Check for fuzzy match (name might differ slightly)
      const fuzzy = [...dashProjects.keys()].find(
        (d) => d.toLowerCase().includes(name.toLowerCase().slice(0, 20)) ||
               name.toLowerCase().includes(d.toLowerCase().slice(0, 20))
      );
      if (fuzzy) {
        issues.push(`NAME MISMATCH: MD has "${name}" but dashboard has "${fuzzy}"`);
      } else {
        issues.push(`MISSING IN DASHBOARD: "${name}" (${status}) exists in ALL-PROJECTS.md but not in dashboard.html`);
      }
    }
  }

  // In dashboard but not in MD
  for (const [name, status] of dashProjects) {
    if (!mdProjects.has(name)) {
      const fuzzy = [...mdProjects.keys()].find(
        (m) => m.toLowerCase().includes(name.toLowerCase().slice(0, 20)) ||
               name.toLowerCase().includes(m.toLowerCase().slice(0, 20))
      );
      if (!fuzzy) {
        issues.push(`MISSING IN MD: "${name}" (${status}) exists in dashboard.html but not in ALL-PROJECTS.md`);
      }
    }
  }

  // Status mismatches
  for (const [name, mdStatus] of mdProjects) {
    const dashStatus = dashProjects.get(name);
    if (dashStatus && dashStatus !== mdStatus) {
      issues.push(`STATUS MISMATCH: "${name}" is "${mdStatus}" in MD but "${dashStatus}" in dashboard`);
    }
  }

  return issues;
}

// --- Main ---
const mdContent = readFileSync(resolve(ROOT, "docs/projects/ALL-PROJECTS.md"), "utf-8");
const dashContent = readFileSync(resolve(ROOT, "docs/projects/dashboard.html"), "utf-8");

const mdProjects = parseMarkdownProjects(mdContent);
const dashProjects = parseDashboardProjects(dashContent);

console.log(`\n📋 ALL-PROJECTS.md: ${mdProjects.size} projects`);
console.log(`📊 dashboard.html:  ${dashProjects.size} projects\n`);

const issues = compare(mdProjects, dashProjects);

if (issues.length === 0) {
  console.log("✅ Dashboard is in sync with ALL-PROJECTS.md\n");
  process.exit(0);
} else {
  console.log(`⚠️  ${issues.length} sync issue(s) found:\n`);
  issues.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`));
  console.log("\nFix these before running saveme, or run saveme to auto-sync.\n");
  process.exit(1);
}
