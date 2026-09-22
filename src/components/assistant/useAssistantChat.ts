import React, { useState, useEffect, useRef, useCallback } from "react";
import { SceneProjectFile, LLMProvider, MediaAsset } from "../../types";
import { sendAssistantChatMessage, AssistantChatMessage } from "../../services/assistantClient";
import { probeLMStudioConnection } from "../config/lmStudioProbe";
import { probeGeminiConnection } from "../config/GeminiConfig";
import {
  getStoredAssistantChat,
  saveStoredAssistantChat,
  clearStoredAssistantChat,
  createInitialAssistantMessage,
  getRollingChatWindow
} from "../../utils/assistantChatStore";

export interface UseAssistantChatParams {
  sceneProject: SceneProjectFile;
  activeShotId?: string;
  activeSection: string;
  lmStudioUrl?: string;
  effectiveDefault: LLMProvider;
  geminiApiKey?: string;
  isOpen: boolean;
  onUpdateProject?: React.Dispatch<React.SetStateAction<SceneProjectFile>>;
  onShowToast?: (text: string, type?: "success" | "error" | "info") => void;
}

/**
 * Custom hook managing assistant chat conversation history,
 * per-scene persistence, query submission, auto-scrolling, and connection probing.
 */
export function useAssistantChat({
  sceneProject,
  activeShotId,
  activeSection,
  lmStudioUrl,
  effectiveDefault,
  geminiApiKey,
  isOpen,
  onUpdateProject,
  onShowToast
}: UseAssistantChatParams) {
  const [inputQuery, setInputQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [stagedAsset, setStagedAsset] = useState<MediaAsset | null>(null);
  const [isMediaBrowserOpen, setIsMediaBrowserOpen] = useState(false);

  const [isDefaultLlmConnected, setIsDefaultLlmConnected] = useState<boolean | null>(null);
  const [isCheckingConnection, setIsCheckingConnection] = useState<boolean>(false);

  // Initialize chat messages from per-scene stored history
  const [messages, setMessages] = useState<AssistantChatMessage[]>(() =>
    getStoredAssistantChat(sceneProject?.scene_id, sceneProject)
  );

  const prevSceneIdRef = useRef<string | undefined>(sceneProject?.scene_id);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Automatic Scene Switch Awareness:
  // When active scene changes, switch to that scene's saved conversation history
  useEffect(() => {
    const currentSceneId = sceneProject?.scene_id;
    if (currentSceneId && currentSceneId !== prevSceneIdRef.current) {
      prevSceneIdRef.current = currentSceneId;
      const sceneChat = getStoredAssistantChat(currentSceneId, sceneProject);
      setMessages(sceneChat);
      setErrorMessage(null);
      setStagedAsset(null);
    }
  }, [sceneProject?.scene_id, sceneProject]);

  // Synchronize greeting if project starts fresh without messages
  useEffect(() => {
    if (messages.length === 1 && messages[0].role === "assistant") {
      const refreshedGreeting = createInitialAssistantMessage(sceneProject);
      if (messages[0].content !== refreshedGreeting.content) {
        setMessages([refreshedGreeting]);
      }
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

  const persistMessages = useCallback(
    (newMessages: AssistantChatMessage[]) => {
      if (sceneProject?.scene_id) {
        saveStoredAssistantChat(sceneProject.scene_id, newMessages);
      }
      onUpdateProject?.((prev) => ({
        ...prev,
        assistant_chat_history: newMessages,
        updated_at: new Date().toISOString()
      }));
    },
    [sceneProject?.scene_id, onUpdateProject]
  );

  const handleSelectAsset = (asset: MediaAsset) => {
    setStagedAsset(asset);
    onShowToast?.(`Selected ${asset.subject_name || asset.filename} for Vision analysis.`, "info");
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleClearStagedAsset = () => {
    setStagedAsset(null);
  };

  const handleSendMessage = async () => {
    const rawTrimmed = inputQuery.trim();
    if ((!rawTrimmed && !stagedAsset) || isLoading) return;

    // Determine final message text
    let userMessageText = rawTrimmed;
    if (stagedAsset) {
      const assetPrefix = `[👁️ Vision Inspection: ${stagedAsset.filename}${stagedAsset.subject_name ? ` (${stagedAsset.subject_name})` : ""}]`;
      if (!rawTrimmed) {
        userMessageText = `${assetPrefix}\nPlease perform a full visual inspection and analysis of this image asset.`;
      } else {
        userMessageText = `${assetPrefix}\n${rawTrimmed}`;
      }
    }

    setErrorMessage(null);
    const newMessages: AssistantChatMessage[] = [
      ...messages,
      { role: "user", content: userMessageText }
    ];

    const currentStagedAsset = stagedAsset;
    setMessages(newMessages);
    persistMessages(newMessages);
    setInputQuery("");
    setStagedAsset(null);
    setIsLoading(true);

    try {
      const response = await sendAssistantChatMessage({
        messages: getRollingChatWindow(newMessages, 16),
        scene_project: sceneProject,
        active_shot_id: activeShotId,
        active_section: activeSection,
        provider: effectiveDefault,
        lm_studio_url: lmStudioUrl,
        attached_asset_filename: currentStagedAsset?.filename,
        attached_asset: currentStagedAsset
          ? {
              id: currentStagedAsset.id,
              filename: currentStagedAsset.filename,
              subject_name: currentStagedAsset.subject_name,
              type: currentStagedAsset.type
            }
          : undefined
      });

      if (response && response.reply) {
        const finalMessages: AssistantChatMessage[] = [
          ...newMessages,
          { role: "assistant", content: response.reply }
        ];
        setMessages(finalMessages);
        persistMessages(finalMessages);
        setIsDefaultLlmConnected(true);
      } else {
        throw new Error("Received empty response from assistant.");
      }
    } catch (err: any) {
      console.error("[AssistantFloatingChat] Error chatting with assistant:", err);
      const errText = err.message || "Failed to communicate with LLM provider.";
      setErrorMessage(errText);
      setIsDefaultLlmConnected(false);

      const errorMessages: AssistantChatMessage[] = [
        ...newMessages,
        {
          role: "assistant",
          content: `⚠️ **Connection Error**: ${errText}\n\nPlease verify that your **${
            effectiveDefault === "gemini" ? "Google Gemini API Key" : "LM Studio instance"
          }** is running and configured correctly in the settings.`
        }
      ];
      setMessages(errorMessages);
      persistMessages(errorMessages);
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

  const handleResetChat = useCallback(() => {
    const initialMsgs = clearStoredAssistantChat(sceneProject?.scene_id, sceneProject);
    setMessages(initialMsgs);
    persistMessages(initialMsgs);
    setErrorMessage(null);
    onShowToast?.("Conversation history reset for this scene.", "info");
  }, [sceneProject, persistMessages, onShowToast]);

  const injectStateFeedback = useCallback(
    (feedbackText: string) => {
      setMessages((prev) => {
        const updated: AssistantChatMessage[] = [
          ...prev,
          {
            role: "system",
            content: `[System: ${feedbackText}]`
          }
        ];
        persistMessages(updated);
        return updated;
      });
    },
    [persistMessages]
  );

  return {
    inputQuery,
    setInputQuery,
    isLoading,
    errorMessage,
    messages,
    messagesEndRef,
    inputRef,
    stagedAsset,
    isMediaBrowserOpen,
    setIsMediaBrowserOpen,
    handleSelectAsset,
    handleClearStagedAsset,
    isDefaultLlmConnected,
    isCheckingConnection,
    checkConnection,
    handleSendMessage,
    handleKeyDown,
    handleResetChat,
    injectStateFeedback
  };
}
