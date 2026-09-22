import React, { useState, useEffect } from "react";
import { AppConfig, MediaAsset, SceneProjectFile, ShotItem, CharacterProfile } from "../types";
import { ScenePlanningHeader } from "./ScenePlanningHeader";
import { TakeSelector } from "./TakeSelector";
import { ShotTakesManager } from "./ShotTakesManager";
import { AssetUploadModal } from "./AssetUploadModal";
import { AssetEditModal } from "./AssetEditModal";
import { AssetLightbox } from "./AssetLightbox";
import { getLastAssetTab, setLastAssetTab } from "../utils/workspaceSessionStore";
import { ShotDossierCard } from "./ShotDossierCard";
import { 
  EmptyShotState, 
  AssetTabBar, 
  AssetSlotsView, 
  TakeModalsContainer, 
  useAssetManagerSlots 
} from "./assetManager";

interface AssetManagerSectionProps {
  assets: MediaAsset[];
  activeShotId: string | null;
  onSelectShot: (id: string | null) => void;
  sceneProject: SceneProjectFile;
  activeSceneName: string;
  config?: AppConfig;
  onUpdateProject: (updater: (prev: SceneProjectFile) => SceneProjectFile) => void;
  subjects?: string[];
  characters?: Record<string, CharacterProfile>;
  onUpdateCharacter?: (profile: CharacterProfile, oldName?: string) => void;
  onRegisterSubject?: (name: string) => void;
  onAssetUploaded: (asset: MediaAsset, slotIndex?: number, type?: string) => void;
  onAssetDeleted: (filename: string) => void;
  onAssetUpdated: (oldFilename: string, newAsset: MediaAsset) => void;
  addToast?: (text: string, type?: "success" | "error" | "info") => void;
}

export const AssetManagerSection: React.FC<AssetManagerSectionProps> = ({
  assets,
  activeShotId,
  onSelectShot,
  sceneProject,
  activeSceneName,
  config,
  onUpdateProject,
  subjects = [],
  characters = {},
  onRegisterSubject = (_name: string) => {},
  onAssetUploaded,
  onAssetUpdated,
  addToast
}) => {
  const [activeTab, setActiveTab] = useState<"image" | "audio" | "video" | "takes">(() => getLastAssetTab("image"));

  useEffect(() => {
    setLastAssetTab(activeTab);
  }, [activeTab]);
  
  const [uploadModalSlot, setUploadModalSlot] = useState<{ type: "image" | "audio" | "video", index: number } | null>(null);
  const [editingAsset, setEditingAsset] = useState<MediaAsset | null>(null);
  const [lightboxAsset, setLightboxAsset] = useState<MediaAsset | null>(null);
  const [reviewTakeId, setReviewTakeId] = useState<string | null>(null);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [isAddCharacterModalOpen, setIsAddCharacterModalOpen] = useState(false);

  const activeShotIndex = sceneProject.shots.findIndex(s => s.id === activeShotId);
  const activeShot = activeShotIndex >= 0 ? sceneProject.shots[activeShotIndex] : null;

  const {
    draggingSlot,
    setDraggingSlot,
    dragOverSlot,
    setDragOverSlot,
    getGlobalSlotIndex,
    getAssetForGlobalSlot,
    handleDropOnSlot,
    handleClearSlot,
    handleAssetUploaded,
    projectSubjects
  } = useAssetManagerSlots({
    activeShot,
    activeShotId,
    assets,
    sceneProject,
    subjects,
    onUpdateProject,
    onAssetUploaded
  });

  const handleConfirmAddCharacterToShot = (characterName: string, slotsToAssign: Record<number, string>) => {
    if (!activeShotId) return;
    onUpdateProject(prev => {
      const shots = [...prev.shots];
      const idx = shots.findIndex(s => s.id === activeShotId);
      if (idx === -1) return prev;

      const currentChars = shots[idx].characters || [];
      const updatedChars = currentChars.some(c => c.toLowerCase() === characterName.toLowerCase())
        ? currentChars
        : [...currentChars, characterName];

      shots[idx] = {
        ...shots[idx],
        characters: updatedChars,
        assigned_slots: slotsToAssign,
        status: "unstaged",
        updated_at: new Date().toISOString()
      };

      return { ...prev, shots };
    });
  };

  const handleAddBlankShot = () => {
    const newId = "shot_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
    onUpdateProject(prev => {
      const newShot: ShotItem = {
        id: newId,
        shot_number: prev.shots.length + 1,
        shot_type: "Medium Shot",
        camera_movement: "Locked Off",
        lens_focal_length: "50mm Standard Prime",
        aspect_ratio: "16:9 Widescreen",
        basic_stub: "",
        expanded_prompt: "",
        assigned_slots: {},
        status: "unstaged",
        takes: [],
        updated_at: new Date().toISOString()
      };
      return { ...prev, shots: [...prev.shots, newShot] };
    });
    onSelectShot(newId);
  };

  const handleDuplicateShot = () => {
    if (!activeShot) return;
    const newId = "shot_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
    onUpdateProject(prev => {
      const duplicatedShot: ShotItem = {
        ...activeShot,
        id: newId,
        shot_number: prev.shots.length + 1,
        shot_name: activeShot.shot_name ? `${activeShot.shot_name} (Copy)` : undefined,
        status: "unstaged",
        takes: [],
        hero_take_id: undefined,
        assigned_slots: { ...(activeShot.assigned_slots || {}) },
        characters: activeShot.characters ? [...activeShot.characters] : [],
        updated_at: new Date().toISOString()
      };
      return { ...prev, shots: [...prev.shots, duplicatedShot] };
    });
    onSelectShot(newId);
  };

  return (
    <div id="assets-section" className="w-full space-y-5 flex flex-col min-h-0">
      {/* Unified Shot Dossier Card */}
      <ShotDossierCard
        shots={sceneProject.shots}
        activeShotId={activeShotId}
        onSelectShot={onSelectShot}
        assets={assets}
        sceneName={activeSceneName}
        onNewShot={handleAddBlankShot}
        onDuplicateShot={activeShot ? handleDuplicateShot : undefined}
      />

      {!activeShotId ? (
        <EmptyShotState />
      ) : (
        <>
          {activeShot && (
            <>
              <ScenePlanningHeader 
                planning={{
                  scene_name: activeShot.shot_name || "",
                  shot_number: activeShot.shot_number.toString(),
                  shot_type: activeShot.shot_type,
                  camera_movement: activeShot.camera_movement,
                  lens_focal_length: activeShot.lens_focal_length || "50mm Standard Prime",
                  aspect_ratio: activeShot.aspect_ratio || "16:9 Widescreen"
                }} 
                onAddCharacter={() => setIsAddCharacterModalOpen(true)}
                onChangePlanning={(newPlanning) => {
                  onUpdateProject(prev => {
                    const shots = [...prev.shots];
                    const idx = shots.findIndex(s => s.id === activeShot.id);
                    if (idx !== -1) {
                      shots[idx] = {
                        ...shots[idx],
                        shot_name: newPlanning.scene_name,
                        shot_number: parseInt(String(newPlanning.shot_number)) || shots[idx].shot_number,
                        shot_type: newPlanning.shot_type,
                        camera_movement: newPlanning.camera_movement,
                        lens_focal_length: newPlanning.lens_focal_length || "50mm Standard Prime",
                        aspect_ratio: newPlanning.aspect_ratio || "16:9 Widescreen",
                        updated_at: new Date().toISOString()
                      };
                    }
                    return { ...prev, shots };
                  });
                }}
              />

              {activeShot.takes && activeShot.takes.length > 0 && activeTab !== "takes" && (
                <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 shadow-xs -mt-2">
                  <TakeSelector 
                    shot={activeShot} 
                    onSetHeroTake={(tid) => onUpdateProject(prev => {
                      const shots = [...prev.shots];
                      const idx = shots.findIndex(s => s.id === activeShot.id);
                      if (idx !== -1) {
                        const updatedTakes = (shots[idx].takes || []).map(t => ({
                          ...t,
                          is_hero: t.id === tid
                        }));
                        shots[idx] = { ...shots[idx], hero_take_id: tid, takes: updatedTakes };
                      }
                      return { ...prev, shots };
                    })}
                    onReviewTake={setReviewTakeId}
                  />
                </div>
              )}
              
              {/* Media Slot Tab Bar */}
              <AssetTabBar 
                activeTab={activeTab}
                onSelectTab={setActiveTab}
                takesCount={activeShot?.takes?.length || 0}
              />
              
              {activeTab === "takes" ? (
                <ShotTakesManager
                  shot={activeShot}
                  sceneName={sceneProject.scene_name || activeSceneName}
                  onUpdateShot={(updatedShot) => {
                    onUpdateProject(prev => {
                      const shots = [...prev.shots];
                      const idx = shots.findIndex(s => s.id === updatedShot.id);
                      if (idx !== -1) {
                        shots[idx] = updatedShot;
                      }
                      return { ...prev, shots };
                    });
                  }}
                  onReviewTake={setReviewTakeId}
                  onCompareTakes={() => setShowCompareModal(true)}
                />
              ) : (
                <AssetSlotsView
                  activeTab={activeTab}
                  draggingSlot={draggingSlot}
                  dragOverSlot={dragOverSlot}
                  getGlobalSlotIndex={getGlobalSlotIndex}
                  getAssetForGlobalSlot={getAssetForGlobalSlot}
                  onEditAsset={(asset) => setEditingAsset(asset)}
                  onClearSlot={handleClearSlot}
                  onLightbox={(asset) => setLightboxAsset(asset)}
                  onOpenUpload={setUploadModalSlot}
                  onDragStart={(info, e) => {
                    setDraggingSlot(info);
                    e.dataTransfer.setData("text/plain", JSON.stringify(info));
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => {
                    setDraggingSlot(null);
                    setDragOverSlot(null);
                  }}
                  onDragOver={(globalSlot, e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (dragOverSlot !== globalSlot) {
                      setDragOverSlot(globalSlot);
                    }
                  }}
                  onDragLeave={(globalSlot) => {
                    if (dragOverSlot === globalSlot) {
                      setDragOverSlot(null);
                    }
                  }}
                  onDropOnSlot={(type, idx, e) => {
                    e.preventDefault();
                    handleDropOnSlot(type, idx);
                  }}
                />
              )}
            </>
          )}
        </>
      )}

      {/* Upload Modal */}
      <AssetUploadModal 
        isOpen={!!uploadModalSlot}
        activeTab={activeTab === "takes" ? "image" : activeTab}
        uploadModalSlot={uploadModalSlot}
        libraryAssets={assets}
        subjects={projectSubjects}
        characters={characters}
        sceneName={activeSceneName}
        config={config}
        onRegisterSubject={onRegisterSubject}
        onClose={() => setUploadModalSlot(null)}
        onAssetUploaded={handleAssetUploaded}
      />

      {/* Edit Modal */}
      <AssetEditModal
        asset={editingAsset}
        subjects={projectSubjects}
        characters={characters}
        config={config}
        onRegisterSubject={onRegisterSubject}
        onClose={() => setEditingAsset(null)}
        onAssetUpdated={(oldFilename, newAsset) => {
          onAssetUpdated(oldFilename, newAsset);
        }}
      />

      {/* Lightbox */}
      <AssetLightbox 
        asset={lightboxAsset}
        onClose={() => setLightboxAsset(null)}
      />

      {/* Take Review & Comparison Modals */}
      <TakeModalsContainer
        activeShot={activeShot}
        sceneProject={sceneProject}
        activeSceneName={activeSceneName}
        assets={assets}
        reviewTakeId={reviewTakeId}
        showCompareModal={showCompareModal}
        isAddCharacterModalOpen={isAddCharacterModalOpen}
        onCloseReview={() => setReviewTakeId(null)}
        onCloseCompare={() => setShowCompareModal(false)}
        onCloseAddCharacter={() => setIsAddCharacterModalOpen(false)}
        onUpdateProject={onUpdateProject}
        onConfirmAddCharacterToShot={handleConfirmAddCharacterToShot}
        onAssetUploaded={onAssetUploaded}
        addToast={addToast}
      />
    </div>
  );
};
