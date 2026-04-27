/* UnitsGrid resolver — flattens DashboardClass.units[] into one card
 * per (class × unit) entry, joined with UnmarkedWorkItem[] for the
 * ungraded pile indicator. Keeps the 2-column Bold layout sorted so
 * live-wire units (in-progress + ungraded) land top-left.
 */

import type {
  DashboardClass,
  DashboardUnit,
  UnmarkedWorkItem,
} from "@/types/dashboard";
import { classColor } from "./nav-config";

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=900&h=600&fit=crop";

const UNIT_TYPE_LABEL: Record<string, string> = {
  design: "Design & Technology",
  service: "Service as Action",
  pp: "Personal Project",
  inquiry: "Inquiry",
};

/** Badge kinds the Bold UnitCard renders in its top-right corner.
 *  Narrowed from the mock's `pink-re | amber | gray` to signals we
 *  actually have: "fork" (class-local fork active), "ungraded"
 *  (pieces waiting), "nm" (Melbourne Metrics enabled). */
export type UnitBadgeKind = "fork" | "ungraded" | "nm";

export interface UnitCardData {
  /** Stable key: classId + unitId. */
  key: string;
  classId: string;
  unitId: string;
  title: string;
  /** "Design & Technology" / "Service as Action" / … or empty. */
  kicker: string;
  /** Owning class name. */
  classTag: string;
  /** Hash-derived class color. */
  color: string;
  /** Paired tint (~85% toward white). */
  tint: string;
  students: number;
  /** 0-100 completionPct from DashboardUnit. */
  progress: number;
  /** units.thumbnail_url or FALLBACK_IMG. */
  img: string;
  /** Count of ungraded pages across all students in this class+unit. */
  ungradedCount: number;
  badges: UnitBadgeKind[];
}

/** Lighten towards white by `factor` (0-1, 1 = white). Matches
 *  current-period.ts `tint`. Kept local so this module doesn't have
 *  to import private helpers from there. */
function tint(hex: string, factor: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const mix = (c: number) => Math.round(c + (255 - c) * factor);
  const r = mix((n >> 16) & 0xff);
  const g = mix((n >> 8) & 0xff);
  const b = mix(n & 0xff);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function kickerFor(unit: DashboardUnit): string {
  if (!unit.unitType) return "";
  return UNIT_TYPE_LABEL[unit.unitType] ?? "";
}

function badgesFor(
  unit: DashboardUnit,
  ungradedCount: number,
): UnitBadgeKind[] {
  const out: UnitBadgeKind[] = [];
  if (ungradedCount > 0) out.push("ungraded");
  if (unit.isForked) out.push("fork");
  if (unit.nmEnabled) out.push("nm");
  return out;
}

/** Build one UnitCardData per (class × unit) entry, sorted so the
 *  most-active (highest in-progress + ungraded) lands first. */
export function buildUnitCards(
  classes: DashboardClass[],
  unmarkedWork: UnmarkedWorkItem[],
): UnitCardData[] {
  // Pre-index ungradedCount by classId+unitId.
  const ungradedByKey = new Map<string, number>();
  for (const w of unmarkedWork) {
    const key = `${w.classId}:${w.unitId}`;
    ungradedByKey.set(key, (ungradedByKey.get(key) ?? 0) + w.completedPages);
  }

  const cards: UnitCardData[] = [];
  for (const cls of classes) {
    const color = classColor(cls.id).color;
    const tintColor = tint(color, 0.85);
    for (const unit of cls.units) {
      const key = `${cls.id}-${unit.unitId}`;
      const ungradedCount =
        ungradedByKey.get(`${cls.id}:${unit.unitId}`) ?? 0;
      cards.push({
        key,
        classId: cls.id,
        unitId: unit.unitId,
        title: unit.unitTitle,
        kicker: kickerFor(unit),
        classTag: cls.name,
        color,
        tint: tintColor,
        students: cls.studentCount,
        progress: unit.completionPct,
        img: unit.thumbnailUrl || FALLBACK_IMG,
        ungradedCount,
        badges: badgesFor(unit, ungradedCount),
      });
    }
  }

  // Sort: ungraded-heaviest first, then most-progressed, then alpha by
  // title as a stable final tiebreak.
  cards.sort((a, b) => {
    if (a.ungradedCount !== b.ungradedCount) {
      return b.ungradedCount - a.ungradedCount;
    }
    if (a.progress !== b.progress) {
      return b.progress - a.progress;
    }
    return a.title.localeCompare(b.title);
  });

  return cards;
}
