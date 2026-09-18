"use client";

import React, { useState } from "react";
import { Recommendation } from "@/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { EvidencePanel } from "@/components/EvidencePanel/EvidencePanel";
import {
  Clock,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";

interface RecommendationCardProps {
  recommendation: Recommendation;
}

export const RecommendationCard: React.FC<RecommendationCardProps> = ({
  recommendation,
}) => {
  const [showEvidence, setShowEvidence] = useState(false);

  const isInsufficient =
    recommendation.metadata?.evidenceStatus === "insufficient_evidence" ||
    recommendation.description?.toLowerCase().includes("insufficient scientific evidence");

  // Confidence computation: bounded 0 to 100%
  const rawConfidence = recommendation.confidenceScore ?? 0;
  const confidencePercent = Math.min(
    100,
    Math.max(0, rawConfidence <= 1 ? Math.round(rawConfidence * 100) : Math.round(rawConfidence))
  );

  // Insufficient Evidence State Card
  if (isInsufficient) {
    return (
      <Card className="border-amber-200 dark:border-amber-900/60 bg-amber-50/30 dark:bg-amber-950/20 shadow-xs">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Badge variant="warning" className="gap-1 text-[11px] font-medium">
              <AlertTriangle className="w-3 h-3" />
              Scientific Evidence Limitation
            </Badge>
            {recommendation.reasoningPathway && (
              <span className="text-[10px] font-mono text-zinc-500">
                Pathway: {recommendation.reasoningPathway}
              </span>
            )}
          </div>
          <CardTitle className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mt-2">
            {recommendation.title}
          </CardTitle>
          <CardDescription className="text-xs text-amber-800 dark:text-amber-300">
            Insufficient scientific evidence was retrieved to support a strong actionable recommendation.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-xs text-zinc-600 dark:text-zinc-400">
          <p className="leading-relaxed">
            The deterministic reasoning pathway was triggered based on your parameters, but targeted vector retrieval returned no verified citations above the relevance threshold (0.40). No ungrounded advice is generated.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Normal Evidence-Backed Recommendation Card
  return (
    <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
              <Lightbulb className="w-3.5 h-3.5" />
            </div>
            <Badge variant="success" className="text-[10px] font-medium">
              Verified Grounded Recommendation
            </Badge>
          </div>

          {recommendation.timeHorizon && (
            <div className="flex items-center gap-1 text-[11px] text-zinc-500 font-mono">
              <Clock className="w-3 h-3 text-zinc-400" />
              <span>{recommendation.timeHorizon}</span>
            </div>
          )}
        </div>

        <CardTitle className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mt-2">
          {recommendation.title}
        </CardTitle>

        <CardDescription className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed mt-1">
          {recommendation.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3.5 text-xs">
        {/* Why It Works Causal Explanation */}
        {recommendation.whyItWorks && recommendation.whyItWorks !== "N/A" && (
          <div className="p-3 bg-zinc-50 dark:bg-zinc-950/80 rounded-lg border border-zinc-100 dark:border-zinc-800 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Causal Mechanism (Why It Works)
            </span>
            <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
              {recommendation.whyItWorks}
            </p>
          </div>
        )}

        {/* Impacted Metrics Chips */}
        {recommendation.impactedMetrics && recommendation.impactedMetrics.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Impacted Environmental Metrics
            </span>
            <div className="flex flex-wrap gap-1.5">
              {recommendation.impactedMetrics.map((metric) => (
                <Badge
                  key={metric}
                  variant="mono"
                  className="text-[11px] px-2 py-0.5 bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  {metric}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Confidence Score Bar */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Scientific Confidence
            </span>
            <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              {confidencePercent}%
            </span>
          </div>
          <Progress value={confidencePercent} />
        </div>

        {/* Evidence Section Toggle */}
        {recommendation.evidence && recommendation.evidence.length > 0 && (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowEvidence(!showEvidence)}
              className="w-full flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
            >
              <span>Evidence Base ({recommendation.evidence.length} peer-reviewed source{recommendation.evidence.length > 1 ? 's' : ''})</span>
              {showEvidence ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            {showEvidence && <EvidencePanel evidence={recommendation.evidence} />}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
