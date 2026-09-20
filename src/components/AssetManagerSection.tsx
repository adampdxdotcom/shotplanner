import React, { useState, useEffect } from "react";
import { AppConfig, MediaAsset, SceneProjectFile, ShotItem, CharacterProfile } from "../types";
import { 
  FileImage, 
  Trash2, 
  Image as ImageIcon,
  Video as VideoIcon,
  Music,
  Clapperboard,
  UserPlus
} from "lucide-react";
import { ScenePlanningHeader } from "./ScenePlanningHeader";
import { TakeSelector } from "./TakeSelector";
import { TakeReviewModal } from "./TakeReviewModal";
import { TakeComparisonModal } from "./TakeComparisonModal";
import { ShotTakesManager } from "./ShotTakesManager";
import { AssetUploadModal } from "./AssetUploadModal";
import { AssetEditModal } from "./AssetEditModal";
import { AssetLightbox } from "./AssetLightbox";
import { AssetCard, EmptySlotCard } from "./AssetSlotGrid";
import { toCanonicalSubjectName } from "../utils/subjectUtils";
import { getLastAssetTab, setLastAssetTab } from "../utils/workspaceSessionStore";
import { AddCharacterToShotModal } from "./hub/AddCharacterToShotModal";
import { extractAndUploadTakeLastFrame } from "../utils/frameExtraction";

const MAX_IMAGES = 9;
const MAX_VIDEOS = 1;
const MAX_AUDIOS = 3;

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
  onUpdateCharacter,
  onRegisterSubject = (_name: string) => {},
  onAssetUploaded,
  onAssetDeleted,
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
  const [draggingSlot, setDraggingSlot] = useState<{ type: string; localIdx: number; globalSlot: number } | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  const [isAddCharacterModalOpen, setIsAddCharacterModalOpen] = useState(false);

  const activeShotIndex = sceneProject.shots.findIndex(s => s.id === activeShotId);
  const activeShot = activeShotIndex >= 0 ? sceneProject.shots[activeShotIndex] : null;

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
    onUpdateProject(prev => {
      const newShot: ShotItem = {
        id: "shot_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
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
  };

  const getGlobalSlotIndex = (type: "image" | "audio" | "video", localIndex: number) => {
    if (type === "image") return localIndex;
    if (type === "video") return MAX_IMAGES; // Slot 9: single video upload per shot
    return MAX_IMAGES + 3 + localIndex; // Audio slots: 12, 13, 14
  };

  const getLocalSlotIndex = (globalIndex: number): { type: "image"|"audio"|"video", index: number } => {
    if (globalIndex < MAX_IMAGES) return { type: "image", index: globalIndex };
    if (globalIndex < MAX_IMAGES + 3) return { type: "video", index: 0 };
    return { type: "audio", index: globalIndex - (MAX_IMAGES + 3) };
  };

  const getAssetForGlobalSlot = (globalSlotStr: string): MediaAsset | null => {
    if (!activeShot || !activeShot.assigned_slots) return null;
    let filename = activeShot.assigned_slots[globalSlotStr] || (activeShot.assigned_slots as any)[Number(globalSlotStr)];
    if (!filename && globalSlotStr === "9") {
      filename = activeShot.assigned_slots[10] || (activeShot.assigned_slots as any)["10"] || 
                 activeShot.assigned_slots[11] || (activeShot.assigned_slots as any)["11"];
    }
    if (!filename) return null;
    return assets.find(a => a.filename === filename) || null;
  };

  // Drag and drop slot movement / swapping handler
  const handleDropOnSlot = (targetType: "image" | "audio" | "video", targetIdx: number) => {
    setDragOverSlot(null);
    if (!draggingSlot || !activeShotId) return;

    // Enforce matching media types (cannot drag audio into image slot, etc.)
    if (draggingSlot.type !== targetType) {
      setDraggingSlot(null);
      return;
    }

    const sourceGlobalSlot = draggingSlot.globalSlot;
    const targetGlobalSlot = getGlobalSlotIndex(targetType, targetIdx);

    if (sourceGlobalSlot === targetGlobalSlot) {
      setDraggingSlot(null);
      return;
    }

    onUpdateProject(prev => {
      const shots = [...prev.shots];
      const shotIdx = shots.findIndex(s => s.id === activeShotId);
      if (shotIdx === -1) return prev;

      const currentSlots = { ...shots[shotIdx].assigned_slots };
      const sourceFilename = currentSlots[sourceGlobalSlot] || (currentSlots as any)[String(sourceGlobalSlot)];
      const targetFilename = currentSlots[targetGlobalSlot] || (currentSlots as any)[String(targetGlobalSlot)];

      if (!sourceFilename) return prev;

      // Clean up source slot
      delete currentSlots[sourceGlobalSlot];
      delete (currentSlots as any)[String(sourceGlobalSlot)];

      // Move source to target slot
      currentSlots[targetGlobalSlot] = sourceFilename;

      // If target had an asset, place it back into source (swap)
      if (targetFilename) {
        currentSlots[sourceGlobalSlot] = targetFilename;
      } else {
        delete currentSlots[sourceGlobalSlot];
        delete (currentSlots as any)[String(sourceGlobalSlot)];
      }

      shots[shotIdx] = {
        ...shots[shotIdx],
        assigned_slots: currentSlots,
        status: "unstaged",
        updated_at: new Date().toISOString()
      };

      return { ...prev, shots };
    });

    setDraggingSlot(null);
  };

  const handleClearSlot = (type: "image" | "audio" | "video", idx: number) => {
    if (activeShotId) {
      const globalSlot = getGlobalSlotIndex(type, idx);
      onUpdateProject(prev => {
        const shots = [...prev.shots];
        const shotIdx = shots.findIndex(s => s.id === activeShotId);
        if (shotIdx !== -1) {
          const nextSlots = { ...shots[shotIdx].assigned_slots };
          delete nextSlots[globalSlot];
          delete nextSlots[String(globalSlot)];
          if (type === "video") {
            delete nextSlots[9];
            delete (nextSlots as any)["9"];
            delete nextSlots[10];
            delete (nextSlots as any)["10"];
            delete nextSlots[11];
            delete (nextSlots as any)["11"];
          }
          shots[shotIdx] = { ...shots[shotIdx], assigned_slots: nextSlots , status: "unstaged" };
        }
        return { ...prev, shots };
      });
    }
  };

  const handleDelete = async (filename: string) => {
    if (!confirm(`Are you sure you want to permanently delete "${filename}"?`)) return;
    try {
      const res = await fetch(`/api/assets/${filename}?scene_name=${encodeURIComponent(activeSceneName)}`, {
        method: "DELETE"
      });
      if (res.ok) {
        onAssetDeleted(filename);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete asset");
      }
    } catch (err: any) {
      alert("Error deleting asset: " + err.message);
    }
  };

  const handleAssetUploaded = (asset: MediaAsset, slotIndex: number, type: string) => {
    const globalSlot = getGlobalSlotIndex(type as any, slotIndex);
    if (activeShotId) {
      onUpdateProject(prev => {
        const shots = [...prev.shots];
        const shotIdx = shots.findIndex(s => s.id === activeShotId);
        if (shotIdx !== -1) {
          const nextSlots = { ...shots[shotIdx].assigned_slots };
          if (type === "video") {
            // Enforce only 1 video upload per shot: clear any prior video slot keys
            delete nextSlots[9];
            delete (nextSlots as any)["9"];
            delete nextSlots[10];
            delete (nextSlots as any)["10"];
            delete nextSlots[11];
            delete (nextSlots as any)["11"];
          }
          nextSlots[globalSlot] = asset.filename;
          shots[shotIdx] = { ...shots[shotIdx], assigned_slots: nextSlots, status: "unstaged" };
        }
        return { ...prev, shots };
      });
    }
    onAssetUploaded(asset, slotIndex, type);
  };

  const projectSubjectsMap = new Map<string, string>();
  [
    ...(sceneProject.subjects || []),
    ...(subjects || []),
    ...assets.map(a => a.subject_name).filter(Boolean),
    ...(activeShot?.ots_anchor_subject ? [activeShot.ots_anchor_subject] : []),
    ...(activeShot?.ots_focus_subject ? [activeShot.ots_focus_subject] : [])
  ].forEach(raw => {
    if (!raw) return;
    const canonical = toCanonicalSubjectName(String(raw));
    if (!canonical) return;
    const lower = canonical.toLowerCase();
    if (!projectSubjectsMap.has(lower)) {
      projectSubjectsMap.set(lower, canonical);
    }
  });
  const projectSubjects = Array.from(projectSubjectsMap.values());

  const currentMax = activeTab === "image" ? MAX_IMAGES : activeTab === "video" ? MAX_VIDEOS : MAX_AUDIOS;

  return (
    <div id="assets-section" className="space-y-5 flex flex-col min-h-0">
      
      {/* Assets Screen Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900/60 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Shot Context:</label>
          <select 
            value={activeShotId || ""}
            onChange={(e) => onSelectShot(e.target.value || null)}
            className="bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white focus:border-indigo-500 focus:outline-hidden min-w-[250px] shadow-xs cursor-pointer"
          >
            <option key="empty" value="">-- Select a Shot --</option>
            {sceneProject.shots.map(s => (
              <option key={s.id} value={s.id}>
                Shot {s.shot_number.toString().padStart(2, '0')} - {s.shot_type}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          {activeShot && (
            <button
              type="button"
              onClick={() => setIsAddCharacterModalOpen(true)}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
              title="Add character references to active shot"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Character to Shot</span>
            </button>
          )}
          <button
            onClick={handleAddBlankShot}
            className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-600/20 dark:hover:bg-indigo-600/30 dark:text-indigo-300 dark:border-indigo-500/30 rounded-lg text-sm font-medium transition-colors shadow-xs cursor-pointer"
          >
            + New Shot
          </button>
        </div>
      </div>

      {!activeShotId ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-zinc-900/40 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xs">
          <FileImage className="w-12 h-12 text-zinc-400 dark:text-zinc-600 mb-4" />
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-300 mb-2">No Shot Selected</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-500 text-center max-w-md">
            Choose an existing shot from the dropdown above or click <strong className="text-indigo-600 dark:text-indigo-400 font-semibold">"+ New Shot"</strong> to stage a new camera setup and assign media assets.
          </p>
        </div>
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
            
            {/* Slot Types Tab Bar */}
            <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-px">
              <button
                type="button"
                onClick={() => setActiveTab("image")}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                  activeTab === "image" 
                    ? "border-indigo-600 text-indigo-700 bg-indigo-50/80 dark:border-indigo-400 dark:text-indigo-300 dark:bg-indigo-950/20 font-semibold" 
                    : "border-transparent text-zinc-600 hover:text-zinc-900 hover:border-zinc-300 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:border-zinc-700"
                }`}
              >
                <ImageIcon className="w-4 h-4" />
                Image Slots
                <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold transition-colors ${
                  activeTab === "image"
                    ? "bg-indigo-100 text-indigo-800 dark:bg-zinc-800 dark:text-zinc-300"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                }`}>
                  {MAX_IMAGES}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("video")}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                  activeTab === "video" 
                    ? "border-indigo-600 text-indigo-700 bg-indigo-50/80 dark:border-indigo-400 dark:text-indigo-300 dark:bg-indigo-950/20 font-semibold" 
                    : "border-transparent text-zinc-600 hover:text-zinc-900 hover:border-zinc-300 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:border-zinc-700"
                }`}
              >
                <VideoIcon className="w-4 h-4" />
                Video Slot
                <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold transition-colors ${
                  activeTab === "video"
                    ? "bg-indigo-100 text-indigo-800 dark:bg-zinc-800 dark:text-zinc-300"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                }`}>
                  {MAX_VIDEOS}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("audio")}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                  activeTab === "audio" 
                    ? "border-indigo-600 text-indigo-700 bg-indigo-50/80 dark:border-indigo-400 dark:text-indigo-300 dark:bg-indigo-950/20 font-semibold" 
                    : "border-transparent text-zinc-600 hover:text-zinc-900 hover:border-zinc-300 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:border-zinc-700"
                }`}
              >
                <Music className="w-4 h-4" />
                Audio Slots
                <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold transition-colors ${
                  activeTab === "audio"
                    ? "bg-indigo-100 text-indigo-800 dark:bg-zinc-800 dark:text-zinc-300"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                }`}>
                  {MAX_AUDIOS}
                </span>
              </button>

              {/* Takes Tab on Far Right */}
              <button
                type="button"
                onClick={() => setActiveTab("takes")}
                className={`ml-auto flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                  activeTab === "takes" 
                    ? "border-amber-500 text-amber-700 bg-amber-50/80 dark:border-amber-400 dark:text-amber-300 dark:bg-amber-950/20 font-semibold" 
                    : "border-transparent text-zinc-600 hover:text-zinc-900 hover:border-zinc-300 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:border-zinc-700"
                }`}
              >
                <Clapperboard className="w-4 h-4 text-amber-500" />
                Takes
                <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold transition-colors ${
                  activeTab === "takes"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                }`}>
                  {activeShot?.takes?.length || 0}
                </span>
              </button>
            </div>
            
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
              <div className={
                activeTab === "image"
                  ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4"
                  : activeTab === "video"
                    ? "grid grid-cols-1 max-w-sm gap-4"
                    : "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4"
              }>
                {Array.from({ length: currentMax }).map((_, idx) => {
                  const globalSlot = getGlobalSlotIndex(activeTab, idx);
                  const asset = getAssetForGlobalSlot(globalSlot.toString());
                  const isThisDragging = draggingSlot?.globalSlot === globalSlot;
                  const isThisDragOver = dragOverSlot === globalSlot && !isThisDragging;
                  
                  return asset ? (
                    <AssetCard 
                      key={`slot-${activeTab}-${idx}-${asset.filename}`}
                      asset={asset}
                      idx={idx}
                      type={activeTab}
                      isDragging={isThisDragging}
                      isDragOver={isThisDragOver}
                      onEdit={() => setEditingAsset(asset)}
                      onDelete={() => handleClearSlot(activeTab, idx)}
                      onLightbox={() => setLightboxAsset(asset)}
                      onDragStart={(e) => {
                        setDraggingSlot({ type: activeTab, localIdx: idx, globalSlot });
                        e.dataTransfer.setData("text/plain", JSON.stringify({ type: activeTab, localIdx: idx, globalSlot }));
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => {
                        setDraggingSlot(null);
                        setDragOverSlot(null);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        if (dragOverSlot !== globalSlot) {
                          setDragOverSlot(globalSlot);
                        }
                      }}
                      onDragLeave={() => {
                        if (dragOverSlot === globalSlot) {
                          setDragOverSlot(null);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleDropOnSlot(activeTab, idx);
                      }}
                    />
                  ) : (
                    <EmptySlotCard 
                      key={`empty-${activeTab}-${idx}`}
                      idx={idx}
                      type={activeTab}
                      isDragOver={isThisDragOver}
                      onClick={() => setUploadModalSlot({ type: activeTab, index: idx })}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        if (dragOverSlot !== globalSlot) {
                          setDragOverSlot(globalSlot);
                        }
                      }}
                      onDragLeave={() => {
                        if (dragOverSlot === globalSlot) {
                          setDragOverSlot(null);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleDropOnSlot(activeTab, idx);
                      }}
                    />
                  );
                })}
              </div>
            )}
            </>
          )}
        </>
      )}

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

      <AssetLightbox 
        asset={lightboxAsset}
        onClose={() => setLightboxAsset(null)}
      />

      {reviewTakeId && activeShot && (
        <TakeReviewModal
          take={activeShot.takes?.find(t => t.id === reviewTakeId)!}
          sceneName={sceneProject.scene_name || "Untitled_Scene"}
          shotNumber={activeShot.shot_number}
          variations={activeShot.prompt_variations}
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
            setReviewTakeId(null);
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

              // If next shot exists in project, link directly to next shot's first_frame!
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
        />
      )}

      {showCompareModal && activeShot && (
        <TakeComparisonModal
          shot={activeShot}
          sceneName={sceneProject.scene_name || activeSceneName}
          onClose={() => setShowCompareModal(false)}
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
        />
      )}

      {isAddCharacterModalOpen && activeShot && (
        <AddCharacterToShotModal
          isOpen={isAddCharacterModalOpen}
          onClose={() => setIsAddCharacterModalOpen(false)}
          activeShot={activeShot}
          sceneProject={sceneProject}
          assets={assets}
          onConfirmAdd={handleConfirmAddCharacterToShot}
          addToast={addToast}
        />
      )}
    </div>
  );
};
