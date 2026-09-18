import {
  getEmbedding,
  getBatchEmbeddings,
  normalizeL2,
  cosineSimilarity,
  isEmbeddingValid,
  EMBEDDING_MODEL,
  EMBEDDING_PROVIDER,
  EMBEDDING_DIMENSION,
} from '../services/embeddingService';
import { connectDB, disconnectDB } from '../db/connection';
import { KnowledgeChunk, KnowledgeDocument } from '../models';
import { searchSimilarChunks } from '../rag/vectorStore';

async function runPhase5Tests() {
  console.log('====================================================');
  console.log('EcoIntel Phase 5 — Embeddings & Vector Test Suite');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
      failed++;
    }
  }

  // --- UNIT TESTS ---

  // 1. Embedding generation (real model)
  console.log('--- 1. Real Embedding Generation ---');
  const sampleText = 'Soil organic carbon increases water holding capacity in agroecosystems.';
  const vector1 = await getEmbedding(sampleText);
  assert(Array.isArray(vector1) && vector1.length > 0, 'Generates real numeric array');

  // 2. Embedding dimension = 384
  console.log('\n--- 2. Embedding Dimension ---');
  assert(vector1.length === 384, `Embedding dimension is exactly 384 (got ${vector1.length})`);
  assert(
    vector1.every((v) => typeof v === 'number' && isFinite(v)),
    'All elements are finite numbers'
  );

  // 3. Vector normalization
  console.log('\n--- 3. Vector Normalization ---');
  const sumSq = vector1.reduce((acc, val) => acc + val * val, 0);
  const norm = Math.sqrt(sumSq);
  assert(
    Math.abs(norm - 1.0) < 0.001,
    `Vector is L2 normalized (L2 norm = ${norm.toFixed(6)}, expected ~1.0)`
  );

  // 4. Invalid/empty text
  console.log('\n--- 4. Invalid / Empty Text Handling ---');
  let emptyRejected = false;
  try {
    await getEmbedding('');
  } catch {
    emptyRejected = true;
  }
  assert(emptyRejected, 'Rejects empty string');

  let whitespaceRejected = false;
  try {
    await getEmbedding('   \n  ');
  } catch {
    whitespaceRejected = true;
  }
  assert(whitespaceRejected, 'Rejects whitespace-only string');

  // 5. Batch embedding
  console.log('\n--- 5. Batch Embedding ---');
  const batchTexts = [
    'Habitat fragmentation reduces biodiversity across forest edges.',
    'Agroforestry intercropping enhances crop yield resilience against drought.',
  ];
  const batchVectors = await getBatchEmbeddings(batchTexts);
  assert(batchVectors.length === 2, 'Batch returned 2 embeddings');
  assert(
    batchVectors[0].length === 384 && batchVectors[1].length === 384,
    'Each batch vector has 384 dimensions'
  );

  // 6. Embedding metadata
  console.log('\n--- 6. Embedding Metadata ---');
  assert(EMBEDDING_PROVIDER === 'transformers', `Provider is 'transformers' (got '${EMBEDDING_PROVIDER}')`);
  assert(EMBEDDING_MODEL === 'all-MiniLM-L6-v2', `Model is 'all-MiniLM-L6-v2' (got '${EMBEDDING_MODEL}')`);
  assert(EMBEDDING_DIMENSION === 384, `Dimension constant is 384 (got ${EMBEDDING_DIMENSION})`);

  // 7. Idempotent ingestion helper
  console.log('\n--- 7. Idempotent Ingestion Check ---');
  const validChunk = {
    embedding: new Array(384).fill(0.1),
    embeddingDimension: 384,
    embeddingModel: 'all-MiniLM-L6-v2',
    embeddingProvider: 'transformers',
  };
  assert(isEmbeddingValid(validChunk) === true, 'isEmbeddingValid returns true for valid chunk');

  // 8. Stale model detection
  console.log('\n--- 8. Stale Model Detection ---');
  const staleModelChunk = {
    ...validChunk,
    embeddingModel: 'text-embedding-ada-002',
  };
  assert(isEmbeddingValid(staleModelChunk) === false, 'Detects stale embedding model');

  const staleDimChunk = {
    ...validChunk,
    embeddingDimension: 768,
    embedding: new Array(768).fill(0.1),
  };
  assert(isEmbeddingValid(staleDimChunk) === false, 'Detects stale embedding dimension');

  const staleProviderChunk = {
    ...validChunk,
    embeddingProvider: 'gemini',
  };
  assert(isEmbeddingValid(staleProviderChunk) === false, 'Detects different provider');

  // 9. Cosine similarity
  console.log('\n--- 9. Cosine Similarity ---');
  const vA = normalizeL2([1, 0, 0]);
  const vB = normalizeL2([1, 0, 0]);
  const vC = normalizeL2([0, 1, 0]);
  const vD = normalizeL2([-1, 0, 0]);

  const simIdentical = cosineSimilarity(vA, vB);
  const simOrthogonal = cosineSimilarity(vA, vC);
  const simOpposite = cosineSimilarity(vA, vD);

  assert(Math.abs(simIdentical - 1.0) < 0.0001, `Identical vectors have similarity 1.0 (got ${simIdentical})`);
  assert(Math.abs(simOrthogonal - 0.0) < 0.0001, `Orthogonal vectors have similarity 0.0 (got ${simOrthogonal})`);
  assert(Math.abs(simOpposite - (-1.0)) < 0.0001, `Opposite vectors have similarity -1.0 (got ${simOpposite})`);

  // Semantic similarity check: related environmental texts should score higher than unrelated texts
  const soilVec = await getEmbedding('Soil carbon and organic moisture retention in clay soils');
  const waterVec = await getEmbedding('Water holding capacity and organic matter in topsoil');
  const astronomyVec = await getEmbedding('Supernova remnants and distant orbital planetary nebulae');

  const semSimRelated = cosineSimilarity(soilVec, waterVec);
  const semSimUnrelated = cosineSimilarity(soilVec, astronomyVec);
  assert(
    semSimRelated > semSimUnrelated,
    `Related text similarity (${semSimRelated.toFixed(4)}) > unrelated text (${semSimUnrelated.toFixed(4)})`
  );

  // --- INTEGRATION TESTS (MongoDB + Real Persistence + Vector Search) ---
  console.log('\n--- Connecting to DB for Integration Tests ---');
  await connectDB();

  // 10 & 13. Search Result Schema & End-to-End Search
  console.log('\n--- 10 & 13. Semantic Search & Result Schema Verification ---');
  const searchTestOutput = await searchSimilarChunks({
    query: 'soil organic carbon and water retention',
    topK: 3,
    threshold: 0.1,
  });

  assert(Array.isArray(searchTestOutput.results), 'Search returned an array of results');
  assert(typeof searchTestOutput.totalCandidates === 'number', 'totalCandidates is numeric');
  assert(
    ['atlas_vector_search', 'local_cosine_similarity'].includes(searchTestOutput.searchEngine),
    `Engine reported as valid type (${searchTestOutput.searchEngine})`
  );

  if (searchTestOutput.results.length > 0) {
    const r = searchTestOutput.results[0];
    assert(typeof r.chunkId === 'string' && r.chunkId.length > 0, 'Result has valid chunkId');
    assert(typeof r.documentId === 'string', 'Result has documentId');
    assert(typeof r.title === 'string' && r.title.length > 0, 'Result has title');
    assert(typeof r.snippet === 'string' && r.snippet.length > 0, 'Result has snippet text');
    assert(typeof r.score === 'number' && r.score >= 0 && r.score <= 1, `Result has normalized score (${r.score})`);
    assert(Array.isArray(r.topics), 'Result has topics array');
    assert(Array.isArray(r.environmentalVariables), 'Result has environmentalVariables array');
    assert(!('embedding' in r), 'Full raw embedding vector is omitted from search result');
  }

  // 11. topK behavior
  console.log('\n--- 11. topK Behavior ---');
  const top2Output = await searchSimilarChunks({
    query: 'forest fragmentation biodiversity',
    topK: 2,
  });
  assert(top2Output.results.length <= 2, `topK=2 returned ${top2Output.results.length} items (<= 2)`);

  // 12. Threshold behavior
  console.log('\n--- 12. Threshold Behavior ---');
  const highThresholdOutput = await searchSimilarChunks({
    query: 'soil moisture',
    threshold: 0.9999, // Unattainably high
  });
  assert(
    highThresholdOutput.results.length === 0,
    `Threshold 0.9999 returned 0 results as expected (got ${highThresholdOutput.results.length})`
  );

  // 10 & 14. Metadata Filtering & Empty Search Results
  console.log('\n--- 10 & 14. Metadata Filtering ---');
  const pollutionFiltered = await searchSimilarChunks({
    query: 'soil moisture',
    variables: ['humanImpact.pollution'],
  });

  const allHavePollution = pollutionFiltered.results.every((r) =>
    r.environmentalVariables.includes('humanImpact.pollution')
  );
  assert(
    allHavePollution,
    'All returned results under pollution filter contain humanImpact.pollution'
  );

  const nonExistentVarOutput = await searchSimilarChunks({
    query: 'soil moisture',
    variables: ['nonExistent.variable.xyz123'],
  });
  assert(
    nonExistentVarOutput.results.length === 0,
    'Non-existent variable filter returns 0 candidates'
  );

  // 15. Embedding failure handling
  console.log('\n--- 15. Embedding Failure Handling ---');
  let invalidTypeCaught = false;
  try {
    // @ts-expect-error test invalid type
    await getEmbedding(null);
  } catch {
    invalidTypeCaught = true;
  }
  assert(invalidTypeCaught, 'Rejects null input gracefully');

  await disconnectDB();

  console.log('\n====================================================');
  console.log(`Phase 5 Tests Complete: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runPhase5Tests().catch((err) => {
  console.error('Test runner encountered uncaught error:', err);
  process.exit(1);
});
