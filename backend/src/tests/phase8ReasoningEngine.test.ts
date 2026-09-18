import { EnvironmentalContext } from '../types';
import { ReasoningEngine } from '../reasoning/reasoningEngine';
import { connectDB, disconnectDB } from '../db/connection';

async function runPhase8Tests() {
  console.log('====================================================');
  console.log('EcoIntel Phase 8 — Reasoning Engine Test Suite');
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

  // --- 1. Empty Context ---
  console.log('--- 1. Empty Context ---');
  const emptyContext: EnvironmentalContext = {};
  const emptyResult = ReasoningEngine.evaluate(emptyContext);
  assert(emptyResult.pathwayCount === 0, 'Empty context triggers 0 pathways');
  assert(emptyResult.distinctVariablesUsed.length === 0, 'Empty context uses 0 variables');

  // --- 2. Low SOC + Low Rainfall (Scenario 1) ---
  console.log('\n--- 2. Low SOC + Low Rainfall ---');
  const scenario1Context: EnvironmentalContext = {
    soil: { organicCarbon: 0.8 },
    climate: { rainfall: 'low' }
  };
  const s1Result = ReasoningEngine.evaluate(scenario1Context);
  assert(s1Result.pathwayCount === 1, 'Triggers exactly 1 pathway');
  assert(s1Result.triggeredPathways[0]?.pathwayId === 'soilOrganicCarbon_waterStress_pathway', 'Triggers soilOrganicCarbon_waterStress_pathway');
  assert(s1Result.triggeredPathways[0]?.variablesUsed.includes('soil.organicCarbon'), 'Includes soil.organicCarbon in variables used');
  assert(s1Result.triggeredPathways[0]?.variablesUsed.includes('climate.rainfall'), 'Includes climate.rainfall in variables used');
  assert(s1Result.distinctVariablesUsed.length === 2, 'Covers 2 distinct variables');

  // --- 3. High Temperature + Low Moisture + Fragmentation (Scenario 2) ---
  console.log('\n--- 3. Scenario 2: Climate Stress + Fragmentation ---');
  const scenario2Context: EnvironmentalContext = {
    climate: { temperature: 32 },
    soil: { moisture: 15 },
    landUse: { fragmentation: 0.5, type: 'fragmented forest' },
    biodiversity: { speciesRichness: 10 }
  };
  const s2Result = ReasoningEngine.evaluate(scenario2Context);
  
  assert(s2Result.pathwayCount >= 2, `Triggers at least 2 pathways (got ${s2Result.pathwayCount})`);
  
  const climatePathway = s2Result.triggeredPathways.find(p => p.pathwayId === 'climateStress_pathway');
  assert(!!climatePathway, 'Triggers climateStress_pathway');
  if (climatePathway) {
    assert(climatePathway.variablesUsed.includes('climate.temperature'), 'climateStress uses temperature');
    assert(climatePathway.variablesUsed.includes('soil.moisture'), 'climateStress uses moisture');
  }

  const fragPathway = s2Result.triggeredPathways.find(p => p.pathwayId === 'landUseFragmentation_pathway');
  assert(!!fragPathway, 'Triggers landUseFragmentation_pathway');
  if (fragPathway) {
    assert(fragPathway.variablesUsed.includes('landUse.fragmentation'), 'fragPathway uses fragmentation');
    assert(fragPathway.variablesUsed.includes('biodiversity.speciesRichness'), 'fragPathway uses speciesRichness');
  }

  assert(s2Result.distinctVariablesUsed.length >= 3, `Covers >= 3 distinct variables (got ${s2Result.distinctVariablesUsed.length})`);

  // --- 4. Pollution Context ---
  console.log('\n--- 4. Pollution Context ---');
  const pollutionContext: EnvironmentalContext = {
    humanImpact: { pollution: 0.4 }
  };
  const pollResult = ReasoningEngine.evaluate(pollutionContext);
  assert(pollResult.pathwayCount === 1, 'Triggers exactly 1 pathway');
  assert(pollResult.triggeredPathways[0]?.pathwayId === 'pollutionEcosystem_pathway', 'Triggers pollutionEcosystem_pathway');

  // --- 5. Missing Variables don't false trigger ---
  console.log('\n--- 5. Missing Variables Check ---');
  const onlyTempContext: EnvironmentalContext = {
    climate: { temperature: 35 }
  };
  const tempResult = ReasoningEngine.evaluate(onlyTempContext);
  assert(tempResult.pathwayCount === 0, 'High temperature alone does not trigger climateStress_pathway');

  // --- 6. Determinism Check ---
  console.log('\n--- 6. Determinism Check ---');
  const dResult1 = ReasoningEngine.evaluate(scenario2Context);
  const dResult2 = ReasoningEngine.evaluate(scenario2Context);
  assert(JSON.stringify(dResult1) === JSON.stringify(dResult2), 'Identical context produces identical evaluation output');

  // --- Integration with DB (evaluateWithEvidence) ---
  console.log('\n--- 7. Integration with RetrievalService (evaluateWithEvidence) ---');
  await connectDB();
  
  const evidenceResult = await ReasoningEngine.evaluateWithEvidence(scenario1Context);
  assert(evidenceResult.pathwayCount === 1, 'Returns 1 pathway in evaluateWithEvidence');
  
  const soilPathwayEv = evidenceResult.triggeredPathways[0];
  assert(soilPathwayEv?.retrieval !== undefined, 'Pathway includes retrieval object');
  assert(soilPathwayEv?.retrieval?.status === 'sufficient', `Pathway evidence status is sufficient (got ${soilPathwayEv?.retrieval?.status})`);
  assert(Array.isArray(soilPathwayEv?.retrieval?.evidence) && soilPathwayEv.retrieval.evidence.length > 0, 'Pathway contains actual evidence items');

  const emptyEvidenceResult = await ReasoningEngine.evaluateWithEvidence({ region: "Unknown" });
  assert(emptyEvidenceResult.pathwayCount === 0, 'Empty context with evidence evaluation returns 0 pathways');

  // Insufficient evidence check (mocked via high threshold)
  const impossibleThresholdResult = await ReasoningEngine.evaluateWithEvidence(scenario1Context, { minScoreThreshold: 0.999 });
  assert(impossibleThresholdResult.pathwayCount === 1, 'Pathway triggers even if evidence is insufficient');
  assert(impossibleThresholdResult.triggeredPathways[0]?.retrieval?.status === 'insufficient_evidence', 'Status explicitly set to insufficient_evidence');
  assert(impossibleThresholdResult.triggeredPathways[0]?.retrieval?.evidence.length === 0, 'Evidence array is empty for insufficient evidence');

  await disconnectDB();

  console.log('\n====================================================');
  console.log(`Phase 8 Tests Complete: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');
  if (failed > 0) process.exit(1);
}

runPhase8Tests().catch((err) => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
