import { useState, useMemo } from "react";
import { MediaAsset, SceneProjectFile, ShotItem } from "../../types";
import { toCanonicalSubjectName } from "../../utils/subjectUtils";
import { MAX_IMAGES, MAX_VIDEOS, MAX_AUDIOS } from "./AssetTabBar";

interface UseAssetManagerSlotsParams {
  activeShot: ShotItem | null;
  activeShotId: string | null;
  assets: MediaAsset[];
  sceneProject: SceneProjectFile;
  subjects?: string[];
  onUpdateProject: (updater: (prev: SceneProjectFile) => SceneProjectFile) => void;
  onAssetUploaded: (asset: MediaAsset, slotIndex?: number, type?: string) => void;
}

export function useAssetManagerSlots({
  activeShot,
  activeShotId,
  assets,
  sceneProject,
  subjects = [],
  onUpdateProject,
  onAssetUploaded
}: UseAssetManagerSlotsParams) {
  const [draggingSlot, setDraggingSlot] = useState<{ type: string; localIdx: number; globalSlot: number } | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);

  const getGlobalSlotIndex = (type: "image" | "audio" | "video", localIndex: number) => {
    if (type === "image") return localIndex;
    if (type === "video") return MAX_IMAGES; // Slot 9: single video upload per shot
    return MAX_IMAGES + 3 + localIndex; // Audio slots: 12, 13, 14
  };

  const getAssetForGlobalSlot = (globalSlotStr: string): MediaAsset | null => {
    if (!activeShot || !activeShot.assigned_slots) return null;
    let filename = activeShot.assigned_slots[globalSlotStr] || (activeShot.assigned_slots as any)[Number(globalSlotStr)];
    if (!filename && globalSlotStr === "9") {
      filename = activeShot.assigned_slots[10] || (activeShot.assigned_slots as any)["10"] || 
                 activeShot.assigned_slots[11] || (activeShot.assigned_slots as any)["11"];
    }
    if (!filename) return null;
    return assets.find(a => a.filename === filename) || null;
  };

  const handleDropOnSlot = (targetType: "image" | "audio" | "video", targetIdx: number) => {
    setDragOverSlot(null);
    if (!draggingSlot || !activeShotId) return;

    // Enforce matching media types
    if (draggingSlot.type !== targetType) {
      setDraggingSlot(null);
      return;
    }

    const sourceGlobalSlot = draggingSlot.globalSlot;
    const targetGlobalSlot = getGlobalSlotIndex(targetType, targetIdx);

    if (sourceGlobalSlot === targetGlobalSlot) {
      setDraggingSlot(null);
      return;
    }

    onUpdateProject(prev => {
      const shots = [...prev.shots];
      const shotIdx = shots.findIndex(s => s.id === activeShotId);
      if (shotIdx === -1) return prev;

      const currentSlots = { ...shots[shotIdx].assigned_slots };
      const sourceFilename = currentSlots[sourceGlobalSlot] || (currentSlots as any)[String(sourceGlobalSlot)];
      const targetFilename = currentSlots[targetGlobalSlot] || (currentSlots as any)[String(targetGlobalSlot)];

      if (!sourceFilename) return prev;

      // Clean up source slot
      delete currentSlots[sourceGlobalSlot];
      delete (currentSlots as any)[String(sourceGlobalSlot)];

      // Move source to target slot
      currentSlots[targetGlobalSlot] = sourceFilename;

      // If target had an asset, place it back into source (swap)
      if (targetFilename) {
        currentSlots[sourceGlobalSlot] = targetFilename;
      } else {
        delete currentSlots[sourceGlobalSlot];
        delete (currentSlots as any)[String(sourceGlobalSlot)];
      }

      shots[shotIdx] = {
        ...shots[shotIdx],
        assigned_slots: currentSlots,
        status: "unstaged",
        updated_at: new Date().toISOString()
      };

      return { ...prev, shots };
    });

    setDraggingSlot(null);
  };

  const handleClearSlot = (type: "image" | "audio" | "video", idx: number) => {
    if (activeShotId) {
      const globalSlot = getGlobalSlotIndex(type, idx);
      onUpdateProject(prev => {
        const shots = [...prev.shots];
        const shotIdx = shots.findIndex(s => s.id === activeShotId);
        if (shotIdx !== -1) {
          const nextSlots = { ...shots[shotIdx].assigned_slots };
          delete nextSlots[globalSlot];
          delete nextSlots[String(globalSlot)];
          if (type === "video") {
            delete nextSlots[9];
            delete (nextSlots as any)["9"];
            delete nextSlots[10];
            delete (nextSlots as any)["10"];
            delete nextSlots[11];
            delete (nextSlots as any)["11"];
          }
          shots[shotIdx] = { ...shots[shotIdx], assigned_slots: nextSlots, status: "unstaged" };
        }
        return { ...prev, shots };
      });
    }
  };

  const handleAssetUploadedInternal = (asset: MediaAsset, slotIndex: number, type: string) => {
    const globalSlot = getGlobalSlotIndex(type as any, slotIndex);
    if (activeShotId) {
      onUpdateProject(prev => {
        const shots = [...prev.shots];
        const shotIdx = shots.findIndex(s => s.id === activeShotId);
        if (shotIdx !== -1) {
          const nextSlots = { ...shots[shotIdx].assigned_slots };
          if (type === "video") {
            // Enforce only 1 video upload per shot
            delete nextSlots[9];
            delete (nextSlots as any)["9"];
            delete nextSlots[10];
            delete (nextSlots as any)["10"];
            delete nextSlots[11];
            delete (nextSlots as any)["11"];
          }
          nextSlots[globalSlot] = asset.filename;
          shots[shotIdx] = { ...shots[shotIdx], assigned_slots: nextSlots, status: "unstaged" };
        }
        return { ...prev, shots };
      });
    }
    onAssetUploaded(asset, slotIndex, type);
  };

  const projectSubjects = useMemo(() => {
    const projectSubjectsMap = new Map<string, string>();
    [
      ...(sceneProject.subjects || []),
      ...(subjects || []),
      ...assets.map(a => a.subject_name).filter(Boolean),
      ...(activeShot?.ots_anchor_subject ? [activeShot.ots_anchor_subject] : []),
      ...(activeShot?.ots_focus_subject ? [activeShot.ots_focus_subject] : [])
    ].forEach(raw => {
      if (!raw) return;
      const canonical = toCanonicalSubjectName(String(raw));
      if (!canonical) return;
      const lower = canonical.toLowerCase();
      if (!projectSubjectsMap.has(lower)) {
        projectSubjectsMap.set(lower, canonical);
      }
    });
    return Array.from(projectSubjectsMap.values());
  }, [sceneProject.subjects, subjects, assets, activeShot?.ots_anchor_subject, activeShot?.ots_focus_subject]);

  return {
    draggingSlot,
    setDraggingSlot,
    dragOverSlot,
    setDragOverSlot,
    getGlobalSlotIndex,
    getAssetForGlobalSlot,
    handleDropOnSlot,
    handleClearSlot,
    handleAssetUploaded: handleAssetUploadedInternal,
    projectSubjects
  };
}
