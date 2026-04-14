import fs from "fs";
import path from "path";

/**
 * Admin Registries Page — read-only staleness dashboard for governance registries.
 *
 * Server component. Reads YAML/JSON files from disk at request time.
 * No DB calls, no client state.
 *
 * Renders 9 cards (6 registries + 3 taxonomies) with staleness chips:
 *   GREEN  = age < 75% of max_age_days
 *   AMBER  = age >= 75% of max_age_days
 *   RED    = age > max_age_days
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RegistryEntry {
  name: string;
  path: string;
  version: number | null;
  lastVerified: string | null;
  lastScanned: string | null;
  maxAgeDays: number;
  ageDays: number;
  status: "green" | "amber" | "red";
}

interface ScannerReport {
  registry: string;
  timestamp: string;
  status: string;
  drift: { orphaned: string[]; missing: string[] };
}

// ---------------------------------------------------------------------------
// Data loading (server-only, runs at request time)
// ---------------------------------------------------------------------------

const REPO_ROOT = process.cwd();

const REGISTRY_FILES: { path: string; label: string }[] = [
  { path: "docs/schema-registry.yaml", label: "Schema Registry" },
  { path: "docs/api-registry.yaml", label: "API Registry" },
  { path: "docs/ai-call-sites.yaml", label: "AI Call Sites" },
  { path: "docs/feature-flags.yaml", label: "Feature Flags" },
  { path: "docs/vendors.yaml", label: "Vendors" },
  { path: "docs/projects/WIRING.yaml", label: "WIRING" },
  { path: "docs/data-classification-taxonomy.md", label: "Data Classification Taxonomy" },
  { path: "docs/feature-flags-taxonomy.md", label: "Feature Flags Taxonomy" },
  { path: "docs/vendors-taxonomy.md", label: "Vendors Taxonomy" },
];

function daysBetween(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function extractVersion(content: string): number | null {
  const match = content.match(/^version:\s*(\d+)/m);
  return match ? parseInt(match[1], 10) : null;
}

function loadManifestEntry(
  filePath: string
): { lastVerified: string | null; lastScanned: string | null; maxAgeDays: number } {
  const manifestPath = path.join(REPO_ROOT, "docs/doc-manifest.yaml");
  try {
    const content = fs.readFileSync(manifestPath, "utf-8");
    // Simple line-by-line search for the path
    const lines = content.split("\n");
    let found = false;
    let lastVerified: string | null = null;
    let lastScanned: string | null = null;
    let maxAgeDays = 90;

    for (const line of lines) {
      if (line.includes(`path:`) && line.includes(filePath)) {
        found = true;
        continue;
      }
      if (found) {
        if (line.match(/^\s+-\s+path:/)) break; // next entry
        if (line.match(/^#/)) break; // comment section
        const lvMatch = line.match(/last_verified:\s*"?(\d{4}-\d{2}-\d{2})"?/);
        if (lvMatch) lastVerified = lvMatch[1];
        const lsMatch = line.match(/last_scanned:\s*"?(\d{4}-\d{2}-\d{2})"?/);
        if (lsMatch) lastScanned = lsMatch[1];
        const maMatch = line.match(/max_age_days:\s*(\d+)/);
        if (maMatch) maxAgeDays = parseInt(maMatch[1], 10);
      }
    }
    return { lastVerified, lastScanned, maxAgeDays };
  } catch {
    return { lastVerified: null, lastScanned: null, maxAgeDays: 90 };
  }
}

function loadScannerReport(reportName: string): ScannerReport | null {
  const reportPath = path.join(REPO_ROOT, "docs/scanner-reports", reportName);
  try {
    const content = fs.readFileSync(reportPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function buildEntries(): RegistryEntry[] {
  return REGISTRY_FILES.map((rf) => {
    const fullPath = path.join(REPO_ROOT, rf.path);
    let version: number | null = null;
    try {
      const content = fs.readFileSync(fullPath, "utf-8");
      version = extractVersion(content);
    } catch {
      /* file may not exist */
    }

    const manifest = loadManifestEntry(rf.path);
    const ageDays = manifest.lastVerified
      ? daysBetween(manifest.lastVerified)
      : 999;

    let status: "green" | "amber" | "red" = "green";
    if (ageDays > manifest.maxAgeDays) status = "red";
    else if (ageDays >= manifest.maxAgeDays * 0.75) status = "amber";

    return {
      name: rf.label,
      path: rf.path,
      version,
      lastVerified: manifest.lastVerified,
      lastScanned: manifest.lastScanned,
      maxAgeDays: manifest.maxAgeDays,
      ageDays,
      status,
    };
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const STATUS_COLORS = {
  green: { bg: "bg-emerald-50", border: "border-emerald-200", chip: "bg-emerald-500", text: "text-emerald-700" },
  amber: { bg: "bg-amber-50", border: "border-amber-200", chip: "bg-amber-500", text: "text-amber-700" },
  red: { bg: "bg-red-50", border: "border-red-200", chip: "bg-red-500", text: "text-red-700" },
};

export default function AdminRegistriesPage() {
  const entries = buildEntries();
  const flagsReport = loadScannerReport("feature-flags.json");
  const vendorsReport = loadScannerReport("vendors.json");

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Governance Registries</h1>
        <p className="text-sm text-gray-500 mt-1">
          Staleness and drift status for all governance registries and taxonomies.
        </p>
      </div>

      {/* Registry cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {entries.map((entry) => {
          const colors = STATUS_COLORS[entry.status];
          return (
            <div
              key={entry.path}
              className={`rounded-xl border p-4 ${colors.bg} ${colors.border}`}
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-gray-900 text-sm">{entry.name}</h3>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white ${colors.chip}`}
                >
                  {entry.status === "green"
                    ? "OK"
                    : entry.status === "amber"
                    ? "AGING"
                    : "STALE"}
                </span>
              </div>
              <p className="text-xs text-gray-500 font-mono mb-3">{entry.path}</p>
              <div className="space-y-1 text-xs">
                {entry.version !== null && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Version</span>
                    <span className="font-medium text-gray-700">v{entry.version}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Last verified</span>
                  <span className={`font-medium ${colors.text}`}>
                    {entry.lastVerified ?? "never"} ({entry.ageDays}d ago)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Max age</span>
                  <span className="font-medium text-gray-700">{entry.maxAgeDays}d</span>
                </div>
                {entry.lastScanned && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Last scanned</span>
                    <span className="font-medium text-gray-700">{entry.lastScanned}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Scanner drift reports */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Scanner Reports</h2>

        {[
          { label: "Feature Flags", report: flagsReport },
          { label: "Vendors", report: vendorsReport },
        ].map(({ label, report }) => (
          <div
            key={label}
            className="rounded-xl border border-gray-200 bg-white p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900 text-sm">{label} Scanner</h3>
              {report ? (
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white ${
                    report.status === "ok" ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                >
                  {report.status === "ok" ? "NO DRIFT" : "DRIFT"}
                </span>
              ) : (
                <span className="text-xs text-gray-400">No report</span>
              )}
            </div>
            {report ? (
              <div className="text-xs text-gray-600 space-y-1">
                <p>
                  Last run:{" "}
                  {new Date(report.timestamp).toLocaleDateString("en-AU", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                {report.drift.orphaned.length > 0 && (
                  <p className="text-amber-600">
                    Orphaned: {report.drift.orphaned.join(", ")}
                  </p>
                )}
                {report.drift.missing.length > 0 && (
                  <p className="text-red-600">
                    Missing: {report.drift.missing.join(", ")}
                  </p>
                )}
                {report.drift.orphaned.length === 0 &&
                  report.drift.missing.length === 0 && (
                    <p className="text-emerald-600">All entries aligned with code.</p>
                  )}
              </div>
            ) : (
              <p className="text-xs text-gray-400">
                Run <code className="bg-gray-100 px-1 rounded">python3 scripts/registry/scan-{label.toLowerCase().replace(" ", "-")}.py</code> to generate.
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
