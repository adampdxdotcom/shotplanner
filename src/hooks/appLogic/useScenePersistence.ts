import React, { useState, useEffect, useCallback } from 'react';
import { 
  SceneProjectFile, 
  ScenePlanning, 
  AppConfig, 
  GenerationParameters, 
  ParameterNodeMappings, 
  LLMProvider 
} from '../../types';
import { getAssetMediaUrl } from '../../utils/assetUrl';
import { normalizeProjectCastAndAssets } from '../../utils/subjectUtils';

export interface ShotOperationsDelegate {
  llmProvider: LLMProvider;
  setLlmProvider: (provider: LLMProvider) => void;
  basicStub: string;
  setBasicStub: (stub: string) => void;
  expandedPrompt: string;
  setExpandedPrompt: (prompt: string) => void;
  scenePlanning: ScenePlanning;
  setScenePlanning: React.Dispatch<React.SetStateAction<ScenePlanning>>;
  setActiveShotId: (id: string | null) => void;
  setActiveSection: (section: string) => void;
}

interface UseScenePersistenceParams {
  config: AppConfig;
  setConfig: React.Dispatch<React.SetStateAction<AppConfig>>;
  defaultLlmProvider: LLMProvider;
  generationParams: GenerationParameters;
  setGenerationParams: (params: GenerationParameters) => void;
  parameterNodeMappings: ParameterNodeMappings;
  setParameterNodeMappings: (mappings: ParameterNodeMappings) => void;
  selectedWorkflowFile: string;
  setSelectedWorkflowFile: (file: string) => void;
  selectedPromptNodeId: string;
  setSelectedPromptNodeId: (nodeId: string) => void;
  nodeMappings: Record<string, string>;
  setNodeMappings: (mappings: Record<string, string>) => void;
  bypassMissing: boolean;
  setBypassMissing: (bypass: boolean) => void;
  fetchWorkflows: () => Promise<void>;
  addToast: (text: string, type?: "success" | "error" | "info") => void;
  getShotOperationsDelegate?: () => Partial<ShotOperationsDelegate>;
}

export function useScenePersistence({
  config,
  setConfig,
  defaultLlmProvider,
  generationParams,
  setGenerationParams,
  parameterNodeMappings,
  setParameterNodeMappings,
  selectedWorkflowFile,
  setSelectedWorkflowFile,
  selectedPromptNodeId,
  setSelectedPromptNodeId,
  nodeMappings,
  setNodeMappings,
  bypassMissing,
  setBypassMissing,
  fetchWorkflows,
  addToast,
  getShotOperationsDelegate
}: UseScenePersistenceParams) {
  const [sceneProject, setSceneProject] = useState<SceneProjectFile>({
    schema_version: "1.0",
    scene_id: "scene_" + Date.now(),
    scene_name: "New Scene",
    workflow_file: "",
    shared_assets: [],
    shots: [{
      id: "shot_" + Date.now(),
      shot_number: 1,
      shot_type: "Medium Shot",
      camera_movement: "Locked Off",
      lens_focal_length: "50mm Standard Prime",
      aspect_ratio: "16:9 Widescreen",
      basic_stub: "",
      expanded_prompt: "",
      assigned_slots: {},
      status: "unstaged",
      updated_at: new Date().toISOString()
    }]
  });

  const [activeCodeModalOpen, setIsCodeModalOpen] = useState<boolean>(false);
  const [isDirty, setIsDirty] = useState(false);
  const [hasLoadedProject, setHasLoadedProject] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);
  const [currentProjectName, setCurrentProjectName] = useState<string>("");
  const [availableScenes, setAvailableScenes] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/projects")
      .then(res => res.json())
      .then(data => {
        if (data.projects) {
          setAvailableScenes(data.projects.map((p: any) => typeof p === 'string' ? p : p.filename).filter((p: string) => p.endsWith(".json")).map((p: string) => p.replace(/\.json$/i, "")));
        }
      })
      .catch(e => console.error("Failed to load scene list", e));
  }, []);

  useEffect(() => {
    if (isInitialLoad || !hasLoadedProject) {
      setIsInitialLoad(false);
      return;
    }
    setIsDirty(true);
  }, [sceneProject, config, selectedWorkflowFile, selectedPromptNodeId, nodeMappings, bypassMissing, generationParams, parameterNodeMappings]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // Auto-save sceneProject to disk
  useEffect(() => {
    if (isInitialLoad || !hasLoadedProject || !isDirty) return;
    const saveSceneProject = async () => {
      try {
        const delegate = getShotOperationsDelegate?.();
        const currentLlmProvider = delegate?.llmProvider || config.default_llm_provider || defaultLlmProvider;

        const payload = {
          name: sceneProject.scene_name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_").replace(/_+/g, "_"),
          data: {
            ...sceneProject,
            lm_studio_url: config.lm_studio_url,
            config: {
              ...(sceneProject.config || {}),
              ...config,
              lm_studio_url: config.lm_studio_url
            },
            llm_provider: currentLlmProvider,
            parameter_node_mappings: parameterNodeMappings,
            generation_params: generationParams
          }
        };
        await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        setIsDirty(false);
      } catch (err) {
        console.error("Auto-save failed:", err);
      }
    };
    
    const timer = setTimeout(saveSceneProject, 1000);
    return () => clearTimeout(timer);
  }, [sceneProject, isInitialLoad, hasLoadedProject, isDirty, parameterNodeMappings, generationParams, config, defaultLlmProvider, getShotOperationsDelegate]);

  const fetchAssets = useCallback(async (sceneName?: string) => {
    try {
      const baseUrl = sceneName ? `/api/assets?scene_name=${encodeURIComponent(sceneName)}` : "/api/assets";
      const cacheBuster = `&_t=${Date.now()}`;
      const url = baseUrl.includes("?") ? `${baseUrl}${cacheBuster}` : `${baseUrl}?${cacheBuster}`;
      const res = await fetch(url, { headers: { "Cache-Control": "no-store" } });
      const data = await res.json();
      if (data.assets) {
        setSceneProject(prev => {
          const currentAssets = prev.assets || [];
          const newAssets = data.assets.map((a: any, idx: number) => {
            const existing = currentAssets.find(ca => ca.filename === a.filename);
            if (existing) {
              return existing;
            }
            return {
              ...a,
              slot_index: a.slot_index !== undefined ? a.slot_index : idx,
              media_type: a.media_type || (/\.(mp3|wav|ogg|m4a|flac)$/i.test(a.filename) ? "audio" : /\.(mp4|mov|webm|mkv)$/i.test(a.filename) ? "video" : "image"),
              preview_url: getAssetMediaUrl(a.filename)
            };
          });
          return { ...prev, assets: newAssets };
        });
      }
    } catch (e) {
      console.error("Failed to load assets", e);
    }
  }, []);

  const handleSaveProject = useCallback(async (filename: string) => {
    const assets = sceneProject?.assets || [];
    const subjects = sceneProject?.subjects || [];
    const normalized = normalizeProjectCastAndAssets({
      ...sceneProject,
      subjects: [
        ...(sceneProject.subjects || []),
        ...subjects,
        ...assets.map(a => a.subject_name).filter(Boolean)
      ],
      characters: sceneProject.characters,
      assets
    });

    const delegate = getShotOperationsDelegate?.();
    const currentLlmProvider = delegate?.llmProvider || config.default_llm_provider || defaultLlmProvider;

    const payload: SceneProjectFile = {
      ...sceneProject,
      lm_studio_url: config.lm_studio_url,
      config: {
        ...(sceneProject.config || {}),
        ...config,
        lm_studio_url: config.lm_studio_url,
        gemini_api_key: "",
        civitai_api_key: "",
        huggingface_token: ""
      },
      llm_provider: currentLlmProvider,
      parameter_node_mappings: parameterNodeMappings,
      generation_params: generationParams,
      assets: normalized.assets,
      subjects: normalized.subjects,
      characters: normalized.characters
    };
    
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename, data: payload })
    });
    
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to save project.");
    }
    
    const resData = await res.json();
    const actualFilename = resData.filename || filename;
    const cleanName = actualFilename.replace(/\.json$/i, "");
    
    setCurrentProjectName(cleanName);
    setIsDirty(false);
    addToast(`Project "${cleanName}" saved successfully.`, "success");
  }, [sceneProject, config, parameterNodeMappings, generationParams, defaultLlmProvider, getShotOperationsDelegate, addToast]);

  const handleLoadProject = useCallback(async (filename: string) => {
    const res = await fetch(`/api/projects/${filename}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to load project.");
    }
    const rawData = await res.json();
    const normalizedData = normalizeProjectCastAndAssets(rawData);
    const data = {
      ...rawData,
      subjects: normalizedData.subjects,
      characters: normalizedData.characters,
      assets: normalizedData.assets
    };

    const delegate = getShotOperationsDelegate?.();

    // Restore local LLM IP / URL & provider
    const restoredLlmUrl = data.lm_studio_url || data.config?.lm_studio_url || data.local_llm_url || data.llm_url || data.llm_endpoint;
    if (restoredLlmUrl) {
      setConfig(prev => ({
        ...prev,
        lm_studio_url: restoredLlmUrl
      }));
    }
    const explicitLlmProvider = data.llmProvider || data.llm_provider || data.llmChoice || data.providerChoice || data.config?.llm_provider || data.config?.llmProvider;
    const resolvedLlmProvider: LLMProvider = (explicitLlmProvider === "gemini" || explicitLlmProvider === "lm_studio")
      ? explicitLlmProvider
      : defaultLlmProvider;
    
    if (delegate?.setLlmProvider) {
      delegate.setLlmProvider(resolvedLlmProvider);
    }

    if (data.schema_version === "1.0") {
      setNodeMappings({});
      if (data.parameter_node_mappings || data.parameterNodeMappings) {
        setParameterNodeMappings(data.parameter_node_mappings || data.parameterNodeMappings);
      } else if (data.shots && data.shots.length > 0 && data.shots[0].parameter_node_mappings) {
        setParameterNodeMappings(data.shots[0].parameter_node_mappings);
      } else {
        setParameterNodeMappings({ steps: "", megapixels: "", frames: "" });
      }

      if (data.generation_params || data.generationParams) {
        setGenerationParams(data.generation_params || data.generationParams);
      } else if (data.shots && data.shots.length > 0 && data.shots[0].generation_params) {
        setGenerationParams(data.shots[0].generation_params);
      }

      if (delegate?.setBasicStub) delegate.setBasicStub("");
      if (delegate?.setExpandedPrompt) delegate.setExpandedPrompt("");
      
      // Restore config if bundled
      if (data.config) {
        setConfig(prev => ({
          ...prev,
          ...data.config,
          lm_studio_url: restoredLlmUrl || data.config.lm_studio_url || prev.lm_studio_url,
          gemini_api_key: ""
        }));
      }

      setSceneProject(data);
      setCurrentProjectName(filename.replace(/\.json$/i, ""));
      if (delegate?.setActiveShotId) {
        delegate.setActiveShotId(data.shots && data.shots.length > 0 ? data.shots[0].id : null);
      }
      if (delegate?.setActiveSection) {
        delegate.setActiveSection("scene");
      }
      setIsDirty(false);
      
      // Restore assets & subjects
      let restoredAssets = [];
      if (Array.isArray(data.assets) && data.assets.length > 0) {
        restoredAssets = data.assets.map((a: any, idx: number) => ({
          ...a,
          slot_index: a.slot_index !== undefined ? a.slot_index : idx,
          media_type: a.media_type || (/\.(mp3|wav|ogg|m4a|flac)$/i.test(a.filename) ? "audio" : /\.(mp4|mov|webm|mkv)$/i.test(a.filename) ? "video" : "image"),
          preview_url: getAssetMediaUrl(a.filename)
        }));
      }
      let restoredSubjects = [];
      if (Array.isArray(data.subjects)) {
        restoredSubjects = data.subjects;
      }
      
      setSceneProject(prev => ({ ...prev, assets: restoredAssets, subjects: restoredSubjects }));
      setHasLoadedProject(true);
      await fetchAssets(data.scene_name || filename.replace(/\.json$/i, ""));
      
      setTimeout(() => setIsDirty(false), 100);
      const assetCount = Array.isArray(data.assets) ? data.assets.length : 0;
      addToast(`Project "${filename}" loaded successfully (${assetCount} image assets restored).`, "success");
      return;
    }

    // Reset state before hydrating legacy project
    setNodeMappings({});
    setParameterNodeMappings({ steps: "", megapixels: "", frames: "" });
    if (delegate?.setBasicStub) delegate.setBasicStub("");
    if (delegate?.setExpandedPrompt) delegate.setExpandedPrompt("");

    // Sync & set saved assets if present
    if (Array.isArray(data.assets) && data.assets.length > 0) {
      const normalizedAssets = data.assets.map((a: any, idx: number) => ({
        ...a,
        slot_index: a.slot_index !== undefined ? a.slot_index : idx,
        media_type: a.media_type || (/\.(mp3|wav|ogg|m4a|flac)$/i.test(a.filename) ? "audio" : /\.(mp4|mov|webm|mkv)$/i.test(a.filename) ? "video" : "image"),
        preview_url: getAssetMediaUrl(a.filename)
      }));
      try {
        await fetch("/api/assets/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assets: normalizedAssets })
        });
      } catch (e) {
        console.error("Failed to sync project assets", e);
      }
    } else {
      await fetchAssets(data.scene_name || filename.replace(/\.json$/i, ""));
    }

    if (data.config) {
      setConfig(prev => ({
        ...prev,
        ...data.config,
        gemini_api_key: "",
        civitai_api_key: data.config.civitai_api_key || prev.civitai_api_key || "",
        remote_host: data.config.remote_host || data.config.runpod_ip || prev.remote_host,
        remote_api_token: data.config.remote_api_token || data.config.runpod_api_token || prev.remote_api_token,
        remote_comfyui_root: data.config.remote_comfyui_root || (data.config.remote_input_dir ? data.config.remote_input_dir.replace(/\/input\/?$/, "") : null) || prev.remote_comfyui_root || "/workspace/runpod-slim/ComfyUI"
      }));
    }
    setSelectedWorkflowFile(data.selectedWorkflowFile || "");
    setSelectedPromptNodeId(data.selectedPromptNodeId || "");
    setNodeMappings(data.nodeMappings || {});
    setBypassMissing(data.bypassMissing ?? true);
    if (data.generationParams) {
      setGenerationParams(data.generationParams);
    }
    if (data.parameterNodeMappings) {
      setParameterNodeMappings(data.parameterNodeMappings);
    }
    if (data.scenePlanning || data.scene_planning) {
      const loadedPlanning = data.scenePlanning || data.scene_planning;
      if (delegate?.setScenePlanning) {
        delegate.setScenePlanning({
          scene_name: loadedPlanning.scene_name || "",
          shot_number: loadedPlanning.shot_number || "01",
          shot_type: loadedPlanning.shot_type || "Medium Shot (MS)",
          camera_movement: loadedPlanning.camera_movement || "Locked Off (Static)",
          lens_focal_length: loadedPlanning.lens_focal_length || "50mm Standard Prime",
          aspect_ratio: loadedPlanning.aspect_ratio || "16:9 Widescreen"
        });
      }
    }
    if (delegate?.setBasicStub) delegate.setBasicStub(data.basicStub || "");
    if (delegate?.setExpandedPrompt) delegate.setExpandedPrompt(data.expandedPrompt || "");
    setCurrentProjectName(filename.replace(/\.json$/i, ""));
    
    await fetchWorkflows();
    
    setTimeout(() => setIsDirty(false), 100);
    const assetCount = Array.isArray(data.assets) ? data.assets.length : 0;
    addToast(`Project "${filename}" loaded successfully (${assetCount} image assets restored).`, "success");
  }, [setConfig, defaultLlmProvider, setNodeMappings, setParameterNodeMappings, setGenerationParams, setSelectedWorkflowFile, setSelectedPromptNodeId, setBypassMissing, fetchAssets, fetchWorkflows, addToast, getShotOperationsDelegate]);

  const handleCreateNewProject = useCallback(async (sceneName: string) => {
    const delegate = getShotOperationsDelegate?.();
    const newSceneId = "scene_" + Date.now();
    const newScene: SceneProjectFile = {
      schema_version: "1.0",
      scene_id: newSceneId,
      scene_name: sceneName,
      workflow_file: selectedWorkflowFile || "",
      shared_assets: [],
      assets: [],
      subjects: [],
      lm_studio_url: config.lm_studio_url,
      config: {
        ...config,
        default_llm_provider: defaultLlmProvider
      },
      llm_provider: defaultLlmProvider,
      shots: [{
        id: "shot_" + Date.now(),
        shot_number: 1,
        shot_type: "Medium Shot",
        camera_movement: "Locked Off",
        lens_focal_length: "50mm Standard Prime",
        aspect_ratio: "16:9 Widescreen",
        basic_stub: "",
        expanded_prompt: "",
        assigned_slots: {},
        status: "unstaged",
        updated_at: new Date().toISOString()
      }]
    };

    const cleanFilename = sceneName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_").replace(/_+/g, "_") || "untitled_scene";
    
    // Initialize clean in-memory state without writing to disk
    setNodeMappings({});
    setParameterNodeMappings({ steps: "", megapixels: "", frames: "" });
    if (delegate?.setBasicStub) delegate.setBasicStub("");
    if (delegate?.setExpandedPrompt) delegate.setExpandedPrompt("");
    if (delegate?.setLlmProvider) delegate.setLlmProvider(defaultLlmProvider);
    
    setSceneProject(newScene);
    setCurrentProjectName(cleanFilename);
    if (delegate?.setActiveShotId) delegate.setActiveShotId(newScene.shots[0].id);
    setHasLoadedProject(true);
    setIsDirty(false);
    
    addToast(`New scene "${sceneName}" created in-memory. Save when ready!`, "info");
  }, [selectedWorkflowFile, config, defaultLlmProvider, setNodeMappings, setParameterNodeMappings, addToast, getShotOperationsDelegate]);

  useEffect(() => {
    fetchWorkflows();
    const lastProject = localStorage.getItem('shotplanner_last_project');
    if (lastProject) {
      handleLoadProject(lastProject + ".json").catch(err => {
        console.error("Failed to restore last project:", err);
      });
    }
  }, []);

  useEffect(() => {
    if (currentProjectName && currentProjectName !== "untitled_scene") {
      localStorage.setItem('shotplanner_last_project', currentProjectName);
    }
  }, [currentProjectName]);

  useEffect(() => {
    fetchAssets(sceneProject.scene_name || currentProjectName);
  }, [sceneProject.scene_name, currentProjectName, fetchAssets]);

  return {
    sceneProject,
    setSceneProject,
    isCodeModalOpen: activeCodeModalOpen,
    setIsCodeModalOpen,
    isDirty,
    setIsDirty,
    hasLoadedProject,
    setHasLoadedProject,
    isInitialLoad,
    setIsInitialLoad,
    isNewModalOpen,
    setIsNewModalOpen,
    isSaveModalOpen,
    setIsSaveModalOpen,
    isLoadModalOpen,
    setIsLoadModalOpen,
    currentProjectName,
    setCurrentProjectName,
    availableScenes,
    setAvailableScenes,
    handleSaveProject,
    handleLoadProject,
    handleCreateNewProject,
    fetchAssets
  };
}
