
import React, { useState, useMemo } from "react";
import { SceneProjectFile, ShotItem, MediaAsset, AppConfig } from "../types";
import { TakeReviewModal } from "./TakeReviewModal";
import { ShotCarousel } from "./hub/ShotCarousel";
import { ShotMetadataPanel } from "./hub/ShotMetadataPanel";
import { AssetMatrixPanel } from "./hub/AssetMatrixPanel";
import { PromptPreviewPanel } from "./hub/PromptPreviewPanel";
import { AiReferenceStagingStudioModal } from "./cast/AiReferenceStagingStudioModal";

interface Props {
  project: SceneProjectFile;
  onUpdateProject: (updater: (prev: SceneProjectFile) => SceneProjectFile) => void;
  config: AppConfig;
  assets: MediaAsset[];
  activeShotId: string | null;
  onSelectShot: (id: string | null) => void;
  onShowToast: (text: string, type?: "success" | "error" | "info") => void;
  onTransfer?: (shot: ShotItem) => Promise<boolean>;
  onTransferScene?: () => Promise<boolean>;
  onExpandPrompt?: (shot: ShotItem) => Promise<string>;
  onAssetUploaded?: (asset: MediaAsset, targetSlotIndex?: number) => void;
  onUpdateSpecificShot?: (id: string, updater: (prev: ShotItem) => ShotItem) => void;
  onNavigate?: (section: string) => void;
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
  onExpandPrompt,
  onAssetUploaded,
  onUpdateSpecificShot,
  onNavigate
}: Props) {
  const [reviewTakeId, setReviewTakeId] = useState<string | null>(null);
  const [isStagingStudioOpen, setIsStagingStudioOpen] = useState(false);
  const [stagingStudioTab, setStagingStudioTab] = useState<"headshots" | "staging">("staging");

  const activeShotIndex = project.shots.findIndex((s) => s.id === activeShotId);
  const activeShot = project.shots[activeShotIndex];

  // Derive active character context for the active shot
  const currentShotSubject = useMemo(() => {
    if (!activeShot) return Object.keys(project.characters || {})[0] || "";
    if (activeShot.ots_focus_subject) return activeShot.ots_focus_subject;
    if (activeShot.ots_anchor_subject) return activeShot.ots_anchor_subject;
    if (activeShot.assigned_slots) {
      for (const slotKey of Object.keys(activeShot.assigned_slots)) {
        const val = activeShot.assigned_slots[Number(slotKey)];
        if (val) {
          const matched = assets.find(a => a.filename === val);
          if (matched && matched.subject_name) return matched.subject_name;
        }
      }
    }
    return Object.keys(project.characters || {})[0] || "";
  }, [activeShot, project.characters, assets]);

  const updateActiveShot = (updater: (prev: ShotItem) => ShotItem) => {
    onUpdateProject((prev) => {
      const shots = [...prev.shots];
      const idx = shots.findIndex(s => s.id === activeShotId);
      if (idx !== -1) {
        shots[idx] = { ...updater(shots[idx]), updated_at: new Date().toISOString() };
        if (JSON.stringify(shots[idx]) !== JSON.stringify(prev.shots[idx])) {
            shots[idx].status = "unstaged";
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
        status: "unstaged",
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
      status: "unstaged",
      updated_at: new Date().toISOString()
    };
    onUpdateProject(prev => ({ ...prev, shots: [...prev.shots, newShot] }));
    onSelectShot(newShot.id);
  };

  const handleClearSlot = (slotIndex: number) => {
    updateActiveShot(prev => {
      const next = { ...prev.assigned_slots };
      delete next[slotIndex];
      delete (next as any)[String(slotIndex)];
      if (slotIndex === 8) {
        delete next[9];
        delete (next as any)["9"];
      }
      return { ...prev, assigned_slots: next };
    });
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
            sceneName={project.scene_name}
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

          <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0 items-stretch">
            <AssetMatrixPanel 
              activeShot={activeShot}
              assets={assets}
              onClearSlot={handleClearSlot}
            />
            
            <PromptPreviewPanel 
              activeShot={activeShot}
              onSelectVariation={(variation) => {
                updateActiveShot(prev => ({
                  ...prev,
                  expanded_prompt: variation.expanded_prompt,
                  basic_stub: variation.basic_stub || prev.basic_stub,
                  active_variation_id: variation.id,
                  status: "unstaged"
                }));
                onShowToast(`Active variation switched to ${variation.label || `Variation ${variation.variation_number}`}`, "info");
              }}
              addToast={onShowToast}
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-12 bg-zinc-900/40 border border-zinc-800 rounded-xl min-h-[400px]">
          <h2 className="text-xl font-semibold text-zinc-300 mb-2">No Shot Selected</h2>
          <p className="text-sm text-zinc-500 text-center max-w-md">
            Select an existing shot card from the top carousel, or click the + button to create a new shot and assign camera planning.
          </p>
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

      <AiReferenceStagingStudioModal
        isOpen={isStagingStudioOpen}
        onClose={() => setIsStagingStudioOpen(false)}
        initialTab={stagingStudioTab}
        subjectName={currentShotSubject}
        activeSceneName={project.scene_name}
        characters={project.characters || {}}
        subjects={project.characters ? Object.keys(project.characters) : []}
        allAssets={assets}
        sceneProject={project}
        activeShotId={activeShotId}
        onUpdateShot={activeShotId ? updateActiveShot : undefined}
        onUpdateProject={onUpdateProject}
        onAssetSaved={onAssetUploaded}
        addToast={onShowToast}
      />
    </div>
  );
}
