import { EnvironmentalContext } from '../types';

export interface TriggerConditionDetail {
  field: string;
  value: unknown;
  operator: string;
  threshold: unknown;
  met: boolean;
}

export interface PathwayTriggerResult {
  triggered: boolean;
  variablesUsed: string[];
  triggerDetails: TriggerConditionDetail[];
}

export interface Pathway {
  id: string;
  name: string;
  variablesInvolved: string[];
  evaluateTrigger: (context: EnvironmentalContext) => PathwayTriggerResult;
  chain: string[];
  queryTemplate: (context: EnvironmentalContext) => string;
  thresholdDefinitions?: Record<string, unknown>;
  rationale?: string;
  priority?: number;
}

// ---------------------------------------------------------
// Engineering Trigger Thresholds
// ---------------------------------------------------------

export const LOW_SOC_THRESHOLD = 1.0; // < 1.0 %
export const LOW_RAINFALL_NUMERIC_THRESHOLD = 500; // < 500 mm/year
export const HIGH_TEMPERATURE_THRESHOLD = 30.0; // >= 30 °C
export const LOW_MOISTURE_THRESHOLD = 20.0; // <= 20 %
export const HIGH_FRAGMENTATION_THRESHOLD = 0.4; // >= 0.4 index
export const HIGH_POLLUTION_THRESHOLD = 0.3; // >= 0.3 index

const QUALITATIVE_LOW_RAINFALL = ['low', 'arid', 'scarce', 'dry', 'semi-arid'];
const QUALITATIVE_LOW_MOISTURE = ['low', 'dry', 'parched', 'scarce'];
const QUALITATIVE_HIGH_FRAGMENTATION = ['high', 'fragmented', 'severe', 'disconnected'];
const QUALITATIVE_HIGH_POLLUTION = ['high', 'moderate', 'severe', 'present'];

// Helper to check qualitative matches
function isQualitativeMatch(val: unknown, terms: string[]): boolean {
  if (typeof val === 'string') {
    const v = val.toLowerCase().trim();
    return terms.some((t) => v.includes(t));
  }
  return false;
}

// ---------------------------------------------------------
// Pathway Implementations
// ---------------------------------------------------------

export const soilOrganicCarbon_waterStress_pathway: Pathway = {
  id: 'soilOrganicCarbon_waterStress_pathway',
  name: 'Soil Organic Carbon and Water Stress Pathway',
  variablesInvolved: ['soil.organicCarbon', 'climate.rainfall', 'soil.moisture'],
  chain: [
    'Low soil organic carbon reduces soil water-holding capacity.',
    'Reduced water availability increases plant water stress.',
    'Plant stress can reduce habitat quality and ecological resilience.',
    'Reduced habitat quality can increase biodiversity pressure.',
  ],
  thresholdDefinitions: {
    LOW_SOC_THRESHOLD,
    LOW_RAINFALL_NUMERIC_THRESHOLD,
    QUALITATIVE_LOW_RAINFALL,
    LOW_MOISTURE_THRESHOLD,
  },
  queryTemplate: () => 'soil organic carbon water retention low rainfall soil moisture biodiversity habitat quality',
  evaluateTrigger: (context: EnvironmentalContext): PathwayTriggerResult => {
    const details: TriggerConditionDetail[] = [];
    const varsUsed: string[] = [];
    let triggered = false;

    // Condition 1: SOC is low
    const soc = context.soil?.organicCarbon;
    let socMet = false;
    if (typeof soc === 'number') {
      socMet = soc < LOW_SOC_THRESHOLD;
      details.push({
        field: 'soil.organicCarbon',
        value: soc,
        operator: '<',
        threshold: LOW_SOC_THRESHOLD,
        met: socMet,
      });
      if (socMet) varsUsed.push('soil.organicCarbon');
    }

    // Condition 2: Rainfall is low
    const rainfall = context.climate?.rainfall;
    let rainMet = false;
    if (typeof rainfall === 'number') {
      rainMet = rainfall < LOW_RAINFALL_NUMERIC_THRESHOLD;
      details.push({
        field: 'climate.rainfall',
        value: rainfall,
        operator: '<',
        threshold: LOW_RAINFALL_NUMERIC_THRESHOLD,
        met: rainMet,
      });
    } else if (typeof rainfall === 'string') {
      rainMet = isQualitativeMatch(rainfall, QUALITATIVE_LOW_RAINFALL);
      details.push({
        field: 'climate.rainfall',
        value: rainfall,
        operator: 'qualitative_match',
        threshold: QUALITATIVE_LOW_RAINFALL,
        met: rainMet,
      });
    }
    if (rainMet) varsUsed.push('climate.rainfall');

    if (socMet && rainMet) {
      triggered = true;
    }

    // Optional Strengthener: Low Moisture
    const moisture = context.soil?.moisture;
    if (triggered && typeof moisture === 'number' && moisture <= LOW_MOISTURE_THRESHOLD) {
      varsUsed.push('soil.moisture');
      details.push({
        field: 'soil.moisture',
        value: moisture,
        operator: '<=',
        threshold: LOW_MOISTURE_THRESHOLD,
        met: true,
      });
    }

    return { triggered, variablesUsed: triggered ? varsUsed : [], triggerDetails: details };
  },
};

export const climateStress_pathway: Pathway = {
  id: 'climateStress_pathway',
  name: 'Climate Stress Pathway',
  variablesInvolved: ['climate.temperature', 'climate.rainfall', 'soil.moisture'],
  chain: [
    'Elevated temperature increases climatic stress.',
    'Low rainfall or soil moisture reduces water availability.',
    'Combined heat and water stress can increase ecological stress.',
    'Water-sensitive species and habitats may face increased survival pressure.',
  ],
  queryTemplate: () => 'climate stress elevated temperature drought low rainfall soil moisture ecological resilience water sensitive species',
  evaluateTrigger: (context: EnvironmentalContext): PathwayTriggerResult => {
    const details: TriggerConditionDetail[] = [];
    const varsUsed: string[] = [];
    let triggered = false;

    // High Temp
    const temp = context.climate?.temperature;
    let tempMet = false;
    if (typeof temp === 'number') {
      tempMet = temp >= HIGH_TEMPERATURE_THRESHOLD;
      details.push({
        field: 'climate.temperature',
        value: temp,
        operator: '>=',
        threshold: HIGH_TEMPERATURE_THRESHOLD,
        met: tempMet,
      });
      if (tempMet) varsUsed.push('climate.temperature');
    }

    // Low Rainfall
    const rainfall = context.climate?.rainfall;
    let rainMet = false;
    if (typeof rainfall === 'number') {
      rainMet = rainfall < LOW_RAINFALL_NUMERIC_THRESHOLD;
      details.push({ field: 'climate.rainfall', value: rainfall, operator: '<', threshold: LOW_RAINFALL_NUMERIC_THRESHOLD, met: rainMet });
    } else if (typeof rainfall === 'string') {
      rainMet = isQualitativeMatch(rainfall, QUALITATIVE_LOW_RAINFALL);
      details.push({ field: 'climate.rainfall', value: rainfall, operator: 'qualitative_match', threshold: QUALITATIVE_LOW_RAINFALL, met: rainMet });
    }
    
    // Low Moisture
    const moisture = context.soil?.moisture;
    let moistMet = false;
    if (typeof moisture === 'number') {
      moistMet = moisture <= LOW_MOISTURE_THRESHOLD;
      details.push({ field: 'soil.moisture', value: moisture, operator: '<=', threshold: LOW_MOISTURE_THRESHOLD, met: moistMet });
    } else if (typeof moisture === 'string') {
      moistMet = isQualitativeMatch(moisture, QUALITATIVE_LOW_MOISTURE);
      details.push({ field: 'soil.moisture', value: moisture, operator: 'qualitative_match', threshold: QUALITATIVE_LOW_MOISTURE, met: moistMet });
    }

    if (tempMet && (rainMet || moistMet)) {
      triggered = true;
      if (rainMet) varsUsed.push('climate.rainfall');
      if (moistMet) varsUsed.push('soil.moisture');
    }

    // Remove duplicates from varsUsed if any
    const uniqueVars = Array.from(new Set(varsUsed));

    return { triggered, variablesUsed: triggered ? uniqueVars : [], triggerDetails: details };
  },
};

export const landUseFragmentation_pathway: Pathway = {
  id: 'landUseFragmentation_pathway',
  name: 'Land Use Fragmentation Pathway',
  variablesInvolved: ['landUse.type', 'landUse.fragmentation', 'biodiversity.speciesRichness', 'biodiversity.habitatDiversity'],
  chain: [
    'Land-use change can reduce or divide continuous habitat.',
    'Fragmented habitat increases edge effects and reduces connectivity.',
    'Reduced connectivity can restrict movement and gene flow.',
    'Fragmentation can increase biodiversity pressure.',
  ],
  queryTemplate: () => 'habitat fragmentation edge effects connectivity biodiversity species richness habitat diversity',
  evaluateTrigger: (context: EnvironmentalContext): PathwayTriggerResult => {
    const details: TriggerConditionDetail[] = [];
    const varsUsed: string[] = [];
    let triggered = false;

    // Check fragmentation explicitly
    const frag = context.landUse?.fragmentation ?? context.land?.habitatFragmentation;
    let fragMet = false;
    if (typeof frag === 'number') {
      fragMet = frag >= HIGH_FRAGMENTATION_THRESHOLD;
      details.push({ field: 'landUse.fragmentation', value: frag, operator: '>=', threshold: HIGH_FRAGMENTATION_THRESHOLD, met: fragMet });
    } else if (typeof frag === 'string') {
      fragMet = isQualitativeMatch(frag, QUALITATIVE_HIGH_FRAGMENTATION);
      details.push({ field: 'landUse.fragmentation', value: frag, operator: 'qualitative_match', threshold: QUALITATIVE_HIGH_FRAGMENTATION, met: fragMet });
    }
    
    // Also check landUse.type for qualitative fragmentation if frag is not defined
    if (!fragMet && typeof context.landUse?.type === 'string') {
      fragMet = isQualitativeMatch(context.landUse.type, QUALITATIVE_HIGH_FRAGMENTATION);
      if (fragMet) {
        details.push({ field: 'landUse.type', value: context.landUse.type, operator: 'qualitative_match', threshold: QUALITATIVE_HIGH_FRAGMENTATION, met: fragMet });
      }
    }

    if (fragMet) {
      triggered = true;
      if (frag !== undefined) varsUsed.push('landUse.fragmentation');
      else varsUsed.push('landUse.type'); // if triggered by type
    }

    // Strengtheners
    if (triggered) {
      if (context.biodiversity?.speciesRichness !== undefined) varsUsed.push('biodiversity.speciesRichness');
      if (context.biodiversity?.habitatDiversity !== undefined) varsUsed.push('biodiversity.habitatDiversity');
      if (context.landUse?.type !== undefined && !varsUsed.includes('landUse.type')) varsUsed.push('landUse.type');
    }

    return { triggered, variablesUsed: triggered ? varsUsed : [], triggerDetails: details };
  },
};

export const pollutionEcosystem_pathway: Pathway = {
  id: 'pollutionEcosystem_pathway',
  name: 'Pollution and Ecosystem Degradation Pathway',
  variablesInvolved: ['humanImpact.pollution', 'biodiversity.speciesRichness', 'biodiversity.habitatDiversity'],
  chain: [
    'Pollution can degrade environmental conditions.',
    'Degraded conditions can reduce habitat quality.',
    'Sensitive species may experience increased ecological pressure.',
    'Persistent pollution can contribute to biodiversity decline.',
  ],
  queryTemplate: () => 'pollution ecosystem effects habitat quality biodiversity species richness',
  evaluateTrigger: (context: EnvironmentalContext): PathwayTriggerResult => {
    const details: TriggerConditionDetail[] = [];
    const varsUsed: string[] = [];
    let triggered = false;

    const pollution = context.humanImpact?.pollution;
    let pollMet = false;
    
    if (typeof pollution === 'number') {
      pollMet = pollution >= HIGH_POLLUTION_THRESHOLD;
      details.push({ field: 'humanImpact.pollution', value: pollution, operator: '>=', threshold: HIGH_POLLUTION_THRESHOLD, met: pollMet });
    } else if (typeof pollution === 'string') {
      pollMet = isQualitativeMatch(pollution, QUALITATIVE_HIGH_POLLUTION);
      details.push({ field: 'humanImpact.pollution', value: pollution, operator: 'qualitative_match', threshold: QUALITATIVE_HIGH_POLLUTION, met: pollMet });
    }

    if (pollMet) {
      triggered = true;
      varsUsed.push('humanImpact.pollution');
      if (context.biodiversity?.speciesRichness !== undefined) varsUsed.push('biodiversity.speciesRichness');
      if (context.biodiversity?.habitatDiversity !== undefined) varsUsed.push('biodiversity.habitatDiversity');
    }

    return { triggered, variablesUsed: triggered ? varsUsed : [], triggerDetails: details };
  },
};

// ---------------------------------------------------------
// Central Registry
// ---------------------------------------------------------

export const PATHWAYS: Pathway[] = [
  soilOrganicCarbon_waterStress_pathway,
  climateStress_pathway,
  landUseFragmentation_pathway,
  pollutionEcosystem_pathway,
];

export function registerPathway(pathway: Pathway) {
  PATHWAYS.push(pathway);
}
