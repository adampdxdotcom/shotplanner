import { SceneProjectFile } from "../../types";

/**
 * Detailed report on where an asset is referenced throughout a project.
 */
export interface AssetUsageSummary {
  filename: string;
  isUsed: boolean;
  totalReferences: number;
  shotSlots: Array<{ shotId: string; shotNumber: number; shotName?: string; slotIndex: number }>;
  characterQuickSlots: Array<{ characterName: string; slotIndex: number }>;
  outfitReferences: Array<{ characterName: string; type: "scene_outfit" | "default_outfit" }>;
  stagingUsages: Array<{ shotId?: string; shotNumber?: number; type: "background" | "actor" | "composite" }>;
  sharedAssetSlots: number[];
}

export interface CascadeAssetDeleteResult {
  updatedProject: SceneProjectFile;
  clearedShotSlotsCount: number;
  clearedQuickSlotsCount: number;
  clearedStagingRefsCount: number;
}

export interface CascadeAssetRenameResult {
  updatedProject: SceneProjectFile;
  updatedShotSlotsCount: number;
  updatedQuickSlotsCount: number;
  updatedStagingRefsCount: number;
}

export interface CascadeCharacterRenameResult {
  updatedProject: SceneProjectFile;
  updatedShotsCount: number;
  updatedAssetsCount: number;
}

export interface CascadeCharacterDeleteResult {
  updatedProject: SceneProjectFile;
  clearedShotsCount: number;
  clearedAssetsCount: number;
  clearedStagingActorsCount: number;
  clearedShotSlotsCount: number;
}

export interface SweepGhostReferencesResult {
  cleanedProject: SceneProjectFile;
  ghostFilenamesSwept: string[];
  totalCleanedSlots: number;
}
