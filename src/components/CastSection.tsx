import React, { useState } from "react";
import { AppConfig, MediaAsset, CharacterProfile, SceneProjectFile } from "../types";
import { Users, Plus, Globe, Clapperboard } from "lucide-react";
import { toCanonicalSubjectName } from "../utils/subjectUtils";
import { isLocationEntity } from "../utils/locationUtils";
import { GalleryBulkUploadModal } from "./gallery/GalleryBulkUploadModal";
import { AssetLightbox } from "./AssetLightbox";
import { AssetEditModal } from "./AssetEditModal";
import { AiReferenceStagingStudioModal } from "./cast/AiReferenceStagingStudioModal";
import { UniverseCastView } from "./cast/UniverseCastView";
import { CreateUniverseCharacterModal } from "./cast/CreateUniverseCharacterModal";
import { CharacterSyncModal } from "./cast/CharacterSyncModal";
import { SceneCastList } from "./cast/SceneCastList";
import { RegisterCharacterModal } from "./cast/RegisterCharacterModal";
import { DeleteCharacterModal } from "./cast/DeleteCharacterModal";
import { useUniverseSync } from "./cast/useUniverseSync";
import { assetsApi } from "../api";

interface CastSectionProps {
  assets: MediaAsset[];
  subjects: string[];
  characters: Record<string, CharacterProfile>;
  sceneProject: SceneProjectFile;
  activeSceneName: string;
  config?: AppConfig;
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
  config,
  onUpdateCharacter,
  onDeleteCharacter,
  onRegisterSubject,
  onAssetUploaded,
  onAssetDeleted,
  onAssetUpdated,
  onUpdateProject,
  addToast
}) => {
  const [activeRosterTab, setActiveRosterTab] = useState<"scene" | "universe">("scene");

  // Universe state & synchronization logic
  const {
    universeCharacters,
    universeAssets,
    pushingToUniverse,
    handlePushToUniverse,
    handleImportUniverseCharToScene,
    handleCreateUniverseCharacter,
    handleUpdateUniverseChar,
    handleDeleteUniverseChar
  } = useUniverseSync({
    activeSceneName,
    assets,
    onRegisterSubject,
    onUpdateCharacter,
    onAssetUploaded,
    addToast
  });

  // Modal & interactive selection states
  const [characterToDelete, setCharacterToDelete] = useState<string | null>(null);
  const [headshotModalSubject, setHeadshotModalSubject] = useState<string | null>(null);
  const [studioInitialTab, setStudioInitialTab] = useState<"headshots" | "staging">("headshots");
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkModalSubject, setBulkModalSubject] = useState<string | undefined>();
  const [bulkModalIsLocation, setBulkModalIsLocation] = useState<boolean | undefined>();
  const [lightboxAsset, setLightboxAsset] = useState<MediaAsset | null>(null);
  const [isNewCharacterModalOpen, setIsNewCharacterModalOpen] = useState(false);
  const [isNewUniverseModalOpen, setIsNewUniverseModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<MediaAsset | null>(null);
  const [syncDiffSubject, setSyncDiffSubject] = useState<string | null>(null);

  // Asset deletion handler
  const handleDeleteAsset = async (asset: MediaAsset) => {
    const displayName = asset.original_name || asset.subject_name || asset.filename;
    if (!window.confirm(`Are you sure you want to permanently delete "${displayName}"? This will unlink it from this character and remove it from the project gallery.`)) {
      return;
    }
    try {
      await assetsApi.delete(`${encodeURIComponent(asset.filename)}?scene_name=${encodeURIComponent(activeSceneName)}`);
      onAssetDeleted(asset.filename);
      if (lightboxAsset?.filename === asset.filename) {
        setLightboxAsset(null);
      }
      if (editingAsset?.filename === asset.filename) {
        setEditingAsset(null);
      }
      addToast(`Deleted asset "${displayName}"`, "success");
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

  const handleRegisterNewCharacter = (name: string, entityType: "character" | "location") => {
    onRegisterSubject(name);
    if (entityType === "location") {
      onUpdateCharacter?.({
        id: `loc_${Date.now()}`,
        name,
        notes: "",
        quick_slots: [],
        scene_outfit_ref: "",
        is_location: true
      });
    }
  };

  // Derive strictly deduplicated canonical list of subjects belonging to the scene
  const deduplicatedSubjectsMap = new Map<string, string>();
  [
    ...(subjects || []),
    ...Object.keys(characters || {})
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
  const universeCount = Object.keys(universeCharacters || {}).length;

  return (
    <div className="flex flex-col h-full bg-transparent">
      {/* Header Bar with Roster Switcher */}
      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-4 sticky top-0 z-10 shadow-xs dark:shadow-none">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/50 rounded-xl flex items-center justify-center border border-indigo-200 dark:border-indigo-800/50 shrink-0">
              <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 flex-wrap">
                Cast & Characters
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full border border-zinc-200 dark:border-zinc-700/60">
                  {activeRosterTab === "scene" ? `${renderedSubjects.length} scene subjects` : `${universeCount} universe entities`}
                </span>
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                {activeRosterTab === "scene"
                  ? "Manage reference identities, traits, and outfits for the current scene"
                  : "Global reference pool that persists across all projects and scenes"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Roster Switcher Toggle */}
            <div className="flex items-center bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveRosterTab("scene")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeRosterTab === "scene"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/30"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                }`}
              >
                <Clapperboard className="w-3.5 h-3.5" />
                <span>🎬 Scene Cast</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  activeRosterTab === "scene" ? "bg-indigo-700 text-indigo-100" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                }`}>
                  {renderedSubjects.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveRosterTab("universe")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeRosterTab === "universe"
                    ? "bg-amber-500 text-zinc-950 shadow-md shadow-amber-900/30 font-extrabold"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>🌐 Universe Cast</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  activeRosterTab === "universe" ? "bg-amber-600 text-zinc-950" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                }`}>
                  {universeCount}
                </span>
              </button>
            </div>

            {/* Registration Action Buttons */}
            {activeRosterTab === "scene" ? (
              <button
                type="button"
                onClick={() => setIsNewCharacterModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md shadow-indigo-900/20 transition-all flex items-center gap-2 shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Register Character
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsNewUniverseModalOpen(true)}
                className="bg-amber-500 hover:bg-amber-400 text-zinc-950 px-4 py-2 rounded-lg text-sm font-bold shadow-md shadow-amber-900/20 transition-all flex items-center gap-2 shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                New Universe Entity
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {activeRosterTab === "universe" ? (
            <UniverseCastView
              universeCharacters={universeCharacters}
              assets={[...(universeAssets || []), ...(assets || []).filter(a => a.is_universe)]}
              activeSceneName={activeSceneName}
              config={config}
              onImportToScene={handleImportUniverseCharToScene}
              onUpdateUniverseChar={handleUpdateUniverseChar}
              onDeleteUniverseChar={handleDeleteUniverseChar}
              onOpenAssetStudio={(subj, isLoc) => {
                setStudioInitialTab(isLoc ? "staging" : "headshots");
                setHeadshotModalSubject(subj);
              }}
              onOpenBulkUpload={(subj, isLoc) => {
                setBulkModalSubject(subj);
                setBulkModalIsLocation(isLoc);
                setIsBulkModalOpen(true);
              }}
              onOpenLightbox={(asset) => setLightboxAsset(asset)}
              onOpenEditAsset={(asset) => setEditingAsset(asset)}
              onCreateNewUniverseChar={() => setIsNewUniverseModalOpen(true)}
              addToast={addToast}
              sceneCharacterNames={renderedSubjects}
            />
          ) : (
            <SceneCastList
              renderedSubjects={renderedSubjects}
              characters={characters}
              assets={assets}
              universeCount={universeCount}
              universeCharacters={universeCharacters}
              pushingToUniverse={pushingToUniverse}
              onOpenNewCharacterModal={() => setIsNewCharacterModalOpen(true)}
              onSwitchToUniverseTab={() => setActiveRosterTab("universe")}
              onUpdateCharacter={onUpdateCharacter}
              onOpenSyncDiff={(subj) => setSyncDiffSubject(subj)}
              onOpenBulkUpload={(subj, isLoc) => {
                setBulkModalSubject(subj);
                setBulkModalIsLocation(isLoc);
                setIsBulkModalOpen(true);
              }}
              onOpenAssetStudio={(subj, isLoc) => {
                setStudioInitialTab(isLoc ? "staging" : "headshots");
                setHeadshotModalSubject(subj);
              }}
              onRequestDeleteCharacter={(subj) => setCharacterToDelete(subj)}
              onOpenLightbox={(asset) => setLightboxAsset(asset)}
              onOpenEditAsset={(asset) => setEditingAsset(asset)}
              onDeleteAsset={handleDeleteAsset}
            />
          )}
        </div>
      </div>

      {/* Creation & Deletion Modals */}
      <RegisterCharacterModal
        isOpen={isNewCharacterModalOpen}
        onClose={() => setIsNewCharacterModalOpen(false)}
        onRegister={handleRegisterNewCharacter}
      />

      <CreateUniverseCharacterModal
        isOpen={isNewUniverseModalOpen}
        onClose={() => setIsNewUniverseModalOpen(false)}
        onCreate={handleCreateUniverseCharacter}
      />

      <DeleteCharacterModal
        characterToDelete={characterToDelete}
        characters={characters}
        assets={assets}
        onClose={() => setCharacterToDelete(null)}
        onConfirmDelete={(subj) => {
          onDeleteCharacter(subj);
          setCharacterToDelete(null);
        }}
      />

      {/* Media Management Modals */}
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
        config={config}
        onAssetUploaded={onAssetUploaded}
        onRegisterSubject={onRegisterSubject}
      />

      <AssetEditModal
        asset={editingAsset}
        subjects={renderedSubjects}
        characters={characters}
        config={config}
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
        config={config}
        onAssetSaved={onAssetUploaded}
        addToast={addToast}
        characters={characters}
        subjects={subjects}
        allAssets={assets}
        sceneProject={sceneProject}
        onUpdateProject={onUpdateProject}
      />

      {syncDiffSubject && (
        <CharacterSyncModal
          isOpen={!!syncDiffSubject}
          onClose={() => setSyncDiffSubject(null)}
          sceneProfile={
            characters[syncDiffSubject] || {
              id: `char_${Date.now()}`,
              name: syncDiffSubject,
              notes: "",
              quick_slots: ["", "", "", ""],
              scene_outfit_ref: "",
              is_location: isLocationEntity(syncDiffSubject, characters[syncDiffSubject], assets)
            }
          }
          universeProfile={universeCharacters[syncDiffSubject]}
          assets={assets}
          universeAssets={universeAssets}
          onPushToUniverse={async (subj, prof, newAssets) => {
            await handlePushToUniverse(subj, prof, newAssets);
          }}
          onPullFromUniverse={(uChar) => {
            handleImportUniverseCharToScene(uChar);
          }}
          isPushing={!!pushingToUniverse[syncDiffSubject]}
        />
      )}
    </div>
  );
};
