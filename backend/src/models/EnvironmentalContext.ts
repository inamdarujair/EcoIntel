import mongoose, { Schema, Document } from 'mongoose';
import { EnvironmentalContext as IEnvironmentalContext } from '../types';

export interface EnvironmentalContextDocument extends Document, Omit<IEnvironmentalContext, '_id'> {}

const EnvironmentalContextSchema = new Schema<EnvironmentalContextDocument>(
  {
    region: { type: String, trim: true },
    geo: {
      lat: { type: Number },
      lng: { type: Number },
    },
    latitude: { type: Number },
    longitude: { type: Number },

    soil: {
      ph: { type: Number },
      organicCarbon: { type: Number },
      moisture: { type: Number },
    },

    climate: {
      temperature: { type: Number },
      rainfall: { type: Schema.Types.Mixed },
    },

    landUse: {
      type: { type: String, trim: true },
      fragmentation: { type: Number },
    },

    land: {
      landUse: { type: String, trim: true },
      landCover: { type: String, trim: true },
      habitatFragmentation: { type: Number },
    },

    biodiversity: {
      speciesRichness: { type: Number },
      habitatDiversity: { type: Number },
    },

    humanImpact: {
      pollution: { type: Number },
      deforestation: { type: Number },
    },

    missingFields: {
      type: [String],
      default: [],
    },

    fieldSources: {
      type: Schema.Types.Mixed,
      default: {},
    },

    rawInput: { type: String, trim: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
  }
);

EnvironmentalContextSchema.index({ region: 1 });
EnvironmentalContextSchema.index({ createdAt: -1 });

export const EnvironmentalContext = mongoose.model<EnvironmentalContextDocument>(
  'EnvironmentalContext',
  EnvironmentalContextSchema
);

export default EnvironmentalContext;
