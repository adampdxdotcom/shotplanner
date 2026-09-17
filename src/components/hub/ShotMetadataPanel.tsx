import React, { useState, useMemo } from "react";
import { ShotItem } from "../../types";
import { generateSaveVideoPrefix } from "../../types";
import { Film, Hash, Camera, Move, Aperture, RectangleHorizontal, Clapperboard, Play, Star, Radio } from "lucide-react";
import { TakeSelector } from "../TakeSelector";
import { TakeVideoLightbox } from "../TakeVideoLightbox";
import { formatTakeFilename } from "../../utils/formatters";

interface ShotMetadataPanelProps {
  activeShot: ShotItem;
  sceneName?: string;
  onSetHeroTake: (takeId: string) => void;
  onReviewTake: (takeId: string | null) => void;
  onCompareTakes?: () => void;
}

export const ShotMetadataPanel: React.FC<ShotMetadataPanelProps> = ({
  activeShot,
  sceneName = "Scene",
  onSetHeroTake,
  onReviewTake,
  onCompareTakes
}) => {
  const [selectedTakeId, setSelectedTakeId] = useState<string | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Derive active take (selected, hero, or latest)
  const activeTake = useMemo(() => {
    if (!activeShot.takes || activeShot.takes.length === 0) return null;
    if (selectedTakeId) {
      const found = activeShot.takes.find(t => t.id === selectedTakeId);
      if (found) return found;
    }
    if (activeShot.hero_take_id) {
      const hero = activeShot.takes.find(t => t.id === activeShot.hero_take_id);
      if (hero) return hero;
    }
    const heroFlag = activeShot.takes.find(t => t.is_hero);
    if (heroFlag) return heroFlag;
    return activeShot.takes[activeShot.takes.length - 1];
  }, [activeShot.takes, activeShot.hero_take_id, selectedTakeId]);

  const isHero = activeTake ? (activeTake.id === activeShot.hero_take_id || Boolean(activeTake.is_hero)) : false;
  const isGood = activeTake ? (activeTake.rating === "good" || activeTake.review_status === "approved") : false;
  const isBad = activeTake ? (activeTake.rating === "bad" || activeTake.review_status === "needs_work") : false;

  const takeName = activeTake 
    ? `Take ${String(activeTake.take_number).padStart(2, "0")}` 
    : "No Take";

  const takeFilename = activeTake 
    ? (activeTake.video_filename || formatTakeFilename(sceneName, activeShot.shot_number, activeTake.take_number, "mp4"))
    : "";

  const takeStreamUrl = activeTake 
    ? (activeTake.video_url || `/api/outputs/stream/${encodeURIComponent(sceneName)}/${encodeURIComponent(takeFilename)}`)
    : "";

  const isImage = /\.(png|jpg|jpeg|webp|avif)$/i.test(takeFilename);

  return (
    <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 mb-3.5 border-b border-zinc-200 dark:border-zinc-800/80">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400 rounded-lg">
            <Film className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-white tracking-wide">Shot Context & References</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Read-only shot metadata and camera framing specification</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeShot.monitored_workflow && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-cyan-50 dark:bg-cyan-950/70 border border-cyan-200 dark:border-cyan-500/40 text-xs text-cyan-800 dark:text-cyan-300 font-mono rounded-md shadow-xs" title={`Assigned Remote Workflow for Monitoring: ${activeShot.monitored_workflow}`}>
              <Radio className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 animate-pulse" />
              <span className="truncate max-w-[140px]">{activeShot.monitored_workflow.split("/").pop()}</span>
            </span>
          )}
          <span className="px-2.5 py-1 bg-zinc-100 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400 font-mono rounded-md shadow-2xs">
            {generateSaveVideoPrefix(activeShot.shot_name || "", activeShot.shot_number)}
          </span>
          <span className={`px-2.5 py-1 text-xs font-semibold rounded-md shadow uppercase tracking-wider ${
            activeShot.status === "rendered" ? "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400 border border-purple-200 dark:border-purple-500/30" :
            activeShot.status === "rendering" ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 animate-pulse" :
            activeShot.status === "staged" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30" :
            "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400 border border-orange-200 dark:border-orange-500/30"
          }`}>
            {activeShot.status === "rendered" ? "✓ Rendered" :
             activeShot.status === "rendering" ? "⟳ Rendering" :
             activeShot.status === "staged" ? "✓ Staged" :
             "Unstaged"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-zinc-50/80 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800/80 rounded-lg p-3 shadow-2xs">
          <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 text-xs font-medium mb-1">
            <Film className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
            <span>Shot Name</span>
          </div>
          <div className="text-sm font-semibold text-zinc-900 dark:text-white truncate" title={activeShot.shot_name || "Untitled Shot"}>
            {activeShot.shot_name || "Untitled Shot"}
          </div>
        </div>
        
        <div className="bg-zinc-50/80 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800/80 rounded-lg p-3 shadow-2xs">
          <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 text-xs font-medium mb-1">
            <Hash className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
            <span>Shot Number</span>
          </div>
          <div className="text-sm font-semibold text-zinc-900 dark:text-white font-mono">
            Shot {activeShot.shot_number.toString().padStart(2, "0")}
          </div>
        </div>

        {/* Take Box */}
        <div 
          id="shot-metadata-take-box"
          onClick={() => {
            if (activeTake) {
              setIsLightboxOpen(true);
            }
          }}
          className={`bg-zinc-50/80 dark:bg-zinc-950/70 border rounded-lg p-3 transition-all shadow-2xs ${
            activeTake 
              ? "border-zinc-200 dark:border-zinc-800/80 hover:border-amber-400 dark:hover:border-amber-500/60 hover:bg-amber-50/40 dark:hover:bg-zinc-900/80 cursor-pointer group" 
              : "border-zinc-200 dark:border-zinc-800/80 opacity-80"
          }`}
          title={activeTake ? `Click to preview ${takeName} in video lightbox` : "No takes available"}
        >
          <div className="flex items-center justify-between gap-1 text-zinc-500 dark:text-zinc-400 text-xs font-medium mb-1">
            <div className="flex items-center gap-1.5">
              <Clapperboard className="w-3.5 h-3.5 text-amber-600 dark:text-amber-500" />
              <span>Take</span>
            </div>
            {isHero && (
              <span title="Hero Take" className="inline-flex">
                <Star className="w-3 h-3 text-amber-500 fill-amber-500 dark:text-amber-400 dark:fill-amber-400 shrink-0" />
              </span>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div 
                className={`text-sm font-semibold truncate ${
                  activeTake ? "text-zinc-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-300 transition-colors" : "text-zinc-400 dark:text-zinc-500"
                }`}
                title={takeName}
              >
                {takeName}
              </div>
              {activeTake && (
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block truncate group-hover:text-amber-600 dark:group-hover:text-amber-400/80 transition-colors">
                  {isHero ? "Hero Take" : isGood ? "Good Take" : isBad ? "Needs Work" : "Preview"}
                </span>
              )}
            </div>

            {/* Very small thumbnail */}
            {activeTake ? (
              <div className="relative w-11 h-7 rounded bg-black border border-zinc-200 dark:border-zinc-700/80 overflow-hidden shrink-0 group-hover:border-amber-400/80 transition-all flex items-center justify-center shadow-xs">
                {isImage ? (
                  <img
                    src={takeStreamUrl}
                    alt={takeName}
                    className="w-full h-full object-cover pointer-events-none"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <video
                    src={`${takeStreamUrl}#t=0.001`}
                    preload="metadata"
                    muted
                    playsInline
                    className="w-full h-full object-cover pointer-events-none"
                  />
                )}
                <div className="absolute inset-0 bg-black/25 group-hover:bg-black/0 flex items-center justify-center transition-colors">
                  <Play className="w-3 h-3 text-white fill-white opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all drop-shadow-sm" />
                </div>
              </div>
            ) : (
              <div className="w-11 h-7 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 flex items-center justify-center shrink-0 text-zinc-400 dark:text-zinc-600">
                <Film className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
        </div>
        
        <div className="bg-zinc-50/80 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800/80 rounded-lg p-3 shadow-2xs">
          <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 text-xs font-medium mb-1">
            <Camera className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
            <span>Shot Type</span>
          </div>
          <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate" title={activeShot.shot_type || "Medium Shot"}>
            {activeShot.shot_type || "Medium Shot"}
          </div>
        </div>
        
        <div className="bg-zinc-50/80 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800/80 rounded-lg p-3 shadow-2xs">
          <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 text-xs font-medium mb-1">
            <Move className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
            <span>Camera Movement</span>
          </div>
          <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate" title={activeShot.camera_movement || "Locked Off"}>
            {activeShot.camera_movement || "Locked Off"}
          </div>
        </div>

        <div className="bg-zinc-50/80 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800/80 rounded-lg p-3 shadow-2xs">
          <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 text-xs font-medium mb-1">
            <Aperture className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
            <span>Lens / Focal Length</span>
          </div>
          <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate" title={activeShot.lens_focal_length || "50mm Standard Prime"}>
            {activeShot.lens_focal_length || "50mm Standard Prime"}
          </div>
        </div>

        <div className="bg-zinc-50/80 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800/80 rounded-lg p-3 shadow-2xs">
          <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 text-xs font-medium mb-1">
            <RectangleHorizontal className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
            <span>Aspect Ratio</span>
          </div>
          <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate" title={activeShot.aspect_ratio || "16:9 Widescreen"}>
            {activeShot.aspect_ratio || "16:9 Widescreen"}
          </div>
        </div>
      </div>

      {activeShot && activeShot.takes && activeShot.takes.length > 0 && (
        <div className="mt-4 border-t border-zinc-200 dark:border-zinc-800/80 pt-3">
          <TakeSelector 
            shot={activeShot} 
            activeTakeId={activeTake?.id}
            onSelectTake={(tid) => setSelectedTakeId(tid)}
            onSetHeroTake={onSetHeroTake}
            onReviewTake={onReviewTake}
            onCompareTakes={onCompareTakes}
          />
        </div>
      )}

      {/* Video Lightbox */}
      {isLightboxOpen && activeTake && (
        <TakeVideoLightbox
          isOpen={isLightboxOpen}
          onClose={() => setIsLightboxOpen(false)}
          shot={activeShot}
          take={activeTake}
          sceneName={sceneName}
          onSetHeroTake={onSetHeroTake}
          onReviewTake={onReviewTake}
          onSelectTake={(tid) => setSelectedTakeId(tid)}
        />
      )}
    </div>
  );
};
