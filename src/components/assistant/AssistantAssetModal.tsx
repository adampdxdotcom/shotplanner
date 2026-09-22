import React, { useState, useMemo } from "react";
import { MediaAsset, ImageVisualAnalysis } from "../../types";
import { Search, X, Eye, CheckCircle2, Image as ImageIcon, Sparkles } from "lucide-react";
import { getAssetMediaUrl } from "../../utils/assetUrl";

interface AssistantAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAsset: (asset: MediaAsset) => void;
  assets?: MediaAsset[];
  visualCache?: Record<string, ImageVisualAnalysis>;
  sceneName?: string;
}

/**
 * Clean asset library picker modal for the Production Assistant Vision skill.
 * Allows users to browse and pick any project/scene image to submit for multimodal analysis.
 */
export const AssistantAssetModal: React.FC<AssistantAssetModalProps> = ({
  isOpen,
  onClose,
  onSelectAsset,
  assets = [],
  visualCache = {},
  sceneName
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "scanned" | "unscanned">("all");

  // Filter only valid image assets
  const imageAssets = useMemo(() => {
    return assets.filter((a) => {
      if (!a) return false;
      const isImg =
        a.media_type === "image" ||
        (!a.media_type && !/\.(mp3|wav|ogg|m4a|mp4|mov|webm)$/i.test(a.filename)) ||
        /\.(png|jpe?g|webp|gif|svg|avif|bmp)$/i.test(a.filename);
      return isImg;
    });
  }, [assets]);

  const filteredAssets = useMemo(() => {
    let list = imageAssets;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (a) =>
          a.filename.toLowerCase().includes(q) ||
          (a.subject_name || "").toLowerCase().includes(q) ||
          (a.type || "").toLowerCase().includes(q) ||
          (a.description || "").toLowerCase().includes(q)
      );
    }

    if (filterType === "scanned") {
      list = list.filter((a) => Boolean(visualCache[a.filename]));
    } else if (filterType === "unscanned") {
      list = list.filter((a) => !visualCache[a.filename]);
    }

    return list;
  }, [imageAssets, searchQuery, filterType, visualCache]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Eye className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Select Image for Vision Inspection</span>
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                  {sceneName || "Project Library"}
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Choose a photo to send full-sized to the Production Assistant.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="p-3 border-b border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center gap-2 bg-slate-50/30 dark:bg-zinc-900/30">
          <div className="relative flex-1 w-full">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by filename, character, or type..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0 w-full sm:w-auto">
            <button
              onClick={() => setFilterType("all")}
              className={`px-2.5 py-1 text-[11px] rounded-md transition-colors cursor-pointer ${
                filterType === "all"
                  ? "bg-slate-200 dark:bg-zinc-700 font-semibold text-slate-900 dark:text-white"
                  : "text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
              }`}
            >
              All ({imageAssets.length})
            </button>
            <button
              onClick={() => setFilterType("scanned")}
              className={`px-2.5 py-1 text-[11px] rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                filterType === "scanned"
                  ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-500/30"
                  : "text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
              }`}
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              Scanned
            </button>
            <button
              onClick={() => setFilterType("unscanned")}
              className={`px-2.5 py-1 text-[11px] rounded-md transition-colors cursor-pointer ${
                filterType === "unscanned"
                  ? "bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-500/30"
                  : "text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
              }`}
            >
              New
            </button>
          </div>
        </div>

        {/* Asset Grid */}
        <div className="p-4 overflow-y-auto max-h-[50vh] flex-1">
          {filteredAssets.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <ImageIcon className="w-8 h-8 text-slate-300 dark:text-zinc-600 mb-2" />
              <p className="text-xs font-medium text-slate-600 dark:text-zinc-400">
                {searchQuery ? "No matching images found" : "No project images available"}
              </p>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                Upload photos in the Asset Manager or Cast tab to analyze them.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredAssets.map((asset) => {
                const isScanned = Boolean(visualCache[asset.filename]);
                const imageUrl = getAssetMediaUrl(asset, true);

                return (
                  <div
                    key={asset.id || asset.filename}
                    onClick={() => {
                      onSelectAsset(asset);
                      onClose();
                    }}
                    className="group relative flex flex-col rounded-xl overflow-hidden border border-slate-200 dark:border-zinc-800 hover:border-indigo-500 dark:hover:border-indigo-400 bg-slate-50 dark:bg-zinc-800/60 hover:shadow-md transition-all cursor-pointer text-left"
                  >
                    {/* Thumbnail */}
                    <div className="aspect-square w-full relative bg-slate-200 dark:bg-zinc-950 overflow-hidden">
                      <img
                        src={imageUrl}
                        alt={asset.filename}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                      
                      {/* Scanned Badge */}
                      {isScanned ? (
                        <div className="absolute top-1.5 right-1.5 bg-emerald-500/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-xs backdrop-blur-xs">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          <span>Scanned</span>
                        </div>
                      ) : (
                        <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-600/90 text-white text-[9px] font-medium px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-xs">
                          <Sparkles className="w-2.5 h-2.5" />
                          <span>Inspect</span>
                        </div>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="p-2 flex flex-col gap-0.5">
                      <span className="text-[11px] font-semibold text-slate-900 dark:text-zinc-100 truncate" title={asset.filename}>
                        {asset.filename}
                      </span>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-zinc-400">
                        <span className="truncate max-w-[70%]">
                          {asset.subject_name || asset.type || "Asset"}
                        </span>
                        {asset.size_bytes && (
                          <span className="shrink-0 font-mono text-[9px]">
                            {(asset.size_bytes / 1024).toFixed(0)}KB
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
          <span>{filteredAssets.length} image(s) available</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
