import { SceneProjectFile, MediaAsset, CharacterProfile } from "../../types";
import { CascadeAssetRenameResult } from "./types";

/**
 * Cascades asset renaming across the entire project so all slots, quick slots,
 * and staging recipes seamlessly point to the new filename without broken links.
 */
export function cascadeAssetRename(
  project: SceneProjectFile,
  oldFilename: string,
  newFilename: string,
  updatedAssetData?: Partial<MediaAsset>
): CascadeAssetRenameResult {
  const oldTarget = (oldFilename || "").trim();
  const newTarget = (newFilename || "").trim();

  if (!oldTarget || !newTarget || oldTarget === newTarget) {
    if (updatedAssetData && oldTarget) {
      const nextAssets = (project.assets || []).map(a => 
        a.filename === oldTarget ? { ...a, ...updatedAssetData } : a
      );
      return {
        updatedProject: { ...project, assets: nextAssets },
        updatedShotSlotsCount: 0,
        updatedQuickSlotsCount: 0,
        updatedStagingRefsCount: 0
      };
    }
    return {
      updatedProject: project,
      updatedShotSlotsCount: 0,
      updatedQuickSlotsCount: 0,
      updatedStagingRefsCount: 0
    };
  }

  let updatedShotSlotsCount = 0;
  let updatedQuickSlotsCount = 0;
  let updatedStagingRefsCount = 0;

  // 1. Update Assets array
  const nextAssets = (project.assets || []).map(a => {
    if (a.filename === oldTarget) {
      return {
        ...a,
        ...updatedAssetData,
        filename: newTarget,
        original_name: a.original_name === oldTarget ? newTarget : a.original_name
      };
    }
    return a;
  });

  // 2. Update Shots: assigned_slots & staging_recipe
  const nextShots = (project.shots || []).map(shot => {
    let shotModified = false;
    const nextSlots: Record<number, string> = {};

    for (const [slotKey, val] of Object.entries(shot.assigned_slots || {})) {
      if (val === oldTarget) {
        nextSlots[Number(slotKey)] = newTarget;
        shotModified = true;
        updatedShotSlotsCount++;
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

      if (bg === oldTarget) {
        bg = newTarget;
        stagingModified = true;
        updatedStagingRefsCount++;
      }
      if (comp === oldTarget) {
        comp = newTarget;
        stagingModified = true;
        updatedStagingRefsCount++;
      }
      if (actors && actors.some(a => a.referenceAssetFilename === oldTarget || a.cutoutAssetFilename === oldTarget || a.maskAssetFilename === oldTarget)) {
        actors = actors.map(a => {
          let actorModified = false;
          let ref = a.referenceAssetFilename;
          let cut = a.cutoutAssetFilename;
          let msk = a.maskAssetFilename;
          if (ref === oldTarget) {
            ref = newTarget;
            actorModified = true;
            updatedStagingRefsCount++;
          }
          if (cut === oldTarget) {
            cut = newTarget;
            actorModified = true;
            updatedStagingRefsCount++;
          }
          if (msk === oldTarget) {
            msk = newTarget;
            actorModified = true;
            updatedStagingRefsCount++;
          }
          return actorModified ? { ...a, referenceAssetFilename: ref, cutoutAssetFilename: cut, maskAssetFilename: msk } : a;
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

  // 3. Update Characters: quick_slots, outfit refs, universe slots
  const nextCharacters: Record<string, CharacterProfile> = {};
  Object.entries(project.characters || {}).forEach(([key, profile]) => {
    let charModified = false;
    let nextQuickSlots = profile.quick_slots;

    if (Array.isArray(nextQuickSlots) && nextQuickSlots.includes(oldTarget)) {
      nextQuickSlots = nextQuickSlots.map(s => {
        if (s === oldTarget) {
          updatedQuickSlotsCount++;
          return newTarget;
        }
        return s;
      });
      charModified = true;
    }

    let nextSceneOutfit = profile.scene_outfit_ref;
    if (nextSceneOutfit === oldTarget) {
      nextSceneOutfit = newTarget;
      charModified = true;
    }

    let nextDefaultOutfit = profile.default_outfit_ref;
    if (nextDefaultOutfit === oldTarget) {
      nextDefaultOutfit = newTarget;
      charModified = true;
    }

    let nextUniverseSlots = profile.universe_slots;
    if (Array.isArray(nextUniverseSlots) && nextUniverseSlots.includes(oldTarget)) {
      nextUniverseSlots = nextUniverseSlots.map(s => s === oldTarget ? newTarget : s);
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

  // 4. Update Shared Assets
  const nextSharedAssets = (project.shared_assets || []).map(sa => {
    if (sa.filename === oldTarget) {
      return { ...sa, filename: newTarget };
    }
    return sa;
  });

  // 5. Update Project-level Staging Recipe
  let nextProjectStaging = project.staging_recipe;
  if (nextProjectStaging) {
    let stagingModified = false;
    let bg = nextProjectStaging.backgroundAssetFilename;
    let comp = nextProjectStaging.compositeAssetFilename;
    let actors = nextProjectStaging.actors;

    if (bg === oldTarget) {
      bg = newTarget;
      stagingModified = true;
    }
    if (comp === oldTarget) {
      comp = newTarget;
      stagingModified = true;
    }
    if (actors && actors.some(a => a.referenceAssetFilename === oldTarget || a.cutoutAssetFilename === oldTarget || a.maskAssetFilename === oldTarget)) {
      actors = actors.map(a => {
        let actorModified = false;
        let ref = a.referenceAssetFilename;
        let cut = a.cutoutAssetFilename;
        let msk = a.maskAssetFilename;
        if (ref === oldTarget) {
          ref = newTarget;
          actorModified = true;
          updatedStagingRefsCount++;
        }
        if (cut === oldTarget) {
          cut = newTarget;
          actorModified = true;
          updatedStagingRefsCount++;
        }
        if (msk === oldTarget) {
          msk = newTarget;
          actorModified = true;
          updatedStagingRefsCount++;
        }
        return actorModified ? { ...a, referenceAssetFilename: ref, cutoutAssetFilename: cut, maskAssetFilename: msk } : a;
      });
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

  return {
    updatedProject: {
      ...project,
      assets: nextAssets,
      shots: nextShots,
      characters: nextCharacters,
      staging_recipe: nextProjectStaging,
      shared_assets: nextSharedAssets
    },
    updatedShotSlotsCount,
    updatedQuickSlotsCount,
    updatedStagingRefsCount
  };
}
