import React from "react";
import { 
  Image as ImageIcon,
  Video as VideoIcon,
  Music,
  Clapperboard
} from "lucide-react";

export const MAX_IMAGES = 9;
export const MAX_VIDEOS = 1;
export const MAX_AUDIOS = 3;

interface AssetTabBarProps {
  activeTab: "image" | "audio" | "video" | "takes";
  onSelectTab: (tab: "image" | "audio" | "video" | "takes") => void;
  takesCount: number;
}

/**
 * Tab bar selector for Image Slots, Video Slot, Audio Slots, and Takes view.
 */
export const AssetTabBar: React.FC<AssetTabBarProps> = ({
  activeTab,
  onSelectTab,
  takesCount
}) => {
  return (
    <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-px">
      <button
        type="button"
        onClick={() => onSelectTab("image")}
        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
          activeTab === "image" 
            ? "border-indigo-600 text-indigo-700 bg-indigo-50/80 dark:border-indigo-400 dark:text-indigo-300 dark:bg-indigo-950/20 font-semibold" 
            : "border-transparent text-zinc-600 hover:text-zinc-900 hover:border-zinc-300 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:border-zinc-700"
        }`}
      >
        <ImageIcon className="w-4 h-4" />
        Image Slots
        <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold transition-colors ${
          activeTab === "image"
            ? "bg-indigo-100 text-indigo-800 dark:bg-zinc-800 dark:text-zinc-300"
            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
        }`}>
          {MAX_IMAGES}
        </span>
      </button>

      <button
        type="button"
        onClick={() => onSelectTab("video")}
        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
          activeTab === "video" 
            ? "border-indigo-600 text-indigo-700 bg-indigo-50/80 dark:border-indigo-400 dark:text-indigo-300 dark:bg-indigo-950/20 font-semibold" 
            : "border-transparent text-zinc-600 hover:text-zinc-900 hover:border-zinc-300 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:border-zinc-700"
        }`}
      >
        <VideoIcon className="w-4 h-4" />
        Video Slot
        <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold transition-colors ${
          activeTab === "video"
            ? "bg-indigo-100 text-indigo-800 dark:bg-zinc-800 dark:text-zinc-300"
            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
        }`}>
          {MAX_VIDEOS}
        </span>
      </button>

      <button
        type="button"
        onClick={() => onSelectTab("audio")}
        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
          activeTab === "audio" 
            ? "border-indigo-600 text-indigo-700 bg-indigo-50/80 dark:border-indigo-400 dark:text-indigo-300 dark:bg-indigo-950/20 font-semibold" 
            : "border-transparent text-zinc-600 hover:text-zinc-900 hover:border-zinc-300 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:border-zinc-700"
        }`}
      >
        <Music className="w-4 h-4" />
        Audio Slots
        <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold transition-colors ${
          activeTab === "audio"
            ? "bg-indigo-100 text-indigo-800 dark:bg-zinc-800 dark:text-zinc-300"
            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
        }`}>
          {MAX_AUDIOS}
        </span>
      </button>

      {/* Takes Tab on Far Right */}
      <button
        type="button"
        onClick={() => onSelectTab("takes")}
        className={`ml-auto flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
          activeTab === "takes" 
            ? "border-amber-500 text-amber-700 bg-amber-50/80 dark:border-amber-400 dark:text-amber-300 dark:bg-amber-950/20 font-semibold" 
            : "border-transparent text-zinc-600 hover:text-zinc-900 hover:border-zinc-300 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:border-zinc-700"
        }`}
      >
        <Clapperboard className="w-4 h-4 text-amber-500" />
        Takes
        <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold transition-colors ${
          activeTab === "takes"
            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200"
            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
        }`}>
          {takesCount}
        </span>
      </button>
    </div>
  );
};
