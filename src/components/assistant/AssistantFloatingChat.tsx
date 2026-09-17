import React, { useState, useRef, useEffect, useCallback } from "react";
import Markdown from "react-markdown";
import { 
  Bot, 
  Sparkles, 
  Send, 
  RotateCcw, 
  X, 
  Loader2, 
  ChevronDown, 
  Clapperboard,
  Maximize2,
  Minimize2,
  AlertTriangle,
  Settings,
  ArrowRight,
  RefreshCw
} from "lucide-react";
import { SceneProjectFile, LLMProvider } from "../../types";
import { 
  sendAssistantChatMessage, 
  AssistantChatMessage 
} from "../../services/assistantClient";
import { probeLMStudioConnection } from "../config/lmStudioProbe";
import { probeGeminiConnection } from "../config/GeminiConfig";

interface AssistantFloatingChatProps {
  sceneProject: SceneProjectFile;
  activeShotId?: string;
  activeSection: string;
  lmStudioUrl?: string;
  llmProvider?: string;
  defaultLlmProvider?: LLMProvider;
  geminiApiKey?: string;
  onNavigateToConfig?: (tab?: "llm" | "remote" | "models" | "general") => void;
}

export const AssistantFloatingChat: React.FC<AssistantFloatingChatProps> = ({
  sceneProject,
  activeShotId,
  activeSection,
  lmStudioUrl,
  llmProvider,
  defaultLlmProvider = "lm_studio",
  geminiApiKey,
  onNavigateToConfig
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputQuery, setInputQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Connection check state for the default LLM
  const [isDefaultLlmConnected, setIsDefaultLlmConnected] = useState<boolean | null>(null);
  const [isCheckingConnection, setIsCheckingConnection] = useState<boolean>(false);
  const [connectionDetails, setConnectionDetails] = useState<string>("");

  const effectiveDefault: LLMProvider = (defaultLlmProvider as LLMProvider) || "lm_studio";

  // Check connection to the configured default LLM provider
  const checkLlmConnection = useCallback(async () => {
    setIsCheckingConnection(true);
    try {
      if (effectiveDefault === "gemini") {
        const result = await probeGeminiConnection(geminiApiKey || "");
        setIsDefaultLlmConnected(result.success);
        setConnectionDetails(result.message || (result.success ? "Gemini connected" : "Invalid API key or unreachable"));
      } else {
        const result = await probeLMStudioConnection(lmStudioUrl);
        setIsDefaultLlmConnected(result.success);
        setConnectionDetails(result.message || (result.success ? "LM Studio connected" : "Server not running or unreachable"));
      }
    } catch (err: any) {
      setIsDefaultLlmConnected(false);
      setConnectionDetails(err.message || "Failed to reach LLM endpoint");
    } finally {
      setIsCheckingConnection(false);
    }
  }, [effectiveDefault, geminiApiKey, lmStudioUrl]);

  // Check connection whenever window is opened or provider configuration changes
  useEffect(() => {
    if (isOpen) {
      checkLlmConnection();
    }
  }, [isOpen, checkLlmConnection]);

  const initialWelcome = `Hello! I am your **Production Assistant & Script Supervisor**.

I have full visibility into:
- **Active Scene:** "${sceneProject.scene_name || 'Untitled'}" (${sceneProject.shots?.length || 0} shots)
- **Scene Planning:** Visual theme, lighting, and gear notes
- **Characters & Roster:** Scene cast, wardrobe notes, and universe lore

How can I assist your shoot today?`;

  const [messages, setMessages] = useState<AssistantChatMessage[]>([
    { role: "assistant", content: initialWelcome }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll chat to latest message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Focus input when opened if connected
  useEffect(() => {
    if (isOpen && isDefaultLlmConnected !== false) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, isDefaultLlmConnected]);

  const activeShot = sceneProject.shots?.find(s => s.id === activeShotId) || sceneProject.shots?.[0];

  const quickPrompts = [
    activeShot ? `What lens should Shot #${activeShot.shot_number} use?` : "Suggest a good opening shot",
    "Check continuity across all shots",
    "Who is in this scene and what are they wearing?",
    "Suggest the next dramatic shot",
    "How can I polish the prompt for this shot?"
  ];

  const handleSendMessage = async (queryToSend?: string) => {
    const text = (queryToSend ?? inputQuery).trim();
    if (!text || isLoading) return;

    setErrorMessage(null);
    setInputQuery("");

    const newMessages: AssistantChatMessage[] = [
      ...messages,
      { role: "user", content: text }
    ];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await sendAssistantChatMessage({
        messages: newMessages,
        scene_project: sceneProject,
        active_shot_id: activeShotId,
        active_section: activeSection,
        lm_studio_url: lmStudioUrl,
        provider: llmProvider || defaultLlmProvider
      });

      setMessages([
        ...newMessages,
        { role: "assistant", content: response.reply }
      ]);
      // If it succeeded, connection is working
      setIsDefaultLlmConnected(true);
    } catch (err: any) {
      console.error("[Assistant Chat] Error:", err);
      const errMsg = err.message || "Failed to reach the assistant service.";
      setErrorMessage(errMsg);
      // If the error indicates failure to connect to LLM, mark as disconnected
      if (
        errMsg.toLowerCase().includes("fetch failed") || 
        errMsg.toLowerCase().includes("refused") || 
        errMsg.toLowerCase().includes("unreachable") ||
        errMsg.toLowerCase().includes("not configured")
      ) {
        setIsDefaultLlmConnected(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleResetChat = () => {
    setMessages([{ role: "assistant", content: initialWelcome }]);
    setErrorMessage(null);
  };

  const handleGoToLlmSettings = () => {
    if (onNavigateToConfig) {
      onNavigateToConfig("llm");
    }
  };

  const providerDisplayName = effectiveDefault === "gemini" ? "Google Gemini" : "LM Studio";

  return (
    <>
      {/* 1. Floating Launch Trigger Button (Lower Right) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-medium shadow-xl hover:shadow-indigo-500/25 border border-indigo-400/40 dark:border-indigo-400/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0 group cursor-pointer"
          aria-label="Open Production Assistant"
          title="Open AI Production Assistant"
        >
          <div className="relative">
            <Bot className="w-5 h-5 text-white" />
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isDefaultLlmConnected === false ? "bg-amber-500" : "bg-emerald-400"
              }`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                isDefaultLlmConnected === false ? "bg-amber-500" : "bg-emerald-400"
              }`}></span>
            </span>
          </div>
          <span className="text-sm font-semibold tracking-wide">Assistant</span>
          <Sparkles className="w-3.5 h-3.5 text-amber-300 group-hover:rotate-12 transition-transform" />
        </button>
      )}

      {/* 2. Expanded Floating Chat Window */}
      {isOpen && (
        <div 
          className={`fixed z-50 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-slate-200 dark:border-zinc-700/80 rounded-2xl shadow-2xl flex flex-col transition-all duration-200 overflow-hidden text-slate-900 dark:text-zinc-100 ${
            isExpanded
              ? "bottom-4 right-4 w-[600px] max-w-[calc(100vw-32px)] h-[820px] max-h-[calc(100vh-32px)]"
              : "bottom-6 right-6 w-[430px] max-w-[calc(100vw-32px)] h-[580px] max-h-[calc(100vh-80px)]"
          }`}
        >
          {/* Header */}
          <div className="px-4 py-3 bg-slate-50/90 dark:bg-zinc-950/80 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600 dark:bg-indigo-600/20 dark:border-indigo-500/30 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-xs">
                <Bot className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 truncate">Production Assistant</h3>
                  
                  {isDefaultLlmConnected === false ? (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/80 shrink-0 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                      Offline
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700 shrink-0 font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      Live
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                  <span className="truncate">Scene: <strong className="text-slate-800 dark:text-zinc-200 font-semibold">{sceneProject.scene_name || "Untitled"}</strong></span>
                  {activeShot && (
                    <span className="text-indigo-600 dark:text-indigo-400 shrink-0 font-medium">
                      • Shot #{activeShot.shot_number}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Window Controls */}
            <div className="flex items-center gap-1 shrink-0 text-slate-500 dark:text-zinc-400">
              <button
                onClick={checkLlmConnection}
                disabled={isCheckingConnection}
                className="p-1.5 rounded-lg hover:bg-slate-200/80 hover:text-slate-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors cursor-pointer disabled:opacity-50"
                title="Recheck LLM connection"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isCheckingConnection ? "animate-spin text-indigo-500" : ""}`} />
              </button>
              <button
                onClick={handleResetChat}
                className="p-1.5 rounded-lg hover:bg-slate-200/80 hover:text-slate-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                title="Reset conversation"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 rounded-lg hover:bg-slate-200/80 hover:text-slate-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors hidden sm:block cursor-pointer"
                title={isExpanded ? "Collapse size" : "Expand size"}
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-200/80 hover:text-slate-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                title="Minimize assistant"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Offline Warning Banner with Action Button */}
          {isDefaultLlmConnected === false && (
            <div className="p-3 bg-amber-50/95 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/60 flex items-start gap-2.5 shrink-0 transition-all">
              <div className="p-1 rounded-md bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                  Default LLM ({providerDisplayName}) is Not Connected
                </div>
                <p className="text-[11px] text-amber-800/90 dark:text-amber-300/80 mt-0.5 leading-relaxed">
                  {effectiveDefault === "gemini" 
                    ? "Your Gemini API key is missing or unauthorized. Add or test your key in settings."
                    : `Could not reach LM Studio at ${lmStudioUrl || "http://localhost:1234/v1"}. Ensure local server is started with CORS enabled.`}
                </p>
                
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={handleGoToLlmSettings}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Open LLM Settings</span>
                    <ArrowRight className="w-3 h-3 ml-0.5" />
                  </button>

                  <button
                    onClick={checkLlmConnection}
                    disabled={isCheckingConnection}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-800 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200 hover:bg-amber-100/50 dark:hover:bg-zinc-700 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isCheckingConnection ? "animate-spin" : ""}`} />
                    <span>Retry</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Quick Starter Chips */}
          <div className="px-3 py-2 bg-slate-100/70 dark:bg-zinc-950/40 border-b border-slate-200/80 dark:border-zinc-800/60 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            {quickPrompts.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(chip)}
                disabled={isLoading || isDefaultLlmConnected === false}
                className="whitespace-nowrap px-2.5 py-1 rounded-full bg-white hover:bg-indigo-50 border border-slate-300/80 hover:border-indigo-300 text-[11px] font-medium text-slate-700 hover:text-indigo-700 shadow-2xs dark:bg-zinc-800/80 dark:hover:bg-indigo-950/50 dark:hover:border-indigo-500/40 dark:border-zinc-700/60 dark:text-zinc-300 dark:hover:text-indigo-200 dark:shadow-none transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-sm min-h-0 bg-slate-50/40 dark:bg-transparent">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-indigo-600 shadow-2xs dark:bg-zinc-800 dark:border-zinc-700 dark:text-indigo-400 dark:shadow-none flex items-center justify-center shrink-0 mt-0.5">
                    <Clapperboard className="w-3.5 h-3.5" />
                  </div>
                )}
                
                <div
                  className={`rounded-2xl px-3.5 py-2.5 max-w-[85%] leading-relaxed ${
                    msg.role === "user"
                      ? "bg-indigo-600 text-white rounded-tr-xs shadow-xs"
                      : "bg-white text-slate-800 border border-slate-200/90 rounded-tl-xs shadow-xs dark:bg-zinc-800/90 dark:text-zinc-200 dark:border-zinc-700/70"
                  }`}
                >
                  {msg.role === "user" ? (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  ) : (
                    <div className="markdown-body prose prose-slate dark:prose-invert prose-sm max-w-none text-xs sm:text-sm space-y-2 text-slate-800 dark:text-zinc-200">
                      <Markdown>{msg.content}</Markdown>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Thinking / Loading State */}
            {isLoading && (
              <div className="flex gap-2.5 justify-start">
                <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-indigo-600 shadow-2xs dark:bg-zinc-800 dark:border-zinc-700 dark:text-indigo-400 dark:shadow-none flex items-center justify-center shrink-0">
                  <Clapperboard className="w-3.5 h-3.5 animate-pulse" />
                </div>
                <div className="rounded-2xl rounded-tl-xs px-3.5 py-2.5 bg-white border border-slate-200 text-slate-600 dark:bg-zinc-800/90 dark:border-zinc-700/70 dark:text-zinc-400 flex items-center gap-2 text-xs shadow-xs">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600 dark:text-indigo-400" />
                  <span>Consulting project dossier...</span>
                </div>
              </div>
            )}

            {/* Error Message Notice */}
            {errorMessage && (
              <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-800/60 dark:text-red-300 text-xs flex items-center justify-between shadow-2xs">
                <span>{errorMessage}</span>
                <button
                  onClick={() => setErrorMessage(null)}
                  className="text-red-500 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200 ml-2"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input & Footer Controls */}
          <div className="p-3 bg-white/95 dark:bg-zinc-950/90 border-t border-slate-200 dark:border-zinc-800 shrink-0 space-y-2">
            <div className="relative flex items-center">
              <textarea
                ref={inputRef}
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isDefaultLlmConnected === false
                    ? `${providerDisplayName} disconnected. Open LLM settings to connect...`
                    : "Ask about shots, characters, continuity, lenses..."
                }
                rows={1}
                disabled={isLoading}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 pr-10 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 resize-none max-h-24 min-h-[42px] dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:bg-zinc-900"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputQuery.trim() || isLoading}
                className="absolute right-2 p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:hover:bg-indigo-600 transition-colors cursor-pointer shadow-xs"
                title="Send query (Enter)"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-zinc-500 px-1">
              <span>Enter to send, Shift+Enter for newline</span>
              <span className="truncate">Default: {providerDisplayName}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
