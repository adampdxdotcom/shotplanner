import React, { useState } from "react";
import { MediaAsset, AssetType, ScenePlanning, SceneProjectFile, ShotItem } from "../types";
import { getAssetMediaUrl } from "../utils/assetUrl";
import { SubjectCombobox } from "./SubjectCombobox";
import { ScenePlanningHeader } from "./ScenePlanningHeader";
import { 
  Edit3,
  Maximize,
  X,
  HardDrive, 
  Image as ImageIcon, 
  Music, 
  Video as VideoIcon, 
  UploadCloud, Search, 
  Trash2, 
  CheckCircle, 
  Sparkles, 
  Tag, 
  User, 
  AlignLeft,
  AlertCircle,
  Loader2,
  RefreshCw,
  Undo2,
  FileImage
} from "lucide-react";

interface AssetManagerSectionProps {
  assets: MediaAsset[];
  activeShotId: string | null;
  onSelectShot: (id: string | null) => void;
  sceneProject: SceneProjectFile;
  onUpdateProject: (updater: (prev: SceneProjectFile) => SceneProjectFile) => void;
  subjects?: string[];
  onRegisterSubject?: (name: string) => void;
  onAssetUploaded: (asset: MediaAsset, slotIndex?: number, mediaType?: "image" | "audio" | "video") => void;
  onAssetDeleted: (filename: string) => void;
  onAssetUpdated: (oldFilename: string, newAsset: MediaAsset) => void;
}

export const AssetManagerSection: React.FC<AssetManagerSectionProps> = ({
  assets,
  activeShotId,
  onSelectShot,
  sceneProject,
  onUpdateProject,
  subjects = [],
  onRegisterSubject = (_name: string) => {},
  onAssetUploaded,
  onAssetDeleted,
  onAssetUpdated
}) => {
  const [activeTab, setActiveTab] = useState<"image" | "audio" | "video">("image");
  
  // Metadata state for next upload
  const [assetType, setAssetType] = useState<string>("Headshot");
  const [subjectName, setSubjectName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadModalSlot, setUploadModalSlot] = useState<{ type: "image" | "audio" | "video", index: number } | null>(null);
  const [uploadModalTab, setUploadModalTab] = useState<"upload" | "library">("upload");
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryFilter, setLibraryFilter] = useState("All");
  const [selectedLibraryAsset, setSelectedLibraryAsset] = useState<MediaAsset | null>(null);

  const [lightboxAsset, setLightboxAsset] = useState<MediaAsset | null>(null);
  
  const [editingAsset, setEditingAsset] = useState<MediaAsset | null>(null);
  const [editSubjectName, setEditSubjectName] = useState<string>("");
  const [editDescription, setEditDescription] = useState<string>("");
  const [editType, setEditType] = useState<string>("");
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editFilePreviewUrl, setEditFilePreviewUrl] = useState<string | null>(null);
  const [isReplacingFile, setIsReplacingFile] = useState<boolean>(false);
  const [editDragActive, setEditDragActive] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const activeShotIndex = sceneProject.shots.findIndex(s => s.id === activeShotId);
  const activeShot = activeShotIndex >= 0 ? sceneProject.shots[activeShotIndex] : null;

  const handleAddBlankShot = () => {
    onUpdateProject(prev => {
      const newShot: ShotItem = {
        id: "shot_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
        shot_number: prev.shots.length + 1,
        shot_type: "Medium Shot",
        camera_movement: "Locked Off",
        basic_stub: "",
        expanded_prompt: "",
        assigned_slots: {},
        staged: false,
        updated_at: new Date().toISOString()
      };
      setTimeout(() => onSelectShot(newShot.id), 0);
      return { ...prev, shots: [...prev.shots, newShot] };
    });
  };

  const handlePlanningChange = (newPlanning: ScenePlanning) => {
    if (!activeShotId) return;
    onUpdateProject(prev => {
      const shots = [...prev.shots];
      const idx = shots.findIndex(s => s.id === activeShotId);
      if (idx !== -1) {
        shots[idx] = { 
          ...shots[idx], 
          shot_name: newPlanning.scene_name,
          shot_number: parseInt(String(newPlanning.shot_number)) || shots[idx].shot_number,
          shot_type: newPlanning.shot_type,
          camera_movement: newPlanning.camera_movement
        };
      }
      return { ...prev, shots };
    });
  };

  const renderAssetCard = (asset: MediaAsset, idx: number, type: string) => {
    const isImage = asset.media_type === "image" || (!asset.media_type && !/\.(mp3|wav|ogg|m4a|mp4|mov|webm)$/i.test(asset.filename)) || /\.(png|jpe?g|webp|gif|svg|avif|bmp)$/i.test(asset.filename);
    const isAudio = asset.media_type === "audio" || /\.(mp3|wav|ogg|m4a|flac)$/i.test(asset.filename);
    const isVideo = asset.media_type === "video" || /\.(mp4|mov|webm|mkv)$/i.test(asset.filename);
    const imageSrc = getAssetMediaUrl(asset);

    return (
      <div 
        key={asset.filename} 
        className="bg-zinc-950 p-3 rounded-xl border-2 border-zinc-700 hover:border-zinc-600 transition-all space-y-2 relative group flex flex-col"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-zinc-800 text-zinc-300 text-[10px] font-mono font-bold flex items-center justify-center">
              {idx + 1}
            </span>
            <div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                {asset.type}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => openEditModal(asset)}
              className="text-zinc-500 hover:text-indigo-400 p-1 rounded transition-colors"
              title="Edit asset"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (activeShotId) {
                  const globalSlot = getGlobalSlotIndex(type as any, idx);
                  onUpdateProject(prev => {
                    const shots = [...prev.shots];
                    const shotIdx = shots.findIndex(s => s.id === activeShotId);
                    if (shotIdx !== -1) {
                      const nextSlots = { ...shots[shotIdx].assigned_slots };
                      delete nextSlots[globalSlot];
                      shots[shotIdx] = { ...shots[shotIdx], assigned_slots: nextSlots , staged: false };
                    }
                    return { ...prev, shots };
                  });
                } else {
                  handleDelete(asset.filename);
                }
              }}
              className="text-zinc-500 hover:text-red-400 p-1 rounded transition-colors"
              title="Delete asset"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {isImage ? (
          <div 
            className="relative w-full aspect-square bg-zinc-900 rounded-lg overflow-hidden cursor-pointer group/img border border-zinc-800 flex items-center justify-center"
            onClick={() => setLightboxAsset(asset)}
          >
            <img 
              src={imageSrc} 
              alt={asset.subject_name} 
              className="w-full h-full object-cover" 
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
              <Maximize className="w-6 h-6 text-white" />
            </div>
          </div>
        ) : isVideo ? (
          <div className="relative w-full aspect-square bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 flex flex-col items-center justify-center text-indigo-400 gap-2">
            <VideoIcon className="w-8 h-8 opacity-80" />
            <span className="text-[10px] font-mono text-zinc-400 uppercase">Video Asset</span>
          </div>
        ) : (
          <div className="relative w-full aspect-square bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 flex flex-col items-center justify-center text-emerald-400 gap-2">
            <Music className="w-8 h-8 opacity-80" />
            <span className="text-[10px] font-mono text-zinc-400 uppercase">Audio Asset</span>
          </div>
        )}

        {/* Subject Name & Filename */}
        <div>
          <p className="text-xs font-semibold text-zinc-100 truncate">
            {asset.subject_name}
          </p>
          <p className="text-[11px] font-mono text-zinc-400 truncate mt-0.5">
            {asset.filename}
          </p>
        </div>

        {/* LLM Description preview */}
        {asset.description && (
          <p className="text-[11px] text-zinc-400 line-clamp-2 italic bg-zinc-900/70 p-1.5 rounded border-2 border-zinc-700/50">
            "{asset.description}"
          </p>
        )}

        <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-1 border-t border-zinc-900 mt-auto">
          <span>{(asset.size_bytes / 1024).toFixed(1)} KB</span>
          <span className="font-mono text-indigo-400">
            {isVideo ? `<Video ${idx + 1}>` : isAudio ? `<Audio ${idx + 1}>` : `<Picture ${idx + 1}>`}
          </span>
        </div>
      </div>
    );
  };

  const renderEmptySlot = (idx: number, type: string) => (
    <div 
      key={`empty-${type}-${idx}`} 
      onClick={() => openUploadModal(type as any, idx)}
      className="bg-zinc-950/30 p-3 rounded-xl border-2 border-dashed border-zinc-800/80 flex flex-col items-center justify-center min-h-[160px] text-zinc-600 transition-colors cursor-pointer hover:border-zinc-600 hover:bg-zinc-900/50 hover:text-zinc-400 group"
    >
      <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center mb-2 group-hover:bg-zinc-800 group-hover:text-amber-400 transition-colors">
        <UploadCloud className="w-4 h-4" />
      </div>
      <span className="text-xs font-semibold mb-1 uppercase tracking-wider opacity-50 group-hover:opacity-100 transition-opacity">Upload Slot</span>
      <span className="font-mono text-[10px] text-zinc-500 group-hover:text-zinc-400 transition-colors">
        {type === "video" ? `<Video ${idx + 1}>` : type === "audio" ? `<Audio ${idx + 1}>` : `<Picture ${idx + 1}>`}
      </span>
    </div>
  );


  const openUploadModal = (type: "image" | "audio" | "video", index: number) => {
    setActiveTab(type);
    setAssetType(type === "image" ? "Headshot" : type === "audio" ? "Voiceover Audio" : "Motion Reference Video");
    setSubjectName("");
    setDescription("");
    setUploadError(null);
    setUploadModalSlot({ type, index });
    
    // Default to library tab if there are existing assets of this type
    const hasAssets = assets.some(a => 
      type === "image" 
        ? (a.media_type === "image" || (!a.media_type && !/\.(mp3|wav|ogg|m4a|flac|mp4|mov|webm|mkv)$/i.test(a.filename)))
        : type === "audio"
        ? (a.media_type === "audio" || /\.(mp3|wav|ogg|m4a|flac)$/i.test(a.filename))
        : (a.media_type === "video" || /\.(mp4|mov|webm|mkv)$/i.test(a.filename))
    );
    setUploadModalTab(hasAssets ? "library" : "upload");
    setLibrarySearch("");
    setLibraryFilter("All");
    setSelectedLibraryAsset(null);
  };

  const closeUploadModal = () => {
    setUploadModalSlot(null);
  };

  const handleAssignExistingAsset = () => {
    if (!selectedLibraryAsset || !uploadModalSlot) return;
    
    if (activeShotId) {
      const globalSlot = getGlobalSlotIndex(uploadModalSlot.type, uploadModalSlot.index);
      onUpdateProject(prev => {
        const shots = [...prev.shots];
        const idx = shots.findIndex(s => s.id === activeShotId);
        if (idx !== -1) {
          shots[idx] = {
            ...shots[idx],
            assigned_slots: {
              ...(shots[idx].assigned_slots || {}),
              [globalSlot]: selectedLibraryAsset.filename
            },
              staged: false
          };
        }
        return { ...prev, shots };
      });
    }
    // Also dispatch the upload event so it binds correctly in the legacy system if needed
    onAssetUploaded(selectedLibraryAsset, uploadModalSlot.index, uploadModalSlot.type);
    
    closeUploadModal();
  };

  const openEditModal = (asset: MediaAsset) => {
    setEditingAsset(asset);
    setEditSubjectName(asset.subject_name);
    setEditDescription(asset.description);
    setEditType(asset.type);
    setEditFile(null);
    if (editFilePreviewUrl) {
      URL.revokeObjectURL(editFilePreviewUrl);
    }
    setEditFilePreviewUrl(null);
    setIsReplacingFile(false);
    setEditDragActive(false);
    setEditError(null);
  };

  const closeEditModal = () => {
    if (editFilePreviewUrl) {
      URL.revokeObjectURL(editFilePreviewUrl);
    }
    setEditingAsset(null);
    setEditFile(null);
    setEditFilePreviewUrl(null);
    setIsReplacingFile(false);
    setEditDragActive(false);
    setEditError(null);
  };

  const handleEditFileSelected = (file: File | null) => {
    if (editFilePreviewUrl) {
      URL.revokeObjectURL(editFilePreviewUrl);
      setEditFilePreviewUrl(null);
    }
    if (file) {
      setEditFile(file);
      setIsReplacingFile(true);
      if (file.type.startsWith("image/")) {
        setEditFilePreviewUrl(URL.createObjectURL(file));
      }
    } else {
      setEditFile(null);
    }
  };

  const handleTriggerReplace = () => {
    if (editFilePreviewUrl) {
      URL.revokeObjectURL(editFilePreviewUrl);
      setEditFilePreviewUrl(null);
    }
    setEditFile(null);
    setIsReplacingFile(true);
  };

  const handleRevertToOriginal = () => {
    if (editFilePreviewUrl) {
      URL.revokeObjectURL(editFilePreviewUrl);
      setEditFilePreviewUrl(null);
    }
    setEditFile(null);
    setIsReplacingFile(false);
  };

  const submitEdit = async () => {
    if (!editingAsset) return;
    setIsEditing(true);
    setEditError(null);

    try {
      if (isReplacingFile && editFile) {
        // Upload new file chunks to replace the file on disk
        const CHUNK_SIZE = 512 * 1024;
        const totalChunks = Math.ceil(editFile.size / CHUNK_SIZE);
        const uploadId = Date.now().toString() + "_" + Math.random().toString(36).substring(2);
        
        let finalData = null;
        for (let i = 0; i < totalChunks; i++) {
          const chunk = editFile.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
          const formData = new FormData();
          formData.append("file", chunk, editFile.name);
          formData.append("upload_id", uploadId);
          formData.append("chunk_index", i.toString());
          formData.append("total_chunks", totalChunks.toString());
          formData.append("original_name", editFile.name);
          formData.append("replace_filename", editingAsset.filename);
          
          if (i === totalChunks - 1) {
            formData.append("media_type", editingAsset.media_type);
            formData.append("type", editType);
            formData.append("subject_name", editSubjectName || "subject");
            formData.append("description", editDescription || "");
          }
          
          const res = await fetch("/api/assets/upload_chunk", {
            method: "POST",
            body: formData
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Failed to upload replacement chunk.");
          if (i === totalChunks - 1) finalData = data;
        }
        
        if (finalData && finalData.asset) {
          if (editSubjectName.trim()) onRegisterSubject(editSubjectName.trim());
          onAssetUpdated(editingAsset.filename, finalData.asset);
        } else {
          throw new Error("Failed to get updated asset.");
        }
      } else {
        // Just update metadata without modifying file on disk
        if (editSubjectName.trim()) onRegisterSubject(editSubjectName.trim());
        const res = await fetch(`/api/assets/${editingAsset.filename}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: editType,
            subject_name: editSubjectName,
            description: editDescription
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update asset.");
        onAssetUpdated(editingAsset.filename, data.asset);
      }
      closeEditModal();
    } catch (err: any) {
      setEditError(err.message || "Failed to save edits.");
    } finally {
      setIsEditing(false);
    }
  };



  const libraryAssets = assets.filter(a => 
    uploadModalSlot?.type === "image" 
      ? (a.media_type === "image" || (!a.media_type && !/\.(mp3|wav|ogg|m4a|flac|mp4|mov|webm|mkv)$/i.test(a.filename)) || /\.(png|jpe?g|webp|gif|svg|avif|bmp)$/i.test(a.filename))
      : uploadModalSlot?.type === "audio"
      ? (a.media_type === "audio" || /\.(mp3|wav|ogg|m4a|flac)$/i.test(a.filename))
      : (a.media_type === "video" || /\.(mp4|mov|webm|mkv)$/i.test(a.filename))
  );

  const filteredLibraryAssets = libraryAssets.filter(a => {
    // 1. Match Search
    if (librarySearch) {
      const q = librarySearch.toLowerCase();
      if (!(a.subject_name?.toLowerCase().includes(q) || a.description?.toLowerCase().includes(q) || a.filename.toLowerCase().includes(q))) {
        return false;
      }
    }
    // 2. Match Filter
    if (libraryFilter !== "All") {
      if (libraryFilter === "Headshots" && a.type !== "Headshot") return false;
      if (libraryFilter === "Body References" && a.type !== "Body Reference") return false;
      if (libraryFilter === "Scene / Location" && a.type !== "Scene Reference") return false;
      if (libraryFilter === "Objects" && a.type !== "Object Reference") return false;
    }
    return true;
  });

  const groupedLibraryAssets: Record<string, MediaAsset[]> = filteredLibraryAssets.reduce((acc: Record<string, MediaAsset[]>, asset: MediaAsset) => {
    const subject = asset.subject_name || "Uncategorized";
    if (!acc[subject]) acc[subject] = [];
    acc[subject].push(asset);
    return acc;
  }, {} as Record<string, MediaAsset[]>);

  const isImg = (a: MediaAsset) => a.media_type === "image" || (!a.media_type && !/\.(mp3|wav|ogg|m4a|flac|mp4|mov|webm|mkv)$/i.test(a.filename)) || /\.(png|jpe?g|webp|gif|svg|avif|bmp)$/i.test(a.filename);
  const isAud = (a: MediaAsset) => a.media_type === "audio" || /\.(mp3|wav|ogg|m4a|flac)$/i.test(a.filename);
  const isVid = (a: MediaAsset) => a.media_type === "video" || /\.(mp4|mov|webm|mkv)$/i.test(a.filename);

  const images = assets.filter(isImg);
  const audios = assets.filter(isAud);
  const videos = assets.filter(isVid);

  // Helper to map assets strictly by slot_index

  // Maps UI slot indices to global assigned_slots indices to prevent collisions
  const getGlobalSlotIndex = (type: string, idx: number) => {
    if (type === "audio") return 9 + idx;
    if (type === "video") return 11 + idx;
    return idx;
  };

  const getAssetForSlot = (type: "image" | "audio" | "video", slotIdx: number): MediaAsset | undefined => {
    if (!activeShot) return undefined;
    
    const globalSlot = getGlobalSlotIndex(type, slotIdx);

    // 1. Look up the assigned identifier for this slot from the ACTIVE SHOT ONLY
    const assignedIdentifier = activeShot.assigned_slots?.[globalSlot] 
                            || activeShot.assigned_slots?.[globalSlot + 1]
                            || activeShot.assigned_slots?.[`slot_${globalSlot}`];

    if (!assignedIdentifier) {
      // If the active shot has nothing mapped to this slot, it MUST remain empty!
      return undefined;
    }

    // 2. Resolve the asset from the master asset library by filename or ID
    return assets.find(a => 
      a.filename === assignedIdentifier || 
      (a as any).name === assignedIdentifier ||
      (a as any).id === assignedIdentifier
    );
  };


  // Limits
  const MAX_IMAGES = 9;
  const MAX_AUDIOS = 2;
  const MAX_VIDEOS = 1;

  const currentCount = activeTab === "image" ? images.length : activeTab === "audio" ? audios.length : videos.length;
  const currentMax = activeTab === "image" ? MAX_IMAGES : activeTab === "audio" ? MAX_AUDIOS : MAX_VIDEOS;
  const isLimitReached = currentCount >= currentMax;
  
  const isMetadataIncomplete = !subjectName.trim() || !description.trim();
  const isUploadDisabled = uploading || isLimitReached || isMetadataIncomplete;

  // File Renaming Strategy preview
  const sanitize = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_").replace(/_+/g, "_");
  const previewFilename = `${sanitize(assetType)}_${sanitize(subjectName || "subject")}_${Math.floor(Date.now() / 1000)}.${activeTab === "image" ? "png" : activeTab === "audio" ? "mp3" : "mp4"}`;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (isLimitReached) {
      setUploadError(`Maximum limit of ${currentMax} ${activeTab}(s) reached.`);
      return;
    }
    
    if (isMetadataIncomplete) {
      setUploadError("Please enter a subject name and description before uploading.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    const targetSlotIndex = uploadModalSlot ? uploadModalSlot.index : 0;
    const targetMediaType = uploadModalSlot ? uploadModalSlot.type : activeTab;

    const CHUNK_SIZE = 512 * 1024; // 512KB chunks to safely account for FormData overhead underneath NGINX 1MB limits
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const uploadId = Date.now().toString() + "_" + Math.random().toString(36).substring(2);

    try {
      let finalData = null;
      for (let i = 0; i < totalChunks; i++) {
        const chunk = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        const formData = new FormData();
        formData.append("file", chunk, file.name);
        formData.append("upload_id", uploadId);
        formData.append("chunk_index", i.toString());
        formData.append("total_chunks", totalChunks.toString());
        formData.append("original_name", file.name);
        formData.append("slot_index", targetSlotIndex.toString());
        
        // Always send metadata on the final chunk so the server knows what to do
        if (i === totalChunks - 1) {
          formData.append("media_type", targetMediaType);
          formData.append("type", assetType);
          formData.append("subject_name", subjectName || "subject");
          formData.append("description", description || "");
        }

        const res = await fetch("/api/assets/upload_chunk", {
          method: "POST",
          body: formData
        });
        
        const contentType = res.headers.get("content-type");
        let data;
        if (contentType && contentType.includes("application/json")) {
          data = await res.json();
        } else {
          await res.text();
          if (res.status === 413) {
            throw new Error("A chunk was too large for the network proxy. Chunk size is 512KB, which should be safe.");
          }
          throw new Error(`Server returned an unexpected response (${res.status}). Ensure the network allows this upload.`);
        }

        if (!res.ok) {
          throw new Error(data.error || data.message || data.err || `Failed to upload chunk. Server responded with ${res.status}: ${JSON.stringify(data)}`);
        }

        setUploadProgress(Math.round(((i + 1) / totalChunks) * 100));

        if (i === totalChunks - 1) {
          finalData = data;
        }
      }

      if (finalData && finalData.asset) {
        onRegisterSubject(subjectName.trim());
        const finalizedAsset: MediaAsset = {
          ...finalData.asset,
          slot_index: targetSlotIndex,
          media_type: targetMediaType
        };
        if (activeShotId) {
          const globalSlot = getGlobalSlotIndex(targetMediaType, targetSlotIndex);
          onUpdateProject(prev => {
            const shots = [...prev.shots];
            const idx = shots.findIndex(s => s.id === activeShotId);
            if (idx !== -1) {
              shots[idx] = {
                ...shots[idx],
                assigned_slots: {
                  ...(shots[idx].assigned_slots || {}),
                  [globalSlot]: finalizedAsset.filename
                },
                staged: false
              };
            }
            return { ...prev, shots };
          });
        }
        onAssetUploaded(finalizedAsset, targetSlotIndex, targetMediaType);
        closeUploadModal();
      } else {
        throw new Error("Completed all chunks, but no final asset was returned.");
      }
    } catch (err: any) {
      setUploadError(err.message || "Failed to upload asset");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      // Reset input so the same file can be selected again if needed
      e.target.value = '';
    }
  };
  const handleDelete = async (filename: string) => {
    try {
      await fetch(`/api/assets/${filename}`, { method: "DELETE" });
      onAssetDeleted(filename);
    } catch (e) {
      // fallback delete
      onAssetDeleted(filename);
    }
  };

  return (
    <div id="assets-section" className="space-y-5 flex flex-col min-h-0">
      
      {/* Assets Screen Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/60 p-4 rounded-xl border border-zinc-800 shadow-sm">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-zinc-300">Shot Context:</label>
          <select 
            value={activeShotId || ""}
            onChange={(e) => onSelectShot(e.target.value || null)}
            className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none min-w-[250px]"
          >
            <option key="empty" value="">-- Select a Shot --</option>
            {sceneProject.shots.map(s => (
              <option key={s.id} value={s.id}>
                Shot {s.shot_number.toString().padStart(2, '0')} - {s.shot_type}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleAddBlankShot}
          className="px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-lg text-sm font-medium transition-colors"
        >
          + New Shot
        </button>
      </div>

      {!activeShotId ? (
        <div className="flex flex-col items-center justify-center p-12 bg-zinc-900/40 border-2 border-dashed border-zinc-800 rounded-xl">
          <FileImage className="w-12 h-12 text-zinc-600 mb-4" />
          <h2 className="text-xl font-semibold text-zinc-300 mb-2">No Shot Selected</h2>
          <p className="text-sm text-zinc-500 text-center max-w-md">
            Choose an existing shot from the dropdown above or click <strong className="text-indigo-400">"+ New Shot"</strong> to stage a new camera setup and assign media assets.
          </p>
        </div>
      ) : (
        <>
          {/* Top Horizontal Card: Scene & Camera Planning */}
          {activeShot && (
            <ScenePlanningHeader 
              planning={{
                scene_name: activeShot.shot_name || "",
                shot_number: activeShot.shot_number.toString(),
                shot_type: activeShot.shot_type,
                camera_movement: activeShot.camera_movement
              }} 
              onChangePlanning={handlePlanningChange} 
            />
          )}

          {/* Main Asset Management Card */}
          <div className="bg-zinc-900/60 border-2 border-zinc-700 rounded-xl p-5 shadow-sm space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Segmented Asset Management</h2>
              <p className="text-xs text-zinc-400">Click on an empty slot below to upload and configure semantic metadata. Auto-renames to format <code className="text-zinc-300">{`{type}_{name}_{timestamp}.ext`}</code>. Assets are assigned to the active shot context.</p>
            </div>
          </div>
        </div>

      {/* Uploaded Assets Grid */}
      <div className="space-y-6 pt-4 border-t border-zinc-800">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-200">
            Uploaded Media Library
          </h2>
          <span className="text-[11px] text-zinc-400">Physically stored in <code className="text-zinc-300 bg-zinc-800 px-1 py-0.5 rounded">/assets/uploads/</code></span>
        </div>

        {/* Images Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-amber-300">
            <ImageIcon className="w-4 h-4" />
            <h3 className="text-xs font-semibold uppercase tracking-wider">
              Images ({images.length} / {MAX_IMAGES})
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: MAX_IMAGES }).map((_, idx) => {
              const asset = getAssetForSlot("image", idx);
              if (asset) return renderAssetCard(asset, idx, "image");
              return renderEmptySlot(idx, "image");
            })}
          </div>
        </div>

        {/* Video Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-indigo-300">
            <VideoIcon className="w-4 h-4" />
            <h3 className="text-xs font-semibold uppercase tracking-wider">
              Video ({videos.length} / {MAX_VIDEOS})
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: MAX_VIDEOS }).map((_, idx) => {
              const asset = getAssetForSlot("video", idx);
              if (asset) return renderAssetCard(asset, idx, "video");
              return renderEmptySlot(idx, "video");
            })}
          </div>
        </div>

        {/* Audio Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-emerald-300">
            <Music className="w-4 h-4" />
            <h3 className="text-xs font-semibold uppercase tracking-wider">
              Audio ({audios.length} / {MAX_AUDIOS})
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: MAX_AUDIOS }).map((_, idx) => {
              const asset = getAssetForSlot("audio", idx);
              if (asset) return renderAssetCard(asset, idx, "audio");
              return renderEmptySlot(idx, "audio");
            })}
          </div>
        </div>
      </div>
      </div>
      </>
      )}

      {/* Upload Modal */}
      {uploadModalSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border-2 border-zinc-700 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/50">
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-amber-400" />
                Assign {uploadModalSlot.type.toUpperCase()} to Slot {uploadModalSlot.index + 1}
              </h3>
              <button onClick={closeUploadModal} className="text-zinc-400 hover:text-white transition-colors" disabled={uploading}>
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex border-b border-zinc-800 bg-zinc-950/30">
              <button
                onClick={() => setUploadModalTab("upload")}
                className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${uploadModalTab === "upload" ? "text-amber-400 border-b-2 border-amber-400 bg-zinc-900/50" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                Upload New Asset
              </button>
              <button
                onClick={() => setUploadModalTab("library")}
                className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${uploadModalTab === "library" ? "text-amber-400 border-b-2 border-amber-400 bg-zinc-900/50" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                Select from Library
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto max-h-[70vh] min-h-[400px] flex flex-col">
              {uploadModalTab === "upload" ? (
                <div className="space-y-4">
              {uploadError && (
                <div className="p-3 rounded-lg bg-red-950/30 border border-red-800/40 text-xs text-red-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}
              
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-300 flex items-center gap-1">
                  <span>Asset Semantic Type</span>
                </label>
                {activeTab === "image" ? (
                  <select
                    value={assetType}
                    onChange={(e) => setAssetType(e.target.value)}
                    className="w-full bg-zinc-950 border-2 border-zinc-700 focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 outline-none"
                  >
                    <option value="Headshot">Headshot</option>
                    <option value="Body Reference">Body Reference</option>
                    <option value="Scene Reference">Scene Reference</option>
                    <option value="Object Reference">Object Reference</option>
                    <option value="Style Reference">Style Reference</option>
                  </select>
                ) : activeTab === "audio" ? (
                  <select
                    value={assetType}
                    onChange={(e) => setAssetType(e.target.value)}
                    className="w-full bg-zinc-950 border-2 border-zinc-700 focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 outline-none"
                  >
                    <option value="Voiceover Audio">Voiceover Audio</option>
                    <option value="Soundtrack / BGM">Soundtrack / BGM</option>
                    <option value="SFX / Ambient">SFX / Ambient</option>
                  </select>
                ) : (
                  <select
                    value={assetType}
                    onChange={(e) => setAssetType(e.target.value)}
                    className="w-full bg-zinc-950 border-2 border-zinc-700 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 outline-none"
                  >
                    <option value="Motion Reference Video">Motion Reference Video</option>
                    <option value="Style Reference Video">Style Reference Video</option>
                  </select>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-300 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3 text-zinc-400" />
                    <span>Subject / Entity Name</span>
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    Global Autocomplete
                  </span>
                </label>
                <SubjectCombobox
                  value={subjectName}
                  onChange={setSubjectName}
                  subjects={subjects}
                  onRegisterSubject={onRegisterSubject}
                  assets={assets}
                  assetType={assetType}
                  placeholder="e.g. Jackie, Cyberpunk_Car, Tavern"
                  disabled={uploading}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-300 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <AlignLeft className="w-3 h-3 text-zinc-400" />
                    <span>Description (Passed to LLM)</span>
                  </span>
                  <span className="text-[10px] text-amber-400/80 flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" /> Context
                  </span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Describe wardrobe, lighting, identity, angles..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-zinc-950 border-2 border-zinc-700 focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none resize-none"
                />
              </div>
              
              <div className="bg-zinc-950 px-3 py-2 rounded-lg border-2 border-zinc-700/80 text-[11px] flex items-center justify-between">
                <span className="text-zinc-400">Renamed File Strategy:</span>
                <span className="font-mono text-amber-300 font-medium truncate max-w-[280px]">
                  {previewFilename}
                </span>
              </div>

              <div className="mt-4 pt-4 border-t border-zinc-800">
                <label className={`relative w-full flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl transition-all ${
                  isUploadDisabled
                    ? "opacity-50 cursor-not-allowed border-zinc-800 bg-zinc-950/30" 
                    : "border-zinc-700 hover:border-amber-500/80 bg-zinc-950/40 hover:bg-zinc-900/60 cursor-pointer"
                }`}>
                  {uploading ? (
                    <>
                      <Loader2 className="w-8 h-8 mb-2 text-amber-400 animate-spin" />
                      <p className="text-xs font-semibold text-zinc-200 text-center mb-2">
                        Uploading... {uploadProgress}%
                      </p>
                      <div className="w-full max-w-[200px] bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-amber-400 h-1.5 transition-all duration-300 ease-out" 
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <UploadCloud className={`w-8 h-8 mb-2 ${isLimitReached ? "text-zinc-600" : "text-amber-400 animate-pulse"}`} />
                      <p className="text-xs font-semibold text-zinc-200 text-center">
                        Select {activeTab.toUpperCase()} File
                      </p>
                      <p className="text-[11px] text-zinc-400 text-center mt-1">
                        {isLimitReached 
                          ? `Max ${currentMax} ${activeTab}(s) reached` 
                          : isMetadataIncomplete
                          ? "Enter subject name & description first"
                          : `Click to browse files`}
                      </p>
                    </>
                  )}
                  <input
                    type="file"
                    accept={activeTab === "image" ? "image/*" : activeTab === "audio" ? "audio/*" : "video/*"}
                    onChange={handleFileSelect}
                    disabled={isUploadDisabled}
                    className="hidden"
                  />
                </label>
              </div>
                            </div>
              ) : (
                <div className="flex-1 flex flex-col min-h-0">
                  {libraryAssets.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-zinc-950/50 rounded-xl border border-zinc-800/50 h-full">
                      <HardDrive className="w-8 h-8 text-zinc-600 mb-3" />
                      <p className="text-sm text-zinc-400">No assets found in library. Switch to the Upload tab to add new references.</p>
                      <button onClick={() => setUploadModalTab("upload")} className="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-md text-xs font-medium transition-colors">
                        Switch to Upload Tab
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-4 mb-4 shrink-0">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                          <input
                            type="text"
                            placeholder="Search by subject, description, or filename..."
                            value={librarySearch}
                            onChange={e => setLibrarySearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-zinc-950 border-2 border-zinc-800 focus:border-amber-500 rounded-lg text-sm text-white placeholder-zinc-600 outline-none transition-colors"
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {["All", "Headshots", "Body References", "Scene / Location", "Objects"].map(filter => (
                            <button
                              key={filter}
                              onClick={() => setLibraryFilter(filter)}
                              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${libraryFilter === filter ? "bg-zinc-800 text-white border-zinc-600" : "bg-zinc-950 text-zinc-500 border-zinc-800 hover:border-zinc-700"}`}
                            >
                              {filter}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
                        {Object.keys(groupedLibraryAssets).length === 0 ? (
                          <div className="text-center py-8 text-zinc-500 text-sm">No assets match your search/filter.</div>
                        ) : (
                          Object.entries(groupedLibraryAssets).map(([subject, groupAssets]) => (
                            <div key={subject} className="space-y-3">
                              <div className="flex items-center gap-2 border-b border-zinc-800 pb-2 sticky top-0 bg-zinc-900/90 backdrop-blur z-10">
                                <h4 className="text-sm font-semibold text-zinc-200">{subject}</h4>
                                <span className="px-2 py-0.5 bg-zinc-800 rounded-full text-[10px] text-zinc-400 font-medium">
                                  {groupAssets.length} {groupAssets.length === 1 ? "Asset" : "Assets"}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {groupAssets.map(asset => (
                                  <div
                                    key={asset.id || asset.filename}
                                    onClick={() => setSelectedLibraryAsset(asset)}
                                    className={`relative aspect-square rounded-lg border-2 cursor-pointer overflow-hidden transition-all group ${selectedLibraryAsset?.filename === asset.filename ? "border-amber-500 ring-2 ring-amber-500/20" : "border-zinc-800 hover:border-zinc-600"}`}
                                  >
                                    {uploadModalSlot?.type === "image" ? (
                                      <img src={getAssetMediaUrl(asset)} className="absolute inset-0 w-full h-full object-cover" alt="" />
                                    ) : uploadModalSlot?.type === "video" ? (
                                      <video src={getAssetMediaUrl(asset)} className="absolute inset-0 w-full h-full object-cover" />
                                    ) : (
                                      <div className="absolute inset-0 bg-zinc-800 flex items-center justify-center">
                                        <Music className="w-8 h-8 text-zinc-500" />
                                      </div>
                                    )}
                                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-2 pt-6">
                                      <div className="text-[9px] font-bold text-white uppercase tracking-wider line-clamp-1">{asset.type || "Asset"}</div>
                                      {asset.description && <div className="text-[10px] text-zinc-300 line-clamp-1 mt-0.5">{asset.description}</div>}
                                    </div>
                                    {selectedLibraryAsset?.filename === asset.filename && (
                                      <div className="absolute top-1 right-1 bg-amber-500 rounded-full p-0.5 shadow-lg">
                                        <CheckCircle className="w-3 h-3 text-black" />
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      
                      <div className="pt-4 border-t border-zinc-800 flex justify-end gap-3 mt-4 shrink-0">
                        <button onClick={closeUploadModal} className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors">
                          Cancel
                        </button>
                        <button
                          onClick={handleAssignExistingAsset}
                          disabled={!selectedLibraryAsset}
                          className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2 rounded-md text-sm font-semibold transition-colors flex items-center gap-2 shadow-lg shadow-amber-900/20"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Assign {selectedLibraryAsset ? `"${selectedLibraryAsset.subject_name}"` : ""} to Slot {uploadModalSlot?.index !== undefined ? uploadModalSlot.index + 1 : ""}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}

      {editingAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border-2 border-zinc-700 rounded-xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/50">
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-indigo-400" />
                Edit Asset
              </h3>
              <button onClick={closeEditModal} className="text-zinc-400 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-4 space-y-4 overflow-y-auto max-h-[70vh]">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Asset Type</label>
                <input
                  type="text"
                  value={editType}
                  onChange={(e) => setEditType(e.target.value)}
                  className="w-full bg-zinc-950 border-2 border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-indigo-500 transition-colors outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Subject / Entity Name</label>
                <SubjectCombobox
                  value={editSubjectName}
                  onChange={setEditSubjectName}
                  subjects={subjects}
                  onRegisterSubject={onRegisterSubject}
                  assets={assets}
                  assetType={editType}
                  placeholder="e.g. Jackie, Cyberpunk_Car, Tavern"
                  disabled={isEditing}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full bg-zinc-950 border-2 border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-indigo-500 transition-colors outline-none resize-none"
                />
              </div>
              {/* Media Preview & Optional Replacement Zone */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs font-medium text-zinc-400">
                  <span className="flex items-center gap-1.5">
                    <FileImage className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Media File</span>
                  </span>
                  {!isReplacingFile ? (
                    <span className="text-[10px] text-emerald-400/90 font-mono bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded">
                      Retaining Current File
                    </span>
                  ) : editFile ? (
                    <span className="text-[10px] text-amber-400/90 font-mono bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded">
                      New Replacement Staged
                    </span>
                  ) : (
                    <span className="text-[10px] text-amber-400/90 font-mono bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded">
                      Select Replacement
                    </span>
                  )}
                </div>

                {/* State 1: Active Retained Media Preview (Default) */}
                {!isReplacingFile && (
                  <div className="relative group bg-zinc-950 border-2 border-zinc-700 rounded-xl overflow-hidden shadow-inner">
                    {/* Media Display */}
                    {(editingAsset.media_type === "image" || !editingAsset.media_type || /\.(png|jpe?g|webp|gif|svg|avif|bmp)$/i.test(editingAsset.filename)) ? (
                      <div className="relative w-full h-44 bg-zinc-950/80 flex items-center justify-center overflow-hidden">
                        <img
                          src={getAssetMediaUrl(editingAsset)}
                          alt={editingAsset.subject_name}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : editingAsset.media_type === "audio" || /\.(mp3|wav|ogg|m4a|flac)$/i.test(editingAsset.filename) ? (
                      <div className="p-4 flex flex-col items-center justify-center gap-2 bg-zinc-950/90 min-h-[120px]">
                        <Music className="w-8 h-8 text-amber-400" />
                        <audio 
                          controls 
                          src={getAssetMediaUrl(editingAsset)}
                          className="w-full max-w-xs h-8 mt-1" 
                        />
                      </div>
                    ) : (
                      <div className="relative w-full h-44 bg-zinc-950/80 flex items-center justify-center overflow-hidden">
                        <video 
                          controls
                          src={getAssetMediaUrl(editingAsset)}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    )}

                    {/* Top file meta tag */}
                    <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                      <span className="text-[10px] font-mono bg-black/75 text-zinc-300 px-2 py-0.5 rounded backdrop-blur-sm truncate max-w-[200px] border border-white/10">
                        {editingAsset.filename}
                      </span>
                      <span className="text-[10px] font-mono bg-black/75 text-zinc-400 px-2 py-0.5 rounded backdrop-blur-sm border border-white/10">
                        {(editingAsset.size_bytes / 1024).toFixed(1)} KB
                      </span>
                    </div>

                    {/* Bottom Action Bar / Overlay */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 pt-6 flex items-center justify-between transition-opacity">
                      <p className="text-[11px] text-zinc-300">
                        Original file will be kept
                      </p>
                      <button
                        type="button"
                        onClick={handleTriggerReplace}
                        className="px-3 py-1.5 bg-zinc-800/90 hover:bg-red-950/80 hover:text-red-300 hover:border-red-500/50 text-zinc-200 border border-zinc-600 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md"
                        title="Replace or clear this image file"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                        <span>Replace Image</span>
                        <Trash2 className="w-3.5 h-3.5 text-zinc-400 ml-0.5 hover:text-red-400" />
                      </button>
                    </div>
                  </div>
                )}

                {/* State 2: Replacement Mode (Staged new file or Drop Zone) */}
                {isReplacingFile && (
                  <div className="space-y-2">
                    {editFile ? (
                      /* Staged Replacement Preview */
                      <div className="relative bg-zinc-950 border-2 border-amber-500/80 rounded-xl overflow-hidden">
                        {editFilePreviewUrl ? (
                          <div className="relative w-full h-44 bg-zinc-950 flex items-center justify-center">
                            <img 
                              src={editFilePreviewUrl} 
                              alt="Staged replacement" 
                              className="w-full h-full object-contain"
                            />
                          </div>
                        ) : (
                          <div className="p-6 flex flex-col items-center justify-center gap-2">
                            <FileImage className="w-8 h-8 text-amber-400" />
                            <p className="text-xs font-mono text-zinc-200">{editFile.name}</p>
                          </div>
                        )}

                        <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                          <span className="text-[10px] font-mono bg-amber-950/90 text-amber-300 px-2 py-0.5 rounded border border-amber-600/40 truncate max-w-[200px]">
                            New: {editFile.name}
                          </span>
                          <span className="text-[10px] font-mono bg-black/80 text-zinc-300 px-2 py-0.5 rounded">
                            {(editFile.size / 1024).toFixed(1)} KB
                          </span>
                        </div>

                        {/* Staged file actions */}
                        <div className="p-2.5 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={handleRevertToOriginal}
                            className="px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1.5 transition-colors"
                          >
                            <Undo2 className="w-3.5 h-3.5" />
                            <span>Keep original file</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditFileSelected(null)}
                            className="px-2.5 py-1 bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/50 rounded-md text-xs flex items-center gap-1.5 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Drop Zone for selecting new file */
                      <div
                        onDragEnter={(e) => {
                          e.preventDefault();
                          setEditDragActive(true);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setEditDragActive(true);
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          setEditDragActive(false);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          setEditDragActive(false);
                          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                            handleEditFileSelected(e.dataTransfer.files[0]);
                          }
                        }}
                        className={`relative w-full flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl transition-all ${
                          editDragActive
                            ? "border-amber-400 bg-amber-500/10"
                            : "border-zinc-700 hover:border-amber-500/80 bg-zinc-950/60 hover:bg-zinc-900/60 cursor-pointer"
                        }`}
                      >
                        <label className="w-full flex flex-col items-center justify-center cursor-pointer">
                          <UploadCloud className="w-8 h-8 mb-2 text-amber-400 animate-pulse" />
                          <p className="text-xs font-semibold text-zinc-200 text-center">
                            Select Replacement {editingAsset.media_type ? editingAsset.media_type.toUpperCase() : "MEDIA"} File
                          </p>
                          <p className="text-[11px] text-zinc-400 text-center mt-1">
                            Click to browse files or drag and drop here
                          </p>
                          <input
                            type="file"
                            accept={editingAsset.media_type === "image" ? "image/*" : editingAsset.media_type === "audio" ? "audio/*" : "video/*"}
                            onChange={(e) => handleEditFileSelected(e.target.files?.[0] || null)}
                            className="hidden"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={handleRevertToOriginal}
                          className="mt-3 text-[11px] text-zinc-400 hover:text-zinc-200 underline flex items-center gap-1"
                        >
                          <Undo2 className="w-3 h-3" />
                          Cancel replacement & keep original
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {editError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-400">{editError}</p>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-zinc-800 bg-zinc-950/30 flex justify-end gap-3">
              <button onClick={closeEditModal} className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors">
                Cancel
              </button>
              <button 
                onClick={submitEdit} 
                disabled={isEditing}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-2"
              >
                {isEditing ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxAsset && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 md:p-12 cursor-zoom-out"
          onClick={() => setLightboxAsset(null)}
        >
          <div className="relative max-w-full max-h-full flex flex-col items-center justify-center">
            <button 
              className="absolute -top-10 right-0 text-white/70 hover:text-white bg-black/50 p-2 rounded-full transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxAsset(null);
              }}
            >
              <X className="w-6 h-6" />
            </button>
            {(lightboxAsset.media_type === "image" || !lightboxAsset.media_type || /\.(png|jpe?g|webp|gif|svg|avif|bmp)$/i.test(lightboxAsset.filename)) && (
              <img 
                src={getAssetMediaUrl(lightboxAsset)} 
                alt={lightboxAsset.subject_name} 
                className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl border border-white/10"
                onClick={(e) => e.stopPropagation()}
              />
            )}
            <div 
              className="mt-4 text-center bg-black/50 px-4 py-2 rounded-xl backdrop-blur-md border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-sm font-semibold text-white">{lightboxAsset.subject_name}</h3>
              <p className="text-xs text-zinc-400 mt-1 max-w-lg">{lightboxAsset.description}</p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
