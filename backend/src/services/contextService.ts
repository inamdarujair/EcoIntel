import { EnvironmentalContext } from '../types';

export const CANONICAL_ENVIRONMENTAL_FIELDS: readonly string[] = [
  'soil.ph',
  'soil.organicCarbon',
  'soil.moisture',
  'climate.temperature',
  'climate.rainfall',
  'landUse.type',
  'landUse.fragmentation',
  'biodiversity.speciesRichness',
  'biodiversity.habitatDiversity',
  'humanImpact.pollution',
  'humanImpact.deforestation',
  'region',
] as const;

function isPresent(val: unknown): boolean {
  if (val === undefined || val === null) {
    return false;
  }
  if (typeof val === 'number' && isNaN(val)) {
    return false;
  }
  if (typeof val === 'string' && val.trim() === '') {
    return false;
  }
  return true;
}

/**
 * Computes which core environmental fields are still missing from the context.
 */
export function computeMissingFields(context: Partial<EnvironmentalContext>): string[] {
  const missing: string[] = [];

  const checkField = (fieldPath: string, value: unknown) => {
    if (!isPresent(value)) {
      missing.push(fieldPath);
    }
  };

  // Soil
  const phVal = context.soil?.ph ?? context.soil?.pH;
  checkField('soil.ph', phVal);
  checkField('soil.organicCarbon', context.soil?.organicCarbon);
  checkField('soil.moisture', context.soil?.moisture);

  // Climate
  checkField('climate.temperature', context.climate?.temperature);
  checkField('climate.rainfall', context.climate?.rainfall);

  // Land Use
  const landType = context.landUse?.type ?? context.land?.landUse;
  checkField('landUse.type', landType);
  const landFrag = context.landUse?.fragmentation ?? context.land?.habitatFragmentation;
  checkField('landUse.fragmentation', landFrag);

  // Biodiversity
  checkField('biodiversity.speciesRichness', context.biodiversity?.speciesRichness);
  checkField('biodiversity.habitatDiversity', context.biodiversity?.habitatDiversity);

  // Human Impact
  checkField('humanImpact.pollution', context.humanImpact?.pollution);
  checkField('humanImpact.deforestation', context.humanImpact?.deforestation);

  // Region
  checkField('region', context.region);

  return missing;
}

/**
 * Pure merge function: merges incoming partial data into existing context.
 * - Never overwrites an existing known value with null or undefined.
 * - Records provenance of each incoming field in fieldSources.
 * - Recomputes missingFields[].
 */
export function mergeContext(
  existing: Partial<EnvironmentalContext> = {},
  incoming: Partial<EnvironmentalContext> = {},
  sourceIdentifier = 'direct_input'
): Partial<EnvironmentalContext> {
  // Deep clone existing to ensure purity
  const merged: Partial<EnvironmentalContext> = JSON.parse(JSON.stringify(existing));

  const fieldSources: Record<string, string> = {
    ...(merged.fieldSources || {}),
  };

  const recordSource = (path: string) => {
    fieldSources[path] = sourceIdentifier;
  };

  // Helper to merge nested objects safely
  const mergeSubObject = <T extends Record<string, unknown>>(
    targetSub: T | undefined,
    incomingSub: T | undefined,
    parentPath: string
  ): T | undefined => {
    if (!incomingSub) return targetSub ? { ...targetSub } : undefined;
    const result: Record<string, unknown> = targetSub ? { ...targetSub } : {};

    for (const [key, value] of Object.entries(incomingSub)) {
      if (isPresent(value)) {
        result[key] = value;
        recordSource(`${parentPath}.${key}`);
      }
    }

    return Object.keys(result).length > 0 ? (result as T) : undefined;
  };

  // Pre-merge canonical normalization of existing soil
  if (merged.soil) {
    const existingPh = (merged.soil as any).ph ?? (merged.soil as any).pH ?? (merged.soil as any).soil_pH;
    if (existingPh !== undefined && existingPh !== null) {
      merged.soil.ph = existingPh;
    }
    delete (merged.soil as any).pH;
    delete (merged.soil as any).soil_pH;
  }
  if (fieldSources['soil.pH']) {
    delete fieldSources['soil.pH'];
  }

  // Deep clone and canonically normalize incoming object
  const cleanIncoming: Partial<EnvironmentalContext> = JSON.parse(JSON.stringify(incoming));
  if (cleanIncoming.soil) {
    const incPh = cleanIncoming.soil.ph ?? (cleanIncoming.soil as any).pH ?? (cleanIncoming.soil as any).soil_pH;
    if (incPh !== undefined && incPh !== null) {
      cleanIncoming.soil.ph = incPh;
    }
    delete (cleanIncoming.soil as any).pH;
    delete (cleanIncoming.soil as any).soil_pH;
  }

  // Merge Soil
  if (cleanIncoming.soil) {
    merged.soil = mergeSubObject(merged.soil as Record<string, unknown>, cleanIncoming.soil as Record<string, unknown>, 'soil');
    if (cleanIncoming.soil.ph !== undefined && cleanIncoming.soil.ph !== null) {
      merged.soil = merged.soil || {};
      merged.soil.ph = cleanIncoming.soil.ph;
      recordSource('soil.ph');
    }
  }

  // Enforce canonical soil schema: strictly remove any non-canonical pH alias
  if (merged.soil) {
    delete (merged.soil as any).pH;
    delete (merged.soil as any).soil_pH;
  }
  if (fieldSources['soil.pH']) {
    delete fieldSources['soil.pH'];
  }

  // Merge Climate
  if (cleanIncoming.climate) {
    merged.climate = mergeSubObject(
      merged.climate as Record<string, unknown>,
      cleanIncoming.climate as Record<string, unknown>,
      'climate'
    );
  }

  // Merge LandUse
  if (cleanIncoming.landUse) {
    merged.landUse = mergeSubObject(
      merged.landUse as Record<string, unknown>,
      cleanIncoming.landUse as Record<string, unknown>,
      'landUse'
    );
  }

  // Backward compatibility: Merge Land
  if (cleanIncoming.land) {
    merged.land = mergeSubObject(
      merged.land as Record<string, unknown>,
      cleanIncoming.land as Record<string, unknown>,
      'land'
    );
    // Bridge to landUse if not explicitly provided
    if (cleanIncoming.land.landUse && !cleanIncoming.landUse?.type) {
      merged.landUse = merged.landUse || {};
      merged.landUse.type = cleanIncoming.land.landUse;
      recordSource('landUse.type');
    }
    if (cleanIncoming.land.habitatFragmentation !== undefined && cleanIncoming.landUse?.fragmentation === undefined) {
      merged.landUse = merged.landUse || {};
      merged.landUse.fragmentation = cleanIncoming.land.habitatFragmentation;
      recordSource('landUse.fragmentation');
    }
  }

  // Merge Biodiversity
  if (cleanIncoming.biodiversity) {
    merged.biodiversity = mergeSubObject(
      merged.biodiversity as Record<string, unknown>,
      cleanIncoming.biodiversity as Record<string, unknown>,
      'biodiversity'
    );
  }

  // Merge HumanImpact
  if (cleanIncoming.humanImpact) {
    merged.humanImpact = mergeSubObject(
      merged.humanImpact as Record<string, unknown>,
      cleanIncoming.humanImpact as Record<string, unknown>,
      'humanImpact'
    );
  }

  // Merge Geo & Coordinates
  if (cleanIncoming.geo) {
    merged.geo = mergeSubObject(
      merged.geo as Record<string, unknown>,
      cleanIncoming.geo as Record<string, unknown>,
      'geo'
    );
    if (cleanIncoming.geo.lat !== undefined) merged.latitude = cleanIncoming.geo.lat;
    if (cleanIncoming.geo.lng !== undefined) merged.longitude = cleanIncoming.geo.lng;
  }
  if (cleanIncoming.latitude !== undefined && isPresent(cleanIncoming.latitude)) {
    merged.latitude = cleanIncoming.latitude;
    merged.geo = merged.geo || {};
    merged.geo.lat = cleanIncoming.latitude;
    recordSource('geo.lat');
  }
  if (cleanIncoming.longitude !== undefined && isPresent(cleanIncoming.longitude)) {
    merged.longitude = cleanIncoming.longitude;
    merged.geo = merged.geo || {};
    merged.geo.lng = cleanIncoming.longitude;
    recordSource('geo.lng');
  }

  // Merge Region
  if (isPresent(cleanIncoming.region)) {
    merged.region = cleanIncoming.region;
    recordSource('region');
  }

  // Merge rawInput
  if (isPresent(cleanIncoming.rawInput)) {
    merged.rawInput = cleanIncoming.rawInput;
    recordSource('rawInput');
  }

  // Merge metadata
  if (cleanIncoming.metadata) {
    merged.metadata = {
      ...(merged.metadata || {}),
      ...cleanIncoming.metadata,
    };
  }

  merged.fieldSources = fieldSources;
  merged.missingFields = computeMissingFields(merged);
  merged.updatedAt = new Date();

  return merged;
}
