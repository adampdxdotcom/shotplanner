import { SceneProjectFile, CharacterProfile } from "../../types";
import { toCanonicalSubjectName } from "../subjectUtils";
import { CascadeCharacterRenameResult } from "./types";

/**
 * Cascades character renaming across all shot character tags, staging actors,
 * camera OTS targets, and asset subject tags.
 */
export function cascadeCharacterRename(
  project: SceneProjectFile,
  oldName: string,
  newName: string
): CascadeCharacterRenameResult {
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
