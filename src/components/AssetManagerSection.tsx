import React, { useState } from "react";
import { MediaAsset, SceneProjectFile, ShotItem, CharacterProfile } from "../types";
import { 
  FileImage, 
  Trash2, 
  Image as ImageIcon,
  Video as VideoIcon,
  Music
} from "lucide-react";
import { ScenePlanningHeader } from "./ScenePlanningHeader";
import { TakeSelector } from "./TakeSelector";
import { TakeReviewModal } from "./TakeReviewModal";
import { AssetUploadModal } from "./AssetUploadModal";
import { AssetEditModal } from "./AssetEditModal";
import { AssetLightbox } from "./AssetLightbox";
import { AssetCard, EmptySlotCard } from "./AssetSlotGrid";

const MAX_IMAGES = 9;
const MAX_VIDEOS = 3;
const MAX_AUDIOS = 3;

interface AssetManagerSectionProps {
  assets: MediaAsset[];
  activeShotId: string | null;
  onSelectShot: (id: string | null) => void;
  sceneProject: SceneProjectFile;
  activeSceneName: string;
  onUpdateProject: (updater: (prev: SceneProjectFile) => SceneProjectFile) => void;
  subjects?: string[];
  characters?: Record<string, CharacterProfile>;
  onUpdateCharacter?: (name: string, profile: CharacterProfile) => void;
  onRegisterSubject?: (name: string) => void;
  onAssetUploaded: (asset: MediaAsset, slotIndex?: number, type?: string) => void;
  onAssetDeleted: (filename: string) => void;
  onAssetUpdated: (oldFilename: string, newAsset: MediaAsset) => void;
}

export const AssetManagerSection: React.FC<AssetManagerSectionProps> = ({
  assets,
  activeShotId,
  onSelectShot,
  sceneProject,
  activeSceneName,
  onUpdateProject,
  subjects = [],
  characters = {},
  onUpdateCharacter,
  onRegisterSubject = (_name: string) => {},
  onAssetUploaded,
  onAssetDeleted,
  onAssetUpdated
}) => {
  const [activeTab, setActiveTab] = useState<"image" | "audio" | "video">("image");
  
  const [uploadModalSlot, setUploadModalSlot] = useState<{ type: "image" | "audio" | "video", index: number } | null>(null);
  const [editingAsset, setEditingAsset] = useState<MediaAsset | null>(null);
  const [lightboxAsset, setLightboxAsset] = useState<MediaAsset | null>(null);
  const [reviewTakeId, setReviewTakeId] = useState<string | null>(null);

  const activeShotIndex = sceneProject.shots.findIndex(s => s.id === activeShotId);
  const activeShot = activeShotIndex >= 0 ? sceneProject.shots[activeShotIndex] : null;

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
    if (type === "video") return MAX_IMAGES + localIndex;
    return MAX_IMAGES + MAX_VIDEOS + localIndex;
  };

  const getLocalSlotIndex = (globalIndex: number): { type: "image"|"audio"|"video", index: number } => {
    if (globalIndex < MAX_IMAGES) return { type: "image", index: globalIndex };
    if (globalIndex < MAX_IMAGES + MAX_VIDEOS) return { type: "video", index: globalIndex - MAX_IMAGES };
    return { type: "audio", index: globalIndex - (MAX_IMAGES + MAX_VIDEOS) };
  };

  const getAssetForGlobalSlot = (globalSlotStr: string): MediaAsset | null => {
    if (!activeShot || !activeShot.assigned_slots) return null;
    const filename = activeShot.assigned_slots[globalSlotStr];
    if (!filename) return null;
    return assets.find(a => a.filename === filename) || null;
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
          const nextSlots = { ...shots[shotIdx].assigned_slots, [globalSlot]: asset.filename };
          shots[shotIdx] = { ...shots[shotIdx], assigned_slots: nextSlots, status: "unstaged" };
        }
        return { ...prev, shots };
      });
    }
    onAssetUploaded(asset, slotIndex, type);
  };

  const projectSubjects = Array.from(
    new Set([
      ...(sceneProject.subjects || []),
      ...(subjects || []),
      ...assets.map(a => a.subject_name).filter(Boolean),
      ...(activeShot?.ots_anchor_subject ? [activeShot.ots_anchor_subject] : []),
      ...(activeShot?.ots_focus_subject ? [activeShot.ots_focus_subject] : [])
    ])
  ).filter(s => s && typeof s === "string" && s.trim().length > 0) as string[];

  const currentMax = activeTab === "image" ? MAX_IMAGES : activeTab === "video" ? MAX_VIDEOS : MAX_AUDIOS;

  return (
    <div id="assets-section" className="space-y-5 flex flex-col min-h-0">
      
      {/* Assets Screen Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/60 p-4 rounded-xl border border-zinc-800 shadow-sm">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-zinc-300">Shot Context:</label>
          <select 
            value={activeShotId || ""}
            onChange={(e) => onSelectShot(e.target.value || null)}
            className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none min-w-[250px]"
          >
            <option key="empty" value="">-- Select a Shot --</option>
            {sceneProject.shots.map(s => (
              <option key={s.id} value={s.id}>
                Shot {s.shot_number.toString().padStart(2, '0')} - {s.shot_type}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleAddBlankShot}
          className="px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-lg text-sm font-medium transition-colors"
        >
          + New Shot
        </button>
      </div>

      {!activeShotId ? (
        <div className="flex flex-col items-center justify-center p-12 bg-zinc-900/40 border-2 border-dashed border-zinc-800 rounded-xl">
          <FileImage className="w-12 h-12 text-zinc-600 mb-4" />
          <h2 className="text-xl font-semibold text-zinc-300 mb-2">No Shot Selected</h2>
          <p className="text-sm text-zinc-500 text-center max-w-md">
            Choose an existing shot from the dropdown above or click <strong className="text-indigo-400">"+ New Shot"</strong> to stage a new camera setup and assign media assets.
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

            {activeShot.takes && activeShot.takes.length > 0 && (
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 shadow-sm -mt-2">
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
            <div className="flex items-center gap-2 border-b border-zinc-800 pb-px">
              <button
                onClick={() => setActiveTab("image")}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "image" 
                    ? "border-indigo-400 text-indigo-300 bg-indigo-950/20" 
                    : "border-transparent text-zinc-500 hover:text-zinc-300 hover:border-zinc-700"
                }`}
              >
                <ImageIcon className="w-4 h-4" />
                Image Slots
                <span className="ml-1 text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded-full">{MAX_IMAGES}</span>
              </button>
              <button
                onClick={() => setActiveTab("video")}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "video" 
                    ? "border-indigo-400 text-indigo-300 bg-indigo-950/20" 
                    : "border-transparent text-zinc-500 hover:text-zinc-300 hover:border-zinc-700"
                }`}
              >
                <VideoIcon className="w-4 h-4" />
                Video Slots
                <span className="ml-1 text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded-full">{MAX_VIDEOS}</span>
              </button>
              <button
                onClick={() => setActiveTab("audio")}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "audio" 
                    ? "border-indigo-400 text-indigo-300 bg-indigo-950/20" 
                    : "border-transparent text-zinc-500 hover:text-zinc-300 hover:border-zinc-700"
                }`}
              >
                <Music className="w-4 h-4" />
                Audio Slots
                <span className="ml-1 text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded-full">{MAX_AUDIOS}</span>
              </button>
            </div>
            
            <div className={
              activeTab === "image"
                ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-10 gap-4"
                : "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4"
            }>
              {Array.from({ length: currentMax }).map((_, idx) => {
                const globalSlot = getGlobalSlotIndex(activeTab, idx);
                const asset = getAssetForGlobalSlot(globalSlot.toString());
                const slotClassName = activeTab === "image" 
                  ? `col-span-1 lg:col-span-2 ${idx === 5 ? "lg:col-start-2" : ""}` 
                  : "";
                
                return asset ? (
                  <AssetCard 
                    key={`slot-${activeTab}-${idx}-${asset.filename}`}
                    asset={asset}
                    idx={idx}
                    type={activeTab}
                    className={slotClassName}
                    onEdit={() => setEditingAsset(asset)}
                    onDelete={() => handleClearSlot(activeTab, idx)}
                    onLightbox={() => setLightboxAsset(asset)}
                  />
                ) : (
                  <EmptySlotCard 
                    key={`empty-${activeTab}-${idx}`}
                    idx={idx}
                    type={activeTab}
                    className={slotClassName}
                    onClick={() => setUploadModalSlot({ type: activeTab, index: idx })}
                  />
                );
              })}
            </div>
            </>
          )}
        </>
      )}

      <AssetUploadModal 
        isOpen={!!uploadModalSlot}
        activeTab={activeTab}
        uploadModalSlot={uploadModalSlot}
        libraryAssets={assets}
        subjects={projectSubjects}
        characters={characters}
        sceneName={activeSceneName}
        onRegisterSubject={onRegisterSubject}
        onClose={() => setUploadModalSlot(null)}
        onAssetUploaded={handleAssetUploaded}
      />

      <AssetEditModal
        asset={editingAsset}
        subjects={projectSubjects}
        characters={characters}
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
        />
      )}
    </div>
  );
};
