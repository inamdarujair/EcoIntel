async function testApi() {
  const url = 'http://localhost:5000/api/knowledge/search';

  console.log('====================================================');
  console.log('EcoIntel Phase 6 — Live API Endpoint Verification');
  console.log('====================================================\n');

  console.log('--- 1. Testing Insufficient Evidence via API ---');
  const r1 = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: 'quantum superposition in superconducting qubits at low temperature',
      threshold: 0.40,
    }),
  });
  const data1 = await r1.json() as any;
  console.log('HTTP Status:', r1.status);
  console.log('Response status:', data1.status);
  console.log('Message:', data1.message);
  console.log('Results length:', data1.results?.length);

  console.log('\n--- 2. Testing Batch Pathway Search via API ---');
  const r2 = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      batch: [
        {
          pathwayId: 'soil_moisture_capacity',
          queryText: 'soil organic carbon water retention and moisture capacity',
          variables: ['soil.organicCarbon', 'soil.moisture'],
          topK: 3,
          threshold: 0.35,
        },
        {
          pathwayId: 'biodiversity_corridors',
          queryText: 'habitat fragmentation forest edges and wildlife corridors',
          variables: ['landUse.fragmentation', 'biodiversity.speciesRichness'],
          topK: 3,
          threshold: 0.35,
        },
      ],
    }),
  });
  const data2 = await r2.json() as any;
  console.log('HTTP Status:', r2.status);
  console.log('Batch flag:', data2.batch);
  console.log('Pathways returned:', Object.keys(data2.pathways || {}));
  console.log('Unique evidence count:', data2.uniqueEvidenceCount);
  console.log('Shared evidence count:', data2.sharedEvidenceCount);
  for (const [pId, pData] of Object.entries((data2.pathways || {}) as Record<string, any>)) {
    console.log(`  Pathway [${pId}]: status=${pData.status}, count=${pData.evidence.length}`);
    pData.evidence.forEach((e: any) => {
      console.log(`    - [Score: ${e.score}] "${e.title}" (shared: ${e.isShared})`);
    });
  }

  console.log('\n--- 3. Testing Single Targeted Search via API ---');
  const r3 = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: 'agroforestry intercropping and crop yield stability',
      variables: ['biodiversity.habitatDiversity', 'soil.moisture'],
      topK: 2,
      threshold: 0.35,
    }),
  });
  const data3 = await r3.json() as any;
  console.log('HTTP Status:', r3.status);
  console.log('Query status:', data3.status);
  console.log('Total results:', data3.results?.length);
  data3.results?.forEach((r: any) => {
    console.log(`  - [Score: ${r.score}] "${r.title}" | Org: ${r.organization} | Year: ${r.year}`);
    console.log(`    URL: ${r.url}`);
    console.log(`    Shared: ${r.isShared}`);
  });

  console.log('\n====================================================');
  console.log('Live API Verification Completed Successfully!');
  console.log('====================================================');
}

testApi().catch((err) => {
  console.error('API test failed:', err);
  process.exit(1);
});
