import React, { useState, useRef } from "react";
import { ShotItem, MediaAsset } from "../../types";
import { getAssetMediaUrl } from "../../utils/assetUrl";
import { ChevronLeft, ChevronRight, Copy, Trash2, Plus } from "lucide-react";

interface ShotCarouselProps {
  sceneName: string;
  shots: ShotItem[];
  assets: MediaAsset[];
  activeShotId: string | null;
  onSelectShot: (id: string | null) => void;
  onAddBlankShot: () => void;
  onDuplicateShot: (shot: ShotItem, e: React.MouseEvent) => void;
  onDeleteShot: (shotId: string, e: React.MouseEvent) => void;
  onReorderShots: (newShots: ShotItem[]) => void;
}

export const ShotCarousel: React.FC<ShotCarouselProps> = ({
  sceneName,
  shots,
  assets,
  activeShotId,
  onSelectShot,
  onAddBlankShot,
  onDuplicateShot,
  onDeleteShot,
  onReorderShots
}) => {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  const scrollCarousel = (dir: "left" | "right") => {
    if (carouselRef.current) {
      const scrollAmount = 300;
      carouselRef.current.scrollBy({ left: dir === "left" ? -scrollAmount : scrollAmount, behavior: "smooth" });
    }
  };

  const getShotThumbnailUrl = (shot: ShotItem) => {
    let filename = shot.assigned_slots[8] || shot.assigned_slots[9];
    if (!filename) {
      const locAsset = assets.find(a => a.type === "Scene Reference" || a.slot_index === 8);
      if (locAsset) filename = locAsset.filename;
    }
    if (!filename) {
      const locAsset = assets.find(a => {
        const t = (a.type || "").toLowerCase();
        const n = (a.subject_name || "").toLowerCase();
        return t.includes("scene") || t.includes("location") || t.includes("environment") ||
               n.includes("scene") || n.includes("location") || n.includes("environment");
      });
      if (locAsset) filename = locAsset.filename;
    }
    if (!filename) {
      filename = shot.assigned_slots[0] || shot.assigned_slots[1];
    }
    return getAssetMediaUrl(filename, true);
  };

  const handleDragStart = (idx: number) => setDraggedIdx(idx);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (dropIdx: number) => {
    if (draggedIdx === null || draggedIdx === dropIdx) return;
    const newShots = [...shots];
    const item = newShots.splice(draggedIdx, 1)[0];
    newShots.splice(dropIdx, 0, item);
    newShots.forEach((s, i) => s.shot_number = i + 1);
    onReorderShots(newShots);
    setDraggedIdx(null);
  };

  return (
    <div className="relative bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 flex items-center">
      <button onClick={() => scrollCarousel("left")} className="p-2 text-zinc-400 hover:text-white shrink-0">
        <ChevronLeft className="w-6 h-6" />
      </button>
      
      <div 
        ref={carouselRef}
        className="flex flex-1 gap-4 overflow-x-auto snap-x snap-mandatory hide-scrollbar px-2"
      >
        {shots.map((shot, idx) => {
          const thumbnailUrl = getShotThumbnailUrl(shot);
          const currentSceneName = (shot.shot_name && shot.shot_name.trim()) || (sceneName && sceneName.trim()) || "Scene";
          const shotNumberDisplay = shot.shot_number.toString().padStart(2, "0");
          
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
              {thumbnailUrl ? (
                <img src={thumbnailUrl} className="absolute inset-0 w-full h-full object-cover opacity-60" alt="" />
              ) : (
                <div className="absolute inset-0 bg-zinc-800 flex items-center justify-center">
                  <span className="text-zinc-600 text-sm">No Location</span>
                </div>
              )}
              
              <div className="absolute top-2 left-2 flex flex-col items-start gap-1 z-10 max-w-[calc(100%-4rem)]">
                <span 
                  className="px-2 py-0.5 bg-black/80 backdrop-blur text-white text-xs font-semibold rounded shadow truncate max-w-full"
                  title={`Shot ${shotNumberDisplay} - ${currentSceneName}`}
                >
                  Shot {shotNumberDisplay} - {currentSceneName}
                </span>
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded shadow uppercase tracking-wider ${
                  shot.status === "rendered" ? "bg-purple-500/90 text-white" :
                  shot.status === "rendering" ? "bg-indigo-500/90 text-white animate-pulse" :
                  shot.status === "staged" ? "bg-emerald-500/90 text-white" :
                  "bg-orange-500/90 text-white"
                }`}>
                  {shot.status === "rendered" ? "✓ Rendered" :
                   shot.status === "rendering" ? "⟳ Rendering" :
                   shot.status === "staged" ? "✓ Staged" :
                   "Unstaged"}
                </span>
              </div>
              
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button
                  onClick={(e) => onDuplicateShot(shot, e)}
                  className="p-1.5 bg-black/60 hover:bg-black text-white rounded backdrop-blur shadow"
                  title="Duplicate Shot"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => onDeleteShot(shot.id, e)}
                  className="p-1.5 bg-black/60 hover:bg-red-500 text-white rounded backdrop-blur shadow"
                  title="Delete Shot"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        <button
          onClick={onAddBlankShot}
          className="snap-start shrink-0 w-64 aspect-video rounded-xl border-2 border-dashed border-zinc-700 hover:border-zinc-500 bg-zinc-900 hover:bg-zinc-800 flex flex-col items-center justify-center gap-2 transition-all group"
        >
          <div className="p-3 bg-zinc-800 group-hover:bg-zinc-700 rounded-full text-zinc-400 group-hover:text-white transition-colors">
            <Plus className="w-6 h-6" />
          </div>
          <span className="text-sm font-medium text-zinc-400 group-hover:text-zinc-300">Add New Shot</span>
        </button>
      </div>

      <button onClick={() => scrollCarousel("right")} className="p-2 text-zinc-400 hover:text-white shrink-0">
        <ChevronRight className="w-6 h-6" />
      </button>
    </div>
  );
};
