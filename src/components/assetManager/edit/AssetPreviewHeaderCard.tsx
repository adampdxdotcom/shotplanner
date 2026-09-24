import React from "react";
import { MediaAsset } from "../../../types";
import { getAssetMediaUrl } from "../../../utils/assetUrl";

interface AssetPreviewHeaderCardProps {
  asset: MediaAsset;
  effectiveType: string;
  subjectName: string;
}

export const AssetPreviewHeaderCard: React.FC<AssetPreviewHeaderCardProps> = ({
  asset,
  effectiveType,
  subjectName
}) => {
  const isImage = asset.media_type === "image" || !asset.media_type || !/\.(mp4|mov|webm|mp3|wav)$/i.test(asset.filename);

  return (
    <div className="bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-3 flex items-center gap-3.5 shadow-2xs">
      <div className="w-14 h-14 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden shrink-0 relative flex items-center justify-center">
        {isImage ? (
          <img 
            src={getAssetMediaUrl(asset.filename, true)} 
            alt={asset.filename} 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
            {asset.filename.split('.').pop()?.toUpperCase()}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-mono font-semibold text-zinc-900 dark:text-zinc-200 truncate">{asset.filename}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20 px-1.5 py-0.5 rounded font-medium">
            {effectiveType}
          </span>
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium truncate">
            {subjectName || "Unassigned"}
          </span>
        </div>
      </div>
    </div>
  );
};
