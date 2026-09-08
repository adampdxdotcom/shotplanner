import { useState, useEffect, useCallback } from "react";
import { MediaAsset } from "../../../types";
import { toCanonicalSubjectName } from "../../../utils/subjectUtils";
import { isLocationEntity } from "../../../utils/locationUtils";
import {
  CharacterPackSlot,
  ReferencePackSlotId,
  INITIAL_PACK_SLOTS,
  INITIAL_LOCATION_PACK_SLOTS
} from "../CharacterReferencePackGrid";
import { revokeManagedBlobUrl, purgeManagedBlobUrls } from "../../../utils/blobRegistry";
import { BulkQueueItem, UploadSummary } from "./types";

interface UseBulkUploadStateProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSubject?: string;
  isLocation?: boolean;
  characters?: Record<string, any>;
  assets?: MediaAsset[];
  sceneName?: string;
  onAssetUploaded: (asset: MediaAsset) => void;
  onRegisterSubject: (name: string) => void;
}

export function useBulkUploadState({
  isOpen,
  onClose,
  defaultSubject,
  isLocation,
  characters,
  assets,
  sceneName,
  onAssetUploaded,
  onRegisterSubject
}: UseBulkUploadStateProps) {
  const [bulkSubject, setBulkSubject] = useState(defaultSubject || "");
  const [entityMode, setEntityMode] = useState<"character" | "location">("character");
  const [packSlots, setPackSlots] = useState<CharacterPackSlot[]>(INITIAL_PACK_SLOTS);
  const [bulkQueue, setBulkQueue] = useState<BulkQueueItem[]>([]);
  const [bulkDescription, setBulkDescription] = useState("");
  const [bulkAssetType, setBulkAssetType] = useState("Body Reference");
  const [bulkModifier, setBulkModifier] = useState("");
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [uploadSummary, setUploadSummary] = useState<UploadSummary | null>(null);

  // Switch entity mode between character and location
  const switchEntityMode = useCallback((mode: "character" | "location") => {
    setEntityMode(mode);
    packSlots.forEach(s => {
      if (s.previewUrl) revokeManagedBlobUrl(s.previewUrl);
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
  }, [packSlots, bulkDescription, bulkSubject]);

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
        if (s.previewUrl) revokeManagedBlobUrl(s.previewUrl);
      });
    }
  }, [isOpen, defaultSubject, isLocation]);

  // Ensure all active pack slot previews are revoked when the hook unmounts
  useEffect(() => {
    return () => {
      purgeManagedBlobUrls("character-pack");
    };
  }, []);

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

  // Handler for updating a single Reference Pack slot
  const handleUpdatePackSlot = (slotId: ReferencePackSlotId, updater: Partial<CharacterPackSlot>) => {
    setPackSlots(prev => prev.map(s => {
      if (s.id !== slotId) return s;
      if (updater.previewUrl !== undefined && s.previewUrl && s.previewUrl !== updater.previewUrl) {
        revokeManagedBlobUrl(s.previewUrl);
      }
      return { ...s, ...updater };
    }));
  };

  // Handler for clearing a single Reference Pack slot
  const handleClearPackSlot = (slotId: ReferencePackSlotId) => {
    setPackSlots(prev => prev.map(s => {
      if (s.id !== slotId) return s;
      if (s.previewUrl) revokeManagedBlobUrl(s.previewUrl);
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

  // General Queue Actions
  const handleFilesAdded = (files: File[]) => {
    setBulkQueue(prev => [...prev, ...files.map(f => ({ file: f, progress: 0, status: "pending" as const }))]);
  };

  const handleRemoveQueueItem = (idx: number) => {
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

    // 1. Upload Character/Location Pack Slots
    const packUploadPromises = packSlots.map(async (slot) => {
      if (!slot.file || slot.status === "success") return;

      handleUpdatePackSlot(slot.id, { status: "uploading", progress: 15, error: undefined });

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
    });

    // 2. Upload General Bulk Queue Items
    const queueUploadPromises = bulkQueue.map(async (item, i) => {
      if (item.status === "success") return;

      setBulkQueue(prev => {
        const next = [...prev];
        next[i] = { ...next[i], status: "uploading", progress: 15, error: undefined };
        return next;
      });

      const formData = new FormData();
      formData.append("file", item.file);
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
          throw new Error(text || `Failed to upload ${item.file.name}`);
        }
      } catch (err: any) {
        errorCount++;
        setBulkQueue(prev => {
          const next = [...prev];
          next[i] = { ...next[i], status: "error", error: err.message || "Upload failed" };
          return next;
        });
      }
    });

    await Promise.all([...packUploadPromises, ...queueUploadPromises]);

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

  return {
    bulkSubject,
    setBulkSubject,
    entityMode,
    switchEntityMode,
    packSlots,
    handleUpdatePackSlot,
    handleClearPackSlot,
    bulkQueue,
    handleFilesAdded,
    handleRemoveQueueItem,
    bulkDescription,
    setBulkDescription,
    bulkAssetType,
    setBulkAssetType,
    bulkModifier,
    setBulkModifier,
    isBulkUploading,
    uploadSummary,
    handleSubjectChange,
    populatedPackSlots,
    totalPendingCount,
    runUnifiedUpload
  };
}
