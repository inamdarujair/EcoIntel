import { connectDB, disconnectDB } from '../db/connection';
import { searchSimilarChunks } from '../rag/vectorStore';

async function runQueries() {
  await connectDB();

  console.log('====================================================');
  console.log('EcoIntel Phase 5 — Semantic Search Verification');
  console.log('====================================================\n');

  // QUERY 1
  console.log('----------------------------------------------------');
  console.log('QUERY 1: "soil organic carbon water retention and moisture capacity"');
  console.log('----------------------------------------------------');
  const q1 = await searchSimilarChunks({
    query: 'soil organic carbon water retention and moisture capacity',
    topK: 5,
    threshold: 0.2,
  });
  console.log(`Search Engine: ${q1.searchEngine}, Total Candidates Evaluated: ${q1.totalCandidates}`);
  q1.results.forEach((r, idx) => {
    console.log(`  [${idx + 1}] Score: ${r.score} | Title: "${r.title}" | Org: ${r.organization}`);
    console.log(`      Variables: [${r.environmentalVariables.join(', ')}]`);
    console.log(`      Snippet: ${r.snippet.substring(0, 110)}...`);
  });

  // QUERY 2
  console.log('\n----------------------------------------------------');
  console.log('QUERY 2: "habitat fragmentation edge effects and extinction debt"');
  console.log('----------------------------------------------------');
  const q2 = await searchSimilarChunks({
    query: 'habitat fragmentation edge effects and extinction debt',
    topK: 5,
    threshold: 0.2,
  });
  console.log(`Search Engine: ${q2.searchEngine}, Total Candidates Evaluated: ${q2.totalCandidates}`);
  q2.results.forEach((r, idx) => {
    console.log(`  [${idx + 1}] Score: ${r.score} | Title: "${r.title}" | Org: ${r.organization}`);
    console.log(`      Variables: [${r.environmentalVariables.join(', ')}]`);
    console.log(`      Snippet: ${r.snippet.substring(0, 110)}...`);
  });

  // QUERY 3
  console.log('\n----------------------------------------------------');
  console.log('QUERY 3: "agroforestry intercropping and crop yield stability"');
  console.log('----------------------------------------------------');
  const q3 = await searchSimilarChunks({
    query: 'agroforestry intercropping and crop yield stability',
    topK: 5,
    threshold: 0.2,
  });
  console.log(`Search Engine: ${q3.searchEngine}, Total Candidates Evaluated: ${q3.totalCandidates}`);
  q3.results.forEach((r, idx) => {
    console.log(`  [${idx + 1}] Score: ${r.score} | Title: "${r.title}" | Org: ${r.organization}`);
    console.log(`      Variables: [${r.environmentalVariables.join(', ')}]`);
    console.log(`      Snippet: ${r.snippet.substring(0, 110)}...`);
  });

  // METADATA FILTER TEST
  console.log('\n----------------------------------------------------');
  console.log('METADATA FILTER TEST: Query "soil moisture" with filter variables: ["humanImpact.pollution"]');
  console.log('----------------------------------------------------');
  const qFilter = await searchSimilarChunks({
    query: 'soil moisture',
    variables: ['humanImpact.pollution'],
    topK: 5,
  });
  console.log(`Search Engine: ${qFilter.searchEngine}, Total Candidates Evaluated: ${qFilter.totalCandidates}`);
  console.log(`Returned Results Count: ${qFilter.results.length}`);
  qFilter.results.forEach((r, idx) => {
    console.log(`  [${idx + 1}] Score: ${r.score} | Title: "${r.title}"`);
    console.log(`      Variables: [${r.environmentalVariables.join(', ')}]`);
    console.log(`      Snippet: ${r.snippet.substring(0, 110)}...`);
  });

  await disconnectDB();
}

runQueries().catch((err) => {
  console.error(err);
  process.exit(1);
});
