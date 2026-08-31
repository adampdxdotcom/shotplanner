import React from "react";
import { MediaAsset } from "../types";
import { X, Trash2 } from "lucide-react";
import { getAssetMediaUrl } from "../utils/assetUrl";
import { formatSize } from "../utils/formatters";

interface AssetLightboxProps {
  asset: MediaAsset | null;
  onClose: () => void;
  onDelete?: (asset: MediaAsset) => void;
}

export const AssetLightbox: React.FC<AssetLightboxProps> = ({ asset, onClose, onDelete }) => {
  if (!asset) return null;

  const isVideoOrAudio = /\.(mp3|wav|ogg|m4a|flac|mp4|mov|webm|mkv)$/i.test(asset.filename);
  const isImage = asset.media_type === "image" || (!asset.media_type && !isVideoOrAudio);

  return (
    <div 
      className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4 cursor-zoom-out"
      onClick={onClose}
    >
      <div className="absolute top-4 right-4 flex items-center gap-3">
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(asset);
            }}
            className="p-2.5 bg-zinc-900 hover:bg-red-900/80 border border-zinc-800 text-red-400 rounded-full shadow-lg transition-colors cursor-pointer"
            title="Delete asset"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
        <button 
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="p-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white rounded-full shadow-lg transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div 
        className="max-w-4xl max-h-[80vh] flex items-center justify-center rounded-xl overflow-hidden shadow-2xl bg-zinc-950/80 border border-zinc-850"
        onClick={(e) => e.stopPropagation()}
      >
        {isImage ? (
          <img 
            src={getAssetMediaUrl(asset.filename)} 
            alt={asset.subject_name || "Asset"} 
            className="max-w-full max-h-[80vh] object-contain"
            referrerPolicy="no-referrer"
          />
        ) : (
          <video 
            src={getAssetMediaUrl(asset.filename)} 
            className="max-w-full max-h-[80vh] object-contain"
            controls
            autoPlay
          />
        )}
      </div>

      <div 
        className="mt-4 p-4 bg-zinc-900/90 border border-zinc-800 rounded-xl max-w-2xl text-center shadow-lg space-y-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-bold text-zinc-100">{asset.subject_name || "Unlabeled Asset"}</h3>
        <p className="text-xs text-amber-400 font-mono font-medium">{asset.type || "Scene Reference"}</p>
        {asset.description && (
          <p className="text-xs text-zinc-400 max-w-lg leading-relaxed">{asset.description}</p>
        )}
        <div className="flex justify-center items-center gap-3 text-[10px] text-zinc-500 pt-1.5 border-t border-zinc-850">
          <span>Original filename: {asset.original_name}</span>
          <span>•</span>
          <span>Size: {formatSize(asset.size_bytes || 0)}</span>
        </div>
      </div>
    </div>
  );
};
