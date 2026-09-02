import { useState } from "react";
import { MediaAsset, ShotItem, SceneProjectFile, StagingLayerRecipe } from "../types";
import { StagedActorCanvasItem } from "../components/cast/StagingInteractiveCanvas";
import { getAssetMediaUrl } from "../utils/assetUrl";
import { sanitizeSlug } from "../types";
import { renderCompositeToBlob } from "../utils/compositeCanvasExport";
import { StagedActor } from "../components/cast/AiReferenceStagingStudioModal";

export interface UseCompositeExporterProps {
  stagedActors: StagedActor[];
  customBackgroundUrl?: string;
  activeLocationAsset?: MediaAsset;
  viewportRatio: string;
  compositeRefName: string;
  defaultEnvironmentName: string;
  activeScene: string;
  assignToShotSlot: boolean;
  targetSlotIndex: number;
  cameraFraming: string;
  selectedAtmosphere: string;
  onAssetSaved?: (asset: MediaAsset) => void;
  onUpdateShot?: (updater: (prev: ShotItem) => ShotItem) => void;
  addToast?: (msg: string, type: "success" | "error" | "info") => void;
}

export function useCompositeExporter({
  stagedActors,
  customBackgroundUrl,
  activeLocationAsset,
  viewportRatio,
  compositeRefName,
  defaultEnvironmentName,
  activeScene,
  assignToShotSlot,
  targetSlotIndex,
  cameraFraming,
  selectedAtmosphere,
  onAssetSaved,
  onUpdateShot,
  addToast
}: UseCompositeExporterProps) {
  const [isExportingComposite, setIsExportingComposite] = useState(false);

  const handleSaveCompositeReference = async () => {
    try {
      setIsExportingComposite(true);

      const effectiveBgUrl = customBackgroundUrl || (activeLocationAsset ? getAssetMediaUrl(activeLocationAsset.filename, true) : undefined);

      const exportActors = stagedActors.map(actor => ({
        id: actor.id,
        characterName: actor.characterName,
        cutoutDataUrl: actor.cutoutDataUrl,
        originalCutoutDataUrl: actor.originalCutoutDataUrl,
        maskDataUrl: actor.maskDataUrl,
        fallbackUrl: actor.referenceAssetFilename ? getAssetMediaUrl(actor.referenceAssetFilename, true) : undefined,
        xPercent: actor.xPercent,
        yPercent: actor.yPercent,
        scale: actor.scale,
        isFlipped: actor.isFlipped,
        zIndex: actor.zIndex
      }));

      // Flatten composite canvas to high-res Blob
      const blob = await renderCompositeToBlob({
        backgroundUrl: effectiveBgUrl,
        actors: exportActors,
        aspectRatio: viewportRatio
      });

      const effectiveRefName = (compositeRefName && compositeRefName.trim()) || defaultEnvironmentName || "Location Reference";
      const cleanRefName = sanitizeSlug(effectiveRefName) || "location_ref";
      const timeStamp = Math.floor(Date.now() / 1000);
      const filename = `scene_reference_${cleanRefName}_${timeStamp}.png`;

      const formData = new FormData();
      formData.append("file", blob, filename);
      formData.append("type", "Scene Reference");
      formData.append("subject_name", effectiveRefName);
      formData.append("scene_name", activeScene);
      formData.append("description", "");
      formData.append("tags", JSON.stringify(["Scene Reference", "Composite Staging", "Director Staging", viewportRatio]));
      
      if (assignToShotSlot) {
        formData.append("slot_index", String(targetSlotIndex));
      }

      // Upload flattened composite to backend asset endpoint
      const res = await fetch("/api/assets/upload", {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        throw new Error(`Upload failed with status ${res.status}`);
      }

      const data = await res.json();
      if (!data.success || !data.asset) {
        throw new Error(data.error || "Server failed to return created composite asset.");
      }

      const newAsset: MediaAsset = data.asset;

      // Register new composite asset into project asset list and gallery
      if (onAssetSaved) {
        onAssetSaved(newAsset);
      }

      // Save composite layer recipe metadata
      const recipe: StagingLayerRecipe = {
        backgroundAssetFilename: activeLocationAsset?.filename,
        backgroundUrl: customBackgroundUrl,
        actors: stagedActors.map(a => ({
          id: a.id,
          characterName: a.characterName,
          cutoutDataUrl: a.cutoutDataUrl,
          originalCutoutDataUrl: a.originalCutoutDataUrl,
          maskDataUrl: a.maskDataUrl,
          referenceAssetFilename: a.referenceAssetFilename,
          xPercent: a.xPercent,
          yPercent: a.yPercent,
          scale: a.scale,
          isFlipped: a.isFlipped,
          zIndex: a.zIndex,
          plane: a.plane,
          posture: a.posture,
          facing: a.facing
        })),
        aspectRatio: viewportRatio,
        cameraFraming: cameraFraming,
        lightingAtmosphere: selectedAtmosphere,
        compositeAssetFilename: newAsset.filename,
        targetSlotIndex: assignToShotSlot ? targetSlotIndex : undefined,
        updatedAt: new Date().toISOString()
      };

      // Assign to target reference slot on the active shot ONLY IF assignToShotSlot is true
      if (assignToShotSlot && onUpdateShot) {
        onUpdateShot(prev => {
          const nextSlots = { ...(prev.assigned_slots || {}) };
          nextSlots[targetSlotIndex] = newAsset.filename;

          return {
            ...prev,
            assigned_slots: nextSlots,
            staging_recipe: recipe,
            status: "unstaged",
            updated_at: new Date().toISOString()
          };
        });
      }

      if (addToast) {
        addToast("Successfully saved composite staging reference.", "success");
      }
    } catch (err: any) {
      if (addToast) {
        addToast(err.message || "Failed to save composite", "error");
      }
      console.error("Composite export error", err);
    } finally {
      setIsExportingComposite(false);
    }
  };

  return {
    isExportingComposite,
    handleSaveCompositeReference
  };
}
