async function runRegressionChecks() {
  const baseUrl = 'http://localhost:5000/api';
  console.log('====================================================');
  console.log('EcoIntel — Phase 1-4 Regression Verification');
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

  // 1. Health
  try {
    const r = await fetch(`${baseUrl}/health`);
    const data = (await r.json()) as any;
    assert(r.status === 200 && data.status === 'ok', 'Phase 1: GET /api/health');
  } catch (err: any) {
    assert(false, 'Phase 1: GET /api/health', err.message);
  }

  // 2. Chat
  let convId = '';
  try {
    const r = await fetch(`${baseUrl}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Hello EcoIntel Phase 5 test' }),
    });
    const data = (await r.json()) as any;
    convId = data.conversationId;
    assert(r.status === 200 && typeof data.reply === 'string', 'Phase 2: POST /api/chat');
  } catch (err: any) {
    assert(false, 'Phase 2: POST /api/chat', err.message);
  }

  // 3. Analyze
  try {
    const r = await fetch(`${baseUrl}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: convId,
        sourceMessageId: 'msg-phase5-test',
        region: 'Test Ecosystem',
        soil: { ph: 6.5, organicCarbon: 2.8, moisture: 24.5 },
        climate: { temperature: 21.0, rainfall: 750 },
        landUse: { type: 'agroforestry', fragmentation: 0.25 },
        biodiversity: { speciesRichness: 42, habitatDiversity: 0.78 },
        humanImpact: { pollution: 0.15, deforestation: 0.05 },
      }),
    });
    const data = (await r.json()) as any;
    assert(
      (r.status === 200 || r.status === 201) && data.context && data.context.soil?.ph === 6.5,
      'Phase 3: POST /api/analyze (Context Merge & Validation)'
    );
  } catch (err: any) {
    assert(false, 'Phase 3: POST /api/analyze', err.message);
  }

  // 4. Conversation Context
  try {
    const r = await fetch(`${baseUrl}/conversations/${convId}/context`);
    const data = (await r.json()) as any;
    assert(r.status === 200 && data.soil?.ph === 6.5, 'Phase 2/3: GET /api/conversations/:id/context');
  } catch (err: any) {
    assert(false, 'Phase 2/3: GET /api/conversations/:id/context', err.message);
  }

  // 5. Knowledge Stats
  try {
    const r = await fetch(`${baseUrl}/knowledge/stats`);
    const data = (await r.json()) as any;
    assert(
      r.status === 200 && data.documentCount === 18 && data.chunkCount === 36,
      'Phase 4: GET /api/knowledge/stats (18 docs, 36 chunks)'
    );
  } catch (err: any) {
    assert(false, 'Phase 4: GET /api/knowledge/stats', err.message);
  }

  // 6. Knowledge Documents
  let sampleDocId = '';
  try {
    const r = await fetch(`${baseUrl}/knowledge/documents?limit=5`);
    const data = (await r.json()) as any;
    sampleDocId = data.documents[0]?._id;
    assert(r.status === 200 && data.documents.length === 5, 'Phase 4: GET /api/knowledge/documents');
  } catch (err: any) {
    assert(false, 'Phase 4: GET /api/knowledge/documents', err.message);
  }

  // 7. Sources
  try {
    const r = await fetch(`${baseUrl}/sources/${sampleDocId}`);
    const data = (await r.json()) as any;
    assert(r.status === 200 && (data.document?._id === sampleDocId || data._id === sampleDocId), 'Phase 2/4: GET /api/sources/:id');
  } catch (err: any) {
    assert(false, 'Phase 2/4: GET /api/sources/:id', err.message);
  }

  console.log('\n====================================================');
  console.log(`Regression Results: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) process.exit(1);
}

runRegressionChecks().catch((err) => {
  console.error(err);
  process.exit(1);
});
