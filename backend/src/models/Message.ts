import mongoose, { Schema, Document } from 'mongoose';
import { Message as IMessage } from '../types';
import { EvidenceSchema } from './Evidence';

export interface MessageDocument extends Document, Omit<IMessage, '_id'> {}

const MessageSchema = new Schema<MessageDocument>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
    },
    role: {
      type: String,
      enum: ['user', 'assistant', 'system'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    evidence: {
      type: [EvidenceSchema],
      default: [],
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

MessageSchema.index({ conversationId: 1, createdAt: 1 });

export const Message = mongoose.model<MessageDocument>('Message', MessageSchema);

export default Message;
