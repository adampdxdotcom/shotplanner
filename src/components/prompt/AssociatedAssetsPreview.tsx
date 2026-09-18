import React from "react";
import { MediaAsset } from "../../types";
import { getAssetMediaUrl } from "../../utils/assetUrl";
import { Image as ImageIcon, Video as VideoIcon, Music as MusicIcon } from "lucide-react";

interface AssociatedAssetsPreviewProps {
  displayAssociatedAssets: Array<MediaAsset & { slot_index?: number }>;
}

/**
 * 3-wide thumbnail grid displaying reference photos and assets linked to the current shot,
 * complete with generated <Picture X>, <Video X>, and slot badges.
 */
export const AssociatedAssetsPreview: React.FC<AssociatedAssetsPreviewProps> = ({
  displayAssociatedAssets
}) => {
  return (
    <div className="bg-white dark:bg-zinc-900/70 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700/60 text-[11px] space-y-2 shadow-xs">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-zinc-900 dark:text-zinc-200 flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          Associated Reference Assets ({displayAssociatedAssets.length})
        </span>
        <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
          3-wide preview
        </span>
      </div>

      {displayAssociatedAssets.length === 0 ? (
        <p className="text-zinc-500 italic py-2 text-center bg-zinc-50 dark:bg-zinc-950/40 rounded border border-zinc-200 dark:border-zinc-800/60 text-xs">
          No assets associated with this shot. Upload or assign assets to inject reference tags.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2.5 max-h-64 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700">
          {displayAssociatedAssets.map((asset, i) => {
            const slotNum = asset.slot_index !== undefined ? asset.slot_index + 1 : i + 1;
            const tagLabel = asset.media_type === "video" 
              ? `<Video ${slotNum}>` 
              : asset.media_type === "audio" 
              ? `<Audio ${slotNum}>` 
              : `<Picture ${slotNum}>`;
            const isVideo = asset.media_type === "video" || /\.(mp4|mov|webm|mkv)$/i.test(asset.filename);
            const isAudio = asset.media_type === "audio" || /\.(mp3|wav|ogg|m4a|flac)$/i.test(asset.filename);

            return (
              <div 
                key={`${slotNum}_${asset.filename}`}
                className="bg-zinc-50/90 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-700/80 hover:border-amber-400 dark:hover:border-amber-500/50 rounded-lg p-2 flex flex-col gap-1.5 transition-all shadow-xs group"
              >
                {/* Slot Badge & Tag Header */}
                <div className="flex items-center justify-between gap-1">
                  <span className="px-1.5 py-0.5 bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30 font-mono font-bold text-[10px] rounded border truncate">
                    {tagLabel}
                  </span>
                  <span className="text-[9px] font-mono text-zinc-500 dark:text-zinc-400 font-medium shrink-0">
                    Slot {slotNum}
                  </span>
                </div>

                {/* Thumbnail View */}
                <div className="relative w-full aspect-[4/3] bg-zinc-100 dark:bg-zinc-900 rounded overflow-hidden border border-zinc-200 dark:border-zinc-800 flex items-center justify-center">
                  {isAudio ? (
                    <div className="flex flex-col items-center justify-center gap-1 text-zinc-500 dark:text-zinc-400 p-2">
                      <MusicIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                      <span className="text-[9px] font-mono">Audio Track</span>
                    </div>
                  ) : isVideo ? (
                    <>
                      <video
                        src={getAssetMediaUrl(asset)}
                        className="w-full h-full object-cover"
                        preload="metadata"
                        muted
                      />
                      <div className="absolute top-1 left-1 p-0.5 bg-black/70 rounded text-amber-400">
                        <VideoIcon className="w-3 h-3" />
                      </div>
                    </>
                  ) : (
                    <img
                      src={getAssetMediaUrl(asset, true)}
                      alt={asset.subject_name || asset.filename}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  )}
                </div>

                {/* Caption / Subject Info */}
                <div className="space-y-0.5 min-w-0">
                  <p className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-200 truncate" title={asset.subject_name || asset.filename}>
                    {asset.subject_name || asset.filename}
                  </p>
                  <p className="text-[9px] text-zinc-500 dark:text-zinc-400 truncate capitalize">
                    {asset.asset_type || asset.media_type || "Image"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
