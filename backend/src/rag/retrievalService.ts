import { searchSimilarChunks, VectorSearchResult } from './vectorStore';

export const DEFAULT_MIN_SCORE_THRESHOLD = 0.40;

export interface EvidenceItem {
  chunkId: string;
  documentId: string;
  text: string;
  title: string;
  organization: string;
  year?: number;
  url?: string;
  score: number;
  isShared?: boolean;
  topics?: string[];
  environmentalVariables?: string[];
}

export interface RetrieveEvidenceOptions {
  queryText: string;
  variables?: string[];
  topK?: number;
  minScoreThreshold?: number;
}

export interface DetailedRetrievalResult {
  query: string;
  status: 'sufficient' | 'insufficient_evidence';
  evidence: EvidenceItem[];
  totalCandidates: number;
  thresholdApplied: number;
  message?: string;
}

export interface PathwayQuery {
  pathwayId: string;
  queryText: string;
  variables?: string[];
  topK?: number;
  minScoreThreshold?: number;
}

export interface PathwayEvidenceResult {
  pathwayId: string;
  queryText: string;
  variables?: string[];
  status: 'sufficient' | 'insufficient_evidence';
  evidence: EvidenceItem[];
}

export interface BatchPathwayRetrievalResult {
  pathways: Record<string, PathwayEvidenceResult>;
  uniqueEvidenceCount: number;
  sharedEvidenceCount: number;
}

/**
 * Service class and functional API for targeted RAG retrieval.
 * Can be imported as an object (RetrievalService) or individual functions.
 */
export class RetrievalService {
  /**
   * Retrieves targeted evidence items for a given query text and environmental variables.
   * Enforces a minimum relevance threshold; if no chunks exceed the threshold, returns an empty array.
   */
  public static async retrieveEvidence(
    queryText: string,
    variables?: string[],
    topK: number = 5,
    minScoreThreshold: number = DEFAULT_MIN_SCORE_THRESHOLD
  ): Promise<EvidenceItem[]> {
    if (!queryText || typeof queryText !== 'string' || queryText.trim() === '') {
      return [];
    }

    const searchOutput = await searchSimilarChunks({
      query: queryText.trim(),
      variables,
      topK,
      threshold: minScoreThreshold,
    });

    return searchOutput.results.map((r: VectorSearchResult) => ({
      chunkId: r.chunkId,
      documentId: r.documentId,
      text: r.snippet,
      title: r.title,
      organization: r.organization,
      year: r.year,
      url: r.url,
      score: r.score,
      topics: r.topics,
      environmentalVariables: r.environmentalVariables,
      isShared: false,
    }));
  }

  /**
   * Detailed evidence retrieval returning explicit 'sufficient' vs 'insufficient_evidence' status.
   */
  public static async retrieveEvidenceDetailed(
    options: RetrieveEvidenceOptions
  ): Promise<DetailedRetrievalResult> {
    const {
      queryText,
      variables,
      topK = 5,
      minScoreThreshold = DEFAULT_MIN_SCORE_THRESHOLD,
    } = options;

    if (!queryText || typeof queryText !== 'string' || queryText.trim() === '') {
      return {
        query: queryText || '',
        status: 'insufficient_evidence',
        evidence: [],
        totalCandidates: 0,
        thresholdApplied: minScoreThreshold,
        message: 'Query text must be a non-empty string.',
      };
    }

    const searchOutput = await searchSimilarChunks({
      query: queryText.trim(),
      variables,
      topK,
      threshold: minScoreThreshold,
    });

    const evidence: EvidenceItem[] = searchOutput.results.map((r: VectorSearchResult) => ({
      chunkId: r.chunkId,
      documentId: r.documentId,
      text: r.snippet,
      title: r.title,
      organization: r.organization,
      year: r.year,
      url: r.url,
      score: r.score,
      topics: r.topics,
      environmentalVariables: r.environmentalVariables,
      isShared: false,
    }));

    const status = evidence.length > 0 ? 'sufficient' : 'insufficient_evidence';

    return {
      query: queryText.trim(),
      status,
      evidence,
      totalCandidates: searchOutput.totalCandidates,
      thresholdApplied: minScoreThreshold,
      message:
        status === 'insufficient_evidence'
          ? `No scientific evidence exceeded the relevance threshold of ${minScoreThreshold}.`
          : undefined,
    };
  }

  /**
   * Multi-query batch method for reasoning pathways.
   * Retrieves evidence per pathway and detects shared chunks, marking isShared: true
   * without omitting them from either pathway.
   */
  public static async retrieveForPathways(
    pathwayQueries: PathwayQuery[]
  ): Promise<BatchPathwayRetrievalResult> {
    if (!Array.isArray(pathwayQueries) || pathwayQueries.length === 0) {
      return {
        pathways: {},
        uniqueEvidenceCount: 0,
        sharedEvidenceCount: 0,
      };
    }

    const pathwayResults: PathwayEvidenceResult[] = [];

    // 1. Retrieve evidence per pathway query
    for (const pq of pathwayQueries) {
      const topK = pq.topK ?? 5;
      const minThreshold = pq.minScoreThreshold ?? DEFAULT_MIN_SCORE_THRESHOLD;

      const evidence = await RetrievalService.retrieveEvidence(
        pq.queryText,
        pq.variables,
        topK,
        minThreshold
      );

      pathwayResults.push({
        pathwayId: pq.pathwayId,
        queryText: pq.queryText,
        variables: pq.variables,
        status: evidence.length > 0 ? 'sufficient' : 'insufficient_evidence',
        evidence,
      });
    }

    // 2. Count occurrences of each chunkId across all pathways for deduplication / shared marking
    const chunkUsageCount = new Map<string, number>();
    for (const res of pathwayResults) {
      for (const item of res.evidence) {
        chunkUsageCount.set(item.chunkId, (chunkUsageCount.get(item.chunkId) || 0) + 1);
      }
    }

    // 3. Mark isShared: true on items appearing in multiple pathways
    let sharedCount = 0;
    for (const [, count] of chunkUsageCount.entries()) {
      if (count > 1) {
        sharedCount++;
      }
    }

    for (const res of pathwayResults) {
      for (const item of res.evidence) {
        const count = chunkUsageCount.get(item.chunkId) || 1;
        item.isShared = count > 1;
      }
    }

    // 4. Assemble grouped dictionary
    const pathwaysMap: Record<string, PathwayEvidenceResult> = {};
    for (const res of pathwayResults) {
      pathwaysMap[res.pathwayId] = res;
    }

    return {
      pathways: pathwaysMap,
      uniqueEvidenceCount: chunkUsageCount.size,
      sharedEvidenceCount: sharedCount,
    };
  }
}

// Export individual functions for convenient direct access
export const retrieveEvidence = RetrievalService.retrieveEvidence;
export const retrieveEvidenceDetailed = RetrievalService.retrieveEvidenceDetailed;
export const retrieveForPathways = RetrievalService.retrieveForPathways;
export default RetrievalService;
