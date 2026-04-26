"use client";

/**
 * /teacher/skills/import — paste-JSON card import.
 *
 * Pairs with the `.claude/skills/skill-card-author` Cowork skill. Teacher
 * authors a card conversationally in Claude Code, copies the JSON output,
 * pastes here, hits Import.
 *
 * Accepts a single card object, {card: {...}}, or {cards: [...]} for batch.
 * Server returns per-card results so partial successes are obvious.
 */

import { useState } from "react";
import Link from "next/link";

interface ImportResult {
  ok: boolean;
  slug?: string;
  card_id?: string;
  error?: string;
  suggested_slug?: string;
}

const SAMPLE = `{
  "title": "Coping saw — safe use",
  "summary": "Set up, hold, and use a coping saw without injury.",
  "category": "tool-use",
  "domain": "design-making",
  "tier": "bronze",
  "age_min": 11,
  "age_max": 13,
  "estimated_min": 20,
  "demo_of_competency": "Demonstrate a 30-second straight cut following a marked line, with workpiece secured and PPE worn.",
  "learning_outcomes": [
    "Student can identify the cutting direction of the blade.",
    "Student can secure the workpiece on a bench hook before cutting.",
    "Student can produce a controlled cut along a marked line."
  ],
  "framework_anchors": [
    { "framework": "ATL", "label": "Self-Management" }
  ],
  "applied_in": ["Workshop tool selection", "Fabrication preflight"],
  "body": [
    {
      "type": "key_concept",
      "title": "Hold and stance",
      "icon": "🪚",
      "content": "Grip the saw handle firmly with your dominant hand. Stand square to the work with one foot slightly back for balance.",
      "tips": ["Keep elbows close to your body", "Eyes on the cut line, not the blade"]
    },
    {
      "type": "step_by_step",
      "title": "First cut",
      "steps": [
        { "number": 1, "instruction": "Mark your line in pencil." },
        { "number": 2, "instruction": "Clamp the workpiece in a bench hook.", "warning": "Never freehand-hold." },
        { "number": 3, "instruction": "Begin the cut with light forward strokes." }
      ]
    }
  ],
  "quiz": {
    "questions": [
      {
        "type": "multiple_choice",
        "prompt": "Which way do the teeth on a coping saw face?",
        "options": ["Toward the handle", "Away from the handle", "Either way"],
        "correct_index": 0,
        "explanation": "Coping saws cut on the pull stroke — teeth face the handle."
      }
    ],
    "pass_threshold": 80
  }
}`;

export default function ImportSkillCardsPage() {
  const [json, setJson] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [topError, setTopError] = useState<string | null>(null);

  function loadSample() {
    setJson(SAMPLE);
    setResults(null);
    setTopError(null);
  }

  async function handleImport() {
    setTopError(null);
    setResults(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch (e) {
      setTopError(
        `Invalid JSON: ${e instanceof Error ? e.message : "parse error"}`
      );
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/teacher/skills/cards/import", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const text = await res.text();
      let body: { results?: ImportResult[]; error?: string; created?: number; total?: number };
      try {
        body = JSON.parse(text);
      } catch {
        setTopError(`Server returned non-JSON (${res.status}): ${text.slice(0, 200)}`);
        return;
      }
      if (Array.isArray(body.results)) {
        setResults(body.results);
      } else if (body.error) {
        setTopError(body.error);
      } else {
        setTopError(`Unexpected response (${res.status})`);
      }
    } catch (e) {
      setTopError(e instanceof Error ? e.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900">
            Import skill cards
          </h1>
          <p className="text-gray-500 mt-1 text-sm max-w-3xl">
            Paste card JSON authored in Claude Code (Cowork). Accepts a
            single card, <code>{`{card: {…}}`}</code>, or{" "}
            <code>{`{cards: […]}`}</code> for batches up to 25.
          </p>
        </div>
        <Link
          href="/teacher/skills"
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          ← Back to library
        </Link>
      </div>

      {/* How-to ribbon */}
      <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-4 text-sm text-gray-700 space-y-2">
        <p className="font-medium text-indigo-900">
          How to author with Claude Code
        </p>
        <ol className="list-decimal pl-5 space-y-1 text-gray-700">
          <li>
            Open Claude Code in this repo. Ask it: <em>&ldquo;Use the
            skill-card-author skill to make a {`{tier}`} card on {`{topic}`}
            for ages {`{n}`}-{`{m}`}.&rdquo;</em>
          </li>
          <li>
            Iterate conversationally — &ldquo;tighten the demo verb&rdquo;,
            &ldquo;swap the scenario for a real workshop incident&rdquo;,
            &ldquo;add a 5-question quiz&rdquo;, etc.
          </li>
          <li>Copy the final JSON block. Paste below. Hit Import.</li>
        </ol>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={loadSample}
            className="text-xs px-3 py-1.5 rounded-md bg-white border border-gray-200 hover:bg-gray-50 text-gray-700"
          >
            Load sample card
          </button>
          <button
            type="button"
            onClick={() => {
              setJson("");
              setResults(null);
              setTopError(null);
            }}
            disabled={!json}
            className="text-xs px-3 py-1.5 rounded-md bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 disabled:opacity-50"
          >
            Clear
          </button>
        </div>
        <button
          type="button"
          onClick={handleImport}
          disabled={submitting || !json.trim()}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {submitting ? "Importing…" : "Import"}
        </button>
      </div>

      <textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        rows={26}
        spellCheck={false}
        className="w-full font-mono text-xs border border-gray-200 rounded-xl px-4 py-3 bg-white"
        placeholder='Paste card JSON here, or click "Load sample card" above.'
      />

      {topError && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700">
          ⚠ {topError}
        </div>
      )}

      {results && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-700">
            Results — {results.filter((r) => r.ok).length} of {results.length}{" "}
            created
          </h2>
          <ul className="space-y-2">
            {results.map((r, i) => (
              <li
                key={i}
                className={`rounded-xl border p-3 text-sm ${
                  r.ok
                    ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                    : "bg-rose-50 border-rose-200 text-rose-900"
                }`}
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span>
                    {r.ok ? "✅" : "❌"} <strong>#{i + 1}</strong>{" "}
                    {r.slug ? <code>{r.slug}</code> : null}
                    {r.error ? ` — ${r.error}` : null}
                    {r.suggested_slug
                      ? ` (try slug: "${r.suggested_slug}")`
                      : null}
                  </span>
                  {r.ok && r.slug && (
                    <Link
                      href={`/skills/cards/${r.slug}`}
                      className="text-xs text-emerald-700 hover:text-emerald-900 underline"
                    >
                      View →
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
