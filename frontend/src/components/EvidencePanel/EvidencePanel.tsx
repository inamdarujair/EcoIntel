"use client";

import React, { useState } from "react";
import { Evidence } from "@/types";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, BookOpen, ChevronDown, ChevronUp, FileText } from "lucide-react";

interface EvidencePanelProps {
  evidence: Evidence[];
}

export const EvidencePanel: React.FC<EvidencePanelProps> = ({ evidence }) => {
  const [expandedIndices, setExpandedIndices] = useState<Record<number, boolean>>({});

  if (!evidence || evidence.length === 0) {
    return (
      <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 text-center">
        No peer-reviewed evidence citations attached.
      </div>
    );
  }

  const toggleExpand = (idx: number) => {
    setExpandedIndices((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <div className="space-y-2 mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
      <div className="flex items-center justify-between text-xs font-semibold text-zinc-700 dark:text-zinc-300">
        <div className="flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Peer-Reviewed Evidence ({evidence.length} citations)</span>
        </div>
      </div>

      <div className="space-y-2">
        {evidence.map((item, idx) => {
          const isExpanded = !!expandedIndices[idx];
          const org = item.metadata?.organization;
          const year = item.metadata?.year;
          const url = item.metadata?.url;
          const score = item.score;
          const isShared = item.metadata?.isShared;

          return (
            <div
              key={item.id || item._id || idx}
              className="bg-zinc-50 dark:bg-zinc-950/80 rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 text-xs transition-colors hover:border-zinc-300 dark:hover:border-zinc-700"
            >
              {/* Top Row: Title + Score badge + External Link */}
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold text-zinc-900 dark:text-zinc-100 leading-snug flex-1">
                  {item.sourceDocument}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {score !== undefined && (
                    <Badge variant="mono" className="text-[10px] px-1.5 py-0 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                      Relevance: {(score * 100).toFixed(1)}%
                    </Badge>
                  )}
                  {isShared && (
                    <Badge variant="secondary" className="text-[9px] px-1 py-0">
                      Shared
                    </Badge>
                  )}
                </div>
              </div>

              {/* Metadata Row: Org, Year, Link */}
              <div className="flex items-center gap-3 mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 flex-wrap">
                {org && <span>{String(org)}</span>}
                {year && <span>• {String(year)}</span>}
                {url && (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 underline underline-offset-2"
                  >
                    <span>Source Reference</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>

              {/* Excerpt Toggle */}
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => toggleExpand(idx)}
                  className="flex items-center gap-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-300 hover:text-emerald-600 transition-colors cursor-pointer"
                >
                  <FileText className="w-3 h-3" />
                  <span>{isExpanded ? "Hide Excerpt" : "View Scientific Excerpt"}</span>
                  {isExpanded ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </button>

                {isExpanded && item.chunkText && (
                  <div className="mt-2 p-2.5 bg-white dark:bg-zinc-900 rounded-md border border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-700 dark:text-zinc-300 font-serif leading-relaxed italic">
                    &ldquo;{item.chunkText}&rdquo;
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
