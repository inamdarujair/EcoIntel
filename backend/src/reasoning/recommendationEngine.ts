import { ReasoningEngine, TriggeredPathwayWithEvidence } from './reasoningEngine';
import { EnvironmentalContext } from '../types';
import { PhrasingService } from '../services/phrasingService';
import { EvidenceItem } from '../rag/retrievalService';
import { recommendationSchema } from '../validation/recommendationSchema';
import { Recommendation } from '../models';

export interface GeneratedRecommendation {
  title: string;
  description: string;
  whyItWorks?: string;
  impactedMetrics: string[];
  timeHorizon: string;
  confidenceScore: number;
  evidence: any[];
  reasoningPathway: string;
  status: 'proposed' | 'accepted' | 'in_progress' | 'completed' | 'rejected';
  metadata: {
    evidenceStatus: string;
    message?: string;
    pathwayChain: string[];
    grounding: {
      pathwayChainUsed: boolean;
      evidenceIdsUsed: string[];
    };
  };
}

export class RecommendationEngine {
  // Deterministic time-horizon lookup
  private static PATHWAY_TIME_HORIZONS: Record<string, string> = {
    'soilOrganicCarbon_waterStress_pathway': 'medium-to-long-term',
    'climateStress_pathway': 'short-to-medium-term',
    'landUseFragmentation_pathway': 'medium-to-long-term',
    'pollutionEcosystem_pathway': 'short-to-medium-term',
  };

  // Deterministic impacted metrics mapping
  private static PATHWAY_IMPACTED_METRICS: Record<string, string[]> = {
    'soilOrganicCarbon_waterStress_pathway': ['soil.organicCarbon', 'soil.moisture', 'climate.rainfall', 'biodiversity.habitatDiversity'],
    'climateStress_pathway': ['climate.temperature', 'soil.moisture', 'biodiversity.speciesRichness'],
    'landUseFragmentation_pathway': ['landUse.fragmentation', 'biodiversity.habitatDiversity', 'biodiversity.speciesRichness'],
    'pollutionEcosystem_pathway': ['humanImpact.pollution', 'biodiversity.speciesRichness', 'biodiversity.habitatDiversity'],
  };

  /**
   * Deterministic confidence score calculation.
   * Based on: Average score of retrieved chunks bounded to [0,1]
   */
  private static calculateConfidence(evidence: EvidenceItem[]): number {
    if (!evidence || evidence.length === 0) return 0;
    
    let sum = 0;
    for (const item of evidence) {
      sum += (item.score ?? 0);
    }
    const avgScore = sum / evidence.length;
    
    // Retrieval scores in this project usually range 0.0 to 1.0 depending on the distance metric.
    // Ensure bounded [0, 1].
    return Math.max(0, Math.min(1, avgScore));
  }

  /**
   * Main entry point for Phase 9
   */
  public static async generate(
    context: EnvironmentalContext,
    conversationId?: string,
    options?: { topK?: number; minScoreThreshold?: number }
  ): Promise<{ recommendations: GeneratedRecommendation[]; summary: any }> {
    
    // 1. Run Phase 8 Reasoning
    const reasoningResult = await ReasoningEngine.evaluateWithEvidence(context, options);
    
    const generatedRecommendations: GeneratedRecommendation[] = [];
    let insufficientCount = 0;

    // 2. Process each triggered pathway
    for (const pathway of reasoningResult.triggeredPathways) {
      const pathwayId = pathway.pathwayId;
      const evidence = pathway.retrieval.evidence;
      const status = pathway.retrieval.status;
      const chain = pathway.chain;

      const impactedMetrics = this.PATHWAY_IMPACTED_METRICS[pathwayId] || pathway.variablesUsed;
      const timeHorizon = this.PATHWAY_TIME_HORIZONS[pathwayId] || 'unknown';

      // Transform evidence to DB schema format
      const dbEvidence = evidence.map(e => ({
        sourceDocument: e.title || e.documentId || 'Unknown Source',
        chunkText: e.text,
        score: e.score,
        metadata: {
          chunkId: e.chunkId,
          organization: e.organization,
          year: e.year,
          url: e.url,
          isShared: e.isShared,
        }
      }));

      // A. HARD GATE: Insufficient Evidence
      if (status === 'insufficient_evidence') {
        insufficientCount++;
        generatedRecommendations.push({
          title: `Action needed for ${pathway.name}`,
          description: "Insufficient scientific evidence was retrieved to support a strong recommendation.",
          whyItWorks: "N/A",
          impactedMetrics: [],
          timeHorizon: "not established",
          confidenceScore: 0,
          evidence: [],
          reasoningPathway: pathwayId,
          status: 'proposed',
          metadata: {
            evidenceStatus: 'insufficient_evidence',
            message: "Insufficient scientific evidence was retrieved to support a strong recommendation.",
            pathwayChain: chain,
            grounding: { pathwayChainUsed: false, evidenceIdsUsed: [] }
          }
        });
        continue; // DO NOT call Gemini
      }

      // B. Sufficient Evidence: Build deterministic structure
      const confidence = this.calculateConfidence(evidence);
      const evidenceIdsUsed = evidence.map(e => e.chunkId).filter(id => !!id) as string[];
      
      const combinedEvidenceText = evidence.map((e, idx) => `[Source ${idx + 1} (${e.title})]: ${e.text}`).join('\n\n');

      // C. Delegate to Gemini phrasing layer
      const phrasing = await PhrasingService.generatePhrasing({
        pathwayChain: chain,
        evidenceText: combinedEvidenceText
      });

      // D. Combine and create generated recommendation
      const rawRec = {
        title: `Intervention for ${pathway.name}`,
        description: phrasing.recommendation,
        whyItWorks: phrasing.whyItWorks,
        impactedMetrics,
        timeHorizon,
        confidenceScore: confidence,
        evidence: dbEvidence,
        reasoningPathway: pathwayId,
        status: 'proposed' as const,
        metadata: {
          evidenceStatus: 'sufficient',
          pathwayChain: chain,
          grounding: {
            pathwayChainUsed: true,
            evidenceIdsUsed
          }
        }
      };

      // E. Zod Validation
      recommendationSchema.parse(rawRec); // Throws if invalid

      // F. Save to DB (Persistence)
      if (conversationId) {
        const dbRec = new Recommendation({
          ...rawRec,
          conversationId,
          contextId: context._id
        });
        await dbRec.save();
      }

      generatedRecommendations.push(rawRec);
    }

    return {
      recommendations: generatedRecommendations,
      summary: {
        pathwayCount: reasoningResult.pathwayCount,
        recommendationCount: generatedRecommendations.length - insufficientCount,
        insufficientEvidenceCount: insufficientCount
      }
    };
  }
}
