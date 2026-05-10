"use client";

/**
 * LIS.D — KeyCalloutEditor
 *
 * Authoring surface for the magazine-style "Worth remembering" callout
 * shipped in src/components/lesson/KeyInformationCallout. Renders inside
 * the lesson-editor's section panel when section.contentStyle is callout-
 * shaped ("info" — auto-flipped via LIS.A.2 — or the explicit
 * "key-callout" value).
 *
 * Three authoring slots:
 *   - bulletsEyebrow  — chip text (default "Worth remembering")
 *   - bulletsTitle    — magazine title (string OR string[]; array splits
 *                        into one-word-per-line for visual rhythm)
 *   - bulletsIntro    — short intro paragraph beneath the title
 *   - bullets[]       — 3-card magazine layout (term + optional hint + body)
 *
 * Empty bullets[] keeps the renderer in its single-card body fallback.
 */

import type { ActivitySection, CalloutBullet } from "@/types";

interface Props {
  activity: ActivitySection;
  onUpdate: (patch: Partial<ActivitySection>) => void;
}

function emptyBullet(): CalloutBullet {
  return { term: "", hint: "", body: "" };
}

/** Title is stored as string|string[]. Editor presents a single textarea
 *  where each non-empty line becomes an array entry. Single-line input
 *  collapses to a string for cleaner data. */
function parseTitleInput(raw: string): string | string[] | undefined {
  const lines = raw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  if (lines.length === 0) return undefined;
  if (lines.length === 1) return lines[0];
  return lines;
}

function formatTitle(value: string | string[] | undefined): string {
  if (!value) return "";
  if (Array.isArray(value)) return value.join("\n");
  return value;
}

export function KeyCalloutEditor({ activity, onUpdate }: Props) {
  const bullets = activity.bullets ?? [];

  const updateBullet = (index: number, patch: Partial<CalloutBullet>) => {
    const next = bullets.map((b, i) => (i === index ? { ...b, ...patch } : b));
    onUpdate({ bullets: next });
  };

  const addBullet = () => {
    onUpdate({ bullets: [...bullets, emptyBullet()] });
  };

  const removeBullet = (index: number) => {
    onUpdate({ bullets: bullets.filter((_, i) => i !== index) });
  };

  return (
    <div className="mt-3 p-3 bg-amber-50/60 border border-amber-200 rounded-lg space-y-3">
      <div className="flex items-center gap-1.5">
        <span>📰</span>
        <label className="text-[12px] font-bold text-amber-900">
          Magazine callout
        </label>
        <span className="text-[10.5px] text-amber-700/80">
          (renders as the cream "Worth remembering" surface; bullets fill the 3-card layout)
        </span>
      </div>

      {/* Eyebrow */}
      <div>
        <label className="text-[10px] le-cap text-amber-800 block mb-1">
          Eyebrow chip (default "Worth remembering")
        </label>
        <input
          type="text"
          value={activity.bulletsEyebrow ?? ""}
          onChange={(e) =>
            onUpdate({ bulletsEyebrow: e.target.value || undefined })
          }
          placeholder="Worth remembering"
          className="w-full px-2 py-1 text-[12px] border border-amber-200 rounded bg-white placeholder-amber-300"
        />
      </div>

      {/* Title (string or array via newlines) */}
      <div>
        <label className="text-[10px] le-cap text-amber-800 block mb-1">
          Title (one word per line for big magazine rhythm — optional)
        </label>
        <textarea
          value={formatTitle(activity.bulletsTitle)}
          onChange={(e) =>
            onUpdate({ bulletsTitle: parseTitleInput(e.target.value) })
          }
          placeholder={"The\nThree\nCs."}
          rows={3}
          className="w-full px-2 py-1.5 text-[12px] border border-amber-200 rounded bg-white placeholder-amber-300 resize-y font-mono"
        />
      </div>

      {/* Intro */}
      <div>
        <label className="text-[10px] le-cap text-amber-800 block mb-1">
          Intro paragraph (optional)
        </label>
        <textarea
          value={activity.bulletsIntro ?? ""}
          onChange={(e) =>
            onUpdate({ bulletsIntro: e.target.value || undefined })
          }
          placeholder="Every survey, every journal entry, and every check-in comes back to these three."
          rows={2}
          className="w-full px-2 py-1.5 text-[12px] border border-amber-200 rounded bg-white placeholder-amber-300 resize-y"
        />
      </div>

      {/* Bullets list */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[10px] le-cap text-amber-800">
            Bullet cards ({bullets.length})
          </label>
          <span className="text-[10.5px] text-amber-700/80">
            Empty list → single warm-card body using section prose.
          </span>
        </div>

        {bullets.length === 0 && (
          <p className="text-[11.5px] text-amber-700/80 italic mb-2">
            No cards yet — section prose renders as a single warm card. Add 1–3
            cards for the 3-card magazine treatment.
          </p>
        )}

        <div className="space-y-2">
          {bullets.map((b, i) => (
            <div
              key={i}
              className="p-2.5 bg-white border border-amber-200 rounded space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-bold text-amber-900">
                  Card {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeBullet(i)}
                  className="text-[10.5px] text-rose-600 hover:text-rose-800 font-semibold"
                >
                  × Remove
                </button>
              </div>
              <input
                type="text"
                value={b.term}
                onChange={(e) => updateBullet(i, { term: e.target.value })}
                placeholder="Term (e.g. Choice)"
                className="w-full px-2 py-1 text-[12px] border border-amber-200 rounded bg-white font-bold"
              />
              <input
                type="text"
                value={b.hint ?? ""}
                onChange={(e) =>
                  updateBullet(i, { hint: e.target.value || undefined })
                }
                placeholder="Hint label (e.g. autonomy) — optional"
                className="w-full px-2 py-1 text-[11.5px] border border-amber-200 rounded bg-white placeholder-amber-300"
              />
              <textarea
                value={b.body}
                onChange={(e) => updateBullet(i, { body: e.target.value })}
                placeholder="Body paragraph — what this card explains."
                rows={3}
                className="w-full px-2 py-1.5 text-[12px] border border-amber-200 rounded bg-white placeholder-amber-300 resize-y"
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addBullet}
          className="mt-2 px-2.5 py-1 text-[11.5px] font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded transition-colors"
        >
          + Add card
        </button>
      </div>
    </div>
  );
}
