/**
 * Biodiversity and Environmental Intelligence Domain Types for EcoIntel
 * Challenge: Darukaa.Earth
 */

export interface SoilContext {
  ph?: number; // Canonical field (0-14)
  organicCarbon?: number; // % (>= 0)
  moisture?: number; // % (0-100)
}

export interface ClimateContext {
  temperature?: number; // °C
  rainfall?: number | string; // mm/year or descriptive "low" / "medium" / "high"
}

export interface LandUseContext {
  type?: string;
  fragmentation?: number; // 0.0 - 1.0 index
}

export interface LandContext {
  landUse?: string;
  landCover?: string;
  habitatFragmentation?: number;
}

export interface GeoContext {
  lat?: number;
  lng?: number;
}

export interface BiodiversityContext {
  speciesRichness?: number; // count >= 0
  habitatDiversity?: number; // index >= 0
}

export interface HumanImpactContext {
  pollution?: number; // 0.0 - 1.0 index
  deforestation?: number; // index or % >= 0
}

export interface EnvironmentalContext {
  id?: string;
  _id?: string;
  region?: string;
  geo?: GeoContext;
  latitude?: number;
  longitude?: number;

  soil?: SoilContext;
  climate?: ClimateContext;
  landUse?: LandUseContext;
  land?: LandContext;
  biodiversity?: BiodiversityContext;
  humanImpact?: HumanImpactContext;

  missingFields?: string[];
  fieldSources?: Record<string, string>;

  rawInput?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface EvidenceMetadata {
  chunkId?: string;
  organization?: string;
  year?: number;
  url?: string;
  isShared?: boolean;
  [key: string]: unknown;
}

export interface Evidence {
  id?: string;
  _id?: string;
  sourceDocument: string;
  pageNumber?: number;
  chunkText: string;
  score?: number;
  metadata?: EvidenceMetadata;
}

export interface RecommendationMetadata {
  evidenceStatus?: 'sufficient' | 'insufficient_evidence' | string;
  message?: string;
  pathwayChain?: string[];
  grounding?: {
    pathwayChainUsed: boolean;
    evidenceIdsUsed: string[];
  };
  [key: string]: unknown;
}

export interface Recommendation {
  id?: string;
  _id?: string;
  conversationId?: string;
  contextId?: string;
  title: string;
  description: string;
  whyItWorks?: string;
  impactedMetrics?: string[];
  timeHorizon?: string;
  confidenceScore?: number; // 0.0 - 1.0
  evidence?: Evidence[];
  reasoningPathway?: string;
  status?: 'proposed' | 'accepted' | 'in_progress' | 'completed' | 'rejected';
  metadata?: RecommendationMetadata;
  createdAt?: string;
  updatedAt?: string;
}

export interface TriggerConditionDetail {
  variable: string;
  operator: string;
  threshold: number | string;
  actualValue: unknown;
  satisfied: boolean;
}

export interface EvidenceItem {
  chunkId: string;
  documentId: string;
  text: string;
  title: string;
  organization?: string;
  year?: number;
  url?: string;
  score: number;
  isShared?: boolean;
}

export interface PathwayRetrievalResult {
  status: 'sufficient' | 'insufficient_evidence';
  evidence: EvidenceItem[];
}

export interface TriggeredPathwayWithEvidence {
  pathwayId: string;
  name: string;
  variablesInvolved: string[];
  variablesUsed: string[];
  chain: string[];
  queryText: string;
  triggerDetails: TriggerConditionDetail[];
  retrieval: PathwayRetrievalResult;
}

export interface ReasoningSummary {
  pathwayCount: number;
  distinctVariablesUsed: string[];
  distinctVariableCount: number;
}

export interface ReasoningEvaluationResult {
  conversationId: string | null;
  context: EnvironmentalContext;
  triggeredPathways: TriggeredPathwayWithEvidence[];
  summary: ReasoningSummary;
}

export interface Conversation {
  id?: string;
  _id?: string;
  title?: string;
  metadata?: Record<string, unknown>;
  contextId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Message {
  id?: string;
  _id?: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  evidence?: Evidence[];
  createdAt?: string;
}

export interface FieldExtractionMetadata {
  field: string;
  value: unknown;
  source: 'rule_based' | 'gemini_assisted';
  confidence: number;
}

export interface ExtractionResult {
  extractedContext: Partial<EnvironmentalContext>;
  newFieldsFound: string[];
  fieldMetadata?: Record<string, FieldExtractionMetadata>;
  llmAttempted?: boolean;
  llmSuccess?: boolean;
}

export interface ChatResponse {
  conversationId: string;
  reply: string;
  messageId: string;
  userMessageId: string;
  extraction: ExtractionResult;
  context: EnvironmentalContext;
}

export interface AnalyzeInput {
  conversationId?: string;
  sourceIdentifier?: string;
  region?: string;
  soil?: {
    ph?: number;
    organicCarbon?: number;
    moisture?: number;
  };
  climate?: {
    temperature?: number;
    rainfall?: number | string;
  };
  landUse?: {
    type?: string;
    fragmentation?: number;
  };
  biodiversity?: {
    speciesRichness?: number;
    habitatDiversity?: number;
  };
  humanImpact?: {
    pollution?: number;
    deforestation?: number;
  };
}

export interface AnalyzeResponse {
  message: string;
  context: EnvironmentalContext;
  linkedConversationId: string | null;
}

export interface RecommendationsResponse {
  conversationId: string | null;
  recommendations: Recommendation[];
  summary: {
    pathwayCount: number;
    recommendationCount: number;
    insufficientEvidenceCount: number;
  };
}

export interface ApiErrorResponse {
  error: {
    message: string;
    code: string;
    details?: unknown;
  };
}

export interface HealthResponse {
  status: 'ok';
  timestamp?: string;
  uptime?: number;
}
