import { useState, useCallback } from "react";
import { 
  SceneProjectFile, 
  ShotItem, 
  CharacterProfile, 
  ScenePlanningDetails, 
  MediaAsset, 
  AppConfig, 
  LLMProvider,
  PromptVariation
} from "../../types";
import { 
  AssistantAction, 
  validateActionSafety 
} from "../../types/assistantActions";
import { toCanonicalSubjectName, findCanonicalSubject } from "../../utils/subjectUtils";
import { generateUUID } from "../../utils/formatters";
import { apiClient, llmApi } from "../../api";

export interface StagingProgressState {
  status: "idle" | "staging" | "success" | "error";
  progress: number;
  message?: string;
}

export interface ExpandingProgressState {
  status: "idle" | "expanding" | "success" | "error";
  message?: string;
}

export interface UseAssistantActionsParams {
  sceneProject: SceneProjectFile;
  config?: AppConfig;
  assets?: MediaAsset[];
  lmStudioUrl?: string;
  effectiveDefault: LLMProvider;
  geminiApiKey?: string;
  onUpdateProject?: React.Dispatch<React.SetStateAction<SceneProjectFile>>;
  onShowToast?: (text: string, type?: "success" | "error" | "info") => void;
  onStageShot?: (shot: ShotItem) => Promise<boolean>;
  onExpandPrompt?: (shot: ShotItem) => Promise<string>;
  onSelectShot?: (shotId: string) => void;
  injectStateFeedback: (feedbackText: string) => void;
}

/**
 * Helper to update a shot's prompt and append a new PromptVariation to prompt_variations.
 * If prompt_variations is empty, baselines current prompt as "Variation 1 (Original)" first.
 */
export function applyPromptVariationToShot(
  shot: ShotItem,
  newExpandedPrompt: string,
  newStub?: string,
  labelSuffix: string = "Assistant Expansion"
): ShotItem {
  const currentVariations = [...(shot.prompt_variations || [])];

  // Baseline original prompt as Variation 1 if no variations exist yet but shot has an existing prompt/stub
  if (currentVariations.length === 0 && (shot.expanded_prompt || shot.basic_stub)) {
    const baselineVariation: PromptVariation = {
      id: "var_1_" + Date.now().toString(36),
      variation_number: 1,
      created_at: shot.updated_at || new Date().toISOString(),
      basic_stub: shot.basic_stub,
      expanded_prompt: shot.expanded_prompt || "",
      label: "Variation 1 (Original)"
    };
    currentVariations.push(baselineVariation);
  }

  const nextVarNum = currentVariations.length + 1;
  const effectiveStub = newStub !== undefined ? newStub : shot.basic_stub;

  const newVariation: PromptVariation = {
    id: "var_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
    variation_number: nextVarNum,
    created_at: new Date().toISOString(),
    basic_stub: effectiveStub,
    expanded_prompt: newExpandedPrompt,
    label: `Variation ${nextVarNum} (${labelSuffix})`
  };

  const updatedVariations = [...currentVariations, newVariation];

  return {
    ...shot,
    basic_stub: effectiveStub,
    expanded_prompt: newExpandedPrompt,
    prompt_variations: updatedVariations,
    active_variation_id: newVariation.id,
    status: "unstaged",
    updated_at: new Date().toISOString()
  };
}

/**
 * Custom hook managing execution, undo history, progress state,
 * and dismissal of AI Assistant proposed actions.
 */
export function useAssistantActions({
  sceneProject,
  config,
  assets = [],
  lmStudioUrl,
  effectiveDefault,
  geminiApiKey,
  onUpdateProject,
  onShowToast,
  onStageShot,
  onExpandPrompt,
  onSelectShot,
  injectStateFeedback
}: UseAssistantActionsParams) {
  // Track applied and dismissed action keys
  const [appliedActionKeys, setAppliedActionKeys] = useState<Record<string, boolean>>({});
  const [dismissedActionKeys, setDismissedActionKeys] = useState<Record<string, boolean>>({});

  // Snapshots for undo capability across all action types
  const [undoShotSnapshots, setUndoShotSnapshots] = useState<Record<string, ShotItem>>({});
  const [undoPlanningSnapshots, setUndoPlanningSnapshots] = useState<Record<string, ScenePlanningDetails | undefined>>({});
  const [undoCharSnapshots, setUndoCharSnapshots] = useState<Record<string, { key: string; profile?: CharacterProfile; wasNew?: boolean }>>({});

  // Real-time progress trackers for staging & prompt expansion
  const [stagingProgressMap, setStagingProgressMap] = useState<Record<string, StagingProgressState>>({});
  const [expandingProgressMap, setExpandingProgressMap] = useState<Record<string, ExpandingProgressState>>({});

  const handleApplyAction = useCallback(async (action: AssistantAction, actionKey: string) => {
    // Un-dismiss if previously dismissed
    setDismissedActionKeys((prev) => {
      if (!prev[actionKey]) return prev;
      const next = { ...prev };
      delete next[actionKey];
      return next;
    });

    if (action.type === "update_shot") {
      if (!onUpdateProject) {
        onShowToast?.("Project update handler is not available.", "error");
        return;
      }
      const shotNumber = typeof action.shot_number === "string" ? parseInt(action.shot_number, 10) : action.shot_number;
      const targetIndex = sceneProject.shots.findIndex((s) => s.shot_number === shotNumber);

      if (targetIndex === -1) {
        onShowToast?.(`Shot #${shotNumber} was not found in active scene.`, "error");
        return;
      }

      const existingShot = sceneProject.shots[targetIndex];
      // Save snapshot for undo
      setUndoShotSnapshots((prev) => ({ ...prev, [actionKey]: { ...existingShot } }));

      let totalLinkedPhotos = 0;
      const linkedChars: string[] = [];
      const missingPhotoChars: string[] = [];

      onUpdateProject((prev) => {
        const shots = [...prev.shots];
        const idx = shots.findIndex((s) => s.shot_number === shotNumber);
        if (idx !== -1) {
          const current = shots[idx];
          const changes = action.changes || {};
          const mergedCharacters = changes.characters || current.characters || [];
          
          // Auto-link up-to-4 Cast Card reference photos for all featured characters
          const updatedSlots = { ...(current.assigned_slots || {}) };
          const allSceneChars = sceneProject.characters || {};

          mergedCharacters.forEach((charName: string) => {
            const profile = (allSceneChars as any)[charName] || 
              Object.entries(allSceneChars).find(([k]) => k.toLowerCase() === charName.toLowerCase())?.[1];
            
            let candidatePhotos: string[] = [];
            if (profile && Array.isArray(profile.quick_slots)) {
              candidatePhotos = profile.quick_slots.filter(Boolean);
            }
            if (candidatePhotos.length === 0) {
              candidatePhotos = assets
                .filter((a) => (a.subject_name || (a as any).character_name || "").trim().toLowerCase() === charName.trim().toLowerCase())
                .slice(0, 4)
                .map((a) => a.filename);
            }

            if (candidatePhotos.length === 0) {
              missingPhotoChars.push(charName);
            } else {
              let linkedForThisChar = 0;
              candidatePhotos.forEach((fn) => {
                if (Object.values(updatedSlots).includes(fn)) return;
                for (let i = 0; i < 8; i++) {
                  if (!updatedSlots[i] && !updatedSlots[`slot_${i}`]) {
                    updatedSlots[i] = fn;
                    totalLinkedPhotos++;
                    linkedForThisChar++;
                    break;
                  }
                }
              });
              if (linkedForThisChar > 0) {
                linkedChars.push(charName);
              }
            }
          });

          const hasPromptChange = typeof changes.expanded_prompt === "string" && changes.expanded_prompt.trim().length > 0;

          const mergedGenParams = changes.generation_params
            ? { ...(current.generation_params || {}), ...changes.generation_params }
            : current.generation_params;

          let updatedShot: ShotItem = {
            ...current,
            ...changes,
            generation_params: mergedGenParams,
            characters: mergedCharacters.length > 0 ? mergedCharacters : undefined,
            assigned_slots: updatedSlots,
            status: "unstaged",
            updated_at: new Date().toISOString()
          };

          if (hasPromptChange && changes.expanded_prompt !== current.expanded_prompt) {
            updatedShot = applyPromptVariationToShot(
              updatedShot,
              changes.expanded_prompt,
              changes.basic_stub !== undefined ? changes.basic_stub : current.basic_stub,
              "Assistant Update"
            );
          }

          shots[idx] = updatedShot;
        }
        return { ...prev, shots };
      });

      if (onSelectShot && existingShot?.id) {
        onSelectShot(existingShot.id);
      }

      setAppliedActionKeys((prev) => ({ ...prev, [actionKey]: true }));
      injectStateFeedback(`User applied proposed changes to Shot #${shotNumber}`);
      if (onShowToast) {
        if (totalLinkedPhotos > 0) {
          onShowToast(`Applied updates to Shot #${shotNumber} & staged ${totalLinkedPhotos} reference photo(s) for ${linkedChars.join(", ")}.`, "success");
        } else if (missingPhotoChars.length > 0) {
          onShowToast(`Applied updates to Shot #${shotNumber}. Note: "${missingPhotoChars.join(", ")}" has no Cast Card reference photos yet.`, "info");
        } else {
          onShowToast(`Applied assistant updates to Shot #${shotNumber}.`, "success");
        }
      }

    } else if (action.type === "add_shot") {
      if (!onUpdateProject) {
        onShowToast?.("Project update handler is not available.", "error");
        return;
      }
      const shotData = action.shot || (action as any).changes || {};
      const newShotNum = sceneProject.shots.length + 1;
      const newShotId = "shot_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);

      // Resolve character list
      let shotCharacters: string[] = [];
      if (Array.isArray(shotData.characters)) {
        shotCharacters = shotData.characters.filter(Boolean);
      } else if (typeof shotData.characters === "string") {
        shotCharacters = (shotData.characters as string).split(",").map((s) => s.trim()).filter(Boolean);
      } else if (shotData.character) {
        shotCharacters = [shotData.character];
      }
      if (shotData.ots_anchor_subject && !shotCharacters.includes(shotData.ots_anchor_subject)) {
        shotCharacters.push(shotData.ots_anchor_subject);
      }
      if (shotData.ots_focus_subject && !shotCharacters.includes(shotData.ots_focus_subject)) {
        shotCharacters.push(shotData.ots_focus_subject);
      }

      // Auto-assign available character reference photos
      const assignedSlots: Record<string | number, string> = { ...(shotData.assigned_slots || {}) };
      const missingPhotoChars: string[] = [];
      const linkedPhotoChars: string[] = [];
      let totalLinkedPhotos = 0;

      const allSceneChars = sceneProject.characters || {};
      shotCharacters.forEach((charName) => {
        const profile = (allSceneChars as any)[charName] || 
          Object.entries(allSceneChars).find(([k]) => k.toLowerCase() === charName.toLowerCase())?.[1];
        
        let candidatePhotos: string[] = [];
        if (profile && Array.isArray(profile.quick_slots)) {
          candidatePhotos = profile.quick_slots.filter(Boolean);
        }
        if (candidatePhotos.length === 0) {
          candidatePhotos = assets
            .filter((a) => (a.subject_name || "").trim().toLowerCase() === charName.trim().toLowerCase())
            .map((a) => a.filename);
        }

        if (candidatePhotos.length === 0) {
          missingPhotoChars.push(charName);
        } else {
          linkedPhotoChars.push(charName);
          candidatePhotos.forEach((fn) => {
            if (Object.values(assignedSlots).includes(fn)) return;
            for (let i = 0; i < 8; i++) {
              if (!assignedSlots[i] && !assignedSlots[`slot_${i}`]) {
                assignedSlots[i] = fn;
                totalLinkedPhotos++;
                break;
              }
            }
          });
        }
      });

      onUpdateProject((prev) => {
        const targetNum = prev.shots.length + 1;
        const newShot: ShotItem = {
          id: newShotId,
          shot_name: shotData.shot_name || `Shot #${targetNum}`,
          shot_number: targetNum,
          shot_type: shotData.shot_type || "Medium Shot",
          camera_movement: shotData.camera_movement || "Locked Off",
          lens_focal_length: shotData.lens_focal_length || "50mm Standard Prime",
          aspect_ratio: shotData.aspect_ratio || "16:9 Widescreen",
          basic_stub: shotData.basic_stub || "",
          expanded_prompt: shotData.expanded_prompt || "",
          characters: shotCharacters.length > 0 ? shotCharacters : undefined,
          assigned_slots: assignedSlots,
          generation_params: shotData.generation_params ? { ...shotData.generation_params } : undefined,
          status: "unstaged",
          updated_at: new Date().toISOString()
        };

        if (newShot.expanded_prompt || newShot.basic_stub) {
          const initVar: PromptVariation = {
            id: "var_1_" + Date.now().toString(36),
            variation_number: 1,
            created_at: newShot.updated_at!,
            basic_stub: newShot.basic_stub,
            expanded_prompt: newShot.expanded_prompt,
            label: "Variation 1"
          };
          newShot.prompt_variations = [initVar];
          newShot.active_variation_id = initVar.id;
        }

        return {
          ...prev,
          shots: [...prev.shots, newShot]
        };
      });

      if (onSelectShot) {
        onSelectShot(newShotId);
      }

      setAppliedActionKeys((prev) => ({ ...prev, [actionKey]: true }));
      injectStateFeedback(`User created and added new Shot #${newShotNum} to the scene`);
      if (onShowToast) {
        if (missingPhotoChars.length > 0) {
          onShowToast(`Added Shot #${newShotNum}. Note: "${missingPhotoChars.join(", ")}" has no reference photos in slots 1–4 yet.`, "info");
        } else if (totalLinkedPhotos > 0) {
          onShowToast(`Added Shot #${newShotNum} with ${totalLinkedPhotos} reference photo(s) linked for ${linkedPhotoChars.join(", ")}.`, "success");
        } else {
          onShowToast(`Added new Shot #${newShotNum} to scene.`, "success");
        }
      }

    } else if (action.type === "update_scene_planning") {
      if (!onUpdateProject) {
        onShowToast?.("Project update handler is not available.", "error");
        return;
      }
      const existingPlanning = sceneProject.scene_planning ? { ...sceneProject.scene_planning } : undefined;
      setUndoPlanningSnapshots((prev) => ({ ...prev, [actionKey]: existingPlanning }));

      onUpdateProject((prev) => {
        const currentPlanning = prev.scene_planning || {};
        const changes = action.changes || {};
        const mergedPlanning: ScenePlanningDetails = {
          ...currentPlanning,
          ...changes
        };
        const updatedSceneName = changes.scene_name || prev.scene_name;

        return {
          ...prev,
          scene_name: updatedSceneName,
          scene_planning: mergedPlanning
        };
      });

      setAppliedActionKeys((prev) => ({ ...prev, [actionKey]: true }));
      injectStateFeedback("User applied updates to Scene Planning & Theme specifications");
      onShowToast?.("Applied scene planning updates.", "success");

    } else if (action.type === "update_character") {
      if (!onUpdateProject) {
        onShowToast?.("Project update handler is not available.", "error");
        return;
      }
      const rawName = action.character_name || (action as any).name || "";
      const subjects = sceneProject.subjects || [];
      const canonicalName = findCanonicalSubject(rawName, subjects) || toCanonicalSubjectName(rawName) || rawName;

      const existingChar = sceneProject.characters?.[canonicalName];
      setUndoCharSnapshots((prev) => ({
        ...prev,
        [actionKey]: {
          key: canonicalName,
          profile: existingChar ? { ...existingChar } : undefined,
          wasNew: !existingChar
        }
      }));

      onUpdateProject((prev) => {
        const nextSubjects = [...(prev.subjects || [])];
        if (!findCanonicalSubject(canonicalName, nextSubjects)) {
          nextSubjects.push(canonicalName);
        }

        const nextCharacters = { ...(prev.characters || {}) };
        const changes = action.changes || {};

        const baseProfile: CharacterProfile = nextCharacters[canonicalName] || {
          id: generateUUID(),
          name: canonicalName,
          notes: "",
          quick_slots: [],
          scene_outfit_ref: "",
          is_location: changes.is_location || false
        };

        nextCharacters[canonicalName] = {
          ...baseProfile,
          ...changes,
          name: canonicalName
        };

        return {
          ...prev,
          subjects: nextSubjects,
          characters: nextCharacters
        };
      });

      setAppliedActionKeys((prev) => ({ ...prev, [actionKey]: true }));
      injectStateFeedback(`User updated Character Profile & Wardrobe for "${canonicalName}"`);
      onShowToast?.(`Updated character profile for "${canonicalName}".`, "success");

    } else if (action.type === "stage_shot_assets") {
      const shotNumber = typeof action.shot_number === "string" ? parseInt(action.shot_number, 10) : action.shot_number;
      const targetShot = sceneProject.shots.find((s) => s.shot_number === shotNumber);

      if (!targetShot) {
        onShowToast?.(`Shot #${shotNumber} was not found in active scene.`, "error");
        return;
      }

      setStagingProgressMap((prev) => ({
        ...prev,
        [actionKey]: { status: "staging", progress: 15, message: "Connecting to remote host..." }
      }));

      try {
        const progressTimer = setInterval(() => {
          setStagingProgressMap((prev) => {
            const current = prev[actionKey];
            if (!current || current.status !== "staging") return prev;
            const nextProgress = Math.min(current.progress + 25, 90);
            return {
              ...prev,
              [actionKey]: {
                ...current,
                progress: nextProgress,
                message: nextProgress > 60 ? "Transferring assets via SFTP..." : "Packaging payload & workflow..."
              }
            };
          });
        }, 400);

        let success = false;
        if (onStageShot) {
          success = await onStageShot(targetShot);
        } else {
          const payload = {
            ...(config || {}),
            workflow_filename: targetShot.workflow_file || sceneProject.workflow_file,
            output_workflow_filename: `${sceneProject.scene_name}_Shot_${String(targetShot.shot_number).padStart(2, "0")}.json`,
            prompt_node_id: targetShot.prompt_node_id || (sceneProject as any).prompt_node_id,
            expanded_prompt: targetShot.expanded_prompt,
            node_mappings: targetShot.assigned_slots || {},
            scene_name: sceneProject.scene_name,
            shot_number: targetShot.shot_number
          };

          const data: any = await apiClient.post("/api/execution/stage-shot", payload);
          success = !!data?.success || (data && !data?.error);
          if (data?.error) throw new Error(data.error || "Failed to stage shot assets.");
        }

        clearInterval(progressTimer);

        if (success) {
          setStagingProgressMap((prev) => ({
            ...prev,
            [actionKey]: { status: "success", progress: 100, message: "Assets staged successfully." }
          }));
          setAppliedActionKeys((prev) => ({ ...prev, [actionKey]: true }));
          injectStateFeedback(`User staged Shot #${shotNumber} assets to ComfyUI remote environment`);
          onShowToast?.(`Successfully staged Shot #${shotNumber} to ComfyUI.`, "success");
        } else {
          throw new Error("Staging pipeline returned unsuccessful status.");
        }
      } catch (err: any) {
        const errorMsg = err.message || "Failed to stage assets.";
        setStagingProgressMap((prev) => ({
          ...prev,
          [actionKey]: { status: "error", progress: 0, message: errorMsg }
        }));
        onShowToast?.(`Staging failed: ${errorMsg}`, "error");
      }

    } else if (action.type === "expand_shot_prompt") {
      const shotNumber = typeof action.shot_number === "string" ? parseInt(action.shot_number, 10) : action.shot_number;
      const targetShot = sceneProject.shots.find((s) => s.shot_number === shotNumber);

      if (!targetShot) {
        onShowToast?.(`Shot #${shotNumber} was not found in active scene.`, "error");
        return;
      }

      // Save snapshot for undo
      setUndoShotSnapshots((prev) => ({ ...prev, [actionKey]: { ...targetShot } }));

      setExpandingProgressMap((prev) => ({
        ...prev,
        [actionKey]: { status: "expanding", message: "Synthesizing prompt..." }
      }));

      try {
        let newPrompt = "";
        if (onExpandPrompt) {
          newPrompt = await onExpandPrompt(targetShot);
        } else {
          const payload: any = {
            basic_stub: action.guidance || targetShot.basic_stub,
            assets: assets,
            prompt_prefix: `[Scene: ${sceneProject.scene_name}] [Shot: ${targetShot.shot_number}]`,
            provider: effectiveDefault,
            lm_studio_url: lmStudioUrl,
            gemini_api_key: geminiApiKey,
            active_shot: targetShot,
            shot_type: targetShot.shot_type,
            camera_movement: targetShot.camera_movement,
            lens_focal_length: targetShot.lens_focal_length,
            aspect_ratio: targetShot.aspect_ratio,
            shot_number: targetShot.shot_number,
            scene_name: sceneProject.scene_name,
            characters: sceneProject.characters
          };
          const data: any = await llmApi.generatePrompt(payload);
          if (data?.error) throw new Error(data.error || "Prompt expansion failed");
          newPrompt = data.expanded_prompt || data.response || "";
        }

        if (newPrompt && onUpdateProject) {
          onUpdateProject((prev) => {
            const shots = [...prev.shots];
            const idx = shots.findIndex((s) => s.shot_number === shotNumber);
            if (idx !== -1) {
              shots[idx] = applyPromptVariationToShot(
                shots[idx],
                newPrompt,
                action.guidance || shots[idx].basic_stub,
                "Assistant Expansion"
              );
            }
            return { ...prev, shots };
          });
        }

        setExpandingProgressMap((prev) => ({
          ...prev,
          [actionKey]: { status: "success", message: "Prompt expanded." }
        }));
        setAppliedActionKeys((prev) => ({ ...prev, [actionKey]: true }));
        injectStateFeedback(`User expanded and populated the cinematic prompt for Shot #${shotNumber}`);
        onShowToast?.(`Prompt expanded and populated for Shot #${shotNumber}.`, "success");
      } catch (err: any) {
        const errorMsg = err.message || "Prompt expansion failed.";
        setExpandingProgressMap((prev) => ({
          ...prev,
          [actionKey]: { status: "error", message: errorMsg }
        }));
        onShowToast?.(`Prompt expansion failed: ${errorMsg}`, "error");
      }
    } else if (action.type === "save_visual_analysis") {
      if (!onUpdateProject) return;
      const fn = action.filename;
      if (!fn || !action.analysis) return;

      onUpdateProject((prev) => {
        const nextCache = { ...(prev.visual_analysis_cache || {}) };
        nextCache[fn] = {
          filename: fn,
          scanned_at: new Date().toISOString(),
          summary: action.analysis.summary || "Visual analysis recorded.",
          subject: action.analysis.subject as any,
          wardrobe: action.analysis.wardrobe as any,
          lighting: action.analysis.lighting as any,
          cinematography: action.analysis.cinematography as any,
          environment_palette: action.analysis.environment_palette as any
        };
        return {
          ...prev,
          visual_analysis_cache: nextCache
        };
      });

      setAppliedActionKeys((prev) => ({ ...prev, [actionKey]: true }));
      injectStateFeedback(`Visual analysis cached into project for '${fn}'`);
      onShowToast?.(`Cached visual analysis for ${fn}.`, "success");
    }
  }, [
    onUpdateProject, 
    sceneProject, 
    onShowToast, 
    onStageShot, 
    onExpandPrompt, 
    config, 
    assets, 
    effectiveDefault, 
    lmStudioUrl, 
    geminiApiKey, 
    injectStateFeedback, 
    onSelectShot
  ]);

  const handleDismissAction = useCallback((action: AssistantAction, actionKey: string) => {
    setDismissedActionKeys((prev) => ({ ...prev, [actionKey]: true }));
    let descriptor = "suggestion";
    if (action.type === "update_shot") descriptor = `changes to Shot #${action.shot_number}`;
    else if (action.type === "add_shot") descriptor = "adding new shot";
    else if (action.type === "update_scene_planning") descriptor = "scene planning changes";
    else if (action.type === "update_character") descriptor = `changes to character "${action.character_name}"`;
    else if (action.type === "stage_shot_assets") descriptor = `remote staging for Shot #${action.shot_number}`;
    else if (action.type === "expand_shot_prompt") descriptor = `prompt expansion for Shot #${action.shot_number}`;

    injectStateFeedback(`User dismissed proposed ${descriptor}`);
    onShowToast?.(`Dismissed ${descriptor}.`, "info");
  }, [injectStateFeedback, onShowToast]);

  const handleUndoAction = useCallback((action: AssistantAction, actionKey: string) => {
    if (!onUpdateProject) return;

    if (action.type === "update_shot" || action.type === "expand_shot_prompt") {
      const snapshot = undoShotSnapshots[actionKey];
      if (!snapshot) return;

      onUpdateProject((prev) => {
        const shots = [...prev.shots];
        const idx = shots.findIndex((s) => s.id === snapshot.id || s.shot_number === snapshot.shot_number);
        if (idx !== -1) {
          shots[idx] = { ...snapshot };
        }
        return { ...prev, shots };
      });

      setAppliedActionKeys((prev) => {
        const next = { ...prev };
        delete next[actionKey];
        return next;
      });

      const shotNum = (action as any).shot_number;
      injectStateFeedback(`User reverted (undid) applied changes to Shot #${shotNum}`);
      onShowToast?.(`Reverted changes to Shot #${shotNum}.`, "info");

    } else if (action.type === "update_scene_planning") {
      const snapshot = undoPlanningSnapshots[actionKey];

      onUpdateProject((prev) => ({
        ...prev,
        scene_planning: snapshot
      }));

      setAppliedActionKeys((prev) => {
        const next = { ...prev };
        delete next[actionKey];
        return next;
      });

      injectStateFeedback("User reverted (undid) scene planning modifications");
      onShowToast?.("Reverted scene planning changes.", "info");

    } else if (action.type === "update_character") {
      const snapInfo = undoCharSnapshots[actionKey];
      if (!snapInfo) return;

      onUpdateProject((prev) => {
        const nextCharacters = { ...(prev.characters || {}) };
        if (snapInfo.wasNew) {
          delete nextCharacters[snapInfo.key];
        } else if (snapInfo.profile) {
          nextCharacters[snapInfo.key] = snapInfo.profile;
        }
        return {
          ...prev,
          characters: nextCharacters
        };
      });

      setAppliedActionKeys((prev) => {
        const next = { ...prev };
        delete next[actionKey];
        return next;
      });

      injectStateFeedback(`User reverted (undid) changes for "${snapInfo.key}"`);
      onShowToast?.(`Reverted changes for "${snapInfo.key}".`, "info");
    }
  }, [undoShotSnapshots, undoPlanningSnapshots, undoCharSnapshots, onUpdateProject, onShowToast, injectStateFeedback]);

  const handleApplyAllActions = (actions: AssistantAction[], msgIdx: number) => {
    const existingShotNums = (sceneProject.shots || []).map((s) => s.shot_number);
    actions.forEach((act, actIdx) => {
      const safety = validateActionSafety(act, existingShotNums);
      const actionKey = `${msgIdx}_${act.type}_${act.type === "update_shot" ? act.shot_number : act.type === "update_character" ? act.character_name : actIdx}`;
      if (safety.valid && !appliedActionKeys[actionKey] && !dismissedActionKeys[actionKey]) {
        handleApplyAction(act, actionKey);
      }
    });
  };

  return {
    appliedActionKeys,
    dismissedActionKeys,
    stagingProgressMap,
    expandingProgressMap,
    handleApplyAction,
    handleDismissAction,
    handleUndoAction,
    handleApplyAllActions
  };
}
