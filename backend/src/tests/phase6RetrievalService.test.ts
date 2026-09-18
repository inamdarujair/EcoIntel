import { connectDB, disconnectDB } from '../db/connection';
import {
  RetrievalService,
  retrieveEvidence,
  retrieveEvidenceDetailed,
  retrieveForPathways,
  DEFAULT_MIN_SCORE_THRESHOLD,
} from '../rag/retrievalService';

async function runPhase6Tests() {
  console.log('====================================================');
  console.log('EcoIntel Phase 6 — Targeted RAG Retrieval Test Suite');
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

  await connectDB();

  // --- 1. Basic Targeted Evidence Retrieval ---
  console.log('--- 1. Evidence Retrieval & Schema ---');
  const evidence1 = await retrieveEvidence(
    'soil organic carbon and water retention capacity',
    ['soil.organicCarbon', 'soil.moisture'],
    3,
    0.40
  );

  assert(Array.isArray(evidence1) && evidence1.length > 0, 'Returns non-empty array of evidence');
  if (evidence1.length > 0) {
    const item = evidence1[0];
    assert(typeof item.chunkId === 'string' && item.chunkId.length > 0, 'Contains valid chunkId');
    assert(typeof item.documentId === 'string' && item.documentId.length > 0, 'Contains valid documentId');
    assert(typeof item.text === 'string' && item.text.length > 0, 'Contains text excerpt');
    assert(typeof item.title === 'string' && item.title.length > 0, 'Contains document title');
    assert(typeof item.organization === 'string' && item.organization.length > 0, 'Contains organization');
    assert(typeof item.score === 'number' && item.score >= 0.40, `Score meets min threshold (got ${item.score})`);
    assert(item.isShared === false, 'Default isShared is false for single retrieval');
    assert(item.year !== undefined, `Contains document year (got ${item.year})`);
    assert(item.url !== undefined && item.url.startsWith('http'), `Contains canonical URL (got ${item.url})`);
  }

  // --- 2. Minimum Relevance Threshold & Insufficient Evidence ---
  console.log('\n--- 2. Minimum Relevance Threshold & Insufficient Evidence ---');
  const irrelevantQuery = 'quantum superconducting qubit coherence in sub-Kelvin cryostats';

  // Direct retrieveEvidence should return empty array
  const emptyEvidence = await retrieveEvidence(irrelevantQuery, undefined, 5, 0.40);
  assert(
    emptyEvidence.length === 0,
    `Irrelevant query returns empty array [] with threshold 0.40 (got ${emptyEvidence.length})`
  );

  // Detailed retrieval reports explicit status: 'insufficient_evidence'
  const detailedIrrelevant = await retrieveEvidenceDetailed({
    queryText: irrelevantQuery,
    minScoreThreshold: 0.40,
  });
  assert(
    detailedIrrelevant.status === 'insufficient_evidence',
    `Reports status 'insufficient_evidence' (got '${detailedIrrelevant.status}')`
  );
  assert(
    detailedIrrelevant.evidence.length === 0,
    'Detailed evidence array is empty for irrelevant query'
  );
  assert(
    typeof detailedIrrelevant.message === 'string' && detailedIrrelevant.message.length > 0,
    'Detailed result includes informative message explaining threshold failure'
  );

  // --- 3. Multi-Query Pathway Batching ---
  console.log('\n--- 3. Multi-Query Pathway Batching ---');
  const pathwayQueries = [
    {
      pathwayId: 'pathway_soil_moisture',
      queryText: 'soil organic carbon and water-holding capacity',
      variables: ['soil.organicCarbon', 'soil.moisture'],
      topK: 3,
      minScoreThreshold: 0.40,
    },
    {
      pathwayId: 'pathway_fragmentation',
      queryText: 'forest fragmentation structural edges and vertebrate extinction debt',
      variables: ['landUse.fragmentation', 'biodiversity.speciesRichness'],
      topK: 3,
      minScoreThreshold: 0.40,
    },
    {
      pathwayId: 'pathway_irrelevant',
      queryText: 'deep ocean trench tectonic plate hydrothermal vents',
      topK: 3,
      minScoreThreshold: 0.45,
    },
  ];

  const batchResults = await retrieveForPathways(pathwayQueries);

  assert(typeof batchResults.pathways === 'object', 'Returns pathways dictionary');
  assert(
    Object.keys(batchResults.pathways).length === 3,
    `Contains results for all 3 requested pathways (got ${Object.keys(batchResults.pathways).length})`
  );

  const pSoil = batchResults.pathways['pathway_soil_moisture'];
  const pFrag = batchResults.pathways['pathway_fragmentation'];
  const pIrrel = batchResults.pathways['pathway_irrelevant'];

  assert(pSoil.status === 'sufficient', `Pathway 1 reports 'sufficient' status (got ${pSoil.status})`);
  assert(pSoil.evidence.length > 0, `Pathway 1 contains evidence (got ${pSoil.evidence.length} items)`);

  assert(pFrag.status === 'sufficient', `Pathway 2 reports 'sufficient' status (got ${pFrag.status})`);
  assert(pFrag.evidence.length > 0, `Pathway 2 contains evidence (got ${pFrag.evidence.length} items)`);

  assert(
    pIrrel.status === 'insufficient_evidence',
    `Pathway 3 reports 'insufficient_evidence' (got ${pIrrel.status})`
  );
  assert(pIrrel.evidence.length === 0, 'Pathway 3 has 0 evidence items');

  // --- 4. Evidence Deduplication & Shared Chunk Marking ---
  console.log('\n--- 4. Shared Chunk Deduplication & Tagging ---');
  // Run two overlapping queries that both target USDA-NRCS / FAO soil moisture literature
  const overlappingQueries = [
    {
      pathwayId: 'pathway_a',
      queryText: 'soil organic carbon water retention and moisture capacity',
      variables: ['soil.organicCarbon', 'soil.moisture'],
      topK: 4,
      minScoreThreshold: 0.35,
    },
    {
      pathwayId: 'pathway_b',
      queryText: 'soil organic matter available water-holding capacity',
      variables: ['soil.organicCarbon', 'soil.moisture'],
      topK: 4,
      minScoreThreshold: 0.35,
    },
  ];

  const overlapBatch = await retrieveForPathways(overlappingQueries);
  const evidenceA = overlapBatch.pathways['pathway_a'].evidence;
  const evidenceB = overlapBatch.pathways['pathway_b'].evidence;

  const idsA = new Set(evidenceA.map((e) => e.chunkId));
  const idsB = new Set(evidenceB.map((e) => e.chunkId));

  // Find overlapping chunk IDs
  const sharedIds = [...idsA].filter((id) => idsB.has(id));

  assert(sharedIds.length > 0, `Found ${sharedIds.length} legitimately shared chunks between pathways`);
  assert(
    overlapBatch.sharedEvidenceCount > 0,
    `Batch report tracks sharedEvidenceCount (${overlapBatch.sharedEvidenceCount})`
  );
  assert(
    overlapBatch.uniqueEvidenceCount === new Set([...idsA, ...idsB]).size,
    `Batch report tracks exact unique evidence count (${overlapBatch.uniqueEvidenceCount})`
  );

  // Check that every shared chunk has isShared: true in BOTH pathways
  for (const sharedId of sharedIds) {
    const itemInA = evidenceA.find((e) => e.chunkId === sharedId);
    const itemInB = evidenceB.find((e) => e.chunkId === sharedId);
    assert(
      itemInA?.isShared === true && itemInB?.isShared === true,
      `Shared chunk ${sharedId} has isShared=true in both pathway A and pathway B`
    );
  }

  // Check that non-shared chunks have isShared: false
  const uniqueInA = evidenceA.filter((e) => !idsB.has(e.chunkId));
  for (const item of uniqueInA) {
    assert(
      item.isShared === false,
      `Exclusive chunk ${item.chunkId} in pathway A has isShared=false`
    );
  }

  await disconnectDB();

  console.log('\n====================================================');
  console.log(`Phase 6 Tests Complete: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) process.exit(1);
}

runPhase6Tests().catch((err) => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
