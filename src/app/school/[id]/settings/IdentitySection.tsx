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
    const newValue = fields[key].value;
    if (newValue === (currentValue ?? "")) return; // no-op
    updateField(key, { saving: true, error: null, status: null });
    try {
      const res = await fetch(`/api/school/${schoolId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          changeType: key,
          currentValue,
          newValue: key === "school_city" && newValue === "" ? null : newValue,
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
        status:
          body.applied === true
            ? { kind: "applied" }
            : { kind: "pending", expiresAt: body.expiresAt },
      });
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
    options?: { type?: string; help?: string }
  ) {
    const state = fields[key];
    const dirty = state.value !== (initialValue ?? "");
    const isHighStakes = HIGH_STAKES_FIELDS.has(key);
    const willPropose = isHighStakes && !bootstrapActive;

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
          <input
            id={key}
            type={options?.type ?? "text"}
            value={state.value}
            onChange={(e) => updateField(key, { value: e.target.value })}
            disabled={state.saving}
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 disabled:opacity-50"
          />
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
        {renderField("school_country", "Country", initial.country, {
          help: "ISO 3166 alpha-2 code (e.g., CN, GB, AU, US).",
        })}
        {renderField("school_region", "Region", initial.region, {
          help: "Free-form region tag for governance scoping (default: 'default').",
        })}
        {renderField("school_timezone", "Timezone", initial.timezone, {
          help: "IANA timezone (e.g., Asia/Shanghai, Australia/Sydney).",
        })}
        {renderField("default_locale", "Default locale", initial.default_locale, {
          help: "ISO 639 code (e.g., 'en', 'zh-CN').",
        })}
      </div>
    </section>
  );
}
