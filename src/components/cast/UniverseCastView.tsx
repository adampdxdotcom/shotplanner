import React, { useState } from "react";
import { UniverseCharacterProfile, MediaAsset, AppConfig } from "../../types";
import { 
  Globe, 
  User, 
  MapPin, 
  Plus, 
  Trash2, 
  ArrowDownToLine, 
  Sparkles, 
  Pencil, 
  Settings,
  ChevronRight,
  Search,
  ExternalLink,
  Layers
} from "lucide-react";
import { getAssetMediaUrl } from "../../utils/assetUrl";
import { isLocationEntity } from "../../utils/locationUtils";

interface UniverseCastViewProps {
  universeCharacters: Record<string, UniverseCharacterProfile>;
  assets: MediaAsset[];
  activeSceneName: string;
  config?: AppConfig;
  onImportToScene: (char: UniverseCharacterProfile) => void;
  onUpdateUniverseChar: (profile: UniverseCharacterProfile) => void;
  onDeleteUniverseChar: (name: string) => void;
  onOpenAssetStudio: (subject: string, isLocation: boolean) => void;
  onOpenBulkUpload: (subject: string, isLocation: boolean) => void;
  onOpenLightbox: (asset: MediaAsset) => void;
  onOpenEditAsset: (asset: MediaAsset) => void;
  onCreateNewUniverseChar: () => void;
  addToast: (msg: string, type?: "success" | "error" | "info") => void;
  sceneCharacterNames: string[];
}

export const UniverseCastView: React.FC<UniverseCastViewProps> = ({
  universeCharacters,
  assets,
  activeSceneName,
  config,
  onImportToScene,
  onUpdateUniverseChar,
  onDeleteUniverseChar,
  onOpenAssetStudio,
  onOpenBulkUpload,
  onOpenLightbox,
  onOpenEditAsset,
  onCreateNewUniverseChar,
  addToast,
  sceneCharacterNames
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "characters" | "locations">("all");
  const [characterToDelete, setCharacterToDelete] = useState<string | null>(null);

  const charList: UniverseCharacterProfile[] = Object.values(universeCharacters || {});

  const filteredCharacters: UniverseCharacterProfile[] = charList.filter(c => {
    const matchesSearch = !searchQuery.trim() || 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.notes || "").toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;

    const isLoc = !!c.is_location;
    if (filterType === "characters" && isLoc) return false;
    if (filterType === "locations" && !isLoc) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl shadow-xs dark:shadow-none">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search universe cast and locations..."
            className="w-full bg-zinc-50 dark:bg-zinc-950/80 border border-zinc-300 dark:border-zinc-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setFilterType("all")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                filterType === "all" ? "bg-white text-amber-700 shadow-xs dark:bg-zinc-800 dark:text-amber-300" : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              All ({charList.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType("characters")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1 ${
                filterType === "characters" ? "bg-white text-indigo-700 shadow-xs dark:bg-zinc-800 dark:text-indigo-300" : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              <User className="w-3 h-3" />
              Characters
            </button>
            <button
              type="button"
              onClick={() => setFilterType("locations")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1 ${
                filterType === "locations" ? "bg-white text-emerald-700 shadow-xs dark:bg-zinc-800 dark:text-emerald-300" : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              <MapPin className="w-3 h-3" />
              Locations
            </button>
          </div>

          <button
            type="button"
            onClick={onCreateNewUniverseChar}
            className="bg-amber-500 hover:bg-amber-400 text-zinc-950 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Global Entity</span>
          </button>
        </div>
      </div>

      {/* Universe Character Cards Grid */}
      {filteredCharacters.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-zinc-300 dark:border-zinc-800 rounded-2xl bg-zinc-50/60 dark:bg-zinc-900/30">
          <div className="w-16 h-16 bg-zinc-200/70 dark:bg-zinc-800/60 rounded-full flex items-center justify-center mb-4 text-amber-500 dark:text-amber-400">
            <Globe className="w-8 h-8 opacity-70" />
          </div>
          <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-200 mb-2">No Universe Entities Found</h3>
          <p className="text-zinc-600 dark:text-zinc-400 text-xs max-w-md mb-6 leading-relaxed">
            The Universe Cast stores characters, actors, and locations globally across all scenes. Add entities to the universe roster to reuse them anytime.
          </p>
          <button
            type="button"
            onClick={onCreateNewUniverseChar}
            className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold px-4 py-2 rounded-lg text-xs transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Create First Universe Character
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredCharacters.map(char => {
            const subject = char.name;
            const isLoc = !!char.is_location;
            const isAlreadyInScene = sceneCharacterNames.map(s => s.toLowerCase()).includes(subject.toLowerCase());

            // Get relevant assets across loaded assets
            const charAssets = assets.filter(a => (a.subject_name || "").trim().toLowerCase() === subject.trim().toLowerCase());

            const profilePic = isLoc
              ? (charAssets.find(a => a.type === "Scene Reference") ||
                 charAssets.find(a => a.type === "Body Reference") ||
                 charAssets.find(a => a.media_type === "image"))
              : (charAssets.find(a => a.type === "Headshot") ||
                 charAssets.find(a => a.type === "Body Reference") ||
                 charAssets.find(a => a.media_type === "image"));

            return (
              <div 
                key={char.id || char.name}
                className="bg-white dark:bg-zinc-900/60 border border-amber-200 dark:border-amber-900/30 hover:border-amber-400 dark:hover:border-amber-500/40 rounded-2xl overflow-hidden flex flex-col md:flex-row shadow-sm dark:shadow-xl transition-all"
              >
                {/* Profile Card Left Panel */}
                <div className="w-full md:w-80 lg:w-88 bg-zinc-50/80 dark:bg-zinc-900/90 p-6 border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800 flex flex-col shrink-0">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-14 h-14 rounded-full bg-zinc-100 dark:bg-zinc-950 border-2 overflow-hidden shrink-0 flex items-center justify-center ${
                        isLoc ? "border-emerald-500/50 text-emerald-600 dark:text-emerald-400" : "border-amber-500/50 text-amber-600 dark:text-amber-400"
                      }`}>
                        {profilePic ? (
                          <img 
                            src={getAssetMediaUrl(profilePic.filename, true)} 
                            className="w-full h-full object-cover" 
                            alt={subject} 
                            referrerPolicy="no-referrer" 
                          />
                        ) : isLoc ? (
                          <MapPin className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <span className="text-lg font-bold text-amber-600 dark:text-amber-300">{subject.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 line-clamp-1" title={subject}>{subject}</h3>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 border border-amber-300 text-amber-800 dark:bg-amber-950/80 dark:border-amber-600/50 dark:text-amber-300 flex items-center gap-1">
                            <Globe className="w-2.5 h-2.5" />
                            Universe
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                            isLoc ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800/50" : "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800/50"
                          }`}>
                            {isLoc ? "Location" : "Character"}
                          </span>
                          <span className="text-[11px] text-zinc-500">
                            {charAssets.length} reference{charAssets.length === 1 ? "" : "s"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onImportToScene(char)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0 shadow-xs cursor-pointer ${
                          isAlreadyInScene
                            ? "bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 dark:border-zinc-700"
                            : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20"
                        }`}
                        title={isAlreadyInScene ? "Update / re-link with scene cast" : `Import ${subject} into active scene "${activeSceneName}"`}
                      >
                        <ArrowDownToLine className="w-3.5 h-3.5" />
                        <span>{isAlreadyInScene ? "In Scene" : "Import to Scene"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCharacterToDelete(subject)}
                        className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:text-zinc-500 dark:hover:text-red-400 dark:hover:bg-red-950/40 rounded-lg transition-colors shrink-0 cursor-pointer"
                        title={`Delete ${subject} from Universe`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Notes & Default Outfit */}
                  <div className="flex-1 space-y-3">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400 tracking-wider mb-1 flex items-center justify-between">
                        <span>Canonical Profile Notes</span>
                        <Settings className="w-3 h-3 text-zinc-400 dark:text-zinc-500" />
                      </label>
                      <textarea
                        value={char.notes || ""}
                        onChange={(e) => onUpdateUniverseChar({ ...char, notes: e.target.value })}
                        placeholder={isLoc ? "Architectural features, lighting, default atmosphere..." : "Canonical physical traits, back-story, default demeanor..."}
                        className="w-full bg-white dark:bg-zinc-950/80 border border-zinc-300 dark:border-zinc-800 rounded-lg p-2 text-xs text-zinc-900 dark:text-zinc-300 placeholder-zinc-400 dark:placeholder-zinc-600 resize-none outline-none focus:border-amber-500 min-h-[60px]"
                      />
                    </div>

                    {!isLoc && (
                      <div>
                        <label className="text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400 tracking-wider mb-1 block">
                          Canonical Default Outfit
                        </label>
                        <input
                          type="text"
                          value={char.default_outfit_ref || char.scene_outfit_ref || ""}
                          onChange={(e) => onUpdateUniverseChar({ 
                            ...char, 
                            default_outfit_ref: e.target.value,
                            scene_outfit_ref: e.target.value 
                          })}
                          placeholder="e.g. Signature leather jacket, aviator sunglasses"
                          className="w-full bg-white dark:bg-zinc-950/80 border border-zinc-300 dark:border-zinc-800 rounded-lg p-2 text-xs text-zinc-900 dark:text-zinc-300 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none focus:border-amber-500"
                        />
                      </div>
                    )}
                  </div>

                  {/* Action Bar */}
                  <div className="flex items-center gap-2 pt-4 mt-4 border-t border-zinc-200 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() => onOpenBulkUpload(subject, isLoc)}
                      className="flex-1 bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 dark:border-zinc-700 px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                      <span>Add Ref</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenAssetStudio(subject, isLoc)}
                      className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/70 dark:hover:bg-indigo-900/80 dark:text-indigo-300 dark:border-indigo-800/60 px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                      <span>Generate</span>
                    </button>
                  </div>
                </div>

                {/* Reference Assets Gallery Right Panel */}
                <div className="p-4 md:p-6 flex-1 bg-zinc-50/50 dark:bg-zinc-950/30 overflow-x-auto min-w-0">
                  <div className="flex items-start gap-4 min-w-max pb-2">
                    {charAssets.length === 0 ? (
                      <div className="flex items-center gap-3">
                        {[1, 2, 3].map(i => (
                          <div 
                            key={`placeholder-${i}`} 
                            className="w-32 h-40 border-2 border-dashed border-zinc-300/80 dark:border-zinc-800/40 rounded-xl bg-zinc-100/50 dark:bg-zinc-900/20 shrink-0 flex flex-col items-center justify-center p-3 text-center"
                          >
                            <span className="text-[11px] text-zinc-400 dark:text-zinc-600 font-medium">Slot {i}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      charAssets.map(asset => (
                        <div 
                          key={asset.filename || asset.id}
                          onClick={() => onOpenLightbox(asset)}
                          className="w-32 shrink-0 group cursor-pointer"
                        >
                          <div className="w-32 h-40 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden mb-2 relative hover:border-amber-400 dark:hover:border-amber-500/50 transition-colors shadow-xs">
                            {asset.media_type === "image" || !asset.media_type || !/\.(mp4|mov|webm|mp3|wav)$/i.test(asset.filename) ? (
                              <img 
                                src={getAssetMediaUrl(asset.filename, true)} 
                                className="w-full h-full object-cover group-hover:opacity-85 transition-opacity" 
                                alt={asset.filename} 
                                referrerPolicy="no-referrer" 
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-950 text-xs text-zinc-600 font-mono p-2 text-center break-all">
                                {asset.filename.split('.').pop()?.toUpperCase()}
                              </div>
                            )}

                            {/* Quick Action Overlay */}
                            <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenEditAsset(asset);
                                }}
                                className="p-1.5 bg-black/70 hover:bg-black text-white rounded backdrop-blur shadow transition-colors cursor-pointer"
                                title="Edit Asset Metadata"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {asset.type && (
                              <div className="absolute bottom-0 inset-x-0 bg-black/70 dark:bg-black/80 backdrop-blur-sm p-1.5 pointer-events-none">
                                <p className="text-[9px] font-bold text-zinc-100 dark:text-zinc-300 truncate text-center">{asset.type}</p>
                              </div>
                            )}
                          </div>
                          {asset.description && (
                            <p className="text-[10px] text-zinc-600 dark:text-zinc-500 line-clamp-2 leading-relaxed" title={asset.description}>{asset.description}</p>
                          )}
                        </div>
                      ))
                    )}

                    <div 
                      onClick={() => onOpenBulkUpload(subject, isLoc)}
                      className="w-32 h-40 border-2 border-dashed border-zinc-300 hover:border-amber-500 hover:bg-amber-50/50 text-zinc-500 hover:text-amber-700 dark:border-zinc-800 dark:hover:border-amber-500/50 dark:hover:bg-zinc-900/50 dark:text-zinc-600 dark:hover:text-amber-400 rounded-xl flex flex-col items-center justify-center transition-colors cursor-pointer shrink-0"
                    >
                      <ChevronRight className="w-6 h-6 mb-1" />
                      <span className="text-[10px] font-bold">Add Ref</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {characterToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-2">Remove from Universe Roster?</h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed">
              Are you sure you want to delete <span className="text-amber-600 dark:text-amber-300 font-semibold">"{characterToDelete}"</span> from the global universe roster? This will not delete scene copies already active in specific projects.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setCharacterToDelete(null)}
                className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteUniverseChar(characterToDelete);
                  setCharacterToDelete(null);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Delete from Universe
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
