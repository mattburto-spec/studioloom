"use client";

/**
 * IdentitySection — Phase 4.4b editable identity panel.
 *
 * Wraps name / city / country / region / timezone / default_locale fields
 * in a form. Each field has its own Save button that fires PATCH
 * /api/school/[id]/settings with the appropriate change_type.
 *
 * Per §3.8 Q2 (context-aware tier resolution):
 *   - school_name, school_country, school_region, school_timezone are
 *     ALWAYS_HIGH_STAKES → outside bootstrap grace, click triggers a
 *     PENDING proposal (route returns 202; banner appears in pending
 *     proposals area)
 *   - school_city + default_locale are not in either ALWAYS set → fall
 *     back to low_stakes default → instant apply (route returns 200)
 *
 * Loading state per field while save is in-flight. Errors surface inline.
 *
 * 4.4c will add a confirm modal that surfaces the 3-way diff
 * (proposed-before → current → after) when the actor is the second
 * teacher hitting the route on a pending proposal.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  COUNTRY_OPTIONS,
  TIMEZONE_OPTIONS,
  LOCALE_OPTIONS,
} from "./option-lists";

type Props = {
  schoolId: string;
  initial: {
    name: string;
    city: string | null;
    country: string;
    region: string;
    timezone: string;
    default_locale: string;
  };
  /** Whether the school is in single-teacher bootstrap mode (high-stakes auto-confirms). */
  bootstrapActive: boolean;
};

type FieldKey =
  | "school_name"
  | "school_city"
  | "school_country"
  | "school_region"
  | "school_timezone"
  | "default_locale";

type FieldState = {
  value: string;
  saving: boolean;
  error: string | null;
  status: null | { kind: "applied" } | { kind: "pending"; expiresAt: string };
};

const HIGH_STAKES_FIELDS: ReadonlySet<FieldKey> = new Set([
  "school_name",
  "school_country",
  "school_region",
  "school_timezone",
]);

export function IdentitySection({ schoolId, initial, bootstrapActive }: Props) {
  const router = useRouter();
  const [fields, setFields] = useState<Record<FieldKey, FieldState>>({
    school_name: { value: initial.name, saving: false, error: null, status: null },
    school_city: {
      value: initial.city ?? "",
      saving: false,
      error: null,
      status: null,
    },
    school_country: {
      value: initial.country,
      saving: false,
      error: null,
      status: null,
    },
    school_region: {
      value: initial.region,
      saving: false,
      error: null,
      status: null,
    },
    school_timezone: {
      value: initial.timezone,
      saving: false,
      error: null,
      status: null,
    },
    default_locale: {
      value: initial.default_locale,
      saving: false,
      error: null,
      status: null,
    },
  });

  function updateField(key: FieldKey, patch: Partial<FieldState>) {
    setFields((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  async function save(key: FieldKey, currentValue: string | null) {
    // Hotfix C2 — trim whitespace at the client edge so trailing-space
    // typos don't sneak through. The server now also trims, but trimming
    // here means the dirty-check + the saved value are in sync.
    const trimmed = fields[key].value.trim();
    // For school_city, "" → null (city is optional); for others, "" is
    // an empty string (pre-existing behavior, not changed here).
    const sendValue =
      key === "school_city" && trimmed === "" ? null : trimmed;
    const compareValue =
      key === "school_city" && trimmed === "" ? null : trimmed;
    if (compareValue === currentValue) return; // no-op after trim

    updateField(key, { saving: true, error: null, status: null });
    try {
      const res = await fetch(`/api/school/${schoolId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          changeType: key,
          currentValue,
          newValue: sendValue,
        }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        updateField(key, {
          saving: false,
          error:
            body.message ??
            body.error ??
            `Save failed (HTTP ${res.status})`,
        });
        return;
      }
      updateField(key, {
        saving: false,
        error: null,
        // Reflect the trimmed value back into the input so the user sees
        // exactly what was saved
        value: trimmed,
        status:
          body.applied === true
            ? { kind: "applied" }
            : { kind: "pending", expiresAt: body.expiresAt },
      });
      // Hotfix C1 — refresh server data so the `initial.*` props
      // re-render with the saved value. Without this, the dirty-check
      // anchor stays at the page-load value; reverting a saved edit
      // back to the original input value reads as "not dirty" → Save
      // disabled → DB and UI desync.
      router.refresh();
    } catch (err) {
      updateField(key, {
        saving: false,
        error: err instanceof Error ? err.message : "Save failed",
      });
    }
  }

  function renderField(
    key: FieldKey,
    label: string,
    initialValue: string | null,
    options?: {
      type?: string;
      help?: string;
      /** Dropdown options. When provided, renders a <select> instead of <input>. */
      dropdown?: ReadonlyArray<{ value: string; label: string }>;
    }
  ) {
    const state = fields[key];
    // Hotfix C1 + C2 — compare trimmed values against the trimmed
    // initial. "Nanjing " (trailing whitespace) is NOT a meaningful
    // edit and should not enable Save. After router.refresh, initialValue
    // re-anchors to the saved value so the dirty check stays correct.
    const trimmedInput = state.value.trim();
    const trimmedInitial = (initialValue ?? "").trim();
    const dirty = trimmedInput !== trimmedInitial;
    const isHighStakes = HIGH_STAKES_FIELDS.has(key);
    const willPropose = isHighStakes && !bootstrapActive;
    const isDropdown = !!options?.dropdown;

    return (
      <div className="space-y-1.5">
        <label
          htmlFor={key}
          className="block text-xs font-medium text-gray-600"
        >
          {label}
          {isHighStakes && (
            <span
              className={
                "ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold " +
                (willPropose
                  ? "bg-amber-100 text-amber-800"
                  : "bg-purple-100 text-purple-800")
              }
            >
              {willPropose ? "high-stakes — needs 2 teachers" : "high-stakes (single-teacher: instant)"}
            </span>
          )}
        </label>
        <div className="flex gap-2 items-start">
          {isDropdown ? (
            <select
              id={key}
              value={state.value}
              onChange={(e) => updateField(key, { value: e.target.value })}
              disabled={state.saving}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 disabled:opacity-50 bg-white"
            >
              {/* Include the current value as the first option even if not
                  in the canonical list, so existing rows with values
                  outside the v1 dropdown set still render + remain
                  editable to a listed value. */}
              {options!.dropdown!.find((o) => o.value === state.value) ===
                undefined &&
                state.value !== "" && (
                  <option value={state.value}>
                    {state.value} (current)
                  </option>
                )}
              {options!.dropdown!.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={key}
              type={options?.type ?? "text"}
              value={state.value}
              onChange={(e) => updateField(key, { value: e.target.value })}
              disabled={state.saving}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 disabled:opacity-50"
            />
          )}
          <button
            type="button"
            onClick={() => save(key, initialValue)}
            disabled={!dirty || state.saving}
            className="px-3 py-2 text-xs font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-30 disabled:hover:bg-purple-600 transition-colors"
          >
            {state.saving
              ? "Saving…"
              : willPropose
                ? "Propose"
                : "Save"}
          </button>
        </div>
        {state.error && (
          <p className="text-xs text-red-600">{state.error}</p>
        )}
        {state.status?.kind === "applied" && (
          <p className="text-xs text-green-700">Saved ✓</p>
        )}
        {state.status?.kind === "pending" && (
          <p className="text-xs text-amber-700">
            Pending — needs another teacher to confirm by{" "}
            {new Date(state.status.expiresAt).toLocaleString()}
          </p>
        )}
        {options?.help && (
          <p className="text-[11px] text-gray-400">{options.help}</p>
        )}
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold text-gray-900">Identity</h2>
        <span className="text-[11px] text-gray-400">
          High-stakes fields {bootstrapActive ? "auto-confirm in single-teacher mode" : "require 2nd teacher confirm"}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {renderField("school_name", "School name", initial.name)}
        {renderField("school_city", "City", initial.city, {
          help: "Optional. Leave blank if unspecified.",
        })}
        {/* Hotfix U1 — Country dropdown (ISO 3166 alpha-2) */}
        {renderField("school_country", "Country", initial.country, {
          dropdown: COUNTRY_OPTIONS.map((c) => ({
            value: c.code,
            label: `${c.name} (${c.code})`,
          })),
        })}
        {/* Hotfix U2 — Region intentionally hidden from UI in v1.
            It's a governance-internal scoping field with no user-facing
            purpose; defaulting to 'default' is fine for all current
            schools. Surface in a later phase if/when regional governance
            policies are introduced. */}
        {/* Hotfix U1 — Timezone dropdown (IANA) */}
        {renderField("school_timezone", "Timezone", initial.timezone, {
          dropdown: TIMEZONE_OPTIONS,
        })}
        {/* Hotfix U1 — Default locale dropdown (ISO 639) */}
        {renderField(
          "default_locale",
          "Default locale",
          initial.default_locale,
          {
            dropdown: LOCALE_OPTIONS.map((l) => ({
              value: l.code,
              label: `${l.name}`,
            })),
          }
        )}
      </div>
    </section>
  );
}
