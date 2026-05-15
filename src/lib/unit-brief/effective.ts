/**
 * Effective-brief merge — Phase F.D.
 *
 * Computes what a student actually sees in the BriefDrawer given the
 * three sources of brief content:
 *
 *   1. Class-shared brief        — `unit_briefs` row (teacher-authored)
 *   2. Choice-card brief template — per-card template (teacher-authored)
 *   3. Student override          — `student_briefs` row (student-authored)
 *
 * Precedence per field:
 *   - locked from card (if card has template AND card.brief_locks[field])
 *     OR locked from unit (if unit.locks[field])
 *     → renders the LOCKED source's value, read-only.
 *   - else student override exists → renders student value, editable.
 *   - else card template value → renders card value, editable (starter).
 *   - else unit_brief value → renders unit value, editable (starter).
 *   - else empty → renders blank/placeholder, editable.
 *
 * Notes:
 *   - Lock map sources don't merge — when a choice card has a brief
 *     template, ITS lock map wins entirely; the unit_brief lock map is
 *     ignored. This keeps a card's "non-negotiables" predictable
 *     regardless of unit-level state.
 *   - Constraints fields are handled per-key (constraints.budget etc.)
 *     so a teacher can lock "budget" via the card and leave "audience"
 *     student-authored.
 *   - We never write to student_briefs for fields that are locked —
 *     the editor only mounts editable inputs for unlocked paths.
 */

import type {
  DesignConstraints,
  DesignDimensions,
  EffectiveBriefField,
  EffectiveBriefFieldSource,
  LockableField,
  StudentBrief,
  UnitBrief,
  UnitBriefConstraints,
  UnitBriefLocks,
} from "@/types/unit-brief";

export interface CardTemplate {
  cardId: string;
  cardLabel: string;
  brief_text: string | null;
  brief_constraints: UnitBriefConstraints;
  brief_locks: UnitBriefLocks;
}

export interface EffectiveBriefInputs {
  unitBrief: UnitBrief | null;
  cardTemplate: CardTemplate | null;
  studentBrief: StudentBrief | null;
}

/**
 * The merged shape rendered by the student drawer. Each field carries
 * its value + lock state + source so the drawer can pick read-only
 * vs editable + render an attribution chip.
 */
export interface EffectiveBrief {
  brief_text: EffectiveBriefField<string>;
  diagram_url: EffectiveBriefField<string>;
  constraints: {
    dimensions: EffectiveBriefField<DesignDimensions>;
    materials_whitelist: EffectiveBriefField<string[]>;
    budget: EffectiveBriefField<string>;
    audience: EffectiveBriefField<string>;
    must_include: EffectiveBriefField<string[]>;
    must_avoid: EffectiveBriefField<string[]>;
  };
}

// Helper: did the field have an "authored" value in this source?
function hasValue<T>(v: T | null | undefined): v is T {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v as Record<string, unknown>).length > 0;
  return true;
}

function unitDesignData(brief: UnitBrief | null): DesignConstraints {
  if (!brief) return {};
  return brief.constraints.archetype === "design" ? brief.constraints.data : {};
}

function cardDesignData(card: CardTemplate | null): DesignConstraints {
  if (!card) return {};
  return card.brief_constraints.archetype === "design"
    ? card.brief_constraints.data
    : {};
}

function studentDesignData(brief: StudentBrief | null): DesignConstraints {
  if (!brief) return {};
  return brief.constraints.archetype === "design" ? brief.constraints.data : {};
}

/**
 * Locks precedence: card wins entirely when card has a template;
 * otherwise unit_brief.locks. NEVER both — keeps "this card's
 * non-negotiables" deterministic regardless of unit-level state.
 */
function effectiveLocks(
  unitBrief: UnitBrief | null,
  cardTemplate: CardTemplate | null,
): UnitBriefLocks {
  if (cardTemplate) return cardTemplate.brief_locks;
  return unitBrief?.locks ?? {};
}

function isLocked(
  field: LockableField,
  unitBrief: UnitBrief | null,
  cardTemplate: CardTemplate | null,
): boolean {
  return effectiveLocks(unitBrief, cardTemplate)[field] === true;
}

/**
 * Resolve one field. Locked → locked source's value (card if card has
 * template, else unit). Unlocked → student override if present, else
 * card starter if card has template, else unit starter, else empty.
 */
function resolveField<T>(opts: {
  field: LockableField;
  unitValue: T | null;
  cardValue: T | null;
  studentValue: T | null;
  unitBrief: UnitBrief | null;
  cardTemplate: CardTemplate | null;
}): EffectiveBriefField<T> {
  const { field, unitValue, cardValue, studentValue, unitBrief, cardTemplate } = opts;
  const locked = isLocked(field, unitBrief, cardTemplate);

  if (locked) {
    // Locked: card's value if card has template, else unit's.
    if (cardTemplate) {
      return { value: cardValue, locked: true, source: "card" };
    }
    return { value: unitValue, locked: true, source: "teacher" };
  }

  // Unlocked: student override > card starter > unit starter > empty.
  if (hasValue(studentValue)) {
    return { value: studentValue, locked: false, source: "student" };
  }
  if (cardTemplate && hasValue(cardValue)) {
    return { value: cardValue, locked: false, source: "card" };
  }
  if (hasValue(unitValue)) {
    return { value: unitValue, locked: false, source: "teacher" };
  }
  const empty: EffectiveBriefFieldSource = "empty";
  return { value: null, locked: false, source: empty };
}

/**
 * Compute the effective brief. Pure function — no IO.
 */
export function computeEffectiveBrief({
  unitBrief,
  cardTemplate,
  studentBrief,
}: EffectiveBriefInputs): EffectiveBrief {
  const unitData = unitDesignData(unitBrief);
  const cardData = cardDesignData(cardTemplate);
  const studentData = studentDesignData(studentBrief);

  return {
    brief_text: resolveField<string>({
      field: "brief_text",
      unitValue: unitBrief?.brief_text ?? null,
      cardValue: cardTemplate?.brief_text ?? null,
      studentValue: studentBrief?.brief_text ?? null,
      unitBrief,
      cardTemplate,
    }),
    diagram_url: resolveField<string>({
      field: "diagram_url",
      unitValue: unitBrief?.diagram_url ?? null,
      cardValue: null, // cards don't carry diagrams in v1
      studentValue: studentBrief?.diagram_url ?? null,
      unitBrief,
      cardTemplate,
    }),
    constraints: {
      dimensions: resolveField<DesignDimensions>({
        field: "constraints.dimensions",
        unitValue: unitData.dimensions ?? null,
        cardValue: cardData.dimensions ?? null,
        studentValue: studentData.dimensions ?? null,
        unitBrief,
        cardTemplate,
      }),
      materials_whitelist: resolveField<string[]>({
        field: "constraints.materials_whitelist",
        unitValue: unitData.materials_whitelist ?? null,
        cardValue: cardData.materials_whitelist ?? null,
        studentValue: studentData.materials_whitelist ?? null,
        unitBrief,
        cardTemplate,
      }),
      budget: resolveField<string>({
        field: "constraints.budget",
        unitValue: unitData.budget ?? null,
        cardValue: cardData.budget ?? null,
        studentValue: studentData.budget ?? null,
        unitBrief,
        cardTemplate,
      }),
      audience: resolveField<string>({
        field: "constraints.audience",
        unitValue: unitData.audience ?? null,
        cardValue: cardData.audience ?? null,
        studentValue: studentData.audience ?? null,
        unitBrief,
        cardTemplate,
      }),
      must_include: resolveField<string[]>({
        field: "constraints.must_include",
        unitValue: unitData.must_include ?? null,
        cardValue: cardData.must_include ?? null,
        studentValue: studentData.must_include ?? null,
        unitBrief,
        cardTemplate,
      }),
      must_avoid: resolveField<string[]>({
        field: "constraints.must_avoid",
        unitValue: unitData.must_avoid ?? null,
        cardValue: cardData.must_avoid ?? null,
        studentValue: studentData.must_avoid ?? null,
        unitBrief,
        cardTemplate,
      }),
    },
  };
}

/**
 * Lookup: is this field locked given the current inputs?
 * Convenience for editor sites that only need the lock state.
 */
export function isFieldLocked(
  field: LockableField,
  inputs: { unitBrief: UnitBrief | null; cardTemplate: CardTemplate | null },
): boolean {
  return isLocked(field, inputs.unitBrief, inputs.cardTemplate);
}
