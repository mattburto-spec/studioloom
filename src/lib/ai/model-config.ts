/**
 * AI Model Config — Runtime Loader
 *
 * Loads config from the ai_model_config table, merges with hardcoded defaults,
 * and caches for 60 seconds. Every generation function calls getModelConfig()
 * once per request.
 *
 * An empty DB config {} returns all hardcoded defaults — zero risk of breakage.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { AIModelConfig, ResolvedModelConfig } from "@/types/ai-model-config";
import { DEFAULT_MODEL_CONFIG } from "./model-config-defaults";

// =========================================================================
// In-memory cache (60s TTL)
// =========================================================================

let cachedConfig: ResolvedModelConfig | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000;

/**
 * Deep merge overrides onto defaults.
 * Only non-undefined override values replace defaults.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepMerge<T>(defaults: T, overrides: Partial<T> | undefined): T {
  if (!overrides) return { ...defaults };

  const result = { ...defaults } as any;
  const defs = defaults as any;
  const ovr = overrides as any;

  for (const key of Object.keys(ovr)) {
    const overrideVal = ovr[key];
    if (overrideVal === undefined || overrideVal === null) continue;

    const defaultVal = defs[key];
    if (
      typeof defaultVal === "object" &&
      defaultVal !== null &&
      !Array.isArray(defaultVal) &&
      typeof overrideVal === "object" &&
      !Array.isArray(overrideVal)
    ) {
      result[key] = deepMerge(defaultVal, overrideVal);
    } else {
      result[key] = overrideVal;
    }
  }
  return result as T;
}

/**
 * Resolve a full config by merging DB overrides onto defaults.
 */
function resolveConfig(overrides: AIModelConfig): ResolvedModelConfig {
  const d = DEFAULT_MODEL_CONFIG;

  // Timing profiles need special handling — merge per-year
  let timingProfiles = { ...d.timingProfiles };
  if (overrides.timingProfiles) {
    for (const yearStr of Object.keys(overrides.timingProfiles)) {
      const year = parseInt(yearStr, 10);
      if (d.timingProfiles[year] && overrides.timingProfiles[year]) {
        timingProfiles[year] = {
          ...d.timingProfiles[year],
          ...overrides.timingProfiles[year],
        };
      }
    }
  }

  return {
    generationEmphasis: deepMerge(d.generationEmphasis, overrides.generationEmphasis),
    timingProfiles,
    qualityWeights: deepMerge(d.qualityWeights, overrides.qualityWeights),
    structuralThresholds: deepMerge(d.structuralThresholds, overrides.structuralThresholds),
    feedbackWeights: deepMerge(d.feedbackWeights, overrides.feedbackWeights),
    ragWeights: deepMerge(d.ragWeights, overrides.ragWeights),
    relativeEmphasis: deepMerge(d.relativeEmphasis, overrides.relativeEmphasis),
    studentAssistant: deepMerge(d.studentAssistant, overrides.studentAssistant),
  };
}

/**
 * Load the current model config.
 * Returns resolved config with 60s cache.
 * Falls back to all defaults if DB is unavailable.
 */
export async function getModelConfig(): Promise<ResolvedModelConfig> {
  const now = Date.now();
  if (cachedConfig && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedConfig;
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("ai_model_config")
      .select("config")
      .eq("id", "default")
      .single();

    if (error || !data) {
      // Table doesn't exist yet or empty — use defaults
      cachedConfig = { ...DEFAULT_MODEL_CONFIG };
    } else {
      cachedConfig = resolveConfig((data.config as AIModelConfig) || {});
    }
  } catch {
    // DB unavailable — use defaults silently
    cachedConfig = { ...DEFAULT_MODEL_CONFIG };
  }

  cacheTimestamp = now;
  return cachedConfig;
}

/**
 * Resolve config from raw overrides (for test sandbox).
 * Does NOT touch the cache or DB.
 */
export function resolveConfigFromOverrides(overrides: AIModelConfig): ResolvedModelConfig {
  return resolveConfig(overrides);
}

/**
 * Invalidate the cache so next call fetches fresh from DB.
 */
export function invalidateConfigCache(): void {
  cachedConfig = null;
  cacheTimestamp = 0;
}

/**
 * Save config to the database and invalidate cache.
 */
export async function saveModelConfig(
  config: AIModelConfig,
  userEmail: string,
  changeNote?: string
): Promise<void> {
  const supabase = createAdminClient();

  // Upsert the config
  await supabase
    .from("ai_model_config")
    .upsert({
      id: "default",
      config,
      updated_by: userEmail,
      updated_at: new Date().toISOString(),
    });

  // Insert history record
  await supabase
    .from("ai_model_config_history")
    .insert({
      config,
      changed_by: userEmail,
      changed_at: new Date().toISOString(),
      change_note: changeNote || null,
    });

  invalidateConfigCache();
}

/**
 * Get raw config from DB (for admin UI to show current overrides).
 */
export async function getRawConfig(): Promise<AIModelConfig> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("ai_model_config")
      .select("config, updated_by, updated_at")
      .eq("id", "default")
      .single();

    return (data?.config as AIModelConfig) || {};
  } catch {
    return {};
  }
}
