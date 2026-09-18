import React, { useState } from "react";
import { 
  SceneProjectFile, 
  LLMProvider, 
  ShotItem, 
  MediaAsset, 
  AppConfig 
} from "../../types";
import { useAssistantChat } from "./useAssistantChat";
import { useAssistantActions } from "./useAssistantActions";
import { AssistantFloatingButton } from "./AssistantFloatingButton";
import { AssistantChatHeader } from "./AssistantChatHeader";
import { AssistantConnectionBanner } from "./AssistantConnectionBanner";
import { AssistantMessageList } from "./AssistantMessageList";
import { AssistantInputBar } from "./AssistantInputBar";

interface AssistantFloatingChatProps {
  sceneProject: SceneProjectFile;
  activeShotId?: string;
  activeSection: string;
  config?: AppConfig;
  assets?: MediaAsset[];
  lmStudioUrl?: string;
  llmProvider?: string;
  defaultLlmProvider?: LLMProvider;
  geminiApiKey?: string;
  onNavigateToConfig?: (tab?: "llm" | "remote" | "models" | "general") => void;
  onUpdateProject?: React.Dispatch<React.SetStateAction<SceneProjectFile>>;
  onShowToast?: (text: string, type?: "success" | "error" | "info") => void;
  onStageShot?: (shot: ShotItem) => Promise<boolean>;
  onExpandPrompt?: (shot: ShotItem) => Promise<string>;
  onSelectShot?: (shotId: string) => void;
}

/**
 * AI Production Assistant Floating Chat Modal.
 * Provides contextual conversational recommendations, scene modifications,
 * shot staging, and prompt generation directly from any studio screen.
 */
export const AssistantFloatingChat: React.FC<AssistantFloatingChatProps> = ({
  sceneProject,
  activeShotId,
  activeSection,
  config,
  assets = [],
  lmStudioUrl,
  llmProvider,
  defaultLlmProvider = "lm_studio",
  geminiApiKey,
  onNavigateToConfig,
  onUpdateProject,
  onShowToast,
  onStageShot,
  onExpandPrompt,
  onSelectShot
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Resolve active default LLM provider
  const effectiveDefault: LLMProvider = (llmProvider as LLMProvider) || defaultLlmProvider || "lm_studio";

  // Hook 1: Conversation lifecycle, query streaming, and LLM connection probe
  const {
    inputQuery,
    setInputQuery,
    isLoading,
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
  } = useAssistantChat({
    sceneProject,
    activeShotId,
    activeSection,
    lmStudioUrl,
    effectiveDefault,
    geminiApiKey,
    isOpen
  });

  // Hook 2: Project mutation actions, batch execution, undo engine, and remote staging
  const {
    appliedActionKeys,
    dismissedActionKeys,
    stagingProgressMap,
    expandingProgressMap,
    handleApplyAction,
    handleDismissAction,
    handleUndoAction,
    handleApplyAllActions
  } = useAssistantActions({
    sceneProject,
    config,
    assets,
    lmStudioUrl,
    effectiveDefault,
    geminiApiKey,
    onUpdateProject,
    onShowToast,
    onStageShot,
    onExpandPrompt,
    onSelectShot,
    injectStateFeedback
  });

  const handleGoToLlmSettings = () => {
    onNavigateToConfig?.("llm");
  };

  const existingShotNumbers = (sceneProject.shots || []).map((s) => s.shot_number);

  return (
    <>
      {/* Floating Summon Button */}
      {!isOpen && (
        <AssistantFloatingButton onClick={() => setIsOpen(true)} />
      )}

      {/* Floating Chat Modal */}
      {isOpen && (
        <div
          className={`fixed z-50 transition-all duration-200 shadow-2xl rounded-2xl flex flex-col overflow-hidden border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 ${
            isExpanded
              ? "inset-4 sm:inset-10"
              : "bottom-6 right-6 w-[94vw] sm:w-[460px] h-[640px] max-h-[85vh]"
          }`}
        >
          {/* Header Bar */}
          <AssistantChatHeader
            sceneName={sceneProject.scene_name}
            effectiveDefault={effectiveDefault}
            isExpanded={isExpanded}
            onToggleExpand={() => setIsExpanded(!isExpanded)}
            onClose={() => setIsOpen(false)}
          />

          {/* Offline Connection Warning Banner */}
          {isDefaultLlmConnected === false && (
            <AssistantConnectionBanner
              effectiveDefault={effectiveDefault}
              isCheckingConnection={isCheckingConnection}
              onRetryConnection={checkConnection}
              onNavigateToSettings={handleGoToLlmSettings}
            />
          )}

          {/* Chat Messages Feed */}
          <AssistantMessageList
            messages={messages}
            isLoading={isLoading}
            messagesEndRef={messagesEndRef as React.RefObject<HTMLDivElement>}
            existingShotNumbers={existingShotNumbers}
            appliedActionKeys={appliedActionKeys}
            dismissedActionKeys={dismissedActionKeys}
            stagingProgressMap={stagingProgressMap}
            expandingProgressMap={expandingProgressMap}
            onApplyAction={handleApplyAction}
            onDismissAction={handleDismissAction}
            onUndoAction={handleUndoAction}
            onApplyAllActions={handleApplyAllActions}
          />

          {/* Bottom Input Area */}
          <AssistantInputBar
            inputRef={inputRef as React.RefObject<HTMLTextAreaElement>}
            inputQuery={inputQuery}
            isLoading={isLoading}
            onInputChange={setInputQuery}
            onKeyDown={handleKeyDown}
            onSendMessage={handleSendMessage}
            onResetChat={handleResetChat}
          />
        </div>
      )}
    </>
  );
};
