"use client";

import React from "react";
import { MessageList, ChatMessageItem } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { MessageSquare } from "lucide-react";

interface ChatPanelProps {
  messages: ChatMessageItem[];
  isLoading: boolean;
  onSendMessage: (message: string) => Promise<void>;
  conversationId?: string | null;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  isLoading,
  onSendMessage,
  conversationId,
}) => {
  return (
    <div className="flex flex-col h-full bg-zinc-50/50 dark:bg-zinc-950/40 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xs">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
            Conversational Stream
          </span>
        </div>
        {conversationId && (
          <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 truncate max-w-[150px]">
            ID: {conversationId.slice(-8)}
          </span>
        )}
      </div>

      {/* Message List */}
      <MessageList messages={messages} isLoading={isLoading} />

      {/* Chat Input */}
      <ChatInput onSendMessage={onSendMessage} disabled={isLoading} />
    </div>
  );
};
