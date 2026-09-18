import { KnowledgeChunk } from '../models';
import {
  getEmbedding,
  cosineSimilarity,
  EMBEDDING_MODEL,
  EMBEDDING_PROVIDER,
  EMBEDDING_DIMENSION,
} from '../services/embeddingService';

export interface VectorSearchResult {
  chunkId: string;
  documentId: string;
  title: string;
  organization: string;
  snippet: string;
  score: number;
  topics: string[];
  environmentalVariables: string[];
  year?: number;
  url?: string;
}

export interface SearchParams {
  query: string;
  variables?: string[];
  topK?: number;
  threshold?: number;
}

export interface SearchOutput {
  results: VectorSearchResult[];
  totalCandidates: number;
  searchEngine: 'atlas_vector_search' | 'local_cosine_similarity';
}

export const ATLAS_VECTOR_INDEX_NAME = 'knowledge_chunks_vector_index';

/**
 * Searches for knowledge chunks semantically similar to the given query.
 * Attempts MongoDB Atlas Vector Search ($vectorSearch) first, smoothly falling back
 * to in-process cosine similarity filtering if running on local MongoDB.
 */
export async function searchSimilarChunks(params: SearchParams): Promise<SearchOutput> {
  const { query, variables, topK = 5, threshold = 0.0 } = params;

  if (!query || typeof query !== 'string' || query.trim() === '') {
    throw new Error('[Vector Search] Query string must be provided');
  }

  // Generate real 384-d normalized embedding for the query
  const queryVector = await getEmbedding(query.trim());

  // 1. Attempt Atlas Vector Search
  try {
    const atlasResults = await attemptAtlasVectorSearch(queryVector, variables, topK, threshold);
    if (atlasResults !== null) {
      return {
        results: atlasResults,
        totalCandidates: atlasResults.length,
        searchEngine: 'atlas_vector_search',
      };
    }
  } catch {
    // Atlas Vector Search not available on this MongoDB cluster (e.g. local community server)
    // Fallback cleanly to in-process cosine similarity
  }

  // 2. Local Cosine Similarity Fallback
  return await searchLocalCosine(queryVector, variables, topK, threshold);
}

/**
 * Attempts MongoDB Atlas $vectorSearch pipeline.
 * Returns null if the $vectorSearch stage is unrecognized or unsupported.
 */
async function attemptAtlasVectorSearch(
  queryVector: number[],
  variables?: string[],
  topK = 5,
  threshold = 0.0
): Promise<VectorSearchResult[] | null> {
  const filterStage: Record<string, unknown> = {};
  if (Array.isArray(variables) && variables.length > 0) {
    filterStage['metadata.environmentalVariables'] = { $in: variables };
  }

  const pipeline: any[] = [
    {
      $vectorSearch: {
        index: ATLAS_VECTOR_INDEX_NAME,
        path: 'embedding',
        queryVector,
        numCandidates: topK * 10,
        limit: topK,
        filter: Object.keys(filterStage).length > 0 ? filterStage : undefined,
      },
    },
    {
      $project: {
        _id: 1,
        documentId: 1,
        text: 1,
        metadata: 1,
        score: { $meta: 'vectorSearchScore' },
      },
    },
  ];

  try {
    const rawResults = await KnowledgeChunk.aggregate(pipeline).exec();

    if (!Array.isArray(rawResults)) {
      return null;
    }

    return rawResults
      .filter((r) => typeof r.score === 'number' && r.score >= threshold)
      .map((r) => {
        const meta = (r.metadata || {}) as Record<string, any>;
        return {
          chunkId: r._id.toString(),
          documentId: r.documentId?.toString() || '',
          title: typeof meta.title === 'string' ? meta.title : 'Untitled Document',
          organization: typeof meta.organization === 'string' ? meta.organization : 'Unknown',
          snippet: r.text || '',
          score: Math.round(r.score * 10000) / 10000,
          topics: Array.isArray(meta.topics) ? meta.topics : [],
          environmentalVariables: Array.isArray(meta.environmentalVariables) ? meta.environmentalVariables : [],
          year: typeof meta.year === 'number' ? meta.year : undefined,
          url: typeof meta.sourceUrl === 'string' ? meta.sourceUrl : undefined,
        };
      });
  } catch {
    // Pipeline error indicates Atlas Vector Search is not configured or unsupported
    return null;
  }
}

/**
 * High-performance local cosine similarity search over MongoDB documents.
 * Applies metadata filters in MongoDB query before calculating cosine similarity.
 */
async function searchLocalCosine(
  queryVector: number[],
  variables?: string[],
  topK = 5,
  threshold = 0.0
): Promise<SearchOutput> {
  // Build MongoDB filter query
  const queryFilter: Record<string, unknown> = {
    embeddingModel: EMBEDDING_MODEL,
    embeddingDimension: EMBEDDING_DIMENSION,
    embedding: { $exists: true, $ne: [] },
  };

  // Environmental variable filtering (pre-filtering in DB)
  if (Array.isArray(variables) && variables.length > 0) {
    queryFilter['metadata.environmentalVariables'] = { $in: variables };
  }

  // Fetch candidate chunks matching model and variable filters
  const candidateChunks = await KnowledgeChunk.find(
    queryFilter,
    '_id documentId text embedding metadata'
  ).lean();

  const scored: VectorSearchResult[] = [];

  for (const chunk of candidateChunks) {
    if (!chunk.embedding || chunk.embedding.length !== EMBEDDING_DIMENSION) {
      continue;
    }

    // Since both queryVector and stored chunk embeddings are L2 normalized,
    // cosine similarity is dot product
    const score = cosineSimilarity(queryVector, chunk.embedding);

    const meta = (chunk.metadata || {}) as Record<string, any>;

    if (score >= threshold) {
      scored.push({
        chunkId: chunk._id.toString(),
        documentId: chunk.documentId ? chunk.documentId.toString() : '',
        title: typeof meta.title === 'string' ? meta.title : 'Untitled Document',
        organization: typeof meta.organization === 'string' ? meta.organization : 'Unknown',
        snippet: chunk.text || '',
        score: Math.round(score * 10000) / 10000,
        topics: Array.isArray(meta.topics) ? meta.topics : [],
        environmentalVariables: Array.isArray(meta.environmentalVariables) ? meta.environmentalVariables : [],
        year: typeof meta.year === 'number' ? meta.year : undefined,
        url: typeof meta.sourceUrl === 'string' ? meta.sourceUrl : undefined,
      });
    }
  }

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  // Take topK
  const results = scored.slice(0, Math.max(1, topK));

  return {
    results,
    totalCandidates: candidateChunks.length,
    searchEngine: 'local_cosine_similarity',
  };
}
