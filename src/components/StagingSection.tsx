import React from "react";
import { MediaAsset, CharacterProfile, SceneProjectFile, ShotItem } from "../types";
import { HeadshotGeneratorTab } from "./cast/HeadshotGeneratorTab";
import { ReferenceSheetsTab } from "./cast/ReferenceSheetsTab";
import { StagingEnvironmentControls } from "./cast/StagingEnvironmentControls";
import { StagingActorInspector } from "./cast/StagingActorInspector";
import { StagingCompositeSavePanel } from "./cast/StagingCompositeSavePanel";
import { ActorPoseKeyingPanel } from "./cast/ActorPoseKeyingPanel";
import {
  StagedActor,
  useStagingStage,
  StagingStudioHeader,
  StagingViewportCard,
  FirstFrameTab
} from "./staging";
import { StagingWorkspaceTab } from "../utils/workspaceSessionStore";

export type { StagedActor };

export interface StagingSectionProps {
  sceneProject?: SceneProjectFile;
  activeShotId?: string | null;
  onSelectShot?: (id: string | null) => void;
  assets?: MediaAsset[];
  characters?: Record<string, CharacterProfile>;
  subjects?: string[];
  activeSceneName?: string;
  config?: any;
  onUpdateProject?: React.Dispatch<React.SetStateAction<SceneProjectFile>> | ((updater: (prev: SceneProjectFile) => SceneProjectFile) => void);
  onUpdateShot?: (updater: (prev: ShotItem) => ShotItem) => void;
  onAssetUploaded?: (asset: MediaAsset, targetSlotIndex?: number) => void;
  addToast?: (msg: string, type?: "success" | "error" | "info") => void;
  initialTab?: StagingWorkspaceTab;
  initialSubject?: string;
  autosaveStatus?: "saved" | "saving" | "unsaved" | "error";
  lastSavedAt?: Date | null;
}

export const StagingSection: React.FC<StagingSectionProps> = ({
  sceneProject,
  activeShotId,
  onSelectShot,
  assets = [],
  characters = {},
  subjects = [],
  activeSceneName,
  config,
  onUpdateProject,
  onUpdateShot,
  onAssetUploaded,
  addToast,
  initialTab = "staging" as "headshots" | "staging" | "sheets",
  initialSubject = "",
  autosaveStatus,
  lastSavedAt
}) => {
  const {
    activeTab,
    setActiveTab,
    activeSubject,
    setActiveSubject,
    activeScene,
    activeShot,
    currentCharacterAssets,
    availableCharacters,
    locationAssets,
    activeLocationAsset,
    selectedLocationFilename,
    setSelectedLocationFilename,
    customLocationName,
    setCustomLocationName,
    selectedAtmosphere,
    setSelectedAtmosphere,
    viewportRatio,
    setViewportRatio,
    showGrid,
    setShowGrid,
    showSafeAreas,
    setShowSafeAreas,
    stagedActors,
    selectedActorId,
    setSelectedActorId,
    selectedActorIndex,
    activeMaskingActorId,
    setActiveMaskingActorId,
    customBackgroundUrl,
    compositeRefName,
    setCompositeRefName,
    setHasUserEditedRefName,
    assignToShotSlot,
    setAssignToShotSlot,
    targetSlotIndex,
    setTargetSlotIndex,
    defaultEnvironmentName,
    isExportingComposite,
    isDownloading,
    handleSaveCompositeReference,
    handleDownloadComposite,
    isPoseKeyingOpen,
    setIsPoseKeyingOpen,
    keyingTargetSubject,
    setKeyingTargetSubject,
    handleAddActorToStage,
    handleAddPosedActorToStage,
    handleUpdateActor,
    updateSelectedActor,
    handleRemoveActor,
    handleRemoveActorFromStage,
    handleReorderActors,
    handleApplyActors,
    handleUploadCustomBackground,
    handleClearBackground,
    stagingSaveStatus
  } = useStagingStage({
    sceneProject,
    activeShotId,
    onSelectShot,
    assets,
    characters,
    subjects,
    activeSceneName,
    onUpdateProject,
    onUpdateShot,
    onAssetUploaded,
    addToast,
    initialTab,
    initialSubject
  });

  const effectiveSaveStatus: "saved" | "saving" | "unsaved" | "error" = 
    autosaveStatus === "saving" || stagingSaveStatus === "saving"
      ? "saving"
      : autosaveStatus === "error"
      ? "error"
      : autosaveStatus === "unsaved"
      ? "unsaved"
      : "saved";

  return (
    <div id="staging-section" className="flex flex-col gap-6 min-h-0 flex-1">
      {/* SECTION HEADER CARD */}
      <StagingStudioHeader
        sceneProject={sceneProject}
        activeShotId={activeShotId}
        onSelectShot={onSelectShot}
        activeSubject={activeSubject}
        setActiveSubject={setActiveSubject}
        availableCharacters={availableCharacters}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        saveStatus={effectiveSaveStatus}
        lastSavedAt={lastSavedAt}
      />

      {/* WORKSPACE CONTENT BODY */}
      <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
        {/* TAB 1: SCENE STAGING & BLOCKING */}
        {activeTab === "staging" && (
          <div className="p-5 flex flex-col gap-6">
            <StagingEnvironmentControls
              locationAssets={locationAssets}
              selectedLocationFilename={selectedLocationFilename}
              setSelectedLocationFilename={setSelectedLocationFilename}
              customLocationName={customLocationName}
              setCustomLocationName={setCustomLocationName}
              selectedAtmosphere={selectedAtmosphere}
              setSelectedAtmosphere={setSelectedAtmosphere}
              viewportRatio={viewportRatio}
              setViewportRatio={setViewportRatio}
              showGrid={showGrid}
              setShowGrid={setShowGrid}
              showSafeAreas={showSafeAreas}
              setShowSafeAreas={setShowSafeAreas}
              onClearBackground={handleClearBackground}
            />

            {/* DIRECTOR'S CANVAS VIEWPORT */}
            <StagingViewportCard
              viewportRatio={viewportRatio}
              onOpenPoseKeying={() => {
                setKeyingTargetSubject(activeSubject || stagedActors[selectedActorIndex]?.characterName || "");
                setIsPoseKeyingOpen(true);
              }}
              stagedActors={stagedActors}
              selectedActorId={selectedActorId}
              onSelectActor={(id) => setSelectedActorId(id)}
              onUpdateActor={handleUpdateActor}
              onRemoveActor={handleRemoveActor}
              onReorderActors={handleReorderActors}
              onApplyActors={handleApplyActors}
              activeLocationAsset={activeLocationAsset}
              locationAssets={locationAssets}
              customBackgroundUrl={customBackgroundUrl}
              onSelectLocationAsset={(filename) => {
                setSelectedLocationFilename(filename);
              }}
              onUploadCustomBackground={handleUploadCustomBackground}
              onClearBackground={handleClearBackground}
              showGrid={showGrid}
              showSafeAreas={showSafeAreas}
              activeMaskingActorId={activeMaskingActorId}
              onSetMaskingActorId={setActiveMaskingActorId}
            />

            {/* ACTOR BLOCKING CONTROLS */}
            <StagingActorInspector
              stagedActors={stagedActors}
              selectedActorIndex={selectedActorIndex}
              availableCharacters={availableCharacters}
              activeSubject={activeSubject || ""}
              activeMaskingActorId={activeMaskingActorId}
              updateSelectedActor={updateSelectedActor}
              handleAddActorToStage={handleAddActorToStage}
              handleRemoveActorFromStage={handleRemoveActorFromStage}
              onSetMaskingActorId={setActiveMaskingActorId}
              onOpenPoseInspector={(subject) => {
                setKeyingTargetSubject(subject);
                setIsPoseKeyingOpen(true);
              }}
            />

            {/* LOCATION-FIRST REFERENCE SAVE & SLOT ASSIGNMENT PANEL */}
            <StagingCompositeSavePanel
              defaultEnvironmentName={defaultEnvironmentName}
              compositeRefName={compositeRefName}
              setHasUserEditedRefName={setHasUserEditedRefName}
              setCompositeRefName={setCompositeRefName}
              assignToShotSlot={assignToShotSlot}
              setAssignToShotSlot={setAssignToShotSlot}
              targetSlotIndex={targetSlotIndex}
              setTargetSlotIndex={setTargetSlotIndex}
              activeShot={activeShot}
              handleSaveCompositeReference={handleSaveCompositeReference}
              isExportingComposite={isExportingComposite}
              handleDownloadComposite={handleDownloadComposite}
              isDownloading={isDownloading}
            />
          </div>
        )}

        {/* TAB 2: FIRST FRAME CONTINUITY STUDIO */}
        {activeTab === "first_frame" && (
          <FirstFrameTab
            sceneProject={sceneProject}
            activeShot={activeShot}
            activeScene={activeScene}
            allAssets={assets}
            onUpdateShot={onUpdateShot}
            onUpdateProject={onUpdateProject}
            onSelectShot={onSelectShot}
            onAssetUploaded={onAssetUploaded}
            addToast={addToast}
          />
        )}

        {/* TAB 3: AI HEADSHOTS WORKSPACE */}
        {activeTab === "headshots" && (
          <div className="p-5">
            <HeadshotGeneratorTab
              activeSubject={activeSubject}
              activeScene={activeScene}
              currentCharacterAssets={currentCharacterAssets}
              allAssets={assets}
              characters={characters}
              subjects={availableCharacters.length > 0 ? availableCharacters : subjects}
              config={config}
              onAssetSaved={onAssetUploaded}
              addToast={addToast}
            />
          </div>
        )}

        {/* TAB 3: REFERENCE SHEETS WORKSPACE */}
        {activeTab === "sheets" && (
          <div className="p-5">
            <ReferenceSheetsTab
              activeSubject={activeSubject}
              activeScene={activeScene}
              currentCharacterAssets={currentCharacterAssets}
              allAssets={assets}
              characters={characters}
              subjects={availableCharacters}
              onAssetSaved={onAssetUploaded}
              addToast={addToast}
            />
          </div>
        )}
      </div>

      {/* Chroma-Key Actor Pose Inspector Overlay Modal */}
      {isPoseKeyingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto">
            <ActorPoseKeyingPanel
              characters={characters}
              subjects={availableCharacters}
              allAssets={assets}
              activeSceneName={activeScene}
              defaultCharacter={keyingTargetSubject}
              onAssetUploaded={onAssetUploaded}
              onAddPosedActor={handleAddPosedActorToStage}
              onClose={() => setIsPoseKeyingOpen(false)}
              addToast={addToast}
            />
          </div>
        </div>
      )}
    </div>
  );
};
