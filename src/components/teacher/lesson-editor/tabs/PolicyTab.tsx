"use client";

/**
 * TG.0D.4 — Tab 5 (Policy)
 *
 * Grouping (Individual ✓ / Group greyed-out v1.1) + 2 notification toggles.
 * Policy tab ships separate per Matt's brief default — teachers see what's
 * coming.
 */

import type { Dispatch } from "react";
import type {
  SummativeAction,
  SummativeFormState,
} from "../summative-form-state";

interface PolicyTabProps {
  state: SummativeFormState;
  dispatch: Dispatch<SummativeAction>;
}

export default function PolicyTab({ state, dispatch }: PolicyTabProps) {
  const p = state.policy;
  return (
    <div className="space-y-4">
      {/* Grouping */}
      <fieldset>
        <legend className="le-cap text-[var(--le-ink-3)] mb-1.5">
          Submission grouping
        </legend>
        <div className="space-y-1">
          <label className="flex items-start gap-2 text-[11.5px] cursor-pointer hover:bg-[var(--le-paper)] rounded p-1.5">
            <input
              type="radio"
              name="grouping"
              checked={p.grouping === "individual"}
              onChange={() =>
                dispatch({
                  type: "setPolicyField",
                  field: "grouping",
                  value: "individual",
                })
              }
              className="mt-0.5 text-violet-600 focus:ring-violet-400"
              data-testid="policy-grouping-individual"
            />
            <span>
              <span className="font-semibold text-[var(--le-ink)]">
                Individual
              </span>
              <span className="block text-[10.5px] text-[var(--le-ink-3)]">
                Each student submits their own work
              </span>
            </span>
          </label>
          <label
            className="flex items-start gap-2 text-[11.5px] cursor-not-allowed opacity-50 rounded p-1.5"
            title="Coming soon — peer & group submissions land in v1.1"
          >
            <input
              type="radio"
              name="grouping"
              disabled
              checked={p.grouping === "group"}
              className="mt-0.5"
              data-testid="policy-grouping-group"
            />
            <span>
              <span className="font-semibold text-[var(--le-ink-3)]">Group</span>
              <span className="block text-[10.5px] text-[var(--le-ink-3)]">
                Coming soon — peer & group submissions in v1.1
              </span>
            </span>
          </label>
        </div>
      </fieldset>

      {/* Notifications */}
      <fieldset>
        <legend className="le-cap text-[var(--le-ink-3)] mb-1.5">
          Notifications
        </legend>
        <div className="space-y-1">
          <label className="flex items-start gap-2 text-[11.5px] cursor-pointer">
            <input
              type="checkbox"
              checked={p.notify_on_publish}
              onChange={(e) =>
                dispatch({
                  type: "setPolicyField",
                  field: "notify_on_publish",
                  value: e.target.checked,
                })
              }
              className="mt-0.5 rounded text-violet-600 focus:ring-violet-400"
              data-testid="policy-notify-publish"
            />
            <span>
              <span className="font-semibold text-[var(--le-ink)]">
                Notify students when task publishes
              </span>
              <span className="block text-[10.5px] text-[var(--le-ink-3)]">
                Email + in-app banner when status flips draft → published
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-[11.5px] cursor-pointer">
            <input
              type="checkbox"
              checked={p.notify_on_due_soon}
              onChange={(e) =>
                dispatch({
                  type: "setPolicyField",
                  field: "notify_on_due_soon",
                  value: e.target.checked,
                })
              }
              className="mt-0.5 rounded text-violet-600 focus:ring-violet-400"
              data-testid="policy-notify-due-soon"
            />
            <span>
              <span className="font-semibold text-[var(--le-ink)]">
                Notify students 48 hours before due date
              </span>
              <span className="block text-[10.5px] text-[var(--le-ink-3)]">
                Skipped automatically if no due date is set on the Timeline tab
              </span>
            </span>
          </label>
        </div>
      </fieldset>
    </div>
  );
}
