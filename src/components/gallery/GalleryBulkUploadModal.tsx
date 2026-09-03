import React, { useState, useEffect, useMemo } from "react";
import { X, UploadCloud, FileText, Music, Image as ImageIcon, Loader2, Check, UserPlus, SlidersHorizontal, AlertCircle, MapPin, User, Sparkles } from "lucide-react";
import { formatSize } from "../../utils/formatters";
import { MediaAsset } from "../../types";
import { toCanonicalSubjectName } from "../../utils/subjectUtils";
import { isLocationEntity } from "../../utils/locationUtils";
import {
  ASSET_REFERENCE_MODIFIERS,
  getModifierConfig,
  detectActiveModifier,
  updateDescriptionWithModifier
} from "../../utils/assetModifiers";
import { SubjectCombobox } from "../SubjectCombobox";
import {
  CharacterReferencePackGrid,
  CharacterPackSlot,
  ReferencePackSlotId,
  INITIAL_PACK_SLOTS,
  INITIAL_LOCATION_PACK_SLOTS
} from "./CharacterReferencePackGrid";

export interface BulkQueueItem {
  file: File;
  progress: number;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
}

interface GalleryBulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: string[];
  defaultSubject?: string;
  isLocation?: boolean;
  characters?: Record<string, any>;
  assets?: MediaAsset[];
  sceneName?: string;
  onAssetUploaded: (asset: MediaAsset) => void;
  onRegisterSubject: (name: string) => void;
}

export const GalleryBulkUploadModal: React.FC<GalleryBulkUploadModalProps> = ({
  isOpen,
  onClose,
  subjects,
  defaultSubject,
  isLocation,
  characters,
  assets,
  sceneName,
  onAssetUploaded,
  onRegisterSubject
}) => {
  // Target Subject and Entity Mode ("character" | "location")
  const [bulkSubject, setBulkSubject] = useState(defaultSubject || "");
  const [entityMode, setEntityMode] = useState<"character" | "location">("character");

  // 4-Slot Reference Pack (Character or Location)
  const [packSlots, setPackSlots] = useState<CharacterPackSlot[]>(INITIAL_PACK_SLOTS);

  // General Bulk Upload Queue & Options
  const [bulkQueue, setBulkQueue] = useState<BulkQueueItem[]>([]);
  const [bulkDescription, setBulkDescription] = useState("");
  const [bulkAssetType, setBulkAssetType] = useState("Body Reference");
  const [bulkModifier, setBulkModifier] = useState("");
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [bulkDragActive, setBulkDragActive] = useState(false);
  const [uploadSummary, setUploadSummary] = useState<{ total: number; completed: number; errors: number } | null>(null);

  // Switch entity mode between character and location
  const switchEntityMode = (mode: "character" | "location") => {
    setEntityMode(mode);
    packSlots.forEach(s => {
      if (s.previewUrl) URL.revokeObjectURL(s.previewUrl);
    });

    if (mode === "location") {
      setBulkAssetType("Scene Reference");
      if (!bulkDescription || bulkDescription.startsWith("body reference") || bulkDescription.startsWith("headshot")) {
        setBulkDescription("scene reference, ");
      }
      setPackSlots(INITIAL_LOCATION_PACK_SLOTS.map(s => ({
        ...s,
        file: null,
        previewUrl: null,
        description: s.defaultDescription,
        status: "idle",
        progress: 0,
        error: undefined
      })));
    } else {
      setBulkAssetType(bulkSubject ? "Body Reference" : "Headshot");
      if (bulkDescription.startsWith("scene reference")) {
        setBulkDescription("");
      }
      setPackSlots(INITIAL_PACK_SLOTS.map(s => ({
        ...s,
        file: null,
        previewUrl: null,
        description: s.defaultDescription,
        status: "idle",
        progress: 0,
        error: undefined
      })));
    }
  };

  // Reset/Initialize state when modal opens or target changes
  useEffect(() => {
    if (isOpen) {
      const initialSubj = defaultSubject || "";
      setBulkSubject(initialSubj);

      const isLoc = isLocation !== undefined
        ? isLocation
        : isLocationEntity(initialSubj, characters?.[initialSubj], assets);
      const mode = isLoc ? "location" : "character";
      setEntityMode(mode);

      setBulkAssetType(isLoc ? "Scene Reference" : (initialSubj ? "Body Reference" : "Scene Reference"));
      setBulkModifier("");
      setBulkDescription(isLoc ? "scene reference, " : "");
      setUploadSummary(null);
      setBulkQueue([]);

      const initialTemplate = isLoc ? INITIAL_LOCATION_PACK_SLOTS : INITIAL_PACK_SLOTS;
      setPackSlots(initialTemplate.map(s => ({
        ...s,
        file: null,
        previewUrl: null,
        description: s.defaultDescription,
        status: "idle",
        progress: 0,
        error: undefined
      })));
    } else {
      // Cleanup object URLs when modal is closed
      packSlots.forEach(s => {
        if (s.previewUrl) URL.revokeObjectURL(s.previewUrl);
      });
    }
  }, [isOpen, defaultSubject, isLocation]);

  // Handle subject change from Combobox with smart auto-detection
  const handleSubjectChange = (val: string) => {
    setBulkSubject(val);
    const isLoc = isLocationEntity(val, characters?.[val], assets);
    if (isLoc && entityMode !== "location") {
      switchEntityMode("location");
    } else if (!isLoc && entityMode !== "character" && val.trim().length > 0) {
      switchEntityMode("character");
    }
  };

  const bulkModifierConfig = useMemo(() => getModifierConfig(bulkAssetType), [bulkAssetType]);

  // Keep modifier state aligned if description or asset type changes
  useEffect(() => {
    if (bulkModifierConfig) {
      const detected = detectActiveModifier(bulkDescription, bulkAssetType);
      setBulkModifier(detected);
    } else {
      setBulkModifier("");
    }
  }, [bulkAssetType, bulkModifierConfig]);

  if (!isOpen) return null;

  // Handler for updating a single Reference Pack slot
  const handleUpdatePackSlot = (slotId: ReferencePackSlotId, updater: Partial<CharacterPackSlot>) => {
    setPackSlots(prev => prev.map(s => {
      if (s.id !== slotId) return s;
      if (updater.previewUrl !== undefined && s.previewUrl && s.previewUrl !== updater.previewUrl) {
        URL.revokeObjectURL(s.previewUrl);
      }
      return { ...s, ...updater };
    }));
  };

  // Handler for clearing a single Reference Pack slot
  const handleClearPackSlot = (slotId: ReferencePackSlotId) => {
    setPackSlots(prev => prev.map(s => {
      if (s.id !== slotId) return s;
      if (s.previewUrl) URL.revokeObjectURL(s.previewUrl);
      return {
        ...s,
        file: null,
        previewUrl: null,
        description: s.defaultDescription,
        status: "idle",
        progress: 0,
        error: undefined
      };
    }));
  };

  // Modifier change in general upload defaults
  const handleModifierChange = (modValue: string) => {
    setBulkModifier(modValue);
    const updated = updateDescriptionWithModifier(bulkDescription, "Headshot", modValue);
    setBulkDescription(updated);
  };

  // General drag & drop handlers
  const handleBulkDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setBulkDragActive(true);
    else if (e.type === "dragleave") setBulkDragActive(false);
  };

  const handleBulkDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setBulkDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      setBulkQueue(prev => [...prev, ...files.map(f => ({ file: f, progress: 0, status: "pending" as const }))]);
    }
  };

  const handleBulkFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      setBulkQueue(prev => [...prev, ...files.map(f => ({ file: f, progress: 0, status: "pending" as const }))]);
    }
    if (e.target) e.target.value = "";
  };

  const removeQueueItem = (idx: number) => {
    setBulkQueue(prev => prev.filter((_, i) => i !== idx));
  };

  // Counts for upload submission
  const populatedPackSlots = packSlots.filter(s => s.file !== null);
  const pendingPackSlots = populatedPackSlots.filter(s => s.status !== "success");
  const pendingQueueItems = bulkQueue.filter(i => i.status !== "success");
  const totalPendingCount = pendingPackSlots.length + pendingQueueItems.length;

  // Unified upload execution
  const runUnifiedUpload = async () => {
    if (totalPendingCount === 0 || isBulkUploading) return;
    setIsBulkUploading(true);

    const canonicalSubject = toCanonicalSubjectName(bulkSubject) || bulkSubject.trim();
    let completedCount = 0;
    let errorCount = 0;

    // 1. Upload Character Pack Slots
    for (const slot of packSlots) {
      if (!slot.file || slot.status === "success") continue;

      handleUpdatePackSlot(slot.id, { status: "uploading", progress: 15, error: undefined });

      // Explicitly assign semantic asset types:
      // In location mode or for Scene Reference slots: "Scene Reference"
      // In character mode: Slot 1 & 2 -> "Headshot", Slot 3 & 4 -> "Body Reference"
      let explicitType: "Headshot" | "Body Reference" | "Scene Reference";
      if (entityMode === "location" || slot.assetType === "Scene Reference") {
        explicitType = "Scene Reference";
      } else if (slot.id === "body_primary" || slot.id === "body_secondary") {
        explicitType = "Body Reference";
      } else {
        explicitType = "Headshot";
      }

      const formData = new FormData();
      formData.append("file", slot.file);
      if (sceneName) {
        formData.append("scene_name", sceneName);
      }
      formData.append("subject_name", canonicalSubject);
      formData.append("type", explicitType);
      formData.append("asset_type", explicitType);
      formData.append("media_type", "image");
      formData.append("description", slot.description.trim());
      formData.append("slot_id", slot.id);

      try {
        const res = await fetch("/api/assets/upload", { method: "POST", body: formData });
        handleUpdatePackSlot(slot.id, { progress: 85 });

        if (res.ok) {
          const resJson = await res.json();
          const newAsset = resJson.asset || resJson;
          onAssetUploaded(newAsset);
          if (canonicalSubject) {
            onRegisterSubject(canonicalSubject);
          }
          handleUpdatePackSlot(slot.id, { status: "success", progress: 100 });
          completedCount++;
        } else {
          const text = await res.text();
          throw new Error(text || `Failed to upload ${slot.title}`);
        }
      } catch (err: any) {
        errorCount++;
        handleUpdatePackSlot(slot.id, {
          status: "error",
          error: err.message || "Upload failed"
        });
      }
    }

    // 2. Upload General Bulk Queue Items
    for (let i = 0; i < bulkQueue.length; i++) {
      if (bulkQueue[i].status === "success") continue;

      setBulkQueue(prev => {
        const next = [...prev];
        next[i] = { ...next[i], status: "uploading", progress: 15, error: undefined };
        return next;
      });

      const formData = new FormData();
      formData.append("file", bulkQueue[i].file);
      if (sceneName) {
        formData.append("scene_name", sceneName);
      }
      formData.append("subject_name", canonicalSubject);
      formData.append("type", bulkAssetType);
      formData.append("asset_type", bulkAssetType);
      formData.append("description", bulkDescription.trim());

      try {
        const res = await fetch("/api/assets/upload", { method: "POST", body: formData });
        setBulkQueue(prev => {
          const next = [...prev];
          next[i] = { ...next[i], progress: 85 };
          return next;
        });

        if (res.ok) {
          const resJson = await res.json();
          const newAsset = resJson.asset || resJson;
          onAssetUploaded(newAsset);
          if (canonicalSubject) {
            onRegisterSubject(canonicalSubject);
          }
          setBulkQueue(prev => {
            const next = [...prev];
            next[i] = { ...next[i], status: "success", progress: 100 };
            return next;
          });
          completedCount++;
        } else {
          const text = await res.text();
          throw new Error(text || `Failed to upload ${bulkQueue[i].file.name}`);
        }
      } catch (err: any) {
        errorCount++;
        setBulkQueue(prev => {
          const next = [...prev];
          next[i] = { ...next[i], status: "error", error: err.message || "Upload failed" };
          return next;
        });
      }
    }

    setIsBulkUploading(false);
    setUploadSummary({
      total: totalPendingCount,
      completed: completedCount,
      errors: errorCount
    });

    // Auto-close if all uploads succeeded
    if (errorCount === 0 && completedCount > 0) {
      setTimeout(() => {
        onClose();
      }, 1200);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border-2 border-zinc-700/90 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-lg border ${
              entityMode === "location"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-amber-500/10 border-amber-500/30 text-amber-400"
            }`}>
              {entityMode === "location" ? (
                <MapPin className="w-4 h-4" />
              ) : (
                <UploadCloud className="w-4 h-4" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                {entityMode === "location"
                  ? "Library Bulk Upload & Location Reference Slots"
                  : "Library Bulk Upload & Character Reference Pack"}
              </h3>
              <p className="text-[11px] text-zinc-400">
                {entityMode === "location"
                  ? "Quickly populate location reference slots or batch upload assets to your library"
                  : "Quickly populate character reference slots or batch upload assets to your library"}
                {sceneName ? ` for "${sceneName}"` : ""}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors"
            disabled={isBulkUploading}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {/* Top Target Subject Section */}
          <div className="bg-zinc-950/90 p-4 rounded-xl border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                entityMode === "location" ? "text-emerald-400" : "text-amber-400"
              }`}>
                {entityMode === "location" ? (
                  <>
                    <MapPin className="w-3.5 h-3.5" />
                    Target Location / Environment Name
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3.5 h-3.5" />
                    Target Subject / Character Name
                  </>
                )}
              </label>

              {/* Context Mode Toggle */}
              <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => switchEntityMode("character")}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                    entityMode === "character"
                      ? "bg-indigo-950 text-indigo-300 border border-indigo-700/60 shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                  title="Switch to Character Reference Pack"
                >
                  <User className="w-3 h-3" />
                  Character
                </button>
                <button
                  type="button"
                  onClick={() => switchEntityMode("location")}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                    entityMode === "location"
                      ? "bg-emerald-950 text-emerald-300 border border-emerald-700/60 shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                  title="Switch to Location Reference Slots"
                >
                  <MapPin className="w-3 h-3" />
                  Location
                </button>
              </div>
            </div>

            <div className="max-w-md">
              <SubjectCombobox
                value={bulkSubject}
                onChange={handleSubjectChange}
                subjects={subjects}
                onRegisterSubject={onRegisterSubject}
                placeholder={
                  entityMode === "location"
                    ? "e.g. Living Room, Rooftop, Neon Alley, Cyber Cafe"
                    : "e.g. Jackie, John Doe, Cyberpunk Agent"
                }
                disabled={isBulkUploading}
              />
            </div>
          </div>

          {/* 4-Slot Reference Pack Panel */}
          <div className="bg-zinc-900/60 p-4 rounded-xl border border-zinc-800/90">
            <CharacterReferencePackGrid
              slots={packSlots}
              onUpdateSlot={handleUpdatePackSlot}
              onClearSlot={handleClearPackSlot}
              disabled={isBulkUploading}
              isLocationMode={entityMode === "location"}
            />
          </div>

          {/* General Bulk Upload Section */}
          <div className="bg-zinc-950/90 p-4 rounded-xl border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-400" />
                Additional Media & General Batch Dropzone
              </h4>
              <span className="text-[10px] text-zinc-500">
                For miscellaneous props, scenes, audio, and videos
              </span>
            </div>

            {/* Batch Defaults */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Default Semantic Type
                </label>
                <select
                  value={bulkAssetType}
                  onChange={(e) => setBulkAssetType(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-500 rounded-lg px-2.5 py-2 text-xs text-zinc-200 outline-none"
                  disabled={isBulkUploading}
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

              {bulkModifierConfig ? (
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Companion Modifier
                  </label>
                  <select
                    value={bulkModifier}
                    onChange={(e) => handleModifierChange(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-500 rounded-lg px-2.5 py-2 text-xs text-zinc-200 outline-none"
                    disabled={isBulkUploading}
                  >
                    <option value="">None (Standard)</option>
                    {bulkModifierConfig.modifiers.map((mod) => (
                      <option key={mod.id} value={mod.modifier}>
                        {mod.label} ({mod.modifier})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                    Companion Modifier
                  </label>
                  <div className="w-full bg-zinc-900/40 border border-zinc-850 rounded-lg px-2.5 py-2 text-xs text-zinc-500 cursor-not-allowed">
                    Only active for Headshot, Body & Scene Reference
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Default Prompt Description
              </label>
              <textarea
                value={bulkDescription}
                onChange={(e) => setBulkDescription(e.target.value)}
                placeholder={
                  entityMode === "location"
                    ? "Brief prompt description applied to batch files (e.g. scene reference, wide establishing angle, ambient daylight)..."
                    : "Brief prompt description applied to batch files (e.g. moody tavern lighting, 8k portrait, cinematic outfit)..."
                }
                rows={2}
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-zinc-200 outline-none resize-none placeholder-zinc-600"
                disabled={isBulkUploading}
              />
            </div>

            {/* General Dropzone */}
            <div
              className={`relative border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition-all ${
                bulkDragActive
                  ? "border-amber-500 bg-amber-500/10"
                  : "border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/70 hover:border-zinc-700"
              }`}
              onDragEnter={handleBulkDrag}
              onDragLeave={handleBulkDrag}
              onDragOver={handleBulkDrag}
              onDrop={handleBulkDrop}
            >
              <div className="relative z-10 flex flex-col items-center space-y-2.5">
                <div className="p-2.5 bg-zinc-800/80 rounded-full border border-zinc-700/60">
                  <UploadCloud className="w-5 h-5 text-zinc-400" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-zinc-200">
                    Drag and drop general batch files here
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    Images, audio files, and video clips
                  </p>
                </div>
                <div>
                  <label className="cursor-pointer inline-flex items-center justify-center px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 rounded-lg transition-colors border border-zinc-700 shadow-sm">
                    <span>Browse Files</span>
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleBulkFileSelect}
                      disabled={isBulkUploading}
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Bulk Queue List */}
            {bulkQueue.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 px-1">
                  <span>General Batch Queue ({bulkQueue.length} files)</span>
                  {bulkQueue.some((i) => i.status === "success") && (
                    <span className="text-emerald-400 text-[11px] font-semibold">
                      {bulkQueue.filter((i) => i.status === "success").length} Done
                    </span>
                  )}
                </div>
                <div className="divide-y divide-zinc-850 max-h-[160px] overflow-y-auto border border-zinc-800 rounded-xl bg-zinc-950">
                  {bulkQueue.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 text-xs">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {item.file.type.startsWith("image/") ? (
                          <ImageIcon className="w-4 h-4 text-amber-500 shrink-0" />
                        ) : item.file.type.startsWith("audio/") ? (
                          <Music className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <FileText className="w-4 h-4 text-zinc-500 shrink-0" />
                        )}
                        <div className="truncate min-w-0">
                          <p className="font-medium text-zinc-300 truncate">{item.file.name}</p>
                          <p className="text-[10px] text-zinc-500">{formatSize(item.file.size)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0 ml-3">
                        {item.status === "pending" && (
                          <button
                            onClick={() => removeQueueItem(idx)}
                            disabled={isBulkUploading}
                            className="text-zinc-500 hover:text-zinc-300 p-1"
                            title="Remove from queue"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {item.status === "uploading" && (
                          <div className="flex items-center gap-1.5 text-amber-400">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span className="text-[10px] font-semibold">{item.progress}%</span>
                          </div>
                        )}
                        {item.status === "success" && (
                          <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/80 font-semibold flex items-center gap-1">
                            <Check className="w-3 h-3" /> Done
                          </span>
                        )}
                        {item.status === "error" && (
                          <span
                            className="text-[10px] text-red-400 bg-red-950/80 px-2 py-0.5 rounded border border-red-800/80 font-semibold max-w-[140px] truncate"
                            title={item.error}
                          >
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
        </div>

        {/* Modal Footer / Action Bar */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/70 flex items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-zinc-400">
            {uploadSummary && uploadSummary.completed > 0 && (
              <span className="text-emerald-400 font-medium">
                Successfully uploaded {uploadSummary.completed} asset{uploadSummary.completed > 1 ? "s" : ""}!
              </span>
            )}
            {uploadSummary && uploadSummary.errors > 0 && (
              <span className="text-red-400 font-medium ml-2">
                ({uploadSummary.errors} failed)
              </span>
            )}
            {!uploadSummary && (
              <span>
                {populatedPackSlots.length} pack slot{populatedPackSlots.length === 1 ? "" : "s"} &bull; {bulkQueue.length} batch file{bulkQueue.length === 1 ? "" : "s"} ready
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
              disabled={isBulkUploading}
            >
              Cancel
            </button>
            <button
              onClick={runUnifiedUpload}
              disabled={isBulkUploading || totalPendingCount === 0}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:hover:bg-amber-500 text-zinc-950 text-xs font-bold rounded-lg shadow-md transition-all flex items-center gap-2"
            >
              {isBulkUploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Uploading Assets...
                </>
              ) : (
                <>
                  <UploadCloud className="w-3.5 h-3.5" />
                  Upload All ({totalPendingCount} item{totalPendingCount === 1 ? "" : "s"})
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
