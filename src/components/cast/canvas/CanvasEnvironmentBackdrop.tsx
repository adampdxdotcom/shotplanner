import React from "react";
import { Image as ImageIcon } from "lucide-react";

export interface CanvasEnvironmentBackdropProps {
  backgroundUrl: string | null;
  showGrid?: boolean;
  showSafeAreas?: boolean;
  onUploadClick: () => void;
}

export const CanvasEnvironmentBackdrop: React.FC<CanvasEnvironmentBackdropProps> = ({
  backgroundUrl,
  showGrid = true,
  showSafeAreas = true,
  onUploadClick
}) => {
  return (
    <>
      {/* BASE LAYER: Locked Environment Photo or Studio Grid */}
      {backgroundUrl ? (
        <div className="absolute inset-0 pointer-events-none z-0">
          <img
            src={backgroundUrl}
            alt="Environment Background"
            className="w-full h-full object-cover select-none"
            referrerPolicy="no-referrer"
          />
          {/* Subtle cinematic floor shadow vignette */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30" />
        </div>
      ) : (
        <div className="absolute inset-0 z-0 bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:24px_24px] flex flex-col items-center justify-center pointer-events-none">
          <div className="text-center p-6 bg-zinc-900/60 backdrop-blur rounded-xl border border-zinc-800 max-w-xs pointer-events-auto">
            <ImageIcon className="w-8 h-8 text-zinc-500 mx-auto mb-2" />
            <p className="text-xs font-semibold text-zinc-300 mb-1">Locked Environment Layer</p>
            <p className="text-[11px] text-zinc-500 mb-3">
              Drop room photo directly here, or select from gallery
            </p>
            <button
              type="button"
              onClick={onUploadClick}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer shadow"
            >
              Upload Room Photo
            </button>
          </div>
        </div>
      )}

      {/* Rule of Thirds Cinematic Grid */}
      {showGrid && (
        <div className="absolute inset-0 pointer-events-none z-10 grid grid-cols-3 grid-rows-3">
          <div className="border-r border-b border-white/10" />
          <div className="border-r border-b border-white/10" />
          <div className="border-b border-white/10" />
          <div className="border-r border-b border-white/10" />
          <div className="border-r border-b border-white/10" />
          <div className="border-b border-white/10" />
          <div className="border-r border-white/10" />
          <div className="border-r border-white/10" />
          <div />
        </div>
      )}

      {/* Depth Planes Safe Area Guidelines */}
      {showSafeAreas && (
        <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between">
          <div className="h-[40%] border-b border-dashed border-indigo-500/25 px-3 py-1 flex items-start justify-between text-[9px] font-mono text-indigo-400/60 uppercase">
            <span>Background Zone</span>
            <span>Far</span>
          </div>
          <div className="h-[35%] border-b border-dashed border-indigo-500/25 px-3 py-1 flex items-start justify-between text-[9px] font-mono text-indigo-400/60 uppercase">
            <span>Midground Zone</span>
            <span>Action Depth</span>
          </div>
          <div className="h-[25%] px-3 py-1 flex items-start justify-between text-[9px] font-mono text-indigo-400/60 uppercase">
            <span>Foreground Zone</span>
            <span>Close Focus</span>
          </div>
        </div>
      )}
    </>
  );
};
