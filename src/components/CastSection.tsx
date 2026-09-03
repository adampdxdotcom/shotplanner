import React, { useState } from "react";
import { MediaAsset, CharacterProfile, SceneProjectFile } from "../types";
import { ChevronRight, Settings, Trash2, AlertTriangle, X, Users, Plus, Sparkles, MapPin, User, Pencil } from "lucide-react";
import { getAssetMediaUrl } from "../utils/assetUrl";
import { toCanonicalSubjectName } from "../utils/subjectUtils";
import { isLocationEntity } from "../utils/locationUtils";
import { GalleryBulkUploadModal } from "./gallery/GalleryBulkUploadModal";
import { AssetLightbox } from "./AssetLightbox";
import { AssetEditModal } from "./AssetEditModal";
import { AiReferenceStagingStudioModal } from "./cast/AiReferenceStagingStudioModal";

interface CastSectionProps {
  assets: MediaAsset[];
  subjects: string[];
  characters: Record<string, CharacterProfile>;
  sceneProject: SceneProjectFile;
  activeSceneName: string;
  onUpdateCharacter: (profile: CharacterProfile) => void;
  onDeleteCharacter: (name: string) => void;
  onRegisterSubject: (subject: string) => void;
  onAssetUploaded: (asset: MediaAsset) => void;
  onAssetDeleted: (filename: string) => void;
  onAssetUpdated: (oldFilename: string, newAsset: MediaAsset) => void;
  onUpdateProject: React.Dispatch<React.SetStateAction<SceneProjectFile>>;
  addToast: (msg: string, type?: "success" | "error" | "info") => void;
}

export const CastSection: React.FC<CastSectionProps> = ({
  assets,
  subjects,
  characters,
  sceneProject,
  activeSceneName,
  onUpdateCharacter,
  onDeleteCharacter,
  onRegisterSubject,
  onAssetUploaded,
  onAssetDeleted,
  onAssetUpdated,
  onUpdateProject,
  addToast
}) => {
  const [characterToDelete, setCharacterToDelete] = useState<string | null>(null);
  const [headshotModalSubject, setHeadshotModalSubject] = useState<string | null>(null);
  const [studioInitialTab, setStudioInitialTab] = useState<"headshots" | "staging">("headshots");
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkModalSubject, setBulkModalSubject] = useState<string | undefined>();
  const [bulkModalIsLocation, setBulkModalIsLocation] = useState<boolean | undefined>();
  const [lightboxAsset, setLightboxAsset] = useState<MediaAsset | null>(null);
  const [isNewCharacterModalOpen, setIsNewCharacterModalOpen] = useState(false);
  const [newCharacterName, setNewCharacterName] = useState("");
  const [newEntityType, setNewEntityType] = useState<"character" | "location">("character");
  const [editingAsset, setEditingAsset] = useState<MediaAsset | null>(null);

  const handleDeleteAsset = async (asset: MediaAsset) => {
    const displayName = asset.original_name || asset.subject_name || asset.filename;
    if (!window.confirm(`Are you sure you want to permanently delete "${displayName}"? This will unlink it from this character and remove it from the project gallery.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/assets/${encodeURIComponent(asset.filename)}?scene_name=${encodeURIComponent(activeSceneName)}`, {
        method: "DELETE"
      });
      if (res.ok) {
        onAssetDeleted(asset.filename);
        if (lightboxAsset?.filename === asset.filename) {
          setLightboxAsset(null);
        }
        if (editingAsset?.filename === asset.filename) {
          setEditingAsset(null);
        }
        addToast(`Deleted asset "${displayName}"`, "success");
      } else {
        const data = await res.json().catch(() => ({}));
        addToast(data.error || "Failed to delete asset", "error");
      }
    } catch (err: any) {
      console.error("Failed to delete asset:", err);
      addToast("Error deleting asset: " + (err.message || "Network error"), "error");
    }
  };

  const handleAssetUpdated = (oldFilename: string, newAsset: MediaAsset) => {
    onAssetUpdated(oldFilename, newAsset);
    if (lightboxAsset?.filename === oldFilename) {
      setLightboxAsset(newAsset);
    }
    addToast(`Updated asset metadata for "${newAsset.subject_name || newAsset.filename}"`, "success");
  };

  const handleCreateNewCharacter = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCharacterName.trim();
    if (trimmed) {
      onRegisterSubject(trimmed);
      if (newEntityType === "location") {
        onUpdateCharacter?.({
          name: trimmed,
          notes: "",
          quick_slots: [],
          scene_outfit_ref: "",
          is_location: true
        });
      }
      setNewCharacterName("");
      setNewEntityType("character");
      setIsNewCharacterModalOpen(false);
    }
  };

  // Derive strictly deduplicated canonical list of subjects
  const deduplicatedSubjectsMap = new Map<string, string>();
  [
    ...(subjects || []),
    ...Object.keys(characters || {}),
    ...(assets || []).map(a => a.subject_name)
  ].forEach(raw => {
    if (!raw) return;
    const canonical = toCanonicalSubjectName(raw);
    if (!canonical) return;
    const lower = canonical.toLowerCase();
    if (!deduplicatedSubjectsMap.has(lower)) {
      deduplicatedSubjectsMap.set(lower, canonical);
    }
  });
  const renderedSubjects = Array.from(deduplicatedSubjectsMap.values());

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Header */}
      <div className="bg-zinc-900 border-b border-zinc-800 p-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-900/50 rounded-xl flex items-center justify-center border border-indigo-800/50 shrink-0">
              <Users className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2 flex-wrap">
                Cast & Characters
                <span className="text-xs font-medium text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
                  {renderedSubjects.length} subjects
                </span>
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5 truncate">Manage reference identities and consistent appearances</p>
            </div>
          </div>
          <button
            onClick={() => setIsNewCharacterModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md shadow-indigo-900/20 transition-all flex items-center gap-2 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Register Character
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {renderedSubjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-zinc-800 rounded-xl bg-zinc-900/30">
              <div className="w-16 h-16 bg-zinc-800/50 rounded-full flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-zinc-600" />
              </div>
              <h3 className="text-lg font-bold text-zinc-300 mb-2">No characters registered</h3>
              <p className="text-zinc-500 max-w-md mb-6">
                Register characters to manage their reference assets, persistent traits, and scene outfits.
              </p>
              <button
                onClick={() => setIsNewCharacterModalOpen(true)}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add First Character
              </button>
            </div>
          ) : (
            renderedSubjects.map(subject => {
              const charAssets = assets.filter(a => (a.subject_name || "").trim().toLowerCase() === subject.trim().toLowerCase());
              
              const profile = characters[subject] || 
                Object.entries(characters || {}).find(([k]) => k.toLowerCase() === subject.toLowerCase())?.[1] || 
                { name: subject, notes: "", quick_slots: [], scene_outfit_ref: "" };
              
              const isLoc = isLocationEntity(subject, profile, charAssets);

              const profilePic = isLoc
                ? (charAssets.find(a => a.type === "Scene Reference") ||
                   charAssets.find(a => a.type === "Body Reference") ||
                   charAssets.find(a => a.media_type === "image"))
                : (charAssets.find(a => a.type === "Headshot") ||
                   charAssets.find(a => a.type === "Body Reference") ||
                   charAssets.find(a => a.media_type === "image"));
                                 
              return (
                <div key={subject} className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl overflow-hidden flex flex-col md:flex-row shadow-lg">
                  <div className="w-full md:w-72 lg:w-80 bg-zinc-900 p-6 border-b md:border-b-0 md:border-r border-zinc-800 flex flex-col shrink-0">
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-14 h-14 rounded-full bg-zinc-950 border-2 overflow-hidden shrink-0 flex items-center justify-center ${
                          isLoc ? "border-emerald-500/40 text-emerald-400" : "border-zinc-800 text-zinc-600"
                        }`}>
                          {profilePic ? (
                            <img src={getAssetMediaUrl(profilePic.filename, true)} className="w-full h-full object-cover" alt={subject} referrerPolicy="no-referrer" />
                          ) : isLoc ? (
                            <MapPin className="w-6 h-6 text-emerald-400" />
                          ) : (
                            <span className="text-lg font-bold text-zinc-600">{subject.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-zinc-100 line-clamp-1" title={subject}>{subject}</h3>
                            <button
                              type="button"
                              onClick={() => onUpdateCharacter?.({ ...profile, is_location: !isLoc })}
                              title={isLoc ? "Classified as Location. Click to toggle to Character." : "Classified as Character. Click to toggle to Location."}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 transition-colors border ${
                                isLoc
                                  ? "bg-emerald-950/70 border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/80"
                                  : "bg-indigo-950/70 border-indigo-700/60 text-indigo-300 hover:bg-indigo-900/80"
                              }`}
                            >
                              {isLoc ? (
                                <>
                                  <MapPin className="w-2.5 h-2.5 text-emerald-400" />
                                  Location
                                </>
                              ) : (
                                <>
                                  <User className="w-2.5 h-2.5 text-indigo-400" />
                                  Character
                                </>
                              )}
                            </button>
                          </div>
                          <p className={`text-xs font-medium ${isLoc ? "text-emerald-400" : "text-amber-500"}`}>
                            {charAssets.length} reference{charAssets.length === 1 ? "" : "s"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setStudioInitialTab(isLoc ? "staging" : "headshots");
                            setHeadshotModalSubject(subject);
                          }}
                          className="bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-800/60 px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer shadow-sm"
                          title={isLoc ? "Generate AI Location Reference & Scene Staging" : "Generate AI Assets, Headshots & Scene Staging"}
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                          <span>Asset Generation</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setCharacterToDelete(subject)}
                          className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition-colors shrink-0"
                          title={`Delete ${subject} profile`}
                          aria-label={`Delete ${subject} profile`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex-1 space-y-4">
                      <div>
                        <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1.5 flex items-center justify-between">
                          {isLoc ? "Location Details & Notes" : "Notes"}
                          <Settings className="w-3 h-3 text-zinc-600" />
                        </label>
                        <textarea
                          value={profile.notes || ""}
                          onChange={e => onUpdateCharacter?.({ ...profile, notes: e.target.value })}
                          placeholder={isLoc ? "Architectural features, lighting, atmosphere, time of day..." : "Physical traits, lore, etc..."}
                          className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg p-2 text-xs text-zinc-300 resize-none outline-none focus:border-amber-500/50 min-h-[60px]"
                        />
                      </div>
                      {/* Strictly hide character-specific Scene Outfit when managing location entities */}
                      {!isLoc && (
                        <div>
                          <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1.5 block">Scene Outfit</label>
                          <input
                            type="text"
                            value={profile.scene_outfit_ref || ""}
                            onChange={e => onUpdateCharacter?.({ ...profile, scene_outfit_ref: e.target.value })}
                            placeholder="e.g. Red leather jacket, torn jeans"
                            className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg p-2 text-xs text-zinc-300 outline-none focus:border-amber-500/50"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-4 md:p-6 flex-1 bg-zinc-950/20 overflow-x-auto min-w-0">
                    <div className="flex items-start gap-4 min-w-max pb-2">
                      {charAssets.length === 0 && (
                        <>
                          {[1, 2, 3].map(i => (
                            <div 
                              key={`placeholder-${i}`} 
                              className="w-32 h-40 border-2 border-dashed border-zinc-800/30 rounded-xl bg-zinc-900/10 shrink-0"
                            />
                          ))}
                        </>
                      )}
                      
                      {charAssets.map(asset => (
                        <div 
                          key={asset.filename || asset.id}
                          onClick={() => setLightboxAsset(asset)}
                          className="w-32 shrink-0 group cursor-pointer"
                        >
                          <div className="w-32 h-40 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden mb-2 relative hover:border-amber-500/50 transition-colors">
                            {asset.media_type === "image" || !asset.media_type || !/\.(mp4|mov|webm|mp3|wav)$/i.test(asset.filename) ? (
                              <img 
                                src={getAssetMediaUrl(asset.filename, true)} 
                                className="w-full h-full object-cover group-hover:opacity-75 transition-opacity" 
                                alt={asset.filename} 
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-zinc-950 text-xs text-zinc-600 font-mono p-2 text-center break-all">
                                {asset.filename.split('.').pop()?.toUpperCase()}
                              </div>
                            )}

                            {/* Quick Action Overlay: Edit Pencil & Delete Trash Can */}
                            <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingAsset(asset);
                                }}
                                className="p-1.5 bg-black/60 hover:bg-black text-white rounded backdrop-blur shadow transition-colors cursor-pointer"
                                title="Edit Asset Metadata"
                                aria-label="Edit Asset Metadata"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteAsset(asset);
                                }}
                                className="p-1.5 bg-black/60 hover:bg-red-500 text-white rounded backdrop-blur shadow transition-colors cursor-pointer"
                                title="Delete Asset"
                                aria-label="Delete Asset"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {asset.type && (
                              <div className="absolute bottom-0 inset-x-0 bg-black/80 backdrop-blur-sm p-1.5 pointer-events-none">
                                <p className="text-[9px] font-bold text-zinc-300 truncate text-center">{asset.type}</p>
                              </div>
                            )}
                          </div>
                          {asset.description && (
                            <p className="text-[10px] text-zinc-500 line-clamp-2 leading-relaxed" title={asset.description}>{asset.description}</p>
                          )}
                        </div>
                      ))}
                      
                      <div 
                        onClick={() => {
                          setBulkModalSubject(subject);
                          setBulkModalIsLocation(isLoc);
                          setIsBulkModalOpen(true);
                        }}
                        className="w-32 h-40 border-2 border-dashed border-zinc-800 rounded-xl flex flex-col items-center justify-center text-zinc-600 hover:text-amber-400 hover:border-amber-500/50 hover:bg-zinc-900/50 transition-colors cursor-pointer shrink-0"
                      >
                        <ChevronRight className="w-6 h-6 mb-1" />
                        <span className="text-[10px] font-bold">Add Ref</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {isNewCharacterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-950/60 border border-indigo-900/60 flex items-center justify-center text-indigo-400 shrink-0">
                  <Users className="w-6 h-6" />
                </div>
                <button 
                  onClick={() => setIsNewCharacterModalOpen(false)}
                  className="text-zinc-400 hover:text-zinc-200 transition-colors p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <h3 className="text-lg font-bold text-zinc-100 mb-2">
                {newEntityType === "location" ? "Register New Location" : "Register New Character"}
              </h3>
              <p className="text-sm text-zinc-400 mb-4">
                {newEntityType === "location"
                  ? "Create a new location profile to organize scene references and environment context."
                  : "Create a new character profile to organize their reference assets and scene context."}
              </p>

              {/* Entity Type Toggle */}
              <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-800 rounded-lg p-1 mb-5">
                <button
                  type="button"
                  onClick={() => setNewEntityType("character")}
                  className={`flex-1 py-1.5 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    newEntityType === "character"
                      ? "bg-indigo-950 text-indigo-300 border border-indigo-700/60 shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  Character
                </button>
                <button
                  type="button"
                  onClick={() => setNewEntityType("location")}
                  className={`flex-1 py-1.5 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    newEntityType === "location"
                      ? "bg-emerald-950 text-emerald-300 border border-emerald-700/60 shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  Location
                </button>
              </div>
              
              <form onSubmit={handleCreateNewCharacter}>
                <div className="mb-6">
                  <label htmlFor="charName" className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2">
                    {newEntityType === "location" ? "Location Name" : "Character Name"}
                  </label>
                  <input
                    id="charName"
                    type="text"
                    value={newCharacterName}
                    onChange={e => setNewCharacterName(e.target.value)}
                    placeholder={newEntityType === "location" ? "e.g. Living Room, Rooftop Bar" : "e.g. John Doe, Cyberpunk Agent"}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-200 outline-none focus:border-indigo-500/50"
                    autoFocus
                  />
                </div>
                
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsNewCharacterModalOpen(false)}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-semibold rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newCharacterName.trim()}
                    className={`flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-lg transition-colors shadow-lg disabled:opacity-50 ${
                      newEntityType === "location"
                        ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/50 disabled:hover:bg-emerald-600"
                        : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-950/50 disabled:hover:bg-indigo-600"
                    }`}
                  >
                    Register
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {characterToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-red-950/60 border border-red-900/60 flex items-center justify-center text-red-400 shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <button 
                  onClick={() => setCharacterToDelete(null)}
                  className="text-zinc-400 hover:text-zinc-200 transition-colors p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <h3 className="text-lg font-bold text-zinc-100 mb-2">
                {isLocationEntity(characterToDelete, characters?.[characterToDelete], assets)
                  ? "Delete Location Profile"
                  : "Delete Character Profile"}
              </h3>
              <p className="text-sm text-zinc-300 mb-3">
                Are you sure you want to delete <span className="font-semibold text-amber-400">{characterToDelete}</span>?
              </p>
              
              <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3.5 text-xs text-zinc-400 space-y-2 mb-6">
                <p>
                  • Deletes the {isLocationEntity(characterToDelete, characters?.[characterToDelete], assets) ? "location" : "character"} profile and removes it from project subjects.
                </p>
                <p>
                  • De-assigns this reference image from all shot input slots and scene framing.
                </p>
                <p className="text-emerald-400 font-medium">
                  ✓ All original media files remain safe and accessible in your gallery.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCharacterToDelete(null)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (characterToDelete) {
                      onDeleteCharacter(characterToDelete);
                      setCharacterToDelete(null);
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-lg shadow-red-950/50"
                >
                  <Trash2 className="w-4 h-4" />
                  {isLocationEntity(characterToDelete, characters?.[characterToDelete], assets)
                    ? "Delete Location"
                    : "Delete Character"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <GalleryBulkUploadModal
        isOpen={isBulkModalOpen}
        onClose={() => {
          setIsBulkModalOpen(false);
          setBulkModalSubject(undefined);
          setBulkModalIsLocation(undefined);
        }}
        subjects={subjects}
        defaultSubject={bulkModalSubject}
        isLocation={bulkModalIsLocation}
        characters={characters}
        assets={assets}
        sceneName={activeSceneName}
        onAssetUploaded={onAssetUploaded}
        onRegisterSubject={onRegisterSubject}
      />

      <AssetEditModal
        asset={editingAsset}
        subjects={renderedSubjects}
        characters={characters}
        onRegisterSubject={onRegisterSubject}
        onClose={() => setEditingAsset(null)}
        onAssetUpdated={handleAssetUpdated}
      />

      <AssetLightbox
        asset={lightboxAsset}
        onClose={() => setLightboxAsset(null)}
        onDelete={handleDeleteAsset}
      />

      <AiReferenceStagingStudioModal
        isOpen={!!headshotModalSubject}
        onClose={() => setHeadshotModalSubject(null)}
        initialTab={studioInitialTab}
        subjectName={headshotModalSubject || ""}
        characterAssets={headshotModalSubject ? assets.filter(a => (a.subject_name || "").toLowerCase() === headshotModalSubject.toLowerCase()) : []}
        activeSceneName={activeSceneName}
        onAssetSaved={onAssetUploaded}
        addToast={addToast}
        characters={characters}
        subjects={subjects}
        allAssets={assets}
        sceneProject={sceneProject}
        onUpdateProject={onUpdateProject}
      />
    </div>
  );
};
