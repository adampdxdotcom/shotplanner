import React, { useState, useEffect, useRef, useCallback } from "react";
import { SceneProjectFile, LLMProvider } from "../../types";
import { sendAssistantChatMessage, AssistantChatMessage } from "../../services/assistantClient";
import { probeLMStudioConnection } from "../config/lmStudioProbe";
import { probeGeminiConnection } from "../config/GeminiConfig";

export interface UseAssistantChatParams {
  sceneProject: SceneProjectFile;
  activeShotId?: string;
  activeSection: string;
  lmStudioUrl?: string;
  effectiveDefault: LLMProvider;
  geminiApiKey?: string;
  isOpen: boolean;
}

/**
 * Custom hook managing assistant chat conversation history,
 * query submission, auto-scrolling, and connection probing.
 */
export function useAssistantChat({
  sceneProject,
  activeShotId,
  activeSection,
  lmStudioUrl,
  effectiveDefault,
  geminiApiKey,
  isOpen
}: UseAssistantChatParams) {
  const [inputQuery, setInputQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isDefaultLlmConnected, setIsDefaultLlmConnected] = useState<boolean | null>(null);
  const [isCheckingConnection, setIsCheckingConnection] = useState<boolean>(false);

  const initialWelcome = `Hello! I am your AI Production Assistant. I have full context of **${
    sceneProject?.scene_name || "your active scene"
  }**, including all **${sceneProject?.shots?.length || 0} shots**, world planning, cast profiles, and assets.\n\nAsk me for cinematography recommendations, scene lore, lighting setups, dialogue tweaks, or to stage assets and trigger prompt expansions.`;

  const [messages, setMessages] = useState<AssistantChatMessage[]>([
    {
      role: "assistant",
      content: initialWelcome
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Update initial welcome message if scene context shifts
  useEffect(() => {
    if (messages.length === 1 && messages[0].role === "assistant") {
      setMessages([{ role: "assistant", content: initialWelcome }]);
    }
  }, [sceneProject?.scene_name, sceneProject?.shots?.length]);

  // Connection probe checking endpoint reachability
  const checkConnection = useCallback(async () => {
    setIsCheckingConnection(true);
    try {
      if (effectiveDefault === "gemini") {
        const res = await probeGeminiConnection(geminiApiKey);
        setIsDefaultLlmConnected(res.success);
      } else {
        const url = lmStudioUrl || "http://127.0.0.1:1234";
        const res = await probeLMStudioConnection(url);
        setIsDefaultLlmConnected(res.success);
      }
    } catch {
      setIsDefaultLlmConnected(false);
    } finally {
      setIsCheckingConnection(false);
    }
  }, [effectiveDefault, geminiApiKey, lmStudioUrl]);

  useEffect(() => {
    if (isOpen) {
      checkConnection();
    }
  }, [isOpen, checkConnection]);

  // Auto-scroll when messages or loading states change
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isLoading]);

  // Focus textarea when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const handleSendMessage = async () => {
    const trimmed = inputQuery.trim();
    if (!trimmed || isLoading) return;

    setErrorMessage(null);
    const newMessages: AssistantChatMessage[] = [
      ...messages,
      { role: "user", content: trimmed }
    ];

    setMessages(newMessages);
    setInputQuery("");
    setIsLoading(true);

    try {
      const response = await sendAssistantChatMessage({
        messages: newMessages,
        scene_project: sceneProject,
        active_shot_id: activeShotId,
        active_section: activeSection,
        provider: effectiveDefault,
        lm_studio_url: lmStudioUrl
      });

      if (response && response.reply) {
        setMessages([
          ...newMessages,
          { role: "assistant", content: response.reply }
        ]);
        setIsDefaultLlmConnected(true);
      } else {
        throw new Error("Received empty response from assistant.");
      }
    } catch (err: any) {
      console.error("[AssistantFloatingChat] Error chatting with assistant:", err);
      const errText = err.message || "Failed to communicate with LLM provider.";
      setErrorMessage(errText);
      setIsDefaultLlmConnected(false);
      
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: `⚠️ **Connection Error**: ${errText}\n\nPlease verify that your **${
            effectiveDefault === "gemini" ? "Google Gemini API Key" : "LM Studio instance"
          }** is running and configured correctly in the settings.`
        }
      ]);
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

  const injectStateFeedback = useCallback((feedbackText: string) => {
    setMessages((prev) => [
      ...prev,
      {
        role: "system",
        content: `[System: ${feedbackText}]`
      }
    ]);
  }, []);

  return {
    inputQuery,
    setInputQuery,
    isLoading,
    errorMessage,
    messages,
    messagesEndRef,
    inputRef,
    isDefaultLlmConnected,
    isCheckingConnection,
    checkConnection,
    handleSendMessage,
    handleKeyDown,
    handleResetChat,
    injectStateFeedback
  };
}
