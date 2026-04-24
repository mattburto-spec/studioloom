/* Per-scope view registry. Add a new program-specific dashboard body
 * here and the client will pick it up automatically when the scope
 * chip lands on that program.
 *
 * Scope `"all"` + any unknown program → DefaultView (hero + rail +
 * insights + units + admin).
 * Scope `"pypx"` → PypxView (Exhibition banner + 5-phase strip +
 * shared insights/units/admin).
 *
 * Future phases will slot in:
 *   "service" → ServiceView
 *   "pp"      → PersonalProjectView
 *   "inquiry" → InquiryView (maybe — or folded into default)
 */

import { DefaultView } from "./DefaultView";
import { PypxView } from "./PypxView";
import type { DashboardView } from "./types";

const VIEW_REGISTRY: Record<string, DashboardView> = {
  pypx: PypxView,
};

export function resolveDashboardView(scope: string): DashboardView {
  return VIEW_REGISTRY[scope] ?? DefaultView;
}
