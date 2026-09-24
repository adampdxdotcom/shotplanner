import React, { useState, useMemo, useEffect, useRef } from "react";
import { AppConfig, MediaAsset } from "../types";
import { UploadCloud, HardDrive, Search, Music, CheckCircle, X, AlertCircle, Sparkles, Loader2, RefreshCw, Eye } from "lucide-react";
import { SubjectCombobox } from "./SubjectCombobox";
import { getAssetMediaUrl } from "../utils/assetUrl";
import { 
  ASSET_REFERENCE_MODIFIERS, 
  getModifierConfig,
  detectActiveModifier,
  updateDescriptionWithModifier 
} from "../utils/assetModifiers";
import { useVisionCaption, generateCaptionForFile } from "../hooks/useVisionCaption";
import { createManagedBlobUrl, revokeManagedBlobUrl } from "../utils/blobRegistry";

interface AssetUploadModalProps {
  isOpen: boolean;
  activeTab: "image" | "audio" | "video";
  uploadModalSlot?: { type: "image" | "audio" | "video", index: number } | null;
  libraryAssets: MediaAsset[];
  subjects: string[];
  characters: Record<string, any>;
  sceneName?: string;
  config?: AppConfig;
  customTitle?: string;
  initialModalTab?: "upload" | "library";
  defaultSubject?: string;
  onRegisterSubject?: (name: string) => void;
  onClose: () => void;
  onAssetUploaded?: (asset: MediaAsset, slotIndex: number, type: string) => void;
  onSelectAsset?: (asset: MediaAsset) => void;
}

export const AssetUploadModal: React.FC<AssetUploadModalProps> = ({
  isOpen,
  activeTab,
  uploadModalSlot,
  libraryAssets,
  subjects,
  characters,
  sceneName,
  config,
  customTitle,
  initialModalTab,
  defaultSubject,
  onRegisterSubject,
  onClose,
  onAssetUploaded,
  onSelectAsset
}) => {
  const [assetType, setAssetType] = useState<string>("Headshot");
  const [selectedModifier, setSelectedModifier] = useState<string>("");
  const [subjectName, setSubjectName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [stagedPreviewUrl, setStagedPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isCaptioning, setIsCaptioning] = useState(false);
  const [captionToast, setCaptionToast] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeXhrRef = useRef<XMLHttpRequest | null>(null);
  const visionState = useVisionCaption(config);

  const modifierConfig = useMemo(() => getModifierConfig(assetType), [assetType]);

  const handleModifierChange = (modValue: string) => {
    setSelectedModifier(modValue);
    setDescription(prev => updateDescriptionWithModifier(prev, assetType, modValue));
  };
  
  const [uploadModalTab, setUploadModalTab] = useState<"upload" | "library">("upload");
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryFilter, setLibraryFilter] = useState("All");
  const [selectedLibraryAsset, setSelectedLibraryAsset] = useState<MediaAsset | null>(null);

  // Reset/clean up or initialize state on open/close
  useEffect(() => {
    if (isOpen) {
      if (initialModalTab) {
        setUploadModalTab(initialModalTab);
      }
      if (defaultSubject) {
        setSubjectName(defaultSubject);
      }
    } else {
      if (activeXhrRef.current) {
        try { activeXhrRef.current.abort(); } catch (e) {}
        activeXhrRef.current = null;
      }
      if (stagedPreviewUrl) {
        revokeManagedBlobUrl(stagedPreviewUrl);
      }
      setStagedFile(null);
      setStagedPreviewUrl(null);
      setUploadError(null);
      setUploading(false);
      setUploadProgress(0);
      setIsCaptioning(false);
      setCaptionToast(null);
      setIsDraggingOver(false);
    }
  }, [isOpen, initialModalTab, defaultSubject]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!uploading) {
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (uploading) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleFilePicked(file);
    }
  };

  const groupedLibraryAssets = useMemo(() => {
    let filtered = libraryAssets.filter(a => a.media_type === (uploadModalSlot?.type || activeTab));
    
    if (libraryFilter !== "All") {
      const typeLower = libraryFilter.toLowerCase();
      filtered = filtered.filter(a => (a.type || "").toLowerCase().includes(typeLower) || (a.description || "").toLowerCase().includes(typeLower));
    }
    
    if (librarySearch.trim()) {
      const query = librarySearch.toLowerCase();
      filtered = filtered.filter(a => 
        (a.subject_name || "").toLowerCase().includes(query) ||
        (a.description || "").toLowerCase().includes(query) ||
        (a.filename || "").toLowerCase().includes(query)
      );
    }
    
    const grouped: Record<string, MediaAsset[]> = {};
    filtered.forEach(asset => {
      const sub = asset.subject_name || "Uncategorized";
      if (!grouped[sub]) grouped[sub] = [];
      grouped[sub].push(asset);
    });
    return grouped;
  }, [libraryAssets, libraryFilter, librarySearch, uploadModalSlot, activeTab]);

  // Request vision caption for staged file
  const handleRequestVisionCaption = async (fileToDescribe: File) => {
    if (!visionState.canCaption) return;
    setIsCaptioning(true);
    setCaptionToast(null);
    try {
      const res = await generateCaptionForFile(fileToDescribe, {
        contextType: assetType,
        subjectName: subjectName.trim(),
        sceneName: sceneName,
        lmStudioUrl: visionState.lmStudioUrl
      });
      if (res.success && res.caption) {
        setDescription(res.caption);
        setCaptionToast("AI visual description generated");
        setTimeout(() => setCaptionToast(null), 3000);
      } else if (res.error) {
        setCaptionToast(`Vision notice: ${res.error}`);
        setTimeout(() => setCaptionToast(null), 4000);
      }
    } catch (err: any) {
      setCaptionToast("Failed to request AI description");
      setTimeout(() => setCaptionToast(null), 3000);
    } finally {
      setIsCaptioning(false);
    }
  };

  const handleFilePicked = (file: File) => {
    if (stagedPreviewUrl) {
      revokeManagedBlobUrl(stagedPreviewUrl);
    }
    const url = createManagedBlobUrl(file, "upload-staging");
    setStagedFile(file);
    setStagedPreviewUrl(url);
    setUploadError(null);

    // If auto-caption is active for image assets, trigger auto caption
    if (activeTab === "image" && visionState.autoCaption) {
      handleRequestVisionCaption(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    handleFilePicked(e.target.files[0]);
    if (e.target) e.target.value = "";
  };

  const handleExecuteUpload = async () => {
    if (!stagedFile) return;

    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    
    const formData = new FormData();
    formData.append("file", stagedFile);
    
    const targetSlotIndex = uploadModalSlot ? uploadModalSlot.index : 0;
    const targetMediaType = uploadModalSlot ? uploadModalSlot.type : activeTab;
    
    formData.append("slot_index", targetSlotIndex.toString());
    formData.append("media_type", targetMediaType);
    
    if (sceneName) {
      formData.append("scene_name", sceneName);
    }

    if (targetMediaType === "image") {
      formData.append("subject_name", subjectName.trim() || "subject");
      formData.append("type", assetType);
      formData.append("description", description.trim());
    } else if (targetMediaType === "audio") {
      formData.append("subject_name", subjectName.trim() || "voice");
      formData.append("type", "Voice Reference");
      formData.append("description", description || "Voice / Audio reference");
    } else if (targetMediaType === "video") {
      formData.append("subject_name", subjectName.trim() || "video");
      formData.append("type", "Video Reference");
      formData.append("description", description || "Video reference");
    }

    try {
      const xhr = new XMLHttpRequest();
      activeXhrRef.current = xhr;
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percentComplete);
        }
      });
      
      const p = new Promise<MediaAsset>((resolve, reject) => {
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const res = JSON.parse(xhr.responseText);
              resolve(res.asset);
            } catch (err) {
              reject(new Error("Failed to parse response"));
            }
          } else {
            try {
              const res = JSON.parse(xhr.responseText);
              reject(new Error(res.error || "Upload failed"));
            } catch (err) {
              reject(new Error(`Server error ${xhr.status}`));
            }
          }
        });
        xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
        xhr.addEventListener("abort", () => reject(new Error("Upload aborted by user")));
        xhr.open("POST", "/api/assets/upload");
        xhr.send(formData);
      });
      
      const newAsset = await p;
      setUploading(false);
      
      if (uploadModalSlot && onAssetUploaded) {
        onAssetUploaded(newAsset, uploadModalSlot.index, uploadModalSlot.type);
      } else if (onSelectAsset) {
        onSelectAsset(newAsset);
      }
      onClose();
    } catch (err: any) {
      setUploading(false);
      setUploadError(err.message);
    } finally {
      activeXhrRef.current = null;
    }
  };

  const handleAssignExistingAsset = () => {
    if (!selectedLibraryAsset) return;
    if (uploadModalSlot && onAssetUploaded) {
      onAssetUploaded(selectedLibraryAsset, uploadModalSlot.index, uploadModalSlot.type);
    } else if (onSelectAsset) {
      onSelectAsset(selectedLibraryAsset);
    }
    onClose();
  };

  if (!isOpen) return null;

  const isMetadataIncomplete = activeTab === "image" && (!subjectName.trim() || !description.trim());
  const isUploadDisabled = isMetadataIncomplete || !stagedFile || uploading;

  // Let's compute a simple preview filename
  const sanitize = (s: string) => s.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const previewFilename = `${sanitize(assetType)}_${sanitize(subjectName || "subject")}_<timestamp>.${activeTab === "image" ? "png" : activeTab === "audio" ? "mp3" : "mp4"}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/50">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <UploadCloud className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            {customTitle || (uploadModalSlot ? `Assign ${uploadModalSlot.type.toUpperCase()} to Slot ${uploadModalSlot.index + 1}` : `Select or Upload Reference Asset`)}
          </h3>
          <button 
            onClick={onClose} 
            className="text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-white p-1 rounded-md hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors cursor-pointer" 
            disabled={uploading}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/70 dark:bg-zinc-950/30">
          <button
            onClick={() => setUploadModalTab("upload")}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
              uploadModalTab === "upload" 
                ? "text-amber-600 dark:text-amber-400 border-b-2 border-amber-500 dark:border-amber-400 bg-white dark:bg-zinc-900/50 shadow-2xs" 
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900/20"
            }`}
          >
            Upload New Asset
          </button>
          <button
            onClick={() => setUploadModalTab("library")}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
              uploadModalTab === "library" 
                ? "text-amber-600 dark:text-amber-400 border-b-2 border-amber-500 dark:border-amber-400 bg-white dark:bg-zinc-900/50 shadow-2xs" 
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900/20"
            }`}
          >
            Select from Library
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto max-h-[72vh] min-h-[400px] flex flex-col custom-scrollbar text-zinc-800 dark:text-zinc-200">
          {uploadModalTab === "upload" ? (
            <div className="space-y-4 flex-1 flex flex-col">
              {uploadError && (
                <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700 dark:text-red-400">{uploadError}</p>
                </div>
              )}

              {captionToast && (
                <div className="p-2.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300 font-medium">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>{captionToast}</span>
                </div>
              )}
              
              {activeTab === "image" && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-400 mb-1">Type of Reference</label>
                    <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                      <select 
                        value={assetType}
                        onChange={(e) => {
                          const nextType = e.target.value;
                          setAssetType(nextType);
                          setSelectedModifier("");
                        }}
                        className="bg-white dark:bg-zinc-950 border-2 border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white focus:border-amber-500 transition-colors outline-none flex-1 min-w-[140px] shadow-2xs"
                      >
                        <option value="Headshot">Headshot (Face)</option>
                        <option value="Body Reference">Body / Outfit</option>
                        <option value="Scene / Location">Scene / Location</option>
                        <option value="Object / Prop">Object / Prop</option>
                        <option value="Style / Mood">Style / Mood</option>
                        <option value="Other">Other</option>
                      </select>

                      {modifierConfig && (
                        <select
                          value={selectedModifier}
                          onChange={(e) => handleModifierChange(e.target.value)}
                          className="bg-white dark:bg-zinc-950 border-2 border-amber-500/40 dark:border-amber-600/40 rounded-lg px-3 py-2 text-sm text-amber-800 dark:text-amber-300 focus:border-amber-500 transition-colors outline-none shrink-0 shadow-2xs"
                        >
                          <option value="">Modifier (Optional)...</option>
                          {modifierConfig.modifiers.map(preset => (
                            <option key={preset.id} value={preset.modifier}>
                              {preset.label}
                            </option>
                          ))}
                        </select>
                      )}

                      {assetType === "Other" && (
                        <input
                          type="text"
                          value={assetType}
                          onChange={(e) => setAssetType(e.target.value)}
                          placeholder="Custom type..."
                          className="flex-1 bg-white dark:bg-zinc-950 border-2 border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white focus:border-amber-500 transition-colors outline-none shadow-2xs"
                        />
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-400 mb-1">Subject / Entity Name</label>
                    <SubjectCombobox
                      value={subjectName}
                      onChange={setSubjectName}
                      subjects={subjects}
                      characters={characters}
                      onRegisterSubject={onRegisterSubject}
                      assetType={assetType}
                      placeholder={
                        assetType === "Scene / Location" ? "e.g., Cyberpunk City, Living Room" :
                        assetType === "Object / Prop" ? "e.g., Magic Sword, Coffee Mug" :
                        "e.g., John Doe, Hero Character"
                      }
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-400">Visual Description (for prompting)</label>
                      {visionState.canCaption && (
                        <button
                          type="button"
                          onClick={() => stagedFile && handleRequestVisionCaption(stagedFile)}
                          disabled={!stagedFile || isCaptioning}
                          className="text-[11px] text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 disabled:opacity-40 flex items-center gap-1 cursor-pointer transition-colors font-medium"
                          title="Generate AI visual caption with loaded vision model"
                        >
                          {isCaptioning ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>Describing...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3 h-3" />
                              <span>AI Auto-Describe</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                    <textarea 
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                      placeholder={
                        assetType === "Scene / Location" ? "Dark rainy street lit by neon..." :
                        assetType === "Object / Prop" ? "Glowing blue crystalline sword..." :
                        "A man with short brown hair wearing a red jacket..."
                      }
                      className="w-full bg-white dark:bg-zinc-950 border-2 border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-zinc-200 focus:border-amber-500 transition-colors outline-none resize-none placeholder-zinc-400 dark:placeholder-zinc-600 shadow-2xs"
                    />
                  </div>
                  
                  <div className="bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-lg p-2.5 flex flex-col gap-1">
                    <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-500/80 uppercase tracking-wider">Preview Filename</span>
                    <span className="text-xs text-amber-900 dark:text-amber-200/90 font-mono break-all font-medium">{previewFilename}</span>
                  </div>
                </>
              )}
              
              {/* File Dropzone / Staged Preview */}
              <input
                type="file"
                ref={fileInputRef}
                accept={activeTab === "image" ? "image/*" : activeTab === "audio" ? "audio/*" : "video/*"}
                onChange={handleFileInputChange}
                disabled={uploading}
                className="hidden"
              />

              {stagedFile && stagedPreviewUrl ? (
                <div 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`rounded-xl border-2 ${isDraggingOver ? "border-amber-500 bg-amber-50/60 dark:bg-amber-950/20" : "border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950"} p-3 flex flex-col sm:flex-row items-center gap-3 transition-colors shadow-2xs`}
                >
                  <div className="w-20 h-20 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-black shrink-0 relative flex items-center justify-center">
                    {activeTab === "image" ? (
                      <img src={stagedPreviewUrl} alt="Staged" className="w-full h-full object-cover" />
                    ) : activeTab === "video" ? (
                      <video src={stagedPreviewUrl} className="w-full h-full object-cover" />
                    ) : (
                      <Music className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 text-left w-full">
                    <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-200 truncate">{stagedFile.name}</div>
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">{(stagedFile.size / 1024).toFixed(1)} KB ready for staging</div>
                    
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="px-2.5 py-1 text-[11px] font-medium bg-zinc-200 hover:bg-zinc-300 text-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 rounded transition-colors cursor-pointer"
                      >
                        Change File
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (stagedPreviewUrl) revokeManagedBlobUrl(stagedPreviewUrl);
                          setStagedFile(null);
                          setStagedPreviewUrl(null);
                        }}
                        disabled={uploading}
                        className="px-2.5 py-1 text-[11px] font-medium bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-950/50 dark:hover:bg-red-900 dark:text-red-300 rounded transition-colors cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`flex-1 min-h-[120px] mt-1 border-2 border-dashed ${isDraggingOver ? "border-amber-500 bg-amber-50/80 dark:bg-amber-950/30 scale-[1.01]" : "border-zinc-300 hover:border-amber-500 dark:border-zinc-700 dark:hover:border-amber-500 bg-zinc-50/70 hover:bg-zinc-100/70 dark:bg-zinc-950/60 dark:hover:bg-zinc-900/60"} rounded-xl relative transition-all group overflow-hidden flex flex-col items-center justify-center p-5 cursor-pointer`}
                >
                  <UploadCloud className={`w-8 h-8 mb-2 ${isDraggingOver ? "text-amber-500 animate-bounce" : "text-amber-500 group-hover:text-amber-600 dark:group-hover:text-amber-400"} transition-colors`} />
                  <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 text-center">
                    {isDraggingOver ? `Drop ${activeTab.toUpperCase()} File Here` : `Select or Drop ${activeTab.toUpperCase()} File`}
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 text-center mt-0.5">
                    Click to browse or drag file here
                  </p>
                </div>
              )}

              {/* Upload Progress & Action Button */}
              {uploading && (
                <div className="space-y-1.5 pt-2">
                  <div className="w-full h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-amber-500 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-amber-700 dark:text-amber-300 text-center font-medium">{uploadProgress}% Uploading & Staging...</div>
                </div>
              )}

              <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-2.5 mt-auto">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={uploading}
                  className="px-4 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteUpload}
                  disabled={isUploadDisabled}
                  className="px-5 py-2 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all shadow-md flex items-center gap-2 cursor-pointer"
                >
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                  <span>{uploading ? "Uploading..." : uploadModalSlot ? `Confirm & Stage to Slot ${uploadModalSlot.index + 1}` : "Confirm & Use Asset"}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              {libraryAssets.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-zinc-50 dark:bg-zinc-950/50 rounded-xl border border-zinc-200 dark:border-zinc-800/50 h-full">
                  <HardDrive className="w-8 h-8 text-zinc-400 dark:text-zinc-600 mb-3" />
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">No assets found in library. Switch to the Upload tab to add new references.</p>
                  <button onClick={() => setUploadModalTab("upload")} className="mt-4 px-4 py-2 bg-zinc-200 hover:bg-zinc-300 text-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-white rounded-md text-xs font-medium transition-colors cursor-pointer">
                    Switch to Upload Tab
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-4 mb-4 shrink-0">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
                      <input
                        type="text"
                        placeholder="Search by subject, description, or filename..."
                        value={librarySearch}
                        onChange={e => setLibrarySearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-white dark:bg-zinc-950 border-2 border-zinc-300 dark:border-zinc-800 focus:border-amber-500 rounded-lg text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 outline-none transition-colors shadow-2xs"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {["All", "Headshots", "Body References", "Scene / Location", "Objects"].map(filter => (
                        <button
                          key={filter}
                          onClick={() => setLibraryFilter(filter)}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border cursor-pointer ${
                            libraryFilter === filter 
                              ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-800 dark:text-white dark:border-zinc-600" 
                              : "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-300 dark:bg-zinc-950 dark:text-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-700"
                          }`}
                        >
                          {filter}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
                    {Object.keys(groupedLibraryAssets).length === 0 ? (
                      <div className="text-center py-8 text-zinc-500 dark:text-zinc-400 text-sm">No assets match your search/filter.</div>
                    ) : (
                      Object.entries(groupedLibraryAssets as Record<string, MediaAsset[]>).map(([subject, groupAssets]) => (
                        <div key={subject} className="space-y-3">
                          <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2 sticky top-0 bg-white/95 dark:bg-zinc-900/90 backdrop-blur z-10">
                            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-200">{subject}</h4>
                            <span className="px-2 py-0.5 bg-zinc-100 text-zinc-600 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-transparent rounded-full text-[10px] font-medium">
                              {groupAssets.length} {groupAssets.length === 1 ? "Asset" : "Assets"}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {groupAssets.map(asset => (
                              <div
                                key={asset.id || asset.filename}
                                onClick={() => setSelectedLibraryAsset(asset)}
                                className={`relative aspect-square rounded-lg border-2 cursor-pointer overflow-hidden transition-all group ${
                                  selectedLibraryAsset?.filename === asset.filename 
                                    ? "border-amber-500 ring-2 ring-amber-500/20" 
                                    : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
                                }`}
                              >
                                {(uploadModalSlot?.type || activeTab) === "image" ? (
                                  <img src={getAssetMediaUrl(asset, true)} className="absolute inset-0 w-full h-full object-cover" alt="" />
                                ) : (uploadModalSlot?.type || activeTab) === "video" ? (
                                  <video src={getAssetMediaUrl(asset, true)} className="absolute inset-0 w-full h-full object-cover" />
                                ) : (
                                  <div className="absolute inset-0 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                                    <Music className="w-8 h-8 text-zinc-400 dark:text-zinc-500" />
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
                  
                  <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-3 mt-4 shrink-0">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors cursor-pointer">
                      Cancel
                    </button>
                    <button
                      onClick={handleAssignExistingAsset}
                      disabled={!selectedLibraryAsset}
                      className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2 rounded-md text-sm font-semibold transition-colors flex items-center gap-2 shadow-lg shadow-amber-900/20 cursor-pointer"
                    >
                      <CheckCircle className="w-4 h-4" />
                      {uploadModalSlot 
                        ? `Assign ${selectedLibraryAsset ? `"${selectedLibraryAsset.subject_name}"` : ""} to Slot ${uploadModalSlot.index + 1}`
                        : `Select ${selectedLibraryAsset ? `"${selectedLibraryAsset.subject_name || selectedLibraryAsset.filename}"` : "Asset"}`}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

