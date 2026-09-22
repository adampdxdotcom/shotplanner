import { SceneProjectFile, CharacterProfile } from "../../types";
import { SweepGhostReferencesResult } from "./types";

/**
 * Self-healing sweep: Scans an entire project and cleans up any ghost assets
 * (references to files that do not exist in project.assets).
 */
export function sweepGhostReferences(project: SceneProjectFile): SweepGhostReferencesResult {
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
