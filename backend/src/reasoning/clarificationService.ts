import { GoogleGenAI } from '@google/genai';
import config from '../config';
import { EnvironmentalContext } from '../types';
import { PATHWAYS, Pathway } from './pathways';

export interface ClarificationDecision {
  shouldAsk: boolean;
  missingVariables: string[];
  pathwayIds: string[];
}

export class ClarificationService {
  private static genAI: GoogleGenAI | null = null;
  private static modelName = 'gemini-2.5-flash';

  public static initialize() {
    if (config.geminiApiKey) {
      this.genAI = new GoogleGenAI({ apiKey: config.geminiApiKey });
    }
  }

  /**
   * Helper to resolve dot notation to check if field exists and is non-null
   */
  private static hasField(context: EnvironmentalContext, fieldPath: string): boolean {
    const parts = fieldPath.split('.');
    let current: any = context;
    for (const part of parts) {
      if (current === null || current === undefined) return false;
      current = current[part];
    }
    return current !== null && current !== undefined;
  }

  /**
   * Evaluates pathways to find non-triggered ones missing exactly 1 or 2 variables.
   * Returns a structured decision on what to ask.
   */
  public static getClarificationCandidates(
    context: EnvironmentalContext,
    triggeredPathwayIds: string[],
    previouslyRequestedFields: string[] = []
  ): ClarificationDecision {
    const missingVarsSet = new Set<string>();
    const nearTriggerablePathways = new Set<string>();

    for (const pathway of PATHWAYS) {
      if (triggeredPathwayIds.includes(pathway.id)) {
        continue; // Pathway already triggered, do not ask optional fields
      }

      const missingInThisPathway = pathway.variablesInvolved.filter(
        v => !this.hasField(context, v)
      );

      // We only consider pathways missing 1 or 2 variables to be "near-triggerable"
      if (missingInThisPathway.length === 1 || missingInThisPathway.length === 2) {
        nearTriggerablePathways.add(pathway.id);
        for (const mv of missingInThisPathway) {
          missingVarsSet.add(mv);
        }
      }
    }

    // Filter out previously requested fields unless they're the only ones left (wait, user requirement:
    // "Remove previously requested fields unless new information changes need" 
    // Actually, rule 15: "If a field was already supplied... never ask for it again" (handled by hasField).
    // Rule 16: "Track which fields were requested and avoid immediately repeating the same unanswered question."
    
    let candidates = Array.from(missingVarsSet);
    
    // Attempt to exclude previously requested fields
    const newCandidates = candidates.filter(c => !previouslyRequestedFields.includes(c));
    
    if (newCandidates.length > 0) {
      candidates = newCandidates;
    } 
    // If filtering removes all candidates, we just don't ask anything to avoid spamming.
    else if (previouslyRequestedFields.length > 0 && candidates.length > 0) {
       // All missing vars were already requested. Return false so we don't spam.
       return { shouldAsk: false, missingVariables: [], pathwayIds: [] };
    }

    // Limit to 2 variables per turn
    const finalMissingVars = candidates.slice(0, 2);

    return {
      shouldAsk: finalMissingVars.length > 0,
      missingVariables: finalMissingVars,
      pathwayIds: Array.from(nearTriggerablePathways),
    };
  }

  /**
   * Formulates a natural language question asking for the missing fields,
   * strictly delegating phrasing to Gemini without allowing it to infer missing fields.
   */
  public static async generateQuestion(decision: ClarificationDecision): Promise<string> {
    if (!decision.shouldAsk || decision.missingVariables.length === 0) {
      return '';
    }

    const fieldDescriptions = decision.missingVariables.map(v => v.replace('.', ' ')).join(' and ');

    if (!this.genAI) {
      // Deterministic fallback
      return `To help provide better recommendations, could you provide information on your ${fieldDescriptions}?`;
    }

    const systemInstruction = `You are a conversational assistant. Ask a single, short, and natural clarifying question.
You MUST ONLY ask about the following missing fields: ${decision.missingVariables.join(', ')}.
DO NOT ask broad open-ended questions like "tell me more about your environment".
DO NOT invent facts. DO NOT provide recommendations. Keep it under 2 sentences.`;

    const promptText = `Missing variables to ask about: ${decision.missingVariables.join(', ')}`;

    try {
      const response = await this.genAI.models.generateContent({
        model: this.modelName,
        contents: promptText,
        config: {
          systemInstruction,
          temperature: 0.2, // low temp for focused phrasing
        }
      });

      if (response.text) {
        return response.text.trim();
      }
    } catch (error) {
      console.error("[ClarificationService] Gemini Error:", error);
    }
    
    // Fallback
    return `Could you provide some details regarding your ${fieldDescriptions}?`;
  }
}

ClarificationService.initialize();
