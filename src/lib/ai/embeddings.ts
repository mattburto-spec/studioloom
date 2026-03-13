/**
 * Voyage AI embedding utility.
 * Uses app-level API key (VOYAGE_API_KEY env var) for all embedding operations.
 * Model: voyage-3.5 (1024 dimensions)
 */

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_MODEL = "voyage-3.5";
const EMBEDDING_DIMS = 1024;

function getApiKey(): string {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) {
    throw new Error(
      "VOYAGE_API_KEY environment variable is not set. Required for knowledge base embeddings."
    );
  }
  return key;
}

interface VoyageResponse {
  data: Array<{ embedding: number[] }>;
  usage: { total_tokens: number };
}

/**
 * Embed a single text string. Returns a 1024-dimension vector.
 */
export async function embedText(text: string): Promise<number[]> {
  const [result] = await embedBatch([text]);
  return result;
}

/**
 * Embed multiple texts in a single API call (up to 128).
 * Returns array of 1024-dimension vectors in the same order as input.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  if (texts.length > 128) {
    throw new Error("Voyage API supports max 128 texts per batch");
  }

  const response = await fetch(VOYAGE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model: VOYAGE_MODEL,
      input: texts,
      output_dimension: EMBEDDING_DIMS,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Voyage API error (${response.status}): ${error}`);
  }

  const data: VoyageResponse = await response.json();
  return data.data.map((d) => d.embedding);
}

/**
 * Embed texts in batches, handling arrays larger than 128.
 */
export async function embedAll(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += 128) {
    const batch = texts.slice(i, i + 128);
    const embeddings = await embedBatch(batch);
    results.push(...embeddings);
  }
  return results;
}

export { EMBEDDING_DIMS };
