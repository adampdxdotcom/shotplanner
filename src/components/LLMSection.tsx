import React, { useState } from "react";
import { 
  MediaAsset, 
  LLMProvider, 
  ScenePlanning, 
  SceneProjectFile, 
  ShotItem, 
  AppConfig 
} from "../types";
import { TakeReviewModal } from "./TakeReviewModal";
import { PromptDebugModal } from "./PromptDebugModal";
import { copyToClipboard } from "../utils/clipboard";
import { Sparkles, Bot, AlertCircle, History } from "lucide-react";
import { useShotPromptContext } from "./prompt/useShotPromptContext";
import { usePromptExpansion } from "./prompt/usePromptExpansion";
import { PromptHeaderBar } from "./prompt/PromptHeaderBar";
import { BasicStubInput } from "./prompt/BasicStubInput";
import { PromptOutputPanel } from "./prompt/PromptOutputPanel";

interface LLMSectionProps {
  basicStub: string;
  onChangeBasicStub: (val: string) => void;
  expandedPrompt: string;
  onChangeExpandedPrompt: (val: string) => void;
  providerChoice?: LLMProvider;
  onChangeProviderChoice?: (val: LLMProvider) => void;
  defaultProvider?: LLMProvider;
  promptPrefix?: string;
  planning?: ScenePlanning;
  assets: MediaAsset[];
  lmStudioUrl: string;
  geminiApiKey?: string;
  onShowToast?: (text: string, type: "success" | "error" | "info") => void;
  activeShotId: string | null;
  onSelectShot: (id: string | null) => void;
  sceneProject: SceneProjectFile;
  onUpdateShot: (updater: (prev: ShotItem) => ShotItem) => void;
  onUpdateSpecificShot?: (id: string, updater: (prev: ShotItem) => ShotItem) => void;
  config?: AppConfig;
}

/**
 * Orchestrator component for Step 3: LLM Prompt Expansion.
 * Coordinates shot selection, reference photo bindings, LLM prompt generation,
 * and variation history inspection.
 */
export const LLMSection: React.FC<LLMSectionProps> = ({
  basicStub,
  onChangeBasicStub,
  expandedPrompt,
  onChangeExpandedPrompt,
  providerChoice: controlledProvider,
  defaultProvider: propDefaultProvider,
  promptPrefix = "",
  planning,
  assets,
  lmStudioUrl,
  geminiApiKey,
  onShowToast,
  activeShotId,
  onSelectShot,
  sceneProject,
  onUpdateShot,
  onUpdateSpecificShot,
  config
}) => {
  // Resolve effective default provider (only default LLM is active & shown)
  const effectiveDefaultProvider: LLMProvider = 
    propDefaultProvider || 
    config?.default_llm_provider || 
    (typeof window !== "undefined" && (localStorage.getItem("default_llm_provider") as LLMProvider)) || 
    controlledProvider || 
    "lm_studio";

  const [reviewTakeId, setReviewTakeId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Hook 1: Shot context, assigned slots & reference asset validation
  const {
    activeShot,
    activeShotAssets,
    currentBasicStub,
    relevantAssets,
    displayAssociatedAssets,
    missingPhotoInfo,
    handleAutoAssignCharacterPhotos,
    activeShotPrefix,
    livePrePromptContext
  } = useShotPromptContext({
    activeShotId,
    sceneProject,
    assets,
    basicStub,
    promptPrefix,
    planning,
    onUpdateSpecificShot,
    onShowToast
  });

  // Current prompt state (either saved on active shot or active in form)
  const currentExpandedPrompt = activeShot ? (activeShot.expanded_prompt ?? "") : expandedPrompt;
  const isLivePreview = !currentExpandedPrompt || !currentExpandedPrompt.trim();
  const displayedPrompt = isLivePreview ? livePrePromptContext : currentExpandedPrompt;

  // Hook 2: Prompt expansion lifecycle, abort controllers & variation records
  const {
    generating,
    elapsedSeconds,
    error,
    presentedFallbackNotice,
    providerUsed,
    lastDebugInfo,
    showDebugModal,
    setShowDebugModal,
    handleGeneratePrompt,
    handleCancelGeneration
  } = usePromptExpansion({
    providerChoice: effectiveDefaultProvider,
    activeShotId,
    activeShot,
    currentBasicStub,
    expandedPrompt,
    relevantAssets,
    activeShotPrefix,
    planning,
    sceneProject,
    lmStudioUrl,
    geminiApiKey,
    config,
    onChangeExpandedPrompt,
    onUpdateShot,
    onUpdateSpecificShot,
    onShowToast
  });

  const handleStubChange = (val: string) => {
    onChangeBasicStub(val);
    if (activeShotId && onUpdateSpecificShot) {
      onUpdateSpecificShot(activeShotId, (prev) => ({ ...prev, basic_stub: val, status: "unstaged" }));
    }
  };

  const handlePromptChange = (val: string) => {
    onChangeExpandedPrompt(val);
    if (activeShotId && onUpdateSpecificShot) {
      onUpdateSpecificShot(activeShotId, (prev) => ({ ...prev, expanded_prompt: val, status: "unstaged" }));
    }
  };

  const handleResetToLivePreview = () => {
    onChangeExpandedPrompt("");
    if (activeShotId && onUpdateSpecificShot) {
      onUpdateSpecificShot(activeShotId, (prev) => ({ ...prev, expanded_prompt: "", status: "unstaged" }));
    }
    onShowToast?.("Prompt cleared — live context preview re-engaged.", "info");
  };

  const handleCopy = async () => {
    if (!displayedPrompt || !displayedPrompt.trim()) {
      onShowToast?.("No prompt text to copy.", "info");
      return;
    }

    const success = await copyToClipboard(displayedPrompt);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      onShowToast?.(
        isLivePreview 
          ? "Pre-generation context preview copied to clipboard!" 
          : "Final prompt copied to clipboard!", 
        "success"
      );
    } else {
      onShowToast?.("Failed to copy prompt to clipboard.", "error");
    }
  };

  return (
    <div id="llm-section" className="space-y-5 flex flex-col min-h-0">
      {/* Top Shot Context & Variation Selector Strip */}
      <PromptHeaderBar
        sceneProject={sceneProject}
        activeShotId={activeShotId}
        activeShot={activeShot}
        onSelectShot={onSelectShot}
        onUpdateShot={onUpdateShot}
        onUpdateSpecificShot={onUpdateSpecificShot}
        onChangeExpandedPrompt={onChangeExpandedPrompt}
        onChangeBasicStub={onChangeBasicStub}
        onShowToast={onShowToast}
        onReviewTake={setReviewTakeId}
      />

      {!activeShotId ? (
        <div className="flex flex-col items-center justify-center p-12 bg-zinc-50/60 dark:bg-zinc-900/40 border-2 border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl">
          <Bot className="w-12 h-12 text-zinc-400 dark:text-zinc-600 mb-4" />
          <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-300 mb-2">No Shot Selected</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-500 text-center max-w-md">
            Select a shot from the dropdown above to write the concept stub, expand with LLM, and inspect the injected prompt.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-700 rounded-xl p-5 shadow-xs space-y-5">
          {/* Section Sub-Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">LLM Prompt Expansion (&quot;Generate from Stub&quot;)</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Passes basic concept + all uploaded asset metadata into {effectiveDefaultProvider === "gemini" ? "Google Gemini" : "local LM Studio"} to generate ComfyUI-tagged prompts (<code className="text-zinc-700 dark:text-zinc-300 font-mono">&lt;Picture 1&gt;</code>, <code className="text-zinc-700 dark:text-zinc-300 font-mono">&lt;Video 1&gt;</code>).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {providerUsed && (
                <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300">
                  Provider: {providerUsed}
                </span>
              )}
              <span className="text-[11px] text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-950 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700">
                {activeShotAssets.length} reference asset(s) in context
              </span>
            </div>
          </div>

          {/* Failure & Fallback Banner */}
          {error && (
            <div className="p-3.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-xs text-red-800 dark:text-red-200 space-y-1.5 shadow-xs">
              <div className="flex items-center gap-2 font-medium text-red-700 dark:text-red-300">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                <span>LLM Generation Failed ({effectiveDefaultProvider === "gemini" ? "Google Gemini" : "LM Studio"})</span>
              </div>
              <p className="text-[11px] text-red-700 dark:text-red-300/90 pl-6 leading-relaxed">
                {error}
              </p>
              {presentedFallbackNotice && (
                <div className="mt-1 pt-1.5 border-t border-red-200 dark:border-red-900/60 pl-6 flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-300">
                  <History className="w-3.5 h-3.5 shrink-0" />
                  <span>{presentedFallbackNotice}</span>
                </div>
              )}
            </div>
          )}

          {/* 2-Column Split: Input Stub & Output Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Left Column: Input Stub & Reference Photo Strip */}
            <BasicStubInput
              currentBasicStub={currentBasicStub}
              onStubChange={handleStubChange}
              effectiveDefaultProvider={effectiveDefaultProvider}
              displayAssociatedAssets={displayAssociatedAssets}
              missingPhotoInfo={missingPhotoInfo}
              onAutoAssignCharacterPhotos={handleAutoAssignCharacterPhotos}
              generating={generating}
              elapsedSeconds={elapsedSeconds}
              relevantAssetsCount={relevantAssets.length}
              expandedPrompt={expandedPrompt}
              onGeneratePrompt={handleGeneratePrompt}
            />

            {/* Right Column: Preview & Editable Compiled Prompt */}
            <PromptOutputPanel
              displayedPrompt={displayedPrompt}
              isLivePreview={isLivePreview}
              presentedFallbackNotice={presentedFallbackNotice}
              generating={generating}
              elapsedSeconds={elapsedSeconds}
              copied={copied}
              lastDebugInfo={lastDebugInfo}
              effectiveDefaultProvider={effectiveDefaultProvider}
              onPromptChange={handlePromptChange}
              onCopy={handleCopy}
              onResetToLivePreview={handleResetToLivePreview}
              onInspectExchange={() => setShowDebugModal(true)}
              onCancelGeneration={handleCancelGeneration}
            />
          </div>
        </div>
      )}

      {/* Take Review Lightbox Modal */}
      {reviewTakeId && activeShot && (
        <TakeReviewModal
          take={activeShot.takes?.find((t) => t.id === reviewTakeId)!}
          sceneName={sceneProject.scene_name || "Untitled_Scene"}
          shotNumber={activeShot.shot_number}
          variations={activeShot.prompt_variations}
          onClose={() => setReviewTakeId(null)}
          onSetHero={() => {
            onUpdateShot((prev) => {
              const updatedTakes = (prev.takes || []).map((t) => ({
                ...t,
                is_hero: t.id === reviewTakeId
              }));
              return { ...prev, hero_take_id: reviewTakeId, takes: updatedTakes };
            });
            setReviewTakeId(null);
          }}
        />
      )}

      {/* LLM Exchange Inspector Modal */}
      <PromptDebugModal
        isOpen={showDebugModal}
        onClose={() => setShowDebugModal(false)}
        debugInfo={lastDebugInfo}
        assembledPrompt={expandedPrompt}
      />
    </div>
  );
};
