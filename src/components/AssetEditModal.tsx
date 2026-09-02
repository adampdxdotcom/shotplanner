import React, { useState, useEffect, useMemo } from "react";
import { MediaAsset } from "../types";
import { Edit3, X, AlertCircle, UploadCloud, Undo2, Trash2, CheckCircle } from "lucide-react";
import { SubjectCombobox } from "./SubjectCombobox";
import { getAssetMediaUrl } from "../utils/assetUrl";
import { 
  ASSET_REFERENCE_MODIFIERS, 
  getModifierConfig,
  updateDescriptionWithModifier, 
  detectActiveModifier 
} from "../utils/assetModifiers";

interface AssetEditModalProps {
  asset: MediaAsset | null;
  subjects: string[];
  characters: Record<string, any>;
  onRegisterSubject?: (name: string) => void;
  onClose: () => void;
  onAssetUpdated: (oldFilename: string, newAsset: MediaAsset) => void;
}

const PRESET_TYPES = [
  { value: "Headshot", label: "Headshot (Face)" },
  { value: "Body Reference", label: "Body / Outfit" },
  { value: "Scene / Location", label: "Scene / Location" },
  { value: "Object / Prop", label: "Object / Prop" },
  { value: "Style / Mood", label: "Style / Mood" },
  { value: "Other", label: "Other" }
];

export const AssetEditModal: React.FC<AssetEditModalProps> = ({
  asset,
  subjects,
  characters,
  onRegisterSubject,
  onClose,
  onAssetUpdated
}) => {
  const [assetType, setAssetType] = useState<string>("Headshot");
  const [customType, setCustomType] = useState<string>("");
  const [selectedModifier, setSelectedModifier] = useState<string>("");
  const [editSubjectName, setEditSubjectName] = useState<string>("");
  const [editDescription, setEditDescription] = useState<string>("");
  const [editFile, setEditFile] = useState<File | null>(null);
  const [isReplacingFile, setIsReplacingFile] = useState<boolean>(false);
  const [editDragActive, setEditDragActive] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    if (asset) {
      const rawType = asset.type || "Headshot";
      const matchingPreset = PRESET_TYPES.find(p => p.value.toLowerCase() === rawType.toLowerCase());

      if (matchingPreset && matchingPreset.value !== "Other") {
        setAssetType(matchingPreset.value);
        setCustomType("");
      } else {
        const lower = rawType.toLowerCase();
        if (lower.includes("headshot")) {
          setAssetType("Headshot");
          setCustomType("");
        } else if (lower.includes("body") || lower.includes("outfit")) {
          setAssetType("Body Reference");
          setCustomType("");
        } else if (lower.includes("scene") || lower.includes("location")) {
          setAssetType("Scene / Location");
          setCustomType("");
        } else if (lower.includes("object") || lower.includes("prop")) {
          setAssetType("Object / Prop");
          setCustomType("");
        } else if (lower.includes("style") || lower.includes("mood")) {
          setAssetType("Style / Mood");
          setCustomType("");
        } else {
          setAssetType("Other");
          setCustomType(rawType);
        }
      }

      const effective = matchingPreset ? matchingPreset.value : rawType;
      const detectedMod = detectActiveModifier(asset.description || "", effective);
      setSelectedModifier(detectedMod);
      setEditSubjectName(asset.subject_name || "");
      setEditDescription(asset.description || "");
      setIsReplacingFile(false);
      setEditFile(null);
      setEditError(null);
    }
  }, [asset]);

  const effectiveType = useMemo(() => {
    if (assetType === "Other") {
      return customType.trim() || "Other";
    }
    return assetType;
  }, [assetType, customType]);

  const modifierConfig = useMemo(() => getModifierConfig(effectiveType) || getModifierConfig(assetType), [effectiveType, assetType]);

  const handleModifierChange = (modValue: string) => {
    setSelectedModifier(modValue);
    setEditDescription(prev => updateDescriptionWithModifier(prev, effectiveType, modValue));
  };

  const handleEditFileSelected = (file: File | null) => {
    setEditFile(file);
    setIsReplacingFile(!!file);
    setEditError(null);
  };

  const handleRevertToOriginal = () => {
    setIsReplacingFile(false);
    setEditFile(null);
    setEditError(null);
  };

  const submitEdit = async () => {
    if (!asset) return;

    if (!editSubjectName.trim() || !editDescription.trim()) {
      setEditError("Subject name and visual description are required.");
      return;
    }

    setIsEditing(true);
    setEditError(null);

    const formData = new FormData();
    formData.append("original_filename", asset.filename);
    formData.append("type", effectiveType);
    formData.append("subject_name", editSubjectName.trim());
    formData.append("description", editDescription.trim());

    if (isReplacingFile && editFile) {
      formData.append("file", editFile);
    } else {
      formData.append("keep_original_file", "true");
    }

    try {
      const res = await fetch(`/api/assets/${encodeURIComponent(asset.filename)}`, {
        method: "PUT",
        body: formData
      });

      let updatedAsset: MediaAsset = {
        ...asset,
        type: effectiveType,
        subject_name: editSubjectName.trim(),
        description: editDescription.trim()
      };

      if (res.ok) {
        try {
          const data = await res.json();
          if (data.asset) {
            updatedAsset = {
              ...asset,
              ...data.asset,
              type: effectiveType,
              subject_name: editSubjectName.trim(),
              description: editDescription.trim()
            };
          }
        } catch {}
      } else {
        let errStr = "Failed to update asset";
        try {
          const eJson = await res.json();
          errStr = eJson.error || errStr;
        } catch {}
        throw new Error(errStr);
      }

      if (onRegisterSubject && editSubjectName.trim()) {
        onRegisterSubject(editSubjectName.trim());
      }

      onAssetUpdated(asset.filename, updatedAsset);
      onClose();
    } catch (err: any) {
      setEditError(err.message || "Failed to update asset");
    } finally {
      setIsEditing(false);
    }
  };

  if (!asset) return null;

  const sanitize = (s: string) => s.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const previewMetadata = `${sanitize(effectiveType)}_${sanitize(editSubjectName || "subject")}_${asset.filename.split('.').pop() || "png"}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border-2 border-zinc-700 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/50">
          <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-amber-400" />
            Edit Asset Metadata
          </h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors" disabled={isEditing}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto max-h-[70vh]">
          {/* Asset Preview Header Card */}
          <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3 flex items-center gap-3.5">
            <div className="w-14 h-14 bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden shrink-0 relative flex items-center justify-center">
              {asset.media_type === "image" || !asset.media_type || !/\.(mp4|mov|webm|mp3|wav)$/i.test(asset.filename) ? (
                <img 
                  src={getAssetMediaUrl(asset.filename, true)} 
                  alt={asset.filename} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs font-mono font-bold text-amber-400">
                  {asset.filename.split('.').pop()?.toUpperCase()}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-mono font-medium text-zinc-200 truncate">{asset.filename}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded font-medium">
                  {effectiveType}
                </span>
                <span className="text-[10px] text-zinc-400 font-medium truncate">
                  {editSubjectName || "Unassigned"}
                </span>
              </div>
            </div>
          </div>

          {/* Type of Reference & Modifier Selectors */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Type of Reference</label>
            <div className="flex gap-2 flex-wrap sm:flex-nowrap">
              <select 
                value={assetType}
                onChange={(e) => {
                  const nextType = e.target.value;
                  setAssetType(nextType);
                  setSelectedModifier("");
                }}
                className="bg-zinc-950 border-2 border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500 transition-colors outline-none flex-1 min-w-[140px]"
              >
                {PRESET_TYPES.map(preset => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </select>

              {modifierConfig && (
                <select
                  value={selectedModifier}
                  onChange={(e) => handleModifierChange(e.target.value)}
                  className="bg-zinc-950 border-2 border-amber-600/40 rounded-lg px-3 py-2 text-sm text-amber-300 focus:border-amber-500 transition-colors outline-none shrink-0"
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
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value)}
                  placeholder="Custom type..."
                  className="flex-1 bg-zinc-950 border-2 border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500 transition-colors outline-none"
                />
              )}
            </div>
          </div>

          {/* Subject / Entity Name */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Subject / Entity Name</label>
            <SubjectCombobox
              value={editSubjectName}
              onChange={setEditSubjectName}
              subjects={subjects}
              characters={characters}
              onRegisterSubject={onRegisterSubject}
              assetType={effectiveType}
              placeholder={
                effectiveType === "Scene / Location" ? "e.g., Cyberpunk City, Living Room" :
                effectiveType === "Object / Prop" ? "e.g., Magic Sword, Coffee Mug" :
                "e.g., John Doe, Hero Character"
              }
            />
          </div>

          {/* Visual Description */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Visual Description (for prompting)</label>
            <textarea 
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={3}
              placeholder={
                effectiveType === "Scene / Location" ? "Dark rainy street lit by neon..." :
                effectiveType === "Object / Prop" ? "Glowing blue crystalline sword..." :
                "A man with short brown hair wearing a red jacket..."
              }
              className="w-full bg-zinc-950 border-2 border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500 transition-colors outline-none resize-none placeholder-zinc-600"
            />
          </div>

          {/* Preview Metadata Tag */}
          <div className="bg-amber-950/20 border border-amber-900/30 rounded-lg p-3 flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-amber-500/80 uppercase tracking-wider">Semantic Metadata Tag</span>
            <span className="text-xs text-amber-200/90 font-mono break-all">{previewMetadata}</span>
          </div>

          {/* Media File Replacement Option */}
          <div className="pt-2 border-t border-zinc-800/50">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-zinc-400">Media File</label>
              {!isReplacingFile && (
                <button
                  type="button"
                  onClick={() => setIsReplacingFile(true)}
                  className="text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-1 rounded transition-colors"
                >
                  Replace File
                </button>
              )}
            </div>

            {!isReplacingFile ? (
              <div className="flex items-center gap-3 p-3 bg-zinc-950/50 border border-zinc-800 rounded-lg opacity-70">
                <div className="w-8 h-8 bg-zinc-800 rounded flex items-center justify-center shrink-0">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="overflow-hidden flex-1">
                  <p className="text-xs text-zinc-300 truncate font-mono">{asset.filename}</p>
                  <p className="text-[10px] text-zinc-500">Original file preserved</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {editFile ? (
                  <div className="border border-amber-600/30 bg-amber-950/20 rounded-lg overflow-hidden">
                    <div className="p-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-8 h-8 bg-amber-900/40 rounded flex items-center justify-center shrink-0">
                          <UploadCloud className="w-4 h-4 text-amber-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-amber-200 truncate">{editFile.name}</p>
                          <p className="text-[10px] text-amber-500/70">{(editFile.size / 1024).toFixed(1)} KB</p>
                        </div>
                      </div>
                    </div>
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
                  <div
                    onDragEnter={(e) => { e.preventDefault(); setEditDragActive(true); }}
                    onDragOver={(e) => { e.preventDefault(); setEditDragActive(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setEditDragActive(false); }}
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
                        Select Replacement {asset.media_type ? asset.media_type.toUpperCase() : "MEDIA"} File
                      </p>
                      <p className="text-[11px] text-zinc-400 text-center mt-1">
                        Click to browse files or drag and drop here
                      </p>
                      <input
                        type="file"
                        accept={asset.media_type === "image" ? "image/*" : asset.media_type === "audio" ? "audio/*" : "video/*"}
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
          <button onClick={onClose} className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors" disabled={isEditing}>
            Cancel
          </button>
          <button 
            onClick={submitEdit} 
            disabled={isEditing}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-2"
          >
            {isEditing ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
};
