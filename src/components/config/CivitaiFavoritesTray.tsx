import React, { useState } from "react";
import { CivitaiFavorite } from "../../types";
import { Star, ChevronDown, ChevronUp, X, Sparkles, Layers, HardDrive } from "lucide-react";

export interface CivitaiFavoritesTrayProps {
  favorites: CivitaiFavorite[];
  activeVersionId?: number | string | null;
  onSelectFavorite: (fav: CivitaiFavorite) => void;
  onRemoveFavorite: (versionId: number | string, e: React.MouseEvent) => void;
  isLoading?: boolean;
}

export const CivitaiFavoritesTray: React.FC<CivitaiFavoritesTrayProps> = ({
  favorites,
  activeVersionId,
  onSelectFavorite,
  onRemoveFavorite,
  isLoading = false
}) => {
  const [isOpen, setIsOpen] = useState(true);

  // Helper for category badge color
  const getCategoryColor = (category?: string) => {
    const cat = (category || "").toLowerCase();
    if (cat.includes("lora") || cat.includes("dora") || cat.includes("lycoris")) {
      return "bg-purple-950/70 border-purple-800/60 text-purple-300";
    }
    if (cat.includes("controlnet") || cat.includes("adapter")) {
      return "bg-emerald-950/70 border-emerald-800/60 text-emerald-300";
    }
    if (cat.includes("vae")) {
      return "bg-amber-950/70 border-amber-800/60 text-amber-300";
    }
    if (cat.includes("upscale")) {
      return "bg-pink-950/70 border-pink-800/60 text-pink-300";
    }
    return "bg-blue-950/70 border-blue-800/60 text-blue-300";
  };

  return (
    <div id="civitai-saved-favorites-tray" className="w-full bg-neutral-950/70 border border-neutral-800/80 rounded-xl overflow-hidden shadow-xs transition-all">
      {/* Tray Header Bar */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3.5 py-2.5 flex items-center justify-between bg-neutral-900/60 hover:bg-neutral-900/90 transition-colors text-left cursor-pointer border-b border-neutral-800/60"
      >
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0" />
          <span className="text-xs font-semibold text-neutral-200">
            Saved Favorites
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950/50 border border-amber-800/50 text-amber-300 font-semibold">
            {favorites.length}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-neutral-400 text-xs font-medium">
          <span className="text-[11px] text-neutral-500 hidden sm:inline">
            {isOpen ? "Collapse" : "Expand"}
          </span>
          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-neutral-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-neutral-400" />
          )}
        </div>
      </button>

      {/* Collapsible Content */}
      {isOpen && (
        <div className="p-3">
          {favorites.length === 0 ? (
            <div className="flex items-center justify-between gap-3 px-3 py-3 rounded-lg bg-neutral-900/40 border border-dashed border-neutral-800 text-xs text-neutral-400">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400/70 shrink-0" />
                <span>
                  No favorite models saved yet. Click the <strong>⭐ Favorite</strong> button on any model preview to pin it here for 1-click access.
                </span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-64 overflow-y-auto pr-1">
              {favorites.map((fav) => {
                const isSelected = activeVersionId && String(fav.version_id) === String(activeVersionId);
                const title = fav.name || fav.model_name || "Civitai Model";
                const img = fav.image_url || fav.preview_image_url;
                const size = fav.file_size_formatted || fav.file_size;

                return (
                  <div
                    key={fav.version_id}
                    onClick={() => onSelectFavorite(fav)}
                    title={`Load ${title} (${fav.version_name || "Latest"})`}
                    className={`group relative flex items-start gap-2.5 p-2 rounded-lg border transition-all cursor-pointer text-left select-none ${
                      isSelected
                        ? "bg-amber-950/30 border-amber-600/70 shadow-sm ring-1 ring-amber-500/40"
                        : "bg-neutral-900/80 hover:bg-neutral-850 border-neutral-800 hover:border-neutral-700"
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="w-12 h-12 rounded-md bg-neutral-950 border border-neutral-800 overflow-hidden shrink-0 relative flex items-center justify-center">
                      {img ? (
                        <img
                          src={img}
                          alt={title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      ) : (
                        <Layers className="w-5 h-5 text-neutral-600" />
                      )}
                    </div>

                    {/* Meta Details */}
                    <div className="flex-1 min-w-0 pr-4">
                      <h4 className="text-xs font-semibold text-neutral-200 truncate group-hover:text-amber-300 transition-colors">
                        {title}
                      </h4>
                      {fav.version_name && (
                        <p className="text-[10px] text-neutral-400 truncate">
                          {fav.version_name}
                        </p>
                      )}

                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className={`text-[9px] px-1.5 py-0.2 rounded border font-medium uppercase tracking-tight ${getCategoryColor(fav.category)}`}>
                          {fav.category || "Model"}
                        </span>
                        {fav.base_model && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-400 font-mono">
                            {fav.base_model}
                          </span>
                        )}
                        {size && (
                          <span className="text-[9px] text-neutral-500 font-mono hidden xl:inline">
                            {size}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Remove Action Button */}
                    <button
                      type="button"
                      onClick={(e) => onRemoveFavorite(fav.version_id, e)}
                      title="Remove from favorites"
                      className="absolute top-1.5 right-1.5 w-5 h-5 rounded flex items-center justify-center text-neutral-500 hover:text-red-400 hover:bg-red-950/60 opacity-60 hover:opacity-100 transition-all cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default CivitaiFavoritesTray;
