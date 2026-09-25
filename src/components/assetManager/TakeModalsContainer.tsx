import React from "react";
import { MediaAsset, SceneProjectFile, ShotItem } from "../../types";
import { TakeReviewModal } from "../TakeReviewModal";
import { TakeComparisonModal } from "../TakeComparisonModal";
import { AddCharacterToShotModal } from "../hub/AddCharacterToShotModal";
import { extractAndUploadTakeLastFrame } from "../../utils/frameExtraction";

interface TakeModalsContainerProps {
  activeShot: ShotItem | null;
  sceneProject: SceneProjectFile;
  activeSceneName: string;
  assets: MediaAsset[];
  reviewTakeId: string | null;
  showCompareModal: boolean;
  isAddCharacterModalOpen: boolean;
  onCloseReview: () => void;
  onCloseCompare: () => void;
  onCloseAddCharacter: () => void;
  onUpdateProject: (updater: (prev: SceneProjectFile) => SceneProjectFile) => void;
  onConfirmAddCharacterToShot: (characterName: string, slotsToAssign: Record<number, string>) => void;
  onAssetUploaded?: (asset: MediaAsset, slotIndex?: number, type?: string) => void;
  addToast?: (text: string, type?: "success" | "error" | "info") => void;
}

/**
 * Handles review modals, take comparison flows, and frame extraction chaining.
 */
export const TakeModalsContainer: React.FC<TakeModalsContainerProps> = ({
  activeShot,
  sceneProject,
  activeSceneName,
  assets,
  reviewTakeId,
  showCompareModal,
  isAddCharacterModalOpen,
  onCloseReview,
  onCloseCompare,
  onCloseAddCharacter,
  onUpdateProject,
  onConfirmAddCharacterToShot,
  onAssetUploaded,
  addToast
}) => {
  if (!activeShot) return null;

  const reviewTake = reviewTakeId ? activeShot.takes?.find(t => t.id === reviewTakeId) : null;

  return (
    <>
      {reviewTakeId && reviewTake && (
        <TakeReviewModal
          take={reviewTake}
          sceneName={sceneProject.scene_name || "Untitled_Scene"}
          shotNumber={activeShot.shot_number}
          variations={activeShot.prompt_variations}
          onClose={onCloseReview}
          onSetHero={() => {
            onUpdateProject(prev => {
              const shots = [...prev.shots];
              const idx = shots.findIndex(s => s.id === activeShot.id);
              if (idx !== -1) {
                const updatedTakes = (shots[idx].takes || []).map(t => ({
                  ...t,
                  is_hero: t.id === reviewTakeId
                }));
                shots[idx] = { ...shots[idx], hero_take_id: reviewTakeId, takes: updatedTakes };
              }
              return { ...prev, shots };
            });
            onCloseReview();
          }}
          onUpdateRating={(rating) => {
            onUpdateProject(prev => {
              const shots = [...prev.shots];
              const idx = shots.findIndex(s => s.id === activeShot.id);
              if (idx !== -1) {
                const updatedTakes = (shots[idx].takes || []).map(t => {
                  if (t.id !== reviewTakeId) return t;
                  const newReviewStatus = rating === "good" ? "approved" : rating === "bad" ? "needs_work" : "unreviewed";
                  return { ...t, rating, review_status: newReviewStatus };
                });
                shots[idx] = { ...shots[idx], takes: updatedTakes };
              }
              return { ...prev, shots };
            });
          }}
          onUpdateNotes={(notes) => {
            onUpdateProject(prev => {
              const shots = [...prev.shots];
              const idx = shots.findIndex(s => s.id === activeShot.id);
              if (idx !== -1) {
                const updatedTakes = (shots[idx].takes || []).map(t => {
                  if (t.id !== reviewTakeId) return t;
                  return { ...t, notes };
                });
                shots[idx] = { ...shots[idx], takes: updatedTakes };
              }
              return { ...prev, shots };
            });
          }}
          onChainLastFrameToNextShot={async (take, videoUrl) => {
            try {
              const shots = sceneProject.shots || [];
              const currentIdx = shots.findIndex(s => s.id === activeShot.id);
              const nextShot = currentIdx >= 0 && currentIdx < shots.length - 1 ? shots[currentIdx + 1] : null;
              
              const targetShotNumber = nextShot ? nextShot.shot_number : (activeShot.shot_number || currentIdx + 1) + 1;
              const result = await extractAndUploadTakeLastFrame({
                videoUrl,
                sceneName: sceneProject.scene_name || activeSceneName,
                sourceShotNumber: activeShot.shot_number || currentIdx + 1,
                sourceTakeNumber: take.take_number,
                targetShotNumber
              });

              if (!result.success || !result.assetFilename) {
                throw new Error(result.error || "Frame extraction failed");
              }

              if (result.asset && onAssetUploaded) {
                onAssetUploaded(result.asset);
              }

              // If next shot exists in project, link directly to next shot's first_frame
              if (nextShot) {
                onUpdateProject(prev => {
                  const updatedShots = [...prev.shots];
                  const nIdx = updatedShots.findIndex(s => s.id === nextShot.id);
                  if (nIdx !== -1) {
                    updatedShots[nIdx] = {
                      ...updatedShots[nIdx],
                      first_frame: {
                        source: "last_frame_chain",
                        asset_filename: result.assetFilename!,
                        source_shot_id: activeShot.id,
                        source_shot_number: activeShot.shot_number,
                        source_take_number: take.take_number,
                        locked: true,
                        updated_at: new Date().toISOString()
                      }
                    };
                  }
                  return { ...prev, shots: updatedShots };
                });
                if (addToast) addToast(`Extracted final frame and locked as Shot ${nextShot.shot_number} Frame 0!`, "success");
              } else {
                if (addToast) addToast(`Extracted final frame (${result.assetFilename}) as asset.`, "success");
              }
            } catch (err: any) {
              console.error("Failed to chain last frame:", err);
              if (addToast) addToast(`Failed to chain frame: ${err.message}`, "error");
            }
          }}
          onRestoreLoras={(loraSlots) => {
            onUpdateProject(prev => {
              const shots = [...prev.shots];
              const idx = shots.findIndex(s => s.id === activeShot.id);
              if (idx !== -1) {
                shots[idx] = {
                  ...shots[idx],
                  lora_slots: JSON.parse(JSON.stringify(loraSlots))
                };
              }
              return { ...prev, shots };
            });
            if (addToast) addToast("Restored LoRA settings from take to active shot!", "success");
          }}
        />
      )}

      {showCompareModal && (
        <TakeComparisonModal
          shot={activeShot}
          sceneName={sceneProject.scene_name || activeSceneName}
          onClose={onCloseCompare}
          onSetHeroTake={(takeId) => {
            onUpdateProject(prev => {
              const shots = [...prev.shots];
              const idx = shots.findIndex(s => s.id === activeShot.id);
              if (idx !== -1) {
                const updatedTakes = (shots[idx].takes || []).map(t => ({
                  ...t,
                  is_hero: t.id === takeId
                }));
                shots[idx] = { ...shots[idx], hero_take_id: takeId, takes: updatedTakes };
              }
              return { ...prev, shots };
            });
          }}
          onRestoreLoras={(loraSlots) => {
            onUpdateProject(prev => {
              const shots = [...prev.shots];
              const idx = shots.findIndex(s => s.id === activeShot.id);
              if (idx !== -1) {
                shots[idx] = {
                  ...shots[idx],
                  lora_slots: JSON.parse(JSON.stringify(loraSlots))
                };
              }
              return { ...prev, shots };
            });
            if (addToast) addToast("Restored LoRA settings to active shot!", "success");
          }}
        />
      )}

      {isAddCharacterModalOpen && (
        <AddCharacterToShotModal
          isOpen={isAddCharacterModalOpen}
          onClose={onCloseAddCharacter}
          activeShot={activeShot}
          sceneProject={sceneProject}
          assets={assets}
          onConfirmAdd={onConfirmAddCharacterToShot}
          addToast={addToast}
        />
      )}
    </>
  );
};
