import fs from 'fs';
import path from 'path';
import { KnowledgeDocument, KnowledgeChunk } from '../models';
import {
  getEmbedding,
  isEmbeddingValid,
  EMBEDDING_MODEL,
  EMBEDDING_PROVIDER,
  EMBEDDING_DIMENSION,
} from './embeddingService';

export interface SeedSourceVerification {
  verified: boolean;
  verificationNotes?: string;
}

export interface SeedDocument {
  title: string;
  sourceUrl: string;
  authors: string[];
  organization: string;
  year: number;
  documentType: string;
  topics: string[];
  environmentalVariables: string[];
  summary: string;
  sourceVerification?: SeedSourceVerification;
}

export interface IngestionStatistics {
  documentsProcessed: number;
  documentsCreated: number;
  documentsUpdated: number;
  chunksCreated: number;
  chunksUpdated: number;
  chunksEmbedded: number;
  embeddingFailures: number;
  failed: number;
  durationMs: number;
}

export interface ChunkOptions {
  targetWordCount?: number;
  minWordCount?: number;
  overlapSentenceCount?: number;
}

export const BATCH_SIZE = 16;

/**
 * Splits text into paragraph-aware, sentence-aware chunks.
 * Ensures chunks do not split mid-sentence and no two chunks from the same doc are byte-identical.
 */
export function chunkText(text: string, options: ChunkOptions = {}): string[] {
  const {
    targetWordCount = 120,
    minWordCount = 40,
    overlapSentenceCount = 1,
  } = options;

  if (!text || typeof text !== 'string') {
    return [];
  }

  const normalized = text.replace(/\r\n/g, '\n').trim();
  const paragraphs = normalized.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  const sentencesFromText = (t: string): string[] => {
    return t
      .split(/(?<=[.?!])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  };

  const chunks: string[] = [];

  // If text is structured in distinct paragraphs of sufficient size,
  // chunk primarily by paragraphs with cross-paragraph sentence overlap.
  if (paragraphs.length >= 2) {
    for (let i = 0; i < paragraphs.length; i++) {
      const currentPara = paragraphs[i];
      let chunkStr = currentPara;

      // Add a trailing sentence from previous paragraph as overlap context if applicable
      if (i > 0 && overlapSentenceCount > 0) {
        const prevSentences = sentencesFromText(paragraphs[i - 1]);
        if (prevSentences.length > 0) {
          const overlap = prevSentences.slice(-overlapSentenceCount).join(' ');
          chunkStr = `[Context: ${overlap}] ${chunkStr}`;
        }
      }

      chunks.push(chunkStr);
    }
  } else {
    // Single long block: sentence-based sliding window
    const sentences = sentencesFromText(normalized);
    let currentChunkSentences: string[] = [];
    let currentWordCount = 0;

    for (let i = 0; i < sentences.length; i++) {
      const s = sentences[i];
      const sWords = s.split(/\s+/).length;

      currentChunkSentences.push(s);
      currentWordCount += sWords;

      if (currentWordCount >= targetWordCount && i < sentences.length - 1) {
        chunks.push(currentChunkSentences.join(' '));
        // Keep overlap sentences for next chunk
        const overlap = currentChunkSentences.slice(-overlapSentenceCount);
        currentChunkSentences = [...overlap];
        currentWordCount = overlap.reduce((sum, item) => sum + item.split(/\s+/).length, 0);
      }
    }

    if (currentChunkSentences.length > 0) {
      const lastChunkStr = currentChunkSentences.join(' ');
      // If the last chunk is too small and we already have chunks, append to previous if not byte-identical
      if (chunks.length > 0 && currentWordCount < minWordCount) {
        chunks[chunks.length - 1] = `${chunks[chunks.length - 1]} ${lastChunkStr}`;
      } else {
        chunks.push(lastChunkStr);
      }
    }
  }

  // Deduplicate byte-identical chunks
  const uniqueChunks: string[] = [];
  for (const c of chunks) {
    if (!uniqueChunks.includes(c)) {
      uniqueChunks.push(c);
    }
  }

  // If only 1 chunk was produced but content is rich enough, split in half at a sentence boundary
  if (uniqueChunks.length === 1 && uniqueChunks[0].split(/\s+/).length > 80) {
    const sents = sentencesFromText(uniqueChunks[0]);
    if (sents.length >= 2) {
      const mid = Math.ceil(sents.length / 2);
      const c1 = sents.slice(0, mid).join(' ');
      const c2 = sents.slice(mid - 1).join(' '); // 1-sentence overlap
      if (c1 !== c2) {
        return [c1, c2];
      }
    }
  }

  return uniqueChunks;
}

/**
 * Validates the knowledge seed array before database insertion.
 */
export function validateKnowledgeSeed(seeds: unknown[]): SeedDocument[] {
  if (!Array.isArray(seeds) || seeds.length === 0) {
    throw new Error('Knowledge seed must be a non-empty array of source documents');
  }

  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const validated: SeedDocument[] = [];

  for (let i = 0; i < seeds.length; i++) {
    const entry = seeds[i] as Partial<SeedDocument>;

    if (!entry.title || typeof entry.title !== 'string' || entry.title.trim() === '') {
      throw new Error(`Seed entry at index ${i} is missing a valid 'title'`);
    }

    if (!entry.sourceUrl || typeof entry.sourceUrl !== 'string' || !entry.sourceUrl.startsWith('http')) {
      throw new Error(`Seed entry '${entry.title}' has invalid or missing 'sourceUrl': ${entry.sourceUrl}`);
    }

    if (!entry.summary || typeof entry.summary !== 'string' || entry.summary.trim().length < 50) {
      throw new Error(`Seed entry '${entry.title}' has insufficient or missing 'summary'`);
    }

    if (!entry.year || typeof entry.year !== 'number' || entry.year < 1900 || entry.year > 2030) {
      throw new Error(`Seed entry '${entry.title}' has invalid 'year': ${entry.year}`);
    }

    if (!Array.isArray(entry.topics) || entry.topics.length === 0) {
      throw new Error(`Seed entry '${entry.title}' must contain at least one topic in 'topics'`);
    }

    if (!Array.isArray(entry.environmentalVariables) || entry.environmentalVariables.length === 0) {
      throw new Error(`Seed entry '${entry.title}' must contain at least one variable in 'environmentalVariables'`);
    }

    const normUrl = entry.sourceUrl.trim().toLowerCase();
    if (seenUrls.has(normUrl)) {
      throw new Error(`Duplicate sourceUrl detected in seed: ${entry.sourceUrl}`);
    }
    seenUrls.add(normUrl);

    const normTitle = entry.title.trim().toLowerCase();
    if (seenTitles.has(normTitle)) {
      throw new Error(`Duplicate title detected in seed: ${entry.title}`);
    }
    seenTitles.add(normTitle);

    validated.push({
      title: entry.title.trim(),
      sourceUrl: entry.sourceUrl.trim(),
      authors: Array.isArray(entry.authors) ? entry.authors : [],
      organization: entry.organization?.trim() || 'Scientific Research',
      year: entry.year,
      documentType: entry.documentType?.trim() || 'research-paper',
      topics: entry.topics.map((t) => t.trim().toLowerCase()),
      environmentalVariables: entry.environmentalVariables.map((v) => v.trim()),
      summary: entry.summary.trim(),
      sourceVerification: entry.sourceVerification,
    });
  }

  return validated;
}

/**
 * Idempotent batch ingestion pipeline for the curated scientific knowledge base.
 * Creates/updates documents and chunks, then generates and persists real 384-d
 * embeddings in safe batches.
 */
export async function ingestKnowledgeBase(customSeedPath?: string): Promise<IngestionStatistics> {
  const startTime = Date.now();
  const seedPath = customSeedPath || path.resolve(__dirname, '../data/knowledgeSeed.json');

  if (!fs.existsSync(seedPath)) {
    throw new Error(`Knowledge seed file not found at path: ${seedPath}`);
  }

  const rawData = fs.readFileSync(seedPath, 'utf-8');
  const parsedData = JSON.parse(rawData);
  const validatedSeeds = validateKnowledgeSeed(parsedData);

  let documentsCreated = 0;
  let documentsUpdated = 0;
  let chunksCreated = 0;
  let chunksUpdated = 0;
  let chunksEmbedded = 0;
  let embeddingFailures = 0;
  let failed = 0;

  for (const seed of validatedSeeds) {
    try {
      // 1. Upsert KnowledgeDocument by canonical sourceUrl
      let doc = await KnowledgeDocument.findOne({ sourceUrl: seed.sourceUrl });

      const docMetadata = {
        authors: seed.authors,
        organization: seed.organization,
        year: seed.year,
        topics: seed.topics,
        variables: seed.environmentalVariables,
        documentType: seed.documentType,
        sourceVerification: seed.sourceVerification,
      };

      if (!doc) {
        doc = new KnowledgeDocument({
          title: seed.title,
          sourceUrl: seed.sourceUrl,
          fileType: seed.documentType,
          metadata: docMetadata,
        });
        await doc.save();
        documentsCreated++;
      } else {
        doc.title = seed.title;
        doc.fileType = seed.documentType;
        doc.metadata = docMetadata;
        await doc.save();
        documentsUpdated++;
      }

      // 2. Generate deterministic text chunks
      const textChunks = chunkText(seed.summary);

      // 3. Find existing chunks for this document
      const existingChunks = await KnowledgeChunk.find({ documentId: doc._id }).sort({ chunkIndex: 1 });

      // Clean up any extra trailing chunks if document shrank
      if (existingChunks.length > textChunks.length) {
        await KnowledgeChunk.deleteMany({
          documentId: doc._id,
          chunkIndex: { $gte: textChunks.length },
        });
      }

      // 4. Upsert/verify each chunk idempotently
      for (let idx = 0; idx < textChunks.length; idx++) {
        const chunkStr = textChunks[idx];
        const existing = existingChunks.find((c) => c.chunkIndex === idx);

        const chunkMetadata = {
          title: seed.title,
          sourceUrl: seed.sourceUrl,
          authors: seed.authors,
          organization: seed.organization,
          year: seed.year,
          topics: seed.topics,
          environmentalVariables: seed.environmentalVariables,
          documentType: seed.documentType,
          chunkCount: textChunks.length,
        };

        if (existing) {
          const textMatches = existing.text === chunkStr;
          const embeddingValid = isEmbeddingValid(existing);

          if (textMatches && embeddingValid) {
            // Reusable chunk with valid embedding: update metadata only if changed
            existing.metadata = chunkMetadata;
            await existing.save();
          } else {
            // Content changed or embedding invalid/stale: invalidate embedding to force recomputation
            existing.text = chunkStr;
            existing.metadata = chunkMetadata;
            existing.embedding = [];
            existing.embeddingModel = undefined;
            existing.embeddingProvider = undefined;
            existing.embeddingDimension = undefined;
            await existing.save();
            chunksUpdated++;
          }
        } else {
          // New chunk
          const newChunk = new KnowledgeChunk({
            documentId: doc._id,
            chunkIndex: idx,
            text: chunkStr,
            embedding: [],
            metadata: chunkMetadata,
          });
          await newChunk.save();
          chunksCreated++;
        }
      }
    } catch (err) {
      console.error(`[Ingestion Error] Failed processing document '${seed.title}':`, err);
      failed++;
    }
  }

  // 5. Query all chunks in DB requiring embeddings (unembedded, wrong dimension, or stale model/provider)
  const chunksNeedingEmbedding = await KnowledgeChunk.find({
    $or: [
      { embedding: { $exists: false } },
      { embedding: { $size: 0 } },
      { embeddingDimension: { $ne: EMBEDDING_DIMENSION } },
      { embeddingModel: { $ne: EMBEDDING_MODEL } },
      { embeddingProvider: { $ne: EMBEDDING_PROVIDER } },
    ],
  });

  console.log(`[Ingestion] Found ${chunksNeedingEmbedding.length} chunks requiring embeddings.`);

  // 6. Safe batch processing of embeddings
  for (let i = 0; i < chunksNeedingEmbedding.length; i += BATCH_SIZE) {
    const batch = chunksNeedingEmbedding.slice(i, i + BATCH_SIZE);
    console.log(`[Ingestion] Processing embedding batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunksNeedingEmbedding.length / BATCH_SIZE)} (${batch.length} chunks)...`);

    for (const chunk of batch) {
      try {
        if (!chunk.text || typeof chunk.text !== 'string' || chunk.text.trim() === '') {
          console.warn(`[Ingestion Warning] Skipping empty text chunk ${chunk._id}`);
          embeddingFailures++;
          continue;
        }

        const vector = await getEmbedding(chunk.text);

        chunk.embedding = vector;
        chunk.embeddingModel = EMBEDDING_MODEL;
        chunk.embeddingProvider = EMBEDDING_PROVIDER;
        chunk.embeddingDimension = EMBEDDING_DIMENSION;

        await chunk.save();
        chunksEmbedded++;
      } catch (chunkErr) {
        console.error(`[Ingestion Error] Failed generating embedding for chunk ${chunk._id}:`, chunkErr);
        embeddingFailures++;
      }
    }
  }

  const durationMs = Date.now() - startTime;

  return {
    documentsProcessed: validatedSeeds.length,
    documentsCreated,
    documentsUpdated,
    chunksCreated,
    chunksUpdated,
    chunksEmbedded,
    embeddingFailures,
    failed,
    durationMs,
  };
}
