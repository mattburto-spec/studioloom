/**
 * FrameworkAdapter — assessment framework ↔ neutral criterion taxonomy bridge.
 *
 * NOTE: signature diverges from neutral-criterion-taxonomy.md §6 (toLabel → string).
 * §6 is the historical contract; this implementation supersedes it with a
 * discriminated-union return to carry sentinel cases (implicit, not_assessed)
 * and format/context modifiers. See saveme for spec followup.
 *
 * Name collision note: src/lib/frameworks/index.ts is a unit-types registry
 * (myp_design, service_learning, etc.), NOT assessment frameworks. This file
 * is the assessment FrameworkAdapter per spec §6.
 *
 * FrameworkId mirrors the 8 keys of FRAMEWORK_VOCABULARY in
 * src/lib/ai/framework-vocabulary.ts. Kept inline to avoid a side-edit;
 * promote to a shared export if a third consumer appears.
 *
 * See: docs/specs/neutral-criterion-taxonomy.md §2–§6
 *      docs/projects/dimensions3-phase-2-brief.md §5 row 5.9
 */

import {
  NEUTRAL_CRITERION_KEYS,
  type NeutralCriterionKey,
} from "@/lib/pipeline/stages/stage4-neutral-validator";

import { MYP_MAPPING } from "./mappings/myp";
import { GCSE_MAPPING } from "./mappings/gcse";
import { A_LEVEL_MAPPING } from "./mappings/alevel";
import { IGCSE_MAPPING } from "./mappings/igcse";
import { ACARA_MAPPING } from "./mappings/acara";
import { PLTW_MAPPING } from "./mappings/pltw";
import { NESA_MAPPING } from "./mappings/nesa";
import { VICTORIAN_MAPPING } from "./mappings/victorian";

// ─── Types ────────────────────────────────────────────────────────────────

export type FrameworkId =
  | "IB_MYP"
  | "GCSE_DT"
  | "A_LEVEL_DT"
  | "IGCSE_DT"
  | "ACARA_DT"
  | "PLTW"
  | "NESA_DT"
  | "VIC_DT";

export type CriterionLabelFormat = "short" | "full" | "name";

export interface CriterionLabelOpts {
  format?: CriterionLabelFormat;
  context?: "exam_prep";
}

/**
 * Discriminated union — supersedes §6's `toLabel → string` contract so sentinel
 * cases can be carried alongside labels without magic strings.
 */
export type CriterionLabelResult =
  | {
      kind: "label";
      short: string;
      full: string;
      name: string;
    }
  | {
      kind: "implicit";
      mappedTo: NeutralCriterionKey;
      short: string;
      full: string;
      name: string;
      note: string;
    }
  | { kind: "not_assessed" };

export interface CriterionDef {
  short: string;
  full: string;
  name: string;
  neutralKeys: readonly NeutralCriterionKey[];
}

export interface FrameworkMapping {
  frameworkId: FrameworkId;
  criteria: readonly CriterionDef[];
  reverse: Record<NeutralCriterionKey, CriterionLabelResult>;
  /** Optional per-key override when opts.context === "exam_prep". */
  examPrep?: Partial<Record<NeutralCriterionKey, CriterionLabelResult>>;
}

export class UnknownFrameworkError extends Error {
  public readonly frameworkId: string;
  constructor(frameworkId: string) {
    super(
      `UnknownFrameworkError: "${frameworkId}" is not one of the 8 supported FrameworkIds. ` +
        `See docs/specs/neutral-criterion-taxonomy.md §3 for the list.`
    );
    this.name = "UnknownFrameworkError";
    this.frameworkId = frameworkId;
  }
}

// ─── Registry ─────────────────────────────────────────────────────────────

const MAPPINGS: Record<FrameworkId, FrameworkMapping> = {
  IB_MYP: MYP_MAPPING,
  GCSE_DT: GCSE_MAPPING,
  A_LEVEL_DT: A_LEVEL_MAPPING,
  IGCSE_DT: IGCSE_MAPPING,
  ACARA_DT: ACARA_MAPPING,
  PLTW: PLTW_MAPPING,
  NESA_DT: NESA_MAPPING,
  VIC_DT: VICTORIAN_MAPPING,
};

function getMapping(frameworkId: string): FrameworkMapping {
  const m = MAPPINGS[frameworkId as FrameworkId];
  if (!m) throw new UnknownFrameworkError(frameworkId);
  return m;
}

// ─── Neutral labels (framework-independent) ───────────────────────────────

const NEUTRAL_LABELS: Record<NeutralCriterionKey, string> = {
  researching: "Researching",
  analysing: "Analysing",
  designing: "Designing",
  creating: "Creating",
  evaluating: "Evaluating",
  reflecting: "Reflecting",
  communicating: "Communicating",
  planning: "Planning",
};

// ─── API ──────────────────────────────────────────────────────────────────

/**
 * Map a neutral key → framework display label.
 * Returns a discriminated result so callers can handle implicit / not_assessed
 * without magic strings. The optional `format` chooses which string field to
 * prefer on the caller side (short/full/name are all included on label+implicit
 * variants; callers pick whichever matches their render context).
 */
export function toLabel(
  key: NeutralCriterionKey,
  framework: FrameworkId,
  opts?: CriterionLabelOpts
): CriterionLabelResult {
  const mapping = getMapping(framework);
  if (opts?.context === "exam_prep" && mapping.examPrep?.[key]) {
    return mapping.examPrep[key]!;
  }
  return mapping.reverse[key];
}

/**
 * Map a framework criterion label → neutral key(s). Matches on short OR full,
 * case-insensitive. Returns [] for unknown labels (non-throwing — labels come
 * from user input / legacy data so soft-fail is the right default).
 */
export function fromLabel(
  frameworkLabel: string,
  framework: FrameworkId
): readonly NeutralCriterionKey[] {
  const mapping = getMapping(framework);
  const needle = frameworkLabel.trim().toLowerCase();
  const hit = mapping.criteria.find(
    (c) => c.short.toLowerCase() === needle || c.full.toLowerCase() === needle
  );
  return hit ? hit.neutralKeys : [];
}

/** Get all criterion defs for a framework (for teacher UI, dropdowns, etc). */
export function getCriterionLabels(
  framework: FrameworkId
): readonly CriterionDef[] {
  return getMapping(framework).criteria;
}

/**
 * Group neutral keys by framework criterion short key.
 * e.g. MYP → { A: ["researching","analysing"], B: ["designing","planning"], ... }
 */
export function getAssessmentGroups(
  framework: FrameworkId
): Record<string, readonly NeutralCriterionKey[]> {
  const mapping = getMapping(framework);
  const out: Record<string, readonly NeutralCriterionKey[]> = {};
  for (const c of mapping.criteria) out[c.short] = c.neutralKeys;
  return out;
}

/** Framework-independent display name for a neutral key (§2 labels). */
export function getNeutralLabel(key: NeutralCriterionKey): string {
  return NEUTRAL_LABELS[key];
}

/** Export for tests / admin tooling. */
export { NEUTRAL_CRITERION_KEYS };
export type { NeutralCriterionKey };
