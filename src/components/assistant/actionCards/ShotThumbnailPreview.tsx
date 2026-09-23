import React from "react";
import { ShotItem, MediaAsset } from "../../../types";
import { getAssetMediaUrl } from "../../../utils/assetUrl";
import { Film } from "lucide-react";

interface ShotThumbnailPreviewProps {
  shot?: ShotItem | null;
  shotNumber?: number;
  assets?: MediaAsset[];
  sceneName?: string;
}

export const ShotThumbnailPreview: React.FC<ShotThumbnailPreviewProps> = ({
  shot,
  shotNumber
}) => {
  if (!shot) return null;

  // 1. Check for Hero Take or Latest Render Take
  const heroTake = (shot.takes || []).find(t => t.id === shot.hero_take_id || t.is_hero) || (shot.takes && shot.takes.length > 0 ? shot.takes[shot.takes.length - 1] : null);
  const renderFilename = heroTake?.video_filename || (heroTake as any)?.filename || heroTake?.video_url || (heroTake as any)?.url;

  // 2. Check for Location Asset Slot (Slot 8 / Slot 9)
  const locationFilename = shot.assigned_slots?.[8] || 
                           shot.assigned_slots?.[9] || 
                           (shot.assigned_slots as any)?.["8"] || 
                           (shot.assigned_slots as any)?.["9"] || 
                           (shot.assigned_slots as any)?.["location"];

  // 3. Fallback: Image / First Frame
  const fallbackFilename = shot.first_frame || (shot as any).image || (shot as any).image_url;

  const targetFilename = renderFilename || locationFilename || fallbackFilename;
  if (!targetFilename) return null;

  const isVideo = Boolean(targetFilename && /\.(mp4|mov|webm|mkv|avi)$/i.test(targetFilename));
  const thumbUrl = getAssetMediaUrl(targetFilename, true);
  const fullUrl = getAssetMediaUrl(targetFilename, false);

  const displayShotNum = shot.shot_number || shotNumber || 1;
  const label = renderFilename 
    ? `Shot #${displayShotNum} Hero Render` 
    : (locationFilename ? `Shot #${displayShotNum} Location` : `Shot #${displayShotNum} Preview`);

  return (
    <div className="my-2 p-2 rounded-lg bg-slate-100/90 dark:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-700/60 flex items-center gap-2.5 text-xs">
      <div className="relative w-16 h-10 rounded-md overflow-hidden bg-zinc-900 border border-slate-300 dark:border-zinc-700 shrink-0">
        {isVideo ? (
          <video
            src={`${thumbUrl}#t=0.001`}
            preload="metadata"
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <img
            src={thumbUrl}
            alt={targetFilename}
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              if (target.src !== fullUrl) {
                target.src = fullUrl;
              } else {
                target.style.display = "none";
              }
            }}
          />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 font-semibold text-slate-800 dark:text-zinc-200 truncate text-[11px]">
          <Film className="w-3 h-3 text-indigo-500 shrink-0" />
          <span className="truncate">{label}</span>
        </div>
        <span className="font-mono text-[10px] text-slate-500 dark:text-zinc-400 truncate block">
          {targetFilename}
        </span>
      </div>
    </div>
  );
};
