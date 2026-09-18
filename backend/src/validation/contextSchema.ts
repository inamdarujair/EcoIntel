import { z } from 'zod';

export const soilValidationSchema = z
  .object({
    ph: z
      .number({ message: 'pH must be a number' })
      .min(0, 'pH must be between 0 and 14')
      .max(14, 'pH must be between 0 and 14')
      .optional(),
    pH: z
      .number({ message: 'pH must be a number' })
      .min(0, 'pH must be between 0 and 14')
      .max(14, 'pH must be between 0 and 14')
      .optional(),
    organicCarbon: z
      .number({ message: 'organicCarbon must be a number' })
      .min(0, 'organicCarbon must be non-negative')
      .optional(),
    moisture: z
      .number({ message: 'moisture must be a number' })
      .min(0, 'moisture must be between 0 and 100%')
      .max(100, 'moisture must be between 0 and 100%')
      .optional(),
  })
  .optional();

export const climateValidationSchema = z
  .object({
    temperature: z.number({ message: 'temperature must be a number' }).optional(),
    rainfall: z
      .union([
        z.number({ message: 'rainfall must be a positive number' }).min(0, 'rainfall must be non-negative'),
        z.string().trim().min(1, 'rainfall description cannot be empty'),
      ])
      .optional(),
  })
  .optional();

export const landUseValidationSchema = z
  .object({
    type: z.string().trim().optional(),
    fragmentation: z
      .number({ message: 'fragmentation must be a number' })
      .min(0, 'fragmentation index must be between 0 and 1')
      .max(1, 'fragmentation index must be between 0 and 1')
      .optional(),
  })
  .optional();

export const landValidationSchema = z
  .object({
    landUse: z.string().trim().optional(),
    landCover: z.string().trim().optional(),
    habitatFragmentation: z
      .number({ message: 'habitatFragmentation must be a number' })
      .min(0, 'habitatFragmentation must be between 0 and 1')
      .max(1, 'habitatFragmentation must be between 0 and 1')
      .optional(),
  })
  .optional();

export const biodiversityValidationSchema = z
  .object({
    speciesRichness: z
      .number({ message: 'speciesRichness must be a number' })
      .min(0, 'speciesRichness must be non-negative')
      .optional(),
    habitatDiversity: z
      .number({ message: 'habitatDiversity must be a number' })
      .min(0, 'habitatDiversity must be non-negative')
      .optional(),
  })
  .optional();

export const humanImpactValidationSchema = z
  .object({
    pollution: z
      .number({ message: 'pollution must be a number' })
      .min(0, 'pollution index must be between 0 and 1')
      .max(1, 'pollution index must be between 0 and 1')
      .optional(),
    deforestation: z
      .number({ message: 'deforestation must be a number' })
      .min(0, 'deforestation must be non-negative')
      .optional(),
  })
  .optional();

export const geoValidationSchema = z
  .object({
    lat: z
      .number({ message: 'latitude must be a number' })
      .min(-90, 'latitude must be between -90 and 90')
      .max(90, 'latitude must be between -90 and 90')
      .optional(),
    lng: z
      .number({ message: 'longitude must be a number' })
      .min(-180, 'longitude must be between -180 and 180')
      .max(180, 'longitude must be between -180 and 180')
      .optional(),
  })
  .optional();

export const analyzeInputSchema = z.object({
  region: z.string().trim().optional(),
  geo: geoValidationSchema,
  latitude: z
    .number()
    .min(-90, 'latitude must be between -90 and 90')
    .max(90, 'latitude must be between -90 and 90')
    .optional(),
  longitude: z
    .number()
    .min(-180, 'longitude must be between -180 and 180')
    .max(180, 'longitude must be between -180 and 180')
    .optional(),

  soil: soilValidationSchema,
  climate: climateValidationSchema,
  landUse: landUseValidationSchema,
  land: landValidationSchema,
  biodiversity: biodiversityValidationSchema,
  humanImpact: humanImpactValidationSchema,

  rawInput: z.string().trim().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  conversationId: z.string().trim().optional(),
  sourceIdentifier: z.string().trim().optional(),
});

export type AnalyzeInput = z.infer<typeof analyzeInputSchema>;
