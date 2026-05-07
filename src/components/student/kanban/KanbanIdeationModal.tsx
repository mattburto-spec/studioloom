"use client";

/**
 * KanbanIdeationModal — Socratic helper for populating the Backlog.
 *
 * Effort-gated multi-phase flow per docs/education-ai-patterns.md:
 *
 *   Phase 1 ("describe") — student types a project description (≥40 chars).
 *   Phase 2 ("rough3")  — student types three rough first ideas (≥3 chars
 *                          each). Forces them to do the thinking before
 *                          the AI engages at all.
 *   Phase 3 ("loop")    — AI returns 4 probe questions about THEIR project.
 *                          Student types backlog ideas one at a time. After
 *                          each typed idea, AI returns a single nudge that
 *                          quotes their idea and asks them to dig one layer
 *                          deeper. AI never lists ideas — only questions.
 *   At any point in "loop", student clicks "Convert to Backlog" → typed
 *   ideas become real cards in the Backlog column via the parent's
 *   onConvert callback.
 *
 * The whole thing routes through /api/tools/kanban-ideation, which uses
 * Haiku 4.5 for cost + speed (many short turns).
 */

import { useEffect, useRef, useState } from "react";

const MIN_DESCRIPTION_CHARS = 40;
const MIN_ROUGH_IDEA_CHARS = 3;
const MIN_LOOP_IDEA_CHARS = 4;
const SOFT_NUDGE_AFTER = 5;

type Phase = "describe" | "rough3" | "loop";

interface Props {
  /** Stable per-modal-open identifier for AI rate-limit bucketing. */
  sessionId: string;
  /**
   * Called when the student clicks "Convert to Backlog". Passes their
   * typed ideas (the cards to create). Parent should dispatch a
   * createCard action for each. Modal closes after this fires.
   */
  onConvert: (ideas: string[]) => void;
  onClose: () => void;
}

interface NudgeState {
  acknowledgment: string;
  nudge: string;
}

export default function KanbanIdeationModal({
  sessionId,
  onConvert,
  onClose,
}: Props) {
  const [phase, setPhase] = useState<Phase>("describe");
  const [description, setDescription] = useState("");
  // Phase 2 — three rough first ideas (forced before AI engages).
  const [rough, setRough] = useState<[string, string, string]>(["", "", ""]);
  // Phase 3 — AI probe questions (set once after rough3 → loop transition).
  const [probes, setProbes] = useState<string[]>([]);
  // Phase 3 — accumulated backlog ideas the student has typed.
  const [backlogIdeas, setBacklogIdeas] = useState<string[]>([]);
  // Phase 3 — current in-progress new idea input.
  const [newIdea, setNewIdea] = useState("");
  // Phase 3 — last nudge from AI, displayed above the input.
  const [nudge, setNudge] = useState<NudgeState | null>(null);
  // Loading flags for the two AI calls.
  const [probing, setProbing] = useState(false);
  const [nudging, setNudging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (phase === "describe") descriptionRef.current?.focus();
  }, [phase]);

  // ─── Phase transitions ──────────────────────────────────────────────────

  function descriptionMeetsGate(): boolean {
    return description.trim().length >= MIN_DESCRIPTION_CHARS;
  }

  function rough3MeetsGate(): boolean {
    return rough.every((r) => r.trim().length >= MIN_ROUGH_IDEA_CHARS);
  }

  async function advanceToRough3() {
    if (!descriptionMeetsGate()) return;
    setError(null);
    setPhase("rough3");
  }

  async function advanceToLoop() {
    if (!rough3MeetsGate()) return;
    setError(null);
    setProbing(true);
    try {
      const res = await fetch("/api/tools/kanban-ideation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "probe",
          challenge: description.trim(),
          studentIdeas: rough.map((r) => r.trim()),
          sessionId,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error || `AI call failed (${res.status})`);
      }
      const data = (await res.json()) as { prompts: string[] };
      setProbes(data.prompts || []);
      setPhase("loop");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't fetch probes");
    } finally {
      setProbing(false);
    }
  }

  // ─── Phase 3: typed-idea loop ───────────────────────────────────────────

  function classifyEffort(idea: string): "low" | "medium" | "high" {
    const trimmed = idea.trim();
    if (trimmed.length < 12) return "low";
    if (trimmed.length < 30) return "medium";
    return "high";
  }

  async function addIdea() {
    const trimmed = newIdea.trim();
    if (trimmed.length < MIN_LOOP_IDEA_CHARS) return;
    // Optimistically add to the list — student sees their own words land
    // immediately; AI nudge follows asynchronously.
    const nextIdeas = [...backlogIdeas, trimmed];
    setBacklogIdeas(nextIdeas);
    setNewIdea("");
    setError(null);
    setNudging(true);
    setNudge(null);
    try {
      const res = await fetch("/api/tools/kanban-ideation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "nudge",
          challenge: description.trim(),
          idea: trimmed,
          priorIdeas: nextIdeas,
          ideaIndex: nextIdeas.length - 1,
          effortLevel: classifyEffort(trimmed),
          sessionId,
        }),
      });
      if (!res.ok) {
        // Idea is already added — nudge failure is non-fatal.
        return;
      }
      const data = (await res.json()) as {
        acknowledgment: string;
        nudge: string;
      };
      setNudge({
        acknowledgment: data.acknowledgment || "",
        nudge: data.nudge || "",
      });
    } catch {
      // Silent — idea is saved locally, nudge is best-effort.
    } finally {
      setNudging(false);
    }
  }

  function removeIdea(i: number) {
    setBacklogIdeas(backlogIdeas.filter((_, idx) => idx !== i));
  }

  function convert() {
    if (backlogIdeas.length === 0) return;
    onConvert(backlogIdeas);
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
        data-testid="kanban-ideation-scrim"
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Help me think"
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[min(100%-2rem,40rem)] max-h-[min(90vh,40rem)] bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
        data-testid="kanban-ideation-modal"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-4 py-3 border-b border-gray-100">
          <div>
            <div className="text-[10.5px] uppercase tracking-wide text-violet-600 font-semibold flex items-center gap-1.5">
              <span aria-hidden="true">✨</span> Help me think · Backlog
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5 leading-snug">
              {phase === "describe" &&
                "Tell me about your project. I'll never write your ideas for you — only questions to help you think."}
              {phase === "rough3" &&
                "Three rough ideas you've already considered — even one word is fine."}
              {phase === "loop" &&
                "Type a backlog idea. I'll ask you to dig deeper on each one."}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 ml-3 -mr-1 -mt-1 p-1 rounded hover:bg-gray-100"
            aria-label="Close"
            data-testid="kanban-ideation-close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
          {phase === "describe" && (
            <div>
              <label className="block">
                <span className="text-[10.5px] font-semibold text-gray-700 uppercase tracking-wide block mb-1">
                  Project description
                </span>
                <textarea
                  ref={descriptionRef}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  maxLength={500}
                  placeholder="e.g. CO2 dragster — light, fast, has to clear a 20m track. I want it to look like a 1970s F1 car."
                  className="w-full text-[12px] px-2 py-1.5 bg-white border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-violet-300 focus:border-violet-500 resize-none"
                  data-testid="kanban-ideation-description"
                />
              </label>
              <p
                className={[
                  "text-[10.5px] mt-1.5 leading-snug",
                  descriptionMeetsGate()
                    ? "text-emerald-700"
                    : "text-gray-500",
                ].join(" ")}
                data-testid="kanban-ideation-description-gate"
              >
                {descriptionMeetsGate()
                  ? "✓ enough detail to start"
                  : `Add a couple more sentences — ${Math.max(
                      0,
                      MIN_DESCRIPTION_CHARS - description.trim().length
                    )} more characters needed.`}
              </p>
            </div>
          )}

          {phase === "rough3" && (
            <div className="flex flex-col gap-2.5">
              <p className="text-[11px] text-gray-700 leading-snug">
                Before I help, what are{" "}
                <span className="font-semibold">3 things</span> you&apos;ve
                already considered doing? Doesn&apos;t have to be polished —
                just rough.
              </p>
              {rough.map((value, i) => (
                <label key={i} className="block">
                  <span className="text-[10.5px] font-semibold text-gray-600 block mb-0.5">
                    Rough idea {i + 1}
                  </span>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => {
                      const next = [...rough] as [string, string, string];
                      next[i] = e.target.value;
                      setRough(next);
                    }}
                    maxLength={200}
                    placeholder={
                      i === 0
                        ? "e.g. find a wheel design"
                        : i === 1
                        ? "e.g. sketch the body shape"
                        : "e.g. test how light I can make it"
                    }
                    className="w-full text-[12px] px-2 py-1.5 bg-white border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-violet-300 focus:border-violet-500"
                    data-testid={`kanban-ideation-rough-${i}`}
                  />
                </label>
              ))}
              <p
                className={[
                  "text-[10.5px] leading-snug",
                  rough3MeetsGate() ? "text-emerald-700" : "text-gray-500",
                ].join(" ")}
                data-testid="kanban-ideation-rough-gate"
              >
                {rough3MeetsGate()
                  ? "✓ ready — let's see some probes"
                  : "Fill in all three — even rough is fine."}
              </p>
            </div>
          )}

          {phase === "loop" && (
            <div className="flex flex-col gap-3">
              {/* Probes (collapsible) */}
              <details
                className="bg-violet-50 border border-violet-200 rounded p-2.5"
                open
              >
                <summary className="text-[10.5px] font-semibold text-violet-800 uppercase tracking-wide cursor-pointer">
                  4 questions to think about
                </summary>
                <ul className="mt-1.5 flex flex-col gap-1 text-[11.5px] text-violet-900 leading-snug">
                  {probes.map((p, i) => (
                    <li key={i} data-testid={`kanban-ideation-probe-${i}`}>
                      • {p}
                    </li>
                  ))}
                </ul>
              </details>

              {/* Latest nudge */}
              {nudge && (
                <div
                  className="bg-amber-50 border border-amber-200 rounded p-2.5"
                  data-testid="kanban-ideation-nudge"
                >
                  {nudge.acknowledgment && (
                    <div className="text-[11px] text-emerald-800 mb-0.5 font-semibold">
                      {nudge.acknowledgment}
                    </div>
                  )}
                  <div className="text-[11.5px] text-amber-900 leading-snug">
                    {nudge.nudge}
                  </div>
                </div>
              )}

              {/* Idea list */}
              <div>
                <div className="text-[10.5px] font-semibold text-gray-700 uppercase tracking-wide mb-1">
                  Your ideas ({backlogIdeas.length})
                </div>
                {backlogIdeas.length === 0 ? (
                  <p className="text-[11px] text-gray-500 italic leading-snug">
                    None yet. Type one below — your words, not mine.
                  </p>
                ) : (
                  <ul
                    className="flex flex-col gap-1"
                    data-testid="kanban-ideation-list"
                  >
                    {backlogIdeas.map((idea, i) => (
                      <li
                        key={i}
                        className="flex items-start justify-between gap-2 bg-white border border-gray-200 rounded px-2 py-1.5 text-[11.5px] text-gray-800"
                      >
                        <span className="flex-1 leading-snug">{idea}</span>
                        <button
                          type="button"
                          onClick={() => removeIdea(i)}
                          className="text-gray-400 hover:text-rose-600 text-[10px] px-1"
                          aria-label={`Remove idea ${i + 1}`}
                          data-testid={`kanban-ideation-remove-${i}`}
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* New idea input */}
              <div>
                <label className="block">
                  <span className="text-[10.5px] font-semibold text-gray-700 uppercase tracking-wide block mb-1">
                    Add an idea
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newIdea}
                      onChange={(e) => setNewIdea(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newIdea.trim().length >= MIN_LOOP_IDEA_CHARS) {
                          e.preventDefault();
                          addIdea();
                        }
                      }}
                      maxLength={200}
                      placeholder="e.g. sketch three side views with different nose shapes"
                      className="flex-1 text-[12px] px-2 py-1.5 bg-white border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-violet-300 focus:border-violet-500"
                      data-testid="kanban-ideation-input"
                    />
                    <button
                      type="button"
                      onClick={addIdea}
                      disabled={
                        nudging ||
                        newIdea.trim().length < MIN_LOOP_IDEA_CHARS
                      }
                      className={[
                        "text-[11.5px] px-3 py-1.5 rounded font-semibold whitespace-nowrap",
                        nudging
                          ? "bg-gray-200 text-gray-500 cursor-wait"
                          : newIdea.trim().length >= MIN_LOOP_IDEA_CHARS
                          ? "bg-violet-600 text-white hover:bg-violet-700"
                          : "bg-violet-200 text-white cursor-not-allowed",
                      ].join(" ")}
                      data-testid="kanban-ideation-add"
                    >
                      {nudging ? "…" : "Add"}
                    </button>
                  </div>
                </label>
                {backlogIdeas.length >= SOFT_NUDGE_AFTER && (
                  <p
                    className="text-[10.5px] text-violet-700 mt-1.5 leading-snug"
                    data-testid="kanban-ideation-soft-nudge"
                  >
                    You&apos;ve got {backlogIdeas.length} ideas — keep going if
                    you have more, or hit &ldquo;Convert&rdquo; below when
                    you&apos;re ready.
                  </p>
                )}
              </div>
            </div>
          )}

          {error && (
            <p
              className="text-[11px] text-rose-700 mt-2"
              data-testid="kanban-ideation-error"
            >
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-[11.5px] px-3 py-1.5 rounded text-gray-600 hover:text-gray-900"
            data-testid="kanban-ideation-cancel"
          >
            Cancel
          </button>

          {phase === "describe" && (
            <button
              type="button"
              onClick={advanceToRough3}
              disabled={!descriptionMeetsGate()}
              className={[
                "text-[11.5px] px-3 py-1.5 rounded font-semibold",
                descriptionMeetsGate()
                  ? "bg-violet-600 text-white hover:bg-violet-700"
                  : "bg-violet-200 text-white cursor-not-allowed",
              ].join(" ")}
              data-testid="kanban-ideation-next-rough"
            >
              Next → 3 rough ideas
            </button>
          )}

          {phase === "rough3" && (
            <button
              type="button"
              onClick={advanceToLoop}
              disabled={!rough3MeetsGate() || probing}
              className={[
                "text-[11.5px] px-3 py-1.5 rounded font-semibold",
                probing
                  ? "bg-gray-200 text-gray-500 cursor-wait"
                  : rough3MeetsGate()
                  ? "bg-violet-600 text-white hover:bg-violet-700"
                  : "bg-violet-200 text-white cursor-not-allowed",
              ].join(" ")}
              data-testid="kanban-ideation-next-loop"
            >
              {probing ? "Thinking…" : "Show me probes →"}
            </button>
          )}

          {phase === "loop" && (
            <button
              type="button"
              onClick={convert}
              disabled={backlogIdeas.length === 0}
              className={[
                "text-[11.5px] px-3 py-1.5 rounded font-semibold",
                backlogIdeas.length > 0
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "bg-emerald-200 text-white cursor-not-allowed",
              ].join(" ")}
              data-testid="kanban-ideation-convert"
            >
              Convert {backlogIdeas.length} to Backlog
            </button>
          )}
        </div>
      </div>
    </>
  );
}
