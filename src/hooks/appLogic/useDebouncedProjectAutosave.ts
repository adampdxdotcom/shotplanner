import { useState, useEffect, useRef, useCallback } from "react";
import { 
  SceneProjectFile, 
  AppConfig, 
  ParameterNodeMappings, 
  GenerationParameters, 
  LLMProvider 
} from "../../types";
import { sanitizeProjectForPersistence } from "../../utils/recipeSanitizer";
import { normalizeProjectCastAndAssets } from "../../utils/subjectUtils";
import { projectsApi } from "../../api";
import type { ShotOperationsDelegate } from "./useScenePersistence";

export type AutosaveStatus = "saved" | "saving" | "unsaved" | "error";

export interface UseDebouncedProjectAutosaveParams {
  sceneProject: SceneProjectFile;
  currentProjectName: string;
  config: Partial<AppConfig>;
  parameterNodeMappings: ParameterNodeMappings;
  generationParams: GenerationParameters;
  selectedWorkflowFile?: string;
  defaultLlmProvider: LLMProvider;
  getShotOperationsDelegate?: () => Partial<ShotOperationsDelegate> | null | undefined;
  isInitialLoad: boolean;
  hasLoadedProject: boolean;
  isDirty: boolean;
  setIsDirty: (dirty: boolean) => void;
  debounceMs?: number;
}

export interface UseDebouncedProjectAutosaveReturn {
  autosaveStatus: AutosaveStatus;
  lastSavedAt: Date | null;
  forceAutosave: () => Promise<boolean>;
}

export function useDebouncedProjectAutosave({
  sceneProject,
  currentProjectName,
  config,
  parameterNodeMappings,
  generationParams,
  selectedWorkflowFile,
  defaultLlmProvider,
  getShotOperationsDelegate,
  isInitialLoad,
  hasLoadedProject,
  isDirty,
  setIsDirty,
  debounceMs = 1200
}: UseDebouncedProjectAutosaveParams): UseDebouncedProjectAutosaveReturn {
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>("saved");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Store latest refs to avoid stale closure during debounced save
  const latestProjectRef = useRef(sceneProject);
  latestProjectRef.current = sceneProject;

  const latestConfigRef = useRef(config);
  latestConfigRef.current = config;

  const latestMappingsRef = useRef(parameterNodeMappings);
  latestMappingsRef.current = parameterNodeMappings;

  const latestParamsRef = useRef(generationParams);
  latestParamsRef.current = generationParams;

  const latestNameRef = useRef(currentProjectName);
  latestNameRef.current = currentProjectName;

  const isSavingRef = useRef(false);
  const hasPendingChangesRef = useRef(false);
  const dirtyRevisionRef = useRef(0);

  // Increment revision whenever input dependencies change
  useEffect(() => {
    if (!isInitialLoad && hasLoadedProject) {
      dirtyRevisionRef.current += 1;
    }
  }, [
    sceneProject,
    config,
    parameterNodeMappings,
    generationParams,
    selectedWorkflowFile,
    currentProjectName,
    isInitialLoad,
    hasLoadedProject
  ]);

  // Core save execution function with concurrency queueing and revision safety
  const executeAutosave = useCallback(async (): Promise<boolean> => {
    // If a network save is already in-flight, mark pending so a follow-up executes immediately upon completion
    if (isSavingRef.current) {
      hasPendingChangesRef.current = true;
      return false;
    }

    const project = latestProjectRef.current;
    const name = latestNameRef.current || project.scene_name || "untitled_scene";
    const filename = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "_")
      .replace(/_+/g, "_");

    if (!filename || filename === "untitled_scene" && (!project.shots || project.shots.length === 0)) {
      return false;
    }

    isSavingRef.current = true;
    hasPendingChangesRef.current = false;
    setAutosaveStatus("saving");

    // Snapshot the revision being dispatched
    const dispatchedRevision = dirtyRevisionRef.current;

    try {
      const normalized = normalizeProjectCastAndAssets({
        ...project,
        assets: project.assets || []
      });

      const delegate = getShotOperationsDelegate?.();
      const currentLlmProvider = delegate?.llmProvider || latestConfigRef.current.default_llm_provider || defaultLlmProvider;

      // Strip heavy in-memory data URLs so only asset references and coordinate transforms are serialized
      const rawPayload: SceneProjectFile = {
        ...project,
        selectedWorkflowFile: selectedWorkflowFile || (project as any).selectedWorkflowFile || (project as any).workflow_file,
        workflow_file: selectedWorkflowFile || (project as any).workflow_file || (project as any).selectedWorkflowFile,
        llm_provider: currentLlmProvider,
        parameter_node_mappings: latestMappingsRef.current,
        generation_params: latestParamsRef.current,
        assets: normalized.assets,
        subjects: normalized.subjects,
        characters: normalized.characters
      };

      // Remove legacy infrastructure fields from project payload
      delete (rawPayload as any).lm_studio_url;
      delete (rawPayload as any).local_llm_url;
      delete (rawPayload as any).config;

      const payload = sanitizeProjectForPersistence(rawPayload);

      await projectsApi.save(filename, payload);

      // Only mark clean if no new edits occurred while the HTTP request was in flight
      if (dirtyRevisionRef.current === dispatchedRevision) {
        setIsDirty(false);
        setAutosaveStatus("saved");
      } else {
        // New edits occurred mid-flight: keep dirty and mark pending
        hasPendingChangesRef.current = true;
      }

      setLastSavedAt(new Date());
      return true;
    } catch (err) {
      console.error("Autosave network error:", err);
      setAutosaveStatus("error");
      return false;
    } finally {
      isSavingRef.current = false;
      // If changes arrived while saving was in-flight, trigger follow-up save immediately
      if (hasPendingChangesRef.current) {
        hasPendingChangesRef.current = false;
        setTimeout(() => {
          executeAutosave();
        }, 100);
      }
    }
  }, [defaultLlmProvider, getShotOperationsDelegate, selectedWorkflowFile, setIsDirty]);

  // Handle debounced trigger when project is dirty
  useEffect(() => {
    if (isInitialLoad || !hasLoadedProject) {
      return;
    }

    if (!isDirty) {
      return;
    }

    setAutosaveStatus("saving");

    const timer = setTimeout(() => {
      executeAutosave();
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [
    sceneProject,
    config,
    parameterNodeMappings,
    generationParams,
    isInitialLoad,
    hasLoadedProject,
    isDirty,
    debounceMs,
    executeAutosave
  ]);

  return {
    autosaveStatus,
    lastSavedAt,
    forceAutosave: executeAutosave
  };
}
