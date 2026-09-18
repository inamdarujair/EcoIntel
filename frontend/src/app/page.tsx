"use client";

import React, { useState, useCallback, useRef } from "react";
import { ChatPanel } from "@/components/Chat/ChatPanel";
import { ChatMessageItem } from "@/components/Chat/MessageList";
import { StructuredInputForm } from "@/components/StructuredForm/StructuredInputForm";
import { AssessmentPanel } from "@/components/AssessmentPanel/AssessmentPanel";
import { ReasoningTraceDrawer } from "@/components/ReasoningTrace/ReasoningTraceDrawer";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api, ApiError } from "@/lib/api";
import {
  EnvironmentalContext,
  Recommendation,
  ReasoningEvaluationResult,
  AnalyzeInput,
} from "@/types";
import {
  Leaf,
  GitBranch,
  RotateCcw,
  AlertTriangle,
  X,
  MessageSquare,
  ClipboardList,
} from "lucide-react";

export default function DashboardPage() {
  // --- Dashboard State ---
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [context, setContext] = useState<EnvironmentalContext | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [reasoningResult, setReasoningResult] = useState<ReasoningEvaluationResult | null>(null);

  // Active tab in left panel: "chat" | "form"
  const [activeTab, setActiveTab] = useState<string>("chat");

  // Reasoning Trace drawer state
  const [isReasoningDrawerOpen, setIsReasoningDrawerOpen] = useState<boolean>(false);

  // Loading flags
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const [isFormLoading, setIsFormLoading] = useState<boolean>(false);
  const [isRecsLoading, setIsRecsLoading] = useState<boolean>(false);
  const [isReasoningLoading, setIsReasoningLoading] = useState<boolean>(false);

  // Message counter ref for deterministic and pure ID generation
  const messageIdCounterRef = useRef<number>(1);

  // Global Error state
  const [errorState, setErrorState] = useState<{
    title: string;
    message: string;
    retryAction?: () => void;
  } | null>(null);

  const clearError = () => setErrorState(null);

  // --- Reset Entire Session ---
  const handleResetSession = () => {
    setConversationId(null);
    setContext(null);
    setMessages([]);
    setRecommendations([]);
    setReasoningResult(null);
    clearError();
  };

  // --- Fetch Recommendations Helper ---
  const fetchRecommendations = useCallback(
    async (targetConversationId?: string, targetContext?: EnvironmentalContext) => {
      const convId = targetConversationId || conversationId;
      if (!convId && !targetContext) return;

      setIsRecsLoading(true);
      try {
        const res = await api.generateRecommendations({
          conversationId: convId || undefined,
          context: targetContext,
        });
        if (res && res.recommendations) {
          setRecommendations(res.recommendations);
        }
      } catch (err: unknown) {
        console.error("Failed to generate recommendations:", err);
        const msg =
          err instanceof ApiError
            ? `[${err.code}] ${err.message}`
            : "Failed to load recommendations";
        setErrorState({
          title: "Recommendation Engine Error",
          message: msg,
        });
      } finally {
        setIsRecsLoading(false);
      }
    },
    [conversationId]
  );

  // --- Fetch Reasoning Trace Helper ---
  const fetchReasoningTrace = useCallback(
    async (targetConversationId?: string, targetContext?: EnvironmentalContext) => {
      const convId = targetConversationId || conversationId;
      setIsReasoningLoading(true);
      try {
        const res = await api.evaluateReasoning({
          conversationId: convId || undefined,
          context: targetContext,
        });
        if (res) {
          setReasoningResult(res);
        }
      } catch (err: unknown) {
        console.error("Failed to evaluate reasoning:", err);
        const msg =
          err instanceof ApiError
            ? `[${err.code}] ${err.message}`
            : "Failed to load reasoning trace";
        setErrorState({
          title: "Reasoning Engine Error",
          message: msg,
        });
      } finally {
        setIsReasoningLoading(false);
      }
    },
    [conversationId]
  );

  // --- Chat Message Handler ---
  const handleSendMessage = async (messageText: string) => {
    clearError();
    setIsChatLoading(true);

    const nextId = messageIdCounterRef.current++;
    const userMessageItem: ChatMessageItem = {
      id: `user_msg_${nextId}`,
      role: "user",
      content: messageText,
    };

    // Optimistically update message list
    setMessages((prev) => [...prev, userMessageItem]);

    try {
      // 1. Send to POST /api/chat
      const response = await api.sendChatMessage({
        message: messageText,
        conversationId: conversationId || undefined,
      });

      // 2. Authoritative state updates from chat response
      const updatedConvId = response.conversationId;
      if (updatedConvId && updatedConvId !== conversationId) {
        setConversationId(updatedConvId);
      }

      if (response.context) {
        setContext(response.context);
      }

      // Append assistant message
      const asstNextId = messageIdCounterRef.current++;
      const assistantMessageItem: ChatMessageItem = {
        id: response.messageId || `asst_msg_${asstNextId}`,
        role: "assistant",
        content: response.reply,
        extraction: response.extraction,
      };
      setMessages((prev) => [...prev, assistantMessageItem]);

      // If reply indicates recommendations were generated, fetch them for the recommendations cards
      const replyLower = response.reply.toLowerCase();
      if (
        replyLower.includes("recommendation") ||
        replyLower.includes("generated") ||
        (response.extraction?.newFieldsFound && response.extraction.newFieldsFound.length > 0)
      ) {
        // Fetch recommendations for updated context
        await fetchRecommendations(updatedConvId, response.context);
      }
    } catch (err: unknown) {
      console.error("Chat API error:", err);
      const msg =
        err instanceof ApiError
          ? `[${err.code}] ${err.message}`
          : "Failed to communicate with the chat endpoint";
      setErrorState({
        title: "Communication Failure",
        message: msg,
        retryAction: () => handleSendMessage(messageText),
      });
    } finally {
      setIsChatLoading(false);
    }
  };

  // --- Structured Form Submission Handler ---
  const handleStructuredSubmit = async (formData: AnalyzeInput) => {
    clearError();
    setIsFormLoading(true);

    try {
      // Send to POST /api/analyze
      const response = await api.submitStructuredAnalysis(formData);

      if (response.linkedConversationId && !conversationId) {
        setConversationId(response.linkedConversationId);
      }

      if (response.context) {
        setContext(response.context);
      }

      // Automatically fetch updated recommendations for the new context
      const targetConvId = response.linkedConversationId || conversationId || undefined;
      await fetchRecommendations(targetConvId, response.context);
    } catch (err: unknown) {
      console.error("Structured analysis error:", err);
      const msg =
        err instanceof ApiError
          ? `[${err.code}] ${err.message}`
          : "Failed to analyze structured inputs";
      setErrorState({
        title: "Analysis Error",
        message: msg,
        retryAction: () => handleStructuredSubmit(formData),
      });
      throw err;
    } finally {
      setIsFormLoading(false);
    }
  };

  // --- Open Reasoning Trace Drawer ---
  const handleOpenReasoningTrace = () => {
    setIsReasoningDrawerOpen(true);
    // Call /api/reasoning/evaluate only when opened or refreshed
    fetchReasoningTrace(conversationId || undefined, context || undefined);
  };

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Brand Identity */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-xs">
              <Leaf className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                  EcoIntel
                </h1>
                <Badge variant="mono" className="text-[10px] px-1.5 py-0 bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800">
                  Phase 11 Dashboard
                </Badge>
              </div>
              <p className="text-[11px] text-zinc-500 hidden sm:block">
                AI Biodiversity Intelligence & Deterministic Reasoning System
              </p>
            </div>
          </div>

          {/* Session Status & Quick Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {conversationId ? (
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[11px] font-mono text-zinc-600 dark:text-zinc-300">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Session: {conversationId.slice(-8)}</span>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-zinc-400">
                <span>New Session</span>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenReasoningTrace}
              className="text-xs h-8 gap-1.5 border-zinc-300 dark:border-zinc-700 cursor-pointer"
            >
              <GitBranch className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Reasoning Trace</span>
              {reasoningResult && reasoningResult.summary.pathwayCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                  {reasoningResult.summary.pathwayCount}
                </span>
              )}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetSession}
              title="Reset all session state"
              className="text-xs h-8 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              <span className="hidden sm:inline">Reset</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Global Recoverable Error Banner */}
      {errorState && (
        <div className="bg-red-50 dark:bg-red-950/70 border-b border-red-200 dark:border-red-900/80 px-4 py-2.5 text-xs text-red-900 dark:text-red-200">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
              <div>
                <span className="font-bold">{errorState.title}: </span>
                <span>{errorState.message}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {errorState.retryAction && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={errorState.retryAction}
                  className="h-7 px-2 text-xs border-red-300 text-red-800 dark:text-red-300 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/50"
                >
                  Retry
                </Button>
              )}
              <button
                type="button"
                onClick={clearError}
                className="text-red-600 hover:text-red-800 p-1 cursor-pointer"
                aria-label="Dismiss error"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Workspace (Section L Two-Panel Layout) */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-start">
        {/* LEFT PANEL (Chat & Structured Input Toggle) */}
        <section className="lg:col-span-5 h-[calc(100vh-6.5rem)] min-h-[580px] flex flex-col">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex flex-col h-full"
          >
            {/* Tab Selector */}
            <div className="flex items-center justify-between mb-2">
              <TabsList className="grid grid-cols-2 w-full max-w-[280px]">
                <TabsTrigger value="chat" className="gap-1.5 text-xs">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Scientific Chat</span>
                </TabsTrigger>
                <TabsTrigger value="form" className="gap-1.5 text-xs">
                  <ClipboardList className="w-3.5 h-3.5" />
                  <span>Structured Form</span>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Tab 1: Scientific Chat Stream */}
            <TabsContent value="chat" className="flex-1 mt-0 h-[calc(100%-2.75rem)]">
              <ChatPanel
                messages={messages}
                isLoading={isChatLoading}
                onSendMessage={handleSendMessage}
                conversationId={conversationId}
              />
            </TabsContent>

            {/* Tab 2: Structured Context Form */}
            <TabsContent value="form" className="flex-1 mt-0 h-[calc(100%-2.75rem)]">
              <StructuredInputForm
                onSubmit={handleStructuredSubmit}
                isLoading={isFormLoading}
                currentContext={context}
                conversationId={conversationId}
              />
            </TabsContent>
          </Tabs>
        </section>

        {/* RIGHT PANEL (Environmental Assessment & Recommendations) */}
        <section className="lg:col-span-7 h-[calc(100vh-6.5rem)] min-h-[580px] flex flex-col">
          <AssessmentPanel
            context={context}
            recommendations={recommendations}
            isLoadingRecs={isRecsLoading}
            onRefreshRecommendations={() =>
              fetchRecommendations(conversationId || undefined, context || undefined)
            }
            onOpenReasoningTrace={handleOpenReasoningTrace}
            reasoningPathwayCount={reasoningResult?.summary.pathwayCount}
          />
        </section>
      </main>

      {/* Collapsible Reasoning Trace Drawer */}
      <ReasoningTraceDrawer
        isOpen={isReasoningDrawerOpen}
        onClose={() => setIsReasoningDrawerOpen(false)}
        reasoningResult={reasoningResult}
        isLoading={isReasoningLoading}
        onRefresh={() =>
          fetchReasoningTrace(conversationId || undefined, context || undefined)
        }
      />
    </div>
  );
}
