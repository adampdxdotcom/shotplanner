import { SceneProjectFile, CharacterProfile } from "../../types";
import { toCanonicalSubjectName } from "../subjectUtils";
import { CascadeCharacterDeleteResult } from "./types";

/**
 * Cascades character deletion across the entire scene project.
 * Purges character references from:
 * - Characters registry
 * - Global subjects registry
 * - Local character-tagged assets
 * - Shot character rosters
 * - Shot assigned slots (de-assigning character asset filenames)
 * - Camera OTS targets (anchor & focus)
 * - Shot-level & project-level staging recipe actors
 */
export function cascadeCharacterDeletion(
  project: SceneProjectFile,
  characterName: string,
  options?: { removeTaggedAssets?: boolean }
): CascadeCharacterDeleteResult {
  const canonical = toCanonicalSubjectName(characterName) || (characterName || "").trim();
  if (!canonical) {
    return {
      updatedProject: project,
      clearedShotsCount: 0,
      clearedAssetsCount: 0,
      clearedStagingActorsCount: 0,
      clearedShotSlotsCount: 0
    };
  }

  const targetLower = canonical.toLowerCase();
  const removeAssets = options?.removeTaggedAssets ?? true;

  // 1. Identify all filenames associated with this character
  const characterFilenames = new Set<string>();
  const charEntries = Object.entries(project.characters || {});
  
  for (const [key, profile] of charEntries) {
    if (key.toLowerCase() === targetLower || (profile.name || "").toLowerCase() === targetLower) {
      (profile.quick_slots || []).forEach(fn => {
        if (fn && typeof fn === "string" && fn.trim()) characterFilenames.add(fn.trim());
      });
      if (profile.scene_outfit_ref && typeof profile.scene_outfit_ref === "string") {
        characterFilenames.add(profile.scene_outfit_ref.trim());
      }
      if (profile.default_outfit_ref && typeof profile.default_outfit_ref === "string") {
        characterFilenames.add(profile.default_outfit_ref.trim());
      }
      (profile.universe_slots || []).forEach(fn => {
        if (fn && typeof fn === "string" && fn.trim()) characterFilenames.add(fn.trim());
      });
    }
  }

  // Check assets matching character tag
  (project.assets || []).forEach(a => {
    if ((a.subject_name || "").trim().toLowerCase() === targetLower) {
      if (a.filename) characterFilenames.add(a.filename.trim());
    }
  });

  // 2. Remove character from characters registry
  const nextCharacters: Record<string, CharacterProfile> = {};
  for (const [key, val] of charEntries) {
    if (key.toLowerCase() !== targetLower && (val.name || "").toLowerCase() !== targetLower) {
      nextCharacters[key] = val;
    }
  }

  // 3. Remove character name from global subjects registry
  const nextSubjects = (project.subjects || []).filter(
    s => (s || "").trim().toLowerCase() !== targetLower
  );

  // 4. Update scene assets list
  let clearedAssetsCount = 0;
  const nextAssets = (project.assets || []).filter(a => {
    if (!removeAssets) return true;
    const isMatch = (a.subject_name || "").trim().toLowerCase() === targetLower;
    if (isMatch) clearedAssetsCount++;
    return !isMatch;
  });

  // 5. Cascade across all shots
  let clearedShotsCount = 0;
  let clearedShotSlotsCount = 0;
  let clearedStagingActorsCount = 0;

  const nextShots = (project.shots || []).map(shot => {
    let shotModified = false;

    // De-assign slot keys containing filenames belonging to the deleted character
    const nextAssignedSlots: Record<number, string> = {};
    for (const [slotKey, fn] of Object.entries(shot.assigned_slots || {})) {
      if (fn && typeof fn === "string") {
        if (characterFilenames.has(fn.trim())) {
          shotModified = true;
          clearedShotSlotsCount++;
        } else {
          nextAssignedSlots[Number(slotKey)] = fn;
        }
      }
    }

    // Clean character roster
    let nextChars = shot.characters;
    if (Array.isArray(nextChars) && nextChars.some(c => (c || "").trim().toLowerCase() === targetLower)) {
      nextChars = nextChars.filter(c => (c || "").trim().toLowerCase() !== targetLower);
      shotModified = true;
    }

    // Clean OTS framing
    let otsAnchor = shot.ots_anchor_subject;
    if (otsAnchor && otsAnchor.trim().toLowerCase() === targetLower) {
      otsAnchor = "";
      shotModified = true;
    }
    let otsFocus = shot.ots_focus_subject;
    if (otsFocus && otsFocus.trim().toLowerCase() === targetLower) {
      otsFocus = "";
      shotModified = true;
    }

    // Clean shot staging recipe actors
    let nextStaging = shot.staging_recipe;
    if (nextStaging && Array.isArray(nextStaging.actors)) {
      const initialActorCount = nextStaging.actors.length;
      const nextActors = nextStaging.actors.filter(
        a => (a.characterName || "").trim().toLowerCase() !== targetLower
      );
      if (nextActors.length !== initialActorCount) {
        clearedStagingActorsCount += (initialActorCount - nextActors.length);
        nextStaging = { ...nextStaging, actors: nextActors };
        shotModified = true;
      }
    }

    if (!shotModified) return shot;

    clearedShotsCount++;
    return {
      ...shot,
      assigned_slots: nextAssignedSlots,
      characters: nextChars,
      ots_anchor_subject: otsAnchor,
      ots_focus_subject: otsFocus,
      staging_recipe: nextStaging,
      updated_at: new Date().toISOString()
    };
  });

  // 6. Clean project-level staging recipe actors
  let nextProjectStaging = project.staging_recipe;
  if (nextProjectStaging && Array.isArray(nextProjectStaging.actors)) {
    const initialActorCount = nextProjectStaging.actors.length;
    const nextActors = nextProjectStaging.actors.filter(
      a => (a.characterName || "").trim().toLowerCase() !== targetLower
    );
    if (nextActors.length !== initialActorCount) {
      clearedStagingActorsCount += (initialActorCount - nextActors.length);
      nextProjectStaging = { ...nextProjectStaging, actors: nextActors };
    }
  }

  return {
    updatedProject: {
      ...project,
      characters: nextCharacters,
      subjects: nextSubjects,
      assets: nextAssets,
      shots: nextShots,
      staging_recipe: nextProjectStaging
    },
    clearedShotsCount,
    clearedAssetsCount,
    clearedStagingActorsCount,
    clearedShotSlotsCount
  };
}
