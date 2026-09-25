
import React, { useState, useMemo, useEffect } from "react";
import { SceneProjectFile, ShotItem, MediaAsset, AppConfig, CharacterProfile, UniverseCharacterProfile, ScenePlanningDetails } from "../types";
import { ComfyMonitorState } from "../hooks/useComfyMonitor";
import { TakeReviewModal } from "./TakeReviewModal";
import { TakeComparisonModal } from "./TakeComparisonModal";
import { ShotCarousel } from "./hub/ShotCarousel";
import { ShotCharacterRoster } from "./hub/ShotCharacterRoster";
import { AssetMatrixPanel } from "./hub/AssetMatrixPanel";
import { PromptPreviewPanel } from "./hub/PromptPreviewPanel";
import { AiReferenceStagingStudioModal } from "./cast/AiReferenceStagingStudioModal";
import { SceneSketchImportModal } from "./scenes/SceneSketchImportModal";
import { ScenePlanModal } from "./scenes/ScenePlanModal";
import { fetchUniverseCharacters, fetchUniverseAssets } from "../utils/universeApi";
import { Film, Sparkles, Plus, Compass, ShieldCheck } from "lucide-react";

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
  monitorState?: ComfyMonitorState;
  onOpenScenePlan?: () => void;
  hasScenePlan?: boolean;
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
  onNavigate,
  monitorState,
  onOpenScenePlan,
  hasScenePlan
}: Props) {
  const [reviewTakeId, setReviewTakeId] = useState<string | null>(null);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [isStagingStudioOpen, setIsStagingStudioOpen] = useState(false);
  const [stagingStudioTab, setStagingStudioTab] = useState<"headshots" | "staging">("staging");
  
  // Scene Sketch Import Modal State
  const [isSketchImportOpen, setIsSketchImportOpen] = useState(false);
  const [isScenePlanOpen, setIsScenePlanOpen] = useState(false);
  const [universeCharacters, setUniverseCharacters] = useState<Record<string, UniverseCharacterProfile>>({});
  const [universeAssets, setUniverseAssets] = useState<MediaAsset[]>([]);

  const handleSaveScenePlan = (payload: {
    sceneName: string;
    planning: Partial<ScenePlanningDetails>;
  }) => {
    onUpdateProject((prev) => ({
      ...prev,
      scene_name: payload.sceneName || prev.scene_name,
      scene_planning: {
        ...(prev.scene_planning || {}),
        ...payload.planning
      },
      updated_at: new Date().toISOString()
    }));
    onShowToast("Scene Plan updated.", "success");
  };

  // Fetch universe roster & media pool whenever import modal is triggered
  useEffect(() => {
    if (isSketchImportOpen) {
      fetchUniverseCharacters().then(chars => setUniverseCharacters(chars || {}));
      fetchUniverseAssets().then(ass => setUniverseAssets(ass || []));
    }
  }, [isSketchImportOpen]);

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

  const handleDuplicateActiveShot = () => {
    if (!activeShot) return;
    const newId = "shot_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
    onUpdateProject((prev) => {
      const idx = prev.shots.findIndex(s => s.id === activeShot.id);
      const duplicatedShot: ShotItem = {
        ...activeShot,
        id: newId,
        shot_number: activeShot.shot_number + 1,
        shot_name: activeShot.shot_name ? `${activeShot.shot_name} (Copy)` : undefined,
        status: "unstaged",
        takes: [],
        hero_take_id: undefined,
        assigned_slots: { ...(activeShot.assigned_slots || {}) },
        characters: activeShot.characters ? [...activeShot.characters] : [],
        updated_at: new Date().toISOString()
      };
      const shots = [...prev.shots];
      shots.splice(idx + 1, 0, duplicatedShot);
      shots.forEach((s, i) => s.shot_number = i + 1);
      return { ...prev, shots };
    });
    onSelectShot(newId);
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

  const handleSketchImportSuccess = (payload: {
    shotsToInsert: Partial<ShotItem>[];
    importMode: "append" | "replace";
    charactersToImport: UniverseCharacterProfile[];
    assetsToImport: MediaAsset[];
    sceneTitle?: string;
  }) => {
    const { shotsToInsert, importMode, charactersToImport, assetsToImport, sceneTitle } = payload;
    if (!shotsToInsert || shotsToInsert.length === 0) return;

    // Convert universe character profiles into scene character profiles
    const importedCharactersMap: Record<string, CharacterProfile> = {};
    charactersToImport.forEach((uChar) => {
      importedCharactersMap[uChar.name] = {
        id: uChar.id || `char_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: uChar.name,
        notes: uChar.notes || "",
        quick_slots: uChar.quick_slots || uChar.universe_slots || [],
        scene_outfit_ref: uChar.scene_outfit_ref || uChar.default_outfit_ref || "",
        is_location: uChar.is_location,
        in_universe: true,
        universe_slots: uChar.universe_slots || [],
        default_outfit_ref: uChar.default_outfit_ref || "",
        source_scene: uChar.source_scene,
        created_at: uChar.created_at,
        updated_at: new Date().toISOString()
      };
    });

    // Upload / register universe assets into active scene asset pool if present
    if (assetsToImport && assetsToImport.length > 0 && onAssetUploaded) {
      assetsToImport.forEach(a => onAssetUploaded(a));
    }

    let firstNewShotId: string | null = null;

    onUpdateProject((prev) => {
      let nextShots: ShotItem[] = [];
      if (importMode === "replace") {
        nextShots = shotsToInsert.map((s, idx) => {
          const item: ShotItem = {
            id: s.id || `shot_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
            shot_name: s.shot_name || `Shot ${idx + 1}`,
            shot_number: idx + 1,
            shot_type: s.shot_type || "Medium Shot",
            camera_movement: s.camera_movement || "Locked Off",
            lens_focal_length: s.lens_focal_length || "50mm Standard Prime",
            aspect_ratio: s.aspect_ratio || "16:9 Widescreen",
            basic_stub: s.basic_stub || "",
            expanded_prompt: s.expanded_prompt || "",
            prompt_variations: s.prompt_variations || [],
            active_variation_id: s.active_variation_id,
            characters: s.characters || [],
            assigned_slots: s.assigned_slots || {},
            status: s.status || "unstaged",
            takes: s.takes || [],
            updated_at: s.updated_at || new Date().toISOString()
          };
          if (idx === 0) firstNewShotId = item.id;
          return item;
        });
      } else {
        const existingLen = prev.shots.length;
        const renumberedNewShots = shotsToInsert.map((s, idx) => {
          const item: ShotItem = {
            id: s.id || `shot_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
            shot_name: s.shot_name || `Shot ${existingLen + idx + 1}`,
            shot_number: existingLen + idx + 1,
            shot_type: s.shot_type || "Medium Shot",
            camera_movement: s.camera_movement || "Locked Off",
            lens_focal_length: s.lens_focal_length || "50mm Standard Prime",
            aspect_ratio: s.aspect_ratio || "16:9 Widescreen",
            basic_stub: s.basic_stub || "",
            expanded_prompt: s.expanded_prompt || "",
            prompt_variations: s.prompt_variations || [],
            active_variation_id: s.active_variation_id,
            characters: s.characters || [],
            assigned_slots: s.assigned_slots || {},
            status: s.status || "unstaged",
            takes: s.takes || [],
            updated_at: s.updated_at || new Date().toISOString()
          };
          if (idx === 0) firstNewShotId = item.id;
          return item;
        });
        nextShots = [...prev.shots, ...renumberedNewShots];
      }

      const updatedCharacters = {
        ...(prev.characters || {}),
        ...importedCharactersMap
      };

      const updatedSubjects = Array.from(
        new Set([...(prev.subjects || []), ...Object.keys(importedCharactersMap)])
      );

      return {
        ...prev,
        scene_name: sceneTitle && sceneTitle.trim() ? sceneTitle.trim() : prev.scene_name,
        shots: nextShots,
        characters: updatedCharacters,
        subjects: updatedSubjects
      };
    });

    if (firstNewShotId) {
      onSelectShot(firstNewShotId);
    }

    const charCount = charactersToImport.length;
    if (charCount > 0) {
      const charNames = charactersToImport.map(c => c.name).join(", ");
      onShowToast(`Imported ${shotsToInsert.length} shot${shotsToInsert.length !== 1 ? "s" : ""} & synced ${charCount} Universe character${charCount !== 1 ? "s" : ""} (${charNames})`, "success");
    } else {
      onShowToast(`Successfully imported ${shotsToInsert.length} shot${shotsToInsert.length !== 1 ? "s" : ""} into scene`, "success");
    }
  };

  return (
    <div className="w-full flex flex-col h-full space-y-5">
      {/* Scene Controls & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400">
            <Film className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {project.scene_name || "Untitled Scene"}
              </h1>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                {project.shots.length} {project.shots.length === 1 ? "Shot" : "Shots"}
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Manage shots, camera setups, reference assets, and prompts
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent("open-assistant-with-prompt", {
                detail: {
                  prompt: "Please run a complete Script Supervisor & Cinematography Continuity Audit across all shots in this scene. Check character wardrobe continuity, reference photo completeness, lighting coherence, and camera motion constraints, and propose any needed action fixes."
                }
              }));
              onShowToast("Dispatched Continuity Audit to Script Supervisor Assistant...", "info");
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-500 text-white shadow-xs transition-colors cursor-pointer"
            title="Run AI Script Supervisor Continuity Audit across all shots"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Audit Continuity</span>
          </button>
          <button
            onClick={() => setIsSketchImportOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors cursor-pointer"
            title="Import text sketch or screenplay and parse into shots"
          >
            <Sparkles className="w-4 h-4" />
            <span>Import Sketch</span>
          </button>
          <button
            onClick={handleAddBlankShot}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 shadow-xs transition-colors cursor-pointer"
            title="Add a new blank shot to this scene"
          >
            <Plus className="w-4 h-4" />
            <span>New Shot</span>
          </button>
        </div>
      </div>

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
        monitorState={monitorState}
      />

      {activeShot ? (
        <div className="flex-1 flex flex-col min-h-0 space-y-6">
          <ShotCharacterRoster
            activeShot={activeShot}
            sceneProject={project}
            assets={assets}
            onNavigateToCast={onNavigate ? () => onNavigate("cast") : undefined}
            onSelectShot={onSelectShot}
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
        <div className="flex-1 flex flex-col items-center justify-center p-12 bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-xl min-h-[400px] shadow-xs">
          <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-300 mb-2">No Shot Selected</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center max-w-md">
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
            onShowToast(`Take set as hero take`, "success");
          }}
          onUpdateRating={(rating) => {
            onUpdateProject(prev => {
              const shots = [...prev.shots];
              const idx = shots.findIndex(s => s.id === activeShot.id);
              if (idx !== -1) {
                const updatedTakes = (shots[idx].takes || []).map(t => {
                  if (t.id === reviewTakeId) {
                    return {
                      ...t,
                      rating,
                      review_status: rating === "good" ? "approved" as const : rating === "bad" ? "needs_work" as const : "unreviewed" as const
                    };
                  }
                  return t;
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
                  if (t.id === reviewTakeId) {
                    return { ...t, notes };
                  }
                  return t;
                });
                shots[idx] = { ...shots[idx], takes: updatedTakes };
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
            onShowToast("Restored LoRA settings from take to active shot!", "success");
          }}
        />
      )}

      {isComparisonOpen && activeShot && (
        <TakeComparisonModal
          shot={activeShot}
          sceneName={project.scene_name}
          onClose={() => setIsComparisonOpen(false)}
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
            onShowToast("Restored LoRA settings to active shot!", "success");
          }}
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
            onShowToast(`Hero take updated from Comparison`, "success");
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

      <SceneSketchImportModal
        isOpen={isSketchImportOpen}
        onClose={() => setIsSketchImportOpen(false)}
        existingShotsCount={project.shots.length}
        sceneCast={project.characters || {}}
        universeCast={universeCharacters}
        universeAssets={universeAssets}
        existingSceneAssets={assets}
        lmStudioUrl={config.lm_studio_url}
        onImportSuccess={handleSketchImportSuccess}
      />

      <ScenePlanModal
        isOpen={isScenePlanOpen}
        onClose={() => setIsScenePlanOpen(false)}
        sceneName={project.scene_name}
        scenePlanning={project.scene_planning}
        onSave={handleSaveScenePlan}
      />
    </div>
  );
}
