import React, { useState, useEffect, useRef } from "react";
import { SceneProjectFile, ShotItem, MediaAsset, AppConfig, ToastMessage } from "../types";
import { generateSaveVideoPrefix } from "../types";
import { getAssetMediaUrl } from "../utils/assetUrl";
import { X, Copy, Trash2, Plus, ChevronLeft, ChevronRight, UploadCloud } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

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
  
  const carouselRef = useRef<HTMLDivElement>(null);

  const activeShotIndex = project.shots.findIndex((s) => s.id === activeShotId);
  const activeShot = project.shots[activeShotIndex];

  const updateActiveShot = (updater: (prev: ShotItem) => ShotItem) => {
    onUpdateProject((prev) => {
      const shots = [...prev.shots];
      const idx = shots.findIndex(s => s.id === activeShotId);
      if (idx !== -1) {
        shots[idx] = { ...updater(shots[idx]), updated_at: new Date().toISOString() };
        // If anything changed, flip staged to false
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
        staged: false,
        updated_at: new Date().toISOString()
      };
      const shots = [...prev.shots];
      shots.splice(idx + 1, 0, newShot);
      // Auto renumber
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
      basic_stub: "",
      expanded_prompt: "",
      assigned_slots: {},
      staged: false,
      updated_at: new Date().toISOString()
    };
    onUpdateProject(prev => ({ ...prev, shots: [...prev.shots, newShot] }));
    onSelectShot(newShot.id);
  };

  const scrollCarousel = (dir: "left" | "right") => {
    if (carouselRef.current) {
      const scrollAmount = 300;
      carouselRef.current.scrollBy({ left: dir === "left" ? -scrollAmount : scrollAmount, behavior: "smooth" });
    }
  };

  const getAssetFilenameForSlot = (slotIndex: number) => {
    // 1. Check shot-level overrides first
    return activeShot?.assigned_slots[slotIndex] || activeShot?.assigned_slots[String(slotIndex)] || "";
  };

  const getAssetForSlot = (slotIndex: number) => {
    // 1. Check if the shot overrides this slot specifically
    const shotFilenameOverride = activeShot?.assigned_slots[slotIndex] || activeShot?.assigned_slots[String(slotIndex)];
    
    if (shotFilenameOverride) {
       // Look up the full asset by filename
       const matchedAsset = assets.find(a => a.filename === shotFilenameOverride || (a as any).name === shotFilenameOverride);
       if (matchedAsset) {
           return { ...matchedAsset, preview_url: getAssetMediaUrl(matchedAsset) };
       }
       // Fallback for missing asset metadata but assigned filename
       return {
         filename: shotFilenameOverride,
         preview_url: getAssetMediaUrl(shotFilenameOverride),
         label: `Slot ${slotIndex + 1}`
       } as any;
    }

    // 2. Removed global fallback to prevent new shots from bleeding Shot 1\'s assets

    return null;
  };

  const getShotThumbnailUrl = (shot: ShotItem) => {
      // 1. Explicit shot assignment to Slot 9 (Location)
      let filename = shot.assigned_slots[8] || shot.assigned_slots[9];
      
      // 2. Project asset with type "Scene Reference" or slot index 8
      if (!filename) {
          const locAsset = assets.find(a => a.type === "Scene Reference" || a.slot_index === 8);
          if (locAsset) filename = locAsset.filename;
      }

      // 3. Heuristics on asset type or subject name
      if (!filename) {
          const locAsset = assets.find(a => {
             const t = (a.type || "").toLowerCase();
             const n = (a.subject_name || "").toLowerCase();
             return t.includes("scene") || t.includes("location") || t.includes("environment") ||
                    n.includes("scene") || n.includes("location") || n.includes("environment");
          });
          if (locAsset) filename = locAsset.filename;
      }

      // 4. Fallback to shot's Slot 1
      if (!filename) {
          filename = shot.assigned_slots[0] || shot.assigned_slots[1];
      }

      // 5. Removed fallback to random project images so empty shots look empty

      return getAssetMediaUrl(filename);
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

  const [isTransferringScene, setIsTransferringScene] = useState(false);

  const handleTransferScene = async () => {
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

  const handleTransfer = async () => {
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

  // For Drag and Drop Reordering
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const handleDragStart = (idx: number) => setDraggedIdx(idx);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (dropIdx: number) => {
    if (draggedIdx === null || draggedIdx === dropIdx) return;
    onUpdateProject(prev => {
      const shots = [...prev.shots];
      const item = shots.splice(draggedIdx, 1)[0];
      shots.splice(dropIdx, 0, item);
      shots.forEach((s, i) => s.shot_number = i + 1);
      return { ...prev, shots };
    });
    setDraggedIdx(null);
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Top Strip: Horizontal Shot Carousel */}
      <div className="relative bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 flex items-center">
        <button onClick={() => scrollCarousel("left")} className="p-2 text-zinc-400 hover:text-white shrink-0">
          <ChevronLeft className="w-6 h-6" />
        </button>
        
        <div 
          ref={carouselRef}
          className="flex flex-1 gap-4 overflow-x-auto snap-x snap-mandatory hide-scrollbar px-2"
        >
          {project.shots.map((shot, idx) => {
            const thumbnailUrl = getShotThumbnailUrl(shot);
            
            return (
              <div
                key={shot.id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(idx)}
                onClick={() => onSelectShot(shot.id)}
                className={`snap-start shrink-0 w-64 aspect-video rounded-xl border-2 relative cursor-pointer overflow-hidden transition-all group ${
                  activeShotId === shot.id ? "border-indigo-500 ring-4 ring-indigo-500/20" : "border-zinc-700 hover:border-zinc-500"
                }`}
              >
                {/* Background Image */}
                {thumbnailUrl ? (
                  <img src={thumbnailUrl} className="absolute inset-0 w-full h-full object-cover opacity-60" alt="" />
                ) : (
                  <div className="absolute inset-0 bg-zinc-800 flex items-center justify-center">
                    <span className="text-zinc-600 text-sm">No Location</span>
                  </div>
                )}
                
                {/* Badges */}
                <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
                  <span className="px-2 py-0.5 bg-black/80 backdrop-blur text-white text-xs font-semibold rounded shadow">
                    Shot {shot.shot_number.toString().padStart(2, "0")}
                  </span>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded shadow uppercase tracking-wider ${shot.staged ? "bg-emerald-500/90 text-white" : "bg-orange-500/90 text-white"}`}>
                    {shot.staged ? "✓ Staged" : "Unstaged"}
                  </span>
                </div>

                <div className="absolute bottom-2 left-2 right-2 z-10 text-xs bg-black/80 backdrop-blur px-2 py-1 rounded truncate text-zinc-300">
                  {shot.shot_type} • {shot.camera_movement}
                </div>

                {/* Hover Actions */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-20">
                  <button onClick={(e) => handleDuplicateShot(shot, e)} className="p-1.5 bg-zinc-800/90 hover:bg-zinc-700 text-white rounded-md shadow" title="Duplicate">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={(e) => handleDeleteShot(shot.id, e)} className="p-1.5 bg-red-900/90 hover:bg-red-700 text-white rounded-md shadow" title="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
          
          <button 
            onClick={handleAddBlankShot}
            className="snap-start shrink-0 w-64 aspect-video rounded-xl border-2 border-dashed border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/50 flex flex-col items-center justify-center text-zinc-400 hover:text-white transition-colors"
          >
            <Plus className="w-8 h-8 mb-2" />
            <span className="text-sm font-medium">Add Blank Shot</span>
          </button>
        </div>

        <button onClick={() => scrollCarousel("right")} className="p-2 text-zinc-400 hover:text-white shrink-0">
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* Bottom Bay: Active Shot Inspector */}
      {activeShot ? (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
          
          {/* Left Pane: Shot Context & References */}
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 flex flex-col gap-5 overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Shot Context & References</h2>
              <span className="text-sm text-zinc-500 font-mono">
                {generateSaveVideoPrefix(activeShot.shot_name || "", activeShot.shot_number)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Shot Name</label>
                <input 
                  type="text" 
                  value={activeShot.shot_name || ""} 
                  onChange={e => updateActiveShot(p => ({ ...p, shot_name: e.target.value }))}
                  placeholder="e.g. Hero Close-up"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Shot Number</label>
                <input 
                  type="number" 
                  value={activeShot.shot_number} 
                  readOnly
                  className="w-full bg-zinc-950/50 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-500 outline-none cursor-not-allowed"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Shot Type</label>
                <input 
                  type="text" 
                  value={activeShot.shot_type} 
                  onChange={e => updateActiveShot(prev => ({ ...prev, shot_type: e.target.value }))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Camera Movement</label>
                <input 
                  type="text" 
                  value={activeShot.camera_movement} 
                  onChange={e => updateActiveShot(prev => ({ ...prev, camera_movement: e.target.value }))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="text-xs font-medium text-zinc-400 mb-3 block">Asset Matrix (Slots 1-9)</label>
              <div className="grid grid-cols-3 gap-3">
                {Array.from({ length: 9 }).map((_, i) => {
                  const asset = getAssetForSlot(i);
                  const isLocation = i === 8; // Slot 9 (index 8) is location
                  return (
                    <div key={i} className={`relative aspect-square rounded-lg border flex flex-col items-center justify-center overflow-hidden ${isLocation ? "border-amber-500/50 bg-amber-950/10" : "border-zinc-800 bg-zinc-950/50"}`}>
                      {asset?.preview_url ? (
                        <>
                          <img src={asset.preview_url} className="absolute inset-0 w-full h-full object-cover" alt="" />
                          <button 
                            onClick={() => handleClearSlot(i)}
                            className="absolute top-1 right-1 bg-black/60 hover:bg-black p-1 rounded-full text-white backdrop-blur z-10"
                            title="Clear slot for this shot"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </>
                      ) : (
                        <div className="text-zinc-600 text-xs font-mono">
                          Slot {i + 1}
                        </div>
                      )}
                      {isLocation && (
                        <div className="absolute bottom-0 inset-x-0 bg-amber-600/90 text-white text-[9px] font-bold tracking-wider uppercase text-center py-0.5 z-10 shadow">
                          Location
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Pane: Prompt Engineering & Staging */}
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 flex flex-col gap-4 overflow-y-auto">
            <h2 className="text-lg font-semibold text-white">Prompt Engineering & Staging</h2>
            
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400">Concept Stub</label>
              <textarea 
                value={activeShot.basic_stub}
                onChange={e => updateActiveShot(prev => ({ ...prev, basic_stub: e.target.value }))}
                placeholder="Describe the action and setting..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-3 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none resize-none h-24"
              />
            </div>

            <div className="flex justify-end">
              <button 
                onClick={handleExpandPrompt}
                disabled={isExpanding || !activeShot.basic_stub.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                {isExpanding ? "Expanding..." : "Expand Prompt"}
              </button>
            </div>

            <div className="flex-1 space-y-2 min-h-0 flex flex-col">
              <label className="text-xs font-medium text-zinc-400">Final Expanded Prompt</label>
              <textarea 
                value={activeShot.expanded_prompt}
                onChange={e => updateActiveShot(prev => ({ ...prev, expanded_prompt: e.target.value }))}
                placeholder="Expanded MiniMax-H3 prompt will appear here..."
                className="w-full flex-1 bg-zinc-950 border border-zinc-800 rounded-md px-3 py-3 text-sm text-zinc-300 focus:ring-1 focus:ring-indigo-500 outline-none resize-none font-mono"
              />
            </div>

            <div className="pt-2 border-t border-zinc-800/80 flex flex-col gap-2">
              <button
                onClick={handleTransfer}
                disabled={isTransferring || !activeShot.expanded_prompt}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow"
              >
                <UploadCloud className="w-5 h-5" />
                {isTransferring ? "Sending Shot..." : "Send Shot"}
              </button>
              <button
                onClick={handleTransferScene}
                disabled={isTransferringScene || project.shots.length === 0}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow"
              >
                <UploadCloud className="w-5 h-5" />
                {isTransferringScene ? "Sending Scene..." : "Send Scene"}
              </button>
            </div>
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
              onClick={handleTransferScene}
              disabled={isTransferringScene}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow"
            >
              <UploadCloud className="w-5 h-5" />
              {isTransferringScene ? "Sending Scene..." : "Send Scene"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
