import { connectDB, disconnectDB } from '../db/connection';
import { KnowledgeChunk } from '../models';

async function verifyAllChunks() {
  await connectDB();

  const chunks = await KnowledgeChunk.find({}).lean();
  console.log(`Total KnowledgeChunks in DB: ${chunks.length}`);

  let validCount = 0;
  const issues: string[] = [];

  for (const chunk of chunks) {
    if (!chunk.embedding || !Array.isArray(chunk.embedding)) {
      issues.push(`Chunk ${chunk._id} missing embedding array`);
      continue;
    }
    if (chunk.embedding.length !== 384) {
      issues.push(`Chunk ${chunk._id} embedding length is ${chunk.embedding.length}, expected 384`);
      continue;
    }
    if (chunk.embeddingModel !== 'all-MiniLM-L6-v2') {
      issues.push(`Chunk ${chunk._id} embeddingModel is '${chunk.embeddingModel}'`);
      continue;
    }
    if (chunk.embeddingProvider !== 'transformers') {
      issues.push(`Chunk ${chunk._id} embeddingProvider is '${chunk.embeddingProvider}'`);
      continue;
    }
    if (chunk.embeddingDimension !== 384) {
      issues.push(`Chunk ${chunk._id} embeddingDimension is ${chunk.embeddingDimension}`);
      continue;
    }
    validCount++;
  }

  console.log(`Chunks satisfying all criteria: ${validCount} / ${chunks.length}`);
  if (issues.length > 0) {
    console.error('Issues detected:');
    issues.forEach((iss) => console.error(`  - ${iss}`));
  } else {
    console.log('✅ ALL chunks verified with 100% compliance.');
  }

  await disconnectDB();
  if (issues.length > 0) process.exit(1);
}

verifyAllChunks().catch((err) => {
  console.error(err);
  process.exit(1);
});
