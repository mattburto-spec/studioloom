/**
 * Ingestion Pass Registry
 *
 * Expandable pass architecture: each pass is a typed function in the registry.
 * Sandbox auto-generates panels from this array — one panel per pass.
 * Adding a future pass = write function + push to registry. No pipeline refactoring.
 */

import type { IngestionPass } from "./types";
import { passA } from "./pass-a";
import { passB } from "./pass-b";

/**
 * Ordered list of AI passes in the ingestion pipeline.
 * Non-AI stages (dedup, parse, extract) are handled separately by the orchestrator.
 */
export const ingestionPasses: IngestionPass<any, any>[] = [passA, passB];

/** Look up a pass by ID. */
export function getPass(id: string): IngestionPass<any, any> | undefined {
  return ingestionPasses.find((p) => p.id === id);
}
