"use client";

/**
 * ArchetypePicker — Q0 chip picker for blocks that are
 * archetype-driven (v1 Project Spec, v2 Product Brief).
 *
 * Extracted from v1's ProjectSpecResponse during the v2 split.
 * Universal across consumers; takes an array of archetypes
 * (allowing per-unit filtering in the future via the brief's
 * deferred `archetypeChoices` slot — for now both v1 and Product
 * Brief pass the full ARCHETYPE_LIST).
 */

/**
 * Picker only uses id + label + emoji. Structural type so both v1
 * ArchetypeDefinition (7-tuple slots) and v2 ProductBriefArchetype
 * (9-slot array) satisfy the contract without coupling.
 */
interface PickableArchetype {
  id: string;
  label: string;
  emoji: string;
}

interface Props {
  archetypes: PickableArchetype[];
  onPick: (id: string) => void;
  saving: boolean;
  /** Optional override of the picker heading. */
  heading?: string;
  /** Optional override of the picker subhead. */
  subhead?: string;
}

export function ArchetypePicker({
  archetypes,
  onPick,
  saving,
  heading = "Let's shape your project",
  subhead = "Pick the kind of thing you're going to design. You can't change this later, so think for a second.",
}: Props) {
  return (
    <div className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 via-purple-50/50 to-white p-6">
      <h3 className="text-lg font-semibold text-purple-900 mb-1">{heading}</h3>
      <p className="text-sm text-purple-700/80 mb-5">{subhead}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {archetypes.map((a) => (
          <button
            key={a.id}
            onClick={() => onPick(a.id)}
            disabled={saving}
            className="group flex flex-col items-start gap-2 rounded-xl border-2 border-purple-200 bg-white p-5 text-left transition hover:border-purple-500 hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="text-4xl">{a.emoji}</span>
            <span className="font-semibold text-purple-900 group-hover:text-purple-700">
              {a.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
