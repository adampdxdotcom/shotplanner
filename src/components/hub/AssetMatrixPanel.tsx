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
    const shotFilenameOverride = activeShot?.assigned_slots[slotIndex] || activeShot?.assigned_slots[String(slotIndex)];
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

  return (
    <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 flex flex-col gap-4 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Asset Matrix (Slots 1-9)</h2>
          <p className="text-xs text-zinc-400">Assigned character & scene references</p>
        </div>
        <span className="text-xs text-zinc-500 font-mono">
          {Object.keys(activeShot.assigned_slots || {}).length} Assigned
        </span>
      </div>
      
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
                    onClick={() => onClearSlot(i)}
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
  );
};
