import type { LMSProvider, ProviderConfig } from "./types";
import { ManageBacProvider } from "./managebac";

/**
 * Factory function to create an LMS provider instance.
 * Adding a new LMS = import + one case statement.
 *
 * Currently supported:
 * - "managebac" — ManageBac REST API (auth-token header)
 *
 * Future providers (just add a case):
 * - "toddle"    — Toddle API
 * - "canvas"    — Canvas LMS API (OAuth2)
 * - "schoology" — Schoology API
 */
export function createLMSProvider(
  provider: string,
  config: ProviderConfig
): LMSProvider {
  switch (provider) {
    case "managebac": {
      if (!config.subdomain || !config.apiToken) {
        throw new Error("ManageBac requires subdomain and apiToken");
      }
      return new ManageBacProvider(config.subdomain, config.apiToken);
    }

    // Future providers:
    // case "toddle":
    //   return new ToddleProvider(config.subdomain!, config.apiToken!);
    // case "canvas":
    //   return new CanvasProvider(config.subdomain!, config.apiToken!);
    // case "schoology":
    //   return new SchoologyProvider(config.subdomain!, config.apiToken!);

    default:
      throw new Error(`Unsupported LMS provider: ${provider}`);
  }
}

// Re-export types for convenience
export type { LMSProvider, LMSClass, LMSStudent, ProviderConfig } from "./types";
