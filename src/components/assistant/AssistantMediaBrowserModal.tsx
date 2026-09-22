import React, { useState, useMemo } from "react";
import { Search, X, Eye, CheckCircle2, Image as ImageIcon, Tag, Sparkles } from "lucide-react";
import { MediaAsset, ImageVisualAnalysis } from "../../types";
import { getAssetMediaUrl } from "../../utils/assetUrl";

interface AssistantMediaBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets: MediaAsset[];
  visualCache?: Record<string, ImageVisualAnalysis>;
  onSelectAsset: (asset: MediaAsset) => void;
}

export const AssistantMediaBrowserModal: React.FC<AssistantMediaBrowserModalProps> = ({
  isOpen,
  onClose,
  assets = [],
  visualCache = {},
  onSelectAsset
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<"all" | "cast" | "scene" | "scanned">("all");

  // Filter only image assets
  const imageAssets = useMemo(() => {
    return assets.filter((a) => {
      const isImage = !a.media_type || a.media_type === "image";
      return isImage;
    });
  }, [assets]);

  // Filter based on search query & category tab
  const filteredAssets = useMemo(() => {
    return imageAssets.filter((asset) => {
      // Category filter
      if (filterCategory === "scanned") {
        if (!visualCache[asset.filename]) return false;
      } else if (filterCategory === "cast") {
        const typeStr = (asset.type || asset.asset_type || "").toLowerCase();
        if (!typeStr.includes("headshot") && !typeStr.includes("body") && !asset.subject_name) return false;
      } else if (filterCategory === "scene") {
        const typeStr = (asset.type || asset.asset_type || "").toLowerCase();
        const fname = asset.filename.toLowerCase();
        if (!typeStr.includes("scene") && !typeStr.includes("location") && !typeStr.includes("style") && !fname.includes("scene")) return false;
      }

      // Search query
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      const matchName = asset.original_name?.toLowerCase().includes(query) || asset.filename.toLowerCase().includes(query);
      const matchSubject = asset.subject_name?.toLowerCase().includes(query);
      const matchType = (asset.type || asset.asset_type || "").toLowerCase().includes(query);
      const matchSummary = visualCache[asset.filename]?.summary?.toLowerCase().includes(query);

      return matchName || matchSubject || matchType || matchSummary;
    });
  }, [imageAssets, searchQuery, filterCategory, visualCache]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                Select Asset for Vision Analysis
                <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Full Resolution
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Choose an image asset from your project library for the Production Assistant to inspect.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-3 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col sm:flex-row gap-2.5 items-center justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search assets by name, character, tag..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 text-xs">
            <button
              onClick={() => setFilterCategory("all")}
              className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                filterCategory === "all"
                  ? "bg-indigo-600 text-white font-medium"
                  : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700"
              }`}
            >
              All ({imageAssets.length})
            </button>
            <button
              onClick={() => setFilterCategory("cast")}
              className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                filterCategory === "cast"
                  ? "bg-indigo-600 text-white font-medium"
                  : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700"
              }`}
            >
              Cast & Headshots
            </button>
            <button
              onClick={() => setFilterCategory("scene")}
              className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                filterCategory === "scene"
                  ? "bg-indigo-600 text-white font-medium"
                  : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700"
              }`}
            >
              Scene & Location
            </button>
            <button
              onClick={() => setFilterCategory("scanned")}
              className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                filterCategory === "scanned"
                  ? "bg-emerald-600 text-white font-medium"
                  : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700"
              }`}
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              Scanned ({Object.keys(visualCache).length})
            </button>
          </div>
        </div>

        {/* Asset Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredAssets.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-zinc-500 flex flex-col items-center">
              <ImageIcon className="w-10 h-10 stroke-1 mb-2 opacity-50" />
              <p className="text-xs font-medium">No matching image assets found</p>
              <p className="text-[11px] mt-1 text-slate-500">
                {assets.length === 0
                  ? "Upload assets in the Media Manager or Cast tab first."
                  : "Try adjusting your search query or category filter."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredAssets.map((asset) => {
                const isScanned = Boolean(visualCache[asset.filename]);
                const scannedData = visualCache[asset.filename];
                const thumbUrl = getAssetMediaUrl(asset, true);

                return (
                  <div
                    key={asset.id || asset.filename}
                    onClick={() => {
                      onSelectAsset(asset);
                      onClose();
                    }}
                    className="group relative bg-slate-100 dark:bg-zinc-800/80 rounded-xl overflow-hidden border border-slate-200/80 dark:border-zinc-700/80 hover:border-indigo-500 dark:hover:border-indigo-500 transition-all cursor-pointer flex flex-col shadow-2xs hover:shadow-md"
                  >
                    {/* Image Preview Container */}
                    <div className="relative aspect-4/3 w-full bg-slate-900 overflow-hidden">
                      <img
                        src={thumbUrl}
                        alt={asset.filename}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        loading="lazy"
                      />
                      
                      {/* Scanned Badge */}
                      {isScanned ? (
                        <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-emerald-950/90 text-emerald-300 border border-emerald-500/30 text-[10px] font-medium flex items-center gap-1 shadow-2xs">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>Scanned</span>
                        </div>
                      ) : (
                        <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-zinc-900/80 text-zinc-300 border border-zinc-700 text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-indigo-400" />
                          <span>Unscanned</span>
                        </div>
                      )}

                      {/* Select Hover Overlay */}
                      <div className="absolute inset-0 bg-indigo-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[11px] font-medium shadow-md">
                          Inspect with Vision
                        </span>
                      </div>
                    </div>

                    {/* Metadata Footer */}
                    <div className="p-2.5 flex flex-col gap-1 bg-white dark:bg-zinc-900 flex-1 justify-between border-t border-slate-100 dark:border-zinc-800">
                      <div>
                        <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200 truncate leading-tight" title={asset.filename}>
                          {asset.subject_name ? `${asset.subject_name}` : asset.filename}
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-zinc-500 truncate mt-0.5">
                          {asset.filename}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-1 mt-1 pt-1 border-t border-slate-100 dark:border-zinc-800/60 text-[10px]">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 font-medium truncate max-w-[100px]">
                          {asset.type || asset.asset_type || "Image"}
                        </span>
                        {scannedData?.summary && (
                          <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium truncate" title={scannedData.summary}>
                            Cached Note
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

        {/* Modal Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/80 flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
          <span>{filteredAssets.length} image assets available</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>

      </div>
    </div>
  );
};
