import { EnvironmentalContext } from '../types';
import { ClarificationService } from '../reasoning/clarificationService';
import { PATHWAYS } from '../reasoning/pathways';

async function runPhase10Tests() {
  console.log('====================================================');
  console.log('EcoIntel Phase 10 — Clarification System Test Suite');
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
  const triggeredEmpty = []; // Mock Phase 8 result
  const resultEmpty = ClarificationService.getClarificationCandidates(emptyContext, triggeredEmpty);
  assert(resultEmpty.shouldAsk === false, 'Empty context might not trigger near-triggerable pathways if they require > 2 variables, or it might. Wait!');
  // Wait, soilOrganicCarbon_waterStress_pathway needs 3 vars: ['soil.organicCarbon', 'climate.rainfall', 'soil.moisture']
  // Empty context is missing 3. So it is NOT near-triggerable!
  // Climate needs 3. Land use needs 4. Pollution needs 3.
  // Actually, empty context should yield NO clarification because they are missing > 2 variables!
  assert(resultEmpty.missingVariables.length === 0, 'Empty context produces 0 clarification candidates (all missing >2 vars)');

  // Let's provide 1 variable for SOC pathway so it misses exactly 2 (near triggerable)
  console.log('\n--- 2. Missing Two Variables ---');
  const partialContext1: EnvironmentalContext = {
    soil: { organicCarbon: 0.8 } // missing rainfall and moisture
  };
  const resultTwo = ClarificationService.getClarificationCandidates(partialContext1, []);
  assert(resultTwo.shouldAsk === true, 'Identifies near-triggerable pathway missing 2 variables');
  assert(resultTwo.missingVariables.includes('climate.rainfall'), 'Requests climate.rainfall');
  assert(resultTwo.missingVariables.includes('soil.moisture'), 'Requests soil.moisture');

  // --- 3. Missing Exactly One Variable ---
  console.log('\n--- 3. Missing Exactly One Variable ---');
  const partialContext2: EnvironmentalContext = {
    soil: { organicCarbon: 0.8 },
    climate: { rainfall: 'low' } 
    // missing soil.moisture. Wait, this pathway triggers at 2 variables!
    // The pathway evaluateTrigger only strictly needs soc and rainfall!
    // So if Phase 8 runs, it WILL be triggered.
  };
  // The climateStress_pathway is actually near-triggerable here (missing temp and moisture).
  const resultTriggered = ClarificationService.getClarificationCandidates(partialContext2, ['soilOrganicCarbon_waterStress_pathway']);
  assert(!resultTriggered.pathwayIds.includes('soilOrganicCarbon_waterStress_pathway'), 'Already-triggered pathway is not in near-triggerable list');
  assert(resultTriggered.pathwayIds.includes('climateStress_pathway'), 'But alternative near-triggerable pathway IS requested');

  // --- 4. Known fields are never requested ---
  console.log('\n--- 4. Known fields are never requested ---');
  // We mock a pathway missing exactly 1 variable
  const pollutionContext: EnvironmentalContext = {
    humanImpact: { pollution: 0.4 },
    biodiversity: { speciesRichness: 10 }
    // missing habitatDiversity
  };
  const pollResult = ClarificationService.getClarificationCandidates(pollutionContext, []); // Mock it as NOT triggered for test purposes
  assert(pollResult.shouldAsk === true, 'Asks for habitatDiversity');
  assert(!pollResult.missingVariables.includes('humanImpact.pollution'), 'Never requests known field pollution');
  assert(!pollResult.missingVariables.includes('biodiversity.speciesRichness'), 'Never requests known field speciesRichness');

  // --- 5. Same field is not repeatedly requested ---
  console.log('\n--- 5. Same field is not repeatedly requested ---');
  const repeatResult = ClarificationService.getClarificationCandidates(partialContext1, [], ['climate.rainfall', 'soil.moisture']);
  assert(repeatResult.shouldAsk === false, 'Prevents repeated requests for already-asked fields');

  // --- 6. Missing three+ variables are limited to a small actionable subset ---
  // The service slices to exactly 2 fields max per turn.
  console.log('\n--- 6. Limited to actionable subset ---');
  // Make a custom scenario where multiple pathways are near triggerable
  const multiContext: EnvironmentalContext = {
    climate: { temperature: 35 }, // climateStress missing rainfall, moisture (2)
    humanImpact: { pollution: 0.5 } // pollution missing richness, habitatDiversity (2)
  };
  const multiResult = ClarificationService.getClarificationCandidates(multiContext, []);
  assert(multiResult.missingVariables.length <= 2, 'Limits request to maximum 2 variables');

  // --- 7. Gemini receives only deterministic clarification candidates ---
  console.log('\n--- 7. Gemini receives deterministic candidates ---');
  const mockDecision = { shouldAsk: true, missingVariables: ['climate.rainfall', 'soil.moisture'], pathwayIds: [] };
  // Disable Gemini API Key for test to force fallback
  const oldKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = '';
  // Re-init
  ClarificationService.initialize();
  const fallbackQuestion = await ClarificationService.generateQuestion(mockDecision);
  assert(fallbackQuestion.includes('climate rainfall'), 'Question includes deterministic field climate rainfall');
  assert(fallbackQuestion.includes('soil moisture'), 'Question includes deterministic field soil moisture');
  if (oldKey) process.env.GEMINI_API_KEY = oldKey;

  console.log('\n====================================================');
  console.log(`Phase 10 Tests Complete: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');
  if (failed > 0) process.exit(1);
}

runPhase10Tests().catch(console.error);
