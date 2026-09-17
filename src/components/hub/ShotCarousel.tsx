import React, { useState, useRef } from "react";
import { ShotItem, MediaAsset } from "../../types";
import { ComfyMonitorState } from "../../hooks/useComfyMonitor";
import { getAssetMediaUrl } from "../../utils/assetUrl";
import { ChevronLeft, ChevronRight, Copy, Trash2, Plus, Sparkles, Radio } from "lucide-react";

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
  monitorState?: ComfyMonitorState;
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
  onReorderShots,
  monitorState
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
    <div className="relative bg-white dark:bg-zinc-900/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center transition-colors">
      <button 
        onClick={() => scrollCarousel("left")} 
        className="carousel-nav-btn p-2 text-zinc-400 hover:text-zinc-800 dark:hover:text-white rounded-lg transition-colors shrink-0"
        title="Scroll Left"
        aria-label="Scroll Carousel Left"
      >
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
          const isMonitoredExecuting = Boolean(
            monitorState?.isExecuting && 
            shot.monitored_workflow && 
            monitorState.isConnected
          );

          const isVideoThumb = Boolean(thumbnailUrl && /\.(mp4|mov|webm|mkv|avi)$/i.test(thumbnailUrl));

          return (
            <div
              key={shot.id}
              id={`shot-card-${shot.id}`}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(idx)}
              onClick={() => onSelectShot(shot.id)}
              className={`snap-start shrink-0 w-64 aspect-video rounded-xl border-2 relative cursor-pointer overflow-hidden transition-all group ${
                isMonitoredExecuting
                  ? "border-amber-400 ring-4 ring-amber-400/40 shadow-lg shadow-amber-500/20"
                  : activeShotId === shot.id 
                  ? "border-indigo-500 ring-4 ring-indigo-500/20" 
                  : "border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500"
              }`}
            >
              {thumbnailUrl ? (
                isVideoThumb ? (
                  <video
                    src={`${thumbnailUrl}#t=0.001`}
                    preload="metadata"
                    muted
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover opacity-60 pointer-events-none"
                  />
                ) : (
                  <img
                    src={thumbnailUrl}
                    className="absolute inset-0 w-full h-full object-cover opacity-60 pointer-events-none"
                    alt=""
                    referrerPolicy="no-referrer"
                  />
                )
              ) : (
                <div className="absolute inset-0 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                  <span className="text-zinc-400 dark:text-zinc-500 text-sm font-medium">No Location</span>
                </div>
              )}
              
              <div className="absolute top-2 left-2 flex flex-col items-start gap-1 z-10 max-w-[calc(100%-4rem)]">
                <span 
                  className="shot-name-badge px-2 py-0.5 bg-black/75 dark:bg-black/80 backdrop-blur text-white text-xs font-semibold rounded shadow-xs truncate max-w-full"
                  title={`Shot ${shotNumberDisplay} - ${currentSceneName}`}
                >
                  Shot {shotNumberDisplay} - {currentSceneName}
                </span>
                <div className="flex items-center gap-1 flex-wrap">
                  {isMonitoredExecuting ? (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded shadow uppercase tracking-wider text-amber-950 bg-amber-400 animate-pulse flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-950 animate-ping" />
                      Rendering Take...
                    </span>
                  ) : (
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded shadow uppercase tracking-wider text-white ${
                      shot.status === "rendered" ? "bg-purple-500/90" :
                      shot.status === "rendering" ? "bg-indigo-500/90 animate-pulse" :
                      shot.status === "staged" ? "bg-emerald-500/90" :
                      "bg-orange-500/90"
                    }`}>
                      {shot.status === "rendered" ? "✓ Rendered" :
                       shot.status === "rendering" ? "⟳ Rendering" :
                       shot.status === "staged" ? "✓ Staged" :
                       "Unstaged"}
                    </span>
                  )}
                  {shot.prompt_variations && shot.prompt_variations.length > 0 && (
                    <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-amber-500/90 text-zinc-950 rounded shadow" title={`${shot.prompt_variations.length} Prompt Variations`}>
                      <Sparkles className="w-2.5 h-2.5 fill-current" />
                      Var {(() => {
                        const activeV = shot.prompt_variations.find(v => v.id === shot.active_variation_id);
                        return activeV ? activeV.variation_number : shot.prompt_variations.length;
                      })()}
                    </span>
                  )}
                  {shot.monitored_workflow && (
                    <span className={`flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded shadow truncate max-w-[100px] border ${
                      isMonitoredExecuting 
                        ? "bg-amber-950/80 text-amber-300 border-amber-500/50 animate-pulse" 
                        : "bg-cyan-950/80 text-cyan-300 border-cyan-500/40"
                    }`} title={`Monitored Workflow: ${shot.monitored_workflow}`}>
                      <Radio className={`w-2.5 h-2.5 shrink-0 ${isMonitoredExecuting ? "text-amber-400 animate-pulse" : "text-cyan-400"}`} />
                      <span className="truncate">{shot.monitored_workflow.split("/").pop()}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Bottom stub preview snippet */}
              {shot.basic_stub && (
                <div className="absolute bottom-1.5 left-2 right-2 z-10 pointer-events-none">
                  <p className="text-[10px] text-zinc-800 dark:text-zinc-200/90 bg-white/90 dark:bg-black/75 backdrop-blur-xs px-2 py-0.5 rounded truncate font-mono border border-zinc-200/80 dark:border-white/10 shadow-xs" title={shot.basic_stub}>
                    {shot.basic_stub}
                  </p>
                </div>
              )}
              
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button
                  onClick={(e) => onDuplicateShot(shot, e)}
                  className="shot-action-btn p-1.5 bg-black/60 hover:bg-black text-white rounded backdrop-blur shadow transition-colors"
                  title="Duplicate Shot"
                  aria-label="Duplicate Shot"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => onDeleteShot(shot.id, e)}
                  className="shot-action-btn btn-delete p-1.5 bg-black/60 hover:bg-red-500 text-white rounded backdrop-blur shadow transition-colors"
                  title="Delete Shot"
                  aria-label="Delete Shot"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        <button
          onClick={onAddBlankShot}
          className="shot-add-btn snap-start shrink-0 w-64 aspect-video rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-zinc-500 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex flex-col items-center justify-center gap-2 transition-all group cursor-pointer"
        >
          <div className="p-3 bg-zinc-200 dark:bg-zinc-800 group-hover:bg-zinc-300 dark:group-hover:bg-zinc-700 rounded-full text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">
            <Plus className="w-6 h-6" />
          </div>
          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-300">Add New Shot</span>
        </button>
      </div>

      <button 
        onClick={() => scrollCarousel("right")} 
        className="carousel-nav-btn p-2 text-zinc-400 hover:text-zinc-800 dark:hover:text-white rounded-lg transition-colors shrink-0"
        title="Scroll Right"
        aria-label="Scroll Carousel Right"
      >
        <ChevronRight className="w-6 h-6" />
      </button>
    </div>
  );
};
