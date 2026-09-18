import React from "react";
import { FileText, Sparkles, Bot, Square } from "lucide-react";
import { LLMProvider, MediaAsset } from "../../types";
import { AssociatedAssetsPreview } from "./AssociatedAssetsPreview";
import { MissingReferenceAlert } from "./MissingReferenceAlert";
import { MissingPhotoAnalysis } from "./useShotPromptContext";

interface BasicStubInputProps {
  currentBasicStub: string;
  onStubChange: (val: string) => void;
  effectiveDefaultProvider: LLMProvider;
  displayAssociatedAssets: Array<MediaAsset & { slot_index?: number }>;
  missingPhotoInfo: MissingPhotoAnalysis | null;
  onAutoAssignCharacterPhotos: (charName: string) => void;
  generating: boolean;
  elapsedSeconds: number;
  relevantAssetsCount: number;
  expandedPrompt: string;
  onGeneratePrompt: () => void;
}

/**
 * Left-side column allowing the director to enter the basic shot stub,
 * inspect linked reference photos, and trigger or cancel LLM expansion.
 */
export const BasicStubInput: React.FC<BasicStubInputProps> = ({
  currentBasicStub,
  onStubChange,
  effectiveDefaultProvider,
  displayAssociatedAssets,
  missingPhotoInfo,
  onAutoAssignCharacterPhotos,
  generating,
  elapsedSeconds,
  relevantAssetsCount,
  expandedPrompt,
  onGeneratePrompt
}) => {
  return (
    <div className="bg-zinc-50/70 dark:bg-zinc-950/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700/80 space-y-3 flex flex-col justify-between">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
            Basic Prompt / Stub
          </label>
          
          {/* Only the Default Selected LLM is Shown */}
          <div
            id="default-llm-indicator"
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors flex items-center gap-1.5 shadow-xs ${
              effectiveDefaultProvider === "gemini"
                ? "bg-purple-600 text-white border border-purple-400/30"
                : "bg-amber-600 text-white border border-amber-400/30"
            }`}
            title={`Default Selected LLM: ${effectiveDefaultProvider === "gemini" ? "Gemini 3.7 Flash" : "LM Studio"} (managed in Settings)`}
          >
            {effectiveDefaultProvider === "gemini" ? (
              <>
                <Sparkles className="w-3 h-3" />
                <span>Gemini 3.7 Flash</span>
              </>
            ) : (
              <>
                <Bot className="w-3 h-3" />
                <span>LM Studio</span>
              </>
            )}
          </div>
        </div>

        <textarea
          rows={5}
          placeholder="e.g. Jackie walking through a neon-lit cyberpunk alleyway in the rain, turning towards the camera with a confident smile..."
          value={currentBasicStub}
          onChange={(e) => onStubChange(e.target.value)}
          className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 focus:border-amber-500 rounded-lg p-3 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none resize-none leading-relaxed shadow-xs"
        />

        {/* 3-Wide Associated Assets & Slot Numbers Thumbnail Preview */}
        <AssociatedAssetsPreview displayAssociatedAssets={displayAssociatedAssets} />
      </div>

      {/* Missing Reference Photo Alert / Helper */}
      <MissingReferenceAlert
        missingPhotoInfo={missingPhotoInfo}
        onAutoAssignCharacterPhotos={onAutoAssignCharacterPhotos}
      />

      <button
        onClick={onGeneratePrompt}
        disabled={!generating && (!currentBasicStub.trim() || relevantAssetsCount === 0)}
        title={
          generating 
            ? "Click to cancel prompt expansion" 
            : relevantAssetsCount === 0 
            ? "At least one reference photo is required to expand the prompt for this shot." 
            : !currentBasicStub.trim()
            ? "Please enter a basic prompt stub first."
            : ""
        }
        className={`w-full mt-3 py-2.5 px-4 font-semibold rounded-lg text-xs transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer ${
          generating
            ? "bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 dark:bg-red-500/15 dark:hover:bg-red-500/25 dark:text-red-300 dark:border-red-500/40 active:scale-[0.99]"
            : relevantAssetsCount === 0 
            ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed border border-zinc-200 dark:border-zinc-700" 
            : effectiveDefaultProvider === "gemini"
            ? "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white disabled:opacity-50"
            : "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 disabled:opacity-50 font-bold"
        }`}
      >
        {generating ? (
          <>
            <Square className="w-3.5 h-3.5 fill-current text-red-600 dark:text-red-400" />
            <span>Cancel Prompt Expansion ({elapsedSeconds}s / 60s)</span>
          </>
        ) : (
          <>
            {effectiveDefaultProvider === "gemini" ? (
              <Sparkles className="w-4 h-4" />
            ) : (
              <Bot className="w-4 h-4" />
            )}
            <span>
              {relevantAssetsCount === 0
                ? "Add Reference Photos to Generate Prompt"
                : expandedPrompt && expandedPrompt.trim()
                ? `Regenerate Prompt with ${effectiveDefaultProvider === "gemini" ? "Gemini 3.7 Flash" : "LM Studio"}`
                : `Generate Prompt with ${effectiveDefaultProvider === "gemini" ? "Gemini 3.7 Flash" : "LM Studio"}`}
            </span>
          </>
        )}
      </button>
    </div>
  );
};
