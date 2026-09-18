import React from "react";
import { ShotItem, MediaAsset } from "../../types";
import { getAssetMediaUrl } from "../../utils/assetUrl";
import { X } from "lucide-react";

interface AssetMatrixPanelProps {
  activeShot: ShotItem;
  assets: MediaAsset[];
  onClearSlot: (slotIndex: number) => void;
}

export const AssetMatrixPanel: React.FC<AssetMatrixPanelProps> = ({
  activeShot,
  assets,
  onClearSlot
}) => {
  const getAssetForSlot = (slotIndex: number) => {
    let shotFilenameOverride = activeShot?.assigned_slots?.[slotIndex] || activeShot?.assigned_slots?.[String(slotIndex)];
    if (!shotFilenameOverride && slotIndex === 8) {
      shotFilenameOverride = activeShot?.assigned_slots?.[9] || activeShot?.assigned_slots?.[String(9)];
    }
    if (shotFilenameOverride) {
       const matchedAsset = assets.find(a => a.filename === shotFilenameOverride || (a as any).name === shotFilenameOverride);
       if (matchedAsset) {
           return { ...matchedAsset, preview_url: getAssetMediaUrl(matchedAsset, true), isGhost: false };
       }
       return {
         filename: shotFilenameOverride,
         preview_url: "",
         isGhost: true,
         label: `Missing: ${shotFilenameOverride}`
       } as any;
    }
    return null;
  };

  // Only show images present for the shot; Slot 9 only appears if present, retaining its Location designation
  const slotsToDisplay = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter(i => {
    const asset = getAssetForSlot(i);
    return Boolean(asset?.preview_url || asset?.filename);
  });

  return (
    <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 flex flex-col gap-4 overflow-y-auto h-full shadow-xs">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Asset Matrix</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Assigned character & scene references</p>
        </div>
        <span className="text-xs text-zinc-500 font-mono">
          {slotsToDisplay.length} Assigned
        </span>
      </div>
      
      {slotsToDisplay.length > 0 ? (
        <div className="grid grid-cols-3 gap-3">
          {slotsToDisplay.map((i) => {
            const asset = getAssetForSlot(i);
            const isLocation = i === 8; // Slot 9 (index 8) is location
            
            return (
              <div 
                key={i} 
                className={`relative aspect-square rounded-lg border flex flex-col items-center justify-center overflow-hidden shadow-2xs ${
                  isLocation 
                    ? "border-amber-400 dark:border-amber-500/50 bg-amber-50 dark:bg-amber-950/15" 
                    : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50"
                }`}
              >
                {asset?.isGhost ? (
                  <div className="flex flex-col items-center justify-center text-center p-2 bg-red-50/50 dark:bg-red-950/20 w-full h-full border border-red-200 dark:border-red-900/50 rounded-lg">
                    <div className="absolute top-1 left-1 bg-red-600/80 text-white text-[9px] font-mono px-1 py-0.2 rounded z-10">
                      Slot {i + 1}
                    </div>
                    <button 
                      onClick={() => onClearSlot(i)}
                      className="absolute top-1 right-1 bg-red-800/80 hover:bg-red-700 p-1 rounded-full text-white backdrop-blur z-10 transition-colors cursor-pointer"
                      title="Clear ghost slot"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <span className="text-[10px] font-semibold text-red-600 dark:text-red-400">Missing Asset</span>
                    <span className="text-[9px] font-mono text-zinc-500 truncate max-w-full px-1">{asset.filename}</span>
                  </div>
                ) : asset?.preview_url ? (
                  <>
                    <img src={asset.preview_url} className="absolute inset-0 w-full h-full object-cover" alt="" />
                    <div className="absolute top-1 left-1 bg-black/70 backdrop-blur-xs text-zinc-200 text-[10px] font-mono px-1.5 py-0.5 rounded border border-white/10 z-10">
                      Slot {i + 1}
                    </div>
                    <button 
                      onClick={() => onClearSlot(i)}
                      className="absolute top-1 right-1 bg-black/60 hover:bg-black p-1 rounded-full text-white backdrop-blur z-10 transition-colors cursor-pointer"
                      title="Clear slot for this shot"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    {asset.subject_name && !isLocation && (
                      <div className="absolute bottom-0 inset-x-0 bg-black/75 backdrop-blur-xs text-white text-[10px] font-medium truncate px-1.5 py-0.5 z-10 text-center">
                        {asset.subject_name}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-2">
                    <span className="text-zinc-400 dark:text-zinc-500 text-xs font-mono">
                      Slot {i + 1}
                    </span>
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
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-6 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg text-center">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">No reference assets assigned to this shot</p>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">Assign characters or location references in the Assets or Staging tabs</p>
        </div>
      )}
    </div>
  );
};
