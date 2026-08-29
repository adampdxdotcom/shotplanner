import React, { useState } from "react";
import { MediaAsset, AssetType } from "../types";
import { 
  Edit3,
  Maximize,
  X,
  HardDrive, 
  Image as ImageIcon, 
  Music, 
  Video as VideoIcon, 
  UploadCloud, 
  Trash2, 
  CheckCircle, 
  Sparkles, 
  Tag, 
  User, 
  AlignLeft,
  AlertCircle,
  Loader2
} from "lucide-react";

interface AssetManagerSectionProps {
  assets: MediaAsset[];
  onAssetUploaded: (asset: MediaAsset, slotIndex?: number, mediaType?: "image" | "audio" | "video") => void;
  onAssetDeleted: (filename: string) => void;
  onAssetUpdated: (oldFilename: string, newAsset: MediaAsset) => void;
}

export const AssetManagerSection: React.FC<AssetManagerSectionProps> = ({
  assets,
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

  const [lightboxAsset, setLightboxAsset] = useState<MediaAsset | null>(null);
  
  const [editingAsset, setEditingAsset] = useState<MediaAsset | null>(null);
  const [editSubjectName, setEditSubjectName] = useState<string>("");
  const [editDescription, setEditDescription] = useState<string>("");
  const [editType, setEditType] = useState<string>("");
  const [editFile, setEditFile] = useState<File | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);


  const renderAssetCard = (asset: MediaAsset, idx: number, type: string) => {
    const isImage = asset.media_type === "image" || (!asset.media_type && !/\.(mp3|wav|ogg|m4a|mp4|mov|webm)$/i.test(asset.filename)) || /\.(png|jpe?g|webp|gif|svg|avif|bmp)$/i.test(asset.filename);
    const isAudio = asset.media_type === "audio" || /\.(mp3|wav|ogg|m4a|flac)$/i.test(asset.filename);
    const isVideo = asset.media_type === "video" || /\.(mp4|mov|webm|mkv)$/i.test(asset.filename);
    const imageSrc = asset.preview_url?.startsWith("/api/assets/file/") ? asset.preview_url : `/api/assets/file/${encodeURIComponent(asset.filename)}`;

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
              onClick={() => handleDelete(asset.filename)}
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
              onError={(e) => {
                const target = e.currentTarget;
                if (!target.src.includes("/api/uploads/")) {
                  target.src = `/api/uploads/${encodeURIComponent(asset.filename)}`;
                } else if (!target.src.includes("/uploads/")) {
                  target.src = `/uploads/${encodeURIComponent(asset.filename)}`;
                }
              }}
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
  };

  const closeUploadModal = () => {
    setUploadModalSlot(null);
  };

  const openEditModal = (asset: MediaAsset) => {
    setEditingAsset(asset);
    setEditSubjectName(asset.subject_name);
    setEditDescription(asset.description);
    setEditType(asset.type);
    setEditFile(null);
    setEditError(null);
  };

  const closeEditModal = () => {
    setEditingAsset(null);
    setEditFile(null);
  };

  const submitEdit = async () => {
    if (!editingAsset) return;
    setIsEditing(true);
    setEditError(null);

    try {
      if (editFile) {
        // Upload new file chunks
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
          onAssetUpdated(editingAsset.filename, finalData.asset);
        } else {
          throw new Error("Failed to get updated asset.");
        }
      } else {
        // Just update metadata
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


  const isImg = (a: MediaAsset) => a.media_type === "image" || (!a.media_type && !/\.(mp3|wav|ogg|m4a|flac|mp4|mov|webm|mkv)$/i.test(a.filename)) || /\.(png|jpe?g|webp|gif|svg|avif|bmp)$/i.test(a.filename);
  const isAud = (a: MediaAsset) => a.media_type === "audio" || /\.(mp3|wav|ogg|m4a|flac)$/i.test(a.filename);
  const isVid = (a: MediaAsset) => a.media_type === "video" || /\.(mp4|mov|webm|mkv)$/i.test(a.filename);

  const images = assets.filter(isImg);
  const audios = assets.filter(isAud);
  const videos = assets.filter(isVid);

  // Helper to map assets strictly by slot_index
  const getAssetForSlot = (type: "image" | "audio" | "video", slotIdx: number): MediaAsset | undefined => {
    const typeList = assets.filter(a => type === "image" ? isImg(a) : type === "audio" ? isAud(a) : isVid(a));
    
    // 1. Direct match by explicit slot_index
    const direct = typeList.find(a => a.slot_index === slotIdx);
    if (direct) return direct;

    // 2. Fallback for legacy assets without slot_index
    const unassigned = typeList.filter(a => a.slot_index === undefined);
    const assignedSlots = new Set(typeList.map(a => a.slot_index).filter(idx => idx !== undefined));
    
    let currSlot = 0;
    for (const item of unassigned) {
      while (assignedSlots.has(currSlot)) {
        currSlot++;
      }
      if (currSlot === slotIdx) return item;
      currSlot++;
    }
    return undefined;
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
        const finalizedAsset: MediaAsset = {
          ...finalData.asset,
          slot_index: targetSlotIndex,
          media_type: targetMediaType
        };
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
    <div id="assets-section" className="bg-zinc-900/60 border-2 border-zinc-700 rounded-xl p-5 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <HardDrive className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">1. Segmented Asset Management</h2>
            <p className="text-xs text-zinc-400">Click on an empty slot below to upload and configure semantic metadata. Auto-renames to format <code className="text-zinc-300">{`{type}_{name}_{timestamp}.ext`}</code>.</p>
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

      
      {/* Upload Modal */}
      {uploadModalSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border-2 border-zinc-700 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/50">
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-amber-400" />
                Upload {uploadModalSlot.type.toUpperCase()} to Slot {uploadModalSlot.index + 1}
              </h3>
              <button onClick={closeUploadModal} className="text-zinc-400 hover:text-white transition-colors" disabled={uploading}>
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-4 space-y-4 overflow-y-auto max-h-[75vh]">
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
                <label className="text-xs font-medium text-zinc-300 flex items-center gap-1">
                  <User className="w-3 h-3 text-zinc-400" />
                  <span>Subject / Entity Name</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. jackie, cyberpunk_car, tavern"
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  className="w-full bg-zinc-950 border-2 border-zinc-700 focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none"
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
                <label className="block text-xs font-medium text-zinc-400 mb-1">Subject Name</label>
                <input
                  type="text"
                  value={editSubjectName}
                  onChange={(e) => setEditSubjectName(e.target.value)}
                  className="w-full bg-zinc-950 border-2 border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-indigo-500 transition-colors outline-none"
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
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Replace File (Optional)</label>
                <input
                  type="file"
                  accept={editingAsset.media_type === "image" ? "image/*" : editingAsset.media_type === "audio" ? "audio/*" : "video/*"}
                  onChange={(e) => setEditFile(e.target.files?.[0] || null)}
                  className="w-full bg-zinc-950 border-2 border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-200 file:mr-3 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:bg-zinc-800 file:text-zinc-300 hover:file:bg-zinc-700"
                />
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
                src={lightboxAsset.preview_url?.startsWith("/api/assets/file/") ? lightboxAsset.preview_url : `/api/assets/file/${encodeURIComponent(lightboxAsset.filename)}`} 
                alt={lightboxAsset.subject_name} 
                className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl border border-white/10"
                onClick={(e) => e.stopPropagation()}
                onError={(e) => {
                  const target = e.currentTarget;
                  if (!target.src.includes("/api/uploads/")) {
                    target.src = `/api/uploads/${encodeURIComponent(lightboxAsset.filename)}`;
                  } else if (!target.src.includes("/uploads/")) {
                    target.src = `/uploads/${encodeURIComponent(lightboxAsset.filename)}`;
                  }
                }}
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
