import { SceneProjectFile, CharacterProfile } from "../../types";
import { CascadeAssetDeleteResult } from "./types";

/**
 * Cascades asset deletion across the entire scene project.
 * Completely cleanses any ghost reference to the deleted filename from:
 * - Assets array
 * - Shot assigned slots (all slots 0-14)
 * - Shot staging recipes (backgrounds, composites, actor cutout references)
 * - Character quick slots (1-4) and outfit references
 * - Project staging recipes & shared assets
 */
export function cascadeAssetDeletion(
  project: SceneProjectFile,
  filename: string
): CascadeAssetDeleteResult {
  const target = (filename || "").trim();
  if (!target) {
    return {
      updatedProject: project,
      clearedShotSlotsCount: 0,
      clearedQuickSlotsCount: 0,
      clearedStagingRefsCount: 0
    };
  }

  let clearedShotSlotsCount = 0;
  let clearedQuickSlotsCount = 0;
  let clearedStagingRefsCount = 0;

  // 1. Clean Assets array
  const nextAssets = (project.assets || []).filter(a => a.filename !== target);

  // 2. Clean Shots: assigned_slots & staging_recipe
  const nextShots = (project.shots || []).map(shot => {
    let shotModified = false;
    const nextSlots: Record<number, string> = {};

    for (const [slotKey, val] of Object.entries(shot.assigned_slots || {})) {
      if (val === target) {
        shotModified = true;
        clearedShotSlotsCount++;
      } else {
        nextSlots[Number(slotKey)] = val as string;
      }
    }

    let nextStagingRecipe = shot.staging_recipe;
    if (nextStagingRecipe) {
      let stagingModified = false;
      let bg = nextStagingRecipe.backgroundAssetFilename;
      let comp = nextStagingRecipe.compositeAssetFilename;
      let actors = nextStagingRecipe.actors;

      if (bg === target) {
        bg = undefined;
        stagingModified = true;
        clearedStagingRefsCount++;
      }
      if (comp === target) {
        comp = undefined;
        stagingModified = true;
        clearedStagingRefsCount++;
      }
      if (actors && actors.some(a => a.referenceAssetFilename === target)) {
        actors = actors.map(a => {
          if (a.referenceAssetFilename === target) {
            clearedStagingRefsCount++;
            return { ...a, referenceAssetFilename: undefined };
          }
          return a;
        });
        stagingModified = true;
      }

      if (stagingModified) {
        shotModified = true;
        nextStagingRecipe = {
          ...nextStagingRecipe,
          backgroundAssetFilename: bg,
          compositeAssetFilename: comp,
          actors
        };
      }
    }

    if (!shotModified) return shot;

    return {
      ...shot,
      assigned_slots: nextSlots,
      staging_recipe: nextStagingRecipe,
      updated_at: new Date().toISOString()
    };
  });

  // 3. Clean Characters: quick_slots, outfit refs, universe slots
  const nextCharacters: Record<string, CharacterProfile> = {};
  Object.entries(project.characters || {}).forEach(([key, profile]) => {
    let charModified = false;
    let nextQuickSlots = profile.quick_slots;

    if (Array.isArray(nextQuickSlots) && nextQuickSlots.includes(target)) {
      nextQuickSlots = nextQuickSlots.map(s => {
        if (s === target) {
          clearedQuickSlotsCount++;
          return "";
        }
        return s;
      });
      charModified = true;
    }

    let nextSceneOutfit = profile.scene_outfit_ref;
    if (nextSceneOutfit === target) {
      nextSceneOutfit = "";
      charModified = true;
    }

    let nextDefaultOutfit = profile.default_outfit_ref;
    if (nextDefaultOutfit === target) {
      nextDefaultOutfit = "";
      charModified = true;
    }

    let nextUniverseSlots = profile.universe_slots;
    if (Array.isArray(nextUniverseSlots) && nextUniverseSlots.includes(target)) {
      nextUniverseSlots = nextUniverseSlots.filter(s => s !== target);
      charModified = true;
    }

    if (charModified) {
      nextCharacters[key] = {
        ...profile,
        quick_slots: nextQuickSlots,
        scene_outfit_ref: nextSceneOutfit,
        default_outfit_ref: nextDefaultOutfit,
        universe_slots: nextUniverseSlots
      };
    } else {
      nextCharacters[key] = profile;
    }
  });

  // 4. Clean Project-level Staging Recipe
  let nextProjectStaging = project.staging_recipe;
  if (nextProjectStaging) {
    let stagingModified = false;
    let bg = nextProjectStaging.backgroundAssetFilename;
    let comp = nextProjectStaging.compositeAssetFilename;
    let actors = nextProjectStaging.actors;

    if (bg === target) {
      bg = undefined;
      stagingModified = true;
    }
    if (comp === target) {
      comp = undefined;
      stagingModified = true;
    }
    if (actors && actors.some(a => a.referenceAssetFilename === target)) {
      actors = actors.map(a => a.referenceAssetFilename === target ? { ...a, referenceAssetFilename: undefined } : a);
      stagingModified = true;
    }

    if (stagingModified) {
      nextProjectStaging = {
        ...nextProjectStaging,
        backgroundAssetFilename: bg,
        compositeAssetFilename: comp,
        actors
      };
    }
  }

  // 5. Clean Shared Assets
  const nextSharedAssets = (project.shared_assets || []).filter(sa => sa.filename !== target);

  return {
    updatedProject: {
      ...project,
      assets: nextAssets,
      shots: nextShots,
      characters: nextCharacters,
      staging_recipe: nextProjectStaging,
      shared_assets: nextSharedAssets
    },
    clearedShotSlotsCount,
    clearedQuickSlotsCount,
    clearedStagingRefsCount
  };
}
