/**
 * Admin Settings — read/write helpers for admin_settings table (migration 077).
 * Pipeline orchestrator reads these at run start.
 * /admin/controls UI reads/writes via API routes.
 * Changes audited to admin_audit_log (migration 079).
 */

import { AdminSettingKey } from "@/types/admin";

// ─── Types ───────────────────────────────────────────────────

export interface AdminSettings {
  [AdminSettingKey.STAGE_ENABLED]: Record<string, boolean>;
  [AdminSettingKey.COST_CEILING_PER_RUN]: number;
  [AdminSettingKey.COST_CEILING_PER_DAY]: number;
  [AdminSettingKey.MODEL_OVERRIDE]: Record<string, string | null>;
  [AdminSettingKey.STARTER_PATTERNS_ENABLED]: boolean;
}

type SupabaseClient = {
  from: (table: string) => any;
};

// ─── Defaults (must match migration 077 seed values exactly) ─

export const ADMIN_SETTINGS_DEFAULTS: AdminSettings = {
  [AdminSettingKey.STAGE_ENABLED]: {
    retrieve: true,
    assemble: true,
    gap_fill: true,
    polish: true,
    timing: true,
    score: true,
  },
  [AdminSettingKey.COST_CEILING_PER_RUN]: 5.0,
  [AdminSettingKey.COST_CEILING_PER_DAY]: 50.0,
  [AdminSettingKey.MODEL_OVERRIDE]: {},
  [AdminSettingKey.STARTER_PATTERNS_ENABLED]: true,
};

// ─── Read ────────────────────────────────────────────────────

export async function loadAdminSettings(
  supabase: SupabaseClient
): Promise<AdminSettings> {
  try {
    const { data, error } = await supabase
      .from("admin_settings")
      .select("key, value");

    if (error) throw error;
    if (!data || data.length === 0) {
      console.warn("[admin-settings] No rows found, using defaults");
      return { ...ADMIN_SETTINGS_DEFAULTS };
    }

    const settings = { ...ADMIN_SETTINGS_DEFAULTS };
    for (const row of data) {
      if (Object.values(AdminSettingKey).includes(row.key as AdminSettingKey)) {
        (settings as Record<string, unknown>)[row.key] = row.value;
      }
    }
    return settings;
  } catch (err) {
    console.warn(
      "[admin-settings] Failed to load, using defaults:",
      err instanceof Error ? err.message : err
    );
    return { ...ADMIN_SETTINGS_DEFAULTS };
  }
}

// ─── Write ───────────────────────────────────────────────────

export class InvalidSettingKeyError extends Error {
  constructor(key: string) {
    super(`Invalid setting key: ${key}`);
    this.name = "InvalidSettingKeyError";
  }
}

export class InvalidSettingValueError extends Error {
  constructor(key: string, reason: string) {
    super(`Invalid value for ${key}: ${reason}`);
    this.name = "InvalidSettingValueError";
  }
}

function validateSettingValue(key: AdminSettingKey, value: unknown): void {
  switch (key) {
    case AdminSettingKey.STAGE_ENABLED:
      if (typeof value !== "object" || value === null || Array.isArray(value))
        throw new InvalidSettingValueError(key, "must be an object");
      break;
    case AdminSettingKey.COST_CEILING_PER_RUN:
    case AdminSettingKey.COST_CEILING_PER_DAY:
      if (typeof value !== "number" || value < 0)
        throw new InvalidSettingValueError(key, "must be a non-negative number");
      break;
    case AdminSettingKey.MODEL_OVERRIDE:
      if (typeof value !== "object" || value === null || Array.isArray(value))
        throw new InvalidSettingValueError(key, "must be an object");
      break;
    case AdminSettingKey.STARTER_PATTERNS_ENABLED:
      if (typeof value !== "boolean")
        throw new InvalidSettingValueError(key, "must be a boolean");
      break;
  }
}

export async function updateAdminSetting(
  supabase: SupabaseClient,
  key: string,
  value: unknown,
  actorId: string | null
): Promise<{ previousValue: unknown }> {
  // Validate key
  if (!Object.values(AdminSettingKey).includes(key as AdminSettingKey)) {
    throw new InvalidSettingKeyError(key);
  }

  // Validate value shape
  validateSettingValue(key as AdminSettingKey, value);

  // Read current value for audit
  const { data: current } = await supabase
    .from("admin_settings")
    .select("value")
    .eq("key", key)
    .single();

  const previousValue = current?.value ?? null;

  // Update
  const { error } = await supabase
    .from("admin_settings")
    .update({ value, updated_by: actorId, updated_at: new Date().toISOString() })
    .eq("key", key);

  if (error) throw error;

  // Write audit row
  await supabase.from("admin_audit_log").insert({
    actor_id: actorId,
    action: "update_setting",
    target_table: "admin_settings",
    target_key: key,
    old_value: previousValue,
    new_value: value,
  });

  return { previousValue };
}

// ─── Pipeline helper ─────────────────────────────────────────

export function shouldEnforceCostCeilings(config: {
  sandboxMode?: boolean;
}): boolean {
  return config.sandboxMode !== true;
}
