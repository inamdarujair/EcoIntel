import { GoogleGenAI } from '@google/genai';
import config from '../config';

export interface PhrasingInput {
  pathwayChain: string[];
  evidenceText: string;
}

export interface PhrasingResult {
  recommendation: string;
  whyItWorks: string;
}

export class PhrasingService {
  private static genAI: GoogleGenAI | null = null;
  private static modelName = 'gemini-2.5-flash';

  public static initialize() {
    if (config.geminiApiKey) {
      this.genAI = new GoogleGenAI({ apiKey: config.geminiApiKey });
    }
  }

  /**
   * Numeric Traceability Validation:
   * Extracts all numbers (including decimals and percentages) from text.
   * Ensures every number found in the generated text exists in the source text.
   */
  public static validateNumericTraceability(sourceText: string, generatedText: string): boolean {
    const numberRegex = /\b\d+(?:\.\d+)?%?\b/g;
    const sourceNumbers = new Set(sourceText.match(numberRegex) || []);
    const generatedNumbers = generatedText.match(numberRegex) || [];

    for (const num of generatedNumbers) {
      if (!sourceNumbers.has(num)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Rich deterministic fallback: synthesizes pathway-specific recommendation text from
   * the actual causal chain steps and evidence, producing meaningfully distinct output
   * per pathway without any LLM call. Used when Gemini is unavailable.
   */
  public static getDeterministicFallback(input: PhrasingInput): PhrasingResult {
    const chain = input.pathwayChain;
    const evidenceText = input.evidenceText || '';

    // --- Build recommendation sentence from chain ---
    // Pattern: first chain step identifies the stressor; last step identifies the outcome.
    // Convert "Low X reduces Y" → "Restore / Manage X to prevent Y"
    const firstStep = chain[0] || '';
    const lastStep = chain[chain.length - 1] || '';

    // Extract action cues from first chain step
    let actionPhrase = 'Address the identified environmental stressor';
    const firstLower = firstStep.toLowerCase();
    if (firstLower.includes('soil organic carbon')) {
      actionPhrase = 'Replenish depleted soil organic carbon through conservation tillage, residue retention, and cover cropping';
    } else if (firstLower.includes('elevated temperature') || firstLower.includes('temperature increases')) {
      actionPhrase = 'Implement heat stress mitigation measures including shade agroforestry, increased soil moisture conservation, and drought-tolerant species deployment';
    } else if (firstLower.includes('fragmented habitat') || firstLower.includes('land-use change')) {
      actionPhrase = 'Establish landscape connectivity through ecological corridors, riparian buffer zones, and stepping-stone habitat patches';
    } else if (firstLower.includes('pollution')) {
      actionPhrase = 'Reduce agricultural chemical inputs and establish vegetated riparian buffer strips to intercept runoff and protect downstream biodiversity';
    }

    // Extract outcome from last step
    let outcomePhrase = 'to reduce biodiversity pressure';
    const lastLower = lastStep.toLowerCase();
    if (lastLower.includes('biodiversity pressure')) {
      outcomePhrase = 'to reduce biodiversity pressure and restore habitat quality';
    } else if (lastLower.includes('survival pressure') || lastLower.includes('ecological stress')) {
      outcomePhrase = 'to protect water-sensitive species from compounding climate and moisture stress';
    } else if (lastLower.includes('extinction debt') || lastLower.includes('biodiversity')) {
      outcomePhrase = 'to prevent extinction debt accumulation and restore inter-patch species movement';
    } else if (lastLower.includes('biodiversity decline')) {
      outcomePhrase = 'to halt persistent biodiversity decline in ecologically sensitive areas';
    }

    const recommendation = `${actionPhrase} ${outcomePhrase}. The causal pathway runs: ${chain.slice(0, 3).join(' → ')}.`;

    // --- Build whyItWorks from actual evidence titles ---
    // Parse evidence source titles from the combined evidence text
    const sourceTitleMatches = evidenceText.matchAll(/\[Source \d+ \(([^)]+)\)\]/g);
    const sourceTitles: string[] = [];
    for (const match of sourceTitleMatches) {
      if (match[1] && !sourceTitles.includes(match[1])) {
        sourceTitles.push(match[1]);
      }
    }

    let whyItWorks: string;
    if (sourceTitles.length > 0) {
      const sourceList = sourceTitles.slice(0, 3).map(t => `"${t.length > 60 ? t.slice(0, 60) + '...' : t}"`).join(', ');
      whyItWorks = `This intervention is grounded in peer-reviewed evidence including ${sourceList}. ${chain.join(' ')}`;
    } else {
      whyItWorks = chain.join(' ');
    }

    return { recommendation, whyItWorks };
  }

  public static async generatePhrasing(input: PhrasingInput): Promise<PhrasingResult> {
    if (!this.genAI) {
      return this.getDeterministicFallback(input);
    }

    const systemInstruction = `You are a scientific-language phrasing assistant.
Rewrite the supplied environmental recommendation in clear plain language.
You may only use factual information explicitly present in the supplied pathway chain and evidence.
Do not add external knowledge.
Do not infer new scientific relationships.
Do not invent statistics.
Do not invent percentages.
Do not invent measurements.
Do not invent dates.
Do not invent sources.
Do not change the impacted metrics.
Do not change the confidence.
Do not change the time horizon.
Do not create a recommendation if evidence is insufficient.
If a statement is not supported by the supplied material, omit it.

Respond ONLY with a JSON object in this exact format:
{
  "recommendation": "...",
  "whyItWorks": "..."
}`;

    const promptText = `Pathway Chain:\n${input.pathwayChain.join('\n')}\n\nEvidence:\n${input.evidenceText}`;

    try {
      const response = await this.genAI.models.generateContent({
        model: this.modelName,
        contents: promptText,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          temperature: 0.1, // low temp for factual phrasing
        }
      });

      const text = response.text;
      if (!text) throw new Error("Empty response from Gemini");

      const parsed: PhrasingResult = JSON.parse(text);

      // Verify numeric traceability
      const combinedSource = `${input.pathwayChain.join(' ')} ${input.evidenceText}`;
      const combinedGenerated = `${parsed.recommendation} ${parsed.whyItWorks}`;

      if (this.validateNumericTraceability(combinedSource, combinedGenerated)) {
        return parsed;
      }

      // Retry once with stricter prompt if numbers hallucinated
      const strictInstruction = systemInstruction + '\n\nCRITICAL WARNING: You previously hallucinated numbers. You MUST NOT include any number that is not explicitly in the evidence text.';
      
      const retryResponse = await this.genAI.models.generateContent({
        model: this.modelName,
        contents: promptText,
        config: {
          systemInstruction: strictInstruction,
          responseMimeType: 'application/json',
          temperature: 0.0, 
        }
      });

      const retryText = retryResponse.text;
      if (!retryText) throw new Error("Empty response from Gemini on retry");
      const retryParsed: PhrasingResult = JSON.parse(retryText);

      const retryCombinedGenerated = `${retryParsed.recommendation} ${retryParsed.whyItWorks}`;
      if (this.validateNumericTraceability(combinedSource, retryCombinedGenerated)) {
        return retryParsed;
      }

      // Fallback
      return this.getDeterministicFallback(input);
    } catch (error) {
      console.error("[PhrasingService] Error calling Gemini:", error);
      return this.getDeterministicFallback(input);
    }
  }
}

// Auto-initialize if key available
PhrasingService.initialize();
