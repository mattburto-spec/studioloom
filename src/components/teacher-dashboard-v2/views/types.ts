/* Shared props every program-specific dashboard view receives.
 *
 * TeacherDashboardClient does all the data loading + filtering once and
 * hands a view the same shape — individual views then pick which slices
 * they actually render. A PYPX view, for example, ignores the schedule
 * and bloom-bucketed insights in favour of project-level data.
 */

import type { RailCard } from "../current-period";
import type { CurrentPeriod } from "../current-period";
import type { InsightBucket } from "../insight-buckets";
import type { UnitCardData } from "../unit-cards";
import type { DashboardClass } from "@/types/dashboard";
import type { Teacher } from "@/types";

export interface DashboardViewProps {
  teacher: Teacher | null;
  /** Already-filtered-by-scope classes. */
  classes: DashboardClass[];
  /** Resolved current-or-next period from the schedule endpoint. */
  currentPeriod: CurrentPeriod | null;
  railCards: RailCard[];
  insightBuckets: InsightBucket[];
  unitCards: UnitCardData[];
  now: Date;
  dashboardLoaded: boolean;
  scheduleLoaded: boolean;
}

export type DashboardView = (props: DashboardViewProps) => React.ReactElement | null;
