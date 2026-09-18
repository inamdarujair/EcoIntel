export const EMBEDDING_PROVIDER = 'transformers' as const;
export const EMBEDDING_MODEL = 'all-MiniLM-L6-v2' as const;
export const EMBEDDING_DIMENSION = 384 as const;

// Module-level cache for pipeline instance
let pipelineInstance: any = null;
let pipelineLoadingPromise: Promise<any> | null = null;

/**
 * Lazily loads and caches the Transformers.js feature-extraction pipeline.
 */
export async function getExtractorPipeline(): Promise<any> {
  if (pipelineInstance) {
    return pipelineInstance;
  }

  if (pipelineLoadingPromise) {
    return pipelineLoadingPromise;
  }

  pipelineLoadingPromise = (async () => {
    // Dynamic import to avoid overhead when not performing embedding tasks
    const { pipeline } = await import('@xenova/transformers');
    const extractor = await pipeline('feature-extraction', `Xenova/${EMBEDDING_MODEL}`);
    pipelineInstance = extractor;
    return extractor;
  })();

  return pipelineLoadingPromise;
}

/**
 * Normalizes a vector to unit length (L2 norm = 1.0).
 */
export function normalizeL2(vector: number[]): number[] {
  let sumSq = 0;
  for (let i = 0; i < vector.length; i++) {
    sumSq += vector[i] * vector[i];
  }
  const norm = Math.sqrt(sumSq);
  if (norm === 0 || !isFinite(norm)) {
    return vector;
  }
  return vector.map((v) => v / norm);
}

/**
 * Calculates cosine similarity between two vectors.
 * If vectors are already unit-normalized, this is equivalent to dot product.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    const a = vecA[i];
    const b = vecB[i];
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0 || !isFinite(denom)) {
    return 0;
  }

  return dotProduct / denom;
}

/**
 * Generates a real 384-dimensional normalized embedding for a text string.
 */
export async function getEmbedding(text: string): Promise<number[]> {
  if (!text || typeof text !== 'string' || text.trim() === '') {
    throw new Error('[Embedding Error] Text must be a non-empty string');
  }

  const extractor = await getExtractorPipeline();
  const output = await extractor(text.trim(), { pooling: 'mean', normalize: true });

  const rawArray: number[] = Array.from(output.data);

  if (rawArray.length !== EMBEDDING_DIMENSION) {
    throw new Error(
      `[Embedding Error] Expected embedding dimension ${EMBEDDING_DIMENSION}, got ${rawArray.length}`
    );
  }

  // Ensure all values are finite numbers
  for (let i = 0; i < rawArray.length; i++) {
    if (!isFinite(rawArray[i])) {
      throw new Error(`[Embedding Error] Non-finite value encountered in vector at index ${i}`);
    }
  }

  return normalizeL2(rawArray);
}

/**
 * Generates embeddings for a batch of text strings.
 */
export async function getBatchEmbeddings(texts: string[]): Promise<number[][]> {
  if (!Array.isArray(texts) || texts.length === 0) {
    return [];
  }

  const results: number[][] = [];
  for (const text of texts) {
    const embedding = await getEmbedding(text);
    results.push(embedding);
  }
  return results;
}

/**
 * Checks if a chunk already possesses a valid, compatible embedding.
 */
export function isEmbeddingValid(chunk: {
  embedding?: number[];
  embeddingDimension?: number;
  embeddingModel?: string;
  embeddingProvider?: string;
}): boolean {
  if (!chunk.embedding || !Array.isArray(chunk.embedding) || chunk.embedding.length !== EMBEDDING_DIMENSION) {
    return false;
  }

  if (chunk.embeddingDimension !== EMBEDDING_DIMENSION) {
    return false;
  }

  if (chunk.embeddingModel !== EMBEDDING_MODEL) {
    return false;
  }

  if (chunk.embeddingProvider !== EMBEDDING_PROVIDER) {
    return false;
  }

  return true;
}
