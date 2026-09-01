import React, { useState, useMemo } from "react";
import { MediaAsset } from "../types";
import { UploadCloud, HardDrive, Search, Music, CheckCircle, X, AlertCircle } from "lucide-react";
import { SubjectCombobox } from "./SubjectCombobox";
import { getAssetMediaUrl } from "../utils/assetUrl";

interface AssetUploadModalProps {
  isOpen: boolean;
  activeTab: "image" | "audio" | "video";
  uploadModalSlot: { type: "image" | "audio" | "video", index: number } | null;
  libraryAssets: MediaAsset[];
  subjects: string[];
  characters: Record<string, any>;
  sceneName?: string;
  onRegisterSubject?: (name: string) => void;
  onClose: () => void;
  onAssetUploaded: (asset: MediaAsset, slotIndex: number, type: string) => void;
}

export const AssetUploadModal: React.FC<AssetUploadModalProps> = ({
  isOpen,
  activeTab,
  uploadModalSlot,
  libraryAssets,
  subjects,
  characters,
  sceneName,
  onRegisterSubject,
  onClose,
  onAssetUploaded
}) => {
  const [assetType, setAssetType] = useState<string>("Headshot");
  const [subjectName, setSubjectName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  const [uploadModalTab, setUploadModalTab] = useState<"upload" | "library">("upload");
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryFilter, setLibraryFilter] = useState("All");
  const [selectedLibraryAsset, setSelectedLibraryAsset] = useState<MediaAsset | null>(null);

  // When modal is opened, check if we should default to library
  // (We can assume the parent sets the initial tab, but let's handle it)
  // Actually, parent can just pass initial tab if we want, or we manage it here.

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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    
    const formData = new FormData();
    formData.append("file", file);
    
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
      formData.append("description", description);
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
        xhr.open("POST", "/api/assets/upload");
        xhr.send(formData);
      });
      
      const newAsset = await p;
      setUploading(false);
      
      if (uploadModalSlot) {
        onAssetUploaded(newAsset, uploadModalSlot.index, uploadModalSlot.type);
      }
      onClose();
    } catch (err: any) {
      setUploading(false);
      setUploadError(err.message);
    }
  };

  const handleAssignExistingAsset = () => {
    if (!selectedLibraryAsset || !uploadModalSlot) return;
    onAssetUploaded(selectedLibraryAsset, uploadModalSlot.index, uploadModalSlot.type);
    onClose();
  };

  if (!isOpen || !uploadModalSlot) return null;

  const isMetadataIncomplete = activeTab === "image" && (!subjectName.trim() || !description.trim());
  const isUploadDisabled = isMetadataIncomplete || uploading;

  // Let's compute a simple preview filename
  const sanitize = (s: string) => s.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const previewFilename = `${sanitize(assetType)}_${sanitize(subjectName || "subject")}_<timestamp>.${activeTab === "image" ? "png" : activeTab === "audio" ? "mp3" : "mp4"}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border-2 border-zinc-700 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/50">
          <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <UploadCloud className="w-4 h-4 text-amber-400" />
            Assign {uploadModalSlot.type.toUpperCase()} to Slot {uploadModalSlot.index + 1}
          </h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors" disabled={uploading}>
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
            <div className="space-y-4 flex-1 flex flex-col">
              {uploadError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-400">{uploadError}</p>
                </div>
              )}
              
              {activeTab === "image" && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Type of Reference</label>
                    <div className="flex gap-2">
                      <select 
                        value={assetType}
                        onChange={(e) => setAssetType(e.target.value)}
                        className="bg-zinc-950 border-2 border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500 transition-colors outline-none"
                      >
                        <option value="Headshot">Headshot (Face)</option>
                        <option value="Body Reference">Body / Outfit</option>
                        <option value="Scene / Location">Scene / Location</option>
                        <option value="Object / Prop">Object / Prop</option>
                        <option value="Style / Mood">Style / Mood</option>
                        <option value="Other">Other</option>
                      </select>
                      {assetType === "Other" && (
                        <input
                          type="text"
                          value={assetType}
                          onChange={(e) => setAssetType(e.target.value)}
                          placeholder="Custom type..."
                          className="flex-1 bg-zinc-950 border-2 border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500 transition-colors outline-none"
                        />
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Subject / Entity Name</label>
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
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Visual Description (for prompting)</label>
                    <textarea 
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                      placeholder={
                        assetType === "Scene / Location" ? "Dark rainy street lit by neon..." :
                        assetType === "Object / Prop" ? "Glowing blue crystalline sword..." :
                        "A man with short brown hair wearing a red jacket..."
                      }
                      className="w-full bg-zinc-950 border-2 border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500 transition-colors outline-none resize-none placeholder-zinc-600"
                    />
                  </div>
                  
                  <div className="bg-amber-950/20 border border-amber-900/30 rounded-lg p-3 flex flex-col gap-1.5">
                    <span className="text-[10px] font-semibold text-amber-500/80 uppercase tracking-wider">Preview Generated Filename</span>
                    <span className="text-xs text-amber-200/90 font-mono break-all">{previewFilename}</span>
                  </div>
                </>
              )}
              
              <div className="flex-1 min-h-[140px] mt-2 border-2 border-dashed border-zinc-700 rounded-xl relative transition-all group overflow-hidden bg-zinc-950/60 flex items-center justify-center">
                <label className={`absolute inset-0 flex flex-col items-center justify-center p-6 ${isUploadDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer group-hover:bg-amber-500/5 group-hover:border-amber-500/50'} transition-all`}>
                  {uploading ? (
                    <div className="flex flex-col items-center w-full max-w-xs">
                      <UploadCloud className="w-8 h-8 text-amber-400 mb-3 animate-bounce" />
                      <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden mb-2">
                        <div 
                          className="h-full bg-amber-500 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-amber-200">{uploadProgress}% Uploading...</span>
                    </div>
                  ) : (
                    <>
                      <UploadCloud className={`w-10 h-10 mb-3 transition-colors ${isMetadataIncomplete ? "text-zinc-600" : "text-amber-500 group-hover:text-amber-400"}`} />
                      <p className="text-xs font-semibold text-zinc-200 text-center">
                        Select {activeTab.toUpperCase()} File
                      </p>
                      <p className="text-[11px] text-zinc-400 text-center mt-1">
                        {isMetadataIncomplete
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
                      Object.entries(groupedLibraryAssets as Record<string, MediaAsset[]>).map(([subject, groupAssets]) => (
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
                                  <img src={getAssetMediaUrl(asset, true)} className="absolute inset-0 w-full h-full object-cover" alt="" />
                                ) : uploadModalSlot?.type === "video" ? (
                                  <video src={getAssetMediaUrl(asset, true)} className="absolute inset-0 w-full h-full object-cover" />
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
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors">
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
  );
};
