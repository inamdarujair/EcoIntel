import { Schema } from 'mongoose';
import { Evidence as IEvidence } from '../types';

export const EvidenceSchema = new Schema<IEvidence>(
  {
    sourceDocument: { type: String, required: true },
    pageNumber: { type: Number },
    chunkText: { type: String, required: true },
    score: { type: Number },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: true }
);
