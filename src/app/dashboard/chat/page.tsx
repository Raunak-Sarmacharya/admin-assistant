"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useApiKey } from "@/hooks/use-api-key";
import { toast } from "sonner";
import {
  Send,
  Loader2,
  MessageSquare,
  Bot,
  User,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED_QUESTIONS = [
  "What is the total AUM across all clients?",
  "Which clients have a Conservative risk profile?",
  "What are the pending tasks for this week?",
  "Summarize the most recent meetings.",
  "Which client has the highest AUM?",
];

export default function ChatPage() {
  const { apiKey, model, isKeySet, isLoaded } = useApiKey();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Keep ref in sync so streaming closures always have latest
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  async function handleSend(overrideInput?: string) {
    const text = (overrideInput || input).trim();
    if (!text || isStreaming) return;
    if (!isKeySet) {
      toast.error("Please configure your API key in Settings");
      return;
    }

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };

    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
    };

    const updatedMessages = [...messagesRef.current, userMsg, assistantMsg];
    messagesRef.current = updatedMessages;
    setMessages(updatedMessages);
    setInput("");
    setIsStreaming(true);

    try {
      const aiMessages = [...messagesRef.current]
        .filter((m) => m.content)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, messages: aiMessages, model }),
      });

      if (!res.ok) {
        const errData = await res.json();
        if (errData.isQuota) {
          toast.error(errData.error, {
            description: "Try a different model in Settings.",
            duration: 8000,
          });
          updateAssistantMessage(assistantMsg.id, "⚠️ " + errData.error);
          return;
        }
        throw new Error(errData.error || "Chat request failed");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;

        // Detect mid-stream errors from the server
        const errorIdx = accumulated.indexOf("[STREAM_ERROR]");
        if (errorIdx !== -1) {
          const errorMsg = accumulated.slice(errorIdx + "[STREAM_ERROR]".length).trim();
          const cleanContent = accumulated.slice(0, errorIdx).trim();
          toast.error(errorMsg || "AI request failed", {
            description: "Try a different model in Settings.",
            duration: 8000,
          });
          updateAssistantMessage(
            assistantMsg.id,
            cleanContent || "⚠️ " + (errorMsg || "Request failed.")
          );
          break;
        }

        updateAssistantMessage(assistantMsg.id, accumulated);
      }

      // Final update with complete content
      if (accumulated && !accumulated.includes("[STREAM_ERROR]")) {
        updateAssistantMessage(assistantMsg.id, accumulated);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Chat failed"
      );
      updateAssistantMessage(
        assistantMsg.id,
        "Sorry, an error occurred. Please try again."
      );
    } finally {
      setIsStreaming(false);
    }
  }

  function updateAssistantMessage(id: string, content: string) {
    const updated = messagesRef.current.map((m) =>
      m.id === id ? { ...m, content } : m
    );
    messagesRef.current = updated;
    setMessages([...updated]);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (!isLoaded) return null;

  return (
    <div className="mx-auto max-w-4xl h-[calc(100vh-8rem)] flex flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">AI Chat</h1>
        <p className="text-sm text-muted-foreground">
          Ask questions about your clients, meetings, and tasks.
        </p>
      </div>

      {!isKeySet && (
        <div className="flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 p-4 mb-4 dark:border-orange-900/50 dark:bg-orange-950/20">
          <ShieldAlert className="size-5 text-orange-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-orange-800 dark:text-orange-300">
              API Key Required
            </p>
            <p className="text-xs text-orange-700 dark:text-orange-400">
              Configure your API key to use the chat.
            </p>
          </div>
          <Link href="/dashboard/settings">
            <Button variant="outline" size="sm">Configure</Button>
          </Link>
        </div>
      )}

      <Card className="flex-1 flex flex-col min-h-0">
        <CardContent className="flex-1 flex flex-col p-0 min-h-0">
          <div className="flex-1 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-6">
                <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
                  <Sparkles className="size-7 text-primary" />
                </div>
                <div className="text-center space-y-1.5">
                  <h3 className="font-semibold">Ask anything about your clients</h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    I have access to your client book, meeting history, and
                    pending tasks. Try a question below.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                  {SUGGESTED_QUESTIONS.map((q, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      className="text-xs h-auto py-1.5 px-3"
                      onClick={() => handleSend(q)}
                      disabled={!isKeySet}
                    >
                      {q}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {msg.role === "assistant" && (
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-0.5">
                        <Bot className="size-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={`rounded-lg px-3.5 py-2.5 text-sm max-w-[80%] ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      {msg.content ? (
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      ) : (
                        <Loader2 className="size-4 animate-spin" />
                      )}
                    </div>
                    {msg.role === "user" && (
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted mt-0.5">
                        <User className="size-4" />
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <div className="border-t p-4">
            <div className="flex items-end gap-2">
              <Textarea
                ref={textareaRef}
                placeholder="Ask about your clients, meetings, or tasks..."
                className="min-h-[44px] max-h-[120px] resize-none"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={!isKeySet || isStreaming}
                rows={1}
              />
              <Button
                size="icon"
                className="shrink-0 size-[44px]"
                onClick={() => handleSend()}
                disabled={!isKeySet || isStreaming || !input.trim()}
              >
                {isStreaming ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </Button>
            </div>
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="size-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">
                  {messages.filter((m) => m.role === "user").length} messages
                </span>
              </div>
              <Badge variant="outline" className="text-[10px]">
                BYOK — Your key, your costs
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
