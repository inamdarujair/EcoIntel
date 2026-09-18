"use client";

import React from "react";
import { EnvironmentalContext, Recommendation } from "@/types";
import { ContextOverview } from "./ContextOverview";
import { RecommendationCard } from "@/components/RecommendationCard/RecommendationCard";
import { Button } from "@/components/ui/button";
import { Activity, Sparkles, RefreshCw, Info, Loader2 } from "lucide-react";

interface AssessmentPanelProps {
  context: EnvironmentalContext | null;
  recommendations: Recommendation[];
  isLoadingRecs: boolean;
  onRefreshRecommendations?: () => Promise<void>;
  onOpenReasoningTrace: () => void;
  reasoningPathwayCount?: number;
}

export const AssessmentPanel: React.FC<AssessmentPanelProps> = ({
  context,
  recommendations,
  isLoadingRecs,
  onRefreshRecommendations,
  onOpenReasoningTrace,
  reasoningPathwayCount,
}) => {
  return (
    <div className="flex flex-col h-full bg-zinc-50/50 dark:bg-zinc-950/40 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xs">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
            Environmental Assessment & Intelligence
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onRefreshRecommendations && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLoadingRecs}
              onClick={onRefreshRecommendations}
              className="text-[11px] h-7 px-2.5"
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${isLoadingRecs ? "animate-spin" : ""}`} />
              {isLoadingRecs ? "Generating..." : "Generate Recommendations"}
            </Button>
          )}

          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={onOpenReasoningTrace}
            className="text-[11px] h-7 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
          >
            Reasoning Trace
            {reasoningPathwayCount !== undefined && reasoningPathwayCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-emerald-800 text-[10px] font-bold">
                {reasoningPathwayCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Main Content Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Section 1: Canonical Context State */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
              Active Environmental Context
            </h3>
            {context?.updatedAt && (
              <span className="text-[10px] font-mono text-zinc-400">
                Last updated: {new Date(context.updatedAt).toLocaleTimeString()}
              </span>
            )}
          </div>
          <ContextOverview context={context} />
        </div>

        {/* Section 2: Grounded Recommendations */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                Scientific Recommendations ({recommendations.length})
              </h3>
            </div>
          </div>

          {isLoadingRecs && (
            <div className="p-6 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-center gap-3 text-xs text-zinc-500">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
              <span>Evaluating deterministic pathways & retrieving evidence...</span>
            </div>
          )}

          {!isLoadingRecs && recommendations.length === 0 && (
            <div className="p-6 bg-white dark:bg-zinc-900 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 text-center space-y-2">
              <Info className="w-6 h-6 mx-auto text-zinc-400" />
              <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                No active recommendations generated yet.
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
                Recommendations are deterministically triggered when environmental variables satisfy verified causal thresholds (e.g. soil organic carbon $\le$ 1.0% with low rainfall). Provide more ecological parameters via Chat or the Form to trigger analysis.
              </p>
            </div>
          )}

          {!isLoadingRecs && recommendations.length > 0 && (
            <div className="space-y-4">
              {recommendations.map((rec, index) => (
                <RecommendationCard
                  key={rec.id || rec._id || `rec_${index}`}
                  recommendation={rec}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
