import { z } from 'zod';

export const evidenceItemSchema = z.object({
  chunkId: z.string().optional(),
  documentId: z.string().optional(),
  text: z.string().optional(), // 'chunkText' in mongoose Evidence
  chunkText: z.string().optional(),
  title: z.string().optional(),
  organization: z.string().optional(),
  year: z.number().optional(),
  url: z.string().optional(),
  score: z.number().optional(),
  sourceDocument: z.string().optional(),
}).passthrough();

export const recommendationSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  whyItWorks: z.string().optional(),
  impactedMetrics: z.array(z.string()).optional(),
  timeHorizon: z.string().optional(),
  confidenceScore: z.number().min(0).max(1).optional(),
  evidence: z.array(evidenceItemSchema).optional(),
  reasoningPathway: z.string().optional(),
  status: z.enum(['proposed', 'accepted', 'in_progress', 'completed', 'rejected']).optional(),
  
  // Custom metadata fields passed through
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type ValidatedRecommendation = z.infer<typeof recommendationSchema>;
