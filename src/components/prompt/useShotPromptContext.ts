import { useMemo } from "react";
import { 
  MediaAsset, 
  ScenePlanning, 
  SceneProjectFile, 
  ShotItem, 
  computePrePromptContext, 
  generatePromptPrefix 
} from "../../types";

export interface MissingCharacterPhotoInfo {
  name: string;
  hasPhotos: boolean;
  quickSlots: string[];
  charAssets: MediaAsset[];
}

export interface MissingPhotoAnalysis {
  assignedCount: number;
  shotCharacters: string[];
  charStatus: MissingCharacterPhotoInfo[];
  charactersWithoutPhotos: MissingCharacterPhotoInfo[];
  charactersWithPhotosUnassigned: MissingCharacterPhotoInfo[];
  isMissingAllReferences: boolean;
}

export interface UseShotPromptContextParams {
  activeShotId: string | null;
  sceneProject: SceneProjectFile;
  assets: MediaAsset[];
  basicStub: string;
  promptPrefix: string;
  planning?: ScenePlanning;
  onUpdateSpecificShot?: (id: string, updater: (prev: ShotItem) => ShotItem) => void;
  onShowToast?: (text: string, type: "success" | "error" | "info") => void;
}

/**
 * Custom hook calculating active shot context, slot-to-asset bindings,
 * missing reference photo checks, and dynamic prompt prefix calculations.
 */
export function useShotPromptContext({
  activeShotId,
  sceneProject,
  assets,
  basicStub,
  promptPrefix,
  planning,
  onUpdateSpecificShot,
  onShowToast
}: UseShotPromptContextParams) {
  const activeShot = activeShotId ? sceneProject.shots.find((s) => s.id === activeShotId) || null : null;
  const activeShotAssets = activeShot ? Object.values(activeShot.assigned_slots || {}).filter(Boolean) : [];
  
  const currentBasicStub = activeShot ? (activeShot.basic_stub ?? "") : basicStub;

  // Assets mapped to active shot slots with explicit slot index
  const relevantAssets = useMemo(() => {
    if (!activeShot) return assets;
    const slotEntries = Object.entries(activeShot.assigned_slots || {});
    if (slotEntries.length > 0) {
      const mapped: Array<MediaAsset & { slot_index?: number }> = [];
      slotEntries.forEach(([slotKey, filename]) => {
        if (!filename) return;
        const asset = assets.find((a) => a.filename === filename);
        if (asset) {
          const match = slotKey.match(/slot_(\d+)/);
          const numericKey = !isNaN(Number(slotKey)) ? parseInt(slotKey, 10) : null;
          const slotIdx = numericKey !== null 
            ? numericKey 
            : match 
            ? parseInt(match[1], 10) 
            : asset.slot_index;
          mapped.push({ ...asset, slot_index: slotIdx });
        }
      });
      (sceneProject.shared_assets || []).forEach((sa) => {
        if (!mapped.some((m) => m.filename === sa.filename)) {
          const asset = assets.find((a) => a.filename === sa.filename);
          if (asset) mapped.push({ ...asset, slot_index: sa.slot_index });
        }
      });
      if (mapped.length > 0) return mapped;
    }
    return assets.filter(
      (a) => activeShotAssets.includes(a.filename) || sceneProject.shared_assets?.some((sa) => sa.filename === a.filename)
    );
  }, [activeShot, assets, activeShotAssets, sceneProject.shared_assets]);

  // Unique associated assets sorted by slot index for thumbnail presentation
  const displayAssociatedAssets = useMemo(() => {
    const list = activeShot ? relevantAssets : assets;
    const seen = new Set<string>();
    const result: Array<MediaAsset & { slot_index?: number }> = [];
    list.forEach((item, idx) => {
      const slotNum = item.slot_index !== undefined ? item.slot_index : idx;
      const key = `${slotNum}_${item.filename}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push({ ...item, slot_index: slotNum });
      }
    });
    return result.sort((a, b) => (a.slot_index ?? 0) - (b.slot_index ?? 0));
  }, [activeShot, relevantAssets, assets]);

  // Analyze whether the active shot or its characters are missing reference photos
  const missingPhotoInfo: MissingPhotoAnalysis | null = useMemo(() => {
    if (!activeShot) return null;
    const assignedCount = relevantAssets.length;
    const shotCharacters = activeShot.characters || [];
    const allSceneChars = sceneProject.characters || {};

    const charStatus: MissingCharacterPhotoInfo[] = shotCharacters.map((charName) => {
      const profile = (allSceneChars as any)[charName] || 
        Object.entries(allSceneChars).find(([k]) => k.toLowerCase() === charName.toLowerCase())?.[1];
      const quickSlots = Array.isArray(profile?.quick_slots) ? profile.quick_slots.filter(Boolean) : [];
      const charAssets = assets.filter((a) => (a.subject_name || "").trim().toLowerCase() === charName.trim().toLowerCase());
      const hasPhotos = quickSlots.length > 0 || charAssets.length > 0;
      return {
        name: charName,
        hasPhotos,
        quickSlots,
        charAssets
      };
    });

    const charactersWithoutPhotos = charStatus.filter((c) => !c.hasPhotos);
    const charactersWithPhotosUnassigned = charStatus.filter((c) => c.hasPhotos && assignedCount === 0);

    return {
      assignedCount,
      shotCharacters,
      charStatus,
      charactersWithoutPhotos,
      charactersWithPhotosUnassigned,
      isMissingAllReferences: assignedCount === 0
    };
  }, [activeShot, relevantAssets, sceneProject.characters, assets]);

  // Auto-assign available reference photos for a character directly to active shot
  const handleAutoAssignCharacterPhotos = (charName: string) => {
    if (!activeShot || !onUpdateSpecificShot) return;
    const allSceneChars = sceneProject.characters || {};
    const profile = (allSceneChars as any)[charName] || 
      Object.entries(allSceneChars).find(([k]) => k.toLowerCase() === charName.toLowerCase())?.[1];
    
    let candidateFilenames: string[] = [];
    if (profile && Array.isArray(profile.quick_slots)) {
      candidateFilenames = profile.quick_slots.filter(Boolean);
    }
    if (candidateFilenames.length === 0) {
      candidateFilenames = assets
        .filter((a) => (a.subject_name || "").trim().toLowerCase() === charName.trim().toLowerCase())
        .map((a) => a.filename);
    }

    if (candidateFilenames.length === 0) {
      onShowToast?.(`No reference photos found for character "${charName}".`, "error");
      return;
    }

    onUpdateSpecificShot(activeShot.id, (prev) => {
      const nextSlots = { ...(prev.assigned_slots || {}) };
      let assigned = 0;
      for (const fn of candidateFilenames) {
        if (Object.values(nextSlots).includes(fn)) continue;
        let targetSlot = -1;
        for (let i = 0; i < 8; i++) {
          if (!nextSlots[i] && !nextSlots[`slot_${i}`]) {
            targetSlot = i;
            break;
          }
        }
        if (targetSlot !== -1) {
          nextSlots[targetSlot] = fn;
          assigned++;
        }
      }
      return {
        ...prev,
        assigned_slots: nextSlots,
        status: "unstaged"
      };
    });

    onShowToast?.(`Assigned reference photo(s) for ${charName} to Shot #${activeShot.shot_number}.`, "success");
  };

  const activeShotPrefix = activeShot 
    ? generatePromptPrefix({
        scene_name: sceneProject.scene_name || activeShot.shot_name,
        shot_number: activeShot.shot_number,
        shot_type: activeShot.shot_type,
        lens_focal_length: activeShot.lens_focal_length,
        camera_movement: activeShot.camera_movement,
        aspect_ratio: activeShot.aspect_ratio
      })
    : promptPrefix;

  const livePrePromptContext = useMemo(() => {
    return computePrePromptContext({
      sceneName: sceneProject.scene_name || activeShot?.shot_name || planning?.scene_name,
      shotNumber: activeShot?.shot_number ?? planning?.shot_number ?? 1,
      shotType: activeShot?.shot_type || planning?.shot_type,
      lensFocalLength: activeShot?.lens_focal_length || planning?.lens_focal_length,
      cameraMovement: activeShot?.camera_movement || planning?.camera_movement,
      aspectRatio: activeShot?.aspect_ratio || planning?.aspect_ratio,
      otsAnchorSubject: activeShot?.ots_anchor_subject || planning?.ots_anchor_subject,
      otsFocusSubject: activeShot?.ots_focus_subject || planning?.ots_focus_subject,
      otsSide: activeShot?.ots_side || planning?.ots_side,
      basicStub: currentBasicStub,
      assets: relevantAssets
    });
  }, [
    sceneProject.scene_name,
    activeShot?.shot_name,
    activeShot?.shot_number,
    activeShot?.shot_type,
    activeShot?.lens_focal_length,
    activeShot?.camera_movement,
    activeShot?.aspect_ratio,
    activeShot?.ots_anchor_subject,
    activeShot?.ots_focus_subject,
    activeShot?.ots_side,
    planning,
    currentBasicStub,
    relevantAssets
  ]);

  return {
    activeShot,
    activeShotAssets,
    currentBasicStub,
    relevantAssets,
    displayAssociatedAssets,
    missingPhotoInfo,
    handleAutoAssignCharacterPhotos,
    activeShotPrefix,
    livePrePromptContext
  };
}
