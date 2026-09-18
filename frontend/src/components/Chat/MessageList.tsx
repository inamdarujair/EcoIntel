"use client";

import React, { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Bot, User, CheckCircle2, Loader2 } from "lucide-react";
import { ExtractionResult } from "@/types";

export interface ChatMessageItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
  extraction?: ExtractionResult;
}

interface MessageListProps {
  messages: ChatMessageItem[];
  isLoading?: boolean;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isLoading = false,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-500 dark:text-zinc-400 space-y-3">
        <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
          <Bot className="w-6 h-6" />
        </div>
        <div className="max-w-sm space-y-1">
          <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            EcoIntel Scientific Assessment
          </h4>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Provide ecological parameters via natural language or toggle to the
            Structured Input form. Known fields will be verified and mapped to
            deterministic causal pathways.
          </p>
        </div>
        <div className="text-[11px] font-mono bg-zinc-100 dark:bg-zinc-800/80 px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700">
          e.g. &quot;My soil organic carbon is 0.3% and rainfall has been low&quot;
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((msg) => {
        const isUser = msg.role === "user";

        return (
          <div
            key={msg.id}
            className={`flex items-start gap-2.5 ${
              isUser ? "flex-row-reverse" : "flex-row"
            }`}
          >
            {/* Avatar */}
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs ${
                isUser
                  ? "bg-zinc-800 text-white dark:bg-zinc-700"
                  : "bg-emerald-600 text-white dark:bg-emerald-700"
              }`}
            >
              {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
            </div>

            {/* Bubble */}
            <div
              className={`max-w-[82%] rounded-xl px-3.5 py-2.5 text-sm shadow-xs ${
                isUser
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100"
              }`}
            >
              <div className="whitespace-pre-wrap leading-relaxed">
                {msg.content}
              </div>

              {/* Extraction Chips if returned */}
              {!isUser && msg.extraction && msg.extraction.newFieldsFound?.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Extracted Environmental Variables:</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {msg.extraction.newFieldsFound.map((field) => {
                      const meta = msg.extraction?.fieldMetadata?.[field];
                      const valStr = meta?.value !== undefined ? ` = ${String(meta.value)}` : "";
                      return (
                        <Badge
                          key={field}
                          variant="success"
                          className="font-mono text-[10px] px-1.5 py-0"
                        >
                          {field}{valStr}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Loading state indicator */}
      {isLoading && (
        <div className="flex items-start gap-2.5">
          <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
            <Bot className="w-3.5 h-3.5" />
          </div>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-2 shadow-xs">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
            <span>Analyzing environmental parameters & deterministic pathways...</span>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
};
