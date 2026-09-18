import mongoose, { Schema, Document } from 'mongoose';
import { Conversation as IConversation } from '../types';

export interface ConversationDocument extends Document, Omit<IConversation, '_id'> {}

const ConversationSchema = new Schema<ConversationDocument>(
  {
    title: { type: String, trim: true, default: 'New Conversation' },
    metadata: { type: Schema.Types.Mixed, default: {} },
    contextId: { type: Schema.Types.ObjectId, ref: 'EnvironmentalContext' },
  },
  {
    timestamps: true,
  }
);

ConversationSchema.index({ updatedAt: -1 });

export const Conversation = mongoose.model<ConversationDocument>(
  'Conversation',
  ConversationSchema
);

export default Conversation;
