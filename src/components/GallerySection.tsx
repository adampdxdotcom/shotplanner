import React, { useState, useEffect } from "react";
import { MediaAsset } from "../types";
import { getAssetMediaUrl } from "../utils/assetUrl";
import { 
  Image as ImageIcon, 
  Video as VideoIcon, 
  Music, 
  Trash2, 
  Edit3, 
  UploadCloud, 
  X, 
  Search, 
  Filter, 
  Plus, 
  Check, 
  Loader2, 
  File, 
  Play, 
  Pause,
  ChevronRight,
  Eye,
  Settings,
  Grid,
  List
} from "lucide-react";

interface GallerySectionProps {
  assets: MediaAsset[];
  subjects: string[];
  sceneName?: string;
  onRegisterSubject: (name: string) => void;
  onAssetUploaded: (asset: MediaAsset) => void;
  onAssetDeleted: (filename: string) => void;
  onAssetUpdated: (oldFilename: string, newAsset: MediaAsset) => void;
}

export const GallerySection: React.FC<GallerySectionProps> = ({
  assets,
  subjects,
  sceneName = "scene01",
  onRegisterSubject,
  onAssetUploaded,
  onAssetDeleted,
  onAssetUpdated
}) => {
  // Navigation & Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [mediaTypeFilter, setMediaTypeFilter] = useState<"all" | "image" | "audio" | "video">("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "name" | "size">("newest");

  // Modals & Active Controls
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<MediaAsset | null>(null);
  const [lightboxAsset, setLightboxAsset] = useState<MediaAsset | null>(null);

  // Edit Asset Metadata Form States
  const [editSubjectName, setEditSubjectName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editType, setEditType] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Bulk Upload Queue State
  const [bulkQueue, setBulkQueue] = useState<Array<{
    file: File;
    progress: number;
    status: "pending" | "uploading" | "success" | "error";
    error?: string;
  }>>([]);
  const [bulkSubject, setBulkSubject] = useState("");
  const [bulkDescription, setBulkDescription] = useState("");
  const [bulkAssetType, setBulkAssetType] = useState("Scene Reference");
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [bulkDragActive, setBulkDragActive] = useState(false);

  // Global window dragover state for trigger
  const [windowDragActive, setWindowDragActive] = useState(false);

  // Audio Playback Controller
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  // Handle Global Window Drag & Drop to trigger Bulk Upload
  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer?.types?.includes("Files")) {
        setWindowDragActive(true);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Only set inactive if leaving window area
      if (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
        setWindowDragActive(false);
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setWindowDragActive(false);

      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        const files = Array.from(e.dataTransfer.files);
        const newQueue = files.map(file => ({
          file,
          progress: 0,
          status: "pending" as const
        }));
        setBulkQueue(prev => [...prev, ...newQueue]);
        setIsBulkModalOpen(true);
      }
    };

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
  }, []);

  // Sync Audio state on unmount
  useEffect(() => {
    return () => {
      if (audioElement) {
        audioElement.pause();
      }
    };
  }, [audioElement]);

  const toggleAudio = (url: string) => {
    if (playingAudioUrl === url && audioElement) {
      if (audioElement.paused) {
        audioElement.play();
      } else {
        audioElement.pause();
        setPlayingAudioUrl(null);
      }
    } else {
      if (audioElement) {
        audioElement.pause();
      }
      const newAudio = new Audio(url);
      newAudio.play();
      newAudio.onended = () => setPlayingAudioUrl(null);
      setAudioElement(newAudio);
      setPlayingAudioUrl(url);
    }
  };

  // Filtering & Sorting
  const filteredAssets = assets.filter(asset => {
    // Media type filter
    if (mediaTypeFilter !== "all" && asset.media_type !== mediaTypeFilter) return false;

    // Search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const filenameMatch = asset.filename?.toLowerCase().includes(query);
      const originalNameMatch = asset.original_name?.toLowerCase().includes(query);
      const subjectMatch = asset.subject_name?.toLowerCase().includes(query);
      const descriptionMatch = asset.description?.toLowerCase().includes(query);
      const typeMatch = asset.type?.toLowerCase().includes(query);
      return filenameMatch || originalNameMatch || subjectMatch || descriptionMatch || typeMatch;
    }

    return true;
  });

  const sortedAssets = [...filteredAssets].sort((a, b) => {
    switch (sortBy) {
      case "oldest":
        return (a.created_at || 0) - (b.created_at || 0);
      case "name":
        return (a.subject_name || "").localeCompare(b.subject_name || "");
      case "size":
        return (b.size_bytes || 0) - (a.size_bytes || 0);
      case "newest":
      default:
        return (b.created_at || 0) - (a.created_at || 0);
    }
  });

  // Edit Metadata Modal Methods
  const openEditModal = (asset: MediaAsset) => {
    setEditingAsset(asset);
    setEditSubjectName(asset.subject_name || "");
    setEditDescription(asset.description || "");
    setEditType(asset.type || "");
    setEditError(null);
  };

  const handleSaveEdit = async () => {
    if (!editingAsset) return;
    setIsSavingEdit(true);
    setEditError(null);

    try {
      if (editSubjectName.trim()) {
        onRegisterSubject(editSubjectName.trim());
      }

      const res = await fetch(`/api/assets/${editingAsset.filename}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: editType || "Scene Reference",
          subject_name: editSubjectName.trim() || "subject",
          description: editDescription.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update metadata.");

      onAssetUpdated(editingAsset.filename, data.asset);
      setEditingAsset(null);
    } catch (err: any) {
      setEditError(err.message || "An error occurred.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteAsset = async (asset: MediaAsset) => {
    if (!window.confirm(`Are you sure you want to delete ${asset.original_name || asset.filename}?`)) {
      return;
    }
    try {
      await fetch(`/api/assets/${asset.filename}`, { method: "DELETE" });
      onAssetDeleted(asset.filename);
      if (lightboxAsset?.filename === asset.filename) {
        setLightboxAsset(null);
      }
    } catch (err) {
      console.error("Delete failed, fallback locally", err);
      onAssetDeleted(asset.filename);
    }
  };

  // Bulk Upload Flow
  const handleBulkDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setBulkDragActive(true);
    } else if (e.type === "dragleave") {
      setBulkDragActive(false);
    }
  };

  const handleBulkDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setBulkDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      const newQueue = files.map(file => ({
        file,
        progress: 0,
        status: "pending" as const
      }));
      setBulkQueue(prev => [...prev, ...newQueue]);
    }
  };

  const handleBulkFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      const newQueue = files.map(file => ({
        file,
        progress: 0,
        status: "pending" as const
      }));
      setBulkQueue(prev => [...prev, ...newQueue]);
    }
  };

  const removeQueueItem = (idx: number) => {
    setBulkQueue(prev => prev.filter((_, i) => i !== idx));
  };

  const clearQueue = () => {
    setBulkQueue([]);
  };

  // Run the batch sequential upload
  const runBulkUpload = async () => {
    if (bulkQueue.length === 0) return;
    setIsBulkUploading(true);

    if (bulkSubject.trim()) {
      onRegisterSubject(bulkSubject.trim());
    }

    // Process each file in the queue sequentially
    for (let idx = 0; idx < bulkQueue.length; idx++) {
      const item = bulkQueue[idx];
      if (item.status === "success") continue;

      setBulkQueue(prev => {
        const next = [...prev];
        next[idx] = { ...next[idx], status: "uploading" };
        return next;
      });

      const file = item.file;
      const mediaType = file.type.startsWith("image/") 
        ? "image" 
        : file.type.startsWith("audio/") 
        ? "audio" 
        : file.type.startsWith("video/")
        ? "video"
        : "image"; // Fallback default

      const CHUNK_SIZE = 512 * 1024; // 512KB chunks
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      const uploadId = Date.now().toString() + "_" + Math.random().toString(36).substring(2);

      try {
        let finalData = null;
        for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
          const chunk = file.slice(chunkIdx * CHUNK_SIZE, (chunkIdx + 1) * CHUNK_SIZE);
          const formData = new FormData();
          formData.append("file", chunk, file.name);
          formData.append("upload_id", uploadId);
          formData.append("chunk_index", chunkIdx.toString());
          formData.append("total_chunks", totalChunks.toString());
          formData.append("original_name", file.name);
          formData.append("slot_index", "0"); // Default
          formData.append("scene_name", sceneName);

          if (chunkIdx === totalChunks - 1) {
            formData.append("media_type", mediaType);
            formData.append("type", bulkAssetType);
            formData.append("subject_name", bulkSubject.trim() || "subject");
            formData.append("description", bulkDescription.trim() || `Bulk Uploaded: ${file.name}`);
          }

          const res = await fetch("/api/assets/upload_chunk", {
            method: "POST",
            body: formData
          });

          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "Chunk upload failed");
          }

          const data = await res.json();
          const progress = Math.round(((chunkIdx + 1) / totalChunks) * 100);

          setBulkQueue(prev => {
            const next = [...prev];
            next[idx] = { ...next[idx], progress };
            return next;
          });

          if (chunkIdx === totalChunks - 1) {
            finalData = data;
          }
        }

        if (finalData && finalData.asset) {
          const finalizedAsset: MediaAsset = {
            ...finalData.asset,
            media_type: mediaType
          };
          onAssetUploaded(finalizedAsset);
          setBulkQueue(prev => {
            const next = [...prev];
            next[idx] = { ...next[idx], status: "success", progress: 100 };
            return next;
          });
        } else {
          throw new Error("No asset metadata returned from backend");
        }

      } catch (err: any) {
        console.error("Failed to upload queue item:", file.name, err);
        setBulkQueue(prev => {
          const next = [...prev];
          next[idx] = { 
            ...next[idx], 
            status: "error", 
            error: err.message || "Failed to upload" 
          };
          return next;
        });
      }
    }

    setIsBulkUploading(false);
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return (
    <div className="space-y-6">
      
      {/* Global Drag Drop Backdrop Indicator */}
      {windowDragActive && (
        <div className="fixed inset-0 bg-indigo-950/80 backdrop-blur-md z-50 flex flex-col items-center justify-center border-4 border-dashed border-indigo-400 p-8 transition-all">
          <UploadCloud className="w-20 h-20 text-indigo-400 animate-bounce mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Drag files to Bulk Upload</h2>
          <p className="text-indigo-200 text-sm">Release anywhere on the screen to add images, audio, or video files to your scene library</p>
        </div>
      )}

      {/* Main Filter Section */}
      <div className="bg-zinc-900/60 border-2 border-zinc-700/80 rounded-xl p-4 shadow-sm flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search reference library..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-zinc-950 border-2 border-zinc-700 focus:border-amber-500 rounded-lg text-sm text-zinc-200 placeholder-zinc-500 outline-none transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 bg-zinc-950 border-2 border-zinc-700/80 p-0.5 rounded-lg">
              {(["all", "image", "video", "audio"] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setMediaTypeFilter(type)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition-all ${
                    mediaTypeFilter === type 
                      ? "bg-zinc-800 text-zinc-100 border border-zinc-700" 
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {type === "all" ? "All Media" : type === "image" ? "Images" : type === "video" ? "Videos" : "Audio"}
                </button>
              ))}
            </div>

            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="bg-zinc-950 border-2 border-zinc-700 text-zinc-300 text-xs font-semibold px-3 py-1.5 rounded-lg focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="name">Name (A-Z)</option>
              <option value="size">Size (Large-Small)</option>
            </select>

            <div className="flex items-center gap-1 bg-zinc-950 border-2 border-zinc-700/80 p-0.5 rounded-lg">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-md transition-all ${viewMode === "grid" ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}
                title="Grid view"
              >
                <Grid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-md transition-all ${viewMode === "list" ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}
                title="List view"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={() => setIsBulkModalOpen(true)}
              className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold rounded-lg shadow-md transition-colors flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3px]" />
              Bulk Upload
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-zinc-500 border-t border-zinc-800/80 pt-3">
          <p>
            Showing <span className="text-zinc-300 font-medium">{sortedAssets.length}</span> of{" "}
            <span className="text-zinc-300 font-medium">{assets.length}</span> total assets in library
          </p>
          <p className="hidden md:block">
            Tip: You can also <span className="text-amber-500/80 font-medium">drag & drop</span> files directly onto this window to start a bulk upload!
          </p>
        </div>
      </div>

      {/* Grid or List View of Assets */}
      {sortedAssets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-zinc-900/40 border-2 border-dashed border-zinc-800 rounded-xl">
          <ImageIcon className="w-16 h-16 text-zinc-700 mb-4 animate-pulse" />
          <h3 className="text-lg font-semibold text-zinc-300 mb-1">No Assets Match Filters</h3>
          <p className="text-sm text-zinc-500 max-w-md text-center">
            Upload some media using the <strong className="text-amber-500/80">"Bulk Upload"</strong> button, or clear your filters to display existing references.
          </p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {sortedAssets.map(asset => {
            const isImage = asset.media_type === "image" || (!asset.media_type && !/\.(mp3|wav|ogg|m4a|flac|mp4|mov|webm|mkv)$/i.test(asset.filename));
            const isAudio = asset.media_type === "audio" || /\.(mp3|wav|ogg|m4a|flac)$/i.test(asset.filename);
            const isVideo = asset.media_type === "video" || /\.(mp4|mov|webm|mkv)$/i.test(asset.filename);
            const mediaUrl = getAssetMediaUrl(asset.filename, true);

            return (
              <div 
                key={asset.id || asset.filename} 
                className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl overflow-hidden shadow-xs group transition-all duration-200 flex flex-col"
              >
                {/* Thumbnail Preview Area */}
                <div className="relative aspect-video bg-zinc-950 flex items-center justify-center overflow-hidden border-b border-zinc-800/80">
                  {isImage ? (
                    <img 
                      src={mediaUrl} 
                      alt={asset.original_name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 cursor-zoom-in"
                      referrerPolicy="no-referrer"
                      onClick={() => setLightboxAsset(asset)}
                    />
                  ) : isVideo ? (
                    <video 
                      src={mediaUrl} 
                      className="w-full h-full object-cover cursor-pointer"
                      controls={false}
                      muted
                      playsInline
                      onClick={() => setLightboxAsset(asset)}
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-emerald-950/20 text-emerald-400 p-4">
                      <Music className="w-8 h-8 mb-2 animate-pulse" />
                      <button 
                        onClick={() => toggleAudio(mediaUrl)}
                        className="px-2 py-1 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded text-[10px] font-bold flex items-center gap-1 transition-colors"
                      >
                        {playingAudioUrl === mediaUrl ? (
                          <>
                            <Pause className="w-3 h-3 fill-current" /> Pause
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3 fill-current" /> Play Audio
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Badges on Thumbnail */}
                  <div className="absolute top-2 left-2 flex gap-1 items-center">
                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider shadow-sm border ${
                      isImage 
                        ? "bg-amber-500/10 text-amber-300 border-amber-500/20" 
                        : isVideo 
                        ? "bg-indigo-500/10 text-indigo-300 border-indigo-500/20" 
                        : "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                    }`}>
                      {asset.media_type || (isImage ? "image" : isVideo ? "video" : "audio")}
                    </span>
                    {asset.type && (
                      <span className="px-2 py-0.5 rounded-md text-[9px] bg-zinc-900/90 text-zinc-300 border border-zinc-800/80 font-medium max-w-[100px] truncate shadow-sm">
                        {asset.type}
                      </span>
                    )}
                  </div>

                  {/* Actions overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={() => setLightboxAsset(asset)}
                      className="p-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors border border-zinc-700/60 shadow-md"
                      title="View full-size"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => openEditModal(asset)}
                      className="p-2 bg-zinc-800 hover:bg-zinc-700 text-indigo-400 rounded-lg transition-colors border border-zinc-700/60 shadow-md"
                      title="Edit metadata"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteAsset(asset)}
                      className="p-2 bg-zinc-800 hover:bg-red-900/60 text-red-400 rounded-lg transition-colors border border-zinc-700/60 shadow-md"
                      title="Delete asset"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Details Section */}
                <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                  <div>
                    <h4 className="text-xs font-bold text-zinc-100 truncate mb-0.5" title={asset.subject_name || "Unlabeled Asset"}>
                      {asset.subject_name || "Unlabeled Asset"}
                    </h4>
                    <p className="text-[10px] text-zinc-500 font-mono truncate mb-1">
                      {asset.original_name || asset.filename}
                    </p>
                    {asset.description && (
                      <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed bg-zinc-950/20 p-1.5 rounded border border-zinc-800/40">
                        {asset.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-zinc-500 border-t border-zinc-850 pt-2 shrink-0">
                    <span>{formatSize(asset.size_bytes)}</span>
                    <span>{asset.created_at ? new Date(asset.created_at).toLocaleDateString() : ""}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="bg-zinc-900/60 border-2 border-zinc-700 rounded-xl overflow-hidden shadow-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 text-xs font-bold uppercase tracking-wider">
                <th className="p-4">Preview</th>
                <th className="p-4">Subject Name</th>
                <th className="p-4">Semantic Type</th>
                <th className="p-4">Original Name</th>
                <th className="p-4">Size</th>
                <th className="p-4">Created At</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-850 text-xs">
              {sortedAssets.map(asset => {
                const isImage = asset.media_type === "image" || (!asset.media_type && !/\.(mp3|wav|ogg|m4a|flac|mp4|mov|webm|mkv)$/i.test(asset.filename));
                const isAudio = asset.media_type === "audio" || /\.(mp3|wav|ogg|m4a|flac)$/i.test(asset.filename);
                const mediaUrl = getAssetMediaUrl(asset.filename, true);

                return (
                  <tr key={asset.filename} className="hover:bg-zinc-800/40 transition-colors">
                    <td className="p-4">
                      <div className="w-12 aspect-square bg-zinc-950 rounded border border-zinc-800 overflow-hidden flex items-center justify-center">
                        {isImage ? (
                          <img src={mediaUrl} className="w-full h-full object-cover cursor-pointer" onClick={() => setLightboxAsset(asset)} referrerPolicy="no-referrer" />
                        ) : isAudio ? (
                          <button onClick={() => toggleAudio(mediaUrl)} className="p-1.5 bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-400 rounded">
                            {playingAudioUrl === mediaUrl ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                          </button>
                        ) : (
                          <VideoIcon className="w-4 h-4 text-indigo-400" />
                        )}
                      </div>
                    </td>
                    <td className="p-4 font-bold text-zinc-200">{asset.subject_name || "Unlabeled"}</td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 bg-zinc-950 text-zinc-400 border border-zinc-800 rounded font-medium">
                        {asset.type || "Scene Reference"}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-zinc-400 truncate max-w-[180px]">{asset.original_name || asset.filename}</td>
                    <td className="p-4 text-zinc-400">{formatSize(asset.size_bytes)}</td>
                    <td className="p-4 text-zinc-400">{asset.created_at ? new Date(asset.created_at).toLocaleDateString() : ""}</td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEditModal(asset)} className="p-1 text-zinc-400 hover:text-indigo-400 transition-colors">
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteAsset(asset)} className="p-1 text-zinc-400 hover:text-red-400 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Metadata Modal */}
      {editingAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border-2 border-zinc-700 rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/50">
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-500" />
                Edit Asset Metadata
              </h3>
              <button onClick={() => setEditingAsset(null)} className="text-zinc-400 hover:text-white transition-colors" disabled={isSavingEdit}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Subject Name</label>
                <input
                  type="text"
                  value={editSubjectName}
                  onChange={e => setEditSubjectName(e.target.value)}
                  className="w-full bg-zinc-950 border-2 border-zinc-700 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-zinc-200 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Semantic Type</label>
                <select
                  value={editType}
                  onChange={e => setEditType(e.target.value)}
                  className="w-full bg-zinc-950 border-2 border-zinc-700 focus:border-amber-500 rounded-lg px-2.5 py-2 text-xs text-zinc-200 outline-none"
                >
                  <option value="Headshot">Headshot</option>
                  <option value="Body Reference">Body Reference</option>
                  <option value="Scene Reference">Scene Reference</option>
                  <option value="Object Reference">Object Reference</option>
                  <option value="Style Reference">Style Reference</option>
                  <option value="Voiceover Audio">Voiceover Audio</option>
                  <option value="Soundtrack / BGM">Soundtrack / BGM</option>
                  <option value="SFX / Ambient">SFX / Ambient</option>
                  <option value="Motion Reference Video">Motion Reference Video</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Description</label>
                <textarea
                  value={editDescription}
                  onChange={e => setEditDescription(e.target.value)}
                  rows={3}
                  className="w-full bg-zinc-950 border-2 border-zinc-700 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-zinc-200 outline-none resize-none"
                />
              </div>

              {editError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 flex items-center gap-2">
                  <span>{editError}</span>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-zinc-800 bg-zinc-950/30 flex justify-end gap-3">
              <button onClick={() => setEditingAsset(null)} className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors" disabled={isSavingEdit}>
                Cancel
              </button>
              <button 
                onClick={handleSaveEdit} 
                disabled={isSavingEdit}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-2"
              >
                {isSavingEdit ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border-2 border-zinc-700 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/50 shrink-0">
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-amber-400 animate-pulse" />
                Bulk Library Upload
              </h3>
              <button onClick={() => setIsBulkModalOpen(false)} className="text-zinc-400 hover:text-white transition-colors" disabled={isBulkUploading}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5 flex-1">
              {/* Batch Defaults */}
              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850 space-y-4">
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Batch Defaults (Applies to all files)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">Default Subject Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Headshot Jackie, Desert Scene"
                      value={bulkSubject}
                      onChange={e => setBulkSubject(e.target.value)}
                      className="w-full bg-zinc-900 border-2 border-zinc-800 focus:border-amber-500 rounded-lg px-3 py-1.5 text-xs text-zinc-200 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">Default Semantic Type</label>
                    <select
                      value={bulkAssetType}
                      onChange={e => setBulkAssetType(e.target.value)}
                      className="w-full bg-zinc-900 border-2 border-zinc-800 focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 outline-none"
                    >
                      <option value="Scene Reference">Scene Reference</option>
                      <option value="Headshot">Headshot</option>
                      <option value="Body Reference">Body Reference</option>
                      <option value="Object Reference">Object Reference</option>
                      <option value="Style Reference">Style Reference</option>
                      <option value="Voiceover Audio">Voiceover Audio</option>
                      <option value="Soundtrack / BGM">Soundtrack / BGM</option>
                      <option value="SFX / Ambient">SFX / Ambient</option>
                      <option value="Motion Reference Video">Motion Reference Video</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">Default Description</label>
                  <textarea
                    placeholder="Provide a general description to attach to these library items..."
                    value={bulkDescription}
                    onChange={e => setBulkDescription(e.target.value)}
                    rows={2}
                    className="w-full bg-zinc-900 border-2 border-zinc-800 focus:border-amber-500 rounded-lg px-3 py-1.5 text-xs text-zinc-200 outline-none resize-none"
                  />
                </div>
              </div>

              {/* Drag zone */}
              <div 
                onDragEnter={handleBulkDrag}
                onDragOver={handleBulkDrag}
                onDragLeave={handleBulkDrag}
                onDrop={handleBulkDrop}
                className={`relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-all ${
                  bulkDragActive 
                    ? "border-amber-400 bg-amber-500/10" 
                    : "border-zinc-700 bg-zinc-950/40 hover:bg-zinc-900/40 cursor-pointer"
                }`}
              >
                <input
                  type="file"
                  multiple
                  onChange={handleBulkFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={isBulkUploading}
                />
                <UploadCloud className="w-10 h-10 text-amber-500/80 mb-3" />
                <p className="text-xs font-semibold text-zinc-300">Drag & Drop multiple files here or click to browse</p>
                <p className="text-[10px] text-zinc-500 mt-1">Supports PNG, JPEG, WEBP, MP3, WAV, MP4, MOV, etc.</p>
              </div>

              {/* Queue List */}
              {bulkQueue.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span>Queue ({bulkQueue.length} items)</span>
                    <button 
                      onClick={clearQueue} 
                      disabled={isBulkUploading} 
                      className="text-red-400 hover:text-red-300 transition-colors"
                    >
                      Clear Queue
                    </button>
                  </div>

                  <div className="divide-y divide-zinc-850 max-h-[180px] overflow-y-auto border border-zinc-800 rounded-xl bg-zinc-950">
                    {bulkQueue.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 text-xs">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {item.file.type.startsWith("image/") ? (
                            <ImageIcon className="w-4 h-4 text-amber-500 shrink-0" />
                          ) : item.file.type.startsWith("audio/") ? (
                            <Music className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <VideoIcon className="w-4 h-4 text-indigo-400 shrink-0" />
                          )}
                          <div className="truncate min-w-0">
                            <p className="font-medium text-zinc-300 truncate">{item.file.name}</p>
                            <p className="text-[10px] text-zinc-500">{formatSize(item.file.size)}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 ml-4">
                          {item.status === "pending" && (
                            <button
                              onClick={() => removeQueueItem(idx)}
                              disabled={isBulkUploading}
                              className="text-zinc-500 hover:text-zinc-300 p-1"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {item.status === "uploading" && (
                            <div className="flex items-center gap-2">
                              <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                              <span className="text-[10px] font-semibold text-amber-400">{item.progress}%</span>
                            </div>
                          )}
                          {item.status === "success" && (
                            <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/80 font-semibold flex items-center gap-1">
                              <Check className="w-3 h-3" /> Done
                            </span>
                          )}
                          {item.status === "error" && (
                            <span className="text-[10px] text-red-400 bg-red-950/80 px-2 py-0.5 rounded border border-red-800/80 font-semibold max-w-[150px] truncate" title={item.error}>
                              Error
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-zinc-800 bg-zinc-950/50 flex justify-end gap-3 shrink-0">
              <button 
                onClick={() => setIsBulkModalOpen(false)} 
                className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors" 
                disabled={isBulkUploading}
              >
                Cancel
              </button>
              <button
                onClick={runBulkUpload}
                disabled={isBulkUploading || bulkQueue.length === 0 || bulkQueue.every(i => i.status === "success")}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-zinc-950 text-xs font-bold rounded-lg shadow-md transition-all flex items-center gap-2"
              >
                {isBulkUploading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Uploading Batch...
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-3.5 h-3.5" />
                    Upload Queue ({bulkQueue.filter(i => i.status !== "success").length} items)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox / Video Preview Modal */}
      {lightboxAsset && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setLightboxAsset(null)}
        >
          <div className="absolute top-4 right-4 flex items-center gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteAsset(lightboxAsset);
              }}
              className="p-2.5 bg-zinc-900 hover:bg-red-900/80 border border-zinc-800 text-red-400 rounded-full shadow-lg transition-colors cursor-pointer"
              title="Delete asset"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setLightboxAsset(null)}
              className="p-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white rounded-full shadow-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div 
            className="max-w-4xl max-h-[80vh] flex items-center justify-center rounded-xl overflow-hidden shadow-2xl bg-zinc-950/80 border border-zinc-850"
            onClick={(e) => e.stopPropagation()}
          >
            {lightboxAsset.media_type === "image" || (!lightboxAsset.media_type && !/\.(mp3|wav|ogg|m4a|flac|mp4|mov|webm|mkv)$/i.test(lightboxAsset.filename)) ? (
              <img 
                src={getAssetMediaUrl(lightboxAsset.filename)} 
                alt={lightboxAsset.original_name} 
                className="max-w-full max-h-[80vh] object-contain"
                referrerPolicy="no-referrer"
              />
            ) : (
              <video 
                src={getAssetMediaUrl(lightboxAsset.filename)} 
                className="max-w-full max-h-[80vh] object-contain"
                controls
                autoPlay
              />
            )}
          </div>

          <div 
            className="mt-4 p-4 bg-zinc-900/90 border border-zinc-800 rounded-xl max-w-2xl text-center shadow-lg space-y-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold text-zinc-100">{lightboxAsset.subject_name || "Unlabeled Asset"}</h3>
            <p className="text-xs text-amber-400 font-mono font-medium">{lightboxAsset.type || "Scene Reference"}</p>
            {lightboxAsset.description && (
              <p className="text-xs text-zinc-400 max-w-lg leading-relaxed">{lightboxAsset.description}</p>
            )}
            <div className="flex justify-center items-center gap-3 text-[10px] text-zinc-500 pt-1.5 border-t border-zinc-850">
              <span>Original filename: {lightboxAsset.original_name}</span>
              <span>•</span>
              <span>Size: {formatSize(lightboxAsset.size_bytes)}</span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
