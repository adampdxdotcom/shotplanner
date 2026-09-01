import React from "react";
import { MediaAsset, ShotItem } from "../types";
import { UploadCloud, Edit3, Trash2, Maximize, Video as VideoIcon, Music } from "lucide-react";
import { getAssetMediaUrl } from "../utils/assetUrl";

interface AssetCardProps {
  asset: MediaAsset;
  idx: number;
  type: string;
  className?: string;
  onEdit: () => void;
  onDelete: () => void;
  onLightbox: () => void;
}

export const AssetCard: React.FC<AssetCardProps> = ({ asset, idx, type, className = "", onEdit, onDelete, onLightbox }) => {
  const isImage = asset.media_type === "image" || (!asset.media_type && !/\.(mp3|wav|ogg|m4a|mp4|mov|webm)$/i.test(asset.filename)) || /\.(png|jpe?g|webp|gif|svg|avif|bmp)$/i.test(asset.filename);
  const isAudio = asset.media_type === "audio" || /\.(mp3|wav|ogg|m4a|flac)$/i.test(asset.filename);
  const isVideo = asset.media_type === "video" || /\.(mp4|mov|webm|mkv)$/i.test(asset.filename);
  const imageSrc = getAssetMediaUrl(asset, true);

  return (
    <div className={`bg-zinc-950 p-3 rounded-xl border-2 border-zinc-700 hover:border-zinc-600 transition-all space-y-2 relative group flex flex-col ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-zinc-800 text-zinc-300 text-[10px] font-mono font-bold flex items-center justify-center">
            {idx + 1}
          </span>
          <div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
              {asset.type}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="text-zinc-500 hover:text-indigo-400 p-1 rounded transition-colors"
            title="Edit asset"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="text-zinc-500 hover:text-red-400 p-1 rounded transition-colors"
            title="Remove asset"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {isImage ? (
        <div 
          className="relative w-full aspect-square bg-zinc-900 rounded-lg overflow-hidden cursor-pointer group/img border border-zinc-800 flex items-center justify-center"
          onClick={onLightbox}
        >
          <img 
            src={imageSrc} 
            alt={asset.subject_name || "Asset"} 
            className="w-full h-full object-cover" 
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
            <Maximize className="w-6 h-6 text-white" />
          </div>
        </div>
      ) : isVideo ? (
        <div className="relative w-full aspect-square bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 flex flex-col items-center justify-center text-indigo-400 gap-2">
          <VideoIcon className="w-8 h-8 opacity-80" />
          <span className="text-[10px] font-mono text-zinc-400 uppercase">Video Asset</span>
        </div>
      ) : (
        <div className="relative w-full aspect-square bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 flex flex-col items-center justify-center text-emerald-400 gap-2">
          <Music className="w-8 h-8 opacity-80" />
          <span className="text-[10px] font-mono text-zinc-400 uppercase">Audio Asset</span>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-zinc-100 truncate">
          {asset.subject_name || "Unnamed"}
        </p>
        <p className="text-[11px] font-mono text-zinc-400 truncate mt-0.5">
          {asset.filename}
        </p>
      </div>

      {asset.description && (
        <p className="text-[11px] text-zinc-400 line-clamp-2 italic bg-zinc-900/70 p-1.5 rounded border-2 border-zinc-700/50">
          "{asset.description}"
        </p>
      )}

      <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-1 border-t border-zinc-900 mt-auto">
        <span>{(asset.size_bytes / 1024).toFixed(1)} KB</span>
        <span className="font-mono text-indigo-400">
          {isVideo ? `<Video ${idx + 1}>` : isAudio ? `<Audio ${idx + 1}>` : `<Picture ${idx + 1}>`}
        </span>
      </div>
    </div>
  );
};

export const EmptySlotCard: React.FC<{ idx: number, type: string, className?: string, onClick: () => void }> = ({ idx, type, className = "", onClick }) => (
  <div 
    onClick={onClick}
    className={`bg-zinc-950/30 p-3 rounded-xl border-2 border-dashed border-zinc-800/80 flex flex-col items-center justify-center min-h-[160px] text-zinc-600 transition-colors cursor-pointer hover:border-zinc-600 hover:bg-zinc-900/50 hover:text-zinc-400 group ${className}`}
  >
    <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center mb-2 group-hover:bg-zinc-800 group-hover:text-amber-400 transition-colors">
      <UploadCloud className="w-4 h-4" />
    </div>
    <span className="text-xs font-semibold mb-1 uppercase tracking-wider opacity-50 group-hover:opacity-100 transition-opacity">Upload Slot</span>
    <span className="font-mono text-[10px] text-zinc-500 group-hover:text-zinc-400 transition-colors">
      {type === "video" ? `<Video ${idx + 1}>` : type === "audio" ? `<Audio ${idx + 1}>` : `<Picture ${idx + 1}>`}
    </span>
  </div>
);
