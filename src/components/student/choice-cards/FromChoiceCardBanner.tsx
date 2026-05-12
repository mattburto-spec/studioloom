"use client";

// FromChoiceCardBanner — small contextual banner shown above the v2
// spec blocks (Product Brief / User Profile / Success Criteria) when a
// student previously picked a Choice Cards entry for this unit.
//
// Lets students see the wiring is intentional ("oh — this is filled in
// because of my earlier pick"). For Product Brief, also explains why
// the archetype was preselected.

interface Props {
  cardLabel: string;
  /** When true, mentions the archetype preselection too. */
  appliedArchetype?: boolean;
}

export default function FromChoiceCardBanner({ cardLabel, appliedArchetype }: Props) {
  return (
    <div className="mb-3 flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-[12px] text-amber-900 ring-1 ring-amber-200/70">
      <span aria-hidden>🃏</span>
      <span>
        From your card pick: <strong>{cardLabel}</strong>
        {appliedArchetype && " — archetype pre-selected"}
      </span>
    </div>
  );
}
