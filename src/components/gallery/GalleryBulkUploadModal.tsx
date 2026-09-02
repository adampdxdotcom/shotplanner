import React, { useState, useEffect, useMemo } from "react";
import { X, UploadCloud, FileText, Music, Image as ImageIcon, Loader2, Check, UserPlus, SlidersHorizontal, AlertCircle } from "lucide-react";
import { formatSize } from "../../utils/formatters";
import { MediaAsset } from "../../types";
import { toCanonicalSubjectName } from "../../utils/subjectUtils";
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
  CharacterPackSlotId,
  INITIAL_PACK_SLOTS
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
  sceneName?: string;
  onAssetUploaded: (asset: MediaAsset) => void;
  onRegisterSubject: (name: string) => void;
}

export const GalleryBulkUploadModal: React.FC<GalleryBulkUploadModalProps> = ({
  isOpen,
  onClose,
  subjects,
  defaultSubject,
  sceneName,
  onAssetUploaded,
  onRegisterSubject
}) => {
  // Target Subject
  const [bulkSubject, setBulkSubject] = useState(defaultSubject || "");

  // 4-Slot Character Reference Pack
  const [packSlots, setPackSlots] = useState<CharacterPackSlot[]>(INITIAL_PACK_SLOTS);

  // General Bulk Upload Queue & Options
  const [bulkQueue, setBulkQueue] = useState<BulkQueueItem[]>([]);
  const [bulkDescription, setBulkDescription] = useState("");
  const [bulkAssetType, setBulkAssetType] = useState(defaultSubject ? "Body Reference" : "Scene Reference");
  const [bulkModifier, setBulkModifier] = useState("");
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [bulkDragActive, setBulkDragActive] = useState(false);
  const [uploadSummary, setUploadSummary] = useState<{ total: number; completed: number; errors: number } | null>(null);

  // Reset/Initialize state when modal opens or defaultSubject changes
  useEffect(() => {
    if (isOpen) {
      const initialSubj = defaultSubject || "";
      setBulkSubject(initialSubj);
      setBulkAssetType(initialSubj ? "Body Reference" : "Scene Reference");
      setBulkModifier("");
      setBulkDescription("");
      setUploadSummary(null);
      setBulkQueue([]);
      // Reset pack slots
      setPackSlots(INITIAL_PACK_SLOTS.map(s => ({
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
  }, [isOpen, defaultSubject]);

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

  // Handler for updating a single Character Pack slot
  const handleUpdatePackSlot = (slotId: CharacterPackSlotId, updater: Partial<CharacterPackSlot>) => {
    setPackSlots(prev => prev.map(s => {
      if (s.id !== slotId) return s;
      // Revoke previous preview URL if changing previewUrl
      if (updater.previewUrl !== undefined && s.previewUrl && s.previewUrl !== updater.previewUrl) {
        URL.revokeObjectURL(s.previewUrl);
      }
      return { ...s, ...updater };
    }));
  };

  // Handler for clearing a single Character Pack slot
  const handleClearPackSlot = (slotId: CharacterPackSlotId) => {
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

      const formData = new FormData();
      formData.append("file", slot.file);
      if (sceneName) {
        formData.append("scene_name", sceneName);
      }
      formData.append("subject_name", canonicalSubject);
      formData.append("type", slot.assetType);
      formData.append("description", slot.description.trim());

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
            <div className="p-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <UploadCloud className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                Library Bulk Upload & Character Reference Pack
              </h3>
              <p className="text-[11px] text-zinc-400">
                Quickly populate character reference slots or batch upload assets to your library
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
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5" />
                Target Subject / Character Name
              </label>
              <span className="text-[10px] text-zinc-500">
                Applied to Character Pack slots and batch items
              </span>
            </div>
            <div className="max-w-md">
              <SubjectCombobox
                value={bulkSubject}
                onChange={(val) => setBulkSubject(val)}
                subjects={subjects}
                onRegisterSubject={onRegisterSubject}
                placeholder="e.g. Jackie, John Doe, Cyberpunk Agent"
                disabled={isBulkUploading}
              />
            </div>
          </div>

          {/* 4-Slot Character Reference Pack Panel */}
          <div className="bg-zinc-900/60 p-4 rounded-xl border border-zinc-800/90">
            <CharacterReferencePackGrid
              slots={packSlots}
              onUpdateSlot={handleUpdatePackSlot}
              onClearSlot={handleClearPackSlot}
              disabled={isBulkUploading}
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
                    Only active for Headshot & Body Reference
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
                placeholder="Brief prompt description applied to batch files (e.g. moody tavern lighting, wide establishing angle)..."
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
