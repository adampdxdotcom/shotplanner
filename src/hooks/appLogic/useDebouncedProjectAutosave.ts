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
import type { ShotOperationsDelegate } from "./useScenePersistence";

export type AutosaveStatus = "saved" | "saving" | "unsaved" | "error";

export interface UseDebouncedProjectAutosaveParams {
  sceneProject: SceneProjectFile;
  currentProjectName: string;
  config: Partial<AppConfig>;
  parameterNodeMappings: ParameterNodeMappings;
  generationParams: GenerationParameters;
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

  // Core save execution function
  const executeAutosave = useCallback(async (): Promise<boolean> => {
    if (isSavingRef.current) return false;

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
    setAutosaveStatus("saving");

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
        lm_studio_url: latestConfigRef.current.lm_studio_url,
        vision_enabled: Boolean(latestConfigRef.current.vision_enabled),
        auto_caption_enabled: Boolean(latestConfigRef.current.auto_caption_enabled),
        config: {
          ...(project.config || {}),
          ...latestConfigRef.current,
          lm_studio_url: latestConfigRef.current.lm_studio_url,
          vision_enabled: Boolean(latestConfigRef.current.vision_enabled),
          auto_caption_enabled: Boolean(latestConfigRef.current.auto_caption_enabled),
          gemini_api_key: "",
          civitai_api_key: "",
          huggingface_token: "",
          runpod_api_key: ""
        },
        llm_provider: currentLlmProvider,
        parameter_node_mappings: latestMappingsRef.current,
        generation_params: latestParamsRef.current,
        assets: normalized.assets,
        subjects: normalized.subjects,
        characters: normalized.characters
      };

      const payload = sanitizeProjectForPersistence(rawPayload);

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, data: payload })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("Autosave response error:", err);
        setAutosaveStatus("error");
        return false;
      }

      setIsDirty(false);
      setAutosaveStatus("saved");
      setLastSavedAt(new Date());
      return true;
    } catch (err) {
      console.error("Autosave network error:", err);
      setAutosaveStatus("error");
      return false;
    } finally {
      isSavingRef.current = false;
    }
  }, [defaultLlmProvider, getShotOperationsDelegate, setIsDirty]);

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
