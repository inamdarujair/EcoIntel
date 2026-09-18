"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const connection_1 = require("../src/db/connection");
const ingestionService_1 = require("../src/services/ingestionService");
async function runCliIngest() {
    console.log('====================================================');
    console.log('EcoIntel — Scientific Knowledge Ingestion Pipeline');
    console.log('Phase 5: Embeddings & Vector Wiring');
    console.log('====================================================\n');
    try {
        console.log('[1/4] Connecting to MongoDB...');
        await (0, connection_1.connectDB)();
        console.log('\n[2/4] Reading & Validating knowledgeSeed.json...');
        const seedPath = path_1.default.resolve(__dirname, '../src/data/knowledgeSeed.json');
        console.log(`      Path: ${seedPath}`);
        console.log('\n[3/4] Ingesting documents, chunks, and computing real embeddings...');
        const stats = await (0, ingestionService_1.ingestKnowledgeBase)(seedPath);
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
        await (0, connection_1.disconnectDB)();
        process.exit(0);
    }
    catch (error) {
        console.error('\n❌ Ingestion Pipeline Failed:', error);
        try {
            await (0, connection_1.disconnectDB)();
        }
        catch {
            // Ignore disconnect error on failure
        }
        process.exit(1);
    }
}
runCliIngest();
