import { getAssetMediaUrl } from "../utils/assetUrl";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { AppConfig, MediaAsset, WorkflowItem, ParsedWorkflow, ToastMessage, GenerationParameters, ParameterNodeMappings, LLMProvider, ScenePlanning, SceneProjectFile, ShotItem, CharacterProfile } from '../types';
import { useComfyMonitor } from './useComfyMonitor';
import { generatePromptPrefix } from '../components/ScenePlanningHeader';
import { generateUUID } from '../utils/formatters';

export function useAppLogic() {

  // 1. Config State
  const [config, setConfig] = useState<AppConfig>({
    remote_host: "194.26.196.105",
    ssh_port: 22,
    ssh_username: "root",
    ssh_password: "",
    ssh_key_path: "",
    ssh_private_key: "",
    remote_comfyui_root: "/workspace/runpod-slim/ComfyUI",
    comfyui_api_url: "http://127.0.0.1:8188",
    remote_api_token: "",
    lm_studio_url: "http://localhost:1234/v1"
  });

  // 2. Workflow & Node Mapping State
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [selectedWorkflowFile, setSelectedWorkflowFile] = useState<string>("");
  const [parsedWorkflow, setParsedWorkflow] = useState<ParsedWorkflow | null>(null);
  const [selectedPromptNodeId, setSelectedPromptNodeId] = useState<string>("");
  const [nodeMappings, setNodeMappings] = useState<Record<string, string>>({});
  const [bypassMissing, setBypassMissing] = useState<boolean>(true);

  // Dynamic Generation Parameters & Node Overrides
  const [generationParams, setGenerationParams] = useState<GenerationParameters>({
    steps: 30,
    megapixels: 0.5,
    frames: 81
  });
  const [parameterNodeMappings, setParameterNodeMappings] = useState<ParameterNodeMappings>({
    steps: "",
    megapixels: "",
    frames: ""
  });

  // 3. Asset Management State


  // 4. LLM Prompt Expansion & Scene Planning State
  // Scene Hub State
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
      staged: false,
      updated_at: new Date().toISOString()
    }]
  });
  const assets = sceneProject?.assets || [];
  const subjects = sceneProject?.subjects || [];
  // Function to register subject in project registry
  const handleRegisterSubject = (name: string) => {
    const trimmed = name.trim();
    if (trimmed && !subjects.includes(trimmed)) {
      setSceneProject(prev => {
        const nextSubjects = [...(prev.subjects || []), trimmed];
        const nextCharacters = { ...(prev.characters || {}) };
        if (!nextCharacters[trimmed]) {
          nextCharacters[trimmed] = {
            id: generateUUID(),
            name: trimmed,
            notes: "",
            quick_slots: [],
            scene_outfit_ref: ""
          };
        }
        return { ...prev, subjects: nextSubjects, characters: nextCharacters };
      });
      setIsDirty(true);
    }
  };

  const handleUpdateCharacter = (profile: any) => {
    setSceneProject(prev => ({
      ...prev,
      characters: {
        ...(prev.characters || {}),
        [profile.name]: profile
      }
    }));
    setIsDirty(true);
  };

  // Sync subjects when assets change
  useEffect(() => {
    if (assets.length > 0) {
      setSceneProject(prevProject => {
        const prev = prevProject.subjects || [];
        let changed = false;
        const currentLower = new Set(prev.map(s => s.toLowerCase()));
        const next = [...prev];
        for (const a of assets) {
          const s = (a.subject_name || "").trim();
          if (s && !currentLower.has(s.toLowerCase())) {
            currentLower.add(s.toLowerCase());
            next.push(s);
            changed = true;
          }
        }
        return changed ? { ...prevProject, subjects: next } : prevProject;
      });
    }
  }, [assets]);

  const [scenePlanning, setScenePlanning] = useState<ScenePlanning>({
    scene_name: "",
    shot_number: "01",
    shot_type: "Medium Shot (MS)",
    camera_movement: "Locked Off (Static)",
    lens_focal_length: "50mm Standard Prime",
    aspect_ratio: "16:9 Widescreen"
  });
  const promptPrefix = useMemo(() => generatePromptPrefix(scenePlanning), [scenePlanning]);

  const [basicStub, setBasicStub] = useState<string>("");
  const [expandedPrompt, setExpandedPrompt] = useState<string>("");
  const [llmProvider, setLlmProvider] = useState<LLMProvider>("lm_studio");

  // UI Navigation & Code Modal
  const [activeSection, setActiveSection] = useState<string>("scene");
  const [activeShotId, setActiveShotId] = useState<string | null>(null);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState<boolean>(false);

  // Project Save/Load State
  const [isDirty, setIsDirty] = useState(false);
  const [hasLoadedProject, setHasLoadedProject] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);
  const [currentProjectName, setCurrentProjectName] = useState<string>("");

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((text: string, type: "success" | "error" | "info" = "info") => {
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

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
  }, [addToast]);

  const monitorState = useComfyMonitor(config.comfyui_api_url, addToast, sceneProject.scene_name);

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
  }, [sceneProject, config, selectedWorkflowFile, selectedPromptNodeId, nodeMappings, bypassMissing, basicStub, expandedPrompt, generationParams, parameterNodeMappings, llmProvider, scenePlanning]);

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
            llm_provider: llmProvider,
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
  }, [sceneProject, isInitialLoad, hasLoadedProject, isDirty, parameterNodeMappings, generationParams]);

  const handleUpdateParam = (key: keyof GenerationParameters, value: number) => {
    setGenerationParams(prev => ({ ...prev, [key]: value }));
    if (activeShotId) {
      setSceneProject(prev => {
        const shots = [...prev.shots];
        const idx = shots.findIndex(s => s.id === activeShotId);
        if (idx !== -1) {
          shots[idx] = {
            ...shots[idx],
            generation_params: {
              ...(shots[idx].generation_params || { steps: 30, megapixels: 0.5, frames: 81 }),
              [key]: value
            }
          };
        }
        return { ...prev, shots };
      });
    }
  };

  const handleUpdateParameterMapping = (key: keyof ParameterNodeMappings, nodeId: string) => {
    setParameterNodeMappings(prev => ({ ...prev, [key]: nodeId }));
    if (activeShotId) {
      setSceneProject(prev => {
        const shots = [...prev.shots];
        const idx = shots.findIndex(s => s.id === activeShotId);
        if (idx !== -1) {
          shots[idx] = {
            ...shots[idx],
            parameter_node_mappings: {
              ...(shots[idx].parameter_node_mappings || { steps: "", megapixels: "", frames: "" }),
              [key]: nodeId
            }
          };
        }
        return { ...prev, shots };
      });
    }
  };

  const handleSceneExpandPrompt = async (shot: ShotItem): Promise<string> => {
    const shotPrefix = generatePromptPrefix({
      scene_name: shot.shot_name,
      shot_number: shot.shot_number,
      shot_type: shot.shot_type,
      lens_focal_length: shot.lens_focal_length,
      camera_movement: shot.camera_movement,
      aspect_ratio: shot.aspect_ratio
    });
    
    // We need to pass the assigned assets for this shot
    const shotAssets作成 = Object.entries(shot.assigned_slots).map(([idx, filename]) => {
      const asset = assets.find(a => a.filename === filename);
      if (asset) return { ...asset, slot_index: parseInt(idx) };
      return null;
    }).filter(Boolean) as MediaAsset[];

    // Add shared assets if no specific slot
    sceneProject.shared_assets.forEach(shared => {
      if (!shot.assigned_slots[shared.slot_index]) {
        const asset = assets.find(a => a.filename === shared.filename);
        if (asset) shotAssets作成.push({ ...asset, slot_index: shared.slot_index });
      }
    });
    
    const response = await fetch("/api/generate-prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        basic_stub: shot.basic_stub,
        assets: shotAssets作成,
        prompt_prefix: shotPrefix,
        provider: llmProvider,
        lm_studio_url: config.lm_studio_url,
        gemini_api_key: config.gemini_api_key,
        active_shot: shot,
        shot_type: shot.shot_type,
        camera_movement: shot.camera_movement,
        lens_focal_length: shot.lens_focal_length,
        aspect_ratio: shot.aspect_ratio,
        ots_anchor_subject: shot.ots_anchor_subject,
        ots_focus_subject: shot.ots_focus_subject,
        ots_side: shot.ots_side,
        shot_number: shot.shot_number,
        scene_name: sceneProject.scene_name,
        characters: sceneProject.characters
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Expansion failed");
    return data.expanded_prompt;
  };

  const handleSceneTransfer = async (shot: ShotItem): Promise<boolean> => {
    // Generate the specific node mappings for this shot based on slot_index
    const shotMappings: Record<string, string> = {};
    if (parsedWorkflow) {
      const imgLoaders = parsedWorkflow.nodes_info.image_loader_nodes || [];
      const vidLoaders = parsedWorkflow.nodes_info.video_loader_nodes || [];
      const audLoaders = parsedWorkflow.nodes_info.audio_loader_nodes || [];
      
      const allLoaders = [...imgLoaders, ...vidLoaders, ...audLoaders];
      
      // Assign based on slot index
      for (let i = 0; i < Math.max(allLoaders.length, 15); i++) {
        const filename = shot.assigned_slots[i] || sceneProject.shared_assets.find(a => a.slot_index === i)?.filename;
        if (filename && allLoaders[i]) {
          shotMappings[allLoaders[i].id] = filename;
        }
      }
    }

    const activeSceneName = sceneProject.scene_name.replace(/[^a-zA-Z0-9_-]/g, "_") || "Untitled_Scene";
    const activeShotNumber = shot.shot_number.toString().padStart(2, "0");

    const payload = {
      ...config,
      workflow_filename: selectedWorkflowFile || sceneProject.workflow_file,
      output_workflow_filename: `${activeSceneName}_Shot_${activeShotNumber}.json`,
      prompt_node_id: selectedPromptNodeId,
      expanded_prompt: shot.expanded_prompt,
      node_mappings: shotMappings,
      bypass_missing: bypassMissing,
      generation_parameters: generationParams,
      parameter_node_mappings: parameterNodeMappings,
      scene_name: activeSceneName,
      shot_number: activeShotNumber
    };

    const response = await fetch("/api/workflow/stage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Transfer failed");
    return data.success;
  };

  const handleSceneTransferAll = async (): Promise<boolean> => {
    const activeSceneName = sceneProject.scene_name.replace(/[^a-zA-Z0-9_-]/g, "_") || "Untitled_Scene";
    const shotsData = sceneProject.shots.map(shot => {
      const shotMappings: Record<string, string> = {};
      if (parsedWorkflow) {
        const imgLoaders = parsedWorkflow.nodes_info.image_loader_nodes || [];
        const vidLoaders = parsedWorkflow.nodes_info.video_loader_nodes || [];
        const audLoaders = parsedWorkflow.nodes_info.audio_loader_nodes || [];
        
        const allLoaders = [...imgLoaders, ...vidLoaders, ...audLoaders];
        for (let i = 0; i < Math.max(allLoaders.length, 15); i++) {
          const filename = shot.assigned_slots[i] || sceneProject.shared_assets.find(a => a.slot_index === i)?.filename;
          if (filename && allLoaders[i]) {
            shotMappings[allLoaders[i].id] = filename;
          }
        }
      }
      return {
        shot_number: shot.shot_number.toString().padStart(2, "0"),
        shot_type: shot.shot_type,
        camera_movement: shot.camera_movement,
        lens_focal_length: shot.lens_focal_length || "50mm Standard Prime",
        aspect_ratio: shot.aspect_ratio || "16:9 Widescreen",
        expanded_prompt: shot.expanded_prompt,
        prompt_node_id: selectedPromptNodeId,
        node_mappings: shotMappings
      };
    });

    const payload = {
      ...config,
      workflow_filename: selectedWorkflowFile || sceneProject.workflow_file,
      scene_name: activeSceneName,
      shots: shotsData,
      bypass_missing: bypassMissing,
      generation_parameters: generationParams,
      parameter_node_mappings: parameterNodeMappings
    };

    const response = await fetch("/api/workflow/stage-scene", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Scene transfer failed");
    return data.success;
  };

  const handleSaveProject = async (filename: string) => {
    const consolidatedSubjects = Array.from(
      new Set([
        ...subjects.map(s => s.trim()).filter(Boolean),
        ...assets.map(a => (a.subject_name || "").trim()).filter(Boolean)
      ])
    );

    const payload: SceneProjectFile = {
      ...sceneProject,
      lm_studio_url: config.lm_studio_url,
      config: {
        ...(sceneProject.config || {}),
        ...config,
        lm_studio_url: config.lm_studio_url
      },
      llm_provider: llmProvider,
      parameter_node_mappings: parameterNodeMappings,
      generation_params: generationParams,
      assets,
      subjects: consolidatedSubjects
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
  };

  const handleLoadProject = async (filename: string) => {
    const res = await fetch(`/api/projects/${filename}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to load project.");
    }
    const data = await res.json();

    // Restore local LLM IP / URL & provider
    const restoredLlmUrl = data.lm_studio_url || data.config?.lm_studio_url || data.local_llm_url || data.llm_url || data.llm_endpoint;
    if (restoredLlmUrl) {
      setConfig(prev => ({
        ...prev,
        lm_studio_url: restoredLlmUrl
      }));
    }
    const loadedLlmProvider = data.llmProvider || data.llm_provider || data.llmChoice || data.providerChoice || "lm_studio";
    setLlmProvider(loadedLlmProvider === "gemini" ? "gemini" : "lm_studio");

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

      setBasicStub("");
      setExpandedPrompt("");
      
      // Restore config if bundled
      if (data.config) {
        setConfig(prev => ({
          ...prev,
          ...data.config,
          lm_studio_url: restoredLlmUrl || data.config.lm_studio_url || prev.lm_studio_url
        }));
      }

      setSceneProject(data);
      setCurrentProjectName(filename.replace(/\.json$/i, ""));
      setActiveShotId(data.shots && data.shots.length > 0 ? data.shots[0].id : null);
      setActiveSection("scene");
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

    // 0. Reset state completely before hydrating

    setNodeMappings({});
    setParameterNodeMappings({});
    setBasicStub("");
    setExpandedPrompt("");

    
    // 1. Sync & set saved assets if present
    if (Array.isArray(data.assets) && data.assets.length > 0) {
      const normalizedAssets = data.assets.map((a: any, idx: number) => ({
        ...a,
        slot_index: a.slot_index !== undefined ? a.slot_index : idx,
        media_type: a.media_type || (/\.(mp3|wav|ogg|m4a|flac)$/i.test(a.filename) ? "audio" : /\.(mp4|mov|webm|mkv)$/i.test(a.filename) ? "video" : "image"),
        preview_url: getAssetMediaUrl(a.filename)
      }));
      // It's handled by setSceneProject later in V2 block.
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
    
    // 2. Restore subjects registry is handled by setSceneProject

    if (data.config) {
      setConfig(prev => ({
        ...prev,
        ...data.config,
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
      setScenePlanning({
        scene_name: loadedPlanning.scene_name || "",
        shot_number: loadedPlanning.shot_number || "01",
        shot_type: loadedPlanning.shot_type || "Medium Shot (MS)",
        camera_movement: loadedPlanning.camera_movement || "Locked Off (Static)",
        lens_focal_length: loadedPlanning.lens_focal_length || "50mm Standard Prime",
        aspect_ratio: loadedPlanning.aspect_ratio || "16:9 Widescreen"
      });
    }
    setBasicStub(data.basicStub || "");
    setExpandedPrompt(data.expandedPrompt || "");
    setCurrentProjectName(filename.replace(/\.json$/i, ""));
    
    await fetchWorkflows();
    
    setTimeout(() => setIsDirty(false), 100);
    const assetCount = Array.isArray(data.assets) ? data.assets.length : 0;
    addToast(`Project "${filename}" loaded successfully (${assetCount} image assets restored).`, "success");
  };

  const handleCreateNewProject = async (sceneName: string) => {
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
        ...config
      },
      llm_provider: llmProvider,
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
        staged: false,
        updated_at: new Date().toISOString()
      }]
    };

    const cleanFilename = sceneName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_").replace(/_+/g, "_") || "untitled_scene";
    
    // Initialize clean in-memory state without writing to disk
    setNodeMappings({});
    setParameterNodeMappings({});
    setBasicStub("");
    setExpandedPrompt("");
    
    setSceneProject(newScene);
    setCurrentProjectName(cleanFilename);
    setActiveShotId(newScene.shots[0].id);
    setHasLoadedProject(true);
    setIsDirty(false);
    
    addToast(`New scene "${sceneName}" created in-memory. Save when ready!`, "info");
  };

  // Fetch workflows and assets on initial mount
  const fetchWorkflows = async () => {
    try {
      const res = await fetch("/api/workflows");
      const data = await res.json();
      if (data.workflows) {
        setWorkflows(data.workflows);
        if (data.workflows.length > 0 && !selectedWorkflowFile) {
          setSelectedWorkflowFile(data.workflows[0].filename);
        }
      }
    } catch (e) {
      console.error("Failed to load workflows", e);
    }
  };

  const fetchAssets = async (sceneName?: string) => {
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
              return existing; // KEEP full metadata & slot assignment!
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
  };

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
  }, [sceneProject.scene_name, currentProjectName]);

  // Parse workflow when selection changes
  useEffect(() => {
    if (!selectedWorkflowFile) return;

    const parseSelectedWorkflow = async () => {
      try {
        const activeSceneName = sceneProject.scene_name || currentProjectName || "Untitled_Scene";
        const res = await fetch("/api/workflows/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: selectedWorkflowFile, scene_name: activeSceneName })
        });
        const data = await res.json();
        if (res.ok && data.nodes_info) {
          setParsedWorkflow(data);

          // Auto-sync detected parameter nodes while preserving user manual overrides
          const detected = data.detected_nodes || data.nodes_info.detected_nodes;
          if (detected) {
            setParameterNodeMappings(prev => ({
              steps: prev.steps || detected.steps || "",
              megapixels: prev.megapixels || detected.megapixels || "",
              frames: prev.frames || detected.frames || ""
            }));
          }

          if (data.detected_values) {
            setGenerationParams(prev => ({
              steps: typeof data.detected_values.steps === "number" ? data.detected_values.steps : prev.steps,
              megapixels: typeof data.detected_values.megapixels === "number" ? data.detected_values.megapixels : prev.megapixels,
              frames: typeof data.detected_values.frames === "number" ? data.detected_values.frames : prev.frames
            }));
          }

          // Preserve selected prompt node ID if valid, otherwise select default
          setSelectedPromptNodeId(prev => {
            if (prev && data.nodes_info.prompt_nodes?.some((p: any) => p.id === prev)) {
              return prev;
            }
            return data.nodes_info.prompt_nodes?.[0]?.id || prev || "";
          });

          // Preserve existing node mappings for the parsed loader nodes
          setNodeMappings(prev => {
            const nextMappings: Record<string, string> = {};
            data.nodes_info.image_loader_nodes?.forEach((n: any) => {
              nextMappings[n.id] = prev[n.id] || "";
            });
            data.nodes_info.video_loader_nodes?.forEach((n: any) => {
              nextMappings[n.id] = prev[n.id] || "";
            });
            data.nodes_info.audio_loader_nodes?.forEach((n: any) => {
              nextMappings[n.id] = prev[n.id] || "";
            });
            return nextMappings;
          });
        }
      } catch (err) {
        console.error("Failed to parse workflow", err);
      }
    };

    parseSelectedWorkflow();
  }, [selectedWorkflowFile]);

  // Asset handlers
  const handleAssetUploaded = (newAsset: MediaAsset, targetSlotIndex?: number, mediaType?: "image" | "audio" | "video") => {
    const slotIdx = targetSlotIndex !== undefined ? targetSlotIndex : (newAsset.slot_index ?? 0);
    const mType = mediaType || newAsset.media_type || "image";
    const assetWithSlot: MediaAsset = {
      ...newAsset,
      slot_index: slotIdx,
      media_type: mType
    };

    setSceneProject(prevProject => {
      const prevAssets = prevProject.assets || [];
      const exactMatch = prevAssets.findIndex(a => a.filename === newAsset.filename);
      let nextAssets = [...prevAssets];
      if (exactMatch !== -1) {
        nextAssets[exactMatch] = assetWithSlot;
      } else {
        nextAssets.push(assetWithSlot);
      }
      return { ...prevProject, assets: nextAssets };
    });
    setIsDirty(true);

    // Auto-map if there's a loader node for this slot type and index
    if (parsedWorkflow) {
      const loaderNodes = mType === "image" 
        ? parsedWorkflow.nodes_info.image_loader_nodes 
        : mType === "video" 
        ? parsedWorkflow.nodes_info.video_loader_nodes 
        : parsedWorkflow.nodes_info.audio_loader_nodes;

      if (loaderNodes && loaderNodes[slotIdx]) {
        const targetNodeId = loaderNodes[slotIdx].id;
        setNodeMappings(prev => ({ ...prev, [targetNodeId]: newAsset.filename }));
      } else {
        const emptySlot = loaderNodes?.find((n: any) => !nodeMappings[n.id]);
        if (emptySlot) {
          setNodeMappings(prev => ({ ...prev, [emptySlot.id]: newAsset.filename }));
        }
      }
    }
  };

  const handleAssetUpdated = (oldFilename: string, newAsset: MediaAsset) => {
    setSceneProject(prev => {
      const prevAssets = prev.assets || [];
      return {
        ...prev,
        assets: prevAssets.map(a => a.filename === oldFilename ? { ...newAsset, slot_index: a.slot_index ?? newAsset.slot_index } : a)
      };
    });
    setIsDirty(true);
    // Update nodeMappings if the filename changed
    if (oldFilename !== newAsset.filename) {
      setNodeMappings(prev => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          if (next[key] === oldFilename) next[key] = newAsset.filename;
        }
        return next;
      });
    }
  };

  const handleAssetDeleted = (filename: string) => {
    setSceneProject(prev => {
      const prevAssets = prev.assets || [];
      const nextShots = (prev.shots || []).map(shot => {
        const nextSlots = { ...(shot.assigned_slots || {}) };
        for (const key of Object.keys(nextSlots)) {
          if (nextSlots[key] === filename) {
            delete nextSlots[key];
          }
        }
        return { ...shot, assigned_slots: nextSlots };
      });
      return {
        ...prev,
        assets: prevAssets.filter(a => a.filename !== filename),
        shots: nextShots
      };
    });
    setIsDirty(true);
    // Clear mappings referencing this deleted asset
    setNodeMappings(prev => {
      const updated = { ...prev };
      for (const [nodeId, file] of Object.entries(updated)) {
        if (file === filename) updated[nodeId] = "";
      }
      return updated;
    });
  };

  const handleUpdateMapping = (nodeId: string, filename: string) => {
    setNodeMappings(prev => ({ ...prev, [nodeId]: filename }));
    if (activeShotId) {
      updateActiveShot(prev => ({
        ...prev,
        node_mappings: {
          ...(prev.node_mappings || {}),
          [nodeId]: filename
        }
      }));
    }
  };

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
  };

  const updateActiveShot = (updater: (prev: ShotItem) => ShotItem) => {
    setSceneProject(prev => {
      const shots = [...prev.shots];
      const idx = shots.findIndex(s => s.id === activeShotId);
      if (idx !== -1) {
        shots[idx] = updater(shots[idx]);
      }
      return { ...prev, shots };
    });
  };

  useEffect(() => {
    if (activeShotId) {
      const shot = sceneProject.shots.find(s => s.id === activeShotId);
      if (shot) {
        if (shot.workflow_file !== undefined) setSelectedWorkflowFile(shot.workflow_file);
        if (shot.prompt_node_id !== undefined) setSelectedPromptNodeId(shot.prompt_node_id);
        if (shot.node_mappings !== undefined) setNodeMappings(shot.node_mappings);
        if (shot.generation_params !== undefined) setGenerationParams(shot.generation_params);
        if (shot.parameter_node_mappings !== undefined) setParameterNodeMappings(shot.parameter_node_mappings);
        if (shot.basic_stub !== undefined) setBasicStub(shot.basic_stub);
        if (shot.expanded_prompt !== undefined) setExpandedPrompt(shot.expanded_prompt);
      }
    }
  }, [activeShotId, sceneProject.shots]);


  return {
    config, setConfig,
    workflows, setWorkflows,
    selectedWorkflowFile, setSelectedWorkflowFile,
    parsedWorkflow, setParsedWorkflow,
    selectedPromptNodeId, setSelectedPromptNodeId,
    nodeMappings, setNodeMappings,
    bypassMissing, setBypassMissing,
    generationParams, setGenerationParams,
    parameterNodeMappings, setParameterNodeMappings,
    assets,
    sceneProject, setSceneProject,
    scenePlanning, setScenePlanning,
    basicStub, setBasicStub,
    expandedPrompt, setExpandedPrompt,
    llmProvider, setLlmProvider,
    activeSection, setActiveSection,
    activeShotId, setActiveShotId,
    isCodeModalOpen, setIsCodeModalOpen,
    isDirty, setIsDirty,
    hasLoadedProject, setHasLoadedProject,
    isInitialLoad, setIsInitialLoad,
    isNewModalOpen, setIsNewModalOpen,
    isSaveModalOpen, setIsSaveModalOpen,
    isLoadModalOpen, setIsLoadModalOpen,
    currentProjectName, setCurrentProjectName,
    toasts, setToasts,
    monitorState,
    availableScenes, setAvailableScenes,
    addToast,
    subjects,
    promptPrefix,
    handleRegisterSubject,
    handleUpdateCharacter,
    handleDeleteCharacter,
    fetchWorkflows,
    handleUpdateParam,
    handleUpdateParameterMapping,
    handleSceneExpandPrompt,
    handleSceneTransfer,
    handleSceneTransferAll,
    handleSaveProject,
    handleLoadProject,
    handleCreateNewProject,
    handleAssetUploaded,
    handleAssetUpdated,
    handleAssetDeleted,
    handleUpdateMapping,
    scrollToSection,
    updateActiveShot
  };
}
