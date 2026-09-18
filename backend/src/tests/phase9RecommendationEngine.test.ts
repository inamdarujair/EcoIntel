import { connectDB, disconnectDB } from '../db/connection';
import { RecommendationEngine } from '../reasoning/recommendationEngine';
import { PhrasingService } from '../services/phrasingService';
import { EnvironmentalContext } from '../types';
import { Recommendation } from '../models';

async function runPhase9Tests() {
  console.log('====================================================');
  console.log('EcoIntel Phase 9 — Recommendation Engine Test Suite');
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

  // --- Numeric Traceability Unit Tests ---
  console.log('--- 1. Numeric Traceability Validation ---');
  const sourceText = "Soil carbon is 1.2% and rainfall is 400 mm.";
  
  // Valid (exact match)
  const validGen = "The soil has 1.2% carbon, and we see 400 mm of rain.";
  assert(PhrasingService.validateNumericTraceability(sourceText, validGen), 'Accepts exact matching numbers');

  // Valid (subset)
  const validSubset = "The soil has 1.2% carbon.";
  assert(PhrasingService.validateNumericTraceability(sourceText, validSubset), 'Accepts subset of matching numbers');

  // Valid (no numbers)
  const validNone = "The soil carbon is low and rainfall is scarce.";
  assert(PhrasingService.validateNumericTraceability(sourceText, validNone), 'Accepts text with zero numbers');

  // Invalid (hallucination)
  const invalidGen = "Carbon increases by 25% from 1.2%.";
  assert(PhrasingService.validateNumericTraceability(sourceText, invalidGen) === false, 'Rejects hallucinated percentage (25%)');

  // --- Database Integration Tests ---
  console.log('\n--- 2. End-to-End Database Integration ---');
  await connectDB();

  // Clear existing test recommendations to avoid state issues
  await Recommendation.deleteMany({ 'metadata.evidenceStatus': { $exists: true } });

  // Scenario 1: Sufficient Evidence
  console.log('\n--- Scenario 1: Sufficient Evidence ---');
  
  // Create a dummy conversation for persistence testing
  const { Conversation } = require('../models');
  const testConv = await Conversation.create({
    userId: 'test-user',
    messages: []
  });
  const conversationId = testConv._id.toString();

  const scenario1Context: EnvironmentalContext = {
    soil: { organicCarbon: 0.8 },
    climate: { rainfall: 'low' }
  };
  
  const s1Result = await RecommendationEngine.generate(scenario1Context, conversationId);
  assert(s1Result.recommendations.length > 0, 'Generates recommendation for Scenario 1');
  
  const rec1 = s1Result.recommendations[0];
  if (rec1) {
    assert(rec1.reasoningPathway === 'soilOrganicCarbon_waterStress_pathway', 'Recommendation has correct pathwayId');
    assert(Array.isArray(rec1.impactedMetrics) && rec1.impactedMetrics.length > 0, 'ImpactedMetrics are populated deterministically');
    assert(rec1.timeHorizon === 'medium-to-long-term', 'Time horizon is populated deterministically');
    assert(typeof rec1.confidenceScore === 'number', 'Confidence score is deterministic number');
    assert(rec1.metadata.evidenceStatus === 'sufficient', 'Evidence status is sufficient');
    assert(rec1.evidence.length > 0, 'Recommendation contains actual evidence items');
    assert(rec1.metadata.grounding.pathwayChainUsed === true, 'Grounding indicates pathway chain was used');
    
    // Check MongoDB Persistence
    const savedRec = await Recommendation.findOne({ reasoningPathway: 'soilOrganicCarbon_waterStress_pathway', 'metadata.evidenceStatus': 'sufficient' });
    assert(savedRec !== null, 'Recommendation was successfully persisted in MongoDB');
    if (savedRec) {
      assert(savedRec.evidence!.length === rec1.evidence.length, 'Evidence records were preserved in MongoDB');
    }
  }

  // Scenario 2: High Temp, Low Moisture, Fragmentation (Multiple Pathways)
  console.log('\n--- Scenario 2: Multiple Pathways ---');
  const scenario2Context: EnvironmentalContext = {
    climate: { temperature: 32 },
    soil: { moisture: 15 },
    landUse: { fragmentation: 0.5 }
  };

  const s2Result = await RecommendationEngine.generate(scenario2Context);
  assert(s2Result.recommendations.length >= 2, 'Generates multiple recommendations for independent pathways');
  
  const climateRec = s2Result.recommendations.find(r => r.reasoningPathway === 'climateStress_pathway');
  assert(climateRec !== undefined, 'Generated recommendation for climateStress_pathway');
  
  const fragRec = s2Result.recommendations.find(r => r.reasoningPathway === 'landUseFragmentation_pathway');
  assert(fragRec !== undefined, 'Generated recommendation for landUseFragmentation_pathway');

  // Scenario 3: Insufficient Evidence Fallback
  console.log('\n--- Scenario 3: Insufficient Evidence Fallback ---');
  // Pass an impossibly high threshold to guarantee 0 retrieved chunks
  const s3Result = await RecommendationEngine.generate(scenario1Context, undefined, { minScoreThreshold: 0.999 });
  assert(s3Result.recommendations.length > 0, 'Generates fallback recommendation');
  const fallbackRec = s3Result.recommendations[0];
  if (fallbackRec) {
    assert(fallbackRec.metadata.evidenceStatus === 'insufficient_evidence', 'Status is marked insufficient_evidence');
    assert(fallbackRec.evidence.length === 0, 'No evidence attached');
    assert(fallbackRec.confidenceScore === 0, 'Confidence score is 0');
    assert(fallbackRec.description === 'Insufficient scientific evidence was retrieved to support a strong recommendation.', 'Contains exact explicit fallback text');
    assert(fallbackRec.metadata.grounding.pathwayChainUsed === false, 'Phrasing service was bypassed');
  }

  await disconnectDB();

  console.log('\n====================================================');
  console.log(`Phase 9 Tests Complete: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');
  if (failed > 0) process.exit(1);
}

runPhase9Tests().catch((err) => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
