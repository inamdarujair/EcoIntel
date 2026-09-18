import mongoose, { Schema, Document } from 'mongoose';
import { Recommendation as IRecommendation } from '../types';
import { EvidenceSchema } from './Evidence';

export interface RecommendationDocument extends Document, Omit<IRecommendation, '_id'> {}

const RecommendationSchema = new Schema<RecommendationDocument>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      index: true,
    },
    contextId: {
      type: Schema.Types.ObjectId,
      ref: 'EnvironmentalContext',
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    whyItWorks: { type: String },
    impactedMetrics: [{ type: String }],
    timeHorizon: { type: String },
    confidenceScore: { type: Number, min: 0, max: 1 },
    evidence: {
      type: [EvidenceSchema],
      default: [],
    },
    reasoningPathway: { type: String },
    status: {
      type: String,
      enum: ['proposed', 'accepted', 'in_progress', 'completed', 'rejected'],
      default: 'proposed',
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

RecommendationSchema.index({ conversationId: 1, createdAt: -1 });

export const Recommendation = mongoose.model<RecommendationDocument>(
  'Recommendation',
  RecommendationSchema
);

export default Recommendation;
