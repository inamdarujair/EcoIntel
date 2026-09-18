import {
  extractFromRules,
  extractEnvironmentalContext,
} from '../services/extractionService';
import { mergeContext } from '../services/contextService';
import { EnvironmentalContext } from '../types';

async function runPhase7Tests() {
  console.log('====================================================');
  console.log('EcoIntel Phase 7 — NL Context Extraction Test Suite');
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

  // --- TEST 1: Explicit Soil Organic Carbon ---
  console.log('--- 1. Explicit Soil Organic Carbon ---');
  const t1 = extractFromRules('My soil organic carbon is 0.3%');
  assert(t1.soil?.organicCarbon === 0.3, 'Extracts SOC = 0.3 from "My soil organic carbon is 0.3%"');

  const t1_alias = extractFromRules('The SOC of our land is 1.2%');
  assert(t1_alias.soil?.organicCarbon === 1.2, 'Extracts SOC = 1.2 from alias "SOC of our land is 1.2%"');

  // --- TEST 2: Rainfall Descriptor ---
  console.log('\n--- 2. Rainfall Descriptor ---');
  const t2 = extractFromRules('Rainfall has been low.');
  assert(t2.climate?.rainfall === 'low', 'Extracts qualitative rainfall = "low" from "Rainfall has been low."');

  // --- TEST 3: Numeric Rainfall ---
  console.log('\n--- 3. Numeric Rainfall ---');
  const t3 = extractFromRules('Annual rainfall is 450 mm.');
  assert(t3.climate?.rainfall === 450, 'Extracts numeric rainfall = 450 from "Annual rainfall is 450 mm."');

  // --- TEST 4: Soil pH ---
  console.log('\n--- 4. Soil pH ---');
  const t4 = extractFromRules('My soil pH is 6.5.');
  assert(t4.soil?.ph === 6.5, 'Extracts ph = 6.5 from "My soil pH is 6.5."');
  assert((t4.soil as any)?.pH === undefined, 'soil.pH is strictly undefined in rule extraction');

  // --- TEST 5: Multi-Field Extraction ---
  console.log('\n--- 5. Multi-Field Extraction ---');
  const t5 = extractFromRules('My soil organic carbon is 0.3%, rainfall is low, and temperature is 32°C.');
  assert(t5.soil?.organicCarbon === 0.3, 'Multi-field extracts soil.organicCarbon = 0.3');
  assert(t5.climate?.rainfall === 'low', 'Multi-field extracts climate.rainfall = "low"');
  assert(t5.climate?.temperature === 32, 'Multi-field extracts climate.temperature = 32');

  // --- TEST 6: Context Merge Function ---
  console.log('\n--- 6. Context Merge Integration ---');
  const existingCtx: Partial<EnvironmentalContext> = {
    soil: { ph: 6.5 },
  };
  const incomingExtracted: Partial<EnvironmentalContext> = {
    soil: { organicCarbon: 0.4 },
    climate: { rainfall: 'moderate' },
  };
  const merged = mergeContext(existingCtx, incomingExtracted, 'test_merge');
  assert(merged.soil?.ph === 6.5, 'Merge preserves existing soil.ph = 6.5');
  assert((merged.soil as any)?.pH === undefined, 'Merge context soil.pH is strictly undefined');
  assert(merged.soil?.organicCarbon === 0.4, 'Merge adds new soil.organicCarbon = 0.4');
  assert(merged.climate?.rainfall === 'moderate', 'Merge adds new climate.rainfall = "moderate"');

  // --- TEST 7: Incremental Context Over Multiple Messages ---
  console.log('\n--- 7. Incremental Multi-Turn Context ---');
  // Message 1
  const resMsg1 = await extractEnvironmentalContext('My soil organic carbon is 0.3% and rainfall is low.');
  let contextTurn1 = mergeContext({}, resMsg1.extractedContext, 'turn_1');
  assert(contextTurn1.soil?.organicCarbon === 0.3, 'Turn 1 records soil.organicCarbon = 0.3');
  assert(contextTurn1.climate?.rainfall === 'low', 'Turn 1 records climate.rainfall = "low"');

  // Message 2
  const resMsg2 = await extractEnvironmentalContext('My soil pH is 6.8.', contextTurn1);
  assert(resMsg2.newFieldsFound.includes('soil.ph'), 'Turn 2 detects soil.ph as new field');
  assert(!resMsg2.newFieldsFound.includes('soil.organicCarbon'), 'Turn 2 does not list existing SOC as new');

  const contextTurn2 = mergeContext(contextTurn1, resMsg2.extractedContext, 'turn_2');
  assert(contextTurn2.soil?.organicCarbon === 0.3, 'Turn 2 preserves Turn 1 soil.organicCarbon');
  assert(contextTurn2.climate?.rainfall === 'low', 'Turn 2 preserves Turn 1 climate.rainfall');
  assert(contextTurn2.soil?.ph === 6.8, 'Turn 2 accumulates soil.ph = 6.8');

  // --- TEST 8: Irrelevant Message Handling ---
  console.log('\n--- 8. Irrelevant Messages ---');
  const t8a = await extractEnvironmentalContext('Hello, how does this work?');
  assert(t8a.newFieldsFound.length === 0, 'Irrelevant greeting yields 0 new fields');
  assert(Object.keys(t8a.extractedContext).length === 0, 'Irrelevant greeting yields empty extractedContext');

  const t8b = await extractEnvironmentalContext('What is the meaning of life?');
  assert(t8b.newFieldsFound.length === 0, 'Philosophical question yields 0 new fields');
  assert(Object.keys(t8b.extractedContext).length === 0, 'Philosophical question yields empty extractedContext');

  // --- TEST 9: Invalid pH Rejection ---
  console.log('\n--- 9. Invalid pH Rejection (pH > 14) ---');
  const t9 = extractFromRules('My soil pH is 18.');
  assert(t9.soil?.ph === undefined, 'Rejects invalid soil pH = 18 without clamping');

  // --- TEST 10: Invalid Moisture Rejection (Moisture > 100%) ---
  console.log('\n--- 10. Invalid Moisture Rejection (Moisture > 100%) ---');
  const t10 = extractFromRules('Soil moisture is 150%.');
  assert(t10.soil?.moisture === undefined, 'Rejects invalid soil moisture = 150% without clamping');

  // --- TEST 11: Gemini Failure Graceful Degradation ---
  console.log('\n--- 11. Gemini Failure Resilience ---');
  // Even if Gemini API key is missing or fails, extraction must return rule results smoothly
  const t11 = await extractEnvironmentalContext('My soil organic carbon is 0.3%');
  assert(
    t11.extractedContext.soil?.organicCarbon === 0.3,
    'Rule-based extraction succeeds regardless of Gemini availability'
  );
  assert(
    t11.fieldMetadata['soil.organicCarbon']?.source === 'rule_based' ||
      t11.fieldMetadata['soil.organicCarbon']?.source === 'hybrid',
    'Metadata captures rule_based/hybrid source'
  );

  // --- TEST 12: Conflict Resolution (Rules Take Precedence) ---
  console.log('\n--- 12. Conflict Resolution (Rule Precedence) ---');
  // In extractEnvironmentalContext, rule extraction value is always chosen when present
  const ruleVal = extractFromRules('My SOC is 0.3%');
  assert(ruleVal.soil?.organicCarbon === 0.3, 'Rule identifies explicit SOC = 0.3');
  // Simulate conflict: rule = 0.3 vs hypothetic gemini = 0.5
  const t12 = await extractEnvironmentalContext('My soil organic carbon is 0.3%');
  assert(
    t12.extractedContext.soil?.organicCarbon === 0.3,
    'Explicit rule-extracted SOC = 0.3 takes precedence over any conflicting candidate'
  );

  // --- TEST 13: Duplicate Existing Field ---
  console.log('\n--- 13. Duplicate Existing Field Ignored in newFieldsFound ---');
  const existingWithSoc: Partial<EnvironmentalContext> = {
    soil: { organicCarbon: 0.3 },
  };
  const t13 = await extractEnvironmentalContext('My SOC is 0.3%', existingWithSoc);
  assert(
    !t13.newFieldsFound.includes('soil.organicCarbon'),
    'Identical value (0.3 === 0.3) is NOT reported in newFieldsFound'
  );

  // --- TEST 14: Unknown Field Rejection ---
  console.log('\n--- 14. Unknown Field Protection ---');
  // Ensure that no arbitrary fields (e.g. crypto, sentiment, random tags) can leak into EnvironmentalContext
  const validKeys = [
    'soil',
    'climate',
    'landUse',
    'land',
    'biodiversity',
    'humanImpact',
    'region',
    'geo',
    'latitude',
    'longitude',
  ];
  const t14 = await extractEnvironmentalContext('I love crypto and bitcoin and my soil pH is 6.5');
  const extractedKeys = Object.keys(t14.extractedContext);
  assert(
    extractedKeys.every((k) => validKeys.includes(k)),
    'Only canonical EnvironmentalContext keys are permitted in extractedContext'
  );
  // ==================================================
  // SECTION 5 REQUIRED REGRESSION TESTS (HOTFIX)
  // ==================================================
  console.log('\n====================================================');
  console.log('--- Section 5 Canonical Normalization Regression Tests ---');
  console.log('====================================================');

  // --- REGRESSION TEST 1 ---
  console.log('\n--- REGRESSION TEST 1: Extraction of "Our current soil pH is 6.5" ---');
  const reg1 = await extractEnvironmentalContext('Our current soil pH is 6.5');
  assert(reg1.extractedContext.soil?.ph === 6.5, 'Regression Test 1: extractedContext.soil.ph === 6.5');
  assert((reg1.extractedContext.soil as any)?.pH === undefined, 'Regression Test 1: Assert soil.pH === undefined in extractedContext');

  // --- REGRESSION TEST 2 ---
  console.log('\n--- REGRESSION TEST 2: Merge preserves ph and forbids pH ---');
  const reg2Merged = mergeContext({}, reg1.extractedContext, 'reg_test_2');
  assert(reg2Merged.soil?.ph === 6.5, 'Regression Test 2: context.soil.ph === 6.5 after merge');
  assert((reg2Merged.soil as any)?.pH === undefined, 'Regression Test 2: Assert context.soil.pH === undefined');

  // Even if an alien object with pH is forced into mergeContext:
  const dirtyAlienCtx = { soil: { pH: 6.5 } } as any;
  const cleanedMerged = mergeContext({}, dirtyAlienCtx, 'alien_test');
  assert(cleanedMerged.soil?.ph === 6.5, 'Regression Test 2 (Alien): normalized dirty pH to canonical soil.ph === 6.5');
  assert((cleanedMerged.soil as any)?.pH === undefined, 'Regression Test 2 (Alien): cleanedMerged.soil.pH === undefined');

  // --- REGRESSION TEST 3 ---
  console.log('\n--- REGRESSION TEST 3: Multi-turn Turn 1 & Turn 2 ---');
  // Turn 1: "My soil organic carbon is 0.3% and rainfall has been low"
  const turn1Extracted = await extractEnvironmentalContext('My soil organic carbon is 0.3% and rainfall has been low');
  const turn1Context = mergeContext({}, turn1Extracted.extractedContext, 'turn_1');

  // Turn 2: "Our current soil pH is 6.5 and region is East African Savannah"
  const turn2Extracted = await extractEnvironmentalContext('Our current soil pH is 6.5 and region is East African Savannah', turn1Context);
  const finalContext = mergeContext(turn1Context, turn2Extracted.extractedContext, 'turn_2');

  assert(finalContext.soil?.organicCarbon === 0.3, 'Regression Test 3: finalContext.soil.organicCarbon = 0.3');
  assert(finalContext.soil?.ph === 6.5, 'Regression Test 3: finalContext.soil.ph = 6.5');
  assert(finalContext.climate?.rainfall === 'low', 'Regression Test 3: finalContext.climate.rainfall = "low"');
  assert(finalContext.region === 'East African Savannah', 'Regression Test 3: finalContext.region = "East African Savannah"');
  assert((finalContext.soil as any)?.pH === undefined, 'Regression Test 3: Assert finalContext.soil.pH === undefined');

  // --- REGRESSION TEST 4 ---
  console.log('\n--- REGRESSION TEST 4: Response Payload Serialization Never Contains soil.pH ---');
  const serializedResponse = JSON.stringify({
    success: true,
    extraction: turn2Extracted,
    context: finalContext,
  });
  // Must NOT have "pH": (exact casing) or "soil.pH" anywhere
  const hasSoilPHKey = /"pH"\s*:/.test(serializedResponse) || /"soil\.pH"/.test(serializedResponse) || /"soil_pH"\s*:/.test(serializedResponse);
  assert(!hasSoilPHKey, 'Regression Test 4: Serialized payload contains NO "pH" field whatsoever');
  assert(serializedResponse.includes('"ph":6.5'), 'Regression Test 4: Serialized payload contains canonical "ph":6.5');

  console.log('\n====================================================');
  console.log(`Phase 7 Tests Complete: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runPhase7Tests().catch((err) => {
  console.error('Phase 7 test suite failed:', err);
  process.exit(1);
});
