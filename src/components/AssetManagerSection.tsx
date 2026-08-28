import React, { useState } from "react";
import { MediaAsset, AssetType } from "../types";
import { 
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
  AlertCircle
} from "lucide-react";

interface AssetManagerSectionProps {
  assets: MediaAsset[];
  onAssetUploaded: (asset: MediaAsset) => void;
  onAssetDeleted: (filename: string) => void;
}

export const AssetManagerSection: React.FC<AssetManagerSectionProps> = ({
  assets,
  onAssetUploaded,
  onAssetDeleted
}) => {
  const [activeTab, setActiveTab] = useState<"image" | "audio" | "video">("image");
  
  // Metadata state for next upload
  const [assetType, setAssetType] = useState<string>("Headshot");
  const [subjectName, setSubjectName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const images = assets.filter(a => a.media_type === "image");
  const audios = assets.filter(a => a.media_type === "audio");
  const videos = assets.filter(a => a.media_type === "video");

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
    setUploadError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("media_type", activeTab);
    formData.append("type", assetType);
    formData.append("subject_name", subjectName || "subject");
    formData.append("description", description || "");

    try {
      const res = await fetch("/api/assets/upload", {
        method: "POST",
        body: formData
      });
      
      const contentType = res.headers.get("content-type");
      let data;
      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        if (res.status === 413) {
          throw new Error("File is too large. Please try an image under 1MB.");
        }
        throw new Error(`Server returned an unexpected response (${res.status}). Ensure the file isn't too large.`);
      }

      if (res.ok && data.asset) {
        onAssetUploaded(data.asset);
      } else {
        setUploadError(data.error || "Failed to upload media file.");
      }
    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
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
            <h2 className="text-sm font-semibold text-zinc-100">1. Segmented Asset Management &amp; Metadata</h2>
            <p className="text-xs text-zinc-400">Configure semantic tags, subject name, and LLM context prior to upload. Auto-renames to format <code className="text-zinc-300">{`{type}_{name}_{timestamp}.ext`}</code>.</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border-2 border-zinc-700">
          <button
            onClick={() => {
              setActiveTab("image");
              setAssetType("Headshot");
            }}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === "image" 
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" 
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Images ({images.length}/{MAX_IMAGES})</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("audio");
              setAssetType("Voiceover Audio");
            }}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === "audio" 
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" 
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span>Audio ({audios.length}/{MAX_AUDIOS})</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("video");
              setAssetType("Motion Reference Video");
            }}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === "video" 
                ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30" 
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <VideoIcon className="w-3.5 h-3.5" />
            <span>Video ({videos.length}/{MAX_VIDEOS})</span>
          </button>
        </div>
      </div>

      {uploadError && (
        <div className="p-3 rounded-lg bg-red-950/30 border border-red-800/40 text-xs text-red-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Metadata & Upload Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Metadata Inputs (Required before upload) */}
        <div className="lg:col-span-7 bg-zinc-950/50 p-4 rounded-xl border-2 border-zinc-700/80 space-y-3.5">
          <div className="flex items-center justify-between border-b border-zinc-800/60 pb-2">
            <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-amber-400" />
              Pre-Upload Metadata &amp; Renaming Rules
            </span>
            <span className="text-[11px] text-zinc-400 font-mono">
              Target: {previewFilename}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Type Dropdown */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300 flex items-center gap-1">
                <span>Asset Semantic Type</span>
              </label>
              {activeTab === "image" ? (
                <select
                  value={assetType}
                  onChange={(e) => setAssetType(e.target.value)}
                  className="w-full bg-zinc-900 border-2 border-zinc-700 focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 outline-none"
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
                  className="w-full bg-zinc-900 border-2 border-zinc-700 focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 outline-none"
                >
                  <option value="Voiceover Audio">Voiceover Audio</option>
                  <option value="Soundtrack / BGM">Soundtrack / BGM</option>
                  <option value="SFX / Ambient">SFX / Ambient</option>
                </select>
              ) : (
                <select
                  value={assetType}
                  onChange={(e) => setAssetType(e.target.value)}
                  className="w-full bg-zinc-900 border-2 border-zinc-700 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 outline-none"
                >
                  <option value="Motion Reference Video">Motion Reference Video</option>
                  <option value="Style Reference Video">Style Reference Video</option>
                </select>
              )}
            </div>

            {/* Subject Name Input */}
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
                className="w-full bg-zinc-900 border-2 border-zinc-700 focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none"
              />
            </div>
          </div>

          {/* Description Textarea for LLM Context */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-300 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <AlignLeft className="w-3 h-3 text-zinc-400" />
                <span>Description (Passed to LLM for Prompt Expansion)</span>
              </span>
              <span className="text-[10px] text-amber-400/80 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" /> Used in LLM System Prompt
              </span>
            </label>
            <textarea
              rows={2}
              placeholder="Describe wardrobe, lighting, identity, angles, key attributes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-zinc-900 border-2 border-zinc-700 focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none resize-none"
            />
          </div>

          {/* File Renaming Format Visualizer */}
          <div className="bg-zinc-900/90 px-3 py-2 rounded-lg border-2 border-zinc-700 text-[11px] flex items-center justify-between">
            <span className="text-zinc-400">Renamed File Strategy:</span>
            <span className="font-mono text-amber-300 font-medium truncate max-w-[280px]">
              {previewFilename}
            </span>
          </div>
        </div>

        {/* Right: Upload Dropzone */}
        <div className="lg:col-span-5 flex flex-col">
          <label className={`flex-1 flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl transition-all ${
            isUploadDisabled
              ? "opacity-50 cursor-not-allowed border-zinc-800 bg-zinc-950/30" 
              : "border-zinc-700 hover:border-amber-500/80 bg-zinc-950/40 hover:bg-zinc-900/60 cursor-pointer"
          }`}>
            <UploadCloud className={`w-8 h-8 mb-2 ${isLimitReached ? "text-zinc-600" : "text-amber-400 animate-pulse"}`} />
            <p className="text-xs font-semibold text-zinc-200 text-center">
              {uploading ? "Uploading & Renaming..." : `Upload ${activeTab.toUpperCase()}`}
            </p>
            <p className="text-[11px] text-zinc-400 text-center mt-1">
              {isLimitReached 
                ? `Max ${currentMax} ${activeTab}(s) reached` 
                : isMetadataIncomplete
                ? "Enter subject name & description first"
                : `Click or drop ${activeTab} file (Slot ${currentCount + 1} of ${currentMax})`}
            </p>
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

      {/* Uploaded Assets Grid */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-zinc-200">
            Uploaded {activeTab.toUpperCase()} Library ({currentCount} / {currentMax})
          </h3>
          <span className="text-[11px] text-zinc-400">Physically stored in <code className="text-zinc-300 bg-zinc-800 px-1 py-0.5 rounded">/assets/uploads/</code></span>
        </div>

        {currentCount === 0 ? (
          <div className="p-6 rounded-xl border-2 border-zinc-700/60 bg-zinc-950/30 text-center text-xs text-zinc-500">
            No {activeTab} assets uploaded yet. Fill in the metadata and upload above.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(activeTab === "image" ? images : activeTab === "audio" ? audios : videos).map((asset, idx) => (
              <div 
                key={asset.filename} 
                className="bg-zinc-950 p-3 rounded-xl border-2 border-zinc-700 hover:border-zinc-700 transition-all space-y-2 relative group"
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

                  <button
                    onClick={() => handleDelete(asset.filename)}
                    className="text-zinc-500 hover:text-red-400 p-1 rounded transition-colors"
                    title="Delete asset"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

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

                <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-1 border-t border-zinc-900">
                  <span>{(asset.size_bytes / 1024).toFixed(1)} KB</span>
                  <span className="font-mono text-indigo-400">
                    {asset.media_type === "video" ? `<Video ${idx + 1}>` : asset.media_type === "audio" ? `<Audio ${idx + 1}>` : `<Picture ${idx + 1}>`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
