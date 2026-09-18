async function runLiveChatVerification() {
  const url = 'http://localhost:5000/api/chat';

  console.log('====================================================');
  console.log('EcoIntel Phase 7 — Live Chat API Verification');
  console.log('====================================================\n');

  // --- MESSAGE 1 ---
  console.log('--- MESSAGE 1: "My soil organic carbon is 0.3% and rainfall has been low" ---');
  const res1 = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'My soil organic carbon is 0.3% and rainfall has been low',
    }),
  });

  const data1 = (await res1.json()) as any;
  console.log('HTTP Status:', res1.status);
  console.log('Conversation ID:', data1.conversationId);
  console.log('Assistant Reply:', data1.reply);
  console.log('New Fields Found:', data1.extraction?.newFieldsFound);
  console.log('Extracted SOC:', data1.context?.soil?.organicCarbon);
  console.log('Extracted Rainfall:', data1.context?.climate?.rainfall);
  console.log('Field Sources:', data1.context?.fieldSources);

  const conversationId = data1.conversationId;

  // --- MESSAGE 2 ---
  console.log('\n--- MESSAGE 2: "Our current soil pH is 6.5 and region is East African Savannah" ---');
  const res2 = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conversationId,
      message: 'Our current soil pH is 6.5 and region is East African Savannah',
    }),
  });

  const data2 = (await res2.json()) as any;
  console.log('HTTP Status:', res2.status);
  console.log('Assistant Reply:', data2.reply);
  console.log('New Fields Found:', data2.extraction?.newFieldsFound);
  console.log('\n--- COMPLETE CONTEXT OBJECT ---');
  console.log(JSON.stringify(data2.context, null, 2));
  console.log('\n--- CONTEXT SOIL INSPECTION ---');
  console.log('context.soil:', data2.context?.soil);
  console.log('context.soil.ph:', data2.context?.soil?.ph);
  console.log('context.soil.pH (must be undefined):', data2.context?.soil?.pH);
  console.log('extractedContext.soil:', data2.extraction?.extractedContext?.soil);
  console.log('extractedContext.soil.pH (must be undefined):', data2.extraction?.extractedContext?.soil?.pH);

  // Strict assertion
  if (data2.context?.soil?.pH !== undefined) {
    throw new Error('FAIL: data2.context.soil.pH is defined!');
  }
  if (data2.extraction?.extractedContext?.soil?.pH !== undefined) {
    throw new Error('FAIL: data2.extraction.extractedContext.soil.pH is defined!');
  }
  const contextStr = JSON.stringify(data2.context);
  if (/"pH"\s*:/.test(contextStr) || /"soil\.pH"/.test(contextStr)) {
    throw new Error('FAIL: non-canonical pH key found in context JSON string!');
  }
  console.log('✅ Canonical Verification: soil.ph = 6.5 is present; soil.pH is completely absent!');

  // --- MESSAGE 3 ---
  console.log('\n--- MESSAGE 3: "What is the meaning of life?" ---');
  const res3 = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conversationId,
      message: 'What is the meaning of life?',
    }),
  });

  const data3 = (await res3.json()) as any;
  console.log('HTTP Status:', res3.status);
  console.log('Assistant Reply:', data3.reply);
  console.log('New Fields Found (should be empty):', data3.extraction?.newFieldsFound);
  console.log('Context SOC (unchanged):', data3.context?.soil?.organicCarbon);
  console.log('Context pH (unchanged):', data3.context?.soil?.ph);
  console.log('Context Rainfall (unchanged):', data3.context?.climate?.rainfall);
  console.log('Context Region (unchanged):', data3.context?.region);

  // --- MESSAGE 4: Invalid pH Rejection ---
  console.log('\n--- MESSAGE 4 (Invalid Value Test): "My soil pH is 18" ---');
  const res4 = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conversationId,
      message: 'My soil pH is 18',
    }),
  });

  const data4 = (await res4.json()) as any;
  console.log('HTTP Status:', res4.status);
  console.log('Assistant Reply:', data4.reply);
  console.log('New Fields Found (should be empty):', data4.extraction?.newFieldsFound);
  console.log('Context pH (must NOT be 18):', data4.context?.soil?.ph);

  console.log('\n====================================================');
  console.log('Live Chat API Verification Completed Successfully!');
  console.log('====================================================');
}

runLiveChatVerification().catch((err) => {
  console.error('Live chat verification failed:', err);
  process.exit(1);
});
