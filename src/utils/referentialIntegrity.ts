import { 
  SceneProjectFile, 
  MediaAsset, 
  CharacterProfile, 
  ShotItem, 
  StagingLayerRecipe,
  StagedActorRecipeItem 
} from "../types";
import { findCanonicalSubject, toCanonicalSubjectName } from "./subjectUtils";

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

  // 1. Scan Shot Assigned Slots
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

    // Shot Staging Recipe
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
        if (actor.referenceAssetFilename === target) {
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
      if (actor.referenceAssetFilename === target) {
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
): {
  updatedProject: SceneProjectFile;
  clearedShotSlotsCount: number;
  clearedQuickSlotsCount: number;
  clearedStagingRefsCount: number;
} {
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

/**
 * Cascades asset renaming across the entire project so all slots, quick slots,
 * and staging recipes seamlessly point to the new filename without broken links.
 */
export function cascadeAssetRename(
  project: SceneProjectFile,
  oldFilename: string,
  newFilename: string,
  updatedAssetData?: Partial<MediaAsset>
): {
  updatedProject: SceneProjectFile;
  updatedShotSlotsCount: number;
  updatedQuickSlotsCount: number;
  updatedStagingRefsCount: number;
} {
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
      if (actors && actors.some(a => a.referenceAssetFilename === oldTarget)) {
        actors = actors.map(a => {
          if (a.referenceAssetFilename === oldTarget) {
            updatedStagingRefsCount++;
            return { ...a, referenceAssetFilename: newTarget };
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
    if (actors && actors.some(a => a.referenceAssetFilename === oldTarget)) {
      actors = actors.map(a => a.referenceAssetFilename === oldTarget ? { ...a, referenceAssetFilename: newTarget } : a);
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

/**
 * Cascades character renaming across all shot character tags, staging actors,
 * camera OTS targets, and asset subject tags.
 */
export function cascadeCharacterRename(
  project: SceneProjectFile,
  oldName: string,
  newName: string
): {
  updatedProject: SceneProjectFile;
  updatedShotsCount: number;
  updatedAssetsCount: number;
} {
  const oldCanonical = toCanonicalSubjectName(oldName) || (oldName || "").trim();
  const newCanonical = toCanonicalSubjectName(newName) || (newName || "").trim();

  if (!oldCanonical || !newCanonical || oldCanonical.toLowerCase() === newCanonical.toLowerCase()) {
    return {
      updatedProject: project,
      updatedShotsCount: 0,
      updatedAssetsCount: 0
    };
  }

  let updatedShotsCount = 0;
  let updatedAssetsCount = 0;
  const oldLower = oldCanonical.toLowerCase();

  // 1. Update Characters Map
  const nextCharacters: Record<string, CharacterProfile> = {};
  Object.entries(project.characters || {}).forEach(([key, profile]) => {
    if (key.toLowerCase() === oldLower || profile.name.toLowerCase() === oldLower) {
      nextCharacters[newCanonical] = {
        ...profile,
        name: newCanonical
      };
    } else {
      nextCharacters[key] = profile;
    }
  });

  // 2. Update Subjects List
  const nextSubjects = (project.subjects || []).map(s => {
    if (s.toLowerCase() === oldLower) return newCanonical;
    return s;
  });
  if (!nextSubjects.some(s => s.toLowerCase() === newCanonical.toLowerCase())) {
    nextSubjects.push(newCanonical);
  }

  // 3. Update Assets subject_name
  const nextAssets = (project.assets || []).map(a => {
    if ((a.subject_name || "").toLowerCase() === oldLower) {
      updatedAssetsCount++;
      return {
        ...a,
        subject_name: newCanonical
      };
    }
    return a;
  });

  // 4. Update Shots: character roster, OTS framing, staging actor names
  const nextShots = (project.shots || []).map(shot => {
    let shotModified = false;
    let nextChars = shot.characters;

    if (Array.isArray(nextChars) && nextChars.some(c => c.toLowerCase() === oldLower)) {
      nextChars = nextChars.map(c => c.toLowerCase() === oldLower ? newCanonical : c);
      shotModified = true;
    }

    let otsAnchor = shot.ots_anchor_subject;
    if (otsAnchor && otsAnchor.toLowerCase() === oldLower) {
      otsAnchor = newCanonical;
      shotModified = true;
    }

    let otsFocus = shot.ots_focus_subject;
    if (otsFocus && otsFocus.toLowerCase() === oldLower) {
      otsFocus = newCanonical;
      shotModified = true;
    }

    let nextStaging = shot.staging_recipe;
    if (nextStaging && Array.isArray(nextStaging.actors) && nextStaging.actors.some(a => a.characterName?.toLowerCase() === oldLower)) {
      nextStaging = {
        ...nextStaging,
        actors: nextStaging.actors.map(a => a.characterName?.toLowerCase() === oldLower ? { ...a, characterName: newCanonical } : a)
      };
      shotModified = true;
    }

    if (!shotModified) return shot;

    updatedShotsCount++;
    return {
      ...shot,
      characters: nextChars,
      ots_anchor_subject: otsAnchor,
      ots_focus_subject: otsFocus,
      staging_recipe: nextStaging,
      updated_at: new Date().toISOString()
    };
  });

  // 5. Update Scene Planning OTS
  let nextPlanning = project.scene_planning;
  if (nextPlanning) {
    let planModified = false;
    let otsAnchor = nextPlanning.ots_anchor_subject;
    let otsFocus = nextPlanning.ots_focus_subject;

    if (otsAnchor && otsAnchor.toLowerCase() === oldLower) {
      otsAnchor = newCanonical;
      planModified = true;
    }
    if (otsFocus && otsFocus.toLowerCase() === oldLower) {
      otsFocus = newCanonical;
      planModified = true;
    }

    if (planModified) {
      nextPlanning = {
        ...nextPlanning,
        ots_anchor_subject: otsAnchor,
        ots_focus_subject: otsFocus
      };
    }
  }

  return {
    updatedProject: {
      ...project,
      characters: nextCharacters,
      subjects: Array.from(new Set(nextSubjects)),
      assets: nextAssets,
      shots: nextShots,
      scene_planning: nextPlanning
    },
    updatedShotsCount,
    updatedAssetsCount
  };
}

/**
 * Self-healing sweep: Scans an entire project and cleans up any ghost assets
 * (references to files that do not exist in project.assets).
 */
export function sweepGhostReferences(project: SceneProjectFile): {
  cleanedProject: SceneProjectFile;
  ghostFilenamesSwept: string[];
  totalCleanedSlots: number;
} {
  const existingFilenames = new Set<string>();
  (project.assets || []).forEach(a => {
    if (a.filename) existingFilenames.add(a.filename);
  });

  const ghostFilenames = new Set<string>();
  let totalCleanedSlots = 0;

  // 1. Sweep Shot assigned_slots & staging_recipe
  const nextShots = (project.shots || []).map(shot => {
    let shotModified = false;
    const nextSlots: Record<number, string> = {};

    for (const [slotKey, val] of Object.entries(shot.assigned_slots || {})) {
      if (val && typeof val === "string") {
        if (existingFilenames.has(val)) {
          nextSlots[Number(slotKey)] = val;
        } else {
          ghostFilenames.add(val);
          totalCleanedSlots++;
          shotModified = true;
        }
      }
    }

    let nextStaging = shot.staging_recipe;
    if (nextStaging) {
      let stagingMod = false;
      let bg = nextStaging.backgroundAssetFilename;
      let comp = nextStaging.compositeAssetFilename;
      let actors = nextStaging.actors;

      if (bg && !existingFilenames.has(bg) && !bg.startsWith("http") && !bg.startsWith("data:")) {
        ghostFilenames.add(bg);
        bg = undefined;
        stagingMod = true;
      }
      if (comp && !existingFilenames.has(comp)) {
        ghostFilenames.add(comp);
        comp = undefined;
        stagingMod = true;
      }
      if (actors && actors.some(a => a.referenceAssetFilename && !existingFilenames.has(a.referenceAssetFilename))) {
        actors = actors.map(a => {
          if (a.referenceAssetFilename && !existingFilenames.has(a.referenceAssetFilename)) {
            ghostFilenames.add(a.referenceAssetFilename);
            return { ...a, referenceAssetFilename: undefined };
          }
          return a;
        });
        stagingMod = true;
      }

      if (stagingMod) {
        shotModified = true;
        nextStaging = { ...nextStaging, backgroundAssetFilename: bg, compositeAssetFilename: comp, actors };
      }
    }

    if (!shotModified) return shot;
    return {
      ...shot,
      assigned_slots: nextSlots,
      staging_recipe: nextStaging,
      updated_at: new Date().toISOString()
    };
  });

  // 2. Sweep Character quick_slots & outfit refs
  const nextCharacters: Record<string, CharacterProfile> = {};
  Object.entries(project.characters || {}).forEach(([key, profile]) => {
    let charMod = false;
    let nextQuickSlots = profile.quick_slots;

    if (Array.isArray(nextQuickSlots)) {
      const cleaned = nextQuickSlots.map(s => {
        if (s && !existingFilenames.has(s)) {
          ghostFilenames.add(s);
          charMod = true;
          return "";
        }
        return s;
      });
      if (charMod) nextQuickSlots = cleaned;
    }

    let nextSceneOutfit = profile.scene_outfit_ref;
    if (nextSceneOutfit && !existingFilenames.has(nextSceneOutfit) && /\.(png|jpe?g|webp|gif)$/i.test(nextSceneOutfit)) {
      ghostFilenames.add(nextSceneOutfit);
      nextSceneOutfit = "";
      charMod = true;
    }

    let nextDefaultOutfit = profile.default_outfit_ref;
    if (nextDefaultOutfit && !existingFilenames.has(nextDefaultOutfit) && /\.(png|jpe?g|webp|gif)$/i.test(nextDefaultOutfit)) {
      ghostFilenames.add(nextDefaultOutfit);
      nextDefaultOutfit = "";
      charMod = true;
    }

    if (charMod) {
      nextCharacters[key] = {
        ...profile,
        quick_slots: nextQuickSlots,
        scene_outfit_ref: nextSceneOutfit,
        default_outfit_ref: nextDefaultOutfit
      };
    } else {
      nextCharacters[key] = profile;
    }
  });

  // 3. Sweep Shared Assets
  const nextSharedAssets = (project.shared_assets || []).filter(sa => {
    if (sa.filename && !existingFilenames.has(sa.filename)) {
      ghostFilenames.add(sa.filename);
      return false;
    }
    return true;
  });

  return {
    cleanedProject: {
      ...project,
      shots: nextShots,
      characters: nextCharacters,
      shared_assets: nextSharedAssets
    },
    ghostFilenamesSwept: Array.from(ghostFilenames),
    totalCleanedSlots
  };
}
