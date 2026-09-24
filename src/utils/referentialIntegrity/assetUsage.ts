import { SceneProjectFile } from "../../types";
import { AssetUsageSummary } from "./types";

/**
 * Computes a complete usage breakdown for a given asset filename across all shots, characters, and staging layers.
 */
export function getAssetUsageSummary(
  project: SceneProjectFile,
  filename: string
): AssetUsageSummary {
  const target = (filename || "").trim();
  const summary: AssetUsageSummary = {
    filename: target,
    isUsed: false,
    totalReferences: 0,
    shotSlots: [],
    characterQuickSlots: [],
    outfitReferences: [],
    stagingUsages: [],
    sharedAssetSlots: []
  };

  if (!target) return summary;

  // 1. Scan Shot Assigned Slots & Shot Staging Recipes
  (project.shots || []).forEach(shot => {
    const slots = shot.assigned_slots || {};
    for (const [slotKey, val] of Object.entries(slots)) {
      if (val === target) {
        summary.shotSlots.push({
          shotId: shot.id,
          shotNumber: shot.shot_number,
          shotName: shot.shot_name,
          slotIndex: Number(slotKey)
        });
      }
    }

    if (shot.staging_recipe) {
      if (shot.staging_recipe.backgroundAssetFilename === target) {
        summary.stagingUsages.push({
          shotId: shot.id,
          shotNumber: shot.shot_number,
          type: "background"
        });
      }
      if (shot.staging_recipe.compositeAssetFilename === target) {
        summary.stagingUsages.push({
          shotId: shot.id,
          shotNumber: shot.shot_number,
          type: "composite"
        });
      }
      (shot.staging_recipe.actors || []).forEach(actor => {
        if (actor.referenceAssetFilename === target || actor.cutoutAssetFilename === target || actor.maskAssetFilename === target) {
          summary.stagingUsages.push({
            shotId: shot.id,
            shotNumber: shot.shot_number,
            type: "actor"
          });
        }
      });
    }
  });

  // 2. Scan Character Quick Slots & Outfits
  Object.entries(project.characters || {}).forEach(([charName, profile]) => {
    (profile.quick_slots || []).forEach((slotFn, idx) => {
      if (slotFn === target) {
        summary.characterQuickSlots.push({
          characterName: profile.name || charName,
          slotIndex: idx + 1
        });
      }
    });

    if (profile.scene_outfit_ref === target) {
      summary.outfitReferences.push({
        characterName: profile.name || charName,
        type: "scene_outfit"
      });
    }
    if (profile.default_outfit_ref === target) {
      summary.outfitReferences.push({
        characterName: profile.name || charName,
        type: "default_outfit"
      });
    }
  });

  // 3. Scan Project Staging Recipe
  if (project.staging_recipe) {
    if (project.staging_recipe.backgroundAssetFilename === target) {
      summary.stagingUsages.push({ type: "background" });
    }
    if (project.staging_recipe.compositeAssetFilename === target) {
      summary.stagingUsages.push({ type: "composite" });
    }
    (project.staging_recipe.actors || []).forEach(actor => {
      if (actor.referenceAssetFilename === target || actor.cutoutAssetFilename === target || actor.maskAssetFilename === target) {
        summary.stagingUsages.push({ type: "actor" });
      }
    });
  }

  // 4. Scan Shared Assets
  (project.shared_assets || []).forEach(sa => {
    if (sa.filename === target) {
      summary.sharedAssetSlots.push(sa.slot_index);
    }
  });

  summary.totalReferences = 
    summary.shotSlots.length + 
    summary.characterQuickSlots.length + 
    summary.outfitReferences.length + 
    summary.stagingUsages.length + 
    summary.sharedAssetSlots.length;

  summary.isUsed = summary.totalReferences > 0;
  return summary;
}
