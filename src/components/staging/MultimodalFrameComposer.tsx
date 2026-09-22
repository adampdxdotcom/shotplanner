import React from "react";
import { Sparkles } from "lucide-react";
import { 
  MultimodalFrameComposerProps,
  useMultimodalComposer,
  ReferenceSlotsPanel,
  DirectorPromptControls,
  ComposerActionBar,
  CandidateGallery,
  CandidateLightboxModal,
  ReferenceAssetPickerModal
} from "./composer";

export const MultimodalFrameComposer: React.FC<MultimodalFrameComposerProps> = ({
  sceneProject,
  activeShot,
  activeScene,
  allAssets = [],
  assignedFirstFrame,
  onAcceptFirstFrame,
  onAssetUploaded,
  addToast
}) => {
  const {
    actorSlot,
    wardrobeSlot,
    locationSlot,
    prompt,
    setPrompt,
    aspectRatio,
    setAspectRatio,
    candidateCount,
    setCandidateCount,
    isCheckingSafety,
    sanitizedPrompt,
    safetyReplacements,
    useSanitized,
    setUseSanitized,
    isGenerating,
    candidates,
    activeModalCandidate,
    setActiveModalCandidate,
    isAccepting,
    generationError,
    wasBlockedByFilter,
    isSendingToComfy,
    activePickerSlot,
    setActivePickerSlot,
    fileInputRef,
    handleTranslateSafety,
    handleGenerate,
    handleAcceptCandidate,
    handleSendToLocalComfy,
    handleClearSlot,
    handleSelectAsset,
    handleSlotFileUpload,
    handleTriggerUpload
  } = useMultimodalComposer({
    sceneProject,
    activeShot,
    activeScene,
    allAssets,
    onAssetUploaded,
    addToast
  });

  return (
    <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl overflow-hidden shadow-sm flex flex-col">
      {/* Hidden file input for slot reference uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleSlotFileUpload}
      />

      {/* Header */}
      <div className="p-3.5 px-4 border-b border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Option 2: Multimodal First Frame Generator (Frame 0 Staging)
          </h3>
        </div>
        <span className="text-[10px] text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded-full border border-zinc-700/50">
          Gemini Flash Image Multimodal Fusion
        </span>
      </div>

      <div className="p-4 flex flex-col gap-5">
        {/* 1. Reference Slots Ingestion Panel */}
        <ReferenceSlotsPanel
          actorSlot={actorSlot}
          wardrobeSlot={wardrobeSlot}
          locationSlot={locationSlot}
          onClearSlot={handleClearSlot}
          onOpenPicker={(slot) => setActivePickerSlot(slot)}
          onTriggerUpload={handleTriggerUpload}
        />

        {/* 2. Director Prompt & Stunt Safety Controls */}
        <DirectorPromptControls
          prompt={prompt}
          onPromptChange={(val) => setPrompt(val)}
          isCheckingSafety={isCheckingSafety}
          onTranslateSafety={handleTranslateSafety}
          sanitizedPrompt={sanitizedPrompt}
          safetyReplacements={safetyReplacements}
          useSanitized={useSanitized}
          onToggleUseSanitized={setUseSanitized}
        />

        {/* 3. Aspect Ratio, Candidate Count & Action Bar */}
        <ComposerActionBar
          aspectRatio={aspectRatio}
          onAspectRatioChange={setAspectRatio}
          candidateCount={candidateCount}
          onCandidateCountChange={setCandidateCount}
          isGenerating={isGenerating}
          canGenerate={!!prompt.trim()}
          onGenerate={handleGenerate}
          generationError={generationError}
          wasBlockedByFilter={wasBlockedByFilter}
          isSendingToComfy={isSendingToComfy}
          onSendToLocalComfy={handleSendToLocalComfy}
        />

        {/* 4. Candidate Approval Gallery */}
        <CandidateGallery
          candidates={candidates}
          isAccepting={isAccepting}
          onInspect={(candidate) => setActiveModalCandidate(candidate)}
          onAccept={handleAcceptCandidate}
        />
      </div>

      {/* Lightbox Modal */}
      <CandidateLightboxModal
        candidate={activeModalCandidate}
        activeShot={activeShot}
        isAccepting={isAccepting}
        onAccept={handleAcceptCandidate}
        onClose={() => setActiveModalCandidate(null)}
      />

      {/* Reference Asset Picker Modal */}
      <ReferenceAssetPickerModal
        activePickerSlot={activePickerSlot}
        allAssets={allAssets}
        onSelectAsset={handleSelectAsset}
        onClose={() => setActivePickerSlot(null)}
      />
    </div>
  );
};
