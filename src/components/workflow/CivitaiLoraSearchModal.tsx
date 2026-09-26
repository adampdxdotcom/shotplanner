import React, { useState, useEffect, useMemo } from "react";
import { 
  Search, 
  X, 
  Sparkles, 
  Download, 
  Check, 
  Copy, 
  ExternalLink, 
  Star, 
  Flame, 
  RefreshCw,
  Layers,
  CheckCircle2,
  AlertCircle,
  Bookmark
} from "lucide-react";
import { SystemLora, CivitaiSearchItem, CivitaiFavorite } from "../../types";
import { lorasApi } from "../../api";
import { 
  addCivitaiFavorite, 
  removeCivitaiFavorite, 
  fetchCivitaiFavorites, 
  CIVITAI_FAVORITES_EVENT 
} from "../../services/civitaiFavoritesService";
import { copyToClipboard } from "../../utils/clipboard";

interface CivitaiLoraSearchModalProps {
  isOpen: boolean;
  targetNodeId?: string;
  targetNodeTitle?: string;
  onClose: () => void;
  onSelectLora: (lora: SystemLora, autoInjectTriggers?: boolean) => void;
  onShowToast?: (text: string, type: "success" | "error" | "info") => void;
}

const BASE_MODEL_PRESETS = [
  { label: "All Base Models", value: "" },
  { label: "Wan 2.1", value: "Wan 2.1" },
  { label: "Flux.1 D", value: "Flux.1 D" },
  { label: "SDXL 1.0", value: "SDXL 1.0" },
  { label: "SD 1.5", value: "SD 1.5" },
  { label: "Hunyuan Video", value: "Hunyuan Video" }
];

export const CivitaiLoraSearchModal: React.FC<CivitaiLoraSearchModalProps> = ({
  isOpen,
  targetNodeId,
  targetNodeTitle,
  onClose,
  onSelectLora,
  onShowToast
}) => {
  const [activeTab, setActiveTab] = useState<"search" | "favorites">("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [baseModel, setBaseModel] = useState("");
  const [sort, setSort] = useState("Highest Rated");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CivitaiSearchItem[]>([]);
  const [favorites, setFavorites] = useState<CivitaiFavorite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copiedTrigger, setCopiedTrigger] = useState<string | null>(null);
  const [stagingId, setStagingId] = useState<number | null>(null);

  // Load favorites & subscribe to changes
  useEffect(() => {
    if (isOpen) {
      fetchCivitaiFavorites().then(favs => setFavorites(favs)).catch(() => {});
    }

    const handleFavChange = (e: Event) => {
      const customEvent = e as CustomEvent<CivitaiFavorite[]>;
      if (customEvent.detail && Array.isArray(customEvent.detail)) {
        setFavorites(customEvent.detail);
      } else {
        fetchCivitaiFavorites().then(favs => setFavorites(favs)).catch(() => {});
      }
    };

    window.addEventListener(CIVITAI_FAVORITES_EVENT, handleFavChange);
    return () => {
      window.removeEventListener(CIVITAI_FAVORITES_EVENT, handleFavChange);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && activeTab === "search") {
      handleSearch();
    }
  }, [isOpen, baseModel, sort, activeTab]);

  const handleSearch = async (overrideQuery?: string) => {
    const query = overrideQuery !== undefined ? overrideQuery : searchQuery;
    setLoading(true);
    setError(null);

    try {
      const res = await lorasApi.searchCivitai({
        query: query.trim() || undefined,
        base_model: baseModel || undefined,
        type: "LORA",
        sort,
        limit: 24
      });

      if (res && res.success && Array.isArray(res.items)) {
        setResults(res.items);
      } else {
        setResults([]);
      }
    } catch (err: any) {
      console.error("Civitai search error:", err);
      setError(err.message || "Failed to search Civitai models.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (activeTab === "search") {
        handleSearch();
      }
    }
  };

  const handleCopyTrigger = async (e: React.MouseEvent, triggers: string[], id: string) => {
    e.stopPropagation();
    if (!triggers || triggers.length === 0) return;
    const text = triggers.join(", ");
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedTrigger(id);
      setTimeout(() => setCopiedTrigger(null), 2000);
      onShowToast?.(`Copied trigger words: ${text}`, "info");
    }
  };

  // Toggle favorite for search result item
  const handleToggleFavoriteResult = async (e: React.MouseEvent, model: CivitaiSearchItem) => {
    e.stopPropagation();
    const version = model.modelVersions?.[0];
    if (!version) return;

    const versionId = version.id;
    const isFav = favorites.some(f => String(f.version_id) === String(versionId) || String(f.model_id) === String(model.id));

    if (isFav) {
      await removeCivitaiFavorite(versionId);
      onShowToast?.(`Removed "${model.name}" from Favorites`, "info");
    } else {
      const files = version.files || [];
      const primaryFile = files.find(f => f.primary || f.name.endsWith(".safetensors")) || files[0];
      const filename = primaryFile?.name || `${model.name.toLowerCase().replace(/[^a-z0-9_.-]/g, "_")}.safetensors`;
      const previewUrl = version.images?.[0]?.url || "";

      await addCivitaiFavorite({
        version_id: version.id,
        model_id: model.id,
        name: model.name,
        model_name: model.name,
        version_name: version.name || "v1.0",
        category: "LoRA",
        base_model: version.baseModel || "SDXL",
        image_url: previewUrl,
        preview_image_url: previewUrl,
        filename,
        download_url: version.downloadUrl || `https://civitai.com/api/download/models/${version.id}`,
        default_destination_folder: "models/loras/",
        trigger_words: version.trainedWords || [],
        trained_words: version.trainedWords || [],
        description: version.description || "",
        tags: model.tags || []
      });
      onShowToast?.(`Saved "${model.name}" to Favorites ⭐`, "success");
    }
  };

  // Choose model from search or favorite
  const handleChooseModel = async (model: CivitaiSearchItem, versionIdx = 0, stageDirectly = false) => {
    const version = model.modelVersions?.[versionIdx] || model.modelVersions?.[0];
    if (!version) return;

    // Find primary safetensors file or first file
    const files = version.files || [];
    const primaryFile = files.find(f => f.primary || f.name.endsWith(".safetensors")) || files[0];
    const filename = primaryFile?.name || `${model.name.toLowerCase().replace(/[^a-z0-9_.-]/g, "_")}.safetensors`;

    const triggerWords = version.trainedWords || [];
    const previewUrl = version.images?.[0]?.url || "";

    const systemLora: SystemLora = {
      id: `civitai_${version.id}`,
      name: model.name,
      filename,
      version_name: version.name || "v1.0",
      base_model: version.baseModel || "SDXL",
      category: "lora",
      trigger_words: triggerWords,
      default_destination_folder: "models/loras/",
      suggested_remote_path: `models/loras/${filename}`,
      download_url: version.downloadUrl || `https://civitai.com/api/download/models/${version.id}`,
      source: "civitai",
      model_id: model.id,
      version_id: version.id,
      preview_image_url: previewUrl,
      file_size_formatted: primaryFile ? `${(primaryFile.sizeKB / 1024).toFixed(1)} MB` : undefined,
      file_size_bytes: primaryFile ? primaryFile.sizeKB * 1024 : undefined,
      description: version.description || "",
      preferred_strength_model: 0.85,
      preferred_strength_clip: 1.0,
      is_favorite: true
    };

    try {
      // 1. Ensure backend system LoRA registry is updated
      await lorasApi.saveLora(systemLora).catch(() => {});

      // 2. Stage to Remote GPU if requested
      if (stageDirectly && systemLora.download_url) {
        setStagingId(version.id);
        onShowToast?.(`Staging "${model.name}" to remote GPU...`, "info");
        lorasApi.transferRemote({
          lora_id: systemLora.id,
          filename: systemLora.filename,
          download_url: systemLora.download_url,
          destination_folder: "models/loras/"
        }).then(res => {
          if (res?.success) {
            onShowToast?.(`Successfully staged "${model.name}" to remote GPU!`, "success");
          }
        }).catch(err => {
          console.warn("Failed remote download:", err);
        });
      }

      // 3. Callback to assign into slot
      onSelectLora(systemLora, true);
      onShowToast?.(`Assigned "${model.name}" to Slot #${targetNodeId || 'LoRA'}`, "success");
      onClose();
    } catch (err: any) {
      onShowToast?.(err.message || "Failed to register LoRA.", "error");
    } finally {
      setStagingId(null);
    }
  };

  // Choose from favorite
  const handleChooseFavorite = async (fav: CivitaiFavorite, stageDirectly = false) => {
    const triggerWords = fav.trained_words || fav.trigger_words || fav.trainedWords || [];
    const filename = fav.filename || `${(fav.name || "lora").toLowerCase().replace(/[^a-z0-9_.-]/g, "_")}.safetensors`;

    const systemLora: SystemLora = {
      id: `civitai_${fav.version_id}`,
      name: fav.name || fav.model_name || "Civitai LoRA",
      filename,
      version_name: fav.version_name || "v1.0",
      base_model: fav.base_model || "SDXL",
      category: "lora",
      trigger_words: triggerWords,
      default_destination_folder: fav.default_destination_folder || "models/loras/",
      suggested_remote_path: fav.suggested_remote_path || `models/loras/${filename}`,
      download_url: fav.download_url || `https://civitai.com/api/download/models/${fav.version_id}`,
      source: "civitai",
      model_id: fav.model_id,
      version_id: fav.version_id,
      preview_image_url: fav.preview_image_url || fav.image_url || "",
      file_size_formatted: fav.file_size_formatted || fav.file_size,
      file_size_bytes: fav.file_size_bytes,
      description: fav.clean_description || fav.description || "",
      preferred_strength_model: 0.85,
      preferred_strength_clip: 1.0,
      is_favorite: true
    };

    try {
      await lorasApi.saveLora(systemLora).catch(() => {});

      if (stageDirectly && systemLora.download_url) {
        setStagingId(fav.version_id);
        onShowToast?.(`Staging "${systemLora.name}" to remote GPU...`, "info");
        lorasApi.transferRemote({
          lora_id: systemLora.id,
          filename: systemLora.filename,
          download_url: systemLora.download_url,
          destination_folder: "models/loras/"
        }).then(res => {
          if (res?.success) {
            onShowToast?.(`Successfully staged "${systemLora.name}" to remote GPU!`, "success");
          }
        }).catch(err => {
          console.warn("Failed remote download:", err);
        });
      }

      onSelectLora(systemLora, true);
      onShowToast?.(`Assigned "${systemLora.name}" to Slot #${targetNodeId || 'LoRA'}`, "success");
      onClose();
    } catch (err: any) {
      onShowToast?.(err.message || "Failed to assign LoRA.", "error");
    } finally {
      setStagingId(null);
    }
  };

  // Filtered favorites list
  const filteredFavorites = useMemo(() => {
    return favorites.filter(fav => {
      const isLora = (fav.category || "").toLowerCase().includes("lora") || (fav.category || "").toLowerCase().includes("dora") || (fav.category || "").toLowerCase().includes("locon") || (fav.filename || "").endsWith(".safetensors");
      const matchBase = !baseModel || (fav.base_model || "").toLowerCase().includes(baseModel.toLowerCase());
      const matchQuery = !searchQuery.trim() || 
        (fav.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (fav.filename || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (fav.trained_words || []).some(w => w.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchBase && matchQuery && isLora;
    });
  }, [favorites, baseModel, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[120] flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-5xl flex flex-col max-h-[92vh] overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  Civitai LoRA Library Search &amp; Favorites
                </h2>
                {targetNodeId && (
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-purple-950 text-purple-300 border border-purple-800">
                    Target: Slot #{targetNodeId} {targetNodeTitle ? `(${targetNodeTitle})` : ""}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400">
                Search community LoRAs, pick from saved favorites, preview trigger words, assign directly to workflow slots, and stage onto remote GPU.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* View Mode Navigation Tabs */}
        <div className="flex items-center gap-2 px-4 pt-3 bg-zinc-900/40 border-b border-zinc-800/80">
          <button
            type="button"
            onClick={() => setActiveTab("search")}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === "search"
                ? "border-purple-500 text-white bg-zinc-900/80"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Search className="w-3.5 h-3.5 text-purple-400" />
            Explore Civitai Hub
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("favorites")}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === "favorites"
                ? "border-amber-500 text-white bg-zinc-900/80"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            My Saved Favorites ({favorites.length})
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-4 bg-zinc-900/40 border-b border-zinc-800/80 space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  activeTab === "search"
                    ? "Search Civitai LoRAs (e.g. cinematic, anime, cyberpunk, wan2.1, vintage lighting)..."
                    : "Filter your saved favorites..."
                }
                className="w-full pl-9 pr-20 py-2 text-xs bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-hidden focus:ring-2 focus:ring-purple-500 font-medium"
              />
              {activeTab === "search" && (
                <button
                  type="button"
                  onClick={() => handleSearch()}
                  disabled={loading}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                >
                  {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : "Search"}
                </button>
              )}
            </div>

            {/* Sort select (for search mode) */}
            {activeTab === "search" && (
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-hidden focus:ring-2 focus:ring-purple-500 cursor-pointer font-medium"
              >
                <option value="Highest Rated">⭐ Highest Rated</option>
                <option value="Most Downloaded">🔥 Most Downloaded</option>
                <option value="Newest">🕒 Newest</option>
                <option value="Most Liked">❤️ Most Liked</option>
              </select>
            )}
          </div>

          {/* Base Model Filter Chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-zinc-400 font-medium mr-1">Base Architecture:</span>
            {BASE_MODEL_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setBaseModel(preset.value)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                  baseModel === preset.value
                    ? "bg-purple-600 text-white border-purple-500 shadow-2xs"
                    : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:bg-zinc-800"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Results Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 min-h-[300px]">
          {activeTab === "favorites" ? (
            filteredFavorites.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 space-y-2 text-zinc-500 text-center">
                <Bookmark className="w-8 h-8 opacity-40 text-amber-500" />
                <p className="text-xs font-medium">No LoRAs found in your favorites matching filters.</p>
                <p className="text-[11px] text-zinc-600">Switch to the "Explore Civitai Hub" tab and click the ⭐ icon on any LoRA to pin it here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {filteredFavorites.map((fav) => {
                  const previewImg = fav.preview_image_url || fav.image_url;
                  const triggers = fav.trained_words || fav.trigger_words || fav.trainedWords || [];
                  const baseM = fav.base_model || "SDXL";
                  const sizeFormatted = fav.file_size_formatted || fav.file_size;
                  const isStagingThis = stagingId === fav.version_id;

                  return (
                    <div
                      key={fav.version_id}
                      className="bg-zinc-900/70 border border-zinc-800 hover:border-amber-500/50 rounded-xl overflow-hidden flex flex-col group transition-all duration-200 shadow-2xs hover:shadow-md"
                    >
                      {/* Thumbnail Image */}
                      <div className="aspect-4/3 bg-zinc-950 relative overflow-hidden flex items-center justify-center">
                        {previewImg ? (
                          <img
                            src={previewImg}
                            alt={fav.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="text-zinc-600 flex flex-col items-center gap-1">
                            <Layers className="w-8 h-8 opacity-40" />
                            <span className="text-[10px]">No Preview</span>
                          </div>
                        )}

                        {/* Base Model Badge */}
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-black/70 text-purple-300 border border-purple-500/30 backdrop-blur-xs">
                          {baseM}
                        </span>

                        {/* Favorited Badge */}
                        <span className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-950/80 text-amber-300 border border-amber-500/40 backdrop-blur-xs flex items-center gap-1">
                          <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                          <span>Saved</span>
                        </span>
                      </div>

                      {/* Body */}
                      <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2.5">
                        <div className="space-y-1">
                          <h4 className="text-xs font-bold text-white line-clamp-1 group-hover:text-amber-300 transition-colors" title={fav.name}>
                            {fav.name}
                          </h4>
                          <p className="text-[10px] text-zinc-400 truncate">
                            {fav.version_name || "v1.0"} {sizeFormatted && <span>• {sizeFormatted}</span>}
                          </p>
                        </div>

                        {/* Triggers */}
                        {triggers.length > 0 && (
                          <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-lg p-2 space-y-1 text-[11px]">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-zinc-400 font-semibold flex items-center gap-1">
                                <Flame className="w-2.5 h-2.5 text-amber-500" />
                                <span>Triggers</span>
                              </span>
                              <button
                                type="button"
                                onClick={(e) => handleCopyTrigger(e, triggers, String(fav.version_id))}
                                className="text-purple-400 hover:text-purple-300 flex items-center gap-0.5 cursor-pointer font-medium"
                              >
                                {copiedTrigger === String(fav.version_id) ? (
                                  <>
                                    <Check className="w-2.5 h-2.5 text-emerald-400" />
                                    <span className="text-emerald-400 text-[9px]">Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-2.5 h-2.5" />
                                    <span className="text-[9px]">Copy</span>
                                  </>
                                )}
                              </button>
                            </div>
                            <p className="font-mono text-[10px] text-purple-300 line-clamp-2">
                              {triggers.join(", ")}
                            </p>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="grid grid-cols-2 gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => handleChooseFavorite(fav, false)}
                            className="px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs flex items-center justify-center gap-1 shadow-2xs transition-colors cursor-pointer"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Assign Slot</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleChooseFavorite(fav, true)}
                            disabled={isStagingThis}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-800 text-white font-semibold text-xs flex items-center justify-center gap-1 shadow-2xs transition-colors cursor-pointer"
                            title="Assign to slot and stage file to Remote GPU immediately"
                          >
                            <Download className={`w-3 h-3 ${isStagingThis ? "animate-bounce" : ""}`} />
                            <span>{isStagingThis ? "Staging..." : "Assign & Stage"}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : loading ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-3 text-zinc-400">
              <RefreshCw className="w-8 h-8 animate-spin text-purple-500" />
              <span className="text-xs font-medium">Searching Civitai Model Hub...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-2 text-rose-400 text-center p-4">
              <AlertCircle className="w-8 h-8 opacity-80" />
              <p className="text-xs font-semibold">{error}</p>
              <button
                type="button"
                onClick={() => handleSearch()}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-medium cursor-pointer"
              >
                Retry Search
              </button>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-2 text-zinc-500 text-center">
              <Search className="w-8 h-8 opacity-40" />
              <p className="text-xs font-medium">No LoRA models found matching your query.</p>
              <p className="text-[11px] text-zinc-600">Try adjusting your keywords or clearing base model filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {results.map((model) => {
                const primaryVersion = model.modelVersions?.[0];
                const previewImg = primaryVersion?.images?.[0]?.url;
                const triggers = primaryVersion?.trainedWords || [];
                const baseM = primaryVersion?.baseModel || "SDXL";
                const sizeKB = primaryVersion?.files?.[0]?.sizeKB;
                const sizeMb = sizeKB ? (sizeKB / 1024).toFixed(1) + " MB" : undefined;
                const isStagingThis = stagingId === primaryVersion?.id;
                const isFav = primaryVersion && favorites.some(f => String(f.version_id) === String(primaryVersion.id) || String(f.model_id) === String(model.id));

                return (
                  <div
                    key={model.id}
                    className="bg-zinc-900/70 border border-zinc-800 hover:border-zinc-700 rounded-xl overflow-hidden flex flex-col group transition-all duration-200 shadow-2xs hover:shadow-md"
                  >
                    {/* Thumbnail Image Container */}
                    <div className="aspect-4/3 bg-zinc-950 relative overflow-hidden flex items-center justify-center">
                      {previewImg ? (
                        <img
                          src={previewImg}
                          alt={model.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="text-zinc-600 flex flex-col items-center gap-1">
                          <Layers className="w-8 h-8 opacity-40" />
                          <span className="text-[10px]">No Preview</span>
                        </div>
                      )}

                      {/* Base Model Badge */}
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-black/70 text-purple-300 border border-purple-500/30 backdrop-blur-xs">
                        {baseM}
                      </span>

                      {/* Favorite Button */}
                      <button
                        type="button"
                        onClick={(e) => handleToggleFavoriteResult(e, model)}
                        title={isFav ? "Remove from favorites" : "Save to favorites"}
                        className={`absolute top-2 right-2 p-1.5 rounded-lg border backdrop-blur-xs transition-all cursor-pointer ${
                          isFav
                            ? "bg-amber-950/80 border-amber-500/70 text-amber-300"
                            : "bg-black/60 border-zinc-700/60 text-zinc-300 hover:text-amber-300 hover:bg-black/80"
                        }`}
                      >
                        <Star className={`w-3 h-3 ${isFav ? "fill-amber-400 text-amber-400" : ""}`} />
                      </button>
                    </div>

                    {/* Body */}
                    <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2.5">
                      <div className="space-y-1">
                        <div className="flex items-start justify-between gap-1">
                          <h4 className="text-xs font-bold text-white line-clamp-1 group-hover:text-purple-300 transition-colors" title={model.name}>
                            {model.name}
                          </h4>
                        </div>
                        {model.creator?.username && (
                          <p className="text-[10px] text-zinc-400 truncate">
                            by <span className="text-zinc-300 font-medium">@{model.creator.username}</span>
                            {sizeMb && <span className="text-zinc-500"> • {sizeMb}</span>}
                          </p>
                        )}
                      </div>

                      {/* Trigger Words Section */}
                      {triggers.length > 0 && (
                        <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-lg p-2 space-y-1 text-[11px]">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-zinc-400 font-semibold flex items-center gap-1">
                              <Flame className="w-2.5 h-2.5 text-amber-500" />
                              <span>Triggers</span>
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleCopyTrigger(e, triggers, String(model.id))}
                              className="text-purple-400 hover:text-purple-300 flex items-center gap-0.5 cursor-pointer font-medium"
                            >
                              {copiedTrigger === String(model.id) ? (
                                <>
                                  <Check className="w-2.5 h-2.5 text-emerald-400" />
                                  <span className="text-emerald-400 text-[9px]">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-2.5 h-2.5" />
                                  <span className="text-[9px]">Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                          <p className="font-mono text-[10px] text-purple-300 line-clamp-2">
                            {triggers.join(", ")}
                          </p>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => handleChooseModel(model, 0, false)}
                          className="px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs flex items-center justify-center gap-1 shadow-2xs transition-colors cursor-pointer"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Assign Slot</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleChooseModel(model, 0, true)}
                          disabled={isStagingThis}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-800 text-white font-semibold text-xs flex items-center justify-center gap-1 shadow-2xs transition-colors cursor-pointer"
                          title="Assign to slot and stage file to Remote GPU immediately"
                        >
                          <Download className={`w-3 h-3 ${isStagingThis ? "animate-bounce" : ""}`} />
                          <span>{isStagingThis ? "Staging..." : "Assign & Stage"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

