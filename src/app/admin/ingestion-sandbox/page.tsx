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
// StageSummary — human-readable output per stage
// -----------------------------------------------------------------------------

function StageSummary({ id, output }: { id: StageId; output: unknown }) {
  const [showRaw, setShowRaw] = useState(false);

  const renderSummary = () => {
    switch (id) {
      case "dedup": {
        const d = output as DedupResult;
        const isDup = d.isDuplicate;
        const nearScore = d.nearDuplicateScore;
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`inline-block w-2 h-2 rounded-full ${isDup ? "bg-red-500" : nearScore && nearScore > 0.85 ? "bg-amber-500" : "bg-green-500"}`} />
              <span className="font-medium">
                {isDup ? "Exact duplicate found" : nearScore && nearScore > 0.85 ? `Near-duplicate (${(nearScore * 100).toFixed(0)}% similar)` : "No duplicates"}
              </span>
            </div>
            {isDup && d.existingContentItemId && (
              <p className="text-text-secondary">Matches content item <code className="font-mono text-[10px]">{d.existingContentItemId.slice(0, 12)}…</code></p>
            )}
            {nearScore != null && !isDup && nearScore > 0.8 && d.nearDuplicateBlockTitle && (
              <p className="text-text-secondary">Closest match: &ldquo;{d.nearDuplicateBlockTitle}&rdquo; ({(nearScore * 100).toFixed(0)}%)</p>
            )}
          </div>
        );
      }
      case "parse": {
        const p = output as ParseResult;
        const sections = p?.sections ?? [];
        return (
          <div className="space-y-2">
            <div className="font-medium">{sections.length} section{sections.length !== 1 ? "s" : ""} found</div>
            <div className="space-y-1">
              {sections.slice(0, 10).map((s: { heading?: string; content?: string; estimatedDuration?: string }, i: number) => (
                <div key={i} className="flex items-start gap-2 text-text-secondary">
                  <span className="text-[10px] font-mono bg-gray-200 rounded px-1 mt-0.5 shrink-0">§{i}</span>
                  <span className="font-medium text-text-primary">{s.heading || "Untitled"}</span>
                  <span className="text-[10px] text-text-secondary ml-auto shrink-0">
                    {s.content ? `${s.content.length.toLocaleString()} chars` : ""}
                    {s.estimatedDuration ? ` · ${s.estimatedDuration}` : ""}
                  </span>
                </div>
              ))}
              {sections.length > 10 && <p className="text-text-secondary italic">…and {sections.length - 10} more</p>}
            </div>
          </div>
        );
      }
      case "passA": {
        const c = output as IngestionClassification;
        if (!c) return <p className="text-text-secondary">No classification data</p>;
        const confPct = (v: number | undefined) => v != null ? `${(v * 100).toFixed(0)}%` : "—";
        return (
          <div className="space-y-2">
            <div className="font-medium">
              Classification: <span className="capitalize">{c.documentType}</span>
              <span className="ml-2 text-[10px] font-mono bg-gray-200 rounded px-1.5 py-0.5">{confPct(c.confidence)} confidence</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-text-secondary">
              <div>Subject: <span className="text-text-primary font-medium">{c.detectedSubject || "—"}</span></div>
              <div>Strand: <span className="text-text-primary font-medium">{c.detectedStrand || "—"}</span></div>
              <div>Level: <span className="text-text-primary font-medium">{c.detectedLevel || "—"}</span></div>
            </div>
            {c.topic && <div className="text-text-secondary">Topic: <span className="text-text-primary">{c.topic}</span></div>}
            {c.sections && c.sections.length > 0 && (
              <div className="mt-1 pt-1 border-t border-gray-200">
                <span className="font-medium">{c.sections.length} section{c.sections.length !== 1 ? "s" : ""} classified:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {c.sections.map((s: { sectionType?: string }, i: number) => {
                    const t = s.sectionType || "unknown";
                    const color = t === "activity" ? "bg-green-100 text-green-800" : t === "assessment" ? "bg-blue-100 text-blue-800" : t === "instruction" ? "bg-purple-100 text-purple-800" : "bg-gray-100 text-gray-600";
                    return <span key={i} className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${color}`}>{t}</span>;
                  })}
                </div>
              </div>
            )}
          </div>
        );
      }
      case "passB": {
        const b = output as IngestionAnalysis;
        const c = b?.classification;
        const sections = b?.enrichedSections ?? [];
        return (
          <div className="space-y-2">
            {c && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-text-secondary">
                <div>Type: <span className="text-text-primary font-medium capitalize">{c.documentType}</span></div>
                <div>Subject: <span className="text-text-primary font-medium">{c.detectedSubject || "—"}</span></div>
                <div>Strand: <span className="text-text-primary font-medium">{c.detectedStrand || "—"}</span></div>
                <div>Level: <span className="text-text-primary font-medium">{c.detectedLevel || "—"}</span></div>
              </div>
            )}
            <div className="font-medium">{sections.length} enriched section{sections.length !== 1 ? "s" : ""}</div>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {sections.slice(0, 8).map((s: any, i: number) => (
              <div key={i} className="flex items-center gap-2 flex-wrap text-text-secondary">
                <span className="text-[10px] font-mono bg-gray-200 rounded px-1 shrink-0">§{i}</span>
                <span className="font-medium text-text-primary text-xs">{s.heading || "Untitled"}</span>
                {s.sectionType && <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${s.sectionType === "activity" ? "bg-green-100 text-green-800" : s.sectionType === "assessment" ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-600"}`}>{s.sectionType}</span>}
                {s.activity_category && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-800">{s.activity_category}</span>}
                {s.bloom_level && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">Bloom: {s.bloom_level}</span>}
                {s.grouping && <span className="text-[10px] text-text-secondary">{s.grouping}</span>}
              </div>
            ))}
            {sections.length > 8 && <p className="text-text-secondary italic text-xs">…and {sections.length - 8} more</p>}
          </div>
        );
      }
      case "extract": {
        const e = output as ExtractionResult;
        const hasBlocks = e.blocks && e.blocks.length > 0;
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`inline-block w-2 h-2 rounded-full ${hasBlocks ? "bg-green-500" : "bg-amber-500"}`} />
              <span className="font-medium">
                {hasBlocks
                  ? `${e.blocks.length} block${e.blocks.length !== 1 ? "s" : ""} extracted`
                  : "No blocks extracted"}
              </span>
              <span className="text-text-secondary text-xs">
                ({e.totalSectionsProcessed} sections scanned, {e.activitySectionsFound} activity/assessment)
              </span>
            </div>
            {e.piiDetected && <div className="text-amber-700 text-xs font-semibold">⚠ PII detected in one or more blocks</div>}
            {!hasBlocks && e.totalSectionsProcessed > 0 && (
              <p className="text-xs text-text-secondary bg-amber-50 border border-amber-200 rounded p-2">
                💡 Sections were classified as non-activity types (instruction, metadata, etc.) so no blocks were created.
                This is common for reference documents, teacher guides, and lesson overviews.
              </p>
            )}
            {hasBlocks && e.blocks.map((b: ExtractedBlock, i: number) => (
              <div key={b.tempId} className="text-xs bg-white rounded-lg border p-2.5">
                <div className="font-medium text-text-primary">{i + 1}. {b.title}</div>
                <div className="flex gap-1.5 mt-1 flex-wrap">
                  {b.bloom_level && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">Bloom: {b.bloom_level}</span>}
                  {b.activity_category && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-800">{b.activity_category}</span>}
                  {b.grouping && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">{b.grouping}</span>}
                  {b.piiFlags.length > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-800">PII: {b.piiFlags.join(", ")}</span>}
                </div>
              </div>
            ))}
          </div>
        );
      }
      case "moderate": {
        const m = output as ModerationStageResult;
        const blocks = m?.blocks ?? [];
        const approved = blocks.filter((b: ModeratedBlock) => b.moderationStatus === "approved").length;
        const flagged = blocks.filter((b: ModeratedBlock) => b.moderationStatus === "flagged" || b.moderationStatus === "rejected").length;
        const pending = blocks.filter((b: ModeratedBlock) => b.moderationStatus === "pending").length;
        return (
          <div className="space-y-2">
            {blocks.length === 0 ? (
              <p className="text-text-secondary">No blocks to moderate (extract stage produced 0 blocks)</p>
            ) : (
              <>
                <div className="flex gap-3 font-medium">
                  {approved > 0 && <span className="text-green-700">✓ {approved} approved</span>}
                  {flagged > 0 && <span className="text-red-700">⚠ {flagged} flagged</span>}
                  {pending > 0 && <span className="text-gray-600">◌ {pending} pending</span>}
                </div>
                {blocks.map((b: ModeratedBlock, i: number) => (
                  <div key={b.tempId} className="text-xs flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${b.moderationStatus === "approved" ? "bg-green-500" : b.moderationStatus === "flagged" || b.moderationStatus === "rejected" ? "bg-red-500" : "bg-gray-400"}`} />
                    <span className="text-text-primary">{b.title || `Block ${i + 1}`}</span>
                    {b.moderationFlags?.length > 0 && <span className="text-red-600 text-[10px]">({b.moderationFlags.join(", ")})</span>}
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
        className="text-[10px] text-text-secondary hover:text-text-primary underline mt-1"
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
