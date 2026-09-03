import React, { useState, useMemo } from "react";
import { MediaAsset, CharacterProfile } from "../types";
import { 
  Search, Filter, Plus, Grid, List, Users, Film
} from "lucide-react";
import { RendersView } from "./RendersView";
import { AssetEditModal } from "./AssetEditModal";
import { AssetLightbox } from "./AssetLightbox";
import { GalleryBulkUploadModal } from "./gallery/GalleryBulkUploadModal";
import { GalleryGridView } from "./gallery/GalleryGridView";
import { GalleryListView } from "./gallery/GalleryListView";

interface GallerySectionProps {
  assets: MediaAsset[];
  subjects: string[];
  characters?: Record<string, CharacterProfile>;
  sceneName?: string;
  sceneProject?: any; // or SceneProjectFile
  onUpdateProject?: React.Dispatch<React.SetStateAction<any>>;
  onUpdateCharacter?: (profile: CharacterProfile) => void;
  onDeleteCharacter?: (name: string) => void;
  onRegisterSubject: (name: string) => void;
  onAssetUploaded: (asset: MediaAsset) => void;
  onAssetDeleted: (filename: string) => void;
  onAssetUpdated: (oldFilename: string, newAsset: MediaAsset) => void;
}

export const GallerySection: React.FC<GallerySectionProps> = ({
  assets,
  subjects,
  characters = {},
  sceneName = "scene01",
  sceneProject,
  onUpdateProject,
  onUpdateCharacter,
  onDeleteCharacter,
  onRegisterSubject,
  onAssetUploaded,
  onAssetDeleted,
  onAssetUpdated
}) => {
  // Navigation & Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [mediaTypeFilter, setMediaTypeFilter] = useState<"all" | "image" | "audio" | "video">("all");
  const [viewMode, setViewMode] = useState<"grid" | "list" | "cast" | "renders">("grid");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "name" | "size">("newest");

  // Modals & Active Controls
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkModalSubject, setBulkModalSubject] = useState<string | undefined>(undefined);
  const [editingAsset, setEditingAsset] = useState<MediaAsset | null>(null);
  const [lightboxAsset, setLightboxAsset] = useState<MediaAsset | null>(null);

  // Audio Player State
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  const toggleAudio = (e: React.MouseEvent, url: string) => {
    e.stopPropagation();
    if (playingAudioUrl === url && audioElement) {
      if (audioElement.paused) {
        audioElement.play();
      } else {
        audioElement.pause();
      }
    } else {
      if (audioElement) audioElement.pause();
      const newAudio = new Audio(url);
      newAudio.onended = () => setPlayingAudioUrl(null);
      newAudio.play();
      setAudioElement(newAudio);
      setPlayingAudioUrl(url);
    }
  };

  const handleDeleteAsset = async (asset: MediaAsset) => {
    if (confirm(`Are you sure you want to delete ${asset.original_name}?`)) {
      try {
        await fetch(`/api/assets/${asset.filename}`, { method: "DELETE" });
        onAssetDeleted(asset.filename);
        if (lightboxAsset?.filename === asset.filename) setLightboxAsset(null);
      } catch (e) {
        console.error("Failed to delete", e);
        alert("Failed to delete asset");
      }
    }
  };

  const filteredAssets = useMemo(() => {
    return assets.filter(a => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!a.subject_name?.toLowerCase().includes(q) && 
            !a.original_name?.toLowerCase().includes(q) && 
            !a.description?.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (mediaTypeFilter !== "all") {
        const isAudio = /\.(mp3|wav|ogg|m4a|flac)$/i.test(a.filename);
        const isVideo = /\.(mp4|mov|webm|mkv)$/i.test(a.filename);
        if (mediaTypeFilter === "audio" && !isAudio) return false;
        if (mediaTypeFilter === "video" && !isVideo) return false;
        if (mediaTypeFilter === "image" && (isAudio || isVideo)) return false;
      }
      return true;
    });
  }, [assets, searchQuery, mediaTypeFilter]);

  const sortedAssets = useMemo(() => {
    return [...filteredAssets].sort((a, b) => {
      switch (sortBy) {
        case "oldest": return (a.uploaded_at || 0) - (b.uploaded_at || 0);
        case "name": return (a.subject_name || a.original_name || "").localeCompare(b.subject_name || b.original_name || "");
        case "size": return (b.size_bytes || 0) - (a.size_bytes || 0);
        case "newest":
        default:
          return (b.uploaded_at || 0) - (a.uploaded_at || 0);
      }
    });
  }, [filteredAssets, sortBy]);

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Top Controls Bar */}
      <div className="bg-zinc-900 border-b border-zinc-800 p-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-1">
            <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2 shrink-0">
              Media Gallery
              <span className="text-xs font-medium text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
                {sortedAssets.length} items
              </span>
            </h2>

            <div className="flex-1 max-w-md w-full relative">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search assets..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-lg pl-9 pr-4 py-2 text-sm text-zinc-200 outline-none transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Media Type Filter */}
            <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-lg p-1">
              {(["all", "image", "audio", "video"] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setMediaTypeFilter(type)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md capitalize transition-colors ${
                    mediaTypeFilter === type ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            {/* Sort Order */}
            <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-zinc-900 border-r border-zinc-800">
                <Filter className="w-4 h-4 text-zinc-500" />
              </div>
              <select 
                value={sortBy} 
                onChange={e => setSortBy(e.target.value as any)}
                className="bg-zinc-950 text-xs font-semibold text-zinc-300 px-3 py-2 outline-none appearance-none cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="name">Subject Name</option>
                <option value="size">File Size</option>
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-lg p-1 mr-2">
              <button 
                onClick={() => setViewMode("grid")}
                title="Grid View"
                className={`p-1.5 rounded-md transition-all ${viewMode === "grid" ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewMode("list")}
                title="List View"
                className={`p-1.5 rounded-md transition-all ${viewMode === "list" ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                <List className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewMode("renders")}
                title="Dailies / Renders"
                className={`p-1.5 rounded-md transition-all flex items-center gap-1 ${viewMode === "renders" ? "bg-indigo-600 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                <Film className="w-4 h-4" />
              </button>
            </div>

            {/* Bulk Upload Button */}
            <button
              onClick={() => {
                setBulkModalSubject(undefined);
                setIsBulkModalOpen(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md shadow-indigo-900/20 transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Media
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {sortedAssets.length === 0 && viewMode !== "renders" ? (
            <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-zinc-800 rounded-xl bg-zinc-900/30">
              <div className="w-16 h-16 bg-zinc-800/50 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-zinc-600" />
              </div>
              <h3 className="text-lg font-bold text-zinc-300 mb-2">No assets found</h3>
              <p className="text-zinc-500 max-w-md">
                {assets.length === 0 
                  ? "Your gallery is empty. Upload some images, audio, or video files to get started."
                  : "No assets match your current search and filter criteria."}
              </p>
              {assets.length > 0 && (
                <button 
                  onClick={() => { setSearchQuery(""); setMediaTypeFilter("all"); }}
                  className="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-semibold rounded-lg transition-colors"
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : viewMode === "grid" ? (
            <GalleryGridView
              assets={sortedAssets}
              playingAudioUrl={playingAudioUrl}
              toggleAudio={toggleAudio}
              setLightboxAsset={setLightboxAsset}
              setEditingAsset={setEditingAsset}
              handleDeleteAsset={handleDeleteAsset}
            />
          ) : viewMode === "list" ? (
            <GalleryListView
              assets={sortedAssets}
              playingAudioUrl={playingAudioUrl}
              toggleAudio={toggleAudio}
              setLightboxAsset={setLightboxAsset}
              setEditingAsset={setEditingAsset}
              handleDeleteAsset={handleDeleteAsset}
            />
          ) : viewMode === "renders" ? (
            <RendersView sceneProject={sceneProject} sceneName={sceneName} onUpdateProject={onUpdateProject as any} />
          ) : null}
        </div>
      </div>

      <GalleryBulkUploadModal
        isOpen={isBulkModalOpen}
        onClose={() => {
          setIsBulkModalOpen(false);
          setBulkModalSubject(undefined);
        }}
        subjects={subjects}
        defaultSubject={bulkModalSubject}
        characters={characters}
        assets={assets}
        sceneName={sceneName}
        onAssetUploaded={onAssetUploaded}
        onRegisterSubject={onRegisterSubject}
      />

      <AssetEditModal
        subjects={subjects}
        characters={characters}
        onRegisterSubject={onRegisterSubject}
        onAssetUpdated={onAssetUpdated}
        asset={editingAsset}
        onClose={() => setEditingAsset(null)}
      />

      <AssetLightbox
        asset={lightboxAsset}
        onClose={() => setLightboxAsset(null)}
        onDelete={handleDeleteAsset}
      />
    </div>
  );
};
