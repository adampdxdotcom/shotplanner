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
    <div className={`character-asset-card bg-white dark:bg-zinc-950 p-3 rounded-xl border-2 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600 transition-all space-y-2 relative group flex flex-col shadow-xs hover:shadow-sm ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-transparent text-[10px] font-mono font-bold flex items-center justify-center">
            {idx + 1}
          </span>
          <div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20">
              {asset.type}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="text-zinc-400 hover:text-indigo-600 hover:bg-zinc-100 dark:text-zinc-500 dark:hover:text-indigo-400 dark:hover:bg-zinc-800 p-1 rounded transition-colors cursor-pointer"
            title="Edit asset"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="text-zinc-400 hover:text-red-600 hover:bg-zinc-100 dark:text-zinc-500 dark:hover:text-red-400 dark:hover:bg-zinc-800 p-1 rounded transition-colors cursor-pointer"
            title="Remove asset"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {isImage ? (
        <div 
          className="relative w-full aspect-square bg-zinc-100 dark:bg-zinc-900 rounded-lg overflow-hidden cursor-pointer group/img border border-zinc-200 dark:border-zinc-800 flex items-center justify-center"
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
        <div className="relative w-full aspect-square bg-indigo-50/40 dark:bg-zinc-900 rounded-lg overflow-hidden border border-indigo-100 dark:border-zinc-800 flex flex-col items-center justify-center text-indigo-600 dark:text-indigo-400 gap-2">
          <VideoIcon className="w-8 h-8 opacity-80" />
          <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 uppercase">Video Asset</span>
        </div>
      ) : (
        <div className="relative w-full aspect-square bg-emerald-50/40 dark:bg-zinc-900 rounded-lg overflow-hidden border border-emerald-100 dark:border-zinc-800 flex flex-col items-center justify-center text-emerald-600 dark:text-emerald-400 gap-2">
          <Music className="w-8 h-8 opacity-80" />
          <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 uppercase">Audio Asset</span>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
          {asset.subject_name || "Unnamed"}
        </p>
        <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
          {asset.filename}
        </p>
      </div>

      {asset.description && (
        <p className="text-[11px] text-zinc-600 dark:text-zinc-400 line-clamp-2 italic bg-zinc-50 dark:bg-zinc-900/70 p-1.5 rounded border border-zinc-200 dark:border-zinc-700/50">
          "{asset.description}"
        </p>
      )}

      <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400 pt-1 border-t border-zinc-100 dark:border-zinc-900 mt-auto">
        <span>{(asset.size_bytes / 1024).toFixed(1)} KB</span>
        <span className="font-mono font-medium text-indigo-600 dark:text-indigo-400">
          {isVideo ? `<Video ${idx + 1}>` : isAudio ? `<Audio ${idx + 1}>` : `<Picture ${idx + 1}>`}
        </span>
      </div>
    </div>
  );
};

export const EmptySlotCard: React.FC<{ idx: number, type: string, className?: string, onClick: () => void }> = ({ idx, type, className = "", onClick }) => (
  <div 
    onClick={onClick}
    className={`empty-slot-card bg-slate-50/80 dark:bg-zinc-950/30 p-3 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-800/80 flex flex-col items-center justify-center min-h-[160px] text-zinc-600 dark:text-zinc-500 transition-all cursor-pointer hover:border-indigo-400 dark:hover:border-zinc-600 hover:bg-indigo-50/40 dark:hover:bg-zinc-900/50 hover:text-indigo-600 dark:hover:text-zinc-300 group shadow-xs hover:shadow-sm ${className}`}
  >
    <div className="w-9 h-9 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center mb-2 shadow-xs group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 dark:group-hover:bg-zinc-800 dark:group-hover:text-amber-400 transition-all text-zinc-500 dark:text-zinc-400">
      <UploadCloud className="w-4 h-4" />
    </div>
    <span className="text-xs font-semibold mb-1 uppercase tracking-wider text-zinc-700 dark:text-zinc-400 group-hover:text-indigo-700 dark:group-hover:text-zinc-200 transition-colors">
      Upload Slot
    </span>
    <span className="font-mono text-[10px] font-medium text-zinc-500 dark:text-zinc-500 group-hover:text-indigo-600 dark:group-hover:text-zinc-400 transition-colors">
      {type === "video" ? `<Video ${idx + 1}>` : type === "audio" ? `<Audio ${idx + 1}>` : `<Picture ${idx + 1}>`}
    </span>
  </div>
);
