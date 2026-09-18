import { Types } from 'mongoose';

/**
 * Biodiversity and Environmental Intelligence Domain Types for EcoIntel
 * Challenge: Darukaa.Earth
 */

export interface SoilContext {
  ph?: number;
  pH?: number; // Aliased for backward compatibility
  organicCarbon?: number; // % or g/kg
  moisture?: number; // %
}

export interface ClimateContext {
  temperature?: number; // °C
  rainfall?: number | string; // mm/year or descriptive "low" / "medium" / "high"
}

export interface LandUseContext {
  type?: string;
  fragmentation?: number; // 0.0 - 1.0 index
}

// Kept for backward compatibility
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
  speciesRichness?: number; // species count
  habitatDiversity?: number; // index or score
}

export interface HumanImpactContext {
  pollution?: number; // 0.0 - 1.0 index
  deforestation?: number; // 0.0 - 1.0 index or %
}

export interface EnvironmentalContext {
  _id?: Types.ObjectId | string;
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
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface Evidence {
  _id?: Types.ObjectId | string;
  sourceDocument: string;
  pageNumber?: number;
  chunkText: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

export interface Recommendation {
  _id?: Types.ObjectId | string;
  conversationId?: Types.ObjectId | string;
  contextId?: Types.ObjectId | string;
  title: string;
  description: string;
  whyItWorks?: string;
  impactedMetrics?: string[];
  timeHorizon?: string;
  confidenceScore?: number;
  evidence?: Evidence[];
  reasoningPathway?: string;
  status?: 'proposed' | 'accepted' | 'in_progress' | 'completed' | 'rejected';
  metadata?: Record<string, unknown>;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface Conversation {
  _id?: Types.ObjectId | string;
  title?: string;
  metadata?: Record<string, unknown>;
  contextId?: Types.ObjectId | string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface Message {
  _id?: Types.ObjectId | string;
  conversationId: Types.ObjectId | string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  evidence?: Evidence[];
  createdAt?: Date | string;
}

export interface KnowledgeDocument {
  _id?: Types.ObjectId | string;
  title: string;
  sourceUrl?: string;
  fileType?: string;
  metadata?: {
    organization?: string;
    author?: string;
    year?: number;
    topics?: string[];
    variables?: string[];
    documentType?: string;
    [key: string]: unknown;
  };
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface KnowledgeChunk {
  _id?: Types.ObjectId | string;
  documentId: Types.ObjectId | string;
  chunkIndex: number;
  text: string;
  embedding: number[];
  embeddingModel?: string;
  embeddingProvider?: string;
  embeddingDimension?: number;
  metadata?: {
    topics?: string[];
    environmentalVariables?: string[];
    source?: string;
    [key: string]: unknown;
  };
  createdAt?: Date | string;
  updatedAt?: Date | string;
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
