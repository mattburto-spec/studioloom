"use client";

/**
 * /admin/ingestion-sandbox — Phase 1.4 (Dimensions3 Completion Spec §3.4)
 *
 * Admin-only sandbox UI for running ingestion on a single document, panel
 * by panel, with per-stage rerun, cost meter, and a review queue before
 * committing blocks to `activity_blocks`.
 *
 * State is held entirely client-side; each stage is a stateless POST to
 * /api/admin/ingestion-sandbox/run-stage with the previous stage's output
 * as `input`. Upload is a separate call; Commit is the final step.
 */

import { useCallback, useMemo, useState } from "react";
import type {
  DedupResult,
  ParseResult,
  IngestionClassification,
  IngestionAnalysis,
  ExtractionResult,
  ExtractedBlock,
  ModeratedBlock,
  ModerationStageResult,
  ModerationStatus,
  ModerationFlag,
} from "@/lib/ingestion/types";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type StageId = "dedup" | "parse" | "passA" | "passB" | "extract" | "moderate";

type StageStatus = "idle" | "running" | "done" | "error";

interface StageState<T = unknown> {
  status: StageStatus;
  output?: T;
  error?: string;
  durationMs?: number;
}

interface UploadState {
  contentItemId: string | null;
  existingContentItemId: string | null;
  isDuplicate: boolean;
  title: string;
  fileHash: string;
  rawText: string;
  sizeBytes: number;
  rawTextLength: number;
}

interface SandboxState {
  upload: UploadState | null;
  dedup: StageState<DedupResult>;
  parse: StageState<ParseResult>;
  passA: StageState<IngestionClassification>;
  passB: StageState<IngestionAnalysis>;
  extract: StageState<ExtractionResult>;
  moderate: StageState<ModerationStageResult>;
  candidates: AcceptedCandidate[];
  rejected: Set<string>;
  copyrightFlag: "own" | "copyrighted" | "creative_commons" | "unknown";
}

interface AcceptedCandidate {
  tempId: string;
  title: string;
  description?: string;
  prompt: string;
  bloom_level?: string;
  time_weight?: string;
  grouping?: string;
  phase?: string;
  activity_category?: string;
  materials?: string[];
  scaffolding_notes?: string;
  udl_hints?: string[];
  teaching_approach?: string;
  piiFlags?: unknown[];
  moderationStatus?: ModerationStatus;
  moderationFlags?: ModerationFlag[];
  accepted: boolean;
  edited: boolean;
}

function emptyStage<T>(): StageState<T> {
  return { status: "idle" };
}

const initialState: SandboxState = {
  upload: null,
  dedup: emptyStage<DedupResult>(),
  parse: emptyStage<ParseResult>(),
  passA: emptyStage<IngestionClassification>(),
  passB: emptyStage<IngestionAnalysis>(),
  extract: emptyStage<ExtractionResult>(),
  moderate: emptyStage<ModerationStageResult>(),
  candidates: [],
  rejected: new Set(),
  copyrightFlag: "unknown",
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function costFromStage(s: StageState<unknown>): number {
  const c = (s.output as { cost?: { estimatedCostUSD?: number } } | undefined)?.cost
    ?.estimatedCostUSD;
  return typeof c === "number" ? c : 0;
}

function formatUSD(n: number): string {
  return `$${n.toFixed(4)}`;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// -----------------------------------------------------------------------------
// Page Component
// -----------------------------------------------------------------------------

export default function IngestionSandboxPage() {
  const [state, setState] = useState<SandboxState>(initialState);
  const [isUploading, setIsUploading] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<{
    inserted: { id: string; title: string }[];
    failed: { title: string; error: string }[];
  } | null>(null);

  const totalCost =
    costFromStage(state.dedup) +
    costFromStage(state.parse) +
    costFromStage(state.passA) +
    costFromStage(state.passB) +
    costFromStage(state.extract) +
    costFromStage(state.moderate);

  const acceptedCount = useMemo(
    () => state.candidates.filter((c) => c.accepted).length,
    [state.candidates]
  );

  // ---------------------------------------------------------------------------
  // Upload
  // ---------------------------------------------------------------------------

  const handleUpload = useCallback(
    async (file: File) => {
      setIsUploading(true);
      setCommitResult(null);
      try {
        const form = new FormData();
        form.append("file", file);
        form.append("copyrightFlag", state.copyrightFlag);
        const res = await fetch("/api/admin/ingestion-sandbox/upload", {
          method: "POST",
          body: form,
        });
        const data = await res.json();
        if (!res.ok) {
          alert(`Upload failed: ${data.error || "unknown"}${data.message ? `\n\nDetail: ${data.message}` : ""}`);
          return;
        }
        setState({
          ...initialState,
          copyrightFlag: state.copyrightFlag,
          upload: {
            contentItemId: data.contentItemId,
            existingContentItemId: data.existingContentItemId,
            isDuplicate: data.isDuplicate,
            title: data.title,
            fileHash: data.fileHash,
            rawText: data.rawText,
            sizeBytes: data.sizeBytes,
            rawTextLength: data.rawTextLength,
          },
        });
      } catch (e) {
        alert(`Upload error: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsUploading(false);
      }
    },
    [state.copyrightFlag]
  );

  // ---------------------------------------------------------------------------
  // Run stage
  // ---------------------------------------------------------------------------

  const runStage = useCallback(
    async (stage: StageId, prevOutput?: unknown) => {
      if (!state.upload) {
        alert("Upload a document first");
        return;
      }

      // Resolve input: use prevOutput if provided (from runAll chain),
      // otherwise read from state (manual single-stage run).
      let input: unknown;
      switch (stage) {
        case "dedup":
        case "parse":
          input = state.upload.rawText;
          break;
        case "passA":
          input = prevOutput ?? state.parse.output;
          if (!input) { alert("Run Parse first"); return; }
          break;
        case "passB":
          input = prevOutput ?? state.passA.output;
          if (!input) { alert("Run Pass A first"); return; }
          break;
        case "extract":
          input = prevOutput ?? state.passB.output;
          if (!input) { alert("Run Pass B first"); return; }
          break;
        case "moderate":
          input = prevOutput ?? state.extract.output;
          if (!input) { alert("Run Extract first"); return; }
          break;
      }

      setState((s) => ({ ...s, [stage]: { status: "running" } }));
      try {
        const res = await fetch("/api/admin/ingestion-sandbox/run-stage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stage,
            input,
            copyrightFlag: state.copyrightFlag,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setState((s) => ({
            ...s,
            [stage]: {
              status: "error",
              error: data.error || "unknown",
              durationMs: data.durationMs,
            },
          }));
          return undefined;
        }
        const output = data.output;
        setState((s) => {
          const next: SandboxState = {
            ...s,
            [stage]: {
              status: "done",
              output: data.output,
              durationMs: data.durationMs,
            },
          };
          // Populate candidates when extract finishes
          if (stage === "extract") {
            const blocks: ExtractedBlock[] =
              (data.output as ExtractionResult)?.blocks || [];
            next.candidates = blocks.map((b) => ({
              tempId: b.tempId,
              title: b.title,
              description: b.description,
              prompt: b.prompt,
              bloom_level: b.bloom_level,
              time_weight: b.time_weight,
              grouping: b.grouping,
              phase: b.phase,
              activity_category: b.activity_category,
              materials: b.materials,
              scaffolding_notes: b.scaffolding_notes,
              udl_hints: b.udl_hints,
              teaching_approach: b.teaching_approach,
              piiFlags: b.piiFlags,
              moderationStatus: "pending",
              moderationFlags: [],
              accepted: true,
              edited: false,
            }));
            next.rejected = new Set();
          }
          // Merge moderation results onto existing candidates
          if (stage === "moderate") {
            const mod = data.output as ModerationStageResult;
            const byTempId = new Map<string, ModeratedBlock>(
              (mod?.blocks || []).map((b) => [b.tempId, b])
            );
            next.candidates = s.candidates.map((c) => {
              const m = byTempId.get(c.tempId);
              if (!m) return c;
              return {
                ...c,
                moderationStatus: m.moderationStatus,
                moderationFlags: m.moderationFlags,
              };
            });
          }
          return next;
        });
        return output;
      } catch (e) {
        setState((s) => ({
          ...s,
          [stage]: {
            status: "error",
            error: e instanceof Error ? e.message : String(e),
          },
        }));
        return undefined;
      }
    },
    [state]
  );

  const runAll = useCallback(async () => {
    const dedupOut = await runStage("dedup");
    const parseOut = await runStage("parse");
    if (!parseOut) return;
    const passAOut = await runStage("passA", parseOut);
    if (!passAOut) return;
    const passBOut = await runStage("passB", passAOut);
    if (!passBOut) return;
    const extractOut = await runStage("extract", passBOut);
    if (!extractOut) return;
    await runStage("moderate", extractOut);
  }, [runStage]);

  // ---------------------------------------------------------------------------
  // Commit
  // ---------------------------------------------------------------------------

  const handleCommit = useCallback(async () => {
    if (!state.upload) return;
    const accepted = state.candidates.filter((c) => c.accepted);
    if (accepted.length === 0) {
      alert("Nothing to commit — accept at least one candidate");
      return;
    }
    if (!confirm(`Commit ${accepted.length} block(s) to activity_blocks?`)) return;
    setIsCommitting(true);
    try {
      const res = await fetch("/api/admin/ingestion-sandbox/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentItemId: state.upload.contentItemId,
          copyrightFlag: state.copyrightFlag,
          candidates: accepted.map((c) => ({
            title: c.title,
            description: c.description,
            prompt: c.prompt,
            bloom_level: c.bloom_level,
            time_weight: c.time_weight,
            grouping: c.grouping,
            phase: c.phase,
            activity_category: c.activity_category,
            materials: c.materials,
            scaffolding_notes: c.scaffolding_notes,
            udl_hints: c.udl_hints,
            teaching_approach: c.teaching_approach,
            piiFlags: c.piiFlags,
            moderationStatus: c.moderationStatus,
            moderationFlags: c.moderationFlags,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`Commit failed: ${data.error || "unknown"}`);
        return;
      }
      setCommitResult({ inserted: data.inserted, failed: data.failed });
    } catch (e) {
      alert(`Commit error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsCommitting(false);
    }
  }, [state]);

  const reset = () => {
    setState(initialState);
    setCommitResult(null);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Ingestion Sandbox</h1>
          <p className="text-sm text-text-secondary mt-1">
            Upload → Dedup → Parse → Classify → Enrich → Extract → Review → Commit
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wider text-text-secondary font-semibold">
            Total cost
          </div>
          <div className="text-xl font-bold text-brand-purple">{formatUSD(totalCost)}</div>
        </div>
      </header>

      {/* Upload */}
      <section className="rounded-xl border bg-white p-5">
        <h2 className="text-sm font-semibold text-text-primary mb-3">1. Upload document</h2>

        {/* Drop zone + file picker */}
        <div
          className="relative border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer hover:border-purple-400 hover:bg-purple-50/30"
          style={{ borderColor: isUploading ? "#9CA3AF" : "#D1D5DB" }}
          onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "#7B2FF2"; e.currentTarget.style.background = "rgba(123,47,242,0.04)"; }}
          onDragLeave={(e) => { e.currentTarget.style.borderColor = "#D1D5DB"; e.currentTarget.style.background = ""; }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.style.borderColor = "#D1D5DB";
            e.currentTarget.style.background = "";
            const f = e.dataTransfer.files?.[0];
            if (f) handleUpload(f);
          }}
          onClick={() => {
            const input = document.getElementById("sandbox-file-input") as HTMLInputElement;
            input?.click();
          }}
        >
          <input
            id="sandbox-file-input"
            type="file"
            accept=".pdf,.docx,.pptx,.txt,.md"
            disabled={isUploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
            }}
            className="hidden"
          />
          <div className="text-3xl mb-2">
            {isUploading ? (
              <div className="w-8 h-8 mx-auto border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <span>+</span>
            )}
          </div>
          <p className="text-sm font-medium text-gray-700">
            {isUploading ? "Uploading..." : "Click to choose a file or drag & drop"}
          </p>
          <p className="text-xs text-gray-400 mt-1">PDF, DOCX, PPTX, TXT, MD</p>
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-4 flex-wrap mt-3">
          <label className="text-xs text-text-secondary flex items-center gap-2">
            Copyright flag:
            <select
              value={state.copyrightFlag}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  copyrightFlag: e.target.value as SandboxState["copyrightFlag"],
                }))
              }
              className="border rounded px-2 py-1 text-xs"
            >
              <option value="unknown">unknown</option>
              <option value="own">own</option>
              <option value="copyrighted">copyrighted</option>
              <option value="creative_commons">creative_commons</option>
            </select>
          </label>
          <button
            onClick={reset}
            className="ml-auto text-xs text-text-secondary hover:text-text-primary underline"
          >
            Reset
          </button>
        </div>

        {state.upload && (
          <div className="mt-4 text-xs space-y-1 bg-surface-alt rounded-lg p-3">
            <div>
              <span className="font-semibold">Title:</span> {state.upload.title}
            </div>
            <div>
              <span className="font-semibold">File hash:</span>{" "}
              <code className="font-mono">{state.upload.fileHash.slice(0, 16)}…</code>
            </div>
            <div>
              <span className="font-semibold">Size:</span> {formatBytes(state.upload.sizeBytes)} ·{" "}
              {state.upload.rawTextLength.toLocaleString()} chars extracted
            </div>
            {state.upload.isDuplicate && (
              <div className="text-amber-700 font-semibold">
                ⚠ Duplicate of content_item {state.upload.existingContentItemId?.slice(0, 8)}…
              </div>
            )}
          </div>
        )}
      </section>

      {/* Run controls */}
      <section className="flex items-center gap-2 flex-wrap">
        <button
          onClick={runAll}
          disabled={!state.upload}
          className="px-4 py-2 rounded-lg bg-brand-purple text-white text-sm font-semibold disabled:opacity-40 hover:bg-purple-700"
        >
          Run Full Pipeline
        </button>
      </section>

      {/* Near-duplicate warning (soft dedup) */}
      {state.dedup.status === "done" &&
        state.dedup.output &&
        (state.dedup.output as DedupResult).nearDuplicateScore != null && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            <span className="font-semibold">⚠ Near-duplicate detected:</span>{" "}
            cosine{" "}
            {(state.dedup.output as DedupResult).nearDuplicateScore!.toFixed(3)}{" "}
            vs existing block{" "}
            <code className="font-mono">
              {(state.dedup.output as DedupResult).nearDuplicateBlockId?.slice(0, 8)}
            </code>{" "}
            — &ldquo;{(state.dedup.output as DedupResult).nearDuplicateBlockTitle}
            &rdquo;. Pipeline will still run; review carefully before commit.
          </div>
        )}

      {/* Stage panels */}
      <section className="space-y-3">
        <StagePanel
          id="dedup"
          label="I-0. Dedup"
          state={state.dedup}
          disabled={!state.upload}
          onRun={() => runStage("dedup")}
        />
        <StagePanel
          id="parse"
          label="I-1. Parse (deterministic)"
          state={state.parse}
          disabled={!state.upload}
          onRun={() => runStage("parse")}
        />
        <StagePanel
          id="passA"
          label="I-2. Pass A — Classify + Tag"
          state={state.passA}
          disabled={state.parse.status !== "done"}
          onRun={() => runStage("passA")}
        />
        <StagePanel
          id="passB"
          label="I-3. Pass B — Analyse + Enrich"
          state={state.passB}
          disabled={state.passA.status !== "done"}
          onRun={() => runStage("passB")}
        />
        <StagePanel
          id="extract"
          label="I-4. Extract blocks"
          state={state.extract}
          disabled={state.passB.status !== "done"}
          onRun={() => runStage("extract")}
        />
        <StagePanel
          id="moderate"
          label="I-5. Moderate (Haiku)"
          state={state.moderate}
          disabled={state.extract.status !== "done"}
          onRun={() => runStage("moderate")}
        />
      </section>

      {/* Review queue */}
      {state.candidates.length > 0 && (
        <section className="rounded-xl border bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-text-primary">
              Review candidates ({acceptedCount} of {state.candidates.length} accepted)
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  setState((s) => ({
                    ...s,
                    candidates: s.candidates.map((c) => ({ ...c, accepted: true })),
                  }))
                }
                className="text-xs text-text-secondary hover:text-text-primary underline"
              >
                Accept all
              </button>
              <button
                onClick={() =>
                  setState((s) => ({
                    ...s,
                    candidates: s.candidates.map((c) => ({ ...c, accepted: false })),
                  }))
                }
                className="text-xs text-text-secondary hover:text-text-primary underline"
              >
                Reject all
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {state.candidates.map((c, i) => (
              <CandidateCard
                key={c.tempId}
                candidate={c}
                onToggle={() =>
                  setState((s) => ({
                    ...s,
                    candidates: s.candidates.map((x, j) =>
                      j === i ? { ...x, accepted: !x.accepted } : x
                    ),
                  }))
                }
                onEdit={(patch) =>
                  setState((s) => ({
                    ...s,
                    candidates: s.candidates.map((x, j) =>
                      j === i ? { ...x, ...patch, edited: true } : x
                    ),
                  }))
                }
              />
            ))}
          </div>

          {/* Commit bar */}
          <div className="mt-5 pt-4 border-t flex items-center justify-between">
            <div className="text-xs text-text-secondary">
              {acceptedCount} block{acceptedCount === 1 ? "" : "s"} will be inserted into
              <code className="mx-1 font-mono">activity_blocks</code>
              with <code className="font-mono">source_type=extracted</code>
            </div>
            <button
              onClick={handleCommit}
              disabled={acceptedCount === 0 || isCommitting}
              className="px-5 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold disabled:opacity-40 hover:bg-green-700"
            >
              {isCommitting ? "Committing…" : `Commit ${acceptedCount} block(s)`}
            </button>
          </div>
        </section>
      )}

      {/* Commit result */}
      {commitResult && (
        <section className="rounded-xl border bg-white p-5">
          <h2 className="text-sm font-semibold text-text-primary mb-3">Commit result</h2>
          <div className="text-xs space-y-2">
            <div className="text-green-700 font-semibold">
              ✓ Inserted {commitResult.inserted.length}
            </div>
            <ul className="ml-4 space-y-1">
              {commitResult.inserted.map((r) => (
                <li key={r.id}>
                  <code className="font-mono text-[10px]">{r.id.slice(0, 8)}</code> — {r.title}
                </li>
              ))}
            </ul>
            {commitResult.failed.length > 0 && (
              <>
                <div className="text-red-700 font-semibold mt-3">
                  ✗ Failed {commitResult.failed.length}
                </div>
                <ul className="ml-4 space-y-1">
                  {commitResult.failed.map((r, i) => (
                    <li key={i}>
                      <span className="font-semibold">{r.title}:</span> {r.error}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// StageSummary — rich human-readable output per stage
// -----------------------------------------------------------------------------

/** Small horizontal bar for confidence / word-count visualization */
function ConfBar({ value, max = 1, color = "bg-purple-500", label }: { value: number; max?: number; color?: string; label?: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="flex items-center gap-2 min-w-0">
      {label && <span className="text-[10px] text-text-secondary shrink-0 w-16 text-right">{label}</span>}
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-mono text-text-secondary shrink-0 w-8">{(value * 100).toFixed(0)}%</span>
    </div>
  );
}

/** Bloom level → number for relative bar sizing */
const BLOOM_ORDER: Record<string, number> = { remember: 1, understand: 2, apply: 3, analyse: 4, evaluate: 5, create: 6 };
const BLOOM_COLORS: Record<string, string> = { remember: "bg-red-400", understand: "bg-orange-400", apply: "bg-yellow-400", analyse: "bg-green-400", evaluate: "bg-blue-400", create: "bg-purple-500" };

/** Section type pill with consistent color */
function TypePill({ type }: { type: string }) {
  const colors: Record<string, string> = {
    activity: "bg-green-100 text-green-800 border-green-200",
    assessment: "bg-blue-100 text-blue-800 border-blue-200",
    instruction: "bg-purple-100 text-purple-800 border-purple-200",
    metadata: "bg-gray-100 text-gray-600 border-gray-200",
    unknown: "bg-gray-50 text-gray-500 border-gray-200",
  };
  return <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${colors[type] || colors.unknown}`}>{type}</span>;
}

/** Expandable section card used by Parse, Pass A, Pass B */
function SectionCard({ heading, children, defaultOpen = false }: { heading: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border bg-white overflow-hidden">
      <button onClick={() => setOpen((x) => !x)} className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 transition-colors">
        <span className={`text-[10px] text-text-secondary transition-transform ${open ? "rotate-90" : ""}`}>&#9654;</span>
        <div className="flex-1 min-w-0">{heading}</div>
      </button>
      {open && <div className="px-3 pb-3 border-t bg-gray-50/50">{children}</div>}
    </div>
  );
}

function StageSummary({ id, output }: { id: StageId; output: unknown }) {
  const [showRaw, setShowRaw] = useState(false);

  const renderSummary = () => {
    switch (id) {
      // ── Dedup ────────────────────────────────────────────────────────────
      case "dedup": {
        const d = output as DedupResult;
        const isDup = d.isDuplicate;
        const nearScore = d.nearDuplicateScore;
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-white">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${isDup ? "bg-red-100" : nearScore && nearScore > 0.85 ? "bg-amber-100" : "bg-green-100"}`}>
                {isDup ? "✕" : nearScore && nearScore > 0.85 ? "~" : "✓"}
              </div>
              <div>
                <div className="font-semibold text-sm">
                  {isDup ? "Exact duplicate — already ingested" : nearScore && nearScore > 0.85 ? "Near-duplicate detected" : "Original content — no duplicates"}
                </div>
                <div className="text-[11px] text-text-secondary mt-0.5">
                  File hash: <code className="font-mono">{d.fileHash?.slice(0, 16)}…</code>
                </div>
              </div>
            </div>
            {isDup && d.existingContentItemId && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
                Matches existing content item <code className="font-mono">{d.existingContentItemId.slice(0, 12)}…</code> — pipeline can still run but blocks will be duplicates.
              </div>
            )}
            {nearScore != null && nearScore > 0.5 && (
              <div className="space-y-1">
                <div className="text-[11px] text-text-secondary">Similarity to nearest existing block:</div>
                <ConfBar value={nearScore} color={nearScore > 0.92 ? "bg-red-500" : nearScore > 0.85 ? "bg-amber-500" : "bg-green-500"} />
                {d.nearDuplicateBlockTitle && (
                  <div className="text-[11px] text-text-secondary">
                    Closest: &ldquo;<span className="text-text-primary">{d.nearDuplicateBlockTitle}</span>&rdquo;
                  </div>
                )}
              </div>
            )}
          </div>
        );
      }

      // ── Parse ────────────────────────────────────────────────────────────
      case "parse": {
        const p = output as ParseResult;
        const sections = p?.sections ?? [];
        const maxWords = Math.max(...sections.map((s) => s.wordCount), 1);
        return (
          <div className="space-y-3">
            {/* Overview strip */}
            <div className="flex gap-4 text-xs">
              <div className="bg-white border rounded-lg px-3 py-2 text-center">
                <div className="text-lg font-bold text-text-primary">{sections.length}</div>
                <div className="text-text-secondary">sections</div>
              </div>
              <div className="bg-white border rounded-lg px-3 py-2 text-center">
                <div className="text-lg font-bold text-text-primary">{p.totalWordCount?.toLocaleString() ?? "—"}</div>
                <div className="text-text-secondary">words</div>
              </div>
              <div className="bg-white border rounded-lg px-3 py-2 text-center">
                <div className="text-lg font-bold text-text-primary">{p.headingCount ?? "—"}</div>
                <div className="text-text-secondary">headings</div>
              </div>
              <div className="bg-white border rounded-lg px-3 py-2 flex-1">
                <div className="text-[11px] font-semibold text-text-primary mb-0.5">Document structure</div>
                <div className="text-[10px] text-text-secondary">
                  {sections.filter((s) => s.hasDuration).length > 0 && <span className="mr-2">⏱ {sections.filter((s) => s.hasDuration).length} with timing</span>}
                  {sections.filter((s) => s.hasListItems).length > 0 && <span>📋 {sections.filter((s) => s.hasListItems).length} with lists</span>}
                </div>
              </div>
            </div>

            {/* Section list with word-count bars */}
            <div className="space-y-1">
              {sections.map((s, i) => (
                <SectionCard
                  key={i}
                  heading={
                    <div className="flex items-center gap-2 w-full min-w-0">
                      <span className="text-[10px] font-mono bg-gray-200 rounded px-1 shrink-0">§{i}</span>
                      <span className="font-medium text-xs text-text-primary truncate">{s.heading || "Untitled"}</span>
                      <div className="flex items-center gap-1 ml-auto shrink-0">
                        {s.hasDuration && <span className="text-[10px]" title="Contains timing info">⏱</span>}
                        {s.hasListItems && <span className="text-[10px]" title="Contains lists">📋</span>}
                        <span className="text-[10px] text-text-secondary">{s.wordCount} words</span>
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-purple-400 rounded-full" style={{ width: `${(s.wordCount / maxWords) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  }
                >
                  <p className="text-[11px] text-text-secondary mt-2 leading-relaxed whitespace-pre-wrap">
                    {s.content?.slice(0, 500)}{s.content && s.content.length > 500 ? "…" : ""}
                  </p>
                </SectionCard>
              ))}
            </div>
          </div>
        );
      }

      // ── Pass A — Classify ───────────────────────────────────────────────
      case "passA": {
        const c = output as IngestionClassification;
        if (!c) return <p className="text-text-secondary">No classification data</p>;
        const conf = c.confidences ?? { documentType: c.confidence };
        return (
          <div className="space-y-3">
            {/* Classification card */}
            <div className="bg-white border rounded-lg p-3 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center text-xl">
                  {c.documentType === "lesson_plan" ? "📝" : c.documentType === "rubric" ? "📊" : c.documentType === "worksheet" ? "📄" : c.documentType === "textbook_extract" ? "📖" : c.documentType === "scheme_of_work" ? "📋" : c.documentType === "resource" ? "📦" : "❓"}
                </div>
                <div>
                  <div className="font-semibold text-sm capitalize">{c.documentType?.replace(/_/g, " ")}</div>
                  {c.topic && <div className="text-[11px] text-text-secondary mt-0.5">{c.topic}</div>}
                </div>
              </div>

              {/* Confidence bars */}
              <div className="space-y-1.5 pt-2 border-t">
                <div className="text-[10px] font-semibold text-text-secondary uppercase tracking-wide">Confidence</div>
                <ConfBar value={conf.documentType} label="Type" color="bg-indigo-500" />
                {conf.subject != null && <ConfBar value={conf.subject} label="Subject" color="bg-blue-500" />}
                {conf.strand != null && <ConfBar value={conf.strand} label="Strand" color="bg-teal-500" />}
                {conf.level != null && <ConfBar value={conf.level} label="Level" color="bg-green-500" />}
              </div>
            </div>

            {/* Detected metadata grid */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Subject", value: c.detectedSubject, icon: "🔬" },
                { label: "Strand", value: c.detectedStrand, icon: "🧩" },
                { label: "Level", value: c.detectedLevel, icon: "🎓" },
              ].map((item) => (
                <div key={item.label} className="bg-white border rounded-lg p-2.5 text-center">
                  <div className="text-sm mb-0.5">{item.icon}</div>
                  <div className="text-[10px] text-text-secondary">{item.label}</div>
                  <div className="text-xs font-semibold text-text-primary mt-0.5">{item.value || "—"}</div>
                </div>
              ))}
            </div>

            {/* Section type breakdown */}
            {c.sections && c.sections.length > 0 && (
              <div className="space-y-2">
                <div className="text-[11px] font-semibold text-text-secondary">Section types identified</div>
                {/* Type distribution bar */}
                <div className="flex h-6 rounded-lg overflow-hidden border">
                  {(() => {
                    const counts: Record<string, number> = {};
                    c.sections.forEach((s) => { counts[s.sectionType || "unknown"] = (counts[s.sectionType || "unknown"] || 0) + 1; });
                    const total = c.sections.length;
                    const barColors: Record<string, string> = { activity: "bg-green-400", assessment: "bg-blue-400", instruction: "bg-purple-400", metadata: "bg-gray-300", unknown: "bg-gray-200" };
                    return Object.entries(counts).map(([type, count]) => (
                      <div key={type} className={`${barColors[type] || barColors.unknown} flex items-center justify-center text-[9px] font-semibold`}
                        style={{ width: `${(count / total) * 100}%` }} title={`${type}: ${count}`}>
                        {count > 0 && `${type} (${count})`}
                      </div>
                    ));
                  })()}
                </div>
                {/* Per-section expandable */}
                {c.sections.map((s, i) => (
                  <SectionCard
                    key={i}
                    heading={
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-mono bg-gray-200 rounded px-1 shrink-0">§{i}</span>
                        <span className="font-medium text-xs truncate">{s.heading || "Untitled"}</span>
                        <TypePill type={s.sectionType} />
                        {s.estimatedDuration && <span className="text-[10px] text-text-secondary shrink-0">{s.estimatedDuration}</span>}
                      </div>
                    }
                  >
                    <p className="text-[11px] text-text-secondary mt-2 leading-relaxed whitespace-pre-wrap">
                      {s.content?.slice(0, 400)}{s.content && s.content.length > 400 ? "…" : ""}
                    </p>
                  </SectionCard>
                ))}
              </div>
            )}
          </div>
        );
      }

      // ── Pass B — Enrich ─────────────────────────────────────────────────
      case "passB": {
        const b = output as IngestionAnalysis;
        const c = b?.classification;
        const sections = b?.enrichedSections ?? [];
        // Collect unique values for the overview
        const categories = [...new Set(sections.map((s) => s.activity_category).filter(Boolean))];
        const blooms = [...new Set(sections.map((s) => s.bloom_level).filter(Boolean))];
        const groupings = [...new Set(sections.map((s) => s.grouping).filter(Boolean))];
        return (
          <div className="space-y-3">
            {/* Classification summary strip */}
            {c && (
              <div className="flex gap-2 flex-wrap">
                {[
                  { label: c.documentType?.replace(/_/g, " "), color: "bg-indigo-100 text-indigo-800" },
                  c.detectedSubject ? { label: c.detectedSubject, color: "bg-blue-100 text-blue-800" } : null,
                  c.detectedStrand ? { label: c.detectedStrand, color: "bg-teal-100 text-teal-800" } : null,
                  c.detectedLevel ? { label: c.detectedLevel, color: "bg-green-100 text-green-800" } : null,
                ].filter(Boolean).map((tag, i) => (
                  <span key={i} className={`text-[11px] font-semibold px-2 py-1 rounded-lg ${tag!.color} capitalize`}>{tag!.label}</span>
                ))}
              </div>
            )}

            {/* AI enrichment overview */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white border rounded-lg p-2.5">
                <div className="text-[10px] text-text-secondary mb-1">Activity types</div>
                <div className="flex flex-wrap gap-1">
                  {categories.length > 0 ? categories.map((cat) => (
                    <span key={cat} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800">{cat}</span>
                  )) : <span className="text-[10px] text-text-secondary">none detected</span>}
                </div>
              </div>
              <div className="bg-white border rounded-lg p-2.5">
                <div className="text-[10px] text-text-secondary mb-1">Bloom&apos;s levels</div>
                <div className="flex flex-wrap gap-1">
                  {blooms.length > 0 ? blooms.sort((a, b) => (BLOOM_ORDER[a] ?? 0) - (BLOOM_ORDER[b] ?? 0)).map((bl) => (
                    <span key={bl} className={`text-[10px] font-semibold px-1.5 py-0.5 rounded text-white ${BLOOM_COLORS[bl] || "bg-gray-400"}`}>{bl}</span>
                  )) : <span className="text-[10px] text-text-secondary">none</span>}
                </div>
              </div>
              <div className="bg-white border rounded-lg p-2.5">
                <div className="text-[10px] text-text-secondary mb-1">Grouping</div>
                <div className="flex flex-wrap gap-1">
                  {groupings.length > 0 ? groupings.map((g) => (
                    <span key={g} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-800">{g}</span>
                  )) : <span className="text-[10px] text-text-secondary">none</span>}
                </div>
              </div>
            </div>

            {/* Per-section enrichment cards */}
            <div className="space-y-1">
              <div className="text-[11px] font-semibold text-text-secondary">{sections.length} enriched section{sections.length !== 1 ? "s" : ""}</div>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {sections.map((s: any, i: number) => (
                <SectionCard
                  key={i}
                  defaultOpen={sections.length <= 3}
                  heading={
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      <span className="text-[10px] font-mono bg-gray-200 rounded px-1 shrink-0">§{i}</span>
                      <span className="font-medium text-xs truncate text-text-primary">{s.heading || "Untitled"}</span>
                      <TypePill type={s.sectionType} />
                      {s.activity_category && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-semibold">{s.activity_category}</span>}
                    </div>
                  }
                >
                  <div className="mt-2 space-y-2">
                    {/* Enrichment badges */}
                    <div className="flex flex-wrap gap-1.5">
                      {s.bloom_level && (
                        <div className="flex items-center gap-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded text-white font-semibold ${BLOOM_COLORS[s.bloom_level] || "bg-gray-400"}`}>
                            Bloom: {s.bloom_level}
                          </span>
                          <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${BLOOM_COLORS[s.bloom_level] || "bg-gray-400"}`}
                              style={{ width: `${((BLOOM_ORDER[s.bloom_level] ?? 3) / 6) * 100}%` }} />
                          </div>
                        </div>
                      )}
                      {s.grouping && <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-800 font-semibold">{s.grouping}</span>}
                      {s.time_weight && <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 font-semibold">⏱ {s.time_weight}</span>}
                      {s.phase && <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 font-semibold">Phase: {s.phase}</span>}
                    </div>
                    {/* Materials / scaffolding / UDL */}
                    {s.materials?.length > 0 && (
                      <div className="text-[11px] text-text-secondary">
                        <span className="font-semibold">Materials:</span> {s.materials.join(", ")}
                      </div>
                    )}
                    {s.teaching_approach && (
                      <div className="text-[11px] text-text-secondary">
                        <span className="font-semibold">Teaching approach:</span> {s.teaching_approach}
                      </div>
                    )}
                    {s.scaffolding_notes && (
                      <div className="text-[11px] text-text-secondary">
                        <span className="font-semibold">Scaffolding:</span> {s.scaffolding_notes}
                      </div>
                    )}
                    {s.udl_hints?.length > 0 && (
                      <div className="text-[11px] text-text-secondary">
                        <span className="font-semibold">UDL hints:</span> {s.udl_hints.join("; ")}
                      </div>
                    )}
                    {/* Content preview */}
                    <div className="mt-1 pt-1 border-t">
                      <p className="text-[10px] text-text-secondary leading-relaxed whitespace-pre-wrap">
                        {s.content?.slice(0, 300)}{s.content && s.content.length > 300 ? "…" : ""}
                      </p>
                    </div>
                  </div>
                </SectionCard>
              ))}
            </div>
          </div>
        );
      }

      // ── Extract ─────────────────────────────────────────────────────────
      case "extract": {
        const e = output as ExtractionResult;
        const hasBlocks = e.blocks && e.blocks.length > 0;
        return (
          <div className="space-y-3">
            {/* Summary strip */}
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-white">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${hasBlocks ? "bg-green-100" : "bg-amber-100"}`}>
                {hasBlocks ? e.blocks.length : "0"}
              </div>
              <div>
                <div className="font-semibold text-sm">
                  {hasBlocks ? `${e.blocks.length} activity block${e.blocks.length !== 1 ? "s" : ""} extracted` : "No blocks extracted"}
                </div>
                <div className="text-[11px] text-text-secondary">
                  {e.totalSectionsProcessed} section{e.totalSectionsProcessed !== 1 ? "s" : ""} scanned &middot; {e.activitySectionsFound} qualified as activity/assessment
                </div>
              </div>
              {e.piiDetected && <span className="ml-auto text-amber-700 font-semibold text-xs bg-amber-50 px-2 py-1 rounded">⚠ PII detected</span>}
            </div>

            {!hasBlocks && e.totalSectionsProcessed > 0 && (
              <div className="text-xs text-text-secondary bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
                <div className="font-semibold text-amber-800">Why no blocks?</div>
                <p>Pass A classified all sections as non-activity types (instruction, metadata, etc.) and Pass B didn&apos;t assign an activity_category. This is common for reference documents, teacher guides, and lesson overviews that describe activities but aren&apos;t structured as step-by-step tasks.</p>
              </div>
            )}

            {/* Block cards */}
            {hasBlocks && e.blocks.map((block, i) => (
              <SectionCard
                key={block.tempId}
                defaultOpen={e.blocks.length <= 3}
                heading={
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <span className="text-xs font-bold text-text-primary">{i + 1}.</span>
                    <span className="font-semibold text-xs text-text-primary truncate">{block.title}</span>
                    {block.bloom_level && <span className={`text-[10px] px-1.5 py-0.5 rounded text-white font-semibold ${BLOOM_COLORS[block.bloom_level] || "bg-gray-400"}`}>{block.bloom_level}</span>}
                    {block.activity_category && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-semibold">{block.activity_category}</span>}
                    {block.piiFlags.length > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-800 font-semibold">PII</span>}
                  </div>
                }
              >
                <div className="mt-2 space-y-2 text-[11px]">
                  <div className="flex flex-wrap gap-1.5">
                    {block.grouping && <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-800 font-semibold">{block.grouping}</span>}
                    {block.time_weight && <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 font-semibold">⏱ {block.time_weight}</span>}
                    {block.phase && <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 font-semibold">Phase: {block.phase}</span>}
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-semibold">©️ {block.copyrightFlag}</span>
                  </div>
                  {block.description && <p className="text-text-secondary"><span className="font-semibold">Description:</span> {block.description}</p>}
                  {block.prompt && <p className="text-text-secondary"><span className="font-semibold">Prompt:</span> {block.prompt.slice(0, 200)}{block.prompt.length > 200 ? "…" : ""}</p>}
                  {block.materials?.length > 0 && <p className="text-text-secondary"><span className="font-semibold">Materials:</span> {block.materials.join(", ")}</p>}
                  {block.teaching_approach && <p className="text-text-secondary"><span className="font-semibold">Approach:</span> {block.teaching_approach}</p>}
                  {block.piiFlags.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded p-2 text-red-800">
                      <span className="font-semibold">PII found:</span> {block.piiFlags.map((f) => `${f.type}: "${f.value}"`).join(", ")}
                    </div>
                  )}
                </div>
              </SectionCard>
            ))}
          </div>
        );
      }

      // ── Moderate ────────────────────────────────────────────────────────
      case "moderate": {
        const m = output as ModerationStageResult;
        const blocks = m?.blocks ?? [];
        const approved = blocks.filter((b) => b.moderationStatus === "approved").length;
        const flagged = blocks.filter((b) => b.moderationStatus === "flagged" || b.moderationStatus === "rejected").length;
        const pending = blocks.filter((b) => b.moderationStatus === "pending").length;
        return (
          <div className="space-y-3">
            {blocks.length === 0 ? (
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-white">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg">—</div>
                <div>
                  <div className="font-semibold text-sm">Nothing to moderate</div>
                  <div className="text-[11px] text-text-secondary">Extract stage produced 0 blocks</div>
                </div>
              </div>
            ) : (
              <>
                {/* Status bar */}
                <div className="flex gap-2">
                  {approved > 0 && (
                    <div className="flex-1 bg-green-50 border border-green-200 rounded-lg p-2.5 text-center">
                      <div className="text-lg font-bold text-green-700">{approved}</div>
                      <div className="text-[10px] text-green-600 font-semibold">Approved</div>
                    </div>
                  )}
                  {flagged > 0 && (
                    <div className="flex-1 bg-red-50 border border-red-200 rounded-lg p-2.5 text-center">
                      <div className="text-lg font-bold text-red-700">{flagged}</div>
                      <div className="text-[10px] text-red-600 font-semibold">Flagged</div>
                    </div>
                  )}
                  {pending > 0 && (
                    <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-center">
                      <div className="text-lg font-bold text-gray-600">{pending}</div>
                      <div className="text-[10px] text-gray-500 font-semibold">Pending</div>
                    </div>
                  )}
                </div>
                {/* Per-block detail */}
                {blocks.map((block, i) => (
                  <div key={block.tempId} className={`rounded-lg border p-3 text-xs ${block.moderationStatus === "approved" ? "bg-green-50 border-green-200" : block.moderationStatus === "flagged" || block.moderationStatus === "rejected" ? "bg-red-50 border-red-200" : "bg-white"}`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${block.moderationStatus === "approved" ? "bg-green-500" : block.moderationStatus === "flagged" || block.moderationStatus === "rejected" ? "bg-red-500" : "bg-gray-400"}`} />
                      <span className="font-semibold">{block.title || `Block ${i + 1}`}</span>
                      <span className={`ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded ${block.moderationStatus === "approved" ? "bg-green-100 text-green-800" : block.moderationStatus === "flagged" ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-600"}`}>
                        {block.moderationStatus}
                      </span>
                    </div>
                    {block.moderationFlags?.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {block.moderationFlags.map((flag, fi) => (
                          <div key={fi} className={`text-[11px] flex items-start gap-1.5 ${flag.severity === "critical" ? "text-red-700" : flag.severity === "warning" ? "text-amber-700" : "text-gray-600"}`}>
                            <span>{flag.severity === "critical" ? "🔴" : flag.severity === "warning" ? "🟡" : "ℹ️"}</span>
                            <span><span className="font-semibold">{flag.category}:</span> {flag.reason}{flag.snippet ? ` — "${flag.snippet.slice(0, 80)}"` : ""}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className="text-xs space-y-2">
      {renderSummary()}
      <button
        onClick={() => setShowRaw((x) => !x)}
        className="text-[10px] text-text-secondary hover:text-text-primary underline mt-2"
      >
        {showRaw ? "Hide raw JSON" : "Show raw JSON"}
      </button>
      {showRaw && (
        <pre className="text-[10px] font-mono overflow-x-auto max-h-60 whitespace-pre-wrap bg-white rounded border p-2 mt-1">
          {JSON.stringify(output, null, 2)}
        </pre>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// StagePanel
// -----------------------------------------------------------------------------

function StagePanel({
  id,
  label,
  state,
  disabled,
  onRun,
}: {
  id: StageId;
  label: string;
  state: StageState<unknown>;
  disabled: boolean;
  onRun: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cost =
    (state.output as { cost?: { estimatedCostUSD?: number } } | undefined)?.cost
      ?.estimatedCostUSD ?? 0;

  const badgeClasses =
    state.status === "done"
      ? "bg-green-100 text-green-800"
      : state.status === "running"
        ? "bg-blue-100 text-blue-800"
        : state.status === "error"
          ? "bg-red-100 text-red-800"
          : "bg-gray-100 text-gray-600";

  return (
    <div className="rounded-xl border bg-white">
      <div className="flex items-center gap-3 p-4">
        <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${badgeClasses}`}>
          {state.status}
        </span>
        <div className="flex-1">
          <div className="text-sm font-semibold text-text-primary">{label}</div>
          {state.durationMs != null && (
            <div className="text-xs text-text-secondary">
              {state.durationMs}ms · {formatUSD(cost)}
            </div>
          )}
        </div>
        <button
          onClick={onRun}
          disabled={disabled || state.status === "running"}
          className="px-3 py-1.5 rounded-lg border text-xs font-semibold disabled:opacity-40 hover:bg-surface-alt"
        >
          {state.status === "done" ? "Rerun" : "Run"}
        </button>
        {(state.output || state.error) && (
          <button
            onClick={() => setExpanded((x) => !x)}
            className="text-xs text-text-secondary hover:text-text-primary underline"
          >
            {expanded ? "Hide" : "Show"}
          </button>
        )}
      </div>
      {expanded && (state.output || state.error) && (
        <div className="border-t p-4 bg-surface-alt">
          {state.error ? (
            <pre className="text-xs text-red-700 whitespace-pre-wrap">{state.error}</pre>
          ) : (
            <StageSummary id={id} output={state.output} />
          )}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// CandidateCard
// -----------------------------------------------------------------------------

function CandidateCard({
  candidate,
  onToggle,
  onEdit,
}: {
  candidate: AcceptedCandidate;
  onToggle: () => void;
  onEdit: (patch: Partial<AcceptedCandidate>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const hasPII = Array.isArray(candidate.piiFlags) && candidate.piiFlags.length > 0;

  return (
    <div
      className={`rounded-lg border p-4 ${
        candidate.accepted ? "bg-white" : "bg-gray-50 opacity-60"
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={candidate.accepted}
          onChange={onToggle}
          className="mt-1"
        />
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              value={candidate.title}
              onChange={(e) => onEdit({ title: e.target.value })}
              className="w-full text-sm font-semibold border-b focus:outline-none"
            />
          ) : (
            <div className="text-sm font-semibold text-text-primary">{candidate.title}</div>
          )}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {candidate.activity_category && (
              <span className="text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                {candidate.activity_category}
              </span>
            )}
            {candidate.bloom_level && (
              <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                bloom: {candidate.bloom_level}
              </span>
            )}
            {candidate.time_weight && (
              <span className="text-[10px] bg-green-100 text-green-800 px-2 py-0.5 rounded">
                {candidate.time_weight}
              </span>
            )}
            {candidate.grouping && (
              <span className="text-[10px] bg-gray-100 text-gray-800 px-2 py-0.5 rounded">
                {candidate.grouping}
              </span>
            )}
            {hasPII && (
              <span className="text-[10px] bg-red-100 text-red-800 px-2 py-0.5 rounded font-semibold">
                ⚠ PII ({candidate.piiFlags!.length})
              </span>
            )}
            {candidate.moderationStatus && (
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                  candidate.moderationStatus === "approved"
                    ? "bg-green-100 text-green-800"
                    : candidate.moderationStatus === "flagged"
                      ? "bg-red-100 text-red-800"
                      : "bg-gray-100 text-gray-700"
                }`}
              >
                mod: {candidate.moderationStatus}
              </span>
            )}
            {candidate.edited && (
              <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                edited
              </span>
            )}
          </div>
          {editing ? (
            <textarea
              value={candidate.prompt}
              onChange={(e) => onEdit({ prompt: e.target.value })}
              rows={6}
              className="w-full mt-2 text-xs border rounded p-2 font-mono"
            />
          ) : (
            <div className="text-xs text-text-secondary mt-2 line-clamp-3 whitespace-pre-wrap">
              {candidate.prompt}
            </div>
          )}
        </div>
        <button
          onClick={() => setEditing((e) => !e)}
          className="text-xs text-brand-purple hover:underline"
        >
          {editing ? "Done" : "Edit"}
        </button>
      </div>
    </div>
  );
}
