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
           return { ...matchedAsset, preview_url: getAssetMediaUrl(matchedAsset, true) };
       }
       return {
         filename: shotFilenameOverride,
         preview_url: getAssetMediaUrl(shotFilenameOverride, true),
         label: `Slot ${slotIndex + 1}`
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
    <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 flex flex-col gap-4 overflow-y-auto h-full shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Asset Matrix</h2>
          <p className="text-xs text-zinc-400">Assigned character & scene references</p>
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
                className={`relative aspect-square rounded-lg border flex flex-col items-center justify-center overflow-hidden ${
                  isLocation 
                    ? "border-amber-500/50 bg-amber-950/15" 
                    : "border-zinc-800 bg-zinc-950/50"
                }`}
              >
                {asset?.preview_url ? (
                  <>
                    <img src={asset.preview_url} className="absolute inset-0 w-full h-full object-cover" alt="" />
                    <div className="absolute top-1 left-1 bg-black/70 backdrop-blur-xs text-zinc-300 text-[10px] font-mono px-1.5 py-0.5 rounded border border-white/10 z-10">
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
                    <span className="text-zinc-500 text-xs font-mono">
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
        <div className="flex-1 flex flex-col items-center justify-center p-6 border border-dashed border-zinc-800 rounded-lg text-center">
          <p className="text-xs text-zinc-500 font-medium">No reference assets assigned to this shot</p>
          <p className="text-[11px] text-zinc-600 mt-1">Assign characters or location references in the Assets or Staging tabs</p>
        </div>
      )}
    </div>
  );
};
