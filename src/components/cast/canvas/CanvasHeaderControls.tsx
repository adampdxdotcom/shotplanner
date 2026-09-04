import React, { useState } from "react";
import { 
  Image as ImageIcon, 
  ChevronDown, 
  Upload, 
  Check, 
  User, 
  FlipHorizontal, 
  ArrowUp, 
  ArrowDown, 
  Eraser 
} from "lucide-react";
import { MediaAsset } from "../../../types";
import { getAssetMediaUrl } from "../../../utils/assetUrl";
import { StagedActorCanvasItem } from "./types";

export interface CanvasHeaderControlsProps {
  activeLocationAsset?: MediaAsset;
  locationAssets: MediaAsset[];
  backgroundUrl: string | null;
  onSelectLocationAsset: (filename: string) => void;
  onClearBackground: () => void;
  onTriggerFileUpload: () => void;
  selectedActor: StagedActorCanvasItem | null;
  onUpdateActor: (id: string, updates: Partial<StagedActorCanvasItem>) => void;
  onToggleFlip: (actor: StagedActorCanvasItem) => void;
  onBringForward: (actor: StagedActorCanvasItem) => void;
  onSendBackward: (actor: StagedActorCanvasItem) => void;
  isMaskingMode: boolean;
  maskingActorId: string | null;
  onEnterMaskingMode: (actor: StagedActorCanvasItem) => void;
  onExitMaskingMode: () => void;
}

export const CanvasHeaderControls: React.FC<CanvasHeaderControlsProps> = ({
  activeLocationAsset,
  locationAssets,
  backgroundUrl,
  onSelectLocationAsset,
  onClearBackground,
  onTriggerFileUpload,
  selectedActor,
  onUpdateActor,
  onToggleFlip,
  onBringForward,
  onSendBackward,
  isMaskingMode,
  maskingActorId,
  onEnterMaskingMode,
  onExitMaskingMode
}) => {
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState<boolean>(false);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
      <div className="flex items-center gap-2">
        {/* Location Selector Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsLocationPickerOpen(!isLocationPickerOpen)}
            className="bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/80 px-2.5 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
            title="Select Scene Location"
          >
            <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
            <span className="max-w-[140px] truncate">
              {activeLocationAsset?.description || activeLocationAsset?.filename || "Select Location"}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400 ml-0.5" />
          </button>

          {/* Location Selector Flyout */}
          {isLocationPickerOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setIsLocationPickerOpen(false)}
              />
              <div className="absolute top-full left-0 mt-1.5 w-72 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-3 z-40 space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <span className="text-xs font-semibold text-zinc-200">Scene Locations</span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsLocationPickerOpen(false);
                      onTriggerFileUpload();
                    }}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium cursor-pointer"
                  >
                    <Upload className="w-3 h-3" />
                    Upload Photo
                  </button>
                </div>

                {/* Gallery of Location Assets */}
                <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                  {locationAssets.length > 0 ? (
                    locationAssets.map((asset) => {
                      const isSelected = activeLocationAsset?.filename === asset.filename;
                      return (
                        <button
                          key={asset.filename}
                          type="button"
                          onClick={() => {
                            onSelectLocationAsset(asset.filename);
                            setIsLocationPickerOpen(false);
                          }}
                          className={`w-full flex items-center gap-2.5 p-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-amber-500/20 border border-amber-500/50 text-amber-300"
                              : "hover:bg-zinc-800/80 text-zinc-300"
                          }`}
                        >
                          <img
                            src={getAssetMediaUrl(asset.filename, true)}
                            alt=""
                            className="w-10 h-7 object-cover rounded bg-zinc-950 border border-zinc-800 flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{asset.description || asset.filename}</p>
                            <span className="text-[10px] text-zinc-500 font-mono">Location Reference</span>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
                        </button>
                      );
                    })
                  ) : (
                    <div className="py-4 text-center text-zinc-500 text-xs">
                      No location references found in gallery.
                    </div>
                  )}
                </div>

                {/* Clear Background Option */}
                {backgroundUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      onClearBackground();
                      setIsLocationPickerOpen(false);
                    }}
                    className="w-full text-center py-1 text-xs text-zinc-400 hover:text-red-400 hover:bg-zinc-800/60 rounded transition-colors cursor-pointer"
                  >
                    Clear Background (Use Studio Grid)
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={onTriggerFileUpload}
          className="bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/60 px-2.5 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          title="Drop or upload a room photo"
        >
          <Upload className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden sm:inline">Drop/Upload Room</span>
        </button>
      </div>

      {/* Selected Actor Quick Status / Controls */}
      {selectedActor ? (
        <div className="flex items-center gap-1.5 bg-zinc-900/90 border border-indigo-500/40 px-2.5 py-1 rounded-lg">
          <span className="text-xs font-semibold text-indigo-300 flex items-center gap-1">
            <User className="w-3 h-3 text-indigo-400" />
            {selectedActor.characterName}
          </span>
          <span className="text-zinc-600">•</span>
          <span className="text-[11px] text-zinc-300 font-mono font-medium" title="Scale factor (20% to 350%+)">
            {Math.round(selectedActor.scale * 100)}%
          </span>
          <div className="flex items-center border border-zinc-700/60 rounded bg-zinc-950/60 overflow-hidden">
            <button
              type="button"
              onClick={() => onUpdateActor(selectedActor.id, { scale: Math.max(0.20, Math.round((selectedActor.scale - 0.1) * 100) / 100) })}
              className="px-1.5 py-0.5 text-[10px] text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
              title="Scale Down (-10%)"
            >
              -
            </button>
            <button
              type="button"
              onClick={() => onUpdateActor(selectedActor.id, { scale: Math.min(4.50, Math.round((selectedActor.scale + 0.1) * 100) / 100) })}
              className="px-1.5 py-0.5 text-[10px] text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
              title="Scale Up (+10%)"
            >
              +
            </button>
          </div>
          <span className="text-zinc-600">•</span>
          <span className="text-[10px] text-zinc-400 font-mono" title="Unconstrained position offsets">
            ({Math.round(selectedActor.xPercent)}%, {Math.round(selectedActor.yPercent)}%)
          </span>
          <span className="text-zinc-600">•</span>
          <button
            type="button"
            onClick={() => onToggleFlip(selectedActor)}
            className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200 cursor-pointer"
            title="Flip Horizontally"
          >
            <FlipHorizontal className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => onBringForward(selectedActor)}
            className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200 cursor-pointer"
            title="Bring Forward"
          >
            <ArrowUp className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => onSendBackward(selectedActor)}
            className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200 cursor-pointer"
            title="Send Backward"
          >
            <ArrowDown className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => onUpdateActor(selectedActor.id, { xPercent: 50, yPercent: 85, scale: 1.0 })}
            className="px-1.5 py-0.5 text-[10px] text-indigo-300 hover:text-white bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-800/60 rounded transition-colors cursor-pointer"
            title="Center on Stage (X: 50%, Y: 85%, Scale: 100%)"
          >
            Center
          </button>
          <span className="text-zinc-600">•</span>
          <button
            type="button"
            onClick={() => {
              if (isMaskingMode && maskingActorId === selectedActor.id) {
                onExitMaskingMode();
              } else {
                onEnterMaskingMode(selectedActor);
              }
            }}
            className={`px-2 py-0.5 text-[11px] font-medium rounded flex items-center gap-1 transition-colors cursor-pointer ${
              isMaskingMode && maskingActorId === selectedActor.id
                ? "bg-indigo-600 text-white border border-indigo-400 shadow-sm"
                : "text-indigo-300 hover:text-white bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/60"
            }`}
            title="Live in-place Actor Mask / Eraser Brush tool"
          >
            <Eraser className="w-3 h-3 text-indigo-300" />
            <span>{isMaskingMode && maskingActorId === selectedActor.id ? "Done Masking" : "Erase / Mask"}</span>
          </button>
        </div>
      ) : (
        <span className="text-[11px] text-zinc-500 italic hidden sm:inline">
          Click an actor on canvas to reposition, scale, or flip
        </span>
      )}
    </div>
  );
};
