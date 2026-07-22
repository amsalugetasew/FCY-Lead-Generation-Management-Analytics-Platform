"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Edit3, MessageSquarePlus, PanelLeftClose, PanelLeftOpen, RotateCcw, Send, Square, Trash2 } from "lucide-react";

function formatChatText(text: string) {
  return text
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/^\s*###\s+/gm, "")
    .replace(/^\s*####\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\n{3,}/g, "\n\n");
}

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
};

type ChatSession = {
  id: string;
  title: string;
  scope: string;
  userId?: number;
  messages: ChatMessage[];
  updatedAt: string;
};

const STORAGE_PREFIX = "fcy_ai_chat_sessions";

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function previewTitle(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return "New chat";
  return trimmed.length > 40 ? `${trimmed.slice(0, 37)}...` : trimmed;
}

export default function AIChatModal({
  open,
  title,
  scope,
  user,
  context,
  onClose,
}: {
  open: boolean;
  title: string;
  scope: string;
  user: any;
  context?: Record<string, any>;
  onClose: () => void;
}) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const activeSession = useMemo(() => {
    return sessions.find((session) => session.id === activeSessionId) || null;
  }, [activeSessionId, sessions]);

  useEffect(() => {
    if (!open) return;
    const userId = user?.id ?? "guest";
    try {
      const saved = localStorage.getItem(`${STORAGE_PREFIX}_${userId}`);
      if (saved) {
        const parsed = JSON.parse(saved) as ChatSession[];
        const filtered = parsed.filter((session) => session.scope === scope);
        setSessions(filtered);
        if (filtered.length) {
          setActiveSessionId(filtered[0].id);
        } else {
          const newSession: ChatSession = {
            id: makeId(),
            title: "New chat",
            scope,
            userId,
            messages: [],
            updatedAt: new Date().toISOString(),
          };
          setSessions([newSession]);
          setActiveSessionId(newSession.id);
        }
      } else {
        const newSession: ChatSession = {
          id: makeId(),
          title: "New chat",
          scope,
          userId,
          messages: [],
          updatedAt: new Date().toISOString(),
        };
        setSessions([newSession]);
        setActiveSessionId(newSession.id);
      }
    } catch (error) {
      console.error("Unable to load chat sessions", error);
    }
  }, [open, scope, user?.id]);

  useEffect(() => {
    if (!open) return;
    const userId = user?.id ?? "guest";
    localStorage.setItem(`${STORAGE_PREFIX}_${userId}`, JSON.stringify(sessions));
  }, [open, sessions, user?.id]);

  const persistSessions = (nextSessions: ChatSession[]) => {
    setSessions(nextSessions);
    const userId = user?.id ?? "guest";
    localStorage.setItem(`${STORAGE_PREFIX}_${userId}`, JSON.stringify(nextSessions));
  };

  const createSession = () => {
    const newSession: ChatSession = {
      id: makeId(),
      title: "New chat",
      scope,
      userId: user?.id,
      messages: [],
      updatedAt: new Date().toISOString(),
    };
    const nextSessions = [newSession, ...sessions];
    persistSessions(nextSessions);
    setActiveSessionId(newSession.id);
    setDraft("");
  };

  const updateActiveSession = (updater: (session: ChatSession) => ChatSession) => {
    if (!activeSessionId) return;
    const nextSessions = sessions.map((session) => (session.id === activeSessionId ? updater(session) : session));
    persistSessions(nextSessions);
  };

  const appendMessage = (role: ChatRole, content: string) => {
    if (!activeSessionId) return;
    updateActiveSession((session) => ({
      ...session,
      messages: [
        ...session.messages,
        {
          id: makeId(),
          role,
          content,
          createdAt: new Date().toISOString(),
        },
      ],
      updatedAt: new Date().toISOString(),
    }));
  };

  const replaceLastUserMessage = (content: string) => {
    if (!activeSessionId) return;
    const nextSessions = sessions.map((session) => {
      if (session.id !== activeSessionId) return session;
      const nextMessages = [...session.messages];
      const lastUserIndex = nextMessages.map((msg) => msg.role).lastIndexOf("user");
      if (lastUserIndex >= 0) {
        nextMessages[lastUserIndex] = {
          ...nextMessages[lastUserIndex],
          content,
          createdAt: new Date().toISOString(),
        };
      }
      return {
        ...session,
        messages: nextMessages,
        title: previewTitle(content),
        updatedAt: new Date().toISOString(),
      };
    });
    persistSessions(nextSessions);
  };

  const sendMessage = async (messageOverride?: string, regenerate = false) => {
    const content = (messageOverride ?? draft).trim();
    if (!content || !activeSessionId) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsLoading(true);

    const currentSession = sessions.find((session) => session.id === activeSessionId);
    const historyMessages = currentSession?.messages ?? [];
    const userMessage = { role: "user", content } as const;

    const nextMessages = [...historyMessages, { id: makeId(), role: "user" as ChatRole, content, createdAt: new Date().toISOString() }];
    const nextSessions = sessions.map((session) => {
      if (session.id !== activeSessionId) return session;
      return {
        ...session,
        title: previewTitle(content),
        messages: nextMessages,
        updatedAt: new Date().toISOString(),
      };
    });
    persistSessions(nextSessions);
    setDraft("");

    try {
      const token = sessionStorage.getItem("fcy_token");
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scope,
          message: content,
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
          context: context || {},
          use_graq: true,
        }),
        signal: controller.signal,
      });

      const data = await res.json().catch(() => ({}));
      const result = data?.result || data?.message || data?.content || "I could not generate a response.";

      const nextSessionMessages = [
        ...nextMessages,
        { id: makeId(), role: "assistant" as ChatRole, content: result, createdAt: new Date().toISOString() },
      ];

      const updatedSessions = sessions.map((session) => {
        if (session.id !== activeSessionId) return session;
        return {
          ...session,
          messages: nextSessionMessages,
          updatedAt: new Date().toISOString(),
        };
      });
      persistSessions(updatedSessions);
    } catch (error: any) {
      if (error?.name === "AbortError") {
        return;
      }
      const fallback = error?.message || "The assistant could not respond right now.";
      const updatedSessions = sessions.map((session) => {
        if (session.id !== activeSessionId) return session;
        return {
          ...session,
          messages: [
            ...session.messages,
            {
              id: makeId(),
              role: "assistant" as ChatRole,
              content: fallback,
              createdAt: new Date().toISOString(),
            },
          ],
          updatedAt: new Date().toISOString(),
        };
      });
      persistSessions(updatedSessions);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsLoading(false);
    abortControllerRef.current = null;
  };

  const deleteSession = (sessionId: string) => {
    if (!sessions.length) return;
    const nextSessions = sessions.filter((session) => session.id !== sessionId);
    if (!nextSessions.length) {
      const newSession: ChatSession = {
        id: makeId(),
        title: "New chat",
        scope,
        userId: user?.id,
        messages: [],
        updatedAt: new Date().toISOString(),
      };
      persistSessions([newSession]);
      setActiveSessionId(newSession.id);
      return;
    }
    persistSessions(nextSessions);
    if (activeSessionId === sessionId) {
      setActiveSessionId(nextSessions[0].id);
    }
  };

  const regenerateLast = () => {
    if (!activeSession) return;
    const lastUser = [...activeSession.messages].reverse().find((message) => message.role === "user");
    if (lastUser) {
      sendMessage(lastUser.content, true);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
      <div className="flex h-[90vh] w-full max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {isSidebarOpen && (
          <aside className="flex w-72 flex-col border-r border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Chat history</p>
                <p className="text-xs text-slate-500">User and context aware</p>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="rounded p-1 text-slate-500 hover:bg-slate-200">
                <PanelLeftClose size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-3">
              <button onClick={createSession} className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100">
                <MessageSquarePlus size={16} />
                New chat
              </button>
              {sessions.map((session) => (
                <div key={session.id} className={`mb-2 rounded-xl border p-2 ${activeSession?.id === session.id ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <button onClick={() => setActiveSessionId(session.id)} className="flex-1 text-left">
                      <p className="truncate text-sm font-semibold text-slate-800">{session.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{session.scope}</p>
                    </button>
                    <button onClick={() => deleteSession(session.id)} className="rounded p-1 text-slate-500 hover:bg-slate-200">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        )}

        <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div className="flex items-center gap-2">
              {!isSidebarOpen && (
                <button onClick={() => setIsSidebarOpen(true)} className="rounded p-1 text-slate-500 hover:bg-slate-200">
                  <PanelLeftOpen size={16} />
                </button>
              )}
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
                <p className="text-xs text-slate-500">{scope}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-sm font-medium text-slate-600 hover:text-slate-900">
              Close
            </button>
          </div>

          <div className="flex-1 overflow-y-auto bg-slate-50 p-4">
            {!activeSession?.messages.length ? (
              <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center text-center">
                <div className="mb-3 rounded-full bg-blue-100 p-3 text-blue-700">
                  <Bot size={24} />
                </div>
                <h4 className="text-lg font-semibold text-slate-900">Ask about this view</h4>
                <p className="mt-2 text-sm text-slate-600">Get insights, recommendations, or follow-up explanations grounded in the selected analytics context.</p>
              </div>
            ) : (
              <div className="mx-auto flex max-w-3xl flex-col gap-3">
                {activeSession.messages.map((message) => (
                  <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${message.role === "user" ? "bg-blue-600 text-white" : "bg-white text-slate-700 shadow-sm"}`}>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{message.role === "user" ? "You" : "Assistant"}</span>
                        {message.role === "user" && (
                          <button onClick={() => setDraft(message.content)} className="rounded p-1 text-xs opacity-80 hover:bg-white/20">
                            <Edit3 size={13} />
                          </button>
                        )}
                      </div>
                      <div className="whitespace-pre-wrap text-sm leading-7">{formatChatText(message.content)}</div>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">Thinking...</div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 bg-white p-3">
            <div className="mx-auto flex max-w-3xl flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={regenerateLast} disabled={!activeSession?.messages.length || isLoading} className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">
                  <span className="flex items-center gap-1"><RotateCcw size={14} /> Regenerate</span>
                </button>
                {isLoading ? (
                  <button onClick={stopGeneration} className="rounded-full border border-rose-200 px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-50">
                    <span className="flex items-center gap-1"><Square size={14} /> Stop</span>
                  </button>
                ) : null}
              </div>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Ask a follow-up question..."
                rows={3}
                className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-slate-500">Your prompts and replies are stored per user and context for easy follow-up.</p>
                <button onClick={() => sendMessage()} disabled={!draft.trim() || isLoading} className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300">
                  <Send size={16} />
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
