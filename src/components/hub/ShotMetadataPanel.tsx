import React from "react";
import { ShotItem } from "../../types";
import { generateSaveVideoPrefix } from "../../types";
import { Film, Hash, Camera, Move, Aperture, RectangleHorizontal } from "lucide-react";
import { TakeSelector } from "../TakeSelector";

interface ShotMetadataPanelProps {
  activeShot: ShotItem;
  onSetHeroTake: (takeId: string) => void;
  onReviewTake: (takeId: string | null) => void;
}

export const ShotMetadataPanel: React.FC<ShotMetadataPanelProps> = ({
  activeShot,
  onSetHeroTake,
  onReviewTake
}) => {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 mb-3.5 border-b border-zinc-800/80">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-950/60 border border-indigo-800/60 text-indigo-400 rounded-lg">
            <Film className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white tracking-wide">Shot Context & References</h2>
            <p className="text-xs text-zinc-400">Read-only shot metadata and camera framing specification</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 bg-zinc-950/80 border border-zinc-800 text-xs text-zinc-400 font-mono rounded-md shadow-inner">
            {generateSaveVideoPrefix(activeShot.shot_name || "", activeShot.shot_number)}
          </span>
          <span className={`px-2.5 py-1 text-xs font-semibold rounded-md shadow uppercase tracking-wider ${
            activeShot.status === "rendered" ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" :
            activeShot.status === "rendering" ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 animate-pulse" :
            activeShot.status === "staged" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
            "bg-orange-500/20 text-orange-400 border border-orange-500/30"
          }`}>
            {activeShot.status === "rendered" ? "✓ Rendered" :
             activeShot.status === "rendering" ? "⟳ Rendering" :
             activeShot.status === "staged" ? "✓ Staged" :
             "Unstaged"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-medium mb-1">
            <Film className="w-3.5 h-3.5 text-zinc-500" />
            <span>Shot Name</span>
          </div>
          <div className="text-sm font-semibold text-white truncate" title={activeShot.shot_name || "Untitled Shot"}>
            {activeShot.shot_name || "Untitled Shot"}
          </div>
        </div>
        
        <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-medium mb-1">
            <Hash className="w-3.5 h-3.5 text-zinc-500" />
            <span>Shot Number</span>
          </div>
          <div className="text-sm font-semibold text-white font-mono">
            Shot {activeShot.shot_number.toString().padStart(2, "0")}
          </div>
        </div>
        
        <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-medium mb-1">
            <Camera className="w-3.5 h-3.5 text-zinc-500" />
            <span>Shot Type</span>
          </div>
          <div className="text-sm font-medium text-zinc-200 truncate" title={activeShot.shot_type || "Medium Shot"}>
            {activeShot.shot_type || "Medium Shot"}
          </div>
        </div>
        
        <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-medium mb-1">
            <Move className="w-3.5 h-3.5 text-zinc-500" />
            <span>Camera Movement</span>
          </div>
          <div className="text-sm font-medium text-zinc-200 truncate" title={activeShot.camera_movement || "Locked Off"}>
            {activeShot.camera_movement || "Locked Off"}
          </div>
        </div>

        <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-medium mb-1">
            <Aperture className="w-3.5 h-3.5 text-indigo-400" />
            <span>Lens / Focal Length</span>
          </div>
          <div className="text-sm font-medium text-zinc-200 truncate" title={activeShot.lens_focal_length || "50mm Standard Prime"}>
            {activeShot.lens_focal_length || "50mm Standard Prime"}
          </div>
        </div>

        <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-medium mb-1">
            <RectangleHorizontal className="w-3.5 h-3.5 text-indigo-400" />
            <span>Aspect Ratio</span>
          </div>
          <div className="text-sm font-medium text-zinc-200 truncate" title={activeShot.aspect_ratio || "16:9 Widescreen"}>
            {activeShot.aspect_ratio || "16:9 Widescreen"}
          </div>
        </div>
      </div>

      {activeShot && activeShot.takes && activeShot.takes.length > 0 && (
        <div className="mt-4 border-t border-zinc-800/80 pt-3">
          <TakeSelector 
            shot={activeShot} 
            onSetHeroTake={onSetHeroTake}
            onReviewTake={onReviewTake}
          />
        </div>
      )}
    </div>
  );
};
