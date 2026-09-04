import React, { useEffect, useCallback } from 'react';
import { SceneProjectFile, ScenePlanning, CharacterProfile } from '../../types';
import { generateUUID } from '../../utils/formatters';
import { toCanonicalSubjectName, findCanonicalSubject, normalizeProjectCastAndAssets } from '../../utils/subjectUtils';

interface UseCastManagementParams {
  sceneProject: SceneProjectFile;
  setSceneProject: React.Dispatch<React.SetStateAction<SceneProjectFile>>;
  setScenePlanning: React.Dispatch<React.SetStateAction<ScenePlanning>>;
  setIsDirty: (isDirty: boolean) => void;
  addToast: (text: string, type?: "success" | "error" | "info") => void;
}

export function useCastManagement({
  sceneProject,
  setSceneProject,
  setScenePlanning,
  setIsDirty,
  addToast
}: UseCastManagementParams) {
  const assets = sceneProject?.assets || [];
  const subjects = sceneProject?.subjects || [];

  // Function to register subject in project registry with strict case-insensitive deduplication
  const handleRegisterSubject = useCallback((name: string) => {
    const rawTrimmed = (name || "").trim();
    if (!rawTrimmed) return "";

    // 1. Check existing subjects case-insensitively. If one exists, retain and reuse the existing canonical subject name.
    const existingCanonical = findCanonicalSubject(rawTrimmed, subjects);
    if (existingCanonical) {
      return existingCanonical;
    }

    // 2. Automatically normalize user-entered subject names to clean Title Case
    const canonicalName = toCanonicalSubjectName(rawTrimmed);
    if (!canonicalName) return "";

    // Double check with canonicalName
    const doubleCheck = findCanonicalSubject(canonicalName, subjects);
    if (doubleCheck) {
      return doubleCheck;
    }

    setSceneProject(prev => {
      const currentSubjects = prev.subjects || [];
      const matchInPrev = findCanonicalSubject(canonicalName, currentSubjects);
      if (matchInPrev) {
        return prev;
      }

      const nextSubjects = [...currentSubjects, canonicalName];
      const nextCharacters = { ...(prev.characters || {}) };

      // Find if character profile exists under another casing key
      const existingKey = Object.keys(nextCharacters).find(
        k => k.toLowerCase() === canonicalName.toLowerCase()
      );

      if (existingKey) {
        const existingProfile = nextCharacters[existingKey];
        if (existingKey !== canonicalName) {
          delete nextCharacters[existingKey];
        }
        nextCharacters[canonicalName] = {
          ...existingProfile,
          name: canonicalName
        };
      } else {
        nextCharacters[canonicalName] = {
          id: generateUUID(),
          name: canonicalName,
          notes: "",
          quick_slots: [],
          scene_outfit_ref: ""
        };
      }

      return { ...prev, subjects: nextSubjects, characters: nextCharacters };
    });
    setIsDirty(true);
    return canonicalName;
  }, [subjects, setSceneProject, setIsDirty]);

  const handleUpdateCharacter = useCallback((profile: any) => {
    if (!profile || !profile.name) return;
    // Resolve against canonical character name
    const rawName = String(profile.name).trim();
    const canonicalName = findCanonicalSubject(rawName, subjects) || toCanonicalSubjectName(rawName) || rawName;

    setSceneProject(prev => {
      const nextCharacters = { ...(prev.characters || {}) };
      // Remove any case variation keys
      Object.keys(nextCharacters).forEach(k => {
        if (k.toLowerCase() === canonicalName.toLowerCase() && k !== canonicalName) {
          delete nextCharacters[k];
        }
      });
      nextCharacters[canonicalName] = {
        ...profile,
        name: canonicalName
      };
      return {
        ...prev,
        characters: nextCharacters
      };
    });
    setIsDirty(true);
  }, [subjects, setSceneProject, setIsDirty]);

  // Sync and deduplicate subjects and characters when assets change
  useEffect(() => {
    if (assets.length > 0) {
      setSceneProject(prevProject => {
        const normalized = normalizeProjectCastAndAssets(prevProject);
        
        const prevSubjects = prevProject.subjects || [];
        const subjectsChanged = 
          normalized.subjects.length !== prevSubjects.length ||
          normalized.subjects.some((s, idx) => s !== prevSubjects[idx]);

        const prevCharKeys = Object.keys(prevProject.characters || {});
        const nextCharKeys = Object.keys(normalized.characters);
        const charactersChanged = 
          prevCharKeys.length !== nextCharKeys.length ||
          nextCharKeys.some(k => !prevProject.characters?.[k]);

        const assetsChanged = (prevProject.assets || []).some((a, idx) => {
          const normA = normalized.assets[idx];
          return normA && a.subject_name !== normA.subject_name;
        });

        if (!subjectsChanged && !charactersChanged && !assetsChanged) {
          return prevProject;
        }

        return {
          ...prevProject,
          subjects: normalized.subjects,
          characters: normalized.characters,
          assets: normalized.assets
        };
      });
    }
  }, [assets, setSceneProject]);

  const handleDeleteCharacter = useCallback((characterName: string) => {
    const trimmed = characterName.trim();
    if (!trimmed) return;
    const targetLower = trimmed.toLowerCase();

    setSceneProject(prevProject => {
      // 1. Identify all asset filenames associated with the deleted character
      const characterFilenames = new Set<string>();

      // Check quick slots & outfit ref from character profile
      const charEntries = Object.entries(prevProject.characters || {}) as [string, CharacterProfile][];
      const charProfile = charEntries.find(([name]) => name.toLowerCase() === targetLower)?.[1];
      if (charProfile) {
        (charProfile.quick_slots || []).forEach(fn => { if (fn) characterFilenames.add(fn); });
        if (charProfile.scene_outfit_ref && /\.(png|jpe?g|webp|gif|bmp|mp4|mov)$/i.test(charProfile.scene_outfit_ref)) {
          characterFilenames.add(charProfile.scene_outfit_ref);
        }
      }

      // Check assets matching character tag
      (prevProject.assets || []).forEach(a => {
        if ((a.subject_name || "").trim().toLowerCase() === targetLower) {
          if (a.filename) characterFilenames.add(a.filename);
        }
      });

      // 2. Remove character record from characters registry
      const nextCharacters: Record<string, CharacterProfile> = {};
      charEntries.forEach(([key, val]) => {
        if (key.toLowerCase() !== targetLower && val.name.toLowerCase() !== targetLower) {
          nextCharacters[key] = val;
        }
      });

      // 3. Remove character name from global subjects registry
      const nextSubjects = (prevProject.subjects || []).filter(
        s => s.toLowerCase() !== targetLower
      );

      // 4. Preserve media files while removing the character tag (reset subject_name to empty)
      const nextAssets = (prevProject.assets || []).map(a => {
        if ((a.subject_name || "").trim().toLowerCase() === targetLower) {
          return { ...a, subject_name: "" };
        }
        return a;
      });

      // 5. Surgical shot-level de-assignment across every shot in the project
      const nextShots = (prevProject.shots || []).map(shot => {
        // De-assign slot keys containing filenames belonging to the deleted character
        const nextAssignedSlots: Record<number, string> = {};
        for (const [slotKey, fn] of Object.entries(shot.assigned_slots || {})) {
          if (fn && !characterFilenames.has(fn as string)) {
            nextAssignedSlots[Number(slotKey)] = fn as string;
          }
        }

        // Clean OTS anchor/focus subjects if they match the deleted character
        let otsAnchor = shot.ots_anchor_subject;
        let otsFocus = shot.ots_focus_subject;
        if (otsAnchor && otsAnchor.trim().toLowerCase() === targetLower) {
          otsAnchor = "";
        }
        if (otsFocus && otsFocus.trim().toLowerCase() === targetLower) {
          otsFocus = "";
        }

        return {
          ...shot,
          assigned_slots: nextAssignedSlots,
          ots_anchor_subject: otsAnchor,
          ots_focus_subject: otsFocus
        };
      });

      return {
        ...prevProject,
        characters: nextCharacters,
        subjects: nextSubjects,
        assets: nextAssets,
        shots: nextShots
      };
    });

    // Clean OTS in scene planning if configured for this character
    setScenePlanning(prev => {
      let changed = false;
      let otsAnchor = prev.ots_anchor_subject;
      let otsFocus = prev.ots_focus_subject;
      if (otsAnchor && otsAnchor.trim().toLowerCase() === targetLower) {
        otsAnchor = "";
        changed = true;
      }
      if (otsFocus && otsFocus.trim().toLowerCase() === targetLower) {
        otsFocus = "";
        changed = true;
      }
      return changed ? { ...prev, ots_anchor_subject: otsAnchor, ots_focus_subject: otsFocus } : prev;
    });

    setIsDirty(true);
    addToast(`Character "${trimmed}" deleted. Media assets preserved in gallery.`, "info");
  }, [addToast, setSceneProject, setScenePlanning, setIsDirty]);

  return {
    assets,
    subjects,
    handleRegisterSubject,
    handleUpdateCharacter,
    handleDeleteCharacter
  };
}
