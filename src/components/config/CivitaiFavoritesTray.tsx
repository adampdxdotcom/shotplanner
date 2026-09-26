import React, { useState, useMemo } from "react";
import { CivitaiFavorite } from "../../types";
import { Star, ChevronDown, ChevronUp, X, Sparkles, Layers, Copy, Check, Filter } from "lucide-react";
import { copyToClipboard } from "../../utils/clipboard";

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
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [trayFilter, setTrayFilter] = useState<string>("");
  const [copiedTriggerId, setCopiedTriggerId] = useState<string | null>(null);

  // Derive unique categories from favorites
  const categories = useMemo(() => {
    const set = new Set<string>();
    favorites.forEach(f => {
      if (f.category) set.add(f.category);
    });
    return Array.from(set);
  }, [favorites]);

  // Filter favorites by category and search text
  const filteredFavorites = useMemo(() => {
    return favorites.filter(fav => {
      const matchCat = selectedCategory === "all" || (fav.category || "").toLowerCase() === selectedCategory.toLowerCase();
      const matchText = !trayFilter.trim() || 
        (fav.name || "").toLowerCase().includes(trayFilter.toLowerCase()) ||
        (fav.base_model || "").toLowerCase().includes(trayFilter.toLowerCase()) ||
        (fav.filename || "").toLowerCase().includes(trayFilter.toLowerCase());
      return matchCat && matchText;
    });
  }, [favorites, selectedCategory, trayFilter]);

  // Helper for category badge color
  const getCategoryColor = (category?: string) => {
    const cat = (category || "").toLowerCase();
    if (cat.includes("lora") || cat.includes("dora") || cat.includes("lycoris")) {
      return "bg-purple-50 dark:bg-purple-950/70 border-purple-200 dark:border-purple-800/60 text-purple-700 dark:text-purple-300";
    }
    if (cat.includes("controlnet") || cat.includes("adapter")) {
      return "bg-emerald-50 dark:bg-emerald-950/70 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300";
    }
    if (cat.includes("vae")) {
      return "bg-amber-50 dark:bg-amber-950/70 border-amber-200 dark:border-amber-800/60 text-amber-750 dark:text-amber-300";
    }
    if (cat.includes("upscale")) {
      return "bg-pink-50 dark:bg-pink-950/70 border-pink-200 dark:border-pink-800/60 text-pink-700 dark:text-pink-300";
    }
    return "bg-blue-50 dark:bg-blue-950/70 border-blue-200 dark:border-blue-800/60 text-blue-700 dark:text-blue-300";
  };

  const handleCopyTriggers = async (e: React.MouseEvent, fav: CivitaiFavorite) => {
    e.stopPropagation();
    const words = fav.trained_words || fav.trigger_words || fav.trainedWords || [];
    if (!words || words.length === 0) return;
    const text = words.join(", ");
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedTriggerId(String(fav.version_id));
      setTimeout(() => setCopiedTriggerId(null), 1500);
    }
  };

  return (
    <div id="civitai-saved-favorites-tray" className="w-full bg-zinc-50 dark:bg-neutral-950/70 border border-zinc-200 dark:border-neutral-800/80 rounded-xl overflow-hidden shadow-xs transition-all text-zinc-900 dark:text-zinc-100">
      {/* Tray Header Bar */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3.5 py-2.5 flex items-center justify-between bg-white dark:bg-neutral-900/60 hover:bg-zinc-100 dark:hover:bg-neutral-900/90 transition-colors text-left cursor-pointer border-b border-zinc-200 dark:border-neutral-800/60"
      >
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />
          <span className="text-xs font-semibold text-zinc-800 dark:text-neutral-200">
            Saved Favorites
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300 font-semibold">
            {favorites.length}
          </span>
          {isLoading && (
            <span className="text-[10px] text-zinc-400 dark:text-neutral-500 animate-pulse font-normal">
              Syncing...
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-zinc-500 dark:text-neutral-400 text-xs font-medium">
          <span className="text-[11px] text-zinc-400 dark:text-neutral-500 hidden sm:inline">
            {isOpen ? "Collapse" : "Expand"}
          </span>
          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-zinc-500 dark:text-neutral-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-zinc-500 dark:text-neutral-400" />
          )}
        </div>
      </button>

      {/* Collapsible Content */}
      {isOpen && (
        <div className="p-3 space-y-3">
          {/* Filter Bar if favorites exist */}
          {favorites.length > 3 && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pb-1 border-b border-zinc-200/80 dark:border-neutral-800/60">
              {/* Category Pills */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                <button
                  type="button"
                  onClick={() => setSelectedCategory("all")}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer border ${
                    selectedCategory === "all"
                      ? "bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-400/40"
                      : "bg-white dark:bg-neutral-900 text-zinc-600 dark:text-neutral-400 border-zinc-200 dark:border-neutral-800 hover:bg-zinc-100"
                  }`}
                >
                  All ({favorites.length})
                </button>
                {categories.map((cat) => {
                  const count = favorites.filter(f => (f.category || "").toLowerCase() === cat.toLowerCase()).length;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer border whitespace-nowrap ${
                        selectedCategory.toLowerCase() === cat.toLowerCase()
                          ? "bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-400/40"
                          : "bg-white dark:bg-neutral-900 text-zinc-600 dark:text-neutral-400 border-zinc-200 dark:border-neutral-800 hover:bg-zinc-100"
                      }`}
                    >
                      {cat} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Quick filter input */}
              <input
                type="text"
                placeholder="Filter favorites..."
                value={trayFilter}
                onChange={(e) => setTrayFilter(e.target.value)}
                className="px-2 py-1 text-[11px] bg-white dark:bg-neutral-900 border border-zinc-200 dark:border-neutral-800 rounded-lg text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 outline-none w-full sm:w-36"
              />
            </div>
          )}

          {favorites.length === 0 ? (
            <div className="flex items-center justify-between gap-3 px-3 py-3 rounded-lg bg-white dark:bg-neutral-900/40 border border-dashed border-zinc-200 dark:border-neutral-800 text-xs text-zinc-500 dark:text-neutral-400">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500/70 dark:text-amber-400/70 shrink-0" />
                <span>
                  No favorite models saved yet. Click the <strong>⭐ Favorite</strong> button on any model preview or search result to pin it here for 1-click access.
                </span>
              </div>
            </div>
          ) : filteredFavorites.length === 0 ? (
            <div className="p-3 text-center text-xs text-zinc-500 dark:text-neutral-400">
              No favorites match the selected filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-64 overflow-y-auto pr-1">
              {filteredFavorites.map((fav) => {
                const isSelected = activeVersionId && String(fav.version_id) === String(activeVersionId);
                const title = fav.name || fav.model_name || "Civitai Model";
                const img = fav.image_url || fav.preview_image_url;
                const size = fav.file_size_formatted || fav.file_size;
                const words = fav.trained_words || fav.trigger_words || fav.trainedWords || [];
                const hasTriggers = words.length > 0;
                const isCopied = copiedTriggerId === String(fav.version_id);

                return (
                  <div
                    key={fav.version_id}
                    onClick={() => onSelectFavorite(fav)}
                    title={`Load ${title} (${fav.version_name || "Latest"})`}
                    className={`group relative flex items-start gap-2.5 p-2 rounded-lg border transition-all cursor-pointer text-left select-none ${
                      isSelected
                        ? "bg-amber-50 dark:bg-amber-950/30 border-amber-500/70 shadow-sm ring-1 ring-amber-500/40"
                        : "bg-white dark:bg-neutral-900/80 hover:bg-zinc-50 dark:hover:bg-neutral-850 border-zinc-200 dark:border-neutral-800 hover:border-zinc-300 dark:hover:border-neutral-700"
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="w-12 h-12 rounded-md bg-zinc-100 dark:bg-neutral-950 border border-zinc-200 dark:border-neutral-800 overflow-hidden shrink-0 relative flex items-center justify-center">
                      {img ? (
                        <img
                          src={img}
                          alt={title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      ) : (
                        <Layers className="w-5 h-5 text-zinc-400 dark:text-neutral-600" />
                      )}
                    </div>

                    {/* Meta Details */}
                    <div className="flex-1 min-w-0 pr-5">
                      <h4 className="text-xs font-semibold text-zinc-800 dark:text-neutral-200 truncate group-hover:text-amber-650 dark:group-hover:text-amber-300 transition-colors">
                        {title}
                      </h4>
                      {fav.version_name && (
                        <p className="text-[10px] text-zinc-500 dark:text-neutral-400 truncate">
                          {fav.version_name}
                        </p>
                      )}

                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className={`text-[9px] px-1.5 py-0.2 rounded border font-medium uppercase tracking-tight ${getCategoryColor(fav.category)}`}>
                          {fav.category || "Model"}
                        </span>
                        {fav.base_model && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-neutral-800 text-zinc-500 dark:text-neutral-400 border border-zinc-200 dark:border-neutral-700 font-mono">
                            {fav.base_model}
                          </span>
                        )}
                        {size && (
                          <span className="text-[9px] text-zinc-400 dark:text-neutral-500 font-mono hidden xl:inline">
                            {size}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quick Trigger Copy Button */}
                    {hasTriggers && (
                      <button
                        type="button"
                        onClick={(e) => handleCopyTriggers(e, fav)}
                        title={`Copy triggers: ${words.join(", ")}`}
                        className="absolute bottom-1.5 right-1.5 p-1 rounded hover:bg-zinc-200 dark:hover:bg-neutral-800 text-purple-600 dark:text-purple-400 transition-colors cursor-pointer"
                      >
                        {isCopied ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3 opacity-60 group-hover:opacity-100" />
                        )}
                      </button>
                    )}

                    {/* Remove Action Button */}
                    <button
                      type="button"
                      onClick={(e) => onRemoveFavorite(fav.version_id, e)}
                      title="Remove from favorites"
                      className="absolute top-1.5 right-1.5 w-5 h-5 rounded flex items-center justify-center text-zinc-400 hover:text-red-500 dark:text-neutral-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/60 opacity-60 hover:opacity-100 transition-all cursor-pointer"
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

