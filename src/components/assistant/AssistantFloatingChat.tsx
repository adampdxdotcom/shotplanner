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
import { AssistantMediaBrowserModal } from "./AssistantMediaBrowserModal";

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
  onNavigateToSection?: (section: string) => void;
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
  onNavigateToSection,
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
    stagedAsset,
    isMediaBrowserOpen,
    setIsMediaBrowserOpen,
    handleSelectAsset,
    handleClearStagedAsset,
    isDefaultLlmConnected,
    isCheckingConnection,
    checkConnection,
    elapsedSeconds,
    handleCancelRequest,
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
    isOpen,
    onUpdateProject,
    onShowToast
  });

  // Global listener to open assistant with pre-populated prompt (e.g. Continuity Audit)
  React.useEffect(() => {
    const handleOpenWithPrompt = (e: any) => {
      const prompt = e.detail?.prompt;
      if (prompt) {
        setIsOpen(true);
        setInputQuery(prompt);
      }
    };
    window.addEventListener("open-assistant-with-prompt", handleOpenWithPrompt);
    return () => window.removeEventListener("open-assistant-with-prompt", handleOpenWithPrompt);
  }, [setInputQuery]);

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
            onResetChat={handleResetChat}
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
            elapsedSeconds={elapsedSeconds}
            onCancelRequest={handleCancelRequest}
            messagesEndRef={messagesEndRef as React.RefObject<HTMLDivElement>}
            existingShotNumbers={existingShotNumbers}
            appliedActionKeys={appliedActionKeys}
            dismissedActionKeys={dismissedActionKeys}
            stagingProgressMap={stagingProgressMap}
            expandingProgressMap={expandingProgressMap}
            shots={sceneProject.shots}
            characters={sceneProject.characters}
            assets={assets}
            sceneName={sceneProject.scene_name}
            onNavigateToSection={onNavigateToSection}
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
            stagedAsset={stagedAsset}
            isAssetScanned={stagedAsset ? Boolean(sceneProject.visual_analysis_cache?.[stagedAsset.filename]) : false}
            onInputChange={setInputQuery}
            onKeyDown={handleKeyDown}
            onSendMessage={handleSendMessage}
            onResetChat={handleResetChat}
            onOpenMediaBrowser={() => setIsMediaBrowserOpen(true)}
            onClearStagedAsset={handleClearStagedAsset}
          />
        </div>
      )}

      {/* Media Browser Modal for Vision Skills */}
      <AssistantMediaBrowserModal
        isOpen={isMediaBrowserOpen}
        onClose={() => setIsMediaBrowserOpen(false)}
        assets={assets.length > 0 ? assets : sceneProject.assets || []}
        visualCache={sceneProject.visual_analysis_cache}
        onSelectAsset={handleSelectAsset}
      />
    </>
  );
};
