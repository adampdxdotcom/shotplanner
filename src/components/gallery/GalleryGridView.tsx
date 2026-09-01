import React from "react";
import { MediaAsset } from "../../types";
import { Image as ImageIcon, Video as VideoIcon, Music, Edit3, Trash2, Play, Pause, FileText, ChevronRight } from "lucide-react";
import { formatSize } from "../../utils/formatters";
import { getAssetMediaUrl } from "../../utils/assetUrl";

interface GalleryGridViewProps {
  assets: MediaAsset[];
  playingAudioUrl: string | null;
  toggleAudio: (e: React.MouseEvent, url: string) => void;
  setLightboxAsset: (asset: MediaAsset) => void;
  setEditingAsset: (asset: MediaAsset) => void;
  handleDeleteAsset: (asset: MediaAsset) => void;
}

export const GalleryGridView: React.FC<GalleryGridViewProps> = ({
  assets, playingAudioUrl, toggleAudio, setLightboxAsset, setEditingAsset, handleDeleteAsset
}) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
      {assets.map((asset, idx) => {
        const isVideoOrAudio = /\.(mp3|wav|ogg|m4a|flac|mp4|mov|webm|mkv)$/i.test(asset.filename);
        const isAudio = /\.(mp3|wav|ogg|m4a|flac)$/i.test(asset.filename);
        const mediaUrl = getAssetMediaUrl(asset.filename, false);

        return (
          <div key={idx} className="group relative bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-700 transition-all shadow-sm flex flex-col h-full cursor-pointer"
               onClick={() => setLightboxAsset(asset)}>
            {/* Asset Preview */}
            <div className="aspect-[4/3] bg-zinc-950 flex items-center justify-center relative overflow-hidden">
              {asset.media_type === "image" || (!asset.media_type && !isVideoOrAudio) ? (
                <img
                  src={getAssetMediaUrl(asset, true)}
                  alt={asset.subject_name || asset.filename}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                />
              ) : isAudio ? (
                <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                  <button
                    onClick={(e) => toggleAudio(e, mediaUrl)}
                    className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors shadow-lg ${
                      playingAudioUrl === mediaUrl ? 'bg-amber-500 text-zinc-900' : 'bg-zinc-800 text-emerald-400 hover:bg-zinc-700 hover:text-emerald-300'
                    }`}
                  >
                    {playingAudioUrl === mediaUrl ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
                  </button>
                </div>
              ) : (
                <div className="w-full h-full bg-black relative flex items-center justify-center">
                  <VideoIcon className="w-12 h-12 text-indigo-500/50" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play className="w-10 h-10 text-white drop-shadow-md" />
                  </div>
                </div>
              )}

              {/* Badges Overlay */}
              <div className="absolute top-2 left-2 flex gap-1.5 flex-wrap pointer-events-none">
                {asset.media_type === "image" || (!asset.media_type && !isVideoOrAudio) ? (
                  <span className="bg-black/60 backdrop-blur-md text-amber-500 p-1.5 rounded shadow-sm border border-black/50">
                    <ImageIcon className="w-3.5 h-3.5" />
                  </span>
                ) : isAudio ? (
                  <span className="bg-black/60 backdrop-blur-md text-emerald-400 p-1.5 rounded shadow-sm border border-black/50">
                    <Music className="w-3.5 h-3.5" />
                  </span>
                ) : (
                  <span className="bg-black/60 backdrop-blur-md text-indigo-400 p-1.5 rounded shadow-sm border border-black/50">
                    <VideoIcon className="w-3.5 h-3.5" />
                  </span>
                )}
                {asset.type && (
                  <span className="bg-black/60 backdrop-blur-md text-zinc-300 text-[10px] font-bold px-2 py-1 rounded shadow-sm border border-black/50">
                    {asset.type}
                  </span>
                )}
              </div>

              {/* Action Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="absolute top-2 right-2 flex gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingAsset(asset); }}
                    className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded backdrop-blur-md transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteAsset(asset); }}
                    className="p-1.5 bg-black/60 hover:bg-red-900/80 text-red-400 rounded backdrop-blur-md transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Meta */}
            <div className="p-3 bg-zinc-900 flex-1 flex flex-col justify-between border-t border-zinc-800">
              <div>
                <h4 className="font-bold text-xs text-zinc-200 line-clamp-1 mb-1">
                  {asset.subject_name || "Unlabeled"}
                </h4>
                {asset.description && (
                  <p className="text-[10px] text-zinc-400 line-clamp-2 leading-relaxed mb-2">
                    {asset.description}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between mt-auto">
                <div className="text-[10px] font-mono text-zinc-600 truncate max-w-[100px]" title={asset.original_name}>
                  {asset.original_name}
                </div>
                <div className="text-[10px] font-medium text-zinc-500 whitespace-nowrap ml-2 shrink-0">
                  {formatSize(asset.size_bytes || 0)}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
