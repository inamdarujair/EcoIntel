import { GoogleGenAI } from '@google/genai';
import config from '../config/env';
import { EnvironmentalContext } from '../types';
import {
  soilValidationSchema,
  climateValidationSchema,
  landUseValidationSchema,
  biodiversityValidationSchema,
  humanImpactValidationSchema,
} from '../validation/contextSchema';

export type ExtractionSource = 'rule_based' | 'gemini_nl' | 'hybrid';

export interface ExtractedFieldMetadata {
  field: string;
  value: unknown;
  source: ExtractionSource;
  confidence: number;
}

export interface ExtractionResult {
  extractedContext: Partial<EnvironmentalContext>;
  newFieldsFound: string[];
  fieldMetadata: Record<string, ExtractedFieldMetadata>;
  llmAttempted: boolean;
  llmSuccess: boolean;
}

/**
 * Normalizes field comparison for new-field detection.
 */
function isValueChanged(existingVal: unknown, newVal: unknown): boolean {
  if (newVal === undefined || newVal === null) {
    return false;
  }
  if (existingVal === undefined || existingVal === null) {
    return true;
  }
  if (typeof existingVal === 'number' && typeof newVal === 'number') {
    return Math.abs(existingVal - newVal) > 0.0001;
  }
  if (typeof existingVal === 'string' && typeof newVal === 'string') {
    return existingVal.trim().toLowerCase() !== newVal.trim().toLowerCase();
  }
  return existingVal !== newVal;
}

/**
 * 1. Rule-Based Regex Extraction
 * Extracts canonical environmental variables from user text with strict boundary and range validation.
 */
export function extractFromRules(message: string): Partial<EnvironmentalContext> {
  if (!message || typeof message !== 'string' || message.trim() === '') {
    return {};
  }

  const text = message.trim();
  const extracted: Partial<EnvironmentalContext> = {};

  // --- Soil: pH ---
  // Matches: "soil pH is 6.5", "pH 6.2", "soil pH: 5.8", "pH of 7.1"
  const phRegex = /(?:(?:soil\s*)?(?:pH|ph)\s*(?:is|of|:|=)?\s*([0-9]+(?:\.[0-9]+)?))/i;
  const phMatch = text.match(phRegex);
  if (phMatch && phMatch[1]) {
    const val = parseFloat(phMatch[1]);
    const validation = soilValidationSchema.safeParse({ ph: val });
    if (validation.success && validation.data?.ph !== undefined) {
      extracted.soil = extracted.soil || {};
      extracted.soil.ph = val;
    }
  }

  // --- Soil: Organic Carbon (SOC / SOM) ---
  // Matches: "0.3% organic carbon", "soil organic carbon is 0.3%", "SOC of our land is 1.2%", "SOC is 0.5"
  const socRegex1 = /([0-9]+(?:\.[0-9]+)?)\s*%\s*(?:soil\s*)?(?:organic\s*carbon|soc|som)\b/i;
  const socRegex2 = /(?:soil\s*)?(?:organic\s*carbon|soc|som)\b[^0-9\n\r]{0,35}?(?:is|of|:|=)?\s*([0-9]+(?:\.[0-9]+)?)\s*%/i;
  const socRegex3 = /(?:soil\s*)?(?:organic\s*carbon|soc|som)\s*(?:is|of|:|=)?\s*([0-9]+(?:\.[0-9]+)?)\b/i;
  const socMatch = text.match(socRegex1) || text.match(socRegex2) || text.match(socRegex3);
  if (socMatch && socMatch[1]) {
    const val = parseFloat(socMatch[1]);
    const validation = soilValidationSchema.safeParse({ organicCarbon: val });
    if (validation.success && validation.data?.organicCarbon !== undefined) {
      extracted.soil = extracted.soil || {};
      extracted.soil.organicCarbon = val;
    }
  }

  // --- Soil: Moisture ---
  // Matches: "soil moisture is 20%", "20% soil moisture", "moisture is 25%"
  const moistureRegex1 = /([0-9]+(?:\.[0-9]+)?)\s*%\s*(?:soil\s*)?moisture\b/i;
  const moistureRegex2 = /(?:soil\s*)?moisture\s*(?:is|of|:|=)?\s*([0-9]+(?:\.[0-9]+)?)\s*%/i;
  const moistureRegex3 = /(?:soil\s*)?moisture\s*(?:is|of|:|=)\s*([0-9]+(?:\.[0-9]+)?)\b/i;
  const moistureMatch = text.match(moistureRegex1) || text.match(moistureRegex2) || text.match(moistureRegex3);
  if (moistureMatch && moistureMatch[1]) {
    const val = parseFloat(moistureMatch[1]);
    const validation = soilValidationSchema.safeParse({ moisture: val });
    if (validation.success && validation.data?.moisture !== undefined) {
      extracted.soil = extracted.soil || {};
      extracted.soil.moisture = val;
    }
  }

  // --- Climate: Temperature ---
  // Matches: "temperature is 32°C", "32°C", "temperature is 24", "mean temperature of 18 C"
  const tempRegex1 = /([+-]?[0-9]+(?:\.[0-9]+)?)\s*(?:°C|deg\s*C|degrees\s*C|celsius)\b/i;
  const tempRegex2 = /(?:mean|average|ambient|air)?\s*temperature\s*(?:is|of|:|=)?\s*([+-]?[0-9]+(?:\.[0-9]+)?)\b/i;
  const tempMatch = text.match(tempRegex1) || text.match(tempRegex2);
  if (tempMatch && tempMatch[1]) {
    const val = parseFloat(tempMatch[1]);
    const validation = climateValidationSchema.safeParse({ temperature: val });
    if (validation.success && validation.data?.temperature !== undefined) {
      extracted.climate = extracted.climate || {};
      extracted.climate.temperature = val;
    }
  }

  // --- Climate: Rainfall ---
  // 1. Numeric rainfall: "Annual rainfall is 450 mm", "450 mm rainfall", "precipitation is 600 mm"
  const rainNumericRegex1 = /([0-9]+(?:\.[0-9]+)?)\s*(?:mm|millimeters)\s*(?:of\s*)?(?:annual\s*|yearly\s*)?(?:rainfall|precipitation)\b/i;
  const rainNumericRegex2 = /(?:annual\s*|yearly\s*)?(?:rainfall|precipitation)\s*(?:is|of|:|=)?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:mm|millimeters)\b/i;
  const rainNumericRegex3 = /(?:annual\s*|yearly\s*)?(?:rainfall|precipitation)\s*(?:is|of|:|=)\s*([0-9]+(?:\.[0-9]+)?)\b/i;
  const rainNumMatch = text.match(rainNumericRegex1) || text.match(rainNumericRegex2) || text.match(rainNumericRegex3);

  if (rainNumMatch && rainNumMatch[1]) {
    const val = parseFloat(rainNumMatch[1]);
    const validation = climateValidationSchema.safeParse({ rainfall: val });
    if (validation.success && validation.data?.rainfall !== undefined) {
      extracted.climate = extracted.climate || {};
      extracted.climate.rainfall = val;
    }
  } else {
    // 2. Qualitative descriptor: "rainfall has been low", "low rainfall", "rainfall is high", "drought conditions"
    const rainDescRegex1 = /(?:annual\s*|yearly\s*)?(?:rainfall|precipitation)\s*(?:has\s*been|is|was|levels\s*are)?\s*(very\s*low|very\s*high|low|high|moderate|sparse|abundant|seasonal|drought|normal)\b/i;
    const rainDescRegex2 = /\b(very\s*low|very\s*high|low|high|moderate|seasonal|sparse|abundant)\s+(?:rainfall|precipitation)\b/i;
    const rainDescMatch = text.match(rainDescRegex1) || text.match(rainDescRegex2);
    if (rainDescMatch && rainDescMatch[1]) {
      const desc = rainDescMatch[1].trim().toLowerCase();
      const validation = climateValidationSchema.safeParse({ rainfall: desc });
      if (validation.success && validation.data?.rainfall !== undefined) {
        extracted.climate = extracted.climate || {};
        extracted.climate.rainfall = desc;
      }
    }
  }

  // --- Land Use: Type ---
  // Matches: "my farm uses agroforestry", "land use is cropland", "practices intercropping"
  const landTypeRegex = /(?:farm|land|system|practice|field)?\s*(?:uses|is|practices|has)?\s*\b(agroforestry|intercropping|cropland|pasture|silvopasture|monoculture|conservation\s*agriculture|primary\s*forest|grassland|wetland|shrubland)\b/i;
  const landTypeMatch = text.match(landTypeRegex);
  if (landTypeMatch && landTypeMatch[1]) {
    const type = landTypeMatch[1].trim().toLowerCase();
    const validation = landUseValidationSchema.safeParse({ type });
    if (validation.success && validation.data?.type !== undefined) {
      extracted.landUse = extracted.landUse || {};
      extracted.landUse.type = type;
    }
  }

  // --- Land Use: Fragmentation ---
  // Matches: "fragmentation is 0.4", "fragmentation index 0.35", "the habitat is fragmented"
  const fragNumRegex = /(?:habitat\s*)?fragmentation\s*(?:index|rate|level)?\s*(?:is|of|:|=)?\s*([0-9]+(?:\.[0-9]+)?)\b/i;
  const fragNumMatch = text.match(fragNumRegex);
  if (fragNumMatch && fragNumMatch[1]) {
    const val = parseFloat(fragNumMatch[1]);
    const validation = landUseValidationSchema.safeParse({ fragmentation: val });
    if (validation.success && validation.data?.fragmentation !== undefined) {
      extracted.landUse = extracted.landUse || {};
      extracted.landUse.fragmentation = val;
    }
  } else {
    const fragDescRegex = /(?:habitat\s*is|landscape\s*is)\s*(severely\s*fragmented|fragmented|connected|intact)\b/i;
    const fragDescMatch = text.match(fragDescRegex);
    if (fragDescMatch && fragDescMatch[1]) {
      const desc = fragDescMatch[1].toLowerCase();
      const val = desc.includes('severely') ? 0.75 : desc.includes('fragmented') ? 0.5 : 0.1;
      extracted.landUse = extracted.landUse || {};
      extracted.landUse.fragmentation = val;
    }
  }

  // --- Biodiversity: Species Richness ---
  // Matches: "species richness is 42", "42 species", "richness of 30 species"
  const speciesRegex1 = /(?:species\s*richness|number\s*of\s*species)\s*(?:is|of|:|=)?\s*([0-9]+)\b/i;
  const speciesRegex2 = /([0-9]+)\s*(?:different\s*|native\s*|plant\s*and\s*animal\s*)?species\b/i;
  const speciesMatch = text.match(speciesRegex1) || text.match(speciesRegex2);
  if (speciesMatch && speciesMatch[1]) {
    const val = parseInt(speciesMatch[1], 10);
    const validation = biodiversityValidationSchema.safeParse({ speciesRichness: val });
    if (validation.success && validation.data?.speciesRichness !== undefined) {
      extracted.biodiversity = extracted.biodiversity || {};
      extracted.biodiversity.speciesRichness = val;
    }
  }

  // --- Biodiversity: Habitat Diversity ---
  // Matches: "habitat diversity of 0.75", "habitat diversity index is 0.8"
  const habDivRegex = /(?:habitat\s*diversity|structural\s*diversity)\s*(?:index)?\s*(?:is|of|:|=)?\s*([0-9]+(?:\.[0-9]+)?)\b/i;
  const habDivMatch = text.match(habDivRegex);
  if (habDivMatch && habDivMatch[1]) {
    const val = parseFloat(habDivMatch[1]);
    const validation = biodiversityValidationSchema.safeParse({ habitatDiversity: val });
    if (validation.success && validation.data?.habitatDiversity !== undefined) {
      extracted.biodiversity = extracted.biodiversity || {};
      extracted.biodiversity.habitatDiversity = val;
    }
  }

  // --- Human Impact: Pollution ---
  // Matches: "pollution index 0.2", "pollution level is 0.15"
  const pollRegex = /pollution\s*(?:index|level|rate)?\s*(?:is|of|:|=)?\s*([0-9]+(?:\.[0-9]+)?)\b/i;
  const pollMatch = text.match(pollRegex);
  if (pollMatch && pollMatch[1]) {
    const val = parseFloat(pollMatch[1]);
    const validation = humanImpactValidationSchema.safeParse({ pollution: val });
    if (validation.success && validation.data?.pollution !== undefined) {
      extracted.humanImpact = extracted.humanImpact || {};
      extracted.humanImpact.pollution = val;
    }
  }

  // --- Human Impact: Deforestation ---
  // Matches: "deforestation rate 0.05", "deforestation is 0.12"
  const deforestRegex = /deforestation\s*(?:rate|index|level)?\s*(?:is|of|:|=)?\s*([0-9]+(?:\.[0-9]+)?)\b/i;
  const deforestMatch = text.match(deforestRegex);
  if (deforestMatch && deforestMatch[1]) {
    const val = parseFloat(deforestMatch[1]);
    const validation = humanImpactValidationSchema.safeParse({ deforestation: val });
    if (validation.success && validation.data?.deforestation !== undefined) {
      extracted.humanImpact = extracted.humanImpact || {};
      extracted.humanImpact.deforestation = val;
    }
  }

  // --- Region ---
  // Matches: "My region is East African Savannah", "region: Mediterranean Basin", "located in Kenya Drylands"
  const regionRegex1 = /(?:my|the|our)?\s*region\s*(?:is|:|=)\s*([A-Za-z0-9\s\-]+?)(?=[.,;\n]|$)/i;
  const regionRegex2 = /(?:located\s*in|in)\s+([A-Z][a-zA-Z\s\-]+(?:Savannah|Savanna|Drylands|Basin|Valley|Plateau|Delta|Forest|Hills|Plains|Ecosystem))\b/;
  const regionMatch = text.match(regionRegex1) || text.match(regionRegex2);
  if (regionMatch && regionMatch[1]) {
    const reg = regionMatch[1].trim();
    if (reg.length >= 3 && !/^(a|an|the|this|my|our)$/i.test(reg)) {
      extracted.region = reg;
    }
  }

  return extracted;
}

/**
 * 2. Gemini-assisted Semantic Extraction
 * Safely requests structured JSON from Gemini to extract environmental variables that
 * rules might miss. Gracefully fails without throwing errors if the API key is missing or invalid.
 */
export async function extractFromGemini(
  message: string,
  existingContext?: Partial<EnvironmentalContext>
): Promise<{ extracted: Partial<EnvironmentalContext>; success: boolean }> {
  // If API key is not configured or placeholder, skip smoothly
  if (
    !config.geminiApiKey ||
    config.geminiApiKey === 'placeholder_gemini_api_key_phase0' ||
    config.geminiApiKey.trim() === ''
  ) {
    return { extracted: {}, success: false };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

    const prompt = `You are a precision environmental data extraction engine for EcoIntel.
Extract ONLY explicit or clear natural language environmental variables from the user message into strict JSON.

Rules:
1. Do NOT invent or assume values. If a field is not explicitly mentioned, return null.
2. Canonical fields only:
   - soil: ph (number 0-14), organicCarbon (number >= 0), moisture (number 0-100)
   - climate: temperature (number), rainfall (number >= 0 or qualitative string like "low", "high", "moderate", "seasonal")
   - landUse: type (string), fragmentation (number 0-1)
   - biodiversity: speciesRichness (number >= 0), habitatDiversity (number >= 0)
   - humanImpact: pollution (number 0-1), deforestation (number >= 0)
   - region: string
3. Return ONLY valid JSON matching this schema:
{
  "soil": { "ph": null, "organicCarbon": null, "moisture": null },
  "climate": { "temperature": null, "rainfall": null },
  "landUse": { "type": null, "fragmentation": null },
  "biodiversity": { "speciesRichness": null, "habitatDiversity": null },
  "humanImpact": { "pollution": null, "deforestation": null },
  "region": null
}

Known Current Context (for disambiguation only):
${JSON.stringify(existingContext || {}, null, 2)}

User Message:
"${message}"`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const rawText = response.text || '';
    const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

    if (!cleanJson) {
      return { extracted: {}, success: false };
    }

    const parsed = JSON.parse(cleanJson);
    const validatedResult: Partial<EnvironmentalContext> = {};

    // Validate each group against Phase 3 schema
    if (parsed.soil && typeof parsed.soil === 'object') {
      if (parsed.soil.pH !== undefined && parsed.soil.ph === undefined) {
        parsed.soil.ph = parsed.soil.pH;
      }
      delete parsed.soil.pH;
      const v = soilValidationSchema.safeParse(parsed.soil);
      if (v.success && v.data && Object.keys(v.data).length > 0) {
        validatedResult.soil = {
          ph: v.data.ph,
          organicCarbon: v.data.organicCarbon,
          moisture: v.data.moisture,
        };
      }
    }

    if (parsed.climate && typeof parsed.climate === 'object') {
      const v = climateValidationSchema.safeParse(parsed.climate);
      if (v.success && v.data && Object.keys(v.data).length > 0) {
        validatedResult.climate = v.data;
      }
    }

    if (parsed.landUse && typeof parsed.landUse === 'object') {
      const v = landUseValidationSchema.safeParse(parsed.landUse);
      if (v.success && v.data && Object.keys(v.data).length > 0) {
        validatedResult.landUse = v.data;
      }
    }

    if (parsed.biodiversity && typeof parsed.biodiversity === 'object') {
      const v = biodiversityValidationSchema.safeParse(parsed.biodiversity);
      if (v.success && v.data && Object.keys(v.data).length > 0) {
        validatedResult.biodiversity = v.data;
      }
    }

    if (parsed.humanImpact && typeof parsed.humanImpact === 'object') {
      const v = humanImpactValidationSchema.safeParse(parsed.humanImpact);
      if (v.success && v.data && Object.keys(v.data).length > 0) {
        validatedResult.humanImpact = v.data;
      }
    }

    if (typeof parsed.region === 'string' && parsed.region.trim()) {
      validatedResult.region = parsed.region.trim();
    }

    return { extracted: validatedResult, success: true };
  } catch (err: any) {
    console.warn('[Extraction Warning] Gemini extraction encountered an error; falling back to rule extraction:', err.message || err);
    return { extracted: {}, success: false };
  }
}

/**
 * 3. Main Extraction Pipeline:
 * Rule-Based Pre-Pass + Optional Gemini Assistance + Conflict Resolution (Rules Win)
 */
export async function extractEnvironmentalContext(
  message: string,
  existingContext?: Partial<EnvironmentalContext>
): Promise<ExtractionResult> {
  if (!message || typeof message !== 'string' || message.trim() === '') {
    return {
      extractedContext: {},
      newFieldsFound: [],
      fieldMetadata: {},
      llmAttempted: false,
      llmSuccess: false,
    };
  }

  // 1. Rule-based extraction (Highest priority)
  const ruleExtracted = extractFromRules(message);

  // 2. Gemini semantic extraction (Supplementary assistance)
  const hasGeminiKey =
    Boolean(config.geminiApiKey) &&
    config.geminiApiKey !== 'placeholder_gemini_api_key_phase0' &&
    config.geminiApiKey.trim() !== '';

  let geminiExtracted: Partial<EnvironmentalContext> = {};
  let geminiSuccess = false;

  if (hasGeminiKey) {
    const geminiRes = await extractFromGemini(message, existingContext);
    geminiExtracted = geminiRes.extracted;
    geminiSuccess = geminiRes.success;
  }

  // 3. Conflict Resolution & Merging
  // RULES TAKE PRECEDENCE FOR EXPLICIT VALUES.
  const mergedExtracted: Partial<EnvironmentalContext> = {};
  const fieldMetadata: Record<string, ExtractedFieldMetadata> = {};
  const newFieldsFound: string[] = [];

  const resolveSubGroup = (
    groupKey: 'soil' | 'climate' | 'landUse' | 'biodiversity' | 'humanImpact',
    subFields: string[]
  ) => {
    const ruleGroup = (ruleExtracted[groupKey] || {}) as Record<string, unknown>;
    const geminiGroup = (geminiExtracted[groupKey] || {}) as Record<string, unknown>;
    const existingGroup = ((existingContext ? existingContext[groupKey] : {}) || {}) as Record<string, unknown>;

    for (const field of subFields) {
      const fullPath = `${groupKey}.${field}`;
      const ruleVal = ruleGroup[field];
      const geminiVal = geminiGroup[field];
      const existingVal = existingGroup[field];

      if (ruleVal !== undefined && ruleVal !== null) {
        // Rule-based win
        mergedExtracted[groupKey] = mergedExtracted[groupKey] || {};
        (mergedExtracted[groupKey] as Record<string, unknown>)[field] = ruleVal;

        const isHybrid = geminiVal !== undefined && geminiVal !== null && geminiVal === ruleVal;
        fieldMetadata[fullPath] = {
          field: fullPath,
          value: ruleVal,
          source: isHybrid ? 'hybrid' : 'rule_based',
          confidence: isHybrid ? 0.98 : 0.95,
        };

        if (isValueChanged(existingVal, ruleVal)) {
          newFieldsFound.push(fullPath);
        }
      } else if (geminiVal !== undefined && geminiVal !== null) {
        // Gemini supplemental extraction
        mergedExtracted[groupKey] = mergedExtracted[groupKey] || {};
        (mergedExtracted[groupKey] as Record<string, unknown>)[field] = geminiVal;

        fieldMetadata[fullPath] = {
          field: fullPath,
          value: geminiVal,
          source: 'gemini_nl',
          confidence: 0.85,
        };

        if (isValueChanged(existingVal, geminiVal)) {
          newFieldsFound.push(fullPath);
        }
      }
    }
  };

  resolveSubGroup('soil', ['ph', 'organicCarbon', 'moisture']);
  // Enforce canonical field: strictly remove non-canonical pH alias
  if (mergedExtracted.soil) {
    delete (mergedExtracted.soil as any).pH;
    delete (mergedExtracted.soil as any).soil_pH;
  }

  resolveSubGroup('climate', ['temperature', 'rainfall']);
  resolveSubGroup('landUse', ['type', 'fragmentation']);
  resolveSubGroup('biodiversity', ['speciesRichness', 'habitatDiversity']);
  resolveSubGroup('humanImpact', ['pollution', 'deforestation']);

  // Region
  const ruleReg = ruleExtracted.region;
  const geminiReg = geminiExtracted.region;
  const existingReg = existingContext?.region;

  if (ruleReg) {
    mergedExtracted.region = ruleReg;
    const isHybrid = geminiReg && geminiReg.toLowerCase() === ruleReg.toLowerCase();
    fieldMetadata['region'] = {
      field: 'region',
      value: ruleReg,
      source: isHybrid ? 'hybrid' : 'rule_based',
      confidence: isHybrid ? 0.98 : 0.95,
    };
    if (isValueChanged(existingReg, ruleReg)) {
      newFieldsFound.push('region');
    }
  } else if (geminiReg) {
    mergedExtracted.region = geminiReg;
    fieldMetadata['region'] = {
      field: 'region',
      value: geminiReg,
      source: 'gemini_nl',
      confidence: 0.85,
    };
    if (isValueChanged(existingReg, geminiReg)) {
      newFieldsFound.push('region');
    }
  }

  return {
    extractedContext: mergedExtracted,
    newFieldsFound,
    fieldMetadata,
    llmAttempted: hasGeminiKey,
    llmSuccess: geminiSuccess,
  };
}

export default extractEnvironmentalContext;
