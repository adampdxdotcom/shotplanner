
import React, { useState } from "react";
import { SceneProjectFile, ShotItem, MediaAsset, AppConfig } from "../types";
import { TakeReviewModal } from "./TakeReviewModal";
import { UploadCloud } from "lucide-react";
import { ShotCarousel } from "./hub/ShotCarousel";
import { ShotMetadataPanel } from "./hub/ShotMetadataPanel";
import { AssetMatrixPanel } from "./hub/AssetMatrixPanel";
import { PromptEngineeringPanel } from "./hub/PromptEngineeringPanel";

interface Props {
  project: SceneProjectFile;
  onUpdateProject: (updater: (prev: SceneProjectFile) => SceneProjectFile) => void;
  config: AppConfig;
  assets: MediaAsset[];
  activeShotId: string | null;
  onSelectShot: (id: string | null) => void;
  onShowToast: (text: string, type?: "success" | "error" | "info") => void;
  onTransfer: (shot: ShotItem) => Promise<boolean>;
  onTransferScene: () => Promise<boolean>;
  onExpandPrompt: (shot: ShotItem) => Promise<string>;
}

export default function SceneProjectHub({
  project,
  onUpdateProject,
  config,
  assets,
  activeShotId,
  onSelectShot,
  onShowToast,
  onTransfer,
  onTransferScene,
  onExpandPrompt
}: Props) {
  const [isExpanding, setIsExpanding] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [reviewTakeId, setReviewTakeId] = useState<string | null>(null);
  const [isTransferringScene, setIsTransferringScene] = useState(false);

  const activeShotIndex = project.shots.findIndex((s) => s.id === activeShotId);
  const activeShot = project.shots[activeShotIndex];

  const updateActiveShot = (updater: (prev: ShotItem) => ShotItem) => {
    onUpdateProject((prev) => {
      const shots = [...prev.shots];
      const idx = shots.findIndex(s => s.id === activeShotId);
      if (idx !== -1) {
        shots[idx] = { ...updater(shots[idx]), updated_at: new Date().toISOString() };
        if (JSON.stringify(shots[idx]) !== JSON.stringify(prev.shots[idx])) {
            shots[idx].staged = false;
        }
      }
      return { ...prev, shots };
    });
  };

  const handleDuplicateShot = (shot: ShotItem, e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateProject((prev) => {
      const idx = prev.shots.findIndex(s => s.id === shot.id);
      const newShot: ShotItem = {
        ...shot,
        id: "shot_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
        shot_number: shot.shot_number + 1,
        lens_focal_length: shot.lens_focal_length || "50mm Standard Prime",
        aspect_ratio: shot.aspect_ratio || "16:9 Widescreen",
        staged: false,
        updated_at: new Date().toISOString()
      };
      const shots = [...prev.shots];
      shots.splice(idx + 1, 0, newShot);
      shots.forEach((s, i) => s.shot_number = i + 1);
      return { ...prev, shots };
    });
  };

  const handleDeleteShot = (shotId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this shot?")) return;
    onUpdateProject((prev) => {
      const shots = prev.shots.filter(s => s.id !== shotId);
      shots.forEach((s, i) => s.shot_number = i + 1);
      return { ...prev, shots };
    });
    if (activeShotId === shotId) {
      onSelectShot(null);
    }
  };

  const handleAddBlankShot = () => {
    const newShot: ShotItem = {
      id: "shot_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      shot_number: project.shots.length + 1,
      shot_type: "Medium Shot",
      camera_movement: "Locked Off",
      lens_focal_length: "50mm Standard Prime",
      aspect_ratio: "16:9 Widescreen",
      basic_stub: "",
      expanded_prompt: "",
      assigned_slots: {},
      staged: false,
      updated_at: new Date().toISOString()
    };
    onUpdateProject(prev => ({ ...prev, shots: [...prev.shots, newShot] }));
    onSelectShot(newShot.id);
  };

  const handleClearSlot = (slotIndex: number) => {
    updateActiveShot(prev => {
      const next = { ...prev.assigned_slots };
      delete next[slotIndex];
      return { ...prev, assigned_slots: next };
    });
  };

  const handleExpandPrompt = async () => {
    if (!activeShot) return;
    setIsExpanding(true);
    try {
      const prompt = await onExpandPrompt(activeShot);
      updateActiveShot(prev => ({ ...prev, expanded_prompt: prompt }));
    } catch (e: any) {
      onShowToast(e.message || "Failed to expand prompt", "error");
    } finally {
      setIsExpanding(false);
    }
  };

  const handleTransferSceneAction = async () => {
    setIsTransferringScene(true);
    try {
      const success = await onTransferScene();
      if (success) {
        onUpdateProject(prev => {
          const updatedShots = prev.shots.map(s => ({ ...s, staged: true }));
          return { ...prev, shots: updatedShots };
        });
        onShowToast("Scene staged successfully!", "success");
      }
    } catch (e: any) {
      onShowToast(e.message || "Scene transfer failed", "error");
    } finally {
      setIsTransferringScene(false);
    }
  };

  const handleTransferShotAction = async () => {
    if (!activeShot) return;
    setIsTransferring(true);
    try {
      const success = await onTransfer(activeShot);
      if (success) {
        updateActiveShot(prev => ({ ...prev, staged: true }));
        onShowToast("Shot staged successfully!", "success");
      }
    } catch (e: any) {
      onShowToast(e.message || "Transfer failed", "error");
    } finally {
      setIsTransferring(false);
    }
  };

  const handleReorderShots = (newShots: ShotItem[]) => {
    onUpdateProject(prev => ({ ...prev, shots: newShots }));
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      <ShotCarousel 
        sceneName={project.scene_name}
        shots={project.shots}
        assets={assets}
        activeShotId={activeShotId}
        onSelectShot={onSelectShot}
        onAddBlankShot={handleAddBlankShot}
        onDuplicateShot={handleDuplicateShot}
        onDeleteShot={handleDeleteShot}
        onReorderShots={handleReorderShots}
      />

      {activeShot ? (
        <div className="flex-1 flex flex-col min-h-0 space-y-6">
          <ShotMetadataPanel 
            activeShot={activeShot}
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

          <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
            <AssetMatrixPanel 
              activeShot={activeShot}
              assets={assets}
              onClearSlot={handleClearSlot}
            />
            
            <PromptEngineeringPanel 
              activeShot={activeShot}
              projectShotsLength={project.shots.length}
              isExpanding={isExpanding}
              isTransferring={isTransferring}
              isTransferringScene={isTransferringScene}
              onUpdateStub={(stub) => updateActiveShot(prev => ({ ...prev, basic_stub: stub }))}
              onUpdateExpandedPrompt={(prompt) => updateActiveShot(prev => ({ ...prev, expanded_prompt: prompt }))}
              onExpandPrompt={handleExpandPrompt}
              onTransferShot={handleTransferShotAction}
              onTransferScene={handleTransferSceneAction}
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-12 bg-zinc-900/40 border border-zinc-800 rounded-xl min-h-[400px]">
          <h2 className="text-xl font-semibold text-zinc-300 mb-2">No Shot Selected</h2>
          <p className="text-sm text-zinc-500 mb-6 text-center max-w-md">
            Select an existing shot card from the top carousel, or click the + button to create a new shot and assign camera planning.
          </p>
          {project.shots.length > 0 && (
            <button
              onClick={handleTransferSceneAction}
              disabled={isTransferringScene}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow"
            >
              <UploadCloud className="w-5 h-5" />
              {isTransferringScene ? "Sending Scene..." : "Send Scene"}
            </button>
          )}
        </div>
      )}

      {reviewTakeId && activeShot && activeShot.takes && (
        <TakeReviewModal
          take={activeShot.takes.find(t => t.id === reviewTakeId)!}
          sceneName={project.scene_name}
          shotNumber={activeShot.shot_number}
          onClose={() => setReviewTakeId(null)}
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
          }}
        />
      )}
    </div>
  );
}
