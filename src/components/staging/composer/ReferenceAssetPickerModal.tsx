import React from "react";
import { MediaAsset } from "../../../types";
import { getAssetMediaUrl } from "../../../utils/assetUrl";
import { FolderOpen } from "lucide-react";
import { ComposerSlotType, ReferenceSlotState } from "./types";

interface ReferenceAssetPickerModalProps {
  activePickerSlot: ComposerSlotType | null;
  allAssets: MediaAsset[];
  onSelectAsset: (slotType: ComposerSlotType, slotData: ReferenceSlotState) => void;
  onClose: () => void;
}

export const ReferenceAssetPickerModal: React.FC<ReferenceAssetPickerModalProps> = ({
  activePickerSlot,
  allAssets,
  onSelectAsset,
  onClose
}) => {
  if (!activePickerSlot) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-purple-400" />
            Select {activePickerSlot.toUpperCase()} Reference
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-zinc-400 hover:text-white px-2 py-1 bg-zinc-800 rounded-md cursor-pointer"
          >
            Close
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {allAssets
            .filter(a => !a.media_type || a.media_type === "image")
            .map(asset => (
              <div
                key={asset.filename}
                onClick={() => {
                  onSelectAsset(activePickerSlot, {
                    filename: asset.filename,
                    previewUrl: getAssetMediaUrl(asset.filename),
                    label: asset.subject_name || asset.type
                  });
                }}
                className="group relative bg-zinc-900 border border-zinc-800 hover:border-purple-500 rounded-lg overflow-hidden cursor-pointer flex flex-col transition-all"
              >
                <div className="aspect-video bg-black flex items-center justify-center overflow-hidden">
                  <img
                    src={getAssetMediaUrl(asset.filename, true)}
                    alt={asset.description || asset.filename}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    loading="lazy"
                  />
                </div>
                <div className="p-2 text-[10px]">
                  <p className="font-semibold text-zinc-200 truncate">{asset.subject_name || asset.type}</p>
                  <p className="text-zinc-500 truncate text-[9px]">{asset.filename}</p>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};
