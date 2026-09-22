import React from "react";
import { X, Sparkles } from "lucide-react";
import { 
  SceneSketchImportModalProps,
  useSceneSketchImport,
  SketchTextInputStep,
  UniverseSyncNotice,
  StagedShotsList,
  ImportDestinationControls,
  ModalFooter
} from "./sketchImport";

export const SceneSketchImportModal: React.FC<SceneSketchImportModalProps> = ({
  isOpen,
  onClose,
  existingShotsCount,
  sceneCast,
  universeCast,
  universeAssets,
  existingSceneAssets,
  lmStudioUrl,
  onImportSuccess
}) => {
  const {
    step,
    setStep,
    sketchText,
    setSketchText,
    isParsing,
    parseError,
    stagedSceneTitle,
    setStagedSceneTitle,
    stagedShots,
    importMode,
    setImportMode,
    providerUsed,
    cleanImport,
    setCleanImport,
    resolvedShots,
    universeImportPayload,
    handleParse,
    handleUpdateShotField,
    handleDeleteShot,
    handleAddShot,
    handleRemoveCharacterFromShot,
    handleConfirmImport
  } = useSceneSketchImport({
    existingShotsCount,
    sceneCast,
    universeCast,
    universeAssets,
    existingSceneAssets,
    lmStudioUrl,
    onImportSuccess,
    onClose
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 backdrop-blur-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                Import Scene Sketch
                {step === 2 && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    {stagedShots.length} {stagedShots.length === 1 ? "Shot" : "Shots"} Parsed
                  </span>
                )}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {step === 1 
                  ? "Upload or paste raw scene script/sketch text to break it down into sequential shots."
                  : "Review and refine parsed shots and cinematography parameters before adding to your scene."
                }
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 ? (
            <SketchTextInputStep
              sketchText={sketchText}
              onSketchTextChange={setSketchText}
              cleanImport={cleanImport}
              onCleanImportChange={setCleanImport}
              parseError={parseError}
            />
          ) : (
            <div className="space-y-6">
              {/* Staged Shots Review List */}
              <StagedShotsList
                stagedSceneTitle={stagedSceneTitle}
                onSceneTitleChange={setStagedSceneTitle}
                cleanImport={cleanImport}
                providerUsed={providerUsed}
                stagedShots={stagedShots}
                resolvedShots={resolvedShots}
                onAddShot={handleAddShot}
                onUpdateShotField={handleUpdateShotField}
                onDeleteShot={handleDeleteShot}
                onRemoveCharacterFromShot={handleRemoveCharacterFromShot}
              />

              {/* Universe Auto-Import Banner */}
              <UniverseSyncNotice
                charactersToImport={universeImportPayload.charactersToImport}
                assetsToImport={universeImportPayload.assetsToImport}
              />

              {/* Import Destination Controls */}
              <ImportDestinationControls
                importMode={importMode}
                onImportModeChange={setImportMode}
                existingShotsCount={existingShotsCount}
                stagedShotsCount={stagedShots.length}
              />
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <ModalFooter
          step={step}
          isParsing={isParsing}
          canParse={!!sketchText.trim()}
          stagedShotsCount={stagedShots.length}
          onClose={onClose}
          onParse={handleParse}
          onBackToInput={() => setStep(1)}
          onConfirmImport={handleConfirmImport}
        />
      </div>
    </div>
  );
};
