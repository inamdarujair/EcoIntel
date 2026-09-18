import mongoose, { Schema, Document } from 'mongoose';
import { KnowledgeChunk as IKnowledgeChunk } from '../types';

export interface KnowledgeChunkDocument extends Document, Omit<IKnowledgeChunk, '_id'> {}

const KnowledgeChunkSchema = new Schema<KnowledgeChunkDocument>(
  {
    documentId: {
      type: Schema.Types.ObjectId,
      ref: 'KnowledgeDocument',
      required: true,
    },
    chunkIndex: { type: Number, required: true },
    text: { type: String, required: true },
    embedding: {
      type: [Number],
      default: [],
    },
    embeddingModel: { type: String, trim: true },
    embeddingProvider: { type: String, trim: true },
    embeddingDimension: { type: Number },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

KnowledgeChunkSchema.index({ documentId: 1, chunkIndex: 1 });
KnowledgeChunkSchema.index({ embeddingModel: 1, embeddingDimension: 1 });
KnowledgeChunkSchema.index({ 'metadata.environmentalVariables': 1 });

export const KnowledgeChunk = mongoose.model<KnowledgeChunkDocument>(
  'KnowledgeChunk',
  KnowledgeChunkSchema
);

export default KnowledgeChunk;
