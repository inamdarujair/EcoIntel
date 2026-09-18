import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { KnowledgeDocument, KnowledgeChunk } from '../models';
import { ingestKnowledgeBase } from '../services/ingestionService';
import { RetrievalService, DEFAULT_MIN_SCORE_THRESHOLD } from '../rag/retrievalService';

export const knowledgeRouter = Router();

const singleSearchSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1, 'Query must be a non-empty string'),
  variables: z.array(z.string().trim()).optional(),
  topK: z.number().int().min(1).max(50).optional().default(5),
  threshold: z.number().min(0).max(1).optional(),
});

const batchPathwayItemSchema = z.object({
  pathwayId: z.string().trim().min(1, 'pathwayId is required'),
  queryText: z.string().trim().min(1, 'queryText is required'),
  variables: z.array(z.string().trim()).optional(),
  topK: z.number().int().min(1).max(50).optional(),
  threshold: z.number().min(0).max(1).optional(),
});

const batchSearchSchema = z.object({
  batch: z.array(batchPathwayItemSchema).min(1, 'Batch must contain at least 1 pathway query'),
});

/**
 * POST /api/knowledge/search
 * Targeted semantic evidence retrieval.
 * Supports both single-query targeted search and multi-pathway batch search with deduplication.
 */
knowledgeRouter.post(
  '/knowledge/search',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 1. Handle Multi-Pathway Batch Mode
      if (req.body && Array.isArray(req.body.batch)) {
        const parseBatch = batchSearchSchema.safeParse(req.body);
        if (!parseBatch.success) {
          return res.status(400).json({
            error: {
              message: 'Invalid batch search parameters',
              code: 'VALIDATION_ERROR',
              details: parseBatch.error.format(),
            },
          });
        }

        const batchQueries = parseBatch.data.batch.map((b) => ({
          pathwayId: b.pathwayId,
          queryText: b.queryText,
          variables: b.variables,
          topK: b.topK,
          minScoreThreshold: b.threshold,
        }));

        const batchResult = await RetrievalService.retrieveForPathways(batchQueries);

        return res.status(200).json({
          batch: true,
          pathways: batchResult.pathways,
          uniqueEvidenceCount: batchResult.uniqueEvidenceCount,
          sharedEvidenceCount: batchResult.sharedEvidenceCount,
        });
      }

      // 2. Handle Single Query Targeted Search Mode
      const parseSingle = singleSearchSchema.safeParse(req.body);
      if (!parseSingle.success) {
        return res.status(400).json({
          error: {
            message: 'Invalid search parameters',
            code: 'VALIDATION_ERROR',
            details: parseSingle.error.format(),
          },
        });
      }

      const { query, variables, topK, threshold } = parseSingle.data;

      // Use the provided threshold or default to DEFAULT_MIN_SCORE_THRESHOLD
      const minScoreThreshold = threshold !== undefined ? threshold : DEFAULT_MIN_SCORE_THRESHOLD;

      const detailedResult = await RetrievalService.retrieveEvidenceDetailed({
        queryText: query,
        variables,
        topK,
        minScoreThreshold,
      });

      return res.status(200).json({
        query: detailedResult.query,
        status: detailedResult.status,
        message: detailedResult.message,
        filter: {
          variables: variables || [],
        },
        totalCandidates: detailedResult.totalCandidates,
        results: detailedResult.evidence.map((e) => ({
          chunkId: e.chunkId,
          documentId: e.documentId,
          title: e.title,
          organization: e.organization,
          snippet: e.text,
          score: e.score,
          topics: e.topics || [],
          environmentalVariables: e.environmentalVariables || [],
          year: e.year,
          url: e.url,
          isShared: e.isShared,
        })),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/knowledge/ingest
 * Development / Admin ingestion trigger
 */
knowledgeRouter.post(
  '/knowledge/ingest',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      console.log('[Knowledge API] Triggering manual knowledge base ingestion...');
      const stats = await ingestKnowledgeBase();
      res.status(200).json({
        message: 'Knowledge base ingested successfully',
        ...stats,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/knowledge/stats
 * Aggregated statistics of stored documents, chunks, and metadata breakdowns
 */
knowledgeRouter.get(
  '/knowledge/stats',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const [documentCount, chunkCount, docs] = await Promise.all([
        KnowledgeDocument.countDocuments(),
        KnowledgeChunk.countDocuments(),
        KnowledgeDocument.find({}, 'metadata').lean(),
      ]);

      const topicCounts: Record<string, number> = {};
      const variableCounts: Record<string, number> = {};

      for (const doc of docs) {
        const topics = (doc.metadata?.topics as string[]) || [];
        for (const t of topics) {
          topicCounts[t] = (topicCounts[t] || 0) + 1;
        }

        const variables = (doc.metadata?.variables as string[]) || [];
        for (const v of variables) {
          variableCounts[v] = (variableCounts[v] || 0) + 1;
        }
      }

      res.status(200).json({
        documentCount,
        chunkCount,
        topicBreakdown: topicCounts,
        environmentalVariableBreakdown: variableCounts,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/knowledge/documents
 * List documents with optional topic and variable filtering, plus pagination
 */
knowledgeRouter.get(
  '/knowledge/documents',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { topic, variable, page = '1', limit = '20' } = req.query;

      const filter: Record<string, unknown> = {};
      if (typeof topic === 'string' && topic.trim()) {
        filter['metadata.topics'] = topic.trim().toLowerCase();
      }
      if (typeof variable === 'string' && variable.trim()) {
        filter['metadata.variables'] = variable.trim();
      }

      const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));
      const skip = (pageNum - 1) * limitNum;

      const [documents, total] = await Promise.all([
        KnowledgeDocument.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        KnowledgeDocument.countDocuments(filter),
      ]);

      res.status(200).json({
        documents,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
      });
    } catch (error) {
      next(error);
    }
  }
);

export default knowledgeRouter;
