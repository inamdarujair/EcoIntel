import path from 'path';
import { connectDB, disconnectDB } from '../src/db/connection';
import { ingestKnowledgeBase } from '../src/services/ingestionService';

async function runCliIngest() {
  console.log('====================================================');
  console.log('EcoIntel — Scientific Knowledge Ingestion Pipeline');
  console.log('Phase 5: Embeddings & Vector Wiring');
  console.log('====================================================\n');

  try {
    console.log('[1/4] Connecting to MongoDB...');
    await connectDB();

    console.log('\n[2/4] Reading & Validating knowledgeSeed.json...');
    const seedPath = path.resolve(__dirname, '../src/data/knowledgeSeed.json');
    console.log(`      Path: ${seedPath}`);

    console.log('\n[3/4] Ingesting documents, chunks, and computing real embeddings...');
    const stats = await ingestKnowledgeBase(seedPath);

    console.log('\n[4/4] Ingestion Completed Successfully!');
    console.log('----------------------------------------------------');
    console.log(`  • Documents Processed : ${stats.documentsProcessed}`);
    console.log(`  • Documents Created   : ${stats.documentsCreated}`);
    console.log(`  • Documents Updated   : ${stats.documentsUpdated}`);
    console.log(`  • Chunks Created      : ${stats.chunksCreated}`);
    console.log(`  • Chunks Updated      : ${stats.chunksUpdated}`);
    console.log(`  • Chunks Embedded     : ${stats.chunksEmbedded}`);
    console.log(`  • Embedding Failures  : ${stats.embeddingFailures}`);
    console.log(`  • Failed Docs         : ${stats.failed}`);
    console.log(`  • Duration            : ${stats.durationMs}ms`);
    console.log('----------------------------------------------------\n');

    await disconnectDB();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Ingestion Pipeline Failed:', error);
    try {
      await disconnectDB();
    } catch {
      // Ignore disconnect error on failure
    }
    process.exit(1);
  }
}

runCliIngest();
