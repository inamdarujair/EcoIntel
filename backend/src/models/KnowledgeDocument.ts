import mongoose, { Schema, Document } from 'mongoose';
import { KnowledgeDocument as IKnowledgeDocument } from '../types';

export interface KnowledgeDocumentDocument extends Document, Omit<IKnowledgeDocument, '_id'> {}

const KnowledgeDocumentSchema = new Schema<KnowledgeDocumentDocument>(
  {
    title: { type: String, required: true, trim: true },
    sourceUrl: { type: String, trim: true },
    fileType: { type: String, trim: true },
    metadata: {
      organization: { type: String },
      author: { type: String },
      year: { type: Number },
      topics: [{ type: String }],
      variables: [{ type: String }],
      documentType: { type: String },
    },
  },
  {
    timestamps: true,
  }
);

KnowledgeDocumentSchema.index({ 'metadata.topics': 1 });
KnowledgeDocumentSchema.index({ 'metadata.variables': 1 });

export const KnowledgeDocument = mongoose.model<KnowledgeDocumentDocument>(
  'KnowledgeDocument',
  KnowledgeDocumentSchema
);

export default KnowledgeDocument;
