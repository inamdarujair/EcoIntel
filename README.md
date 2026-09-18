# EcoIntel — AI Biodiversity Intelligence System

EcoIntel is an AI Biodiversity Intelligence System designed for the Darukaa.Earth challenge. It combines structured ecological context tracking, curated peer-reviewed environmental science corpora, real local transformer embeddings, vector similarity search, and natural-language environmental context extraction to power grounded ecological reasoning and recommendations.

---

## Vector Search & Embedding Architecture (Phase 5)

### 1. Embedding Engine
- **Embedding Provider**: `transformers` ([@xenova/transformers](https://github.com/xenova/transformers.js))
- **Primary Model**: `all-MiniLM-L6-v2` (`Xenova/all-MiniLM-L6-v2`)
- **Vector Dimension**: `384`
- **Why 384 Dimensions?**:
  - **Zero Cloud API Latency & Free of Rate Limits**: Embeddings are computed strictly in-process inside the Node.js runtime using ONNX runtime WebAssembly.
  - **High Semantic Density**: `all-MiniLM-L6-v2` is specifically trained and fine-tuned for semantic textual similarity (STS) and sentence-pair matching, outperforming older dense models while requiring a fraction of memory.
  - **L2 Unit Normalization**: Vectors are normalized to unit length $\|v\|_2 = 1.0$, allowing cosine similarity to be calculated directly as an inner dot product ($\mathbf{a} \cdot \mathbf{b}$).
- **Stale Vector Protection**: Every chunk document explicitly persists:
  - `embeddingModel: "all-MiniLM-L6-v2"`
  - `embeddingProvider: "transformers"`
  - `embeddingDimension: 384`
  If any of these configurations differ from the active engine, the chunk is automatically flagged as stale and re-embedded during ingestion.

---

## Targeted RAG Retrieval System (Phase 6)

Phase 6 formalizes `RetrievalService` (`backend/src/rag/retrievalService.ts`) to serve as the evidence foundation for reasoning pathways:

### 1. Key Capabilities
- **`retrieveEvidence(queryText, variables[], topK, minScoreThreshold)`**:
  - Retrieves typed `EvidenceItem` records `{ chunkId, documentId, text, title, organization, year, url, score, isShared }`.
  - Enforces minimum relevance threshold (default `0.40`).
  - Returns `[]` if no chunks meet threshold (prevents low-relevance hallucination).
- **`retrieveEvidenceDetailed(options)`**:
  - Returns explicit status: `'sufficient'` vs `'insufficient_evidence'`.
- **`retrieveForPathways(pathwayQueries[])`**:
  - Accepts a batch of pathway query specifications: `{ pathwayId, queryText, variables[], topK?, minScoreThreshold? }`.
  - Groups returned evidence cleanly by `pathwayId`.
- **Cross-Pathway Deduplication & Shared Tagging**:
  - If a chunk is legitimately retrieved by multiple pathway queries, it is attached to both pathways, but tagged with `isShared: true`.
  - UI and reasoning layers inspect `isShared` to avoid double-counting evidence citations or statistics.

---

## Natural Language Context Extraction (Phase 7)

Phase 7 implements `ExtractionService` (`backend/src/services/extractionService.ts`) and updates `POST /api/chat` to convert natural language environmental information into the canonical `EnvironmentalContext` model.

### 1. Extraction Pipeline

```
User Message
     │
     ▼
Rule-Based Explicit Extraction (Regex Pre-Pass)
     │
     ▼
Optional Gemini Semantic Extraction Assistance
     │
     ▼
Validation & Range Enforcement (Zod Schemas)
     │
     ▼
Conflict Resolution (Explicit Rules ALWAYS Win over LLM)
     │
     ▼
Phase 3 mergeContext() (Pure Merge & Provenance Tracking)
     │
     ▼
Persistent EnvironmentalContext (Linked to Conversation)
     │
     ▼
Context-Aware Acknowledgement
```

### 2. Supported Canonical Fields & Aliases
- **Soil**:
  - `soil.ph`: Matches `"soil pH is 6.5"`, `"pH 6.2"`, `"pH of 7.1"`. Range: `[0, 14]`.
  - `soil.organicCarbon`: Matches `"0.3% organic carbon"`, `"SOC of 1.2%"`, `"SOC is 0.5"`, `"soil organic carbon is 0.3%"`. Range: `>= 0`.
  - `soil.moisture`: Matches `"soil moisture is 20%"`, `"moisture: 25%"`. Range: `[0, 100]`.
- **Climate**:
  - `climate.temperature`: Matches `"temperature is 32°C"`, `"mean temperature of 18 C"`.
  - `climate.rainfall`: Matches numeric (`"Annual rainfall is 450 mm"`) and qualitative descriptors (`"rainfall has been low"`, `"low rainfall"`, `"drought"`, `"moderate"`, `"seasonal"`).
- **Land Use**:
  - `landUse.type`: Matches `"agroforestry"`, `"cropland"`, `"intercropping"`, `"pasture"`, `"silvopasture"`, `"primary forest"`, `"grassland"`.
  - `landUse.fragmentation`: Numeric index `[0, 1]` or descriptors (`"habitat is fragmented"` $\to$ 0.5).
- **Biodiversity**:
  - `biodiversity.speciesRichness`: Matches `"species richness is 42"`, `"30 species"`.
  - `biodiversity.habitatDiversity`: Matches `"habitat diversity index of 0.75"`.
- **Human Impact**:
  - `humanImpact.pollution`: Matches `"pollution index 0.2"`. Range: `[0, 1]`.
  - `humanImpact.deforestation`: Matches `"deforestation rate 0.05"`.
- **Region**:
  - `region`: Matches `"My region is East African Savannah"`, `"located in Mediterranean Basin"`.

### 3. Engineering Rules & Fallbacks
- **Rule Precedence**: Explicit rule-based extraction always wins over Gemini output if there is any numeric/value conflict.
- **Strict Range Validation**: Out-of-range values (e.g. `pH = 18`, `moisture = 150%`) are immediately rejected without clamping.
- **Graceful Gemini Failure**: If `GEMINI_API_KEY` is invalid, missing, or encounters rate limits, the system logs a warning and falls back to deterministic rule extraction without throwing 500 errors.
- **Multi-Turn Memory**: New incoming messages merge with previously known fields via Phase 3's `mergeContext()`. Prior fields remain intact across conversation turns.
- **Irrelevant Message Handling**: Non-environmental messages (e.g. `"What is the meaning of life?"`) produce `newFieldsFound = []` and leave context completely unchanged.

### 4. Chat API Request & Response Structure (`POST /api/chat`)

**Request**:
```json
{
  "conversationId": "6aace0a622dcf9d0597f5f40",
  "message": "Our current soil pH is 6.5 and region is East African Savannah"
}
```

**Response**:
```json
{
  "conversationId": "6aace0a622dcf9d0597f5f40",
  "reply": "I've recorded your soil pH as 6.5 and region as East African Savannah. Your environmental context has been updated.",
  "messageId": "6aace0a622dcf9d0597f5f45",
  "userMessageId": "6aace0a622dcf9d0597f5f44",
  "extraction": {
    "extractedContext": {
      "soil": { "ph": 6.5, "pH": 6.5 },
      "region": "East African Savannah"
    },
    "newFieldsFound": ["soil.ph", "region"],
    "fieldMetadata": {
      "soil.ph": { "field": "soil.ph", "value": 6.5, "source": "rule_based", "confidence": 0.95 },
      "region": { "field": "region", "value": "East African Savannah", "source": "rule_based", "confidence": 0.95 }
    },
    "llmAttempted": true,
    "llmSuccess": false
  },
  "context": {
    "soil": { "organicCarbon": 0.3, "ph": 6.5, "pH": 6.5 },
    "climate": { "rainfall": "low" },
    "region": "East African Savannah",
    "fieldSources": {
      "soil.organicCarbon": "msg_6aace0a622dcf9d0597f5f41",
      "climate.rainfall": "msg_6aace0a622dcf9d0597f5f41",
      "soil.ph": "msg_6aace0a622dcf9d0597f5f44",
      "region": "msg_6aace0a622dcf9d0597f5f44"
    }
  }
}
```

---

## Automated Test Verification

- **Phase 7 Suite** (`backend/src/tests/phase7Extraction.test.ts`):
  - 31 assertions: SOC, rainfall descriptors, numeric rainfall, pH, multi-field extraction, context merge, multi-turn accumulation, irrelevant messages, invalid value rejection, Gemini degradation, conflict resolution, duplicate ignoring, unknown field rejection.
  - Run: `npx tsx src/tests/phase7Extraction.test.ts` (All 31 PASSED).
- **Phase 6 Suite** (`backend/src/tests/phase6RetrievalService.test.ts`):
  - 29 assertions: evidence shaping, thresholding, insufficient evidence, pathway batching, shared deduplication.
  - Run: `npx tsx src/tests/phase6RetrievalService.test.ts` (All 29 PASSED).
- **Phase 5 Suite** (`backend/src/tests/phase5EmbeddingVector.test.ts`):
  - 35 assertions: embedding, normalization, cosine similarity, index fallback.
  - Run: `npx tsx src/tests/phase5EmbeddingVector.test.ts` (All 35 PASSED).
- **Regression Suite** (`backend/src/tests/regressionPhase1to4.test.ts`):
  - 7 assertions: health, chat, analyze, context, stats, documents, sources.
  - Run: `npx tsx src/tests/regressionPhase1to4.test.ts` (All 7 PASSED).

---

## Project Structure

```
├── backend/
│   ├── scripts/
│   │   └── ingest.ts             # Knowledge base CLI ingestion runner
│   ├── src/
│   │   ├── config/               # Fail-fast environment loader
│   │   ├── data/
│   │   │   └── knowledgeSeed.json# 18 verified peer-reviewed scientific documents
│   │   ├── db/
│   │   │   └── connection.ts     # MongoDB connection module
│   │   ├── middleware/           # Error handling & dev logger
│   │   ├── models/               # Mongoose models (Conversation, Message, EnvironmentalContext, etc.)
│   │   ├── rag/
│   │   │   ├── vectorStore.ts    # Dual-mode vector search (Atlas + local cosine fallback)
│   │   │   └── retrievalService.ts# Targeted evidence retrieval, thresholding, pathway batching
│   │   ├── routes/
│   │   │   ├── chat.routes.ts    # POST /api/chat with NL extraction & context merge
│   │   │   ├── analyze.routes.ts # POST /api/analyze with structured input validation
│   │   │   ├── conversation.routes.ts
│   │   │   ├── knowledge.routes.ts# POST /api/knowledge/search & stats
│   │   │   └── source.routes.ts
│   │   ├── services/
│   │   │   ├── extractionService.ts# Hybrid NL extractor (Rule pre-pass + Gemini assistance)
│   │   │   ├── contextService.ts   # Pure mergeContext() & missing field computation
│   │   │   ├── embeddingService.ts # Transformers.js embedding engine
│   │   │   └── ingestionService.ts # Ingestion pipeline
│   │   └── tests/
│   │       ├── phase7Extraction.test.ts
│   │       ├── liveChatApiVerification.ts
│   │       ├── phase6RetrievalService.test.ts
│   │       ├── testApiEndpoints.ts
│   │       ├── phase5EmbeddingVector.test.ts
│   │       └── regressionPhase1to4.test.ts
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── app/                  # Next.js App Router
│   │   ├── components/           # UI components
│   │   └── lib/
│   │       └── api.ts            # Client wrapper with checkHealth & searchKnowledge
│   ├── package.json
│   └── tsconfig.json
```
