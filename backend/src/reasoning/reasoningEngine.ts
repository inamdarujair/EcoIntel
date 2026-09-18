import { EnvironmentalContext } from '../types';
import { PATHWAYS, Pathway, TriggerConditionDetail } from './pathways';
import { RetrievalService, PathwayQuery, EvidenceItem } from '../rag/retrievalService';

export interface TriggeredPathwayResult {
  pathwayId: string;
  name: string;
  variablesInvolved: string[];
  variablesUsed: string[];
  chain: string[];
  queryText: string;
  triggerDetails: TriggerConditionDetail[];
}

export interface ReasoningEvaluationResult {
  triggeredPathways: TriggeredPathwayResult[];
  distinctVariablesUsed: string[];
  pathwayCount: number;
}

export interface PathwayRetrievalResult {
  status: 'sufficient' | 'insufficient_evidence';
  evidence: EvidenceItem[];
}

export interface TriggeredPathwayWithEvidence extends TriggeredPathwayResult {
  retrieval: PathwayRetrievalResult;
}

export interface ReasoningEvaluationWithEvidenceResult {
  triggeredPathways: TriggeredPathwayWithEvidence[];
  distinctVariablesUsed: string[];
  pathwayCount: number;
}

export interface RetrieveEvidenceOptions {
  topK?: number;
  minScoreThreshold?: number;
}

/**
 * Phase 8 Deterministic Reasoning Engine
 */
export class ReasoningEngine {
  /**
   * Pure deterministic evaluation of the EnvironmentalContext against pathways.
   * Zero LLM calls. Zero API calls.
   */
  public static evaluate(
    context: EnvironmentalContext,
    registry: Pathway[] = PATHWAYS
  ): ReasoningEvaluationResult {
    const triggeredPathways: TriggeredPathwayResult[] = [];
    const allVariablesUsed = new Set<string>();

    for (const pathway of registry) {
      const triggerResult = pathway.evaluateTrigger(context);
      
      if (triggerResult.triggered) {
        triggeredPathways.push({
          pathwayId: pathway.id,
          name: pathway.name,
          variablesInvolved: pathway.variablesInvolved,
          variablesUsed: triggerResult.variablesUsed,
          chain: pathway.chain,
          queryText: pathway.queryTemplate(context),
          triggerDetails: triggerResult.triggerDetails,
        });

        triggerResult.variablesUsed.forEach(v => allVariablesUsed.add(v));
      }
    }

    return {
      triggeredPathways,
      distinctVariablesUsed: Array.from(allVariablesUsed),
      pathwayCount: triggeredPathways.length,
    };
  }

  /**
   * Executes deterministic reasoning, then integrates with RetrievalService to fetch evidence.
   */
  public static async evaluateWithEvidence(
    context: EnvironmentalContext,
    options?: RetrieveEvidenceOptions
  ): Promise<ReasoningEvaluationWithEvidenceResult> {
    // 1. Pure deterministic reasoning
    const baseResult = this.evaluate(context);
    
    if (baseResult.pathwayCount === 0) {
      return {
        triggeredPathways: [],
        distinctVariablesUsed: [],
        pathwayCount: 0,
      };
    }

    // 2. Prepare queries for RetrievalService
    const pathwayQueries: PathwayQuery[] = baseResult.triggeredPathways.map(tp => ({
      pathwayId: tp.pathwayId,
      queryText: tp.queryText,
      variables: tp.variablesUsed, // targeted vector search scoped to used variables
      topK: options?.topK ?? 5,
      minScoreThreshold: options?.minScoreThreshold ?? 0.40,
    }));

    // 3. Batch retrieve
    const retrievalResult = await RetrievalService.retrieveForPathways(pathwayQueries);

    // 4. Merge results
    const triggeredWithEvidence: TriggeredPathwayWithEvidence[] = baseResult.triggeredPathways.map(tp => {
      const pr = retrievalResult.pathways[tp.pathwayId];
      return {
        ...tp,
        retrieval: {
          status: pr?.status ?? 'insufficient_evidence',
          evidence: pr?.evidence ?? [],
        }
      };
    });

    return {
      triggeredPathways: triggeredWithEvidence,
      distinctVariablesUsed: baseResult.distinctVariablesUsed,
      pathwayCount: baseResult.pathwayCount,
    };
  }
}
