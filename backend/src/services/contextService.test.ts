import { mergeContext, computeMissingFields, CANONICAL_ENVIRONMENTAL_FIELDS } from './contextService';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion failed: ${message}`);
    throw new Error(message);
  } else {
    console.log(`✅ ${message}`);
  }
}

export function runContextMergeTests() {
  console.log('\n--- Running contextService Unit Tests ---');

  // Test 1: Empty initial context computeMissingFields returns all canonical fields
  const emptyMissing = computeMissingFields({});
  assert(
    emptyMissing.length === CANONICAL_ENVIRONMENTAL_FIELDS.length,
    `Empty context missing ${emptyMissing.length} fields (expected ${CANONICAL_ENVIRONMENTAL_FIELDS.length})`
  );

  // Test 2: Initial partial input { soil: { organicCarbon: 0.3 } }
  const step1 = mergeContext({}, { soil: { organicCarbon: 0.3 } }, 'turn_1');
  assert(step1.soil?.organicCarbon === 0.3, 'Step 1: organicCarbon is 0.3');
  assert(!(step1.missingFields?.includes('soil.organicCarbon') ?? false), 'Step 1: organicCarbon removed from missingFields');
  assert(Boolean(step1.missingFields?.includes('soil.ph')), 'Step 1: soil.ph still in missingFields');
  assert(step1.fieldSources?.['soil.organicCarbon'] === 'turn_1', 'Step 1: fieldSource recorded for organicCarbon');

  // Test 3: Second partial input { climate: { rainfall: "low" } }
  const step2 = mergeContext(step1, { climate: { rainfall: 'low' } }, 'turn_2');
  assert(step2.soil?.organicCarbon === 0.3, 'Step 2: organicCarbon retained from step 1');
  assert(step2.climate?.rainfall === 'low', 'Step 2: rainfall is "low"');
  assert(!(step2.missingFields?.includes('climate.rainfall') ?? false), 'Step 2: rainfall removed from missingFields');
  assert(!(step2.missingFields?.includes('soil.organicCarbon') ?? false), 'Step 2: organicCarbon still absent from missingFields');
  assert(step2.fieldSources?.['soil.organicCarbon'] === 'turn_1', 'Step 2: original source preserved for organicCarbon');
  assert(step2.fieldSources?.['climate.rainfall'] === 'turn_2', 'Step 2: new source recorded for rainfall');

  // Test 4: Incoming null/undefined does not overwrite known values
  const step3 = mergeContext(
    step2,
    { soil: { organicCarbon: undefined, ph: 6.8 } },
    'turn_3'
  );
  assert(step3.soil?.organicCarbon === 0.3, 'Step 3: organicCarbon NOT overwritten by undefined');
  assert(step3.soil?.ph === 6.8, 'Step 3: new ph 6.8 merged');
  assert(!(step3.missingFields?.includes('soil.ph') ?? false), 'Step 3: soil.ph removed from missingFields');

  // Test 5: Purity check - step1 was not mutated by step2
  assert(step1.climate === undefined, 'Purity: step1 was not mutated when step2 was created');

  console.log('--- All contextService Unit Tests Passed! ---\n');
}

if (require.main === module) {
  runContextMergeTests();
}
