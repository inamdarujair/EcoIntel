"use client";

import React from "react";
import { ReasoningEvaluationResult } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  X,
  RefreshCw,
  GitBranch,
  CheckCircle2,
  BookOpen,
  ExternalLink,
  Loader2,
  Cpu,
} from "lucide-react";

interface ReasoningTraceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  reasoningResult: ReasoningEvaluationResult | null;
  isLoading: boolean;
  onRefresh: () => Promise<void>;
}

export const ReasoningTraceDrawer: React.FC<ReasoningTraceDrawerProps> = ({
  isOpen,
  onClose,
  reasoningResult,
  isLoading,
  onRefresh,
}) => {
  if (!isOpen) return null;

  const pathways = reasoningResult?.triggeredPathways || [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs transition-opacity">
      <div
        className="w-full max-w-2xl bg-white dark:bg-zinc-900 h-full shadow-2xl flex flex-col border-l border-zinc-200 dark:border-zinc-800 animate-in slide-in-from-right duration-200"
        role="dialog"
        aria-modal="true"
        aria-label="Deterministic Causal Pathway Trace"
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
              <GitBranch className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Deterministic Causal Pathway Trace
              </h2>
              <p className="text-[11px] text-zinc-500">
                Pure deterministic environmental logic (Zero LLM reasoning)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
              className="text-xs h-8 px-2.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
              {isLoading ? "Evaluating..." : "Refresh"}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
              aria-label="Close trace drawer"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {isLoading && (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-zinc-500">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
              <span className="text-xs">Evaluating causal graph against context...</span>
            </div>
          )}

          {!isLoading && pathways.length === 0 && (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
                <Cpu className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                No Causal Pathways Triggered
              </h4>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
                The current environmental context does not satisfy any deterministic trigger thresholds. When conditions are met (e.g. low soil organic carbon, high fragmentation, or severe rainfall deficit), the complete causal chain and evidence will be visualized here.
              </p>
            </div>
          )}

          {!isLoading && pathways.length > 0 && (
            <div className="space-y-6">
              {/* Summary Banner */}
              <div className="p-3.5 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-emerald-900 dark:text-emerald-300">
                    Triggered Pathways: {pathways.length}
                  </span>
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5 font-mono">
                    Variables Used: {reasoningResult?.summary.distinctVariablesUsed.join(", ")}
                  </div>
                </div>
                <Badge variant="success" className="text-[10px]">
                  Verified Deterministic
                </Badge>
              </div>

              {/* Pathway Cards */}
              {pathways.map((pathway, pIdx) => {
                const isSufficient = pathway.retrieval?.status === "sufficient";
                const evidenceList = pathway.retrieval?.evidence || [];

                return (
                  <div
                    key={pathway.pathwayId || pIdx}
                    className="p-4 bg-zinc-50 dark:bg-zinc-950/70 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-4"
                  >
                    {/* Pathway Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                          {pathway.name}
                        </h3>
                        <span className="font-mono text-[10px] text-zinc-500">
                          ID: {pathway.pathwayId}
                        </span>
                      </div>
                      <Badge
                        variant={isSufficient ? "success" : "warning"}
                        className="text-[10px]"
                      >
                        {isSufficient ? "Evidence Sufficient" : "Insufficient Evidence"}
                      </Badge>
                    </div>

                    {/* Satisfied Trigger Conditions */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                        Satisfied Trigger Conditions
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {pathway.triggerDetails.map((td, tIdx) => (
                          <div
                            key={tIdx}
                            className="p-2 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs flex items-center justify-between"
                          >
                            <span className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
                              {td.variable} {td.operator} {String(td.threshold)}
                            </span>
                            <div className="flex items-center gap-1 font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                              <span>actual: {String(td.actualValue)}</span>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Deterministic Causal Chain Steps */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                        Predefined Causal Chain
                      </span>
                      <div className="relative pl-4 space-y-2 border-l-2 border-emerald-500/40 ml-2">
                        {pathway.chain.map((step, sIdx) => (
                          <div key={sIdx} className="relative text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                            <div className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-emerald-600 ring-2 ring-white dark:ring-zinc-900" />
                            <span className="font-mono text-[10px] text-zinc-400 mr-2">
                              Step {sIdx + 1}:
                            </span>
                            <span>{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Attached Evidence Items */}
                    <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                      <div className="flex items-center justify-between text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        <div className="flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Vector-Retrieved Evidence ({evidenceList.length})</span>
                        </div>
                      </div>

                      {evidenceList.length === 0 ? (
                        <p className="text-[11px] italic text-zinc-400">
                          No evidence items met the relevance threshold (0.40).
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {evidenceList.map((item, eIdx) => (
                            <div
                              key={item.chunkId || eIdx}
                              className="p-2.5 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs space-y-1.5"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                                  {item.title}
                                </span>
                                <Badge variant="mono" className="text-[10px] px-1.5 py-0 shrink-0">
                                  {(item.score * 100).toFixed(1)}%
                                </Badge>
                              </div>

                              <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                                {item.organization && <span>{item.organization}</span>}
                                {item.year && <span>({item.year})</span>}
                                {item.url && (
                                  <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-emerald-600 hover:underline"
                                  >
                                    <span>DOI</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                )}
                              </div>

                              <p className="text-[11px] text-zinc-600 dark:text-zinc-400 font-serif italic line-clamp-2">
                                &ldquo;{item.text}&rdquo;
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
